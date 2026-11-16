import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { type LlmClient, LlmError, type ToolCallOptions } from "../_shared/ai/llm.ts";
import { type PipelineConfig, type PipelineModels, runQualityPipeline } from "./pipeline.ts";
import type { GeneratedQuestion, SubjectContext } from "./types.ts";

const CTX: SubjectContext = {
  subjectId: "00000000-0000-0000-0000-000000000001",
  name: "Direito Administrativo",
  slug: "direito-administrativo",
  banca: "Selecon",
  trackName: "Câmara Municipal de Cuiabá 2026",
  grounded: false,
  dailyTarget: 3,
  modules: [{ nivel: "superior", name: "Superior", syllabus: "Princípios da Administração Pública.", cargo: null, area: "Conhecimentos Gerais" }],
};

const MODELS: PipelineModels = { generator: "gen", reviewer: "rev", solvers: ["sol"], arbiter: "arb" };

function config(over: Partial<PipelineConfig> = {}): PipelineConfig {
  return { mode: "multiagent", maxArbitrations: 3, deadline: Date.now() + 120_000, now: Date.now, ...over };
}

function q(n: number, correta = 0): GeneratedQuestion {
  return {
    topico: `Tópico ${n}`,
    dificuldade: "Médio",
    nivel: "ambos",
    enunciado: `Questão ${n}: segundo a Constituição Federal, qual princípio se aplica ao caso descrito no enunciado?`,
    alternativas: [`Publicidade ${n}`, `Impessoalidade ${n}`, `Moralidade ${n}`, `Eficiência ${n}`],
    correta,
    explicacao: "O art. 37 da Constituição Federal fundamenta a resposta; os demais princípios tratam de outros deveres.",
  };
}

type Handler = (opts: ToolCallOptions<unknown>) => unknown;

/** LLM falso: cada agente responde com os argumentos que o teste definir (passam pelo parse real). */
function fakeLlm(handlers: Record<string, Handler | Error>) {
  const calls: { agent: string; model: string; user: string }[] = [];
  const llm: LlmClient = {
    callTool<T>(opts: ToolCallOptions<T>) {
      calls.push({ agent: opts.agent, model: opts.model, user: opts.user });
      const h = handlers[opts.agent];
      const meta = { agent: opts.agent, model: opts.model, promptVersion: opts.promptVersion, status: "ok" as const, attempts: 1, latencyMs: 1, inputTokens: 1, outputTokens: 1 };
      if (!h) return Promise.reject(new LlmError(`${opts.agent}: sem roteiro`, { ...meta, status: "error" }));
      if (h instanceof Error) return Promise.reject(new LlmError(h.message, { ...meta, status: "error" }));
      const data = opts.parse(h(opts as ToolCallOptions<unknown>));
      if (data === null) return Promise.reject(new LlmError(`${opts.agent}: fora do esquema`, { ...meta, status: "error" }));
      return Promise.resolve({ data, meta });
    },
  };
  return { llm, calls };
}

const input = (over: Partial<Parameters<typeof runQualityPipeline>[1]> = {}) => ({
  ctx: CTX, missing: 3, recent: [], topics: [], facts: [], lessons: [], ...over,
});

const approveAll = (n: number) => () => ({ revisoes: Array.from({ length: n }, (_, i) => ({ indice: i, aprovada: true })) });
const solveAll = (answers: number[]) => () => ({
  respostas: answers.map((escolha, i) => ({ indice: i, escolha, ambigua: false, confianca: 0.9, justificativa: "art. 37" })),
});

Deno.test("pipeline: consenso pleno aprova sem chamar o árbitro", async () => {
  const { llm, calls } = fakeLlm({
    elaborador: () => ({ questoes: [q(1), q(2), q(3)] }),
    revisor: approveAll(3),
    solucionador: solveAll([0, 0, 0]),
  });
  const out = await runQualityPipeline(llm, input(), MODELS, config());
  assertEquals(out.accepted.length, 3);
  assertEquals(out.stats.disputed, 0);
  assertEquals(calls.map((c) => c.agent).sort(), ["elaborador", "revisor", "solucionador"]);
  // O solucionador é cego: não recebe gabarito nem explicação.
  const solverUser = calls.find((c) => c.agent === "solucionador")!.user;
  assert(!solverUser.includes("Gabarito") && !solverUser.includes("Explicação"));
});

Deno.test("pipeline: divergência vai ao árbitro, que mantém uma e derruba outra", async () => {
  const { llm, calls } = fakeLlm({
    elaborador: () => ({ questoes: [q(1), q(2), q(3)] }),
    revisor: approveAll(3),
    solucionador: solveAll([0, 2, 1]), // #1 e #2 divergem do gabarito (0)
    arbitro: () => ({
      decisoes: [
        { indice: 0, manter: true, gabarito_correto: 0, unica_correta: true, motivo: "O art. 37 confirma o gabarito." },
        { indice: 1, manter: false, gabarito_correto: 1, unica_correta: true, motivo: "O enunciado descreve impessoalidade, não publicidade." },
      ],
    }),
  });
  const out = await runQualityPipeline(llm, input(), MODELS, config());
  assertEquals(out.accepted.map((x) => x.enunciado.split(":")[0]), ["Questão 1", "Questão 2"]);
  assertEquals(out.stats.disputed, 2);
  assertEquals(out.stats.keptByArbiter, 1);
  assertEquals(calls.find((c) => c.agent === "arbitro")?.model, "arb");
  assert(out.lessons.some((l) => l.source === "arbitro" && l.lesson.includes("impessoalidade")));
});

Deno.test("pipeline: sem tempo para o árbitro, as disputas são reprovadas (lado seguro)", async () => {
  const now = () => 1_000;
  const { llm, calls } = fakeLlm({
    elaborador: () => ({ questoes: [q(1), q(2)] }),
    revisor: approveAll(2),
    solucionador: solveAll([0, 3]),
  });
  const out = await runQualityPipeline(llm, input({ missing: 2 }), MODELS, config({ now, deadline: 10_000 }));
  assertEquals(out.accepted.length, 1);
  assertEquals(out.stats.rejectedUnarbitrated, 1);
  assert(!calls.some((c) => c.agent === "arbitro"));
});

Deno.test("pipeline: revisor reprova, portão determinístico barra e as lições são coletadas", async () => {
  const longKey = {
    ...q(9),
    alternativas: ["Publicidade, que impõe a divulgação oficial de todos os atos para conhecimento e controle", "B", "C", "D"],
  };
  const { llm } = fakeLlm({
    elaborador: () => ({ questoes: [q(1), q(2), longKey] }),
    revisor: () => ({ revisoes: [{ indice: 0, aprovada: true }, { indice: 1, aprovada: false, motivo: "Dado inventado: a lei não fixa prazo de 15 dias." }] }),
    solucionador: solveAll([0, 0]),
  });
  const out = await runQualityPipeline(llm, input(), MODELS, config());
  assertEquals(out.accepted.length, 1);
  assertEquals(out.stats.rejectedByValidator, 1);
  assertEquals(out.stats.rejectedByReviewer, 1);
  assert(out.lessons.some((l) => l.source === "revisor" && l.lesson.includes("15 dias")));
  assert(out.lessons.some((l) => l.source === "validador"));
});

Deno.test("pipeline: solucionador fora do ar degrada para o critério anterior (só revisor)", async () => {
  const { llm } = fakeLlm({
    elaborador: () => ({ questoes: [q(1), q(2)] }),
    revisor: approveAll(2),
    solucionador: new Error("indisponível"),
  });
  const out = await runQualityPipeline(llm, input({ missing: 2 }), MODELS, config());
  assertEquals(out.accepted.length, 2);
  assertEquals(out.stats.solversFailed, 1);
  assertEquals(out.stats.acceptedDegraded, 2);
});

Deno.test("pipeline: revisor fora do ar => nada é publicado (falha fechada)", async () => {
  const { llm } = fakeLlm({
    elaborador: () => ({ questoes: [q(1)] }),
    revisor: new Error("indisponível"),
    solucionador: solveAll([0]),
  });
  await assertRejects(() => runQualityPipeline(llm, input({ missing: 1 }), MODELS, config()), LlmError);
});

Deno.test("pipeline: modo clássico não chama solucionador nem árbitro", async () => {
  const { llm, calls } = fakeLlm({
    elaborador: () => ({ questoes: [q(1), q(2)] }),
    revisor: approveAll(2),
  });
  const out = await runQualityPipeline(llm, input({ missing: 2 }), MODELS, config({ mode: "classic" }));
  assertEquals(out.accepted.length, 2);
  assertEquals(out.stats.acceptedDegraded, 0);
  assertEquals(calls.map((c) => c.agent).sort(), ["elaborador", "revisor"]);
});

Deno.test("pipeline: lições da matéria chegam ao prompt do elaborador, cercadas", async () => {
  const { llm, calls } = fakeLlm({
    elaborador: () => ({ questoes: [q(1)] }),
    revisor: approveAll(1),
    solucionador: solveAll([0]),
  });
  await runQualityPipeline(llm, input({ missing: 1, lessons: ["Não cite a Lei 9.784/99 como municipal."] }), MODELS, config());
  const user = calls.find((c) => c.agent === "elaborador")!.user;
  assert(user.includes("<<<INICIO_LICOES_DA_MATERIA>>>"));
  assert(user.includes("Lei 9.784/99"));
});
