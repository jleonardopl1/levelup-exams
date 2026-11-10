-- =============================================================================
-- Agendamento da geracao automatica de questoes das trilhas.
--
-- A Edge Function generate-track-questions publica ate QUESTIONS_PER_SUBJECT_DAY
-- (padrao 3) questoes novas por materia por dia (21/semana >= 15/semana exigidas).
-- Cada chamada processa ate 3 materias; o job roda a cada 10 minutos entre
-- 01h e 04h50 (horario de Cuiaba = 05h-08h50 UTC), o que cobre as 19 materias
-- com folga para novas tentativas em caso de falha.
--
-- Pre-requisitos (uma unica vez, fora do repositorio, no SQL Editor do Supabase):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<mesmo valor de QUESTION_CRON_SECRET>', 'question_cron_secret');
-- e o secret QUESTION_CRON_SECRET (>= 32 caracteres) nas Edge Functions.
-- Ver docs/TRILHAS.md.
-- =============================================================================

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    RAISE NOTICE 'pg_cron/pg_net indisponiveis: agendamento da geracao de questoes NAO criado.';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'generate-track-questions';

  PERFORM cron.schedule(
    'generate-track-questions',
    '*/10 5-8 * * *',
    $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/generate-track-questions',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'question_cron_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000
      )
      WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'question_cron_secret');
    $job$
  );
END
$outer$;
