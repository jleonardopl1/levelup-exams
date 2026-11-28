#!/usr/bin/env node
/**
 * Auditoria de pistas nas questões das trilhas (régua em
 * supabase/functions/generate-track-questions/length-cue.ts e itemFlaws em quality.ts).
 *
 *   node scripts/audit-questions.mjs camara-cuiaba-2026          # todo o conteúdo da trilha
 *   node scripts/audit-questions.mjs --file <arquivo.json> [-v]   # um arquivo (autoral, lote diário ou revisão ia_diaria)
 *   node scripts/audit-questions.mjs --verify-sql <revisao.json>  # SQL que confere id + hash em produção
 *
 * Sai com código 1 se houver questão com pista ou matéria acima do teto. O mesmo exame
 * roda no `bun run test:unit` (scripts/audit-questions.test.mjs) e no build do seed.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bankLengthFlaws, bankLengthStats } from "../supabase/functions/generate-track-questions/length-cue.ts";
import { itemFlaws } from "../supabase/functions/generate-track-questions/quality.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Normaliza os três formatos (autoral compacto, lote diário, revisão ia_diaria) para {alternativas, correta, enunciado}. */
export function toItems(data) {
  return (data.questions || []).map((q, i) => ({
    where: `#${i + 1}${q.id ? ` (${q.id})` : ""}`,
    slug: q.s || data.slug,
    enunciado: q.q,
    alternativas: q.a,
    correta: q.c,
  }));
}

/** Falhas de uma questão: tamanho + falhas clássicas de elaboração. */
export function questionFlaws(item) {
  return itemFlaws({ ...item, topico: "", dificuldade: "Médio", nivel: "ambos", explicacao: "" });
}

/**
 * Audita uma trilha inteira. Banco de cada matéria = questões autorais + lotes diários
 * (as revisões de ia_diaria ficam fora do teto: só mostram parte do banco de produção).
 */
export function auditTrack(slug) {
  const dir = join(root, "content", "trilhas", slug);
  const files = [];
  for (const f of readdirSync(join(dir, "questions")).filter((x) => x.endsWith(".json")).sort()) {
    files.push({ name: `questions/${f}`, data: JSON.parse(readFileSync(join(dir, "questions", f), "utf8")), bank: true });
  }
  const daily = join(dir, "diarias");
  if (existsSync(daily)) {
    for (const f of readdirSync(daily).filter((x) => x.endsWith(".json")).sort()) {
      files.push({ name: `diarias/${f}`, data: JSON.parse(readFileSync(join(daily, f), "utf8")), bank: true });
    }
  }
  const revDir = join(dir, "revisoes");
  if (existsSync(revDir)) {
    for (const batch of readdirSync(revDir).sort()) {
      const iaDir = join(revDir, batch, "ia_diaria");
      if (!existsSync(iaDir)) continue;
      for (const f of readdirSync(iaDir).filter((x) => x.endsWith(".json")).sort()) {
        files.push({ name: `revisoes/${batch}/ia_diaria/${f}`, data: JSON.parse(readFileSync(join(iaDir, f), "utf8")), bank: false });
      }
    }
  }
  const problems = [];
  const bySubject = new Map();
  for (const { name, data, bank } of files) {
    for (const item of toItems(data)) {
      for (const flaw of questionFlaws(item)) problems.push(`${name}${item.where}: ${flaw}`);
      if (bank) {
        if (!bySubject.has(item.slug)) bySubject.set(item.slug, []);
        bySubject.get(item.slug).push(item);
      }
    }
    for (const r of data.inativar || []) {
      if (!r.id || !/^[0-9a-f]{64}$/.test(r.hash || "") || !r.motivo) problems.push(`${name}: inativação sem id, hash ou motivo`);
    }
  }
  const subjects = [...bySubject.entries()].sort().map(([s, items]) => {
    const stats = bankLengthStats(items);
    for (const f of bankLengthFlaws(stats)) problems.push(`matéria ${s}: ${f}`);
    return { slug: s, ...stats };
  });
  return { files: files.length, problems, subjects };
}

function auditFile(path, verbose) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  const items = toItems(data);
  const problems = [];
  for (const item of items) for (const f of questionFlaws(item)) problems.push(`${item.where}: ${f}`);
  const stats = bankLengthStats(items);
  const isRevision = /ia_diaria/.test(path);
  if (!isRevision) for (const f of bankLengthFlaws(stats)) problems.push(`arquivo: ${f}`);
  console.log(`${basename(path)}: ${stats.n} questões · correta mais longa ${stats.longest} (${Math.round(100 * stats.shareLongest)}%) · ` +
    `mais curta ${stats.shortest} (${Math.round(100 * stats.shareShortest)}%) · com pista ${problems.length}`);
  if (verbose || problems.length) for (const p of problems) console.log("  - " + p);
  return problems.length;
}

function verifySql(path) {
  const data = JSON.parse(readFileSync(path, "utf8"));
  const rows = [...(data.questions || []), ...(data.inativar || [])].map((q) => `('${q.id}','${q.hash}')`);
  console.log(
    `SELECT count(*) AS encontrados, ${rows.length} AS esperados FROM public.questions\n` +
      `WHERE origem = 'ia_diaria' AND (id::text, content_hash) IN (${rows.join(",")});`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  if (args[0] === "--verify-sql") {
    verifySql(args[1]);
  } else if (args[0] === "--file") {
    process.exit(auditFile(args[1], args.includes("-v")) ? 1 : 0);
  } else {
    const slug = args[0] || "camara-cuiaba-2026";
    const { files, problems, subjects } = auditTrack(slug);
    for (const s of subjects) {
      console.log(`${s.slug.padEnd(30)} n=${String(s.n).padStart(3)}  correta mais longa ${String(Math.round(100 * s.shareLongest)).padStart(3)}%  ` +
        `mais curta ${String(Math.round(100 * s.shareShortest)).padStart(3)}%  com pista ${s.flagged}`);
    }
    if (problems.length) {
      console.error(`\n${problems.length} problema(s) em ${files} arquivo(s):\n - ${problems.slice(0, 200).join("\n - ")}`);
      process.exit(1);
    }
    console.log(`\nOK: ${files} arquivo(s) sem pista de tamanho nem falha clássica.`);
  }
}
