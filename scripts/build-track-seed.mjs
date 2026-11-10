#!/usr/bin/env node
/**
 * Gera a migration SQL de uma trilha de estudos a partir do conteudo versionado
 * em content/trilhas/<slug>/ (track.json + questions/*.json).
 *
 *   node scripts/build-track-seed.mjs camara-cuiaba-2026
 *
 * - Valida cada questao (4 alternativas distintas, gabarito 0..3, explicacao).
 * - Embaralha as alternativas de forma deterministica (hash do enunciado) para
 *   equilibrar o gabarito, exceto quando as alternativas se referem umas as outras
 *   (itens I/II/III, "todas as anteriores"...) ou a questao tem "fixa": true.
 * - Calcula content_hash (dedup): a migration e idempotente (ON CONFLICT) e, ao ser
 *   reaplicada, atualiza gabarito/explicacao/nivel corrigidos das questoes autorais.
 *
 * Formato compacto de cada questao:
 *   { "t": "topico", "d": "Fácil|Médio|Difícil", "n": "medio|superior" (opcional),
 *     "q": "enunciado", "a": ["A","B","C","D"], "c": 0, "e": "explicação", "fixa": false }
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2] || "camara-cuiaba-2026";
const dir = join(root, "content", "trilhas", slug);
const track = JSON.parse(readFileSync(join(dir, "track.json"), "utf8"));
const out = join(root, "supabase", "migrations", track.migration_file);

const sql = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const sqlArr = (arr) => `ARRAY[${arr.map(sql).join(", ")}]::text[]`;
const norm = (s) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
export const contentHash = (enunciado, alternativas) =>
  createHash("sha256").update(norm(enunciado) + "||" + alternativas.map(norm).sort().join("|")).digest("hex");

const NO_SHUFFLE = /anteriores|nenhuma das|todas as alternativas|^\s*(apenas\s+)?[IVX]+\b|\b[IVX]+\s*(,|e)\s*[IVX]+\b|^\s*[VF]\s*[-–,]\s*[VF]/i;

function seededShuffle(n, seedHex) {
  // Fisher-Yates usando bytes do proprio hash (deterministico e sem vies de PRNG).
  const idx = [...Array(n).keys()];
  for (let i = n - 1, k = 0; i > 0; i--, k++) {
    const j = parseInt(seedHex.slice(k * 4, k * 4 + 4), 16) % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

const errors = [];
const subjects = [];
const seenHashes = new Map();
const questionFiles = readdirSync(join(dir, "questions")).filter((f) => f.endsWith(".json")).sort();

for (const file of questionFiles) {
  const data = JSON.parse(readFileSync(join(dir, "questions", file), "utf8"));
  const meta = track.subjects.find((s) => s.slug === data.slug);
  if (!meta) { errors.push(`${file}: materia ${data.slug} nao declarada em track.json`); continue; }
  const questions = [];
  data.questions.forEach((q, i) => {
    const where = `${file}#${i + 1}`;
    if (!q.q || q.q.length < 15) errors.push(`${where}: enunciado vazio/curto`);
    if (!Array.isArray(q.a) || q.a.length !== 4) errors.push(`${where}: precisa de 4 alternativas`);
    else if (new Set(q.a.map(norm)).size !== 4) errors.push(`${where}: alternativas repetidas`);
    if (!Number.isInteger(q.c) || q.c < 0 || q.c > 3) errors.push(`${where}: gabarito invalido`);
    if (!q.e || q.e.length < 20) errors.push(`${where}: explicacao ausente/curta`);
    if (q.n && !["medio", "superior"].includes(q.n)) errors.push(`${where}: nivel invalido`);
    if (!["Fácil", "Médio", "Difícil"].includes(q.d)) errors.push(`${where}: dificuldade invalida`);
    if (!q.a || q.a.length !== 4) return;
    const hash = contentHash(q.q, q.a);
    if (seenHashes.has(hash)) errors.push(`${where}: duplicada de ${seenHashes.get(hash)}`);
    seenHashes.set(hash, where);
    let alternativas = q.a;
    let correta = q.c;
    const fixed = q.fixa || q.a.some((alt) => NO_SHUFFLE.test(alt));
    if (!fixed) {
      const order = seededShuffle(4, hash);
      alternativas = order.map((k) => q.a[k]);
      correta = order.indexOf(q.c);
    }
    questions.push({ ...q, alternativas, correta, hash });
  });
  subjects.push({ meta, questions });
}

for (const s of track.subjects) {
  const found = subjects.find((x) => x.meta.slug === s.slug);
  if (!found) errors.push(`materia ${s.slug} sem arquivo de questoes`);
  else {
    for (const mod of track.modules) {
      if (!mod.subjects.some((ms) => ms.slug === s.slug)) continue;
      const usable = found.questions.filter((q) => !q.n || q.n === mod.nivel).length;
      if (usable < track.min_questions_per_subject)
        errors.push(`${s.slug} (${mod.slug}): ${usable} questoes < minimo ${track.min_questions_per_subject}`);
    }
  }
}

if (errors.length) {
  console.error("Conteudo invalido:\n - " + errors.join("\n - "));
  process.exit(1);
}

const lines = [];
lines.push(`-- GERADO por scripts/build-track-seed.mjs a partir de content/trilhas/${slug}/. NAO EDITE A MAO.`);
lines.push(`-- Trilha: ${track.name}`);
lines.push("-- Idempotente: pode ser reaplicada sem duplicar materias, modulos ou questoes.");
lines.push("");
lines.push(`INSERT INTO public.career_categories (name, description, icon, display_order)
SELECT ${sql(track.category.name)}, ${sql(track.category.description)}, ${sql(track.category.icon)}, ${track.category.display_order}
WHERE NOT EXISTS (SELECT 1 FROM public.career_categories WHERE name = ${sql(track.category.name)});`);
lines.push("");

track.subjects.forEach((s, i) => {
  lines.push(`INSERT INTO public.subjects (career_category_id, name, icon, display_order, slug, description)
SELECT c.id, ${sql(s.name)}, ${sql(s.icon)}, ${i + 1}, ${sql(s.slug)}, ${sql(s.description || null)}
FROM public.career_categories c WHERE c.name = ${sql(track.category.name)}
ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE
  SET name = EXCLUDED.name, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, description = EXCLUDED.description;`);
});
lines.push("");

lines.push(`INSERT INTO public.study_tracks (slug, name, short_name, organ, banca, exam_date, edital_url, description, rules)
VALUES (${sql(track.slug)}, ${sql(track.name)}, ${sql(track.short_name)}, ${sql(track.organ)}, ${sql(track.banca)},
        ${sql(track.exam_date)}, ${sql(track.edital_url)}, ${sql(track.description)}, ${sql(JSON.stringify(track.rules))}::jsonb)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, short_name = EXCLUDED.short_name, organ = EXCLUDED.organ,
  banca = EXCLUDED.banca, exam_date = EXCLUDED.exam_date, edital_url = EXCLUDED.edital_url,
  description = EXCLUDED.description, rules = EXCLUDED.rules;`);
lines.push("");

track.modules.forEach((m, mi) => {
  lines.push(`INSERT INTO public.study_track_modules (track_id, slug, name, nivel, description, cargos, structure, display_order)
SELECT t.id, ${sql(m.slug)}, ${sql(m.name)}, ${sql(m.nivel)}, ${sql(m.description)}, ${sqlArr(m.cargos)},
       ${sql(JSON.stringify(m.structure))}::jsonb, ${mi + 1}
FROM public.study_tracks t WHERE t.slug = ${sql(track.slug)}
ON CONFLICT (track_id, slug) DO UPDATE SET name = EXCLUDED.name, nivel = EXCLUDED.nivel,
  description = EXCLUDED.description, cargos = EXCLUDED.cargos, structure = EXCLUDED.structure,
  display_order = EXCLUDED.display_order;`);
  m.subjects.forEach((ms, si) => {
    lines.push(`INSERT INTO public.study_track_subjects (module_id, subject_id, area, cargo, syllabus, study_tips, weekly_target, ai_grounded_only, display_order)
SELECT m.id, s.id, ${sql(ms.area)}, ${sql(ms.cargo || null)}, ${sql(ms.syllabus)}, ${sql(ms.tips || null)}, ${track.weekly_new_per_subject}, ${ms.grounded ? "true" : "false"}, ${si + 1}
FROM public.study_track_modules m JOIN public.study_tracks t ON t.id = m.track_id, public.subjects s
WHERE t.slug = ${sql(track.slug)} AND m.slug = ${sql(m.slug)} AND s.slug = ${sql(ms.slug)}
ON CONFLICT (module_id, subject_id) DO UPDATE SET area = EXCLUDED.area, cargo = EXCLUDED.cargo,
  syllabus = EXCLUDED.syllabus, study_tips = EXCLUDED.study_tips, weekly_target = EXCLUDED.weekly_target,
  ai_grounded_only = EXCLUDED.ai_grounded_only,
  display_order = EXCLUDED.display_order;`);
  });
  lines.push("");
});

let total = 0;
for (const { meta, questions } of subjects) {
  lines.push(`-- ${meta.name}: ${questions.length} questoes`);
  for (const q of questions) {
    total++;
    lines.push(`INSERT INTO public.questions (enunciado, alternativas, correta, categoria, dificuldade, explicacao, subject_id, is_premium, topico, origem, nivel, content_hash)
SELECT ${sql(q.q)}, ${sqlArr(q.alternativas)}, ${q.correta}, ${sql(meta.name)}, ${sql(q.d)}, ${sql(q.e)}, s.id, false, ${sql(q.t)}, ${sql(q.o || "autoral")}, ${sql(q.n || null)}, ${sql(q.hash)}
FROM public.subjects s WHERE s.slug = ${sql(meta.slug)}
ON CONFLICT (content_hash) DO UPDATE SET
  alternativas = EXCLUDED.alternativas, correta = EXCLUDED.correta, categoria = EXCLUDED.categoria,
  dificuldade = EXCLUDED.dificuldade, explicacao = EXCLUDED.explicacao, topico = EXCLUDED.topico, nivel = EXCLUDED.nivel
WHERE questions.origem = 'autoral';`);
  }
  lines.push("");
}

writeFileSync(out, lines.join("\n") + "\n");

const dist = [0, 0, 0, 0];
subjects.forEach(({ questions }) => questions.forEach((q) => dist[q.correta]++));
console.log(`OK: ${subjects.length} materias, ${total} questoes -> ${out}`);
console.log(`Distribuicao do gabarito A/B/C/D: ${dist.join(" / ")}`);
for (const { meta, questions } of subjects) {
  const byLevel = track.modules
    .filter((m) => m.subjects.some((ms) => ms.slug === meta.slug))
    .map((m) => `${m.slug}=${questions.filter((q) => !q.n || q.n === m.nivel).length}`)
    .join(" ");
  console.log(`  ${meta.slug.padEnd(28)} ${String(questions.length).padStart(3)}  ${byLevel}`);
}
