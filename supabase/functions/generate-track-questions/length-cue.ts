/**
 * Pista de tamanho nas alternativas — régua única do projeto, sem dependências, usada:
 *   - no portão determinístico da fábrica (quality.ts, Deno);
 *   - no seed das trilhas (scripts/build-track-seed.mjs, Node) e na auditoria
 *     (scripts/audit-questions.mjs), que recusam conteúdo autoral com pista;
 *   - na migration de revisão (função SQL public.question_length_cue, mesmas regras).
 *
 * Por que existe: alunos acertavam "no automático" escolhendo a alternativa mais longa.
 * Em 2026-11-24, no banco autoral da Câmara de Cuiabá, a correta era a mais longa em 66%
 * das questões (o acaso é 25%) e tinha, em média, o dobro do tamanho das erradas.
 *
 * Calibragem: provas reais da Selecon (Prefeitura de Cuiabá, 2024, 79 questões) — a
 * alternativa mais longa, correta ou não, passa a segunda mais longa em 11% (mediana) e
 * em até 29% (percentil 90). As regras abaixo só olham a CORRETA e são mais rígidas que
 * a banca na média, para que "marcar a mais longa" não renda mais que o acaso.
 *
 * Mudou um número aqui? Mude também a função SQL na migration de revisão e os testes.
 */

export const LENGTH_CUE = {
  /** A) Correta é a mais longa e passa a maior errada em mais de 20% e em 10+ caracteres. */
  overLongestRatio: 1.2,
  overLongestChars: 10,
  /** B) Correta passa a média das erradas em mais de 50% e em 25+ caracteres. */
  overAverageRatio: 1.5,
  overAverageChars: 25,
  /** C) Pista invertida: correta é a mais curta, abaixo de 75% da menor errada e 10+ caracteres menor. */
  underShortestRatio: 0.75,
  underShortestChars: 10,
  /** Banco de uma matéria: a correta pode ser a mais longa em no máximo 35% das questões. */
  maxShareLongest: 0.35,
  /** ...e a mais curta em no máximo 40% (evita a correção exagerada, que vira pista invertida). */
  maxShareShortest: 0.4,
  /** O teto por matéria só vale a partir deste número de questões (amostra pequena oscila). */
  minSampleForShare: 20,
} as const;

/** Tamanho como o aluno vê: espaços colapsados, sem espaço nas pontas. */
export const visibleLength = (s: string) => s.replace(/\s+/g, " ").trim().length;

export interface LengthProfile {
  /** Tamanho da correta. */
  correct: number;
  /** Maior, menor e média das erradas. */
  maxWrong: number;
  minWrong: number;
  avgWrong: number;
  /** A correta é ESTRITAMENTE a mais longa / a mais curta. */
  correctIsLongest: boolean;
  correctIsShortest: boolean;
}

export function lengthProfile(alternativas: readonly string[], correta: number): LengthProfile {
  const lens = alternativas.map(visibleLength);
  const correct = lens[correta] ?? 0;
  const wrong = lens.filter((_, i) => i !== correta);
  const maxWrong = Math.max(...wrong);
  const minWrong = Math.min(...wrong);
  const avgWrong = wrong.reduce((s, n) => s + n, 0) / (wrong.length || 1);
  return { correct, maxWrong, minWrong, avgWrong, correctIsLongest: correct > maxWrong, correctIsShortest: correct < minWrong };
}

/** Motivos (em português, viram lição para o Elaborador) pelos quais o tamanho entrega a resposta. */
export function lengthCueFlaws(alternativas: readonly string[], correta: number): string[] {
  if (alternativas.length < 2 || correta < 0 || correta >= alternativas.length) return [];
  const p = lengthProfile(alternativas, correta);
  const L = LENGTH_CUE;
  const flaws: string[] = [];
  if (p.correctIsLongest && p.correct > L.overLongestRatio * p.maxWrong && p.correct - p.maxWrong >= L.overLongestChars) {
    flaws.push(
      `Pista de tamanho: a correta é a alternativa mais longa (${p.correct} caracteres contra ${p.maxWrong} da maior errada). ` +
        "Enxugue a correta (justificativa vai na explicação) e dê às erradas o mesmo nível de detalhe.",
    );
  } else if (p.correct > L.overAverageRatio * p.avgWrong && p.correct - p.avgWrong >= L.overAverageChars) {
    flaws.push(
      `Pista de tamanho: a correta (${p.correct} caracteres) é bem maior que a média das erradas (${Math.round(p.avgWrong)}). ` +
        "As quatro alternativas precisam ter tamanho e estrutura parecidos.",
    );
  }
  if (p.correctIsShortest && p.correct < L.underShortestRatio * p.minWrong && p.minWrong - p.correct >= L.underShortestChars) {
    flaws.push(
      `Pista de tamanho invertida: a correta é a alternativa mais curta (${p.correct} caracteres contra ${p.minWrong} da menor errada).`,
    );
  }
  return flaws;
}

export interface BankLengthStats {
  n: number;
  longest: number;
  shortest: number;
  flagged: number;
  shareLongest: number;
  shareShortest: number;
}

/** Estatística de um conjunto de questões (uma matéria, um lote). */
export function bankLengthStats(items: readonly { alternativas: readonly string[]; correta: number }[]): BankLengthStats {
  let longest = 0, shortest = 0, flagged = 0;
  for (const q of items) {
    const p = lengthProfile(q.alternativas, q.correta);
    if (p.correctIsLongest) longest += 1;
    if (p.correctIsShortest) shortest += 1;
    if (lengthCueFlaws(q.alternativas, q.correta).length) flagged += 1;
  }
  const n = items.length;
  return { n, longest, shortest, flagged, shareLongest: n ? longest / n : 0, shareShortest: n ? shortest / n : 0 };
}

/** Motivos pelos quais o BANCO de uma matéria tem pista estatística (vazio = ok). */
export function bankLengthFlaws(stats: BankLengthStats): string[] {
  const L = LENGTH_CUE;
  if (stats.n < L.minSampleForShare) return [];
  const pct = (x: number) => `${Math.round(100 * x)}%`;
  const out: string[] = [];
  if (stats.shareLongest > L.maxShareLongest) {
    out.push(`a correta é a mais longa em ${pct(stats.shareLongest)} das questões (teto ${pct(L.maxShareLongest)}; acaso = 25%)`);
  }
  if (stats.shareShortest > L.maxShareShortest) {
    out.push(`a correta é a mais curta em ${pct(stats.shareShortest)} das questões (teto ${pct(L.maxShareShortest)})`);
  }
  return out;
}

/**
 * Quantas questões NOVAS com a correta mais longa ainda cabem no banco recente da matéria
 * sem passar do teto. Usado pela fábrica antes de chamar o revisor (não gasta modelo à toa).
 */
export function longestBudget(recent: BankLengthStats, incoming: number): number {
  const total = recent.n + incoming;
  return Math.max(0, Math.floor(LENGTH_CUE.maxShareLongest * total) - recent.longest);
}
