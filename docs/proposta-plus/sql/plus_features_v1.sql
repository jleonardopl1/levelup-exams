-- =============================================================================
-- PROPOSTA (rascunho validado) — Funcionalidades Plus v1
-- Ver docs/PROPOSTA_PLUS.md. NÃO está em supabase/migrations/ de propósito:
-- só vira migration depois de aprovado (copiar para supabase/migrations/<timestamp>_plus_features_v1.sql).
--
-- Validado em Postgres (PGlite) sobre as 39 migrations atuais + seed da trilha
-- (scripts/validate-proposta-plus.mjs).
--
--   A. Simulado Oficial: prova completa no formato do edital, nota ponderada no servidor
--   B. Posição entre candidatos do mesmo cargo (percentil)
--   C. Revisão espaçada dos erros (Leitner, comprimida pela data da prova)
--   D. Passe Concurso: Plus avulso até a data da prova (reaproveita premium_grants)
-- =============================================================================

-- Data "do aluno": a trilha atual é de Cuiabá e a geração diária já usa este fuso.
CREATE OR REPLACE FUNCTION public._today_local()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS
$$ SELECT (now() AT TIME ZONE 'America/Cuiaba')::date $$;

-- =============================================================================
-- A. SIMULADO OFICIAL
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mock_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.study_track_modules(id) ON DELETE CASCADE,
  cargo text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz NOT NULL,
  finished_at timestamptz,
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer,
  score numeric(6,2),            -- nota ponderada 0..100 (pesos do edital)
  approved boolean,              -- nota mínima + não zerar nenhuma área
  area_scores jsonb              -- [{area, questoes, acertos, pontos, max}]
);
-- No máximo um simulado em andamento por aluno.
CREATE UNIQUE INDEX IF NOT EXISTS mock_exams_one_open
  ON public.mock_exams(user_id) WHERE finished_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mock_exams_ranking
  ON public.mock_exams(module_id, cargo, finished_at DESC) WHERE finished_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mock_exam_items (
  exam_id uuid NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  area text NOT NULL,
  points numeric(5,2) NOT NULL,
  selected_index integer,
  answered_at timestamptz,
  is_correct boolean,            -- preenchido só ao finalizar
  PRIMARY KEY (exam_id, question_id)
);

ALTER TABLE public.mock_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_exam_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mock_exams, public.mock_exam_items FROM anon, authenticated;
GRANT SELECT ON public.mock_exams, public.mock_exam_items TO authenticated;
DROP POLICY IF EXISTS "own mock exams" ON public.mock_exams;
CREATE POLICY "own mock exams" ON public.mock_exams FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own mock exam items" ON public.mock_exam_items;
CREATE POLICY "own mock exam items" ON public.mock_exam_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mock_exams e WHERE e.id = exam_id AND e.user_id = auth.uid()));

-- Inicia (ou retoma) um simulado. Free: 1 a cada 30 dias. Plus: ilimitado.
CREATE OR REPLACE FUNCTION public.start_mock_exam(p_module_id uuid, p_cargo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plus boolean;
  v_module public.study_track_modules;
  v_rules jsonb;
  v_minutes integer;
  v_open public.mock_exams;
  v_exam_id uuid;
  v_area jsonb;
  v_pos integer := 0;
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;

  SELECT * INTO v_module FROM public.study_track_modules WHERE id = p_module_id;
  IF v_module.id IS NULL OR NOT (p_cargo = ANY (v_module.cargos)) THEN
    RETURN jsonb_build_object('error', 'invalid_module_or_cargo');
  END IF;

  SELECT * INTO v_open FROM public.mock_exams WHERE user_id = v_uid AND finished_at IS NULL;
  IF v_open.id IS NOT NULL THEN
    IF v_open.deadline > now() THEN
      RETURN jsonb_build_object('exam_id', v_open.id, 'deadline', v_open.deadline, 'resumed', true);
    END IF;
    PERFORM public.finish_mock_exam(v_open.id);   -- tempo esgotado: fecha o anterior
  END IF;

  v_plus := public.get_user_tier(v_uid) = 'plus';
  IF NOT v_plus AND EXISTS (
    SELECT 1 FROM public.mock_exams
    WHERE user_id = v_uid AND started_at > now() - interval '30 days') THEN
    RETURN jsonb_build_object('error', 'free_quota', 'next_free_at',
      (SELECT max(started_at) + interval '30 days' FROM public.mock_exams WHERE user_id = v_uid));
  END IF;

  SELECT t.rules INTO v_rules FROM public.study_tracks t WHERE t.id = v_module.track_id;
  v_minutes := COALESCE((v_rules->>'duracao_minutos')::int, 240);

  INSERT INTO public.mock_exams (user_id, module_id, cargo, deadline)
  VALUES (v_uid, p_module_id, p_cargo, now() + make_interval(mins => v_minutes))
  RETURNING id INTO v_exam_id;

  -- Para cada área do edital: N questões distribuídas igualmente (round-robin) entre as
  -- matérias da área visíveis ao cargo; inéditas primeiro, depois erradas, depois o resto.
  FOR v_area IN SELECT * FROM jsonb_array_elements(v_module.structure) LOOP
    v_n := (v_area->>'questoes')::int;
    INSERT INTO public.mock_exam_items (exam_id, question_id, position, area, points)
    SELECT v_exam_id, c.id, v_pos + row_number() OVER (ORDER BY c.rr, c.subj_order, c.prio_rank),
           v_area->>'area', (v_area->>'pontos_por_questao')::numeric
    FROM (
      SELECT q.id, ts.display_order AS subj_order,
             row_number() OVER (PARTITION BY q.subject_id ORDER BY
               CASE WHEN la.question_id IS NULL THEN 0 WHEN NOT la.is_correct THEN 1 ELSE 2 END,
               random()) AS rr,
             random() AS prio_rank
      FROM public.study_track_subjects ts
      JOIN public.questions q ON q.subject_id = ts.subject_id
      LEFT JOIN LATERAL (
        SELECT a.question_id, a.is_correct FROM public.user_question_attempts a
        WHERE a.user_id = v_uid AND a.question_id = q.id
        ORDER BY a.created_at DESC LIMIT 1) la ON true
      WHERE ts.module_id = p_module_id
        AND ts.area = v_area->>'area'
        AND (ts.cargo IS NULL OR ts.cargo = p_cargo)
        AND q.is_active
        AND (q.nivel IS NULL OR q.nivel = v_module.nivel)
        AND (v_plus OR NOT q.is_premium)
    ) c
    ORDER BY c.rr, c.subj_order, c.prio_rank
    LIMIT v_n;
    v_pos := v_pos + v_n;
  END LOOP;

  UPDATE public.mock_exams SET total_questions =
    (SELECT count(*) FROM public.mock_exam_items WHERE exam_id = v_exam_id)
  WHERE id = v_exam_id;

  PERFORM public._audit('mock_exam_started', jsonb_build_object('exam_id', v_exam_id, 'module_id', p_module_id));
  RETURN jsonb_build_object('exam_id', v_exam_id,
    'deadline', now() + make_interval(mins => v_minutes), 'resumed', false);
END;
$$;

-- Questões do simulado SEM gabarito (o cliente nunca vê a correta antes de finalizar).
CREATE OR REPLACE FUNCTION public.get_mock_exam(p_exam_id uuid)
RETURNS TABLE (pos integer, question_id uuid, area text, points numeric,
               enunciado text, alternativas text[], subject_id uuid, selected_index integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.position, q.id, i.area, i.points, q.enunciado, q.alternativas, q.subject_id, i.selected_index
  FROM public.mock_exam_items i
  JOIN public.mock_exams e ON e.id = i.exam_id
  JOIN public.questions q ON q.id = i.question_id
  WHERE i.exam_id = p_exam_id AND e.user_id = auth.uid()
  ORDER BY i.position;
$$;

-- Salva/troca uma resposta enquanto houver tempo (30s de tolerância de rede).
CREATE OR REPLACE FUNCTION public.save_mock_answer(p_exam_id uuid, p_question_id uuid, p_selected_index integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exam public.mock_exams;
BEGIN
  -- Mesmo lock de finish_mock_exam: salvar e finalizar ficam em fila. Sem ele, um
  -- salvamento em voo podia gravar a resposta depois que a nota já foi calculada.
  SELECT * INTO v_exam FROM public.mock_exams WHERE id = p_exam_id AND user_id = auth.uid()
  FOR UPDATE;
  IF v_exam.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_exam.finished_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'finished'); END IF;
  IF now() > v_exam.deadline + interval '30 seconds' THEN RETURN jsonb_build_object('error', 'time_up'); END IF;
  IF p_selected_index IS NOT NULL AND (p_selected_index < 0 OR p_selected_index > 10) THEN
    RETURN jsonb_build_object('error', 'invalid_answer');
  END IF;
  UPDATE public.mock_exam_items SET selected_index = p_selected_index, answered_at = now()
  WHERE exam_id = p_exam_id AND question_id = p_question_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'question_not_in_exam'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Corrige no servidor com as regras do edital e devolve o resultado completo.
CREATE OR REPLACE FUNCTION public.finish_mock_exam(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam public.mock_exams;
  v_min numeric;
  v_areas jsonb;
  v_score numeric;
  v_correct integer;
  v_approved boolean;
BEGIN
  SELECT * INTO v_exam FROM public.mock_exams
  WHERE id = p_exam_id AND (user_id = auth.uid() OR auth.role() = 'service_role')
  FOR UPDATE;
  IF v_exam.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF v_exam.finished_at IS NULL THEN
    UPDATE public.mock_exam_items i SET is_correct = (i.selected_index = q.correta)
    FROM public.questions q WHERE q.id = i.question_id AND i.exam_id = p_exam_id;

    SELECT jsonb_agg(jsonb_build_object('area', area, 'questoes', n, 'acertos', ok,
                                        'pontos', pts, 'max', mx) ORDER BY min_pos),
           sum(pts), sum(ok), bool_and(ok > 0)
      INTO v_areas, v_score, v_correct, v_approved
    FROM (
      SELECT area, min(position) AS min_pos, count(*) AS n,
             count(*) FILTER (WHERE is_correct) AS ok,
             COALESCE(sum(points) FILTER (WHERE is_correct), 0) AS pts,
             sum(points) AS mx
      FROM public.mock_exam_items WHERE exam_id = p_exam_id GROUP BY area
    ) a;

    SELECT COALESCE((t.rules->>'nota_minima')::numeric, 40) INTO v_min
    FROM public.study_track_modules m JOIN public.study_tracks t ON t.id = m.track_id
    WHERE m.id = v_exam.module_id;

    UPDATE public.mock_exams SET finished_at = now(), score = round(v_score, 2),
      correct_answers = v_correct, area_scores = v_areas,
      approved = (v_score >= v_min AND COALESCE(v_approved, false))
    WHERE id = p_exam_id;

    -- Alimenta progresso da trilha, "Revisar erros" e a revisão espaçada.
    INSERT INTO public.user_question_attempts (user_id, question_id, selected_index, is_correct)
    SELECT v_exam.user_id, question_id, selected_index, is_correct
    FROM public.mock_exam_items WHERE exam_id = p_exam_id AND selected_index IS NOT NULL;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'exam_id', e.id, 'score', e.score, 'approved', e.approved, 'correct', e.correct_answers,
      'total', e.total_questions, 'areas', e.area_scores,
      'duration_seconds', extract(epoch FROM least(e.finished_at, e.deadline) - e.started_at)::int,
      'items', (SELECT jsonb_agg(jsonb_build_object(
          'pos', i.position, 'question_id', i.question_id, 'area', i.area,
          'selected_index', i.selected_index, 'correct_index', q.correta,
          'is_correct', i.is_correct, 'explicacao', q.explicacao) ORDER BY i.position)
        FROM public.mock_exam_items i JOIN public.questions q ON q.id = i.question_id
        WHERE i.exam_id = e.id))
    FROM public.mock_exams e WHERE e.id = p_exam_id);
END;
$$;

-- validate_answer (já em produção) devolve gabarito e explicação de qualquer questão.
-- Sem esta trava, o aluno consultaria as questões do simulado em andamento antes de
-- finalizar. Corpo idêntico ao de 20261110130000_study_tracks.sql + a checagem marcada.
CREATE OR REPLACE FUNCTION public.validate_answer(p_question_id uuid, p_selected_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_correct integer;
  v_explicacao text;
  v_premium boolean;
  v_count integer;
  v_rate_limit constant integer := 60;
  v_window constant interval := interval '1 minute';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_selected_index IS NULL OR p_selected_index < 0 OR p_selected_index > 10 THEN
    RETURN jsonb_build_object('error', 'Invalid answer');
  END IF;

  INSERT INTO public.rate_limits AS rl (identifier, endpoint, request_count, window_start)
  VALUES (v_user_id::text, 'validate_answer', 1, now())
  ON CONFLICT (identifier, endpoint) DO UPDATE SET
    request_count = CASE WHEN rl.window_start > now() - v_window THEN rl.request_count + 1 ELSE 1 END,
    window_start  = CASE WHEN rl.window_start > now() - v_window THEN rl.window_start ELSE now() END,
    updated_at = now()
  RETURNING request_count INTO v_count;

  IF v_count > v_rate_limit THEN
    RETURN jsonb_build_object('error', 'Rate limit exceeded. Please wait before trying again.');
  END IF;

  -- NOVO: questão de um Simulado Oficial ainda aberto do próprio aluno não é corrigida
  -- aqui (nem vira tentativa); o gabarito só sai por finish_mock_exam.
  IF EXISTS (
    SELECT 1 FROM public.mock_exam_items i
    JOIN public.mock_exams e ON e.id = i.exam_id
    WHERE i.question_id = p_question_id AND e.user_id = v_user_id AND e.finished_at IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'Question is part of an exam in progress');
  END IF;

  SELECT correta, explicacao, is_premium INTO v_correct, v_explicacao, v_premium
  FROM public.questions WHERE id = p_question_id;

  IF v_correct IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  IF v_premium AND public.get_user_tier(v_user_id) <> 'plus'
     AND NOT public.has_role(v_user_id, 'admin') THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  INSERT INTO public.user_question_attempts (user_id, question_id, selected_index, is_correct)
  VALUES (v_user_id, p_question_id, p_selected_index, p_selected_index = v_correct);

  RETURN jsonb_build_object(
    'is_correct', p_selected_index = v_correct,
    'correct_index', v_correct,
    'explicacao', v_explicacao
  );
END;
$$;
REVOKE ALL ON FUNCTION public.validate_answer(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_answer(uuid, integer) TO authenticated;

-- =============================================================================
-- B. POSIÇÃO ENTRE OS CANDIDATOS DO MESMO CARGO
--    Melhor nota de cada aluno nos últimos 60 dias. Só aparece com >= 20 alunos
--    (evita expor alguém e evita percentil sem significado).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_mock_exam_standing(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam public.mock_exams;
  v_n integer; v_better integer; v_approved integer;
  v_min_n constant integer := 20;
BEGIN
  SELECT * INTO v_exam FROM public.mock_exams
  WHERE id = p_exam_id AND user_id = auth.uid() AND finished_at IS NOT NULL;
  IF v_exam.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  WITH best AS (
    SELECT user_id, max(score) AS score, bool_or(approved) AS approved
    FROM public.mock_exams
    WHERE module_id = v_exam.module_id AND cargo = v_exam.cargo
      AND finished_at > now() - interval '60 days' AND user_id <> v_exam.user_id
    GROUP BY user_id)
  SELECT count(*) + 1, count(*) FILTER (WHERE score > v_exam.score),
         count(*) FILTER (WHERE approved) + CASE WHEN v_exam.approved THEN 1 ELSE 0 END
    INTO v_n, v_better, v_approved FROM best;

  IF v_n < v_min_n THEN
    RETURN jsonb_build_object('enough_data', false, 'candidates', v_n, 'needed', v_min_n);
  END IF;
  RETURN jsonb_build_object('enough_data', true, 'candidates', v_n, 'position', v_better + 1,
    'percentile', round(100.0 * (v_n - v_better - 1) / greatest(v_n - 1, 1)),
    'approved_share', round(100.0 * v_approved / v_n));
END;
$$;

-- =============================================================================
-- C. REVISÃO ESPAÇADA DOS ERROS (Leitner 1-3-7-14-30 dias)
--    Entra na fila ao errar; cada acerto sobe uma caixa; acerto na caixa 5 = dominada.
--    Os intervalos são comprimidos para caber antes da prova da trilha da matéria.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.question_review_schedule (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  box smallint NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_on date NOT NULL,
  lapses integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_review_due ON public.question_review_schedule(user_id, due_on);
ALTER TABLE public.question_review_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_review_schedule FROM anon, authenticated;
GRANT SELECT ON public.question_review_schedule TO authenticated;
DROP POLICY IF EXISTS "own review schedule" ON public.question_review_schedule;
CREATE POLICY "own review schedule" ON public.question_review_schedule FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Revisões vencidas respondidas por dia (qualquer caminho: fila, trilha, quiz, simulado).
-- É o que limita o Free a 5 por DIA; sem isso, cada nova chamada da fila trazia mais 5.
CREATE TABLE IF NOT EXISTS public.review_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  reviews_done integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
ALTER TABLE public.review_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_daily_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._review_interval(p_box smallint, p_question_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN d.days_left IS NULL OR d.days_left <= 0 THEN base.i
    -- até a prova: no máximo metade dos dias restantes, para revisar ao menos mais uma vez
    ELSE greatest(1, least(base.i, d.days_left / 2))
  END
  FROM (SELECT (ARRAY[1,3,7,14,30])[p_box] AS i) base,
  LATERAL (
    SELECT min(t.exam_date) - public._today_local() AS days_left
    FROM public.questions q
    JOIN public.study_track_subjects ts ON ts.subject_id = q.subject_id
    JOIN public.study_track_modules m ON m.id = ts.module_id
    JOIN public.study_tracks t ON t.id = m.track_id
    WHERE q.id = p_question_id AND t.exam_date >= public._today_local()) d;
$$;

CREATE OR REPLACE FUNCTION public._schedule_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.question_review_schedule;
BEGIN
  SELECT * INTO v_row FROM public.question_review_schedule
  WHERE user_id = NEW.user_id AND question_id = NEW.question_id;

  -- Respondeu uma revisão vencida (certo ou errado): conta na cota do dia.
  IF v_row.user_id IS NOT NULL AND v_row.due_on <= public._today_local() THEN
    INSERT INTO public.review_daily_usage (user_id, usage_date, reviews_done)
    VALUES (NEW.user_id, public._today_local(), 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET reviews_done = public.review_daily_usage.reviews_done + 1;
  END IF;

  IF NOT NEW.is_correct THEN
    INSERT INTO public.question_review_schedule (user_id, question_id, box, due_on, lapses)
    VALUES (NEW.user_id, NEW.question_id, 1,
            public._today_local() + public._review_interval(1::smallint, NEW.question_id), 1)
    ON CONFLICT (user_id, question_id) DO UPDATE SET box = 1, due_on = EXCLUDED.due_on,
      lapses = public.question_review_schedule.lapses + 1, updated_at = now();
  ELSIF v_row.user_id IS NOT NULL AND v_row.due_on <= public._today_local() THEN
    -- Só promove quando a revisão estava vencida (acertar de novo no mesmo dia não conta).
    IF v_row.box >= 5 THEN
      DELETE FROM public.question_review_schedule
      WHERE user_id = NEW.user_id AND question_id = NEW.question_id;
    ELSE
      UPDATE public.question_review_schedule
      SET box = v_row.box + 1,
          due_on = public._today_local() + public._review_interval((v_row.box + 1)::smallint, NEW.question_id),
          updated_at = now()
      WHERE user_id = NEW.user_id AND question_id = NEW.question_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_review_after_attempt ON public.user_question_attempts;
CREATE TRIGGER schedule_review_after_attempt
  AFTER INSERT ON public.user_question_attempts
  FOR EACH ROW EXECUTE FUNCTION public._schedule_review();

-- Fila de hoje (vencidas primeiro, mais esquecidas primeiro). Free: até 5 por dia.
CREATE OR REPLACE FUNCTION public.get_review_queue(p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plus boolean := public.get_user_tier(auth.uid()) = 'plus';
  v_limit integer;
  v_done integer;
  v_free_daily constant integer := 5;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  SELECT COALESCE(max(reviews_done), 0) INTO v_done FROM public.review_daily_usage
  WHERE user_id = v_uid AND usage_date = public._today_local();
  v_limit := CASE WHEN v_plus THEN least(greatest(p_limit, 1), 100)
                  ELSE greatest(0, least(greatest(p_limit, 1), v_free_daily - v_done)) END;
  RETURN jsonb_build_object(
    'due_total', (SELECT count(*) FROM public.question_review_schedule
                  WHERE user_id = v_uid AND due_on <= public._today_local()),
    'done_today', v_done,
    'limited', NOT v_plus,
    'free_remaining_today', CASE WHEN v_plus THEN NULL ELSE greatest(0, v_free_daily - v_done) END,
    'question_ids', COALESCE((SELECT jsonb_agg(question_id) FROM (
        SELECT r.question_id FROM public.question_review_schedule r
        JOIN public.questions q ON q.id = r.question_id AND q.is_active
        WHERE r.user_id = v_uid AND r.due_on <= public._today_local()
        ORDER BY r.due_on, r.lapses DESC, r.box LIMIT v_limit) x), '[]'::jsonb));
END;
$$;

-- =============================================================================
-- D. PASSE CONCURSO (pagamento único, Plus até 15 dias depois da prova)
--    Chamado só pelo stripe-webhook (service_role) em checkout.session.completed
--    com mode=payment. Idempotente pela sessão do Stripe.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.exam_pass_purchases (
  stripe_checkout_session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.study_tracks(id),
  amount_cents integer,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_pass_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_pass_purchases FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_exam_pass(
  p_user_id uuid, p_track_id uuid, p_session_id text, p_amount_cents integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam date;
  v_name text;
  v_expires timestamptz;
  v_open public.premium_grants;
BEGIN
  IF auth.role() <> 'service_role' THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  IF EXISTS (SELECT 1 FROM public.exam_pass_purchases WHERE stripe_checkout_session_id = p_session_id) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  SELECT exam_date, short_name INTO v_exam, v_name FROM public.study_tracks WHERE id = p_track_id;
  IF v_exam IS NULL THEN RETURN jsonb_build_object('error', 'track_without_exam_date'); END IF;
  v_expires := ((v_exam + 15)::timestamp AT TIME ZONE 'America/Cuiaba');

  INSERT INTO public.exam_pass_purchases VALUES
    (p_session_id, p_user_id, p_track_id, p_amount_cents, v_expires, now());

  -- Não encurta uma liberação maior (ou sem prazo) que o aluno já tenha.
  SELECT * INTO v_open FROM public.premium_grants WHERE user_id = p_user_id AND revoked_at IS NULL;
  IF v_open.id IS NULL OR (v_open.expires_at IS NOT NULL AND v_open.expires_at < v_expires) THEN
    UPDATE public.premium_grants SET revoked_at = now(), revoke_reason = 'Substituída pelo Passe Concurso'
    WHERE user_id = p_user_id AND revoked_at IS NULL;
    INSERT INTO public.premium_grants (user_id, reason, expires_at)
    VALUES (p_user_id, 'Passe Concurso: ' || v_name, v_expires);
  END IF;

  PERFORM public._refresh_profile_tier(p_user_id);
  RETURN jsonb_build_object('success', true, 'expires_at', v_expires);
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION public.start_mock_exam(uuid, text), public.get_mock_exam(uuid),
  public.save_mock_answer(uuid, uuid, integer), public.finish_mock_exam(uuid),
  public.get_mock_exam_standing(uuid), public.get_review_queue(integer),
  public.grant_exam_pass(uuid, uuid, text, integer),
  public._review_interval(smallint, uuid), public._schedule_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_mock_exam(uuid, text), public.get_mock_exam(uuid),
  public.save_mock_answer(uuid, uuid, integer), public.finish_mock_exam(uuid),
  public.get_mock_exam_standing(uuid), public.get_review_queue(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_exam_pass(uuid, uuid, text, integer) TO service_role;
