-- =============================================================================
-- Segredo do agendador da geracao de questoes, criado e guardado no Vault.
--
-- O valor e gerado aqui mesmo (32 bytes aleatorios) e nunca sai do banco:
--   * o pg_cron (migration 20261110130200) o envia no cabecalho x-cron-secret;
--   * a Edge Function generate-track-questions, quando a variavel
--     QUESTION_CRON_SECRET nao existe, o le pela RPC abaixo (so service_role).
-- Assim ninguem precisa copiar o segredo para o painel de Secrets.
--
-- Continua necessario, uma vez por projeto, cadastrar o endereco do projeto:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'question_cron_secret') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'question_cron_secret',
      'Segredo do pg_cron para a Edge Function generate-track-questions'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_question_cron_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'question_cron_secret'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_question_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_question_cron_secret() TO service_role;
