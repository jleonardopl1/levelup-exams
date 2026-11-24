/**
 * Orquestração da fábrica de questões (uma matéria por vez).
 *
 *  1. Elaborador gera N+2 candidatas (com as lições da matéria no prompt).
 *  2. Portão determinístico: esquema + falhas clássicas de elaboração (quality.ts) + pista
 *     de tamanho (length-cue.ts), inclusive o teto por matéria: se no banco recente a correta
 *     já é a mais longa em muitas questões, candidata com a correta mais longa é recusada
 *     antes do revisor (não gasta modelo à toa).
 *  3. Em PARALELO e de forma independente:
 *       - solucionador(es) cego(s): resolvem sem gabarito;
 *       - revisor técnico: confere gabarito, unicidade, fundamento e ementa.
 *  4. Consenso (quality.decide): aprova, reprova ou manda para o árbitro.
 *  5. Árbitro (modelo mais forte) decide só as disputas, se houver tempo e orçamento.
 *
 * Tudo que falha fecha para o lado seguro: disputa não arbitrada é reprovada; revisor
 * que falha derruba a matéria (nada é publicado). Solucionador que falha não bloqueia:
 * a matéria segue com o critério anterior (só o revisor), marcada como "degradada".
 */
import type { LlmClient } from "../_shared/ai/llm.ts";
import {
  ARBITER_TOOL,
  arbiterPrompts,
  GENERATION_TOOL,
  generationPrompts,
  parseArbiter,
  parseGenerated,
  parseReview,
  parseSolver,
  PROMPT_VERSIONS,
  REVIEW_TOOL,
  reviewPrompts,
  SOLVER_TOOL,
  solverPrompts,
} from "./agents.ts";
import { type BankLengthStats, LENGTH_CUE, lengthProfile, longestBudget } from "./length-cue.ts";
import { arbiterKeeps, decide, itemFlaws } from "./quality.ts";
import type { GeneratedQuestion, LessonSource, ReviewVerdict, SolverVote, SubjectContext } from "./types.ts";

export type PipelineMode = "multiagent" | "classic";

export interface PipelineModels {
  generator: string;
  reviewer: string;
  /** Um ou mais modelos para o solucionador cego (diversidade reduz erro correlacionado). */
  solvers: string[];
  arbiter: string;
}

export interface PipelineConfig {
  mode: PipelineMode;
  /** Máximo de questões que o árbitro decide por matéria (controle de custo). */
  maxArbitrations: number;
  /** Instante (epoch ms) a partir do qual nenhuma chamada nova começa. */
  deadline: number;
  now: () => number;
}

export interface PipelineInput {
  ctx: SubjectContext;
  missing: number;
  recent: string[];
  topics: string[];
  facts: string[];
  lessons: string[];
  /**
   * Tamanhos das questões recentes da matéria (bankLengthStats). Com ele, o portão limita
   * quantas novas podem ter a correta como a mais longa (teto LENGTH_CUE.maxShareLongest).
   */
  recentLength?: BankLengthStats;
}

export interface PipelineStats {
  mode: PipelineMode;
  generated: number;
  rejectedByValidator: number;
  /** Recusadas só porque a correta seria a mais longa e a matéria já está no teto. */
  rejectedByLengthBudget: number;
  rejectedByReviewer: number;
  disputed: number;
  arbitrated: number;
  keptByArbiter: number;
  rejectedUnarbitrated: number;
  acceptedDegraded: number;
  solversOk: number;
  solversFailed: number;
}

export interface PipelineOutcome {
  accepted: GeneratedQuestion[];
  /** Motivos de reprovação que viram lições da matéria. */
  lessons: { source: LessonSource; lesson: string }[];
  stats: PipelineStats;
}

/** Tempo mínimo restante para valer a pena chamar o árbitro. */
const ARBITER_MIN_MS = 20_000;

const TIMEOUTS = { generator: 65_000, solver: 45_000, reviewer: 55_000, arbiter: 40_000 };

export async function runQualityPipeline(
  llm: LlmClient,
  input: PipelineInput,
  models: PipelineModels,
  config: PipelineConfig,
): Promise<PipelineOutcome> {
  const { ctx, facts } = input;
  const stats: PipelineStats = {
    mode: config.mode,
    generated: 0,
    rejectedByValidator: 0,
    rejectedByLengthBudget: 0,
    rejectedByReviewer: 0,
    disputed: 0,
    arbitrated: 0,
    keptByArbiter: 0,
    rejectedUnarbitrated: 0,
    acceptedDegraded: 0,
    solversOk: 0,
    solversFailed: 0,
  };
  const lessons: PipelineOutcome["lessons"] = [];

  // 1. Elaborador
  const gen = generationPrompts(ctx, input.missing + 2, input.recent, input.topics, facts, input.lessons, input.recentLength);
  const generated = await llm.callTool({
    agent: "elaborador",
    promptVersion: PROMPT_VERSIONS.elaborador,
    model: models.generator,
    system: gen.system,
    user: gen.user,
    tool: GENERATION_TOOL,
    parse: parseGenerated,
    timeoutMs: TIMEOUTS.generator,
    maxAttempts: 2,
    deadline: config.deadline,
  });
  stats.generated = generated.data.length;

  // 2. Portão determinístico
  const candidates: GeneratedQuestion[] = [];
  let longestLeft = input.recentLength ? longestBudget(input.recentLength, input.missing) : Infinity;
  for (const q of generated.data) {
    const flaws = itemFlaws(q);
    if (flaws.length) {
      stats.rejectedByValidator += 1;
      for (const f of flaws) lessons.push({ source: "validador", lesson: f });
    } else if (lengthProfile(q.alternativas, q.correta).correctIsLongest && longestLeft <= 0) {
      stats.rejectedByLengthBudget += 1;
      lessons.push({
        source: "validador",
        lesson: `A correta não pode ser a alternativa mais longa: na matéria ela já é a mais longa em mais de ${Math.round(100 * LENGTH_CUE.maxShareLongest)}% das questões recentes (o acaso é 25%). Deixe a correta com tamanho intermediário.`,
      });
    } else {
      if (lengthProfile(q.alternativas, q.correta).correctIsLongest) longestLeft -= 1;
      candidates.push(q);
    }
  }
  if (!candidates.length) return { accepted: [], lessons, stats };

  // 3. Solucionadores cegos e revisor, em paralelo e independentes.
  const solverModels = config.mode === "multiagent" ? models.solvers : [];
  const rev = reviewPrompts(ctx, candidates, facts);
  const reviewCall = llm.callTool({
    agent: "revisor",
    promptVersion: PROMPT_VERSIONS.revisor,
    model: models.reviewer,
    system: rev.system,
    user: rev.user,
    tool: REVIEW_TOOL,
    parse: parseReview(candidates.length),
    timeoutMs: TIMEOUTS.reviewer,
    maxAttempts: 2,
    deadline: config.deadline,
  });
  const sol = solverPrompts(ctx, candidates, facts);
  const solverCalls = solverModels.map((model) =>
    llm.callTool({
      agent: "solucionador",
      promptVersion: PROMPT_VERSIONS.solucionador,
      model,
      system: sol.system,
      user: sol.user,
      tool: SOLVER_TOOL,
      parse: parseSolver(candidates.length),
      timeoutMs: TIMEOUTS.solver,
      maxAttempts: 2,
      deadline: config.deadline,
    })
  );
  const [reviewSettled, solverSettled] = await Promise.all([
    reviewCall.then((r) => ({ ok: true as const, r }), (e: unknown) => ({ ok: false as const, e })),
    Promise.allSettled(solverCalls),
  ]);
  // O revisor é obrigatório: sem ele nada é publicado (falha fechada).
  if (!reviewSettled.ok) throw reviewSettled.e;
  const reviews: Map<number, ReviewVerdict> = reviewSettled.r.data;
  const solverVotes: Map<number, SolverVote>[] = [];
  for (const r of solverSettled) {
    if (r.status === "fulfilled") {
      solverVotes.push(r.value.data);
      stats.solversOk += 1;
    } else {
      stats.solversFailed += 1;
    }
  }

  // 4. Consenso
  const accepted: GeneratedQuestion[] = [];
  const disputes: { question: GeneratedQuestion; reasons: string[] }[] = [];
  candidates.forEach((q, i) => {
    const decision = decide(q, reviews.get(i), solverVotes.map((votes) => votes.get(i)));
    if (decision.kind === "accept") {
      // No modo clássico aceitar só com o revisor é o esperado, não degradação.
      if (decision.degraded && config.mode === "multiagent") stats.acceptedDegraded += 1;
      accepted.push(q);
    } else if (decision.kind === "reject") {
      stats.rejectedByReviewer += 1;
      for (const reason of decision.reasons) lessons.push({ source: decision.source, lesson: reason });
    } else {
      disputes.push({ question: q, reasons: decision.reasons });
    }
  });
  stats.disputed = disputes.length;

  // 5. Árbitro — só se ainda faltar questão, houver orçamento e tempo.
  const stillMissing = Math.max(0, input.missing - accepted.length);
  const canArbitrate = stillMissing > 0 && config.maxArbitrations > 0 &&
    config.deadline - config.now() >= ARBITER_MIN_MS;
  const toArbitrate = canArbitrate ? disputes.slice(0, Math.min(config.maxArbitrations, stillMissing + 1)) : [];
  stats.rejectedUnarbitrated = disputes.length - toArbitrate.length;

  if (toArbitrate.length) {
    const arb = arbiterPrompts(ctx, toArbitrate, facts);
    try {
      const verdicts = await llm.callTool({
        agent: "arbitro",
        promptVersion: PROMPT_VERSIONS.arbitro,
        model: models.arbiter,
        system: arb.system,
        user: arb.user,
        tool: ARBITER_TOOL,
        parse: parseArbiter(toArbitrate.length),
        timeoutMs: TIMEOUTS.arbiter,
        maxAttempts: 1,
        deadline: config.deadline,
      });
      stats.arbitrated = toArbitrate.length;
      toArbitrate.forEach((d, i) => {
        const v = verdicts.data.get(i);
        if (arbiterKeeps(d.question, v)) {
          stats.keptByArbiter += 1;
          accepted.push(d.question);
        } else if (v?.motivo) {
          lessons.push({ source: "arbitro", lesson: v.motivo });
        }
      });
    } catch {
      // Árbitro indisponível: as disputas são reprovadas (lado seguro).
      stats.rejectedUnarbitrated += toArbitrate.length;
    }
  }

  return { accepted: accepted.slice(0, input.missing), lessons, stats };
}
