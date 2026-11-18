# SQL, RLS e RPC (supabase/migrations) — regras de stack

## Migrations
- Nome `AAAAMMDDHHMMSS_descricao.sql`, sempre depois da última; cabeçalho explicando o porquê.
- Idempotentes: `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `cron.unschedule`
  antes de `cron.schedule`, extensão opcional dentro de bloco `DO` com `RAISE NOTICE`.
- Tolerantes à ordem de publicação com as Edge Functions (ou ordem documentada no PR).
- Testadas 2× em Postgres descartável antes de propor aplicação no remoto (só com o dono).

## Tabelas
- RLS ligada; `REVOKE ALL ... FROM anon, authenticated` e `GRANT` mínimo (por coluna quando houver dado sensível).
- `CHECK` para enums e tamanhos; FKs com `ON DELETE` pensado; `created_at timestamptz default now()`.
- Políticas com `(SELECT auth.uid())` (avaliado uma vez por consulta) e sem duplicar permissivas.
- Tabela que cresce sem parar nasce com retenção (job pg_cron).

## Funções
- `SECURITY DEFINER` + `SET search_path = public`; revalide o chamador (`auth.uid()`, `has_role`,
  `_access_level`) — nunca confie em parâmetro de usuário.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon` (e `authenticated` quando for só do servidor);
  `GRANT EXECUTE` explícito.
- Operações que mexem em pontos, cotas, dinheiro ou papéis são **atômicas** (uma RPC, sem corrida)
  e registram em `audit_logs` quando administrativas.
