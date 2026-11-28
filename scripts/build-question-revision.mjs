#!/usr/bin/env node
/**
 * Migration de revisão de questões JÁ PUBLICADAS de uma trilha (autorais e ia_diaria).
 *
 *   node scripts/build-question-revision.mjs camara-cuiaba-2026 \
 *     --base <git-ref antes da revisão> --batch 2026-11-24 \
 *     --out 20261124130000_revisao_pistas_cmc26.sql
 *
 * Autorais: compara content/trilhas/<slug>/questions/*.json com a versão de `--base` (mesma
 * quantidade e ordem de questões, mesmo gabarito). Para cada questão reescrita:
 *   - grava `k` (chave de ordem = 16 primeiros caracteres do content_hash publicado) no JSON,
 *     para o seed continuar embaralhando como no banco;
 *   - gera UPDATE que só casa com a linha que ainda tem a versão antiga (content_hash + md5 da
 *     ordem exata das alternativas) e grava o texto novo NA MESMA POSIÇÃO.
 * Lotes diários (diarias/) não entram: não estavam publicados quando a revisão foi feita
 * (o seed regenerado já os traz revisados).
 *
 * ia_diaria: lê content/trilhas/<slug>/revisoes/<batch>/ia_diaria/*.json (formato em
 * rules/stack/content-questions.md) e gera UPDATE por id + content_hash atual, e inativações.
 *
 * Por fim: função public.question_length_cue (mesma régua de length-cue.ts) e rede de
 * segurança — questão ia_diaria ativa que ainda tenha pista de tamanho é inativada.
 *
 * A posição importa: user_question_attempts.selected_index e mock_exam_items.selected_index
 * guardam o ÍNDICE que o aluno marcou. Por isso nada é reordenado e o gabarito não muda.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LENGTH_CUE } from "../supabase/functions/generate-track-questions/length-cue.ts";
import { questionFlaws } from "./audit-questions.mjs";
import { altsMd5, contentHash, formatContentJson, isFixed, norm, publishedOrder, sql, sqlArr } from "./lib/track-content.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const slug = args[0] && !args[0].startsWith("--") ? args[0] : "camara-cuiaba-2026";
const base = opt("--base");
const batch = opt("--batch");
const outName = opt("--out");
if (!base || !batch || !outName) {
  console.error("uso: build-question-revision.mjs <trilha> --base <git-ref> --batch <AAAA-MM-DD> --out <arquivo.sql>");
  process.exit(2);
}

const dir = join(root, "content", "trilhas", slug);
const errors = [];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;

function gitShow(rel) {
  return execFileSync("git", ["-C", root, "show", `${base}:${rel}`], { encoding: "utf8", maxBuffer: 1 << 28 });
}

function checkItem(where, q, a, c, e) {
  if (typeof q !== "string" || q.trim().length < 20) errors.push(`${where}: enunciado curto`);
  if (!Array.isArray(a) || a.length !== 4 || a.some((x) => typeof x !== "string" || !x.trim() || x.length > 600)) {
    errors.push(`${where}: precisa de 4 alternativas de até 600 caracteres`);
    return false;
  }
  if (new Set(a.map(norm)).size !== 4) errors.push(`${where}: alternativas repetidas`);
  if (!Number.isInteger(c) || c < 0 || c > 3) errors.push(`${where}: gabarito inválido`);
  if (typeof e !== "string" || e.trim().length < 30) errors.push(`${where}: explicação curta`);
  for (const f of questionFlaws({ enunciado: q, alternativas: a, correta: c })) errors.push(`${where}: ${f}`);
  return true;
}

// ---------------------------------------------------------------------------
// Autorais
// ---------------------------------------------------------------------------
const autoral = []; // { file, rows: [...] }
const rewrittenFiles = [];
for (const file of readdirSync(join(dir, "questions")).filter((f) => f.endsWith(".json")).sort()) {
  const rel = `content/trilhas/${slug}/questions/${file}`;
  const old = JSON.parse(gitShow(rel));
  const cur = JSON.parse(readFileSync(join(root, rel), "utf8"));
  if (old.questions.length !== cur.questions.length) {
    errors.push(`${file}: quantidade de questões mudou (${old.questions.length} → ${cur.questions.length}); revisão exige a mesma ordem`);
    continue;
  }
  const rows = [];
  let stamped = false;
  cur.questions.forEach((nq, i) => {
    const oq = old.questions[i];
    const where = `${file}#${i + 1}`;
    const oldHash = contentHash(oq.q, oq.a);
    const newHash = contentHash(nq.q, nq.a);
    if (oldHash === newHash && oq.e === nq.e && oq.t === nq.t && oq.d === nq.d) return;
    if (nq.c !== oq.c) errors.push(`${where}: gabarito mudou (${oq.c} → ${nq.c}); revisão mantém a posição da correta`);
    if (isFixed(nq) !== isFixed(oq)) errors.push(`${where}: a questão passou a ter (ou deixou de ter) ordem fixa`);
    if (!checkItem(where, nq.q, nq.a, nq.c, nq.e)) return;
    const orderOld = publishedOrder(oq, oldHash);
    if (!isFixed(oq) && oldHash !== newHash) {
      const key = (oq.k || oldHash).slice(0, 16);
      if (nq.k && nq.k !== key) errors.push(`${where}: chave de ordem k diferente da publicada (${nq.k} ≠ ${key})`);
      if (!nq.k) {
        nq.k = key;
        stamped = true;
      }
    }
    // O seed (que embaralha por k) tem de dar a mesma ordem que o banco já tem.
    const orderNew = publishedOrder(nq, newHash);
    if (orderNew.join() !== orderOld.join()) errors.push(`${where}: ordem do seed diverge da publicada`);
    rows.push({
      oldHash,
      oldMd5: altsMd5(orderOld.map((k) => oq.a[k])),
      newHash,
      enunciado: nq.q,
      alternativas: orderOld.map((k) => nq.a[k]),
      correta: orderOld.indexOf(nq.c),
      explicacao: nq.e,
      topico: nq.t,
      dificuldade: nq.d,
    });
  });
  if (stamped) rewrittenFiles.push({ path: join(root, rel), data: cur, raw: readFileSync(join(root, rel), "utf8") });
  if (rows.length) autoral.push({ file, rows });
}

// ---------------------------------------------------------------------------
// ia_diaria (produção)
// ---------------------------------------------------------------------------
const ia = []; // { file, rows, off }
const seenIds = new Set();
const iaDir = join(dir, "revisoes", batch, "ia_diaria");
if (existsSync(iaDir)) {
  for (const file of readdirSync(iaDir).filter((f) => f.endsWith(".json")).sort()) {
    const data = JSON.parse(readFileSync(join(iaDir, file), "utf8"));
    const rows = [];
    const off = [];
    for (const [i, r] of (data.questions || []).entries()) {
      const where = `revisoes/${batch}/ia_diaria/${file}#${i + 1}`;
      if (!UUID.test(r.id || "") || !HASH.test(r.hash || "")) {
        errors.push(`${where}: id ou hash inválido`);
        continue;
      }
      if (seenIds.has(r.id)) errors.push(`${where}: id repetido`);
      seenIds.add(r.id);
      if (!checkItem(where, r.q, r.a, r.c, r.e)) continue;
      rows.push({
        id: r.id,
        oldHash: r.hash,
        newHash: contentHash(r.q, r.a),
        enunciado: r.q,
        alternativas: r.a.map((x) => x.trim()),
        correta: r.c,
        explicacao: r.e,
        topico: typeof r.t === "string" && r.t.trim() ? r.t.trim() : null,
      });
    }
    for (const [i, r] of (data.inativar || []).entries()) {
      const where = `revisoes/${batch}/ia_diaria/${file} inativar#${i + 1}`;
      if (!UUID.test(r.id || "") || !HASH.test(r.hash || "") || !r.motivo) {
        errors.push(`${where}: id, hash ou motivo inválido`);
        continue;
      }
      if (seenIds.has(r.id)) errors.push(`${where}: id repetido (já revisado ou inativado)`);
      seenIds.add(r.id);
      off.push({ id: r.id, hash: r.hash, motivo: r.motivo });
    }
    ia.push({ file, rows, off });
  }
}

if (errors.length) {
  console.error(`Revisão inválida (${errors.length}):\n - ${errors.slice(0, 300).join("\n - ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------
const L = LENGTH_CUE;
const out = [];
out.push(`-- GERADO por scripts/build-question-revision.mjs (trilha ${slug}, base ${base}, lote ${batch}). NAO EDITE A MAO.`);
out.push("-- Revisão de pistas de forma: a alternativa correta se destacava pelo tamanho (mais longa e");
out.push("-- detalhada que as erradas). Texto novo NA MESMA POSIÇÃO e com o mesmo gabarito, porque");
out.push("-- user_question_attempts.selected_index e mock_exam_items.selected_index guardam o índice marcado.");
out.push("-- Idempotente e tolerante à ordem: cada linha só muda se o banco ainda tiver a versão antiga.");
out.push("");
out.push(`-- Régua de pista de tamanho (espelho de supabase/functions/generate-track-questions/length-cue.ts).
CREATE OR REPLACE FUNCTION public.question_length_cue(p_alternativas text[], p_correta integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH l AS (
    SELECT (u.i - 1)::integer AS idx, length(btrim(regexp_replace(u.a, '\\s+', ' ', 'g'))) AS n
    FROM unnest(p_alternativas) WITH ORDINALITY AS u(a, i)
  ), s AS (
    SELECT max(n) FILTER (WHERE idx = p_correta) AS c,
           max(n) FILTER (WHERE idx <> p_correta) AS mx,
           min(n) FILTER (WHERE idx <> p_correta) AS mn,
           avg(n) FILTER (WHERE idx <> p_correta) AS av
    FROM l
  )
  SELECT coalesce(
       (c > mx AND c > ${L.overLongestRatio} * mx AND c - mx >= ${L.overLongestChars})
    OR (c > ${L.overAverageRatio} * av AND c - av >= ${L.overAverageChars})
    OR (c < mn AND c < ${L.underShortestRatio} * mn AND mn - c >= ${L.underShortestChars}), false)
  FROM s
$$;

COMMENT ON FUNCTION public.question_length_cue(text[], integer) IS
  'true quando o tamanho da alternativa correta entrega a resposta (regras A/B/C de length-cue.ts).';
REVOKE ALL ON FUNCTION public.question_length_cue(text[], integer) FROM PUBLIC, anon, authenticated;
`);

let nAutoral = 0;
for (const { file, rows } of autoral) {
  nAutoral += rows.length;
  out.push(`-- Autorais: ${file} (${rows.length} questões)`);
  out.push(`UPDATE public.questions AS q
SET enunciado = r.enunciado, alternativas = r.alternativas, correta = r.correta, explicacao = r.explicacao,
    topico = r.topico, dificuldade = r.dificuldade, content_hash = r.new_hash
FROM (VALUES
${rows.map((r) => `  (${sql(r.oldHash)}, ${sql(r.oldMd5)}, ${sql(r.newHash)}, ${sql(r.enunciado)},\n   ${sqlArr(r.alternativas)}, ${r.correta}, ${sql(r.explicacao)}, ${sql(r.topico)}, ${sql(r.dificuldade)})`).join(",\n")}
) AS r(old_hash, old_md5, new_hash, enunciado, alternativas, correta, explicacao, topico, dificuldade)
WHERE q.content_hash = r.old_hash
  AND q.origem = 'autoral'
  AND md5(array_to_string(q.alternativas, chr(31))) = r.old_md5
  AND NOT EXISTS (SELECT 1 FROM public.questions x WHERE x.content_hash = r.new_hash AND x.id <> q.id);
`);
}

if (nAutoral) {
  const pairs = autoral.flatMap(({ rows }) => rows).filter((r) => r.oldHash !== r.newHash);
  out.push(`-- Seed regenerado aplicado ANTES desta revisão: a versão nova entrou como linha própria;
-- a antiga (ainda com pista) sai de circulação.
UPDATE public.questions AS q SET is_active = false
FROM (VALUES
${pairs.map((r) => `  (${sql(r.oldHash)}, ${sql(r.newHash)})`).join(",\n")}
) AS r(old_hash, new_hash)
WHERE q.content_hash = r.old_hash AND q.origem = 'autoral' AND q.is_active
  AND EXISTS (SELECT 1 FROM public.questions x WHERE x.content_hash = r.new_hash);
`);
}

let nIa = 0, nOff = 0;
for (const { file, rows, off } of ia) {
  if (rows.length) {
    nIa += rows.length;
    out.push(`-- ia_diaria: ${file} (${rows.length} reescritas)`);
    out.push(`UPDATE public.questions AS q
SET enunciado = r.enunciado, alternativas = r.alternativas, explicacao = r.explicacao,
    topico = coalesce(r.topico, q.topico), content_hash = r.new_hash
    -- correta não muda: a posição de cada alternativa é a mesma (conferido no WHERE)
FROM (VALUES
${rows.map((r) => `  (${sql(r.id)}::uuid, ${sql(r.oldHash)}, ${sql(r.newHash)}, ${sql(r.enunciado)},\n   ${sqlArr(r.alternativas)}, ${r.correta}, ${sql(r.explicacao)}, ${sql(r.topico)})`).join(",\n")}
) AS r(id, old_hash, new_hash, enunciado, alternativas, correta, explicacao, topico)
WHERE q.id = r.id
  AND q.content_hash = r.old_hash
  AND q.correta = r.correta
  AND q.origem = 'ia_diaria'
  AND NOT EXISTS (SELECT 1 FROM public.questions x WHERE x.content_hash = r.new_hash AND x.id <> q.id);
`);
  }
  if (off.length) {
    nOff += off.length;
    out.push(`-- ia_diaria: ${file} (${off.length} inativadas)
${off.map((r) => `--   ${r.id}: ${r.motivo.replace(/\s+/g, " ")}`).join("\n")}
UPDATE public.questions AS q SET is_active = false
FROM (VALUES
${off.map((r) => `  (${sql(r.id)}::uuid, ${sql(r.hash)})`).join(",\n")}
) AS r(id, old_hash)
WHERE q.id = r.id AND q.content_hash = r.old_hash AND q.origem = 'ia_diaria';
`);
  }
}

out.push(`-- Rede de segurança: questão da fábrica ainda ativa com pista de tamanho (gerada depois da
-- revisão ou cuja linha mudou no meio do caminho) sai de circulação. A fábrica já não publica
-- questão assim (portão em length-cue.ts).
UPDATE public.questions SET is_active = false
WHERE origem = 'ia_diaria' AND is_active AND public.question_length_cue(alternativas, correta);

DO $$
DECLARE
  v_autoral integer;
  v_ia integer;
BEGIN
  SELECT count(*) FILTER (WHERE origem = 'autoral'), count(*) FILTER (WHERE origem = 'ia_diaria')
    INTO v_autoral, v_ia
  FROM public.questions
  WHERE is_active AND public.question_length_cue(alternativas, correta);
  RAISE NOTICE 'revisao de pistas: % autorais e % ia_diaria ativas ainda com pista (esperado: 0 e 0)', v_autoral, v_ia;
END $$;
`);

writeFileSync(join(root, "supabase", "migrations", outName), out.join("\n"));
for (const { path, data, raw } of rewrittenFiles) writeFileSync(path, formatContentJson(data, raw));
console.log(`OK: ${nAutoral} autorais, ${nIa} ia_diaria reescritas, ${nOff} ia_diaria inativadas -> supabase/migrations/${outName}`);
console.log(`Chave de ordem gravada em ${rewrittenFiles.length} arquivo(s) de conteúdo.`);
