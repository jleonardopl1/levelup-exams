/**
 * Agentes do Radar de Concursos: papel, prompt versionado, ferramenta de saída
 * estruturada e parser que valida a saída (o parser devolve null = tentativa inválida).
 *
 *   Gerente master (código, index.ts/pipeline.ts)
 *     └─ Coordenador da área (1 por área de radar_areas)
 *          ├─ Batedor ............ triagem do trecho novo de uma fonte → candidatos por área
 *          ├─ Analista de edital . afirmações campo a campo, SEMPRE com evidência literal
 *          ├─ Verificador ........ outro modelo, confere cada afirmação contra a fonte
 *          ├─ Analista de banca .. perfil da banca (formato, estilo) p/ rascunho de trilha
 *          └─ Arquiteto de trilha  módulos, matérias e ementas a partir do edital
 *
 * Todo texto de página é DADO não confiável (cercado com fenceUntrusted). Nenhum agente
 * usa conhecimento próprio como fato: o que não estiver na fonte não entra.
 */
import { fenceUntrusted, UNTRUSTED_RULE } from "../_shared/ai/guardrails.ts";
import type { ToolSpec } from "../_shared/ai/llm.ts";
import {
  type Area,
  type Candidate,
  type Claim,
  CLAIM_FIELDS,
  type ClaimField,
  type ClaimVerdict,
  type CoordinatorDecision,
  ESFERAS,
  type Esfera,
} from "./types.ts";

export const PROMPT_VERSIONS = {
  batedor: "radar-batedor@2026-11-17",
  coordenador: "radar-coordenador@2026-11-17",
  analista_edital: "radar-analista-edital@2026-11-17",
  verificador: "radar-verificador@2026-11-17",
  analista_banca: "radar-analista-banca@2026-11-17",
  arquiteto_trilha: "radar-arquiteto-trilha@2026-11-17",
} as const;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

const NO_OUTSIDE_FACTS =
  "Use SOMENTE o que está escrito na fonte. Não complete com conhecimento próprio, não deduza datas nem números e não invente órgãos, cargos ou links.";

// ---------------------------------------------------------------------------
// 1. Batedor (triagem)
// ---------------------------------------------------------------------------

export const SCOUT_TOOL: ToolSpec = {
  name: "registrar_candidatos",
  description: "Registra os concursos/seleções mencionados no trecho novo da fonte.",
  parameters: {
    type: "object",
    properties: {
      candidatos: {
        type: "array",
        maxItems: 15,
        items: {
          type: "object",
          properties: {
            orgao: { type: "string", description: "Órgão/instituição do concurso, como escrito na fonte." },
            area: { type: "string", description: "Slug da área de estudo (lista do usuário)." },
            esfera: { type: "string", enum: [...ESFERAS, "desconhecida"] },
            uf: { type: "string", description: "Sigla da UF, ou vazio se não constar." },
            resumo: { type: "string", description: "O que a fonte diz de novo, em até 200 caracteres." },
            trecho: { type: "string", description: "Trecho LITERAL da fonte que menciona o concurso (30 a 300 caracteres)." },
            link: { type: "string", description: "Link da página do concurso, copiado da lista de links da fonte, ou vazio." },
          },
          required: ["orgao", "area", "esfera", "resumo", "trecho"],
        },
      },
    },
    required: ["candidatos"],
  },
};

export function parseScout(args: unknown, areaSlugs: Set<string>): Candidate[] | null {
  const raw = (args as { candidatos?: unknown })?.candidatos;
  if (!Array.isArray(raw)) return null;
  const out: Candidate[] = [];
  for (const r of raw.slice(0, 15)) {
    const o = r as Record<string, unknown>;
    const orgao = text(o.orgao, 160);
    const area = text(o.area, 40);
    const trecho = text(o.trecho, 300);
    if (orgao.length < 3 || trecho.length < 10) continue;
    const esfera = (ESFERAS as readonly string[]).includes(String(o.esfera)) ? (o.esfera as Esfera) : null;
    const uf = /^[A-Z]{2}$/.test(text(o.uf, 2).toUpperCase()) ? text(o.uf, 2).toUpperCase() : null;
    const link = /^https?:\/\//.test(text(o.link, 500)) ? text(o.link, 500) : null;
    out.push({ orgao, area: areaSlugs.has(area) ? area : "", esfera, uf, resumo: text(o.resumo, 200), trecho, link });
  }
  return out; // lista vazia é resposta válida ("nada relevante")
}

export function scoutPrompts(source: { name: string; url: string }, newText: string, links: { href: string; label: string }[], areas: Area[]) {
  const system = `Você é o BATEDOR do radar de concursos públicos de uma plataforma de estudos brasileira.
Recebe o trecho NOVO de uma página oficial (banca, órgão ou diário oficial) e lista os concursos públicos, seleções, vestibulares ou ENEM mencionados nele que interessam a candidatos (novo edital, autorização, banca definida, inscrições, retificação, datas de prova, resultados).
- Ignore notícias institucionais, processos de estágio, licitações e itens sem relação com seleção de candidatos.
- Classifique cada item numa área de estudo (slug) da lista do usuário; se nenhuma servir, use "administrativa".
- "trecho" deve ser cópia LITERAL da fonte; "link" só se estiver na lista de links fornecida.
- ${NO_OUTSIDE_FACTS}
- Se não houver nada relevante, devolva a lista vazia.
${UNTRUSTED_RULE}`;
  const areaList = areas.map((a) => `- ${a.slug}: ${a.name}`).join("\n");
  const linkList = links.slice(0, 120).map((l) => `${l.label || "(sem texto)"} -> ${l.href}`).join("\n");
  const user = `Fonte: ${source.name} (${source.url})
Áreas de estudo:
${areaList}

Trecho novo da fonte:
${fenceUntrusted("TRECHO_NOVO_DA_FONTE", newText, 30_000)}

Links da fonte:
${fenceUntrusted("LINKS_DA_FONTE", linkList, 15_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 2. Coordenador da área
// ---------------------------------------------------------------------------

export const COORDINATOR_TOOL: ToolSpec = {
  name: "decidir_candidatos",
  description: "Decide o que fazer com cada candidato da área.",
  parameters: {
    type: "object",
    properties: {
      decisoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: { type: "integer", minimum: 0 },
            acao: { type: "string", enum: ["atualizar", "novo", "ignorar"] },
            slug: { type: "string", description: "Slug do concurso já acompanhado (só em 'atualizar')." },
            prioridade: { type: "integer", minimum: 1, maximum: 5, description: "5 = maior demanda/urgência para os alunos." },
            motivo: { type: "string" },
          },
          required: ["indice", "acao", "prioridade", "motivo"],
        },
      },
    },
    required: ["decisoes"],
  },
};

export function parseCoordinator(args: unknown, count: number, slugs: Set<string>): CoordinatorDecision[] | null {
  const raw = (args as { decisoes?: unknown })?.decisoes;
  if (!Array.isArray(raw)) return null;
  const out: CoordinatorDecision[] = [];
  const seen = new Set<number>();
  for (const r of raw) {
    const o = r as Record<string, unknown>;
    const indice = Number(o.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= count || seen.has(indice)) continue;
    const acao = o.acao === "atualizar" || o.acao === "novo" || o.acao === "ignorar" ? o.acao : null;
    if (!acao) continue;
    const slug = text(o.slug, 80);
    seen.add(indice);
    out.push({
      indice,
      // "atualizar" sem slug conhecido vira "novo" (a deduplicação em código ainda confere).
      acao: acao === "atualizar" && !slugs.has(slug) ? "novo" : acao,
      slug: acao === "atualizar" && slugs.has(slug) ? slug : null,
      prioridade: Math.min(5, Math.max(1, Math.round(Number(o.prioridade) || 1))),
      motivo: text(o.motivo, 200),
    });
  }
  return out;
}

export function coordinatorPrompts(
  area: Area,
  candidates: Candidate[],
  existing: { slug: string; nome: string; orgao: string; uf: string | null; status: string }[],
) {
  const system = `Você é o COORDENADOR da área "${area.name}" no radar de concursos de uma plataforma de estudos.
Foco da área: ${area.focus}
Para cada candidato trazido pelo Batedor, decida:
- "atualizar": é um concurso que já acompanhamos (informe o slug exato da lista);
- "novo": é um concurso relevante que ainda não acompanhamos;
- "ignorar": irrelevante para candidatos da área, duplicado ou sem informação útil.
Dê prioridade 1–5 pela demanda (abrangência nacional/estadual, número de vagas, interesse típico de candidatos, urgência de prazos).
Decida só com base nos dados fornecidos. ${UNTRUSTED_RULE}`;
  const cand = candidates
    .map((c, i) => `#${i} órgão: ${c.orgao} | esfera: ${c.esfera ?? "?"} | UF: ${c.uf ?? "?"}\n   resumo: ${c.resumo}`)
    .join("\n");
  const known = existing.length
    ? existing.map((e) => `- ${e.slug}: ${e.nome} (${e.orgao}${e.uf ? `/${e.uf}` : ""}) — ${e.status}`).join("\n")
    : "(nenhum ainda)";
  const user = `Concursos já acompanhados na área:
${fenceUntrusted("CONCURSOS_ACOMPANHADOS", known, 12_000)}

Candidatos:
${fenceUntrusted("CANDIDATOS_DO_BATEDOR", cand, 12_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 3. Analista de edital (extração com evidência)
// ---------------------------------------------------------------------------

export const EXTRACT_TOOL: ToolSpec = {
  name: "registrar_afirmacoes",
  description: "Registra os dados do concurso encontrados na fonte, cada um com a evidência literal.",
  parameters: {
    type: "object",
    properties: {
      nome: { type: "string", description: "Nome curto do concurso, ex.: 'Polícia Federal 2026 — Agente e Escrivão'." },
      afirmacoes: {
        type: "array",
        maxItems: 14,
        items: {
          type: "object",
          properties: {
            campo: { type: "string", enum: [...CLAIM_FIELDS] },
            valor: {
              type: "string",
              description: "Datas em AAAA-MM-DD; números sem texto; cargos/escolaridade separados por ';'; status em um dos códigos indicados.",
            },
            evidencia: { type: "string", description: "Trecho LITERAL da fonte (copiado sem alterar) que comprova o valor." },
          },
          required: ["campo", "valor", "evidencia"],
        },
      },
    },
    required: ["nome", "afirmacoes"],
  },
};

export interface Extraction {
  nome: string;
  claims: Claim[];
}

export function parseExtraction(args: unknown): Extraction | null {
  const o = args as { nome?: unknown; afirmacoes?: unknown };
  if (!Array.isArray(o?.afirmacoes)) return null;
  const claims: Claim[] = [];
  for (const r of o.afirmacoes.slice(0, 14)) {
    const c = r as Record<string, unknown>;
    if (!CLAIM_FIELDS.includes(c.campo as ClaimField)) continue;
    const valor = typeof c.valor === "string" ? c.valor.trim().slice(0, 1200) : typeof c.valor === "number" ? String(c.valor) : "";
    const evidencia = typeof c.evidencia === "string" ? c.evidencia.trim().slice(0, 600) : "";
    if (!valor || !evidencia) continue;
    claims.push({ campo: c.campo as ClaimField, valor, evidencia });
  }
  return { nome: text(o.nome, 160), claims };
}

export function extractionPrompts(candidate: Candidate, sourceText: string, links: { href: string; label: string }[]) {
  const system = `Você é o ANALISTA DE EDITAL do radar de concursos. Extraia, da fonte oficial, os dados do concurso indicado, campo a campo.
Regras:
- Cada afirmação precisa de "evidencia": trecho copiado LITERALMENTE da fonte que comprova o valor. Sem evidência, não afirme.
- ${NO_OUTSIDE_FACTS}
- status (fase): previsto | autorizado | banca_definida | edital_publicado | inscricoes_abertas | inscricoes_encerradas | prova_aplicada | resultado_final | homologado | suspenso | cancelado. Hoje é ${today()}: inscrições com período em andamento = inscricoes_abertas.
- esfera: federal | estadual | distrital | municipal. escolaridade: fundamental; medio; superior.
- datas em AAAA-MM-DD; vagas = total de vagas imediatas (0 se só cadastro reserva); salario_max = maior remuneração inicial informada.
- link_oficial: só um link que esteja na lista de links da fonte.
- Afirme só sobre o concurso indicado; ignore outros concursos da mesma página.
${UNTRUSTED_RULE}`;
  const linkList = links.slice(0, 150).map((l) => `${l.label || "(sem texto)"} -> ${l.href}`).join("\n");
  const user = `Concurso indicado: ${candidate.orgao}${candidate.uf ? ` (${candidate.uf})` : ""}
Resumo do Batedor: ${candidate.resumo}

Fonte:
${fenceUntrusted("FONTE_OFICIAL", sourceText, 40_000)}

Links da fonte:
${fenceUntrusted("LINKS_DA_FONTE", linkList, 15_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 4. Verificador (independente; outro modelo)
// ---------------------------------------------------------------------------

export const VERIFY_TOOL: ToolSpec = {
  name: "registrar_verificacao",
  description: "Diz, para cada afirmação, se a fonte a sustenta.",
  parameters: {
    type: "object",
    properties: {
      verificacoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: { type: "integer", minimum: 0 },
            suportada: { type: "boolean" },
            motivo: { type: "string" },
          },
          required: ["indice", "suportada", "motivo"],
        },
      },
    },
    required: ["verificacoes"],
  },
};

/** Exige um veredito para TODAS as afirmações (veredito faltando = resposta inválida). */
export function parseVerification(args: unknown, count: number): ClaimVerdict[] | null {
  const raw = (args as { verificacoes?: unknown })?.verificacoes;
  if (!Array.isArray(raw)) return null;
  const byIndex = new Map<number, ClaimVerdict>();
  for (const r of raw) {
    const o = r as Record<string, unknown>;
    const indice = Number(o.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= count || typeof o.suportada !== "boolean") continue;
    byIndex.set(indice, { indice, suportada: o.suportada, motivo: text(o.motivo, 200) });
  }
  if (byIndex.size !== count) return null;
  return [...byIndex.values()].sort((a, b) => a.indice - b.indice);
}

export function verificationPrompts(orgao: string, claims: Claim[], sourceText: string) {
  const system = `Você é o VERIFICADOR independente do radar de concursos. Confira cada afirmação sobre o concurso de "${orgao}" CONTRA A FONTE.
- "suportada" = true só se a fonte afirma exatamente aquilo, para ESTE concurso (não para outro da mesma página), e a evidência citada está correta.
- Datas: confira dia, mês e a que evento se referem (início/fim de inscrição, prova). Números: confira o valor exato.
- Fase (status): a fonte precisa indicar essa fase hoje (${today()}).
- Na dúvida, false. Não use conhecimento próprio.
${UNTRUSTED_RULE}`;
  const list = claims.map((c, i) => `#${i} ${c.campo} = ${c.valor}\n   evidência citada: "${c.evidencia}"`).join("\n");
  const user = `Afirmações:
${fenceUntrusted("AFIRMACOES_A_VERIFICAR", list, 10_000)}

Fonte:
${fenceUntrusted("FONTE_OFICIAL", sourceText, 40_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 5. Analista de banca (perfil para a trilha)
// ---------------------------------------------------------------------------

export interface BancaProfile {
  formato: string;
  alternativas: number | null;
  penaliza_erro: boolean | null;
  caracteristicas: string[];
  dicas: string[];
}

export const BANCA_TOOL: ToolSpec = {
  name: "registrar_perfil_banca",
  description: "Perfil da banca organizadora para orientar o estudo.",
  parameters: {
    type: "object",
    properties: {
      formato: { type: "string", description: "Ex.: 'múltipla escolha, 5 alternativas' ou 'certo ou errado'." },
      alternativas: { type: "integer", description: "2 (certo/errado), 4 ou 5; 0 se não souber." },
      penaliza_erro: { type: "string", enum: ["sim", "nao", "desconhecido"] },
      caracteristicas: { type: "array", maxItems: 6, items: { type: "string" }, description: "Como a banca costuma cobrar (estilo, pegadinhas, foco)." },
      dicas: { type: "array", maxItems: 6, items: { type: "string" }, description: "Dicas práticas de estudo para esta banca." },
    },
    required: ["formato", "alternativas", "penaliza_erro", "caracteristicas", "dicas"],
  },
};

export function parseBancaProfile(args: unknown): BancaProfile | null {
  const o = args as Record<string, unknown>;
  if (!o || typeof o.formato !== "string") return null;
  const n = Number(o.alternativas);
  const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => text(x, 220)).filter(Boolean).slice(0, 6) : []);
  return {
    formato: text(o.formato, 120),
    alternativas: [2, 4, 5].includes(n) ? n : null,
    penaliza_erro: o.penaliza_erro === "sim" ? true : o.penaliza_erro === "nao" ? false : null,
    caracteristicas: arr(o.caracteristicas),
    dicas: arr(o.dicas),
  };
}

export function bancaPrompts(banca: string, editalText: string, previousTracks: string) {
  const system = `Você é o ANALISTA DE BANCA de uma plataforma de estudos para concursos. Descreva o perfil da banca "${banca}" para orientar o estudo.
- Formato de prova e penalidade por erro: priorize o que o EDITAL fornecido diz; só use conhecimento geral sobre a banca se o edital não disser, e nesse caso trate como orientação, nunca como regra.
- Características e dicas: estilo de cobrança, tipos de pegadinha, peso de lei seca × jurisprudência × interpretação, gestão de tempo.
- Seja específico e prático; nada de generalidades ("estude muito").
${UNTRUSTED_RULE}`;
  const user = `Trilhas anteriores da mesma banca/órgão na plataforma (histórico):
${fenceUntrusted("HISTORICO_DE_TRILHAS", previousTracks || "(nenhuma)", 8_000)}

Edital (trechos):
${fenceUntrusted("EDITAL", editalText, 30_000)}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// 6. Arquiteto de trilha
// ---------------------------------------------------------------------------

export interface DraftSubject {
  nome: string;
  area: string;
  cargo: string | null;
  ementa: string;
  dicas: string;
  legislacao_local: boolean;
}

export interface DraftModule {
  nome: string;
  nivel: "medio" | "superior";
  cargos: string[];
  estrutura: { area: string; questoes: number; pontos_por_questao: number; disciplinas: string[] }[];
  materias: DraftSubject[];
}

export interface TrackArchitecture {
  nome: string;
  nome_curto: string;
  descricao: string;
  regras: { prova_objetiva: string; aprovacao: string; discursiva: string; titulos: string; desempate: string };
  cronograma: { data: string; evento: string; evidencia: string }[];
  modulos: DraftModule[];
}

export const TRACK_TOOL: ToolSpec = {
  name: "registrar_trilha",
  description: "Estrutura da trilha de estudos montada a partir do edital.",
  parameters: {
    type: "object",
    properties: {
      nome: { type: "string" },
      nome_curto: { type: "string", description: "Até 40 caracteres, ex.: 'PF 2026 — Agente'." },
      descricao: { type: "string" },
      regras: {
        type: "object",
        properties: {
          prova_objetiva: { type: "string" },
          aprovacao: { type: "string" },
          discursiva: { type: "string" },
          titulos: { type: "string" },
          desempate: { type: "string" },
        },
      },
      cronograma: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            data: { type: "string", description: "AAAA-MM-DD" },
            evento: { type: "string" },
            evidencia: { type: "string", description: "Trecho literal do edital com a data." },
          },
          required: ["data", "evento", "evidencia"],
        },
      },
      modulos: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            nivel: { type: "string", enum: ["medio", "superior"] },
            cargos: { type: "array", items: { type: "string" } },
            estrutura: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string" },
                  questoes: { type: "integer" },
                  pontos_por_questao: { type: "number" },
                  disciplinas: { type: "array", items: { type: "string" } },
                },
                required: ["area", "questoes", "pontos_por_questao", "disciplinas"],
              },
            },
            materias: {
              type: "array",
              maxItems: 25,
              items: {
                type: "object",
                properties: {
                  nome: { type: "string" },
                  area: { type: "string", description: "Área do quadro de provas (deve existir em 'estrutura')." },
                  cargo: { type: "string", description: "Cargo, se for específica de um cargo; vazio se comum." },
                  ementa: { type: "string", description: "Conteúdo programático COPIADO do edital para esta matéria." },
                  dicas: { type: "string", description: "Como estudar e o que a banca mais cobra nesta matéria." },
                  legislacao_local: { type: "boolean", description: "true para leis municipais/estaduais específicas do órgão." },
                },
                required: ["nome", "area", "ementa", "dicas", "legislacao_local"],
              },
            },
          },
          required: ["nome", "nivel", "cargos", "estrutura", "materias"],
        },
      },
    },
    required: ["nome", "nome_curto", "descricao", "regras", "cronograma", "modulos"],
  },
};

export function parseTrackArchitecture(args: unknown): TrackArchitecture | null {
  const o = args as Record<string, unknown>;
  if (!o || !Array.isArray(o.modulos) || !o.modulos.length) return null;
  const regras = (o.regras ?? {}) as Record<string, unknown>;
  const modulos: DraftModule[] = [];
  for (const m0 of o.modulos.slice(0, 4)) {
    const m = m0 as Record<string, unknown>;
    if (m.nivel !== "medio" && m.nivel !== "superior") continue;
    const estrutura = (Array.isArray(m.estrutura) ? m.estrutura : []).slice(0, 8).map((e0) => {
      const e = e0 as Record<string, unknown>;
      return {
        area: text(e.area, 80),
        questoes: Math.max(0, Math.min(300, Math.round(Number(e.questoes) || 0))),
        pontos_por_questao: Math.max(0, Math.min(20, Number(e.pontos_por_questao) || 0)),
        disciplinas: Array.isArray(e.disciplinas) ? e.disciplinas.map((d) => text(d, 120)).filter(Boolean).slice(0, 30) : [],
      };
    }).filter((e) => e.area);
    const materias = (Array.isArray(m.materias) ? m.materias : []).slice(0, 25).map((s0) => {
      const s = s0 as Record<string, unknown>;
      return {
        nome: text(s.nome, 140),
        area: text(s.area, 80),
        cargo: text(s.cargo, 140) || null,
        ementa: typeof s.ementa === "string" ? s.ementa.replace(/[ \t]+/g, " ").trim().slice(0, 6000) : "",
        dicas: text(s.dicas, 1500),
        legislacao_local: s.legislacao_local === true,
      };
    }).filter((s) => s.nome && s.ementa);
    modulos.push({
      nome: text(m.nome, 100),
      nivel: m.nivel,
      cargos: Array.isArray(m.cargos) ? m.cargos.map((c) => text(c, 140)).filter(Boolean).slice(0, 40) : [],
      estrutura,
      materias,
    });
  }
  if (!modulos.length) return null;
  const cronograma = (Array.isArray(o.cronograma) ? o.cronograma : []).slice(0, 12).map((c0) => {
    const c = c0 as Record<string, unknown>;
    return { data: text(c.data, 10), evento: text(c.evento, 120), evidencia: text(c.evidencia, 300) };
  });
  return {
    nome: text(o.nome, 160),
    nome_curto: text(o.nome_curto, 60),
    descricao: text(o.descricao, 600),
    regras: {
      prova_objetiva: text(regras.prova_objetiva, 600),
      aprovacao: text(regras.aprovacao, 600),
      discursiva: text(regras.discursiva, 600),
      titulos: text(regras.titulos, 400),
      desempate: text(regras.desempate, 400),
    },
    cronograma,
    modulos,
  };
}

export function trackPrompts(concurso: { nome: string; orgao: string; banca: string | null }, editalText: string, previousTracks: string) {
  const system = `Você é o ARQUITETO DE TRILHAS de uma plataforma de estudos para concursos. Monte a trilha do concurso "${concurso.nome}" (${concurso.orgao}${concurso.banca ? `, banca ${concurso.banca}` : ""}) a partir do EDITAL fornecido.
Regras:
- Módulos por nível de escolaridade (médio/superior) presentes no edital; cargos de cada módulo como no edital.
- "estrutura" = quadro de provas do edital (área, nº de questões, pontos por questão, disciplinas). Não invente números: se o edital não trouxer, deixe a lista vazia.
- Uma matéria por disciplina do conteúdo programático; "ementa" é o conteúdo programático COPIADO do edital (literal). Matérias específicas de um cargo levam o nome do cargo em "cargo".
- legislacao_local = true para leis orgânicas, regimentos, estatutos e leis específicas do órgão/município/estado.
- "dicas": como estudar a matéria para esta banca (estratégia; sem afirmar fatos que não estejam no edital).
- cronograma: só datas que constam do edital, com a evidência literal.
- Regras (aprovação, discursiva, títulos, desempate): resuma o que o edital diz; vazio se não disser.
${UNTRUSTED_RULE}`;
  const user = `Trilhas anteriores do mesmo órgão/banca (editais anteriores na plataforma):
${fenceUntrusted("HISTORICO_DE_TRILHAS", previousTracks || "(nenhuma)", 8_000)}

Edital:
${fenceUntrusted("EDITAL", editalText, 90_000)}`;
  return { system, user };
}
