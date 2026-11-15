// Valida a proposta SQL contra o schema real.
//   1. sobe um Postgres em memória (PGlite) com stubs mínimos do Supabase (auth, vault, cron, net);
//   2. aplica TODAS as migrations de supabase/migrations (inclui o seed de 1.091 questões da
//      trilha e 20261115120000_plus_features_v1.sql);
//   3. roda testes de fumaça com asserções sobre as funcionalidades Plus.
//
// Uso (na raiz do repo):
//   npm i --no-save @electric-sql/pglite@0.5.16
//   node docs/proposta-plus/validate.mjs
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const db = new PGlite({ extensions: { pgcrypto } });

const STUBS = `
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
const clean = (sql) => sql
  .replace(/CREATE EXTENSION IF NOT EXISTS pg_(cron|net)[^;]*;/gi, '')
  .replace(/GRANT USAGE ON SCHEMA cron[^;]*;/gi, '');

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const as = async (uid, role = 'authenticated') => {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role]);
};
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const rpc = async (sql, params = []) => Object.values(await one(sql, params))[0];

await db.exec(STUBS);
const migDir = path.join(repo, 'supabase/migrations');
const PLUS_MIGRATION = '20261115120000_plus_features_v1.sql';
const fnSrc = async (name) => (await one(`SELECT prosrc FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace`, [name])).prosrc;
let validateAnswerBefore = null;
for (const f of fs.readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
  if (f === PLUS_MIGRATION) validateAnswerBefore = await fnSrc('validate_answer');
  try { await db.exec(clean(fs.readFileSync(path.join(migDir, f), 'utf8'))); }
  catch (e) { failures++; console.log(`FAIL  migration ${f}: ${e.message}`); }
}
// A migration Plus redefine validate_answer: o corpo novo tem que ser o anterior + só a trava nova.
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const validateAnswerAfter = await fnSrc('validate_answer');
const withoutNewBlock = validateAnswerAfter.replace(/\n\s*-- NOVO:[\s\S]*?END IF;\n/, '\n');
check(validateAnswerAfter !== validateAnswerBefore && norm(withoutNewBlock) === norm(validateAnswerBefore),
  'validate_answer = versão anterior + apenas a trava do simulado aberto');
console.log('todas as migrations aplicadas (inclui Plus v1)');

// ---------- Fixtures ----------
const mkUser = async (email) => (await one(`INSERT INTO auth.users(email) VALUES ($1) RETURNING id`, [email])).id;
const free = await mkUser('free@test.local');
const plus = await mkUser('plus@test.local');
const medio = await one(`SELECT m.id, m.track_id, t.exam_date FROM study_track_modules m JOIN study_tracks t ON t.id = m.track_id WHERE m.slug = 'nivel-medio'`);
const cargo = 'Técnico Legislativo';

// ---------- A. Simulado Oficial ----------
await as(free);
let t0 = Date.now();
const started = await rpc(`SELECT start_mock_exam($1, $2)`, [medio.id, cargo]);
const startMs = Date.now() - t0;
check(!!started.exam_id && started.resumed === false, `start_mock_exam cria simulado (${startMs} ms)`);
const exam = started.exam_id;

const items = (await db.query(`SELECT * FROM get_mock_exam($1)`, [exam])).rows;
check(items.length === 70, `70 questões no formato do edital (veio ${items.length})`);
const byArea = Object.fromEntries((await db.query(
  `SELECT area, count(*)::int n, count(DISTINCT question_id)::int d FROM mock_exam_items WHERE exam_id=$1 GROUP BY area`, [exam])).rows
  .map((r) => [r.area, r]));
check(byArea['Conhecimentos Básicos']?.n === 15 && byArea['Conhecimentos Gerais']?.n === 15 && byArea['Conhecimentos Específicos']?.n === 40,
  'distribuição por área 15/15/40');
check(Object.keys(items[0]).every((k) => !['correta', 'correct_index', 'explicacao'].includes(k)), 'get_mock_exam não expõe gabarito');
const spread = (await db.query(
  `SELECT s.name, count(*)::int n FROM mock_exam_items i JOIN questions q ON q.id=i.question_id JOIN subjects s ON s.id=q.subject_id
   WHERE i.exam_id=$1 AND i.area='Conhecimentos Básicos' GROUP BY s.name ORDER BY n DESC`, [exam])).rows;
check(spread.length === 4 && spread[0].n - spread.at(-1).n <= 1, `Básicos distribuídos entre as matérias: ${spread.map((r) => `${r.name}=${r.n}`).join(', ')}`);

// Outro aluno não enxerga o simulado.
await as(plus);
check((await db.query(`SELECT * FROM get_mock_exam($1)`, [exam])).rows.length === 0, 'outro aluno não lê o simulado alheio');
check((await rpc(`SELECT save_mock_answer($1, $2, 0)`, [exam, items[0].question_id])).error === 'not_found', 'outro aluno não responde o simulado alheio');

// Responde: acerta todas as Específicas e as Gerais, erra todas as Básicas -> deve reprovar por zerar área.
await as(free);
const key = Object.fromEntries((await db.query(`SELECT i.question_id, q.correta, i.area FROM mock_exam_items i JOIN questions q ON q.id=i.question_id WHERE exam_id=$1`, [exam])).rows
  .map((r) => [r.question_id, r]));
for (const it of items) {
  const k = key[it.question_id];
  const ans = k.area === 'Conhecimentos Básicos' ? (k.correta + 1) % 4 : k.correta;
  await rpc(`SELECT save_mock_answer($1, $2, $3)`, [exam, it.question_id, ans]);
}
const res = await rpc(`SELECT finish_mock_exam($1)`, [exam]);
check(Number(res.score) === 85, `nota ponderada: 15×1 + 40×1,75 = 85 (veio ${res.score})`);
check(res.approved === false, 'reprovado por zerar Conhecimentos Básicos (regra do edital)');
check(res.items.length === 70 && res.items.every((i) => i.correct_index !== undefined), 'resultado traz gabarito + explicação só depois de finalizar');
const res2 = await rpc(`SELECT finish_mock_exam($1)`, [exam]);
check(res2.score === res.score, 'finalizar de novo é idempotente');
check((await rpc(`SELECT save_mock_answer($1, $2, 1)`, [exam, items[0].question_id])).error === 'finished', 'não aceita resposta depois de finalizar');
const attempts = (await one(`SELECT count(*)::int n FROM user_question_attempts WHERE user_id=$1`, [free])).n;
check(attempts === 70, `respostas alimentam o progresso da trilha (${attempts} tentativas)`);

const quota = await rpc(`SELECT start_mock_exam($1, $2)`, [medio.id, cargo]);
check(quota.error === 'free_quota', 'Free: segundo simulado no mês é bloqueado');

// ---------- D. Passe Concurso ----------
await as(null, 'authenticated');
check((await rpc(`SELECT grant_exam_pass($1, $2, 'cs_test_1', 4990)`, [plus, medio.track_id])).error === 'forbidden', 'grant_exam_pass recusa chamada de cliente');
await as(null, 'service_role');
const pass = await rpc(`SELECT grant_exam_pass($1, $2, 'cs_test_1', 4990)`, [plus, medio.track_id]);
check(pass.success === true, `Passe Concurso concede Plus até ${pass.expires_at}`);
check((await rpc(`SELECT grant_exam_pass($1, $2, 'cs_test_1', 4990)`, [plus, medio.track_id])).duplicate === true, 'webhook repetido não duplica (idempotente)');
check((await one(`SELECT tier FROM profiles WHERE user_id=$1`, [plus])).tier === 'plus', 'perfil vira Plus (profiles.tier)');
await as(plus);
const access = await rpc(`SELECT get_premium_access()`);
check(access.source === 'grant' && access.grant_kind === 'exam_pass' && !!access.access_until, 'get_premium_access identifica o Passe Concurso');
await as(null, 'service_role');
await as(plus);
const p1 = await rpc(`SELECT start_mock_exam($1, $2)`, [medio.id, cargo]);
await rpc(`SELECT finish_mock_exam($1)`, [p1.exam_id]);
const p2 = await rpc(`SELECT start_mock_exam($1, $2)`, [medio.id, cargo]);
check(!!p2.exam_id && !p2.error, 'Plus: simulados ilimitados');
const overlap = (await one(`SELECT count(*)::int n FROM mock_exam_items a JOIN mock_exam_items b ON a.question_id=b.question_id WHERE a.exam_id=$1 AND b.exam_id=$2`, [p1.exam_id, p2.exam_id])).n;
console.log(`INFO  questões repetidas entre o 1º e o 2º simulado do mesmo aluno: ${overlap}/70 (segundo prioriza erradas; sem resposta = errada)`);
await rpc(`SELECT finish_mock_exam($1)`, [p2.exam_id]);

// Gabarito não vaza por validate_answer enquanto o simulado está aberto.
const p3 = await rpc(`SELECT start_mock_exam($1, $2)`, [medio.id, cargo]);
const p3q = (await db.query(`SELECT question_id FROM get_mock_exam($1) LIMIT 1`, [p3.exam_id])).rows[0].question_id;
const attemptsBefore = (await one(`SELECT count(*)::int n FROM user_question_attempts WHERE user_id=$1 AND question_id=$2`, [plus, p3q])).n;
const leak = await rpc(`SELECT validate_answer($1, 0)`, [p3q]);
check(leak.error && leak.correct_index === undefined && leak.explicacao === undefined,
  `validate_answer recusa questão do simulado aberto (${leak.error})`);
check((await one(`SELECT count(*)::int n FROM user_question_attempts WHERE user_id=$1 AND question_id=$2`, [plus, p3q])).n === attemptsBefore,
  'a consulta recusada não vira tentativa');
await rpc(`SELECT finish_mock_exam($1)`, [p3.exam_id]);
check((await rpc(`SELECT validate_answer($1, 0)`, [p3q])).correct_index !== undefined, 'depois de finalizar, validate_answer volta a corrigir');

// Salvar e finalizar usam o mesmo lock. O PGlite tem uma conexão só, então a corrida em si
// não é reproduzível aqui: verificamos que a trava existe nas duas funções.
const saveSrc = await fnSrc('save_mock_answer');
const finishSrc = await fnSrc('finish_mock_exam');
check(/FROM public\.mock_exams[^;]*FOR UPDATE/.test(saveSrc) && /FROM public\.mock_exams[\s\S]*?FOR UPDATE/.test(finishSrc),
  'save_mock_answer e finish_mock_exam travam a mesma linha (FOR UPDATE) — corrida real só testável em Postgres com 2 conexões');

// ---------- C. Revisão espaçada ----------
await as(free);
const sched = await one(`SELECT count(*)::int n, min(due_on - _today_local())::int d FROM question_review_schedule WHERE user_id=$1`, [free]);
check(sched.n === 15 && sched.d === 1, `15 erros entram na fila para amanhã (n=${sched.n}, +${sched.d}d)`);
let q = await rpc(`SELECT get_review_queue(20)`);
check(q.due_total === 0, 'nada vence hoje');
await db.query(`UPDATE question_review_schedule SET due_on = _today_local() WHERE user_id=$1`, [free]);
q = await rpc(`SELECT get_review_queue(20)`);
check(q.due_total === 15 && q.question_ids.length === 5 && q.limited === true, 'Free vê 15 vencidas mas pratica 5 por dia');
const qid = q.question_ids[0];
const right = (await one(`SELECT correta FROM questions WHERE id=$1`, [qid])).correta;
await rpc(`SELECT validate_answer($1, $2)`, [qid, right]);
let row = await one(`SELECT box, (due_on - _today_local())::int d FROM question_review_schedule WHERE user_id=$1 AND question_id=$2`, [free, qid]);
check(row.box === 2 && row.d === 3, `acerto na revisão sobe para a caixa 2, volta em 3 dias (box=${row.box}, +${row.d}d)`);
await rpc(`SELECT validate_answer($1, $2)`, [qid, right]);
row = await one(`SELECT box FROM question_review_schedule WHERE user_id=$1 AND question_id=$2`, [free, qid]);
check(row.box === 2, 'acertar de novo antes de vencer não promove');
// Compressão perto da prova: prova daqui a 4 dias -> caixa 3 (7d) vira 2d.
await db.query(`UPDATE study_tracks SET exam_date = _today_local() + 4 WHERE id=$1`, [medio.track_id]);
await db.query(`UPDATE question_review_schedule SET due_on=_today_local() WHERE user_id=$1 AND question_id=$2`, [free, qid]);
await rpc(`SELECT validate_answer($1, $2)`, [qid, right]);
row = await one(`SELECT box, (due_on - _today_local())::int d FROM question_review_schedule WHERE user_id=$1 AND question_id=$2`, [free, qid]);
check(row.box === 3 && row.d === 2, `perto da prova o intervalo encolhe: caixa 3 em ${row.d}d (seria 7d)`);
await db.query(`UPDATE study_tracks SET exam_date = $2 WHERE id=$1`, [medio.track_id, medio.exam_date]);
await rpc(`SELECT validate_answer($1, $2)`, [qid, (right + 1) % 4]);
row = await one(`SELECT box, lapses FROM question_review_schedule WHERE user_id=$1 AND question_id=$2`, [free, qid]);
check(row.box === 1 && row.lapses === 2, 'errar de novo volta para a caixa 1 e conta o lapso');

// O limite Free é por DIA: até aqui o aluno respondeu 2 revisões vencidas.
q = await rpc(`SELECT get_review_queue(20)`);
check(q.done_today === 2 && q.question_ids.length === 3 && q.free_remaining_today === 3,
  `Free: depois de 2 revisões, restam 3 hoje (veio ${q.question_ids.length})`);
for (const id of q.question_ids) {
  const c = (await one(`SELECT correta FROM questions WHERE id=$1`, [id])).correta;
  await rpc(`SELECT validate_answer($1, $2)`, [id, c]);
}
q = await rpc(`SELECT get_review_queue(20)`);
check(q.question_ids.length === 0 && q.free_remaining_today === 0 && q.due_total > 0,
  `Free: pedir de novo no mesmo dia não traz mais (vencidas ainda: ${q.due_total})`);
await as(plus);
const qp = await rpc(`SELECT get_review_queue(20)`);
check(qp.limited === false && qp.free_remaining_today === null, 'Plus: fila sem limite diário');
await as(free);

// ---------- B. Posição entre candidatos ----------
await as(free);
check((await rpc(`SELECT get_mock_exam_standing($1)`, [exam])).enough_data === false, 'com poucos alunos não mostra posição');
await as(null, 'service_role');
// 25 candidatos com notas 30, 32,5 ... 90: dois acima de 85 -> o aluno fica em 3º.
for (let i = 0; i < 25; i++) {
  const u = await mkUser(`c${i}@test.local`);
  await db.query(`INSERT INTO mock_exams(user_id, module_id, cargo, deadline, finished_at, score, approved, total_questions)
                  VALUES ($1,$2,$3, now(), now(), $4, $5, 70)`, [u, medio.id, cargo, 30 + i * 2.5, 30 + i * 2.5 >= 40]);
}
await as(free);
const stFree = await rpc(`SELECT get_mock_exam_standing($1)`, [exam]);
check(stFree.enough_data && stFree.detail === false && stFree.above_median === true && stFree.position === undefined,
  'Free: só vê se está na metade de cima (sem posição)');
// O mesmo simulado visto como Plus: o aluno ganha um Passe e passa a ver a posição.
await as(null, 'service_role');
await rpc(`SELECT grant_exam_pass($1, $2, 'cs_test_free_upgrade', 4990)`, [free, medio.track_id]);
await as(free);
const st = await rpc(`SELECT get_mock_exam_standing($1)`, [exam]);
check(st.enough_data && st.detail === true && st.candidates === 27 && st.position === 3, `Plus: posição entre candidatos ${st.position}º de ${st.candidates} (percentil ${st.percentile})`);

// ---------- Discursiva: cota semanal ----------
const longText = 'A transparência na administração pública municipal exige publicidade ativa dos atos. '.repeat(5);
await as(null, 'authenticated');
let forbidden = false;
try { await rpc(`SELECT begin_essay_submission($1,$2,$3,'Tema de teste da discursiva',$4,25)`, [plus, medio.id, cargo, longText]); }
catch { forbidden = true; }
check(forbidden, 'begin_essay_submission recusa chamada de cliente');
await as(null, 'service_role');
const ids = [];
for (let i = 0; i < 4; i++) ids.push(await rpc(`SELECT begin_essay_submission($1,$2,$3,'Tema de teste da discursiva',$4,25)`, [plus, medio.id, cargo, longText]));
check(ids.slice(0, 3).every(Boolean) && ids[3] === null, 'discursiva: 3 por semana, a 4ª é recusada');
await db.query(`UPDATE essay_submissions SET status='error' WHERE id=$1`, [ids[0]]);
check(!!(await rpc(`SELECT begin_essay_submission($1,$2,$3,'Tema de teste da discursiva',$4,25)`, [plus, medio.id, cargo, longText])),
  'correção que deu erro devolve a vaga');
await as(plus);
const eq = await rpc(`SELECT get_essay_quota()`);
check(eq.plus === true && eq.used === 3 && eq.remaining === 0 && !!eq.next_slot_at, `get_essay_quota: ${eq.used}/${eq.limit}, próxima vaga informada`);

// ---------- E. Geração das específicas ----------
const wt = (await db.query(`SELECT area, cargo IS NOT NULL AS por_cargo, min(weekly_target)::int mn, max(weekly_target)::int mx
  FROM study_track_subjects GROUP BY 1, 2 ORDER BY 1, 2`)).rows;
const espec = wt.find((r) => r.area === 'Conhecimentos Específicos' && r.por_cargo);
const others = wt.filter((r) => !(r.area === 'Conhecimentos Específicos' && r.por_cargo));
check(espec?.mn === 42 && others.every((r) => r.mx < 42),
  `meta semanal: específicas de cargo = 42 (6/dia), demais inalteradas (${others.map((r) => r.mx).join(', ')})`);

// ---------- Profundidade do banco (quantos simulados distintos cabem) ----------
console.log('\nProfundidade do banco de Específicas (40 por simulado):');
const depth = (await db.query(`
  SELECT m.slug, ts.cargo, count(q.id)::int n
  FROM study_track_subjects ts JOIN study_track_modules m ON m.id=ts.module_id
  JOIN questions q ON q.subject_id=ts.subject_id AND q.is_active AND (q.nivel IS NULL OR q.nivel=m.nivel)
  WHERE ts.area='Conhecimentos Específicos' GROUP BY 1,2 ORDER BY 3`)).rows;
for (const d of depth) console.log(`  ${d.slug.padEnd(15)} ${String(d.cargo ?? '(comum)').padEnd(45)} ${String(d.n).padStart(3)} questões = ${(d.n / 40).toFixed(1)} simulados inéditos`);

// ---------- Consultas de validação de negócio rodam no schema atual ----------
await as(null, 'service_role');
const metricSql = fs.readFileSync(path.join(here, 'sql/metricas_validacao.sql'), 'utf8')
  .split(/\n(?=-- H\d)/).filter((s) => /^-- H\d/.test(s));
for (const block of metricSql) {
  const name = block.match(/^-- (H\d)/)[1];
  try { await db.exec(block); check(true, `consulta ${name} executa`); }
  catch (e) { check(false, `consulta ${name}: ${e.message}`); }
}

// H5 confere com uma contagem independente (cada par aluno+questão cuja última resposta foi errada).
const h5 = (await db.query(metricSql.find((b) => b.startsWith('-- H5')))).rows[0];
const truth = await one(`
  SELECT count(*)::int AS questoes, count(DISTINCT user_id)::int AS alunos FROM (
    SELECT user_id, is_correct, row_number() OVER (PARTITION BY user_id, question_id ORDER BY created_at DESC, id DESC) rn
    FROM user_question_attempts) x
  WHERE rn = 1 AND NOT is_correct`);
check(Number(h5.questoes_para_revisar) === truth.questoes && Number(h5.alunos) === truth.alunos && truth.questoes > truth.alunos,
  `H5 soma questões, não alunos (${h5.questoes_para_revisar} questões de ${h5.alunos} alunos)`);

console.log(failures ? `\n${failures} FALHA(S)` : '\nTodos os testes passaram');
process.exit(failures ? 1 : 0);
