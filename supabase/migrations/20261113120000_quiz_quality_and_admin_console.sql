-- =============================================================================
-- SIMULADOS, QUALIDADE DAS QUESTOES E CONSOLE DO ADMIN
--
-- 1. questions.is_active: tirar uma questao de circulacao sem apagar o historico.
-- 2. get_quiz_questions: o simulado geral ("Iniciar Simulado" e categorias)
--    trazia sempre as MESMAS 10 primeiras questoes da tabela. Agora usa a mesma
--    selecao inteligente das trilhas (ineditas -> erradas -> demais, aleatorio).
-- 3. question_reports: o aluno reporta erro em uma questao (gabarito, enunciado,
--    desatualizada...) e a equipe trata a fila no painel.
-- 4. RPCs do painel: visao geral da plataforma (metrica estrela "simulados
--    concluidos por semana"), gestao completa de questoes (com gabarito,
--    explicacao e estatisticas de acerto) e fila de reportes.
--
-- Toda RPC administrativa e SECURITY DEFINER, revalida o nivel do chamador
-- (_access_level) e registra a acao em audit_logs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Questoes ativas / inativas
-- -----------------------------------------------------------------------------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- `questions` usa privilegios por coluna: a view (security_invoker) precisa ler is_active.
GRANT SELECT (is_active) ON public.questions TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_questions_categoria_active
  ON public.questions (categoria) WHERE is_active;

-- Mesmas colunas da versao anterior (CREATE OR REPLACE exige isso); so filtra as
-- inativas. get_practice_questions e get_track_progress leem desta view, entao
-- passam a ignorar questoes retiradas automaticamente.
CREATE OR REPLACE VIEW public.questions_public
WITH (security_invoker = on, security_barrier = true) AS
SELECT q.id, q.enunciado, q.alternativas, q.categoria, q.dificuldade,
       q.created_at, q.subject_id, q.is_premium, q.topico, q.origem, q.nivel
FROM public.questions q
WHERE q.is_active;

REVOKE ALL ON public.questions_public FROM anon, authenticated;
GRANT SELECT ON public.questions_public TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Selecao de questoes para o simulado geral
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_quiz_questions(
  p_categoria text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid, enunciado text, alternativas text[], categoria text, dificuldade text,
  created_at timestamptz, subject_id uuid, is_premium boolean,
  topico text, origem text, nivel text
)
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH last_attempt AS (
    SELECT DISTINCT ON (a.question_id) a.question_id, a.is_correct
    FROM public.user_question_attempts a
    WHERE a.user_id = auth.uid()
    ORDER BY a.question_id, a.created_at DESC
  )
  SELECT q.id, q.enunciado, q.alternativas, q.categoria, q.dificuldade,
         q.created_at, q.subject_id, q.is_premium, q.topico, q.origem, q.nivel
  FROM public.questions_public q
  LEFT JOIN last_attempt la ON la.question_id = q.id
  WHERE p_categoria IS NULL OR p_categoria IN ('', 'Todas') OR q.categoria = p_categoria
  ORDER BY
    CASE WHEN la.question_id IS NULL THEN 0
         WHEN la.is_correct = false THEN 1
         ELSE 2 END,
    random()
  LIMIT greatest(1, least(coalesce(p_limit, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.get_quiz_questions(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions(text, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Reportes de erro em questoes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN (
    'gabarito_errado', 'enunciado_confuso', 'desatualizada', 'erro_digitacao', 'outro'
  )),
  details text CHECK (details IS NULL OR char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_note text CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_reports_status
  ON public.question_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_reports_question
  ON public.question_reports (question_id);
-- Um reporte aberto por aluno e questao (evita spam do mesmo problema).
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_reports_open_per_user
  ON public.question_reports (question_id, user_id) WHERE status = 'open';

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own question reports" ON public.question_reports;
CREATE POLICY "Users read own question reports" ON public.question_reports
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Escrita somente pelas RPCs abaixo.
REVOKE ALL ON public.question_reports FROM anon, authenticated;
GRANT SELECT ON public.question_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_question(
  p_question_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today integer;
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_reason NOT IN ('gabarito_errado', 'enunciado_confuso', 'desatualizada', 'erro_digitacao', 'outro') THEN
    RAISE EXCEPTION 'Motivo inválido' USING ERRCODE = '22023';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > 1000 THEN
    v_details := left(v_details, 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = p_question_id) THEN
    RAISE EXCEPTION 'Questão não encontrada' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_today FROM public.question_reports
  WHERE user_id = v_uid AND created_at > now() - interval '1 day';
  IF v_today >= 20 THEN
    RAISE EXCEPTION 'Limite diário de reportes atingido. Tente amanhã.' USING ERRCODE = '54000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.question_reports
             WHERE question_id = p_question_id AND user_id = v_uid AND status = 'open') THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  INSERT INTO public.question_reports (question_id, user_id, reason, details)
  VALUES (p_question_id, v_uid, p_reason, v_details);

  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.report_question(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_question(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Console do admin
-- -----------------------------------------------------------------------------

-- 4.1 Visao geral da plataforma (admin / master)
CREATE OR REPLACE FUNCTION public.admin_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level text := public._access_level(auth.uid());
  v_tz constant text := 'America/Sao_Paulo';
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_level NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH activity AS (
    SELECT user_id, created_at FROM public.quiz_results WHERE created_at > now() - interval '30 days'
    UNION ALL
    SELECT user_id, created_at FROM public.user_question_attempts WHERE created_at > now() - interval '30 days'
  ),
  weeks AS (
    SELECT generate_series(v_week_start - interval '11 weeks', v_week_start, interval '1 week') AS wk
  ),
  days AS (
    SELECT generate_series(
      ((now() AT TIME ZONE v_tz)::date - 29), (now() AT TIME ZONE v_tz)::date, interval '1 day'
    )::date AS d
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM public.profiles),
      'plus', (SELECT count(*) FROM public.profiles WHERE tier = 'plus'),
      'new_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
      'active_1d', (SELECT count(DISTINCT user_id) FROM activity WHERE created_at > now() - interval '1 day'),
      'active_7d', (SELECT count(DISTINCT user_id) FROM activity WHERE created_at > now() - interval '7 days'),
      'active_30d', (SELECT count(DISTINCT user_id) FROM activity),
      'banned', (SELECT count(DISTINCT b.user_id) FROM public.user_bans b
                 WHERE b.is_active AND (b.ban_type = 'permanent' OR b.expires_at IS NULL OR b.expires_at > now()))
    ),
    'quizzes', jsonb_build_object(
      'total', (SELECT count(*) FROM public.quiz_results),
      'this_week', (SELECT count(*) FROM public.quiz_results WHERE created_at >= v_week_start),
      'last_week', (SELECT count(*) FROM public.quiz_results
                    WHERE created_at >= v_week_start - interval '1 week' AND created_at < v_week_start),
      'avg_score_30d', (SELECT round(avg(score))::int FROM public.quiz_results WHERE created_at > now() - interval '30 days'),
      'weekly', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'week', to_char(w.wk AT TIME ZONE v_tz, 'YYYY-MM-DD'),
          'quizzes', (SELECT count(*) FROM public.quiz_results r
                      WHERE r.created_at >= w.wk AND r.created_at < w.wk + interval '1 week'),
          'students', (SELECT count(DISTINCT r.user_id) FROM public.quiz_results r
                       WHERE r.created_at >= w.wk AND r.created_at < w.wk + interval '1 week')
        ) ORDER BY w.wk), '[]'::jsonb)
        FROM weeks w
      )
    ),
    'signups_daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d.d, 'YYYY-MM-DD'),
        'signups', (SELECT count(*) FROM public.profiles p WHERE (p.created_at AT TIME ZONE v_tz)::date = d.d),
        'active', (SELECT count(DISTINCT a.user_id) FROM activity a WHERE (a.created_at AT TIME ZONE v_tz)::date = d.d)
      ) ORDER BY d.d), '[]'::jsonb)
      FROM days d
    ),
    'answers', jsonb_build_object(
      'attempts_7d', (SELECT count(*) FROM public.user_question_attempts WHERE created_at > now() - interval '7 days'),
      'accuracy_30d', (SELECT round(100.0 * avg(CASE WHEN is_correct THEN 1 ELSE 0 END))::int
                       FROM public.user_question_attempts WHERE created_at > now() - interval '30 days')
    ),
    'top_subjects', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.attempts DESC), '[]'::jsonb) FROM (
        SELECT q.categoria AS name,
               count(*) AS attempts,
               round(100.0 * avg(CASE WHEN a.is_correct THEN 1 ELSE 0 END))::int AS accuracy
        FROM public.user_question_attempts a
        JOIN public.questions q ON q.id = a.question_id
        WHERE a.created_at > now() - interval '30 days'
        GROUP BY q.categoria
        ORDER BY count(*) DESC
        LIMIT 8
      ) t
    ),
    'content', jsonb_build_object(
      'questions_active', (SELECT count(*) FROM public.questions WHERE is_active),
      'questions_inactive', (SELECT count(*) FROM public.questions WHERE NOT is_active),
      'questions_premium', (SELECT count(*) FROM public.questions WHERE is_active AND is_premium),
      'questions_new_7d', (SELECT count(*) FROM public.questions WHERE created_at > now() - interval '7 days'),
      'reports_open', (SELECT count(*) FROM public.question_reports WHERE status = 'open')
    ),
    'health', jsonb_build_object(
      'last_stripe_event_at', (SELECT max(received_at) FROM public.stripe_webhook_events),
      'stripe_events_30d', (SELECT count(*) FROM public.stripe_webhook_events WHERE received_at > now() - interval '30 days'),
      'last_generation_at', (SELECT max(created_at) FROM public.question_generation_runs),
      'generation_errors_7d', (SELECT count(*) FROM public.question_generation_runs
                               WHERE status = 'error' AND created_at > now() - interval '7 days'),
      'generation_inserted_7d', (SELECT coalesce(sum(inserted), 0) FROM public.question_generation_runs
                                 WHERE created_at > now() - interval '7 days'),
      'failed_events_24h', (SELECT count(*) FROM public.audit_logs
                            WHERE NOT success AND created_at > now() - interval '1 day')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_overview() TO authenticated;

-- 4.2 Lista de questoes com gabarito e estatisticas (equipe)
CREATE OR REPLACE FUNCTION public.admin_list_questions(
  p_search text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_status text DEFAULT 'active',
  p_premium boolean DEFAULT NULL,
  p_sort text DEFAULT 'recent',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level text := public._access_level(auth.uid());
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_rows jsonb;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL OR v_level NOT IN ('master', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH stats AS (
    SELECT a.question_id,
           count(*) AS attempts,
           sum(CASE WHEN a.is_correct THEN 1 ELSE 0 END) AS correct
    FROM public.user_question_attempts a
    GROUP BY a.question_id
  ),
  reps AS (
    SELECT r.question_id, count(*) AS open_reports
    FROM public.question_reports r
    WHERE r.status = 'open'
    GROUP BY r.question_id
  ),
  base AS (
    SELECT q.*, s.name AS subject_name,
           coalesce(st.attempts, 0) AS attempts,
           coalesce(st.correct, 0) AS correct_count,
           CASE WHEN coalesce(st.attempts, 0) > 0
                THEN round(100.0 * st.correct / st.attempts)::int END AS accuracy,
           coalesce(rp.open_reports, 0) AS open_reports
    FROM public.questions q
    LEFT JOIN public.subjects s ON s.id = q.subject_id
    LEFT JOIN stats st ON st.question_id = q.id
    LEFT JOIN reps rp ON rp.question_id = q.id
    WHERE (v_search IS NULL
           OR q.enunciado ILIKE '%' || v_search || '%'
           OR q.topico ILIKE '%' || v_search || '%'
           OR q.id::text = v_search)
      AND (p_categoria IS NULL OR p_categoria IN ('', 'Todas') OR q.categoria = p_categoria)
      AND (p_origem IS NULL OR p_origem = '' OR q.origem = p_origem)
      AND (p_premium IS NULL OR q.is_premium = p_premium)
      AND CASE coalesce(p_status, 'active')
            WHEN 'inactive' THEN NOT q.is_active
            WHEN 'all' THEN true
            WHEN 'reported' THEN coalesce(rp.open_reports, 0) > 0
            ELSE q.is_active
          END
  )
  SELECT
    (SELECT count(*) FROM base),
    coalesce((
      SELECT jsonb_agg(to_jsonb(x) - 'content_hash') FROM (
        SELECT * FROM base b
        ORDER BY
          CASE WHEN p_sort = 'reported' THEN b.open_reports END DESC NULLS LAST,
          -- "Mais erradas": so entra no topo quem tem amostra minima (5 respostas).
          CASE WHEN p_sort = 'hardest' AND b.attempts >= 5 THEN b.accuracy END ASC NULLS LAST,
          CASE WHEN p_sort = 'most_answered' THEN b.attempts END DESC NULLS LAST,
          b.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) x
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_questions(text, text, text, text, boolean, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_questions(text, text, text, text, boolean, text, integer, integer) TO authenticated;

-- 4.3 Edicao de questao.
--  * admin / master: conteudo (enunciado, alternativas, gabarito, explicacao,
--    categoria, topico, dificuldade) + premium + ativa.
--  * moderador: apenas premium e ativa (curadoria).
CREATE OR REPLACE FUNCTION public.admin_update_question(p_question_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level text := public._access_level(auth.uid());
  v_q public.questions%ROWTYPE;
  v_alts text[];
  v_correta integer;
  v_changed text[] := '{}';
  v_key text;
  v_content_keys constant text[] := ARRAY['enunciado', 'alternativas', 'correta', 'explicacao',
                                          'categoria', 'topico', 'dificuldade'];
BEGIN
  IF auth.uid() IS NULL OR v_level NOT IN ('master', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Alteração inválida' USING ERRCODE = '22023';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF v_key <> ALL (v_content_keys || ARRAY['is_premium', 'is_active']) THEN
      RAISE EXCEPTION 'Campo não permitido: %', v_key USING ERRCODE = '22023';
    END IF;
    IF v_key = ANY (v_content_keys) AND v_level = 'moderator' THEN
      RAISE EXCEPTION 'Moderadores só alteram Premium e Ativa' USING ERRCODE = '42501';
    END IF;
  END LOOP;

  SELECT * INTO v_q FROM public.questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Questão não encontrada' USING ERRCODE = '22023';
  END IF;

  IF p_patch ? 'enunciado' THEN
    IF char_length(btrim(coalesce(p_patch->>'enunciado', ''))) < 10 THEN
      RAISE EXCEPTION 'Enunciado muito curto' USING ERRCODE = '22023';
    END IF;
    IF btrim(p_patch->>'enunciado') IS DISTINCT FROM v_q.enunciado THEN
      v_q.enunciado := btrim(p_patch->>'enunciado'); v_changed := array_append(v_changed, 'enunciado');
    END IF;
  END IF;

  IF p_patch ? 'alternativas' THEN
    IF jsonb_typeof(p_patch->'alternativas') <> 'array' THEN
      RAISE EXCEPTION 'Alternativas inválidas' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(btrim(x) ORDER BY ord) INTO v_alts
    FROM jsonb_array_elements_text(p_patch->'alternativas') WITH ORDINALITY AS t(x, ord);
    IF coalesce(array_length(v_alts, 1), 0) NOT BETWEEN 2 AND 6
       OR EXISTS (SELECT 1 FROM unnest(v_alts) a WHERE a = '') THEN
      RAISE EXCEPTION 'Informe de 2 a 6 alternativas, sem campos vazios' USING ERRCODE = '22023';
    END IF;
    IF v_alts IS DISTINCT FROM v_q.alternativas THEN
      v_q.alternativas := v_alts; v_changed := array_append(v_changed, 'alternativas');
    END IF;
  END IF;

  IF p_patch ? 'correta' THEN
    v_correta := (p_patch->>'correta')::integer;
    IF v_correta IS DISTINCT FROM v_q.correta THEN
      v_q.correta := v_correta; v_changed := array_append(v_changed, 'correta');
    END IF;
  END IF;
  IF v_q.correta IS NULL OR v_q.correta < 0 OR v_q.correta >= array_length(v_q.alternativas, 1) THEN
    RAISE EXCEPTION 'O gabarito deve apontar para uma das alternativas' USING ERRCODE = '22023';
  END IF;

  IF p_patch ? 'explicacao' THEN
    IF nullif(btrim(coalesce(p_patch->>'explicacao', '')), '') IS DISTINCT FROM v_q.explicacao THEN
      v_q.explicacao := nullif(btrim(coalesce(p_patch->>'explicacao', '')), '');
      v_changed := array_append(v_changed, 'explicacao');
    END IF;
  END IF;

  IF p_patch ? 'categoria' THEN
    IF char_length(btrim(coalesce(p_patch->>'categoria', ''))) NOT BETWEEN 2 AND 80 THEN
      RAISE EXCEPTION 'Categoria inválida' USING ERRCODE = '22023';
    END IF;
    IF btrim(p_patch->>'categoria') IS DISTINCT FROM v_q.categoria THEN
      v_q.categoria := btrim(p_patch->>'categoria'); v_changed := array_append(v_changed, 'categoria');
    END IF;
  END IF;

  IF p_patch ? 'topico' THEN
    IF nullif(btrim(coalesce(p_patch->>'topico', '')), '') IS DISTINCT FROM v_q.topico THEN
      v_q.topico := nullif(btrim(coalesce(p_patch->>'topico', '')), ''); v_changed := array_append(v_changed, 'topico');
    END IF;
  END IF;

  IF p_patch ? 'dificuldade' THEN
    IF p_patch->>'dificuldade' NOT IN ('Fácil', 'Médio', 'Difícil') THEN
      RAISE EXCEPTION 'Dificuldade inválida' USING ERRCODE = '22023';
    END IF;
    IF p_patch->>'dificuldade' IS DISTINCT FROM v_q.dificuldade THEN
      v_q.dificuldade := p_patch->>'dificuldade'; v_changed := array_append(v_changed, 'dificuldade');
    END IF;
  END IF;

  IF p_patch ? 'is_premium' AND (p_patch->>'is_premium')::boolean IS DISTINCT FROM v_q.is_premium THEN
    v_q.is_premium := (p_patch->>'is_premium')::boolean; v_changed := array_append(v_changed, 'is_premium');
  END IF;
  IF p_patch ? 'is_active' AND (p_patch->>'is_active')::boolean IS DISTINCT FROM v_q.is_active THEN
    v_q.is_active := (p_patch->>'is_active')::boolean; v_changed := array_append(v_changed, 'is_active');
  END IF;

  IF array_length(v_changed, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'changed', '[]'::jsonb);
  END IF;

  UPDATE public.questions SET
    enunciado = v_q.enunciado,
    alternativas = v_q.alternativas,
    correta = v_q.correta,
    explicacao = v_q.explicacao,
    categoria = v_q.categoria,
    topico = v_q.topico,
    dificuldade = v_q.dificuldade,
    is_premium = v_q.is_premium,
    is_active = v_q.is_active,
    updated_at = now()
  WHERE id = p_question_id;

  PERFORM public._audit('question_updated', jsonb_build_object(
    'question_id', p_question_id, 'fields', to_jsonb(v_changed), 'by_level', v_level));

  RETURN jsonb_build_object('ok', true, 'changed', to_jsonb(v_changed));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_question(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_question(uuid, jsonb) TO authenticated;

-- 4.4 Fila de reportes (equipe)
CREATE OR REPLACE FUNCTION public.admin_list_question_reports(
  p_status text DEFAULT 'open',
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level text := public._access_level(auth.uid());
  v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
  v_rows jsonb;
  v_total integer;
BEGIN
  IF auth.uid() IS NULL OR v_level NOT IN ('master', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total FROM public.question_reports r
  WHERE p_status = 'all' OR r.status = coalesce(p_status, 'open');

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows FROM (
    SELECT r.id, r.question_id, r.reason, r.details, r.status, r.resolution_note,
           r.resolved_at, r.created_at,
           p.display_name AS reporter_name,
           rp.display_name AS resolver_name,
           q.enunciado, q.categoria, q.is_active,
           (SELECT count(*) FROM public.question_reports r2
             WHERE r2.question_id = r.question_id AND r2.status = 'open') AS open_for_question
    FROM public.question_reports r
    JOIN public.questions q ON q.id = r.question_id
    LEFT JOIN public.profiles p ON p.user_id = r.user_id
    LEFT JOIN public.profiles rp ON rp.user_id = r.resolved_by
    WHERE p_status = 'all' OR r.status = coalesce(p_status, 'open')
    ORDER BY r.created_at DESC
    LIMIT v_limit OFFSET greatest(0, coalesce(p_offset, 0))
  ) x;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_question_reports(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_question_reports(text, integer, integer) TO authenticated;

-- 4.5 Tratar reporte. Ao resolver, todos os reportes abertos da mesma questao
--     sao fechados juntos e cada aluno recebe uma notificacao de agradecimento.
CREATE OR REPLACE FUNCTION public.admin_resolve_question_report(
  p_report_id uuid,
  p_status text,
  p_note text DEFAULT NULL,
  p_apply_to_question boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level text := public._access_level(auth.uid());
  v_report public.question_reports%ROWTYPE;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ids uuid[];
  v_user uuid;
BEGIN
  IF auth.uid() IS NULL OR v_level NOT IN ('master', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('resolved', 'dismissed', 'open') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL THEN v_note := left(v_note, 1000); END IF;

  SELECT * INTO v_report FROM public.question_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reporte não encontrado' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'open' THEN
    UPDATE public.question_reports
       SET status = 'open', resolved_by = NULL, resolved_at = NULL, resolution_note = NULL
     WHERE id = p_report_id;
    v_ids := ARRAY[p_report_id];
  ELSE
    WITH upd AS (
      UPDATE public.question_reports
         SET status = p_status, resolved_by = auth.uid(), resolved_at = now(),
             resolution_note = coalesce(v_note, resolution_note)
       WHERE status = 'open'
         AND (id = p_report_id OR (coalesce(p_apply_to_question, true) AND question_id = v_report.question_id))
      RETURNING id, user_id
    )
    SELECT array_agg(id) INTO v_ids FROM upd;

    IF p_status = 'resolved' THEN
      FOR v_user IN
        SELECT DISTINCT user_id FROM public.question_reports
        WHERE id = ANY (coalesce(v_ids, '{}')) AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, icon, data)
        VALUES (v_user, 'question_report',
                'Obrigado pelo aviso!',
                'A questão que você reportou foi revisada pela equipe.'
                  || CASE WHEN v_note IS NOT NULL THEN ' ' || v_note ELSE '' END,
                'check',
                jsonb_build_object('question_id', v_report.question_id));
      END LOOP;
    END IF;
  END IF;

  PERFORM public._audit('question_report_' || p_status, jsonb_build_object(
    'report_ids', to_jsonb(coalesce(v_ids, '{}')), 'question_id', v_report.question_id));

  RETURN jsonb_build_object('ok', true, 'updated', coalesce(array_length(v_ids, 1), 0));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_question_report(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_question_report(uuid, text, text, boolean) TO authenticated;
