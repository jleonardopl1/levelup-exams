/**
 * Regras determinísticas de qualidade da fábrica de questões — puras, testadas em
 * quality.test.ts. Nada aqui chama modelo: é o "portão" que nenhum agente consegue
 * contornar (validação de esquema, falhas clássicas de elaboração de itens e a regra
 * de consenso entre os agentes).
 */
import type { Decision, GeneratedQuestion, ReviewVerdict, SolverVote } from "./types.ts";

export const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

export const letter = (i: number | null | undefined) =>
  i === null || i === undefined || i < 0 || i > 25 ? "nenhuma" : String.fromCharCode(65 + i);

/** Valida e normaliza uma questão gerada. `null` = fora do esquema. */
export function validateQuestion(q: unknown): GeneratedQuestion | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;
  const alts = o.alternativas;
  if (typeof o.enunciado !== "string" || o.enunciado.trim().length < 20 || o.enunciado.length > 2500) return null;
  if (!Array.isArray(alts) || alts.length !== 4) return null;
  if (!alts.every((a) => typeof a === "string" && a.trim().length > 0 && a.length <= 600)) return null;
  if (new Set(alts.map((a) => norm(a as string))).size !== 4) return null;
  if (!Number.isInteger(o.correta) || (o.correta as number) < 0 || (o.correta as number) > 3) return null;
  if (typeof o.explicacao !== "string" || o.explicacao.trim().length < 30 || o.explicacao.length > 2000) return null;
  const dificuldade = ["Fácil", "Médio", "Difícil"].includes(o.dificuldade as string) ? o.dificuldade : "Médio";
  const nivel = ["ambos", "medio", "superior"].includes(o.nivel as string) ? o.nivel : "ambos";
  return {
    topico: typeof o.topico === "string" && o.topico.trim() ? o.topico.trim().slice(0, 120) : "Geral",
    dificuldade: dificuldade as GeneratedQuestion["dificuldade"],
    nivel: nivel as GeneratedQuestion["nivel"],
    enunciado: o.enunciado.trim(),
    alternativas: (alts as string[]).map((a) => a.trim()),
    correta: o.correta as number,
    explicacao: o.explicacao.trim(),
  };
}

const ALL_OR_NONE = /\b(todas as (alternativas|anteriores|opções)|nenhuma das (alternativas|anteriores|opções))\b/i;

/**
 * Falhas clássicas de elaboração de itens (item-writing flaws) que entregam a resposta
 * ou que a banca não usa. Cada string é um motivo de reprovação.
 */
export function itemFlaws(q: GeneratedQuestion): string[] {
  const flaws: string[] = [];
  if (q.alternativas.some((a) => ALL_OR_NONE.test(a))) {
    flaws.push('Alternativa do tipo "todas/nenhuma das anteriores" (a banca não usa e o prompt proíbe).');
  }
  // Pista de tamanho: a correta é a mais longa e bem maior que a média das erradas.
  const lens = q.alternativas.map((a) => a.length);
  const right = lens[q.correta];
  const others = lens.filter((_, i) => i !== q.correta);
  const avgOthers = others.reduce((s, n) => s + n, 0) / others.length;
  if (right > Math.max(...others) && avgOthers > 0 && right >= 1.75 * avgOthers && right - avgOthers >= 40) {
    flaws.push("Alternativa correta muito mais longa que as demais (pista de tamanho para o candidato).");
  }
  // O gabarito não pode aparecer copiado no enunciado.
  const stem = norm(q.enunciado);
  const key = norm(q.alternativas[q.correta]);
  if (key.length >= 25 && stem.includes(key)) {
    flaws.push("O texto da alternativa correta aparece no enunciado (pista direta).");
  }
  return flaws;
}

/** A explicação cita alternativas por letra? Então não dá para embaralhar sem quebrá-la. */
export function citesOptionLetters(text: string): boolean {
  return /\b(alternativas?|letras?|op[cç](ão|ao|ões|oes)|assertivas?|itens?)\s*\(?[A-D]\)?(?![\p{L}\d])/iu.test(text) ||
    /(^|[\s(])\(?[A-D]\)\s/u.test(text) ||
    /\b[A-D]\s+e\s+[A-D]\b/u.test(text);
}

const REFERS_TO_OTHERS = /anteriores|nenhuma das|todas as alternativas|^\s*(apenas\s+)?[IVX]+\b|\b[IVX]+\s*(,|e)\s*[IVX]+\b|^\s*[VF]\s*[-–,]\s*[VF]/i;

/**
 * Embaralha as alternativas para o gabarito não ficar concentrado numa letra.
 * Não embaralha quando a ordem tem significado (I/II/III, V/F) ou quando a explicação
 * cita letras (ela ficaria errada depois de embaralhar).
 */
export function shuffleAlternatives(
  q: GeneratedQuestion,
  randomInts: (n: number) => Uint32Array = (n) => crypto.getRandomValues(new Uint32Array(n)),
): GeneratedQuestion {
  if (q.alternativas.some((a) => REFERS_TO_OTHERS.test(a))) return q;
  if (citesOptionLetters(q.explicacao)) return q;
  const order = [0, 1, 2, 3];
  const rnd = randomInts(4);
  for (let i = 3; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, alternativas: order.map((k) => q.alternativas[k]), correta: order.indexOf(q.correta) };
}

/**
 * Regra de consenso entre os agentes para UMA questão.
 *
 *  - Revisor técnico (viu o gabarito) precisa aprovar — sem isso, reprova.
 *  - Solucionador(es) cego(s) (não viram o gabarito) precisam chegar à MESMA resposta,
 *    sem apontar ambiguidade. Qualquer divergência vira disputa para o árbitro.
 *  - Se nenhum solucionador conseguiu rodar, aceita em modo degradado (o mesmo critério
 *    da versão anterior do pipeline, que usava só o revisor) e sinaliza.
 *
 * `votes` traz um item por solucionador que rodou com sucesso (undefined = ele omitiu
 * esta questão).
 */
export function decide(
  q: GeneratedQuestion,
  review: ReviewVerdict | undefined,
  votes: (SolverVote | undefined)[],
): Decision {
  if (!review || review.aprovada !== true) {
    return { kind: "reject", source: "revisor", reasons: [review?.motivo?.trim() || "Reprovada pelo revisor técnico."] };
  }
  if (votes.length === 0) return { kind: "accept", degraded: true };

  const reasons: string[] = [];
  for (const v of votes) {
    if (!v) reasons.push("Um solucionador cego não respondeu a esta questão.");
    else if (v.ambigua) reasons.push(`Solucionador cego apontou ambiguidade: ${v.justificativa || "mais de uma resposta defensável"}`);
    else if (v.escolha !== q.correta) {
      reasons.push(
        `Solucionador cego marcou ${letter(v.escolha)} e o gabarito é ${letter(q.correta)}` +
          (v.justificativa ? ` (${v.justificativa})` : "") + ".",
      );
    }
  }
  return reasons.length ? { kind: "arbitrate", reasons } : { kind: "accept", degraded: false };
}

/** O árbitro só mantém a questão se confirmar o MESMO gabarito e uma única correta. */
export function arbiterKeeps(q: GeneratedQuestion, verdict: { manter: boolean; gabaritoCorreto: number | null; unicaCorreta: boolean } | undefined): boolean {
  return !!verdict && verdict.manter === true && verdict.unicaCorreta === true && verdict.gabaritoCorreto === q.correta;
}
