/**
 * Os quatro agentes da fábrica de questões: papel, prompt (versionado), ferramenta de
 * saída estruturada e o parser que valida a saída. Orquestração em pipeline.ts.
 *
 *   Elaborador ──► portão determinístico ──► ┌ Solucionador(es) cego(s) ┐ ──► consenso ──► Árbitro (só disputas)
 *                                            └ Revisor técnico          ┘   (quality.ts)
 *
 * Padrões aplicados (docs/ARQUITETURA_MULTIAGENTE.md §5.3): especialização de papéis
 * (TradingAgents/MetaGPT), avaliações independentes em paralelo e verificação cega
 * (decorrelação de erros; multiagent debate — Du et al., ICML 2024), árbitro com
 * modelo mais forte só onde há divergência (gerente "deep" do TradingAgents) e memória
 * de lições por matéria (reflexão — Reflexion / memory log do TradingAgents).
 */
import { fenceUntrusted, UNTRUSTED_RULE } from "../_shared/ai/guardrails.ts";
import type { ToolSpec } from "../_shared/ai/llm.ts";
import { letter, validateQuestion } from "./quality.ts";
import type { ArbiterVerdict, GeneratedQuestion, ReviewVerdict, SolverVote, SubjectContext } from "./types.ts";

export const PROMPT_VERSIONS = {
  elaborador: "elaborador@2026-11-16",
  solucionador: "solucionador@2026-11-16",
  revisor: "revisor@2026-11-16",
  arbitro: "arbitro@2026-11-16",
} as const;

export function todayInCuiaba(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Cuiaba" });
}

const clamp01 = (n: unknown) => Math.min(1, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0));
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const idx = (v: unknown): number | null => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3 ? (v as number) : null);

/** Fatos verificados (explicações das questões autorais) como bloco de referência. */
function factsBlock(facts: string[]): string {
  return fenceUntrusted("FATOS_VERIFICADOS", `- ${facts.join("\n- ")}`, 80_000);
}

function questionList(questions: GeneratedQuestion[], withKey: boolean): string {
  return questions
    .map((q, i) =>
      `#${i}\nEnunciado: ${q.enunciado}\n${q.alternativas.map((a, k) => `${"ABCD"[k]}) ${a}`).join("\n")}` +
      (withKey ? `\nGabarito: ${"ABCD"[q.correta]}\nExplicação: ${q.explicacao}` : "")
    )
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// 1. Elaborador
// ---------------------------------------------------------------------------

export const GENERATION_TOOL: ToolSpec = {
  name: "salvar_questoes",
  description: "Registra as questões inéditas geradas.",
  parameters: {
    type: "object",
    properties: {
      questoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topico: { type: "string", description: "Tópico do edital coberto." },
            dificuldade: { type: "string", enum: ["Fácil", "Médio", "Difícil"] },
            nivel: { type: "string", enum: ["ambos", "medio", "superior"] },
            enunciado: { type: "string" },
            alternativas: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            correta: { type: "integer", minimum: 0, maximum: 3, description: "Índice (0 a 3) da única alternativa correta." },
            explicacao: {
              type: "string",
              description: "Justificativa didática com o fundamento (artigo de lei, conceito, cálculo) e por que as demais estão erradas, citando o CONTEÚDO de cada alternativa, nunca a letra.",
            },
          },
          required: ["topico", "dificuldade", "nivel", "enunciado", "alternativas", "correta", "explicacao"],
        },
      },
    },
    required: ["questoes"],
  },
};

/** Aceita a resposta se ao menos uma questão passar no esquema (as inválidas são descartadas). */
export function parseGenerated(args: unknown): GeneratedQuestion[] | null {
  const list = (args as { questoes?: unknown })?.questoes;
  if (!Array.isArray(list)) return null;
  const valid = list.map(validateQuestion).filter((q): q is GeneratedQuestion => q !== null);
  return valid.length ? valid : null;
}

export function generationPrompts(
  ctx: SubjectContext,
  count: number,
  recent: string[],
  topics: string[],
  facts: string[],
  lessons: string[],
) {
  const today = todayInCuiaba();
  const system = `Você é um elaborador sênior de questões de concursos públicos brasileiros, especialista na banca ${ctx.banca}.
Regras obrigatórias:
- Questões INÉDITAS, de múltipla escolha, com exatamente 4 alternativas e UMA única correta, no estilo da banca (enunciados contextualizados, distratores plausíveis, sem "todas/nenhuma das anteriores").
- Conteúdo estritamente dentro da ementa do edital informada e de acordo com a legislação, a jurisprudência e o entendimento técnico VIGENTES em ${today}.
- Nunca invente números de artigos, prazos, percentuais ou nomes. Se não tiver certeza absoluta de um dado, não o use.
- A explicação deve citar o fundamento (artigo, norma, conceito ou cálculo) e dizer por que as demais alternativas estão erradas, referindo-se a elas pelo CONTEÚDO — nunca pela letra (as alternativas serão embaralhadas).
- Sem pistas: a alternativa correta não pode ser sistematicamente a mais longa nem repetir palavras do enunciado; os distratores devem ter tamanho e estrutura semelhantes.
- Português formal, norma-padrão, sem marcas de formatação.
- Não repita nem parafraseie questões já existentes listadas pelo usuário.
${UNTRUSTED_RULE}`;

  const modules = ctx.modules
    .map((m) => `Nível ${m.nivel === "medio" ? "MÉDIO" : "SUPERIOR"} (${m.area}${m.cargo ? ` — ${m.cargo}` : ""}):\n${m.syllabus}`)
    .join("\n\n");
  const nivelRule = ctx.modules.length > 1
    ? `A matéria é cobrada em mais de um nível. Use nivel="ambos" quando o tópico constar da ementa de todos os níveis; use o nível específico ("medio" ou "superior") quando o tópico só existir na ementa daquele nível.`
    : `Use nivel="ambos".`;
  const grounded = ctx.grounded
    ? `\n\nATENÇÃO: esta matéria é de LEGISLAÇÃO LOCAL. Use EXCLUSIVAMENTE os fatos verificados abaixo (pode combiná-los, inverter o ângulo de cobrança ou criar situações-problema com eles), sem acrescentar nenhum dado externo:\n${factsBlock(facts)}`
    : facts.length
      ? `\n\nBase de referência já validada (use para manter a precisão; não copie):\n${fenceUntrusted("BASE_DE_REFERENCIA", `- ${facts.slice(0, 15).join("\n- ")}`)}`
      : "";
  const memory = lessons.length
    ? `\n\nLições desta matéria — erros que o revisor e o árbitro já reprovaram em rodadas anteriores. NÃO os repita:\n${fenceUntrusted("LICOES_DA_MATERIA", `- ${lessons.join("\n- ")}`)}`
    : "";

  const user = `Concurso: ${ctx.trackName}
Matéria: ${ctx.name}

Ementa do edital:
${modules}

${nivelRule}

Tópicos já cobertos (priorize os pouco explorados da ementa): ${topics.slice(0, 60).join("; ") || "nenhum"}

Enunciados recentes que NÃO podem ser repetidos:
${recent.map((r) => `- ${r}`).join("\n") || "- (nenhum)"}${grounded}${memory}

Gere ${count} questões inéditas, variando tópicos e dificuldade (pelo menos uma "Difícil"), e registre-as com a ferramenta salvar_questoes.`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 2. Solucionador cego — resolve sem ver gabarito nem explicação
// ---------------------------------------------------------------------------

export const SOLVER_TOOL: ToolSpec = {
  name: "registrar_respostas",
  description: "Registra a resposta do candidato para cada questão.",
  parameters: {
    type: "object",
    properties: {
      respostas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: { type: "integer", description: "Número da questão (#)." },
            escolha: { type: "integer", minimum: -1, maximum: 3, description: "0=A, 1=B, 2=C, 3=D; -1 se nenhuma estiver correta." },
            ambigua: { type: "boolean", description: "true se mais de uma alternativa for defensável ou nenhuma for correta." },
            confianca: { type: "number", minimum: 0, maximum: 1 },
            justificativa: { type: "string", description: "Fundamento em uma ou duas frases." },
          },
          required: ["indice", "escolha", "ambigua", "confianca", "justificativa"],
        },
      },
    },
    required: ["respostas"],
  },
};

export function parseSolver(count: number) {
  return (args: unknown): Map<number, SolverVote> | null => {
    const list = (args as { respostas?: unknown })?.respostas;
    if (!Array.isArray(list)) return null;
    const out = new Map<number, SolverVote>();
    for (const r of list as Record<string, unknown>[]) {
      if (!Number.isInteger(r?.indice) || (r.indice as number) < 0 || (r.indice as number) >= count) continue;
      out.set(r.indice as number, {
        indice: r.indice as number,
        escolha: idx(r.escolha),
        ambigua: r.ambigua === true || idx(r.escolha) === null,
        confianca: clamp01(r.confianca),
        justificativa: text(r.justificativa, 300),
      });
    }
    return out.size ? out : null;
  };
}

export function solverPrompts(ctx: SubjectContext, questions: GeneratedQuestion[], facts: string[]) {
  const system = `Você é um candidato muito bem preparado, especialista na banca ${ctx.banca}, resolvendo questões de ${ctx.name}.
Não há gabarito: resolva cada questão por conta própria, com base na legislação e no conhecimento técnico vigentes.
Escolha a ÚNICA alternativa correta. Se mais de uma for defensável, ou nenhuma estiver correta, marque ambigua=true.
Seja honesto na confiança. ${UNTRUSTED_RULE}`;
  const reference = ctx.grounded
    ? `Fatos verificados de legislação local (a resposta deve se apoiar neles):\n${factsBlock(facts)}\n\n`
    : "";
  const user = `${reference}Resolva e registre com a ferramenta registrar_respostas:\n\n${fenceUntrusted("QUESTOES", questionList(questions, false), 60_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 3. Revisor técnico — vê o gabarito e a explicação
// ---------------------------------------------------------------------------

export const REVIEW_TOOL: ToolSpec = {
  name: "registrar_revisao",
  description: "Registra o veredito do revisor para cada questão.",
  parameters: {
    type: "object",
    properties: {
      revisoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: { type: "integer" },
            aprovada: { type: "boolean" },
            motivo: { type: "string", description: "Se reprovada: o erro concreto, em uma frase que sirva de lição para o elaborador." },
          },
          required: ["indice", "aprovada"],
        },
      },
    },
    required: ["revisoes"],
  },
};

export function parseReview(count: number) {
  return (args: unknown): Map<number, ReviewVerdict> | null => {
    const list = (args as { revisoes?: unknown })?.revisoes;
    if (!Array.isArray(list)) return null;
    const out = new Map<number, ReviewVerdict>();
    for (const r of list as Record<string, unknown>[]) {
      if (!Number.isInteger(r?.indice) || (r.indice as number) < 0 || (r.indice as number) >= count) continue;
      out.set(r.indice as number, { indice: r.indice as number, aprovada: r.aprovada === true, motivo: text(r.motivo, 300) });
    }
    return out.size ? out : null;
  };
}

export function reviewPrompts(ctx: SubjectContext, questions: GeneratedQuestion[], facts: string[]) {
  const system = `Você é um revisor técnico rigoroso de questões de concurso (${ctx.banca}). Reprove qualquer questão com: gabarito errado; mais de uma alternativa defensável; nenhuma correta; dado factual duvidoso, desatualizado ou inventado (artigos, prazos, percentuais); conteúdo fora da ementa; explicação que não sustenta o gabarito ou que cita alternativas pela letra; pista que entregue a resposta. Na dúvida, reprove. No motivo, escreva o erro concreto em uma frase. ${UNTRUSTED_RULE}`;
  const grounded = ctx.grounded
    ? `\nFatos verificados permitidos (qualquer dado fora desta lista implica reprovação):\n${factsBlock(facts)}`
    : "";
  const user = `Matéria: ${ctx.name}${grounded}\n\nRevise cada questão e registre o veredito com a ferramenta registrar_revisao:\n\n${fenceUntrusted("QUESTOES", questionList(questions, true), 60_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 4. Árbitro — só para as questões em que os agentes divergiram
// ---------------------------------------------------------------------------

export const ARBITER_TOOL: ToolSpec = {
  name: "registrar_arbitragem",
  description: "Registra a decisão final sobre cada questão em disputa.",
  parameters: {
    type: "object",
    properties: {
      decisoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: { type: "integer" },
            manter: { type: "boolean", description: "true só se a questão estiver correta e sem ambiguidade, com o gabarito informado." },
            gabarito_correto: { type: "integer", minimum: -1, maximum: 3, description: "0=A … 3=D; -1 se nenhuma estiver correta." },
            unica_correta: { type: "boolean" },
            motivo: { type: "string", description: "Fundamento da decisão em uma frase." },
          },
          required: ["indice", "manter", "gabarito_correto", "unica_correta", "motivo"],
        },
      },
    },
    required: ["decisoes"],
  },
};

export function parseArbiter(count: number) {
  return (args: unknown): Map<number, ArbiterVerdict> | null => {
    const list = (args as { decisoes?: unknown })?.decisoes;
    if (!Array.isArray(list)) return null;
    const out = new Map<number, ArbiterVerdict>();
    for (const r of list as Record<string, unknown>[]) {
      if (!Number.isInteger(r?.indice) || (r.indice as number) < 0 || (r.indice as number) >= count) continue;
      out.set(r.indice as number, {
        indice: r.indice as number,
        manter: r.manter === true,
        gabaritoCorreto: idx(r.gabarito_correto),
        unicaCorreta: r.unica_correta === true,
        motivo: text(r.motivo, 300),
      });
    }
    return out.size ? out : null;
  };
}

export function arbiterPrompts(
  ctx: SubjectContext,
  disputes: { question: GeneratedQuestion; reasons: string[] }[],
  facts: string[],
) {
  const system = `Você preside a comissão revisora de questões da banca ${ctx.banca}. Avaliações independentes divergiram sobre as questões abaixo: um candidato que resolveu sem gabarito chegou a outra resposta ou apontou ambiguidade, enquanto o revisor aprovou.
Decida com base na legislação e no conhecimento técnico VIGENTES em ${todayInCuiaba()}. Mantenha a questão SOMENTE se o gabarito informado estiver correto, for a única alternativa correta e a explicação o sustentar. Na dúvida, não mantenha. ${UNTRUSTED_RULE}`;
  const grounded = ctx.grounded
    ? `Fatos verificados de legislação local (qualquer dado fora desta lista implica não manter):\n${factsBlock(facts)}\n\n`
    : "";
  const list = disputes
    .map((d, i) =>
      `#${i}\nEnunciado: ${d.question.enunciado}\n${d.question.alternativas.map((a, k) => `${"ABCD"[k]}) ${a}`).join("\n")}` +
      `\nGabarito informado: ${letter(d.question.correta)}\nExplicação: ${d.question.explicacao}` +
      `\nDivergências: ${d.reasons.join(" | ")}`
    )
    .join("\n\n");
  const user = `Matéria: ${ctx.name}\n\n${grounded}Decida cada disputa com a ferramenta registrar_arbitragem:\n\n${fenceUntrusted("DISPUTAS", list, 60_000)}`;
  return { system, user };
}
