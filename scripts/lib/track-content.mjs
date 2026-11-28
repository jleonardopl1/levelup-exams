/**
 * Utilitários compartilhados pelo seed das trilhas (build-track-seed.mjs) e pela migration
 * de revisão (build-question-revision.mjs). Mudar algo aqui muda o content_hash ou a ordem
 * das alternativas no banco: só com migration de revisão junto.
 */
import { createHash } from "node:crypto";

export const sql = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
export const sqlArr = (arr) => `ARRAY[${arr.map(sql).join(", ")}]::text[]`;
export const norm = (s) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** Mesmo algoritmo da fábrica (generate-track-questions/index.ts): dedup entre seed e geração. */
export const contentHash = (enunciado, alternativas) =>
  createHash("sha256").update(norm(enunciado) + "||" + alternativas.map(norm).sort().join("|")).digest("hex");

/** md5 da ordem exata das alternativas, igual a md5(array_to_string(alternativas, chr(31))) no Postgres. */
export const altsMd5 = (alternativas) => createHash("md5").update(alternativas.join("\u001f"), "utf8").digest("hex");

export const NO_SHUFFLE = /anteriores|nenhuma das|todas as alternativas|^\s*(apenas\s+)?[IVX]+\b|\b[IVX]+\s*(,|e)\s*[IVX]+\b|^\s*[VF]\s*[-–,]\s*[VF]/i;

/** A ordem das alternativas tem significado (I/II/III, V/F, "anteriores") ou foi fixada à mão. */
export const isFixed = (q) => !!q.fixa || q.a.some((alt) => NO_SHUFFLE.test(alt));

export function seededShuffle(n, seedHex) {
  // Fisher-Yates usando bytes do proprio hash (deterministico e sem vies de PRNG).
  const idx = [...Array(n).keys()];
  for (let i = n - 1, k = 0; i > 0; i--, k++) {
    const j = parseInt(seedHex.slice(k * 4, k * 4 + 4), 16) % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/**
 * Ordem em que a questão vai para o banco: identidade se fixa; senão embaralhada pela chave
 * de ordem `k` (hash da primeira publicação) ou, sem ela, pelo content_hash atual.
 */
export const publishedOrder = (q, hash = contentHash(q.q, q.a)) => (isFixed(q) ? [0, 1, 2, 3] : seededShuffle(4, q.k || hash));

/**
 * Formato dos arquivos content/trilhas/<slug>/questions/*.json. Há dois estilos no repositório
 * e cada arquivo mantém o seu (`raw` = conteúdo atual): uma chave por linha, sem recuo; ou uma
 * questão por linha, com recuo de 2/4 espaços. Sem `raw`, usa o primeiro.
 */
export function formatContentJson(data, raw = "") {
  const trailing = raw.endsWith("\n") ? "\n" : "";
  if (/^\{\n {2}"/.test(raw)) {
    const head = Object.entries(data).filter(([k]) => k !== "questions").map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    const lines = data.questions.map((q) => "    " + JSON.stringify(q));
    return `{\n${head.join("\n")}\n  "questions": [\n${lines.join(",\n")}\n  ]\n}${trailing}`;
  }
  return JSON.stringify(data, null, "\t").split("\n").map((l) => l.replace(/^\t+/, "")).join("\n") + trailing;
}
