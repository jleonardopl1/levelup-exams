-- =============================================================================
-- TRILHAS DE ESTUDO POR CONCURSO
--
-- Uma trilha (study_tracks) representa um concurso especifico (ex.: Camara
-- Municipal de Cuiaba 2026). Ela tem modulos (nivel medio / nivel superior) e
-- cada modulo lista as materias do edital (study_track_subjects), apontando para
-- a tabela `subjects` ja existente. As questoes continuam em `questions`.
--
-- Tambem cria o registro de tentativas por questao (user_question_attempts),
-- gravado SOMENTE pelo servidor dentro de validate_answer, que alimenta:
--   * selecao inteligente de questoes (ineditas primeiro, depois erros);
--   * modo "Revisar erros" (repeticao das questoes erradas);
--   * progresso por materia na trilha.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Metadados das questoes
-- -----------------------------------------------------------------------------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS topico text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'autoral',
  ADD COLUMN IF NOT EXISTS nivel text,
  ADD COLUMN IF NOT EXISTS content_hash text;

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_origem_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_origem_check
  CHECK (origem IN ('autoral', 'ia_diaria', 'adaptada'));

-- nivel NULL = serve para os dois niveis.
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_nivel_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_nivel_check
  CHECK (nivel IS NULL OR nivel IN ('medio', 'superior'));

-- Deduplicacao (seed idempotente e geracao diaria sem repetir enunciado).
-- Indice unico NAO parcial (NULLs continuam permitidos) para que o upsert do
-- PostgREST (on_conflict=content_hash) consiga inferir o indice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_content_hash
  ON public.questions (content_hash);
CREATE INDEX IF NOT EXISTS idx_questions_subject_created
  ON public.questions (subject_id, created_at DESC);

GRANT SELECT (topico, origem, nivel) ON public.questions TO anon, authenticated;

DROP VIEW IF EXISTS public.questions_public;
CREATE VIEW public.questions_public
WITH (security_invoker = on, security_barrier = true) AS
SELECT q.id, q.enunciado, q.alternativas, q.categoria, q.dificuldade,
       q.created_at, q.subject_id, q.is_premium, q.topico, q.origem, q.nivel
FROM public.questions q;

REVOKE ALL ON public.questions_public FROM anon, authenticated;
GRANT SELECT ON public.questions_public TO anon, authenticated;

-- Slug estavel para materias (permite seeds idempotentes).
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_slug ON public.subjects (slug) WHERE slug IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Trilhas, modulos e materias da trilha
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL,
  organ text NOT NULL,
  banca text NOT NULL,
  exam_date date,
  edital_url text,
  description text,
  -- Regras gerais (aprovacao, discursiva etc.) exibidas na tela da trilha.
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_track_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.study_tracks(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  nivel text NOT NULL CHECK (nivel IN ('medio', 'superior')),
  description text,
  cargos text[] NOT NULL DEFAULT '{}',
  -- Quadro da prova objetiva: [{area, questoes, pontos_por_questao, disciplinas[]}]
  structure jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  UNIQUE (track_id, slug)
);

CREATE TABLE IF NOT EXISTS public.study_track_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.study_track_modules(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  area text NOT NULL,
  -- NULL = materia comum a todos os cargos do modulo; preenchido = especifica do cargo.
  cargo text,
  syllabus text,
  study_tips text,
  weekly_target integer NOT NULL DEFAULT 15 CHECK (weekly_target BETWEEN 0 AND 200),
  -- true = a geracao automatica so pode usar fatos ja verificados (explicacoes das
  -- questoes autorais), sem conhecimento livre do modelo. Usado para legislacao local.
  ai_grounded_only boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  UNIQUE (module_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_track_modules_track ON public.study_track_modules (track_id);
CREATE INDEX IF NOT EXISTS idx_track_subjects_module ON public.study_track_subjects (module_id);
CREATE INDEX IF NOT EXISTS idx_track_subjects_subject ON public.study_track_subjects (subject_id);

ALTER TABLE public.study_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_track_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_track_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Study tracks are public" ON public.study_tracks;
CREATE POLICY "Study tracks are public" ON public.study_tracks
  FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "Track modules are public" ON public.study_track_modules;
CREATE POLICY "Track modules are public" ON public.study_track_modules
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.study_tracks t WHERE t.id = track_id AND t.is_active));

DROP POLICY IF EXISTS "Track subjects are public" ON public.study_track_subjects;
CREATE POLICY "Track subjects are public" ON public.study_track_subjects
  FOR SELECT TO anon, authenticated USING (true);

-- Conteudo editorial: escrita apenas por service_role (migrations / funcoes).
REVOKE ALL ON public.study_tracks, public.study_track_modules, public.study_track_subjects FROM anon, authenticated;
GRANT SELECT ON public.study_tracks, public.study_track_modules, public.study_track_subjects TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Tentativas por questao (gravadas pelo servidor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_question_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_index integer NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_question
  ON public.user_question_attempts (user_id, question_id, created_at DESC);

ALTER TABLE public.user_question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own attempts" ON public.user_question_attempts;
CREATE POLICY "Users read own attempts" ON public.user_question_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Sem INSERT/UPDATE/DELETE para clientes: so validate_answer (SECURITY DEFINER) grava.
REVOKE ALL ON public.user_question_attempts FROM anon, authenticated;
GRANT SELECT ON public.user_question_attempts TO authenticated;

-- validate_answer: mesmo contrato da versao endurecida (20261110120000), agora
-- registrando a tentativa.
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

-- -----------------------------------------------------------------------------
-- 4. Selecao de questoes para pratica
--    SECURITY INVOKER: a RLS de `questions` (paywall) e de `user_question_attempts`
--    (somente as proprias tentativas) continua valendo.
--
--    p_mode:
--      smart  -> ineditas primeiro, depois as erradas, depois as demais (aleatorio)
--      review -> apenas questoes cuja ULTIMA resposta do usuario foi errada
--      new    -> apenas questoes nunca respondidas
--      weekly -> questoes novas da geracao automatica publicadas nos ultimos 7 dias
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_practice_questions(
  p_subject_id uuid,
  p_nivel text DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_mode text DEFAULT 'smart'
)
RETURNS TABLE (
  id uuid, enunciado text, alternativas text[], categoria text, dificuldade text,
  created_at timestamptz, subject_id uuid, is_premium boolean,
  topico text, origem text, nivel text
)
LANGUAGE sql
STABLE
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
  WHERE q.subject_id = p_subject_id
    AND (p_nivel IS NULL OR q.nivel IS NULL OR q.nivel = p_nivel)
    AND CASE coalesce(p_mode, 'smart')
          WHEN 'review' THEN la.is_correct = false
          WHEN 'new'    THEN la.question_id IS NULL
          WHEN 'weekly' THEN q.origem = 'ia_diaria' AND q.created_at >= now() - interval '7 days'
          ELSE true
        END
  ORDER BY
    CASE WHEN la.question_id IS NULL THEN 0
         WHEN la.is_correct = false THEN 1
         ELSE 2 END,
    random()
  LIMIT greatest(1, least(coalesce(p_limit, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.get_practice_questions(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid, text, integer, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Progresso do usuario em uma trilha/modulo
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_track_progress(p_module_id uuid)
RETURNS TABLE (
  subject_id uuid,
  total_questions integer,
  new_this_week integer,
  answered integer,
  correct_latest integer,
  wrong_latest integer,
  attempts_7d integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH m AS (
    SELECT id, nivel FROM public.study_track_modules WHERE id = p_module_id
  ),
  subj AS (
    SELECT ts.subject_id, m.nivel
    FROM public.study_track_subjects ts JOIN m ON m.id = ts.module_id
  ),
  qs AS (
    SELECT q.id, q.subject_id, q.created_at, q.origem
    FROM public.questions_public q JOIN subj s ON s.subject_id = q.subject_id
    WHERE q.nivel IS NULL OR q.nivel = s.nivel
  ),
  att AS (
    SELECT a.question_id, a.is_correct, a.created_at
    FROM public.user_question_attempts a
    WHERE a.user_id = auth.uid() AND a.question_id IN (SELECT id FROM qs)
  ),
  last_att AS (
    SELECT DISTINCT ON (question_id) question_id, is_correct
    FROM att ORDER BY question_id, created_at DESC
  )
  SELECT s.subject_id,
         (SELECT count(*) FROM qs WHERE qs.subject_id = s.subject_id)::int,
         (SELECT count(*) FROM qs WHERE qs.subject_id = s.subject_id AND qs.origem = 'ia_diaria'
            AND qs.created_at >= now() - interval '7 days')::int,
         (SELECT count(*) FROM last_att la JOIN qs ON qs.id = la.question_id
            WHERE qs.subject_id = s.subject_id)::int,
         (SELECT count(*) FROM last_att la JOIN qs ON qs.id = la.question_id
            WHERE qs.subject_id = s.subject_id AND la.is_correct)::int,
         (SELECT count(*) FROM last_att la JOIN qs ON qs.id = la.question_id
            WHERE qs.subject_id = s.subject_id AND NOT la.is_correct)::int,
         (SELECT count(*) FROM att JOIN qs ON qs.id = att.question_id
            WHERE qs.subject_id = s.subject_id AND att.created_at >= now() - interval '7 days')::int
  FROM subj s;
$$;

REVOKE ALL ON FUNCTION public.get_track_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_track_progress(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Log da geracao automatica de questoes (Edge Function generate-track-questions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_generation_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Cuiaba')::date),
  requested integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error', 'skipped')),
  model text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_runs_subject_date
  ON public.question_generation_runs (subject_id, run_date DESC);

ALTER TABLE public.question_generation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read generation runs" ON public.question_generation_runs;
CREATE POLICY "Admins read generation runs" ON public.question_generation_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.question_generation_runs FROM anon, authenticated;
GRANT SELECT ON public.question_generation_runs TO authenticated;
