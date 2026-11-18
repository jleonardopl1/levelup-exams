/**
 * Tipos do Radar de Concursos (grupo multiagente de monitoramento de editais).
 * Hierarquia e fluxo: docs/RADAR_CONCURSOS.md.
 */

export const STATUSES = [
  "previsto",
  "autorizado",
  "banca_definida",
  "edital_publicado",
  "inscricoes_abertas",
  "inscricoes_encerradas",
  "prova_aplicada",
  "resultado_final",
  "homologado",
  "suspenso",
  "cancelado",
] as const;
export type ConcursoStatus = typeof STATUSES[number];

export const ESFERAS = ["federal", "estadual", "distrital", "municipal"] as const;
export type Esfera = typeof ESFERAS[number];

export const ESCOLARIDADES = ["fundamental", "medio", "superior"] as const;
export type Escolaridade = typeof ESCOLARIDADES[number];

/** Campos que o Analista de edital pode afirmar — sempre com evidência literal. */
export const CLAIM_FIELDS = [
  "nome",
  "banca",
  "esfera",
  "uf",
  "municipio",
  "status",
  "cargos",
  "vagas",
  "salario_max",
  "escolaridade",
  "inscricoes_inicio",
  "inscricoes_fim",
  "data_prova",
  "link_oficial",
] as const;
export type ClaimField = typeof CLAIM_FIELDS[number];

/** Afirmação do Analista de edital: um campo, o valor e o trecho da fonte que o sustenta. */
export interface Claim {
  campo: ClaimField;
  valor: string;
  evidencia: string;
}

/** Valores já validados e normalizados (o que pode ir para o banco). */
export interface ConcursoFacts {
  nome?: string;
  banca?: string;
  esfera?: Esfera;
  uf?: string;
  municipio?: string;
  status?: ConcursoStatus;
  cargos?: string[];
  vagas?: number;
  salario_max?: number;
  escolaridade?: Escolaridade[];
  inscricoes_inicio?: string;
  inscricoes_fim?: string;
  data_prova?: string;
  link_oficial?: string;
}

/** Concurso como está no banco (radar_concursos). */
export interface ConcursoRecord extends ConcursoFacts {
  id: string;
  slug: string;
  orgao: string;
  nome: string;
  status: ConcursoStatus;
  area_id: string | null;
  is_published: boolean;
  track_id: string | null;
}

export interface Area {
  id: string;
  slug: string;
  name: string;
  focus: string;
  priority: number;
}

/** Candidato encontrado pelo Batedor (triagem) num trecho novo de uma fonte. */
export interface Candidate {
  orgao: string;
  area: string;
  esfera: Esfera | null;
  uf: string | null;
  resumo: string;
  trecho: string;
  link: string | null;
}

/** Decisão do Coordenador da área sobre um candidato. */
export interface CoordinatorDecision {
  indice: number;
  acao: "atualizar" | "novo" | "ignorar";
  slug: string | null;
  prioridade: number;
  motivo: string;
}

/** Veredito do Verificador sobre uma afirmação. */
export interface ClaimVerdict {
  indice: number;
  suportada: boolean;
  motivo: string;
}

export interface FieldChange {
  campo: ClaimField;
  antes: unknown;
  depois: unknown;
  evidencia: string;
}

export type UpdateKind = "novo" | "status" | "datas" | "vagas" | "retificacao" | "documento" | "outro";

/** Resultado da consolidação (decidida em código, não pelo modelo). */
export interface Consolidation {
  patch: ConcursoFacts;
  changes: FieldChange[];
  kind: UpdateKind;
  severity: "critica" | "info";
  title: string;
  summary: string;
  /** true = vai para revisão humana em vez de publicar sozinho. */
  needsReview: boolean;
  reasons: string[];
}

/** Página baixada e normalizada pelo coletor. */
export interface FetchedPage {
  url: string;
  status: number;
  contentType: string;
  /** Texto normalizado (HTML sem scripts/estilos, entidades decodificadas). */
  text: string;
  /** Links absolutos encontrados na página (href + texto do link). */
  links: { href: string; label: string }[];
  /** Hash do texto normalizado (detecção de mudança). */
  hash: string;
  /** Documento binário (PDF etc.): só o hash é útil. */
  binary: boolean;
}
