-- =============================================================================
-- Camada de IA: telemetria das chamadas (ai_runs) e memória de lições por matéria
-- (ai_lessons). Ver docs/ARQUITETURA_MULTIAGENTE.md §5.2 e §5.3.
--
-- - ai_runs: uma linha por chamada de modelo (agente, modelo, versão do prompt,
--   tentativas, latência, tokens) e uma linha de resumo por fluxo (agent =
--   'orquestrador'). NUNCA guarda prompt nem resposta (LGPD). Retenção: 90 dias.
-- - ai_lessons: motivos de reprovação (revisor, árbitro, portão determinístico)
--   normalizados e contados por recorrência; voltam ao prompt do elaborador.
--   Memória auditável: a equipe pode desativar uma lição (is_active = false).
--
-- As Edge Functions toleram esta migration ainda não aplicada (telemetria e lições
-- são "best effort"), então a ordem de publicação função/migration não quebra nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ai_runs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL CHECK (char_length(function_name) <= 60),
  agent text NOT NULL CHECK (char_length(agent) <= 60),
  model text CHECK (char_length(model) <= 120),
  prompt_version text CHECK (char_length(prompt_version) <= 80),
  status text NOT NULL CHECK (status IN ('ok', 'error')),
  attempts smallint NOT NULL DEFAULT 1 CHECK (attempts >= 0),
  latency_ms integer CHECK (latency_ms >= 0),
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  error text CHECK (char_length(error) <= 300),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON public.ai_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_function_created ON public.ai_runs (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_subject ON public.ai_runs (subject_id) WHERE subject_id IS NOT NULL;

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_runs FROM anon, authenticated;
GRANT SELECT ON public.ai_runs TO authenticated;

DROP POLICY IF EXISTS "Admins read ai runs" ON public.ai_runs;
-- (select auth.uid()) é avaliado uma vez por consulta (lint auth_rls_initplan).
CREATE POLICY "Admins read ai runs" ON public.ai_runs
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

-- -----------------------------------------------------------------------------
-- 2. ai_lessons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_lessons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('revisor', 'solucionador', 'arbitro', 'validador', 'aluno', 'equipe')),
  lesson text NOT NULL CHECK (char_length(lesson) BETWEEN 3 AND 300),
  lesson_hash text NOT NULL,
  hits integer NOT NULL DEFAULT 1 CHECK (hits >= 1),
  is_active boolean NOT NULL DEFAULT true,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, source, lesson_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_lessons_subject_rank
  ON public.ai_lessons (subject_id, hits DESC, last_seen DESC) WHERE is_active;

ALTER TABLE public.ai_lessons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_lessons FROM anon, authenticated;
GRANT SELECT ON public.ai_lessons TO authenticated;
GRANT UPDATE (is_active) ON public.ai_lessons TO authenticated;

DROP POLICY IF EXISTS "Admins read ai lessons" ON public.ai_lessons;
CREATE POLICY "Admins read ai lessons" ON public.ai_lessons
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins curate ai lessons" ON public.ai_lessons;
CREATE POLICY "Admins curate ai lessons" ON public.ai_lessons
  FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Gravação atômica: insere ou incrementa a recorrência. Só o service_role (Edge Functions).
CREATE OR REPLACE FUNCTION public.record_ai_lessons(p_subject_id uuid, p_source text, p_lessons text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson text;
  v_count integer := 0;
BEGIN
  IF p_subject_id IS NULL OR p_lessons IS NULL THEN
    RETURN 0;
  END IF;
  IF p_source NOT IN ('revisor', 'solucionador', 'arbitro', 'validador', 'aluno', 'equipe') THEN
    RAISE EXCEPTION 'origem de lição inválida';
  END IF;

  FOREACH v_lesson IN ARRAY p_lessons[1:20] LOOP
    v_lesson := left(btrim(regexp_replace(coalesce(v_lesson, ''), '\s+', ' ', 'g')), 300);
    CONTINUE WHEN char_length(v_lesson) < 3;
    INSERT INTO public.ai_lessons AS l (subject_id, source, lesson, lesson_hash)
    VALUES (p_subject_id, p_source, v_lesson, md5(lower(v_lesson)))
    ON CONFLICT (subject_id, source, lesson_hash)
    DO UPDATE SET hits = l.hits + 1, last_seen = now();
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_lessons(uuid, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_lessons(uuid, text, text[]) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Retenção da telemetria (90 dias) — diária, às 03h17 UTC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_ai_runs()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (DELETE FROM public.ai_runs WHERE created_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*)::integer FROM d;
$$;

REVOKE ALL ON FUNCTION public.purge_old_ai_runs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_ai_runs() TO service_role;

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponivel: limpeza da telemetria de IA NAO agendada.';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-ai-runs';
  PERFORM cron.schedule('purge-ai-runs', '17 3 * * *', 'SELECT public.purge_old_ai_runs()');
END
$outer$;
