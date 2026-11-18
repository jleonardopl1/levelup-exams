/**
 * Rascunho de trilha a partir do edital: Analista de banca ∥ Arquiteto de trilha, e um
 * portão determinístico que só deixa passar ementas e datas que estão no edital.
 * O rascunho NUNCA vira trilha sozinho: um admin revisa e publica (radar_publish_track_draft).
 */
import type { LlmClient } from "../_shared/ai/llm.ts";
import {
  BANCA_TOOL,
  bancaPrompts,
  type BancaProfile,
  parseBancaProfile,
  parseTrackArchitecture,
  PROMPT_VERSIONS,
  TRACK_TOOL,
  type TrackArchitecture,
  trackPrompts,
} from "./agents.ts";
import { dateInEvidence, evidenceInSource, norm, slugify } from "./evidence.ts";

export interface DraftConcurso {
  slug: string;
  nome: string;
  orgao: string;
  banca: string | null;
  data_prova: string | null;
  link_oficial: string | null;
}

export interface TrackDraft {
  slug: string;
  name: string;
  short_name: string;
  organ: string;
  banca: string;
  exam_date: string | null;
  edital_url: string | null;
  description: string;
  rules: Record<string, unknown>;
  modules: {
    slug: string;
    name: string;
    nivel: "medio" | "superior";
    description: string;
    cargos: string[];
    structure: { area: string; questoes: number; pontos_por_questao: number; disciplinas: string[] }[];
    subjects: {
      slug: string;
      name: string;
      icon: string;
      area: string;
      cargo: string | null;
      syllabus: string;
      study_tips: string;
      weekly_target: number;
      ai_grounded_only: boolean;
    }[];
  }[];
}

/** Fração de trechos da ementa que aparecem literalmente no edital. */
export function syllabusSupport(ementa: string, normalizedEdital: string): number {
  const chunks = ementa.split(/[.;:\n]+/).map((c) => norm(c)).filter((c) => c.length >= 15);
  if (!chunks.length) return evidenceInSource(ementa, normalizedEdital) ? 1 : 0;
  return chunks.filter((c) => normalizedEdital.includes(c)).length / chunks.length;
}

const ICONS: [RegExp, string][] = [
  [/portugues|redacao|lingua/, "book-open"],
  [/raciocinio|matematic|estatistic/, "brain"],
  [/informatica|tecnologia|computa|dados/, "monitor"],
  [/direito|legisla|lei |estatuto|regimento|constitu/, "scroll"],
  [/contab|financ|orcament|economi/, "calculator"],
  [/historia|geografia|atualidade/, "leaf"],
  [/saude|enfermag|medic/, "heart-pulse"],
];

function iconFor(name: string): string {
  const n = norm(name);
  return ICONS.find(([re]) => re.test(n))?.[1] ?? "book-open";
}

/** Converte a arquitetura do modelo em rascunho publicável, aplicando o portão. */
export function buildDraft(
  arch: TrackArchitecture,
  profile: BancaProfile | null,
  concurso: DraftConcurso,
  editalText: string,
): { draft: TrackDraft; warnings: string[] } {
  const warnings: string[] = [];
  const edital = norm(editalText);
  const trackSlug = concurso.slug.slice(0, 60);
  const usedSlugs = new Set<string>();
  const bancaTip = profile?.dicas?.length ? `\n\nPerfil da banca: ${profile.dicas.slice(0, 2).join(" ")}` : "";

  const modules = arch.modulos.map((m) => {
    const areas = new Set(m.estrutura.map((e) => norm(e.area)));
    const subjects = [];
    for (const s of m.materias) {
      const support = syllabusSupport(s.ementa, edital);
      if (support < 0.5) {
        warnings.push(`Matéria "${s.nome}" (${m.nivel}) descartada: ementa não confere com o edital (${Math.round(support * 100)}%).`);
        continue;
      }
      if (areas.size && !areas.has(norm(s.area))) warnings.push(`Matéria "${s.nome}": área "${s.area}" não está no quadro de provas.`);
      let slug = `${trackSlug}-${slugify(s.cargo ? `${s.cargo}-${s.nome}` : s.nome, 50)}`.slice(0, 100);
      if (usedSlugs.has(slug)) slug = `${slug}-${m.nivel}`;
      if (usedSlugs.has(slug)) continue;
      usedSlugs.add(slug);
      if (s.legislacao_local) {
        warnings.push(`"${s.nome}" é legislação local: geração automática desligada até a equipe cadastrar questões autorais (fatos verificados).`);
      }
      subjects.push({
        slug,
        name: s.nome,
        icon: iconFor(s.nome),
        area: s.area || "Conhecimentos",
        cargo: s.cargo,
        syllabus: s.ementa,
        study_tips: `${s.dicas}${bancaTip}`.trim().slice(0, 2000),
        // Legislação local só com fatos verificados: começa sem geração automática.
        weekly_target: s.legislacao_local ? 0 : 21,
        ai_grounded_only: s.legislacao_local,
      });
    }
    if (!m.estrutura.length) warnings.push(`Módulo ${m.nivel}: quadro de provas não encontrado no edital (projeção de nota indisponível).`);
    return {
      slug: m.nivel,
      name: m.nome || (m.nivel === "medio" ? "Nível Médio" : "Nível Superior"),
      nivel: m.nivel,
      description: m.cargos.length ? `Cargos: ${m.cargos.slice(0, 8).join(", ")}` : "",
      cargos: m.cargos,
      structure: m.estrutura,
      subjects,
    };
  });

  // Um módulo por nível (o primeiro vence) e só módulos com matérias.
  const seenNivel = new Set<string>();
  const kept = modules.filter((m) => {
    if (seenNivel.has(m.nivel) || !m.subjects.length) return false;
    seenNivel.add(m.nivel);
    return true;
  });

  const cronograma = arch.cronograma.filter((c) => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(c.data) && evidenceInSource(c.evidencia, edital) && dateInEvidence(c.data, c.evidencia);
    if (!ok && c.data) warnings.push(`Data "${c.evento}" (${c.data}) descartada: sem evidência no edital.`);
    return ok;
  }).map((c) => ({ data: c.data, evento: c.evento }));

  const rules: Record<string, unknown> = { cronograma };
  for (const [k, v] of Object.entries(arch.regras)) if (v) rules[k] = v;
  if (profile) rules.perfil_banca = profile;

  return {
    draft: {
      slug: trackSlug,
      name: arch.nome || concurso.nome,
      short_name: (arch.nome_curto || concurso.nome).slice(0, 60),
      organ: concurso.orgao,
      banca: concurso.banca ?? "A definir",
      exam_date: concurso.data_prova,
      edital_url: concurso.link_oficial,
      description: arch.descricao || `Trilha do concurso ${concurso.nome}, montada a partir do edital.`,
      rules,
      modules: kept,
    },
    warnings,
  };
}

export interface TrackDraftResult {
  draft: TrackDraft | null;
  profile: BancaProfile | null;
  warnings: string[];
  error: string | null;
}

export async function runTrackDraft(
  llm: LlmClient,
  input: { concurso: DraftConcurso; editalText: string; previousTracks: string },
  models: { architect: string; banca: string },
  deadline: number,
): Promise<TrackDraftResult> {
  const { concurso, editalText, previousTracks } = input;
  const bp = bancaPrompts(concurso.banca ?? "não informada", editalText.slice(0, 30_000), previousTracks);
  const tp = trackPrompts(concurso, editalText, previousTracks);
  const [banca, arch] = await Promise.allSettled([
    llm.callTool({
      agent: "analista-banca", promptVersion: PROMPT_VERSIONS.analista_banca, model: models.banca,
      system: bp.system, user: bp.user, tool: BANCA_TOOL, parse: parseBancaProfile, timeoutMs: 60_000, maxAttempts: 2, deadline,
    }),
    llm.callTool({
      agent: "arquiteto-trilha", promptVersion: PROMPT_VERSIONS.arquiteto_trilha, model: models.architect,
      system: tp.system, user: tp.user, tool: TRACK_TOOL, parse: parseTrackArchitecture, timeoutMs: 120_000, maxAttempts: 2,
      deadline, temperature: 0.2,
    }),
  ]);
  const profile = banca.status === "fulfilled" ? banca.value.data : null;
  const warnings: string[] = profile ? [] : ["Perfil da banca indisponível nesta execução."];
  if (arch.status !== "fulfilled") {
    return { draft: null, profile, warnings, error: "arquiteto de trilha não respondeu dentro do prazo" };
  }
  const built = buildDraft(arch.value.data, profile, concurso, editalText);
  warnings.push(...built.warnings);
  if (!built.draft.modules.length) {
    return { draft: null, profile, warnings, error: "nenhuma matéria com ementa confirmada no edital" };
  }
  return { draft: built.draft, profile, warnings, error: null };
}
