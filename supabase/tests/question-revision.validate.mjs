// Testes de banco da revisão de pistas (fora da CI, como os demais em PGlite):
//   npm i --no-save @electric-sql/pglite@0.5.16
//   node supabase/tests/question-revision.validate.mjs <git-ref-base> <migration-de-revisao.sql>
//
// Cenário PRODUÇÃO: migrations em ordem, mas com os seeds da trilha na versão do git-ref-base
// (o que está publicado) e sem o lote diário (nunca aplicado); depois a revisão. Confere:
//   - nenhuma autoral ativa com pista; nenhuma linha nova; gabarito (índice) igual para todas;
//   - cada alternativa ficou na mesma posição (as que não mudaram de texto continuam no mesmo índice);
//   - reaplicar a revisão não muda nada; reaplicar o seed NOVO depois não muda a ordem nem duplica;
//   - ia_diaria reescritas/inativadas pelo id e hash; rede de segurança inativa ia_diaria com pista.
// Cenário BANCO NOVO: todas as migrations do repositório (seed novo + revisão) sem falhas e sem pista.
// Paridade: public.question_length_cue == lengthCueFlaws (JS) em todas as questões, antigas e novas.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { lengthCueFlaws } from '../functions/generate-track-questions/length-cue.ts';
import { bootSupabaseDb, cleanMigration, repoRoot, STUBS } from './pglite-supabase.mjs';

const [base, revisionFile] = process.argv.slice(2);
if (!base || !revisionFile) {
  console.error('uso: node supabase/tests/question-revision.validate.mjs <git-ref-base> <migration-de-revisao.sql>');
  process.exit(2);
}
const migDir = path.join(repoRoot, 'supabase/migrations');
const SEED = '20261110130100_trilha_camara_cuiaba_2026.sql';
const DAILY = '20261111120000_camara_cuiaba_2026_diarias_20261111.sql';
const gitShow = (rel) => execFileSync('git', ['-C', repoRoot, 'show', `${base}:${rel}`], { encoding: 'utf8', maxBuffer: 1 << 28 });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${msg}`);
  if (!ok) failures++;
};

async function snapshot(db) {
  const { rows } = await db.query(`SELECT id, origem, is_active, correta, alternativas, content_hash FROM public.questions ORDER BY id`);
  return rows;
}

// ---------------------------------------------------------------------------
// Cenário PRODUÇÃO
// ---------------------------------------------------------------------------
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(STUBS);
const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const applyErrors = [];
for (const f of files) {
  if (f === revisionFile || f === DAILY) continue;
  const sql = f === SEED ? gitShow(`supabase/migrations/${SEED}`) : fs.readFileSync(path.join(migDir, f), 'utf8');
  try { await db.exec(cleanMigration(sql)); } catch (e) { applyErrors.push(`${f}: ${e.message}`); }
}
check(applyErrors.length === 0, `produção: migrations anteriores aplicadas (${applyErrors.join(' | ') || 'sem erro'})`);

// Questões ia_diaria sintéticas com os ids/hash das revisões (o conteúdo antigo só existe em produção).
const revDir = path.join(repoRoot, 'content/trilhas/camara-cuiaba-2026/revisoes');
const iaRevs = [];
if (fs.existsSync(revDir)) {
  for (const batch of fs.readdirSync(revDir)) {
    const d = path.join(revDir, batch, 'ia_diaria');
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) iaRevs.push(JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')));
  }
}
const { rows: [subj] } = await db.query(`SELECT id FROM public.subjects WHERE slug = 'cmc26-psicologo'`);
let iaCount = 0;
for (const rev of iaRevs) {
  const { rows: [s] } = await db.query(`SELECT id FROM public.subjects WHERE slug = $1`, [rev.slug]);
  for (const q of rev.questions || []) {
    iaCount++;
    await db.query(
      `INSERT INTO public.questions (id, enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, origem, content_hash, is_active)
       VALUES ($1, 'enunciado antigo da fabrica com pista', ARRAY['correta muito longa e detalhada com justificativa embutida','curta','curta b','curta c'], $2, 'x', 'Médio', 'explicacao antiga', $3, 'ia_diaria', $4, true)`,
      [q.id, q.c, s.id, q.hash],
    );
  }
  for (const r of rev.inativar || []) {
    await db.query(
      `INSERT INTO public.questions (id, enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, origem, content_hash, is_active)
       VALUES ($1, 'questao irrecuperavel', ARRAY['a1','b1','c1','d1'], 0, 'x', 'Médio', 'explicacao', $2, 'ia_diaria', $3, true)`,
      [r.id, s.id, r.hash],
    );
  }
}
// Uma ia_diaria nova (gerada depois da exportação) com pista: a rede de segurança tem de pegar.
await db.query(
  `INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, origem, content_hash, is_active)
   VALUES ('questao nova com pista', ARRAY['alternativa correta muito mais longa que as outras tres juntas','b','c','d'], 0, 'x', 'Médio', 'e', $1, 'ia_diaria', 'h-nova', true)`,
  [subj.id],
);

const before = await snapshot(db);
const revisionSql = cleanMigration(fs.readFileSync(path.join(migDir, revisionFile), 'utf8'));
try { await db.exec(revisionSql); check(true, 'produção: revisão aplicada'); }
catch (e) { check(false, `produção: revisão falhou: ${e.message}`); }
const after = await snapshot(db);

const byId = new Map(before.map((r) => [r.id, r]));
check(after.length === before.length, `produção: nenhuma linha nova (${before.length} → ${after.length})`);
const autoral = after.filter((r) => r.origem === 'autoral');
const changed = autoral.filter((r) => r.content_hash !== byId.get(r.id).content_hash);
check(changed.length > 0, `produção: ${changed.length} autorais reescritas`);
check(autoral.every((r) => r.correta === byId.get(r.id).correta), 'produção: gabarito (índice) igual em todas as autorais');
// Posição: alternativa cujo texto não mudou continua no mesmo índice; nenhuma troca de lugar.
let moved = 0;
for (const r of changed) {
  const old = byId.get(r.id).alternativas;
  r.alternativas.forEach((a, i) => { const j = old.indexOf(a); if (j >= 0 && j !== i) moved++; });
}
check(moved === 0, `produção: nenhuma alternativa trocou de posição (${moved})`);
const { rows: [cues] } = await db.query(`SELECT
  count(*) FILTER (WHERE origem = 'autoral' AND is_active AND public.question_length_cue(alternativas, correta)) AS autoral,
  count(*) FILTER (WHERE origem = 'ia_diaria' AND is_active AND public.question_length_cue(alternativas, correta)) AS ia
  FROM public.questions`);
check(Number(cues.autoral) === 0, `produção: autorais ativas com pista = ${cues.autoral}`);
check(Number(cues.ia) === 0, `produção: ia_diaria ativas com pista = ${cues.ia}`);
const { rows: [nova] } = await db.query(`SELECT is_active FROM public.questions WHERE content_hash = 'h-nova'`);
check(nova.is_active === false, 'produção: rede de segurança inativou a ia_diaria nova com pista');
if (iaCount) {
  const { rows: [ia] } = await db.query(`SELECT count(*) AS n FROM public.questions WHERE origem = 'ia_diaria' AND enunciado <> 'enunciado antigo da fabrica com pista' AND id = ANY($1::uuid[])`,
    [iaRevs.flatMap((r) => (r.questions || []).map((q) => q.id))]);
  check(Number(ia.n) === iaCount, `produção: ${ia.n}/${iaCount} ia_diaria reescritas`);
  const offIds = iaRevs.flatMap((r) => (r.inativar || []).map((q) => q.id));
  if (offIds.length) {
    const { rows: [off] } = await db.query(`SELECT count(*) AS n FROM public.questions WHERE NOT is_active AND id = ANY($1::uuid[])`, [offIds]);
    check(Number(off.n) === offIds.length, `produção: ${off.n}/${offIds.length} ia_diaria inativadas`);
  }
}

// Idempotência e ordem com o seed novo reaplicado depois.
await db.exec(revisionSql);
const again = await snapshot(db);
check(JSON.stringify(again) === JSON.stringify(after), 'produção: reaplicar a revisão não muda nada');
await db.exec(cleanMigration(fs.readFileSync(path.join(migDir, SEED), 'utf8')));
const reseeded = await snapshot(db);
check(reseeded.length === after.length, `produção: reaplicar o seed novo não cria linhas (${after.length} → ${reseeded.length})`);
const reseedMoved = reseeded.filter((r, i) => r.origem === 'autoral' && JSON.stringify(r.alternativas) !== JSON.stringify(after[i].alternativas)).length;
check(reseedMoved === 0, `produção: reaplicar o seed novo não reordena nem reescreve autorais (${reseedMoved})`);

// Paridade JS × SQL em todas as autorais (antes e depois) e nas reescritas da fábrica.
const samples = [...before, ...after].filter((r) => r.alternativas?.length === 4);
let mismatch = 0;
for (const r of samples) {
  const { rows: [x] } = await db.query(`SELECT public.question_length_cue($1::text[], $2) AS cue`, [r.alternativas, r.correta]);
  if (x.cue !== lengthCueFlaws(r.alternativas, r.correta).length > 0) mismatch++;
}
check(mismatch === 0, `paridade JS × SQL em ${samples.length} questões (${mismatch} divergências)`);
const { rows: [grant] } = await db.query(`SELECT has_function_privilege('anon', 'public.question_length_cue(text[], integer)', 'EXECUTE') AS anon`);
check(grant.anon === false, 'question_length_cue sem EXECUTE para anon');

// ---------------------------------------------------------------------------
// Cenário BANCO NOVO
// ---------------------------------------------------------------------------
const fresh = await bootSupabaseDb();
check(fresh.failures.length === 0, `banco novo: todas as migrations aplicadas (${fresh.failures.join(' | ') || 'sem erro'})`);
const { rows: [freshCues] } = await fresh.db.query(`SELECT count(*) AS n FROM public.questions WHERE is_active AND public.question_length_cue(alternativas, correta)`);
check(Number(freshCues.n) === 0, `banco novo: questões ativas com pista = ${freshCues.n}`);

console.log(failures ? `\n${failures} falha(s).` : '\nTodos os testes passaram.');
process.exit(failures ? 1 : 0);
