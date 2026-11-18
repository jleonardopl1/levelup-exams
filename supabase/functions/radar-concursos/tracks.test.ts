import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { type LlmClient, LlmError, type ToolCallOptions } from "../_shared/ai/llm.ts";
import { parseTrackArchitecture } from "./agents.ts";
import { norm } from "./evidence.ts";
import { buildDraft, runTrackDraft, syllabusSupport } from "./tracks.ts";

const EDITAL = `EDITAL Nº 1/2026 — CÂMARA MUNICIPAL DE EXEMPLO
Das provas: Conhecimentos Básicos, 30 questões de 1 ponto; Conhecimentos Específicos, 20 questões de 2 pontos.
Inscrições de 01/12/2026 a 20/12/2026. A prova objetiva será aplicada em 15/02/2027.
ANEXO — CONTEÚDO PROGRAMÁTICO
LÍNGUA PORTUGUESA: Compreensão e interpretação de textos. Ortografia oficial. Acentuação gráfica. Concordância verbal e nominal.
LEGISLAÇÃO: Lei Orgânica do Município de Exemplo. Regimento Interno da Câmara Municipal de Exemplo.
NOÇÕES DE INFORMÁTICA: Sistema operacional Windows. Editores de texto e planilhas eletrônicas.`;

const ARCH = {
  nome: "Câmara de Exemplo 2026",
  nome_curto: "Câmara de Exemplo",
  descricao: "Trilha do concurso.",
  regras: { prova_objetiva: "50 questões.", aprovacao: "", discursiva: "", titulos: "", desempate: "" },
  cronograma: [
    { data: "2027-02-15", evento: "Prova objetiva", evidencia: "A prova objetiva será aplicada em 15/02/2027." },
    { data: "2027-03-01", evento: "Resultado", evidencia: "Resultado em 01/03/2027" },
  ],
  modulos: [{
    nome: "Nível Médio",
    nivel: "medio",
    cargos: ["Assistente Legislativo"],
    estrutura: [
      { area: "Conhecimentos Básicos", questoes: 30, pontos_por_questao: 1, disciplinas: ["Língua Portuguesa", "Informática"] },
      { area: "Conhecimentos Específicos", questoes: 20, pontos_por_questao: 2, disciplinas: ["Legislação"] },
    ],
    materias: [
      { nome: "Língua Portuguesa", area: "Conhecimentos Básicos", ementa: "Compreensão e interpretação de textos. Ortografia oficial. Acentuação gráfica. Concordância verbal e nominal.", dicas: "Leia muito.", legislacao_local: false },
      { nome: "Legislação Municipal", area: "Conhecimentos Específicos", ementa: "Lei Orgânica do Município de Exemplo. Regimento Interno da Câmara Municipal de Exemplo.", dicas: "Lei seca.", legislacao_local: true },
      // Inventada: não está no edital.
      { nome: "Direito Tributário", area: "Conhecimentos Específicos", ementa: "Sistema Tributário Nacional e competências tributárias. Impostos municipais e taxas.", dicas: "x", legislacao_local: false },
    ],
  }],
};

const CONCURSO = { slug: "camara-exemplo-2026", nome: "Câmara de Exemplo 2026", orgao: "Câmara Municipal de Exemplo", banca: "Selecon", data_prova: "2027-02-15", link_oficial: null };

Deno.test("syllabusSupport mede quanto da ementa está no edital", () => {
  assertEquals(syllabusSupport("Compreensão e interpretação de textos. Ortografia oficial.", norm(EDITAL)), 1);
  assertEquals(syllabusSupport("Sistema Tributário Nacional e competências tributárias.", norm(EDITAL)), 0);
});

Deno.test("buildDraft: descarta matéria e data sem lastro no edital; legislação local sem geração automática", () => {
  const arch = parseTrackArchitecture(ARCH)!;
  const { draft, warnings } = buildDraft(arch, null, CONCURSO, EDITAL);
  const subjects = draft.modules[0].subjects;
  assertEquals(subjects.map((s) => s.name), ["Língua Portuguesa", "Legislação Municipal"]);
  assertEquals(subjects[0].weekly_target, 21);
  assertEquals(subjects[1].weekly_target, 0);
  assertEquals(subjects[1].ai_grounded_only, true);
  assertEquals(subjects[0].slug, "camara-exemplo-2026-lingua-portuguesa");
  assertEquals(draft.rules.cronograma, [{ data: "2027-02-15", evento: "Prova objetiva" }]);
  assertEquals(draft.modules[0].structure.length, 2);
  assert(warnings.some((w) => w.includes("Direito Tributário")));
  assert(warnings.some((w) => w.includes("Resultado")));
});

function fakeLlm(handlers: Record<string, unknown | Error>): LlmClient {
  return {
    callTool<T>(opts: ToolCallOptions<T>) {
      const meta = { agent: opts.agent, model: opts.model, promptVersion: opts.promptVersion, status: "ok" as const, attempts: 1, latencyMs: 1, inputTokens: 1, outputTokens: 1 };
      const h = handlers[opts.agent];
      if (h === undefined || h instanceof Error) return Promise.reject(new LlmError("falhou", { ...meta, status: "error" }));
      const data = opts.parse(h);
      return data === null ? Promise.reject(new LlmError("esquema", { ...meta, status: "error" })) : Promise.resolve({ data, meta });
    },
  };
}

Deno.test("runTrackDraft: arquiteto ∥ analista de banca; perfil entra nas regras", async () => {
  const llm = fakeLlm({
    "arquiteto-trilha": ARCH,
    "analista-banca": { formato: "múltipla escolha, 4 alternativas", alternativas: 4, penaliza_erro: "nao", caracteristicas: ["Cobra lei seca"], dicas: ["Treine lei seca."] },
  });
  const r = await runTrackDraft(llm, { concurso: CONCURSO, editalText: EDITAL, previousTracks: "" }, { architect: "pro", banca: "pro" }, Date.now() + 60_000);
  assertEquals(r.error, null);
  assertEquals((r.draft?.rules.perfil_banca as { alternativas: number }).alternativas, 4);
  assert(r.draft!.modules[0].subjects[0].study_tips.includes("Treine lei seca."));
});

Deno.test("runTrackDraft: sem arquiteto não há rascunho (falha fechada)", async () => {
  const r = await runTrackDraft(fakeLlm({ "arquiteto-trilha": new Error("x") }), { concurso: CONCURSO, editalText: EDITAL, previousTracks: "" }, { architect: "pro", banca: "pro" }, Date.now() + 60_000);
  assertEquals(r.draft, null);
  assert(r.error);
});
