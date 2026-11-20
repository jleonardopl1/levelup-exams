// Postgres em memória (PGlite) com stubs mínimos do Supabase (auth, vault, cron, net) e
// todas as migrations de supabase/migrations aplicadas em ordem. Usado pelos testes de banco:
//   docs/proposta-plus/validate.mjs e supabase/tests/mercadopago.validate.mjs
// Requer: npm i --no-save @electric-sql/pglite@0.5.16
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const STUBS = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA vault; CREATE SCHEMA cron; CREATE SCHEMA net;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb, raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz,
  banned_until timestamptz, deleted_at timestamptz);
CREATE TABLE auth.identities (id uuid DEFAULT gen_random_uuid(), user_id uuid, provider text, identity_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION extensions.gen_random_bytes(int) RETURNS bytea LANGUAGE sql AS $$ SELECT public.gen_random_bytes($1) $$;
CREATE TABLE vault.secrets (id uuid DEFAULT gen_random_uuid(), name text UNIQUE, secret text, description text);
CREATE VIEW vault.decrypted_secrets AS SELECT id, name, secret AS decrypted_secret, description FROM vault.secrets;
CREATE FUNCTION vault.create_secret(s text, n text DEFAULT NULL, d text DEFAULT NULL) RETURNS uuid LANGUAGE sql AS
  $$ INSERT INTO vault.secrets(name, secret, description) VALUES (n, s, d) RETURNING id $$;
CREATE FUNCTION vault.update_secret(i uuid, s text DEFAULT NULL, n text DEFAULT NULL, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE TABLE cron.job (jobid bigserial, jobname text, schedule text, command text);
CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job(jobname, schedule, command) VALUES (n, s, c) RETURNING jobid $$;
CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.job WHERE jobname = n RETURNING true $$;
CREATE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}', params jsonb DEFAULT '{}', headers jsonb DEFAULT '{}', timeout_milliseconds int DEFAULT 5000) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
`;

export const cleanMigration = (sql) => sql
  .replace(/CREATE EXTENSION IF NOT EXISTS pg_(cron|net)[^;]*;/gi, '')
  .replace(/GRANT USAGE ON SCHEMA cron[^;]*;/gi, '');

/**
 * Sobe o banco e aplica as migrations. `onBeforeMigration(arquivo, db)` roda antes de cada
 * arquivo (ex.: guardar o corpo de uma função antes de ela ser redefinida).
 */
export async function bootSupabaseDb({ onBeforeMigration } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(STUBS);
  const migDir = path.join(repoRoot, 'supabase/migrations');
  const failures = [];
  for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
    if (onBeforeMigration) await onBeforeMigration(f, db);
    try { await db.exec(cleanMigration(fs.readFileSync(path.join(migDir, f), 'utf8'))); }
    catch (e) { failures.push(`${f}: ${e.message}`); }
  }
  return { db, failures };
}

/** Atalhos: trocar de usuário/papel no JWT simulado, ler uma linha e chamar uma RPC. */
export function sqlHelpers(db) {
  const as = async (uid, role = 'authenticated') => {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role]);
  };
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const rpc = async (sql, params = []) => Object.values(await one(sql, params))[0];
  return { as, one, rpc };
}
