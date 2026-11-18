/**
 * Portão determinístico do Radar: decide em CÓDIGO o que pode virar fato.
 *
 *  1. cada afirmação do Analista de edital precisa de EVIDÊNCIA literal na fonte;
 *  2. o valor precisa ser coerente com a evidência (datas e números conferidos);
 *  3. a consolidação compara com o que já se sabe, classifica a mudança e decide se
 *     publica sozinha ou vai para revisão humana (falha fechada: na dúvida, revisão).
 */
import {
  type Claim,
  CLAIM_FIELDS,
  type ClaimField,
  type ConcursoFacts,
  type ConcursoRecord,
  type ConcursoStatus,
  type Consolidation,
  ESCOLARIDADES,
  ESFERAS,
  type FieldChange,
  STATUSES,
  type UpdateKind,
} from "./types.ts";

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Minúsculas, sem acentos, só letras/dígitos separados por um espaço. */
export function norm(s: string): string {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Slug estável a partir de um nome (órgão + ano, por exemplo). */
export function slugify(s: string, max = 70): string {
  return norm(s).replace(/ /g, "-").slice(0, max).replace(/-+$/, "");
}

/** A evidência aparece (normalizada) no texto da fonte e é longa o bastante? */
export function evidenceInSource(evidence: string, normalizedSource: string): boolean {
  const e = norm(evidence);
  return e.length >= 6 && normalizedSource.includes(e);
}

function isoDate(v: string): string | null {
  const s = v.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A evidência menciona esta data (dd/mm, dd.mm, "d de mês")? */
export function dateInEvidence(iso: string, evidence: string): boolean {
  const [, mm, dd] = iso.split("-").map(Number);
  const e = norm(evidence);
  const pad = (n: number) => String(n).padStart(2, "0");
  const numeric = new RegExp(`(^|\\D)0?${dd}\\s*[/.]\\s*0?${mm}(\\D|$)`);
  if (numeric.test(evidence)) return true;
  const textual = new RegExp(`(^| )(${pad(dd)}|${dd})( de)? ${MONTHS[mm - 1]}( |$)`);
  return textual.test(e);
}

/** Números em formato brasileiro na evidência (1.234,56 → 1234.56; 1.500 → 1500). */
export function numbersIn(evidence: string): number[] {
  const out: number[] = [];
  for (const m of evidence.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g)) {
    const n = Number(m[0].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function parseMoney(v: string): number | null {
  const cleaned = v.replace(/r\$|\s/gi, "");
  const n = /,\d{1,2}$/.test(cleaned) || /\.\d{3}/.test(cleaned)
    ? Number(cleaned.replace(/\./g, "").replace(",", "."))
    : Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const list = (v: string, max: number, maxLen: number) =>
  [...new Set(v.split(/[;\n]+/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 2).map((s) => s.slice(0, maxLen)))].slice(0, max);

const STATUS_HINTS: Record<ConcursoStatus, RegExp> = {
  previsto: /previst|anunci|solicit|pedido/,
  autorizado: /autoriz/,
  banca_definida: /banca|organizador|contratad|instituicao/,
  edital_publicado: /edital|publicad|aberto/,
  inscricoes_abertas: /inscri/,
  inscricoes_encerradas: /inscri|encerr/,
  prova_aplicada: /prova|aplica/,
  resultado_final: /resultado|classifica/,
  homologado: /homolog/,
  suspenso: /suspen/,
  cancelado: /cancel|anulad/,
};

export interface CheckedClaim {
  campo: ClaimField;
  valor: unknown;
  evidencia: string;
}

export interface ClaimCheckResult {
  accepted: CheckedClaim[];
  rejected: { claim: Claim; reason: string }[];
}

export interface CheckContext {
  /** Texto da fonte JÁ normalizado com norm(). */
  normalizedSource: string;
  /** Links da fonte (para conferir link_oficial). */
  links: Set<string>;
  /** Data de hoje (YYYY-MM-DD) para limites de plausibilidade. */
  today: string;
}

/** Valida tipo/valor de cada afirmação e confere a evidência na fonte. */
export function checkClaims(claims: Claim[], ctx: CheckContext): ClaimCheckResult {
  const accepted: CheckedClaim[] = [];
  const rejected: { claim: Claim; reason: string }[] = [];
  const year = Number(ctx.today.slice(0, 4));
  const seen = new Set<ClaimField>();

  for (const c of claims) {
    const reject = (reason: string) => rejected.push({ claim: c, reason });
    if (!CLAIM_FIELDS.includes(c.campo)) {
      reject("campo desconhecido");
      continue;
    }
    if (seen.has(c.campo)) {
      reject("campo repetido");
      continue;
    }
    const valor = String(c.valor ?? "").trim();
    if (!valor) {
      reject("valor vazio");
      continue;
    }
    if (c.campo !== "link_oficial" && !evidenceInSource(c.evidencia, ctx.normalizedSource)) {
      reject("evidência não encontrada na fonte");
      continue;
    }

    let value: unknown = null;
    let reason = "valor inválido";
    switch (c.campo) {
      case "nome":
      case "banca":
      case "municipio":
        value = valor.replace(/\s+/g, " ").slice(0, c.campo === "nome" ? 160 : 120);
        if (c.campo !== "nome" && !norm(c.evidencia).includes(norm(String(value)))) {
          value = null;
          reason = "valor não aparece na evidência";
        }
        break;
      case "esfera":
        value = (ESFERAS as readonly string[]).includes(valor) ? valor : null;
        break;
      case "uf":
        value = UFS.has(valor.toUpperCase()) ? valor.toUpperCase() : null;
        break;
      case "status": {
        const s = valor as ConcursoStatus;
        if ((STATUSES as readonly string[]).includes(s)) {
          value = STATUS_HINTS[s].test(norm(c.evidencia)) ? s : null;
          if (!value) reason = "evidência não indica esse status";
        }
        break;
      }
      case "cargos":
        value = list(valor, 30, 120);
        if (!(value as string[]).length) value = null;
        break;
      case "escolaridade": {
        const items = list(valor.toLowerCase(), 3, 20).map((s) => norm(s)).filter((s) => (ESCOLARIDADES as readonly string[]).includes(s));
        value = items.length ? items : null;
        break;
      }
      case "vagas": {
        const n = Number(valor.replace(/\./g, ""));
        if (Number.isInteger(n) && n >= 0 && n <= 500_000) {
          value = n === 0 || numbersIn(c.evidencia).includes(n) ? n : null;
          if (value === null) reason = "número não aparece na evidência";
        }
        break;
      }
      case "salario_max": {
        const n = parseMoney(valor);
        if (n !== null && n >= 500 && n <= 200_000) {
          value = numbersIn(c.evidencia).some((x) => Math.abs(x - n) < 0.5) ? n : null;
          if (value === null) reason = "valor não aparece na evidência";
        }
        break;
      }
      case "inscricoes_inicio":
      case "inscricoes_fim":
      case "data_prova": {
        const iso = isoDate(valor);
        const y = iso ? Number(iso.slice(0, 4)) : 0;
        if (iso && y >= year - 1 && y <= year + 3) {
          value = dateInEvidence(iso, c.evidencia) ? iso : null;
          if (value === null) reason = "data não aparece na evidência";
        }
        break;
      }
      case "link_oficial": {
        let href: string | null = null;
        try {
          href = new URL(valor).toString();
        } catch { /* inválido */ }
        value = href && /^https?:\/\//.test(href) && ctx.links.has(href) ? href : null;
        if (value === null) reason = "link não está na fonte";
        break;
      }
    }
    if (value === null) {
      reject(reason);
      continue;
    }
    seen.add(c.campo);
    accepted.push({ campo: c.campo, valor: value, evidencia: c.evidencia.slice(0, 300) });
  }
  // Coerência entre datas: fim das inscrições não pode ser antes do início nem depois da prova.
  const get = (f: ClaimField) => accepted.find((a) => a.campo === f)?.valor as string | undefined;
  const ini = get("inscricoes_inicio"), fim = get("inscricoes_fim"), prova = get("data_prova");
  const drop = (f: ClaimField, why: string) => {
    const i = accepted.findIndex((a) => a.campo === f);
    if (i >= 0) {
      const [a] = accepted.splice(i, 1);
      rejected.push({ claim: { campo: a.campo, valor: String(a.valor), evidencia: a.evidencia }, reason: why });
    }
  };
  if (ini && fim && fim < ini) drop("inscricoes_fim", "fim das inscrições antes do início");
  if (fim && prova && prova < fim) drop("data_prova", "prova antes do fim das inscrições");
  return { accepted, rejected };
}

/** Converte afirmações aceitas em fatos. */
export function toFacts(claims: CheckedClaim[]): ConcursoFacts {
  const facts: Record<string, unknown> = {};
  for (const c of claims) facts[c.campo] = c.valor;
  return facts as ConcursoFacts;
}

// ---------------------------------------------------------------------------
// Fases do concurso
// ---------------------------------------------------------------------------

const RANK: Record<ConcursoStatus, number> = {
  previsto: 0, autorizado: 1, banca_definida: 2, edital_publicado: 3, inscricoes_abertas: 4,
  inscricoes_encerradas: 5, prova_aplicada: 6, resultado_final: 7, homologado: 8, suspenso: -1, cancelado: -1,
};

export const STATUS_LABEL: Record<ConcursoStatus, string> = {
  previsto: "previsto",
  autorizado: "autorizado",
  banca_definida: "banca definida",
  edital_publicado: "edital publicado",
  inscricoes_abertas: "inscrições abertas",
  inscricoes_encerradas: "inscrições encerradas",
  prova_aplicada: "prova aplicada",
  resultado_final: "resultado final",
  homologado: "homologado",
  suspenso: "suspenso",
  cancelado: "cancelado",
};

/**
 * Transição de fase: "ok" (avança), "igual", "regressao" (volta de fase — pode ser
 * reabertura, retificação ou erro de leitura: humano decide) ou "excecao" (suspenso/
 * cancelado, ou retomada depois de suspensão: sempre revisada por ser crítica).
 */
export function statusTransition(from: ConcursoStatus | undefined, to: ConcursoStatus): "ok" | "igual" | "regressao" | "excecao" {
  if (!from) return "ok";
  if (from === to) return "igual";
  if (RANK[to] < 0 || RANK[from] < 0) return "excecao";
  return RANK[to] > RANK[from] ? "ok" : "regressao";
}

const CRITICAL_STATUS = new Set<ConcursoStatus>(["autorizado", "edital_publicado", "inscricoes_abertas", "suspenso", "cancelado"]);

const LABEL: Record<ClaimField, string> = {
  nome: "nome", banca: "banca", esfera: "esfera", uf: "UF", municipio: "município", status: "fase", cargos: "cargos",
  vagas: "vagas", salario_max: "salário", escolaridade: "escolaridade", inscricoes_inicio: "início das inscrições",
  inscricoes_fim: "fim das inscrições", data_prova: "data da prova", link_oficial: "link oficial",
};

const brDate = (iso: string) => iso.split("-").reverse().join("/");

function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => norm(String(x)) === norm(String(b[i])));
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return norm(String(a ?? "")) === norm(String(b ?? ""));
}

export interface ConsolidateInput {
  existing: ConcursoRecord | null;
  orgao: string;
  claims: CheckedClaim[];
  /** O Verificador independente confirmou as afirmações? false = indisponível/divergente. */
  verified: boolean;
}

/** Decide (em código) o que muda, a gravidade e se precisa de revisão humana. */
export function consolidate({ existing, orgao, claims, verified }: ConsolidateInput): Consolidation | null {
  const facts = toFacts(claims);
  const reasons: string[] = [];
  let needsReview = !verified;
  if (!verified) reasons.push("verificador indisponível ou sem confirmação");

  if (!existing) {
    const status = facts.status ?? "previsto";
    if (!facts.status) {
      needsReview = true;
      reasons.push("fase do concurso não confirmada");
    }
    const changes: FieldChange[] = claims.map((c) => ({ campo: c.campo, antes: null, depois: c.valor, evidencia: c.evidencia }));
    const datas = [facts.inscricoes_fim && `inscrições até ${brDate(facts.inscricoes_fim)}`, facts.data_prova && `prova em ${brDate(facts.data_prova)}`]
      .filter(Boolean).join(", ");
    return {
      patch: { ...facts, status },
      changes,
      kind: "novo",
      severity: CRITICAL_STATUS.has(status) ? "critica" : "info",
      title: `Novo no radar: ${facts.nome ?? orgao}`.slice(0, 140),
      summary: `${orgao} — ${STATUS_LABEL[status]}${facts.vagas ? `, ${facts.vagas} vagas` : ""}${datas ? `; ${datas}` : ""}.`.slice(0, 400),
      needsReview,
      reasons,
    };
  }

  const patch: ConcursoFacts = {};
  const changes: FieldChange[] = [];
  let kind: UpdateKind = "outro";
  let critical = false;

  for (const c of claims) {
    const before = (existing as unknown as Record<string, unknown>)[c.campo];
    if (before !== undefined && before !== null && same(before, c.valor)) continue;

    if (c.campo === "status") {
      const t = statusTransition(existing.status, c.valor as ConcursoStatus);
      if (t === "igual") continue;
      if (t === "regressao" || t === "excecao") {
        needsReview = true;
        reasons.push(`mudança de fase ${STATUS_LABEL[existing.status]} → ${STATUS_LABEL[c.valor as ConcursoStatus]} exige revisão`);
      }
      kind = "status";
      if (CRITICAL_STATUS.has(c.valor as ConcursoStatus)) critical = true;
    } else if (["inscricoes_inicio", "inscricoes_fim", "data_prova"].includes(c.campo)) {
      if (kind !== "status") kind = "datas";
      // Data já conhecida que muda = retificação: crítica e conferida por um humano.
      if (before) {
        kind = "retificacao";
        critical = true;
        needsReview = true;
        reasons.push(`${LABEL[c.campo]} alterada (retificação?)`);
      } else if (c.campo === "data_prova" || c.campo === "inscricoes_fim") critical = true;
    } else if (c.campo === "vagas" && kind === "outro") {
      kind = "vagas";
    }
    (patch as Record<string, unknown>)[c.campo] = c.valor;
    changes.push({ campo: c.campo, antes: before ?? null, depois: c.valor, evidencia: c.evidencia });
  }

  if (!changes.length) return null;
  const fmt = (v: unknown, campo: ClaimField) =>
    v === null || v === undefined ? "—"
      : campo === "status" ? STATUS_LABEL[v as ConcursoStatus]
      : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? brDate(String(v))
      : Array.isArray(v) ? v.slice(0, 4).join(", ")
      : String(v);
  const main = changes.find((c) => c.campo === "status") ?? changes.find((c) => c.campo === "data_prova") ?? changes[0];
  const title = main.campo === "status"
    ? `${existing.nome}: ${fmt(main.depois, "status")}`
    : `${existing.nome}: ${LABEL[main.campo]} ${main.antes ? "alterada" : "definida"}`;
  const summary = changes.map((c) => `${LABEL[c.campo]}: ${c.antes != null ? `${fmt(c.antes, c.campo)} → ` : ""}${fmt(c.depois, c.campo)}`).join("; ");
  return {
    patch,
    changes,
    kind,
    severity: critical ? "critica" : "info",
    title: title.slice(0, 140),
    summary: summary.slice(0, 400),
    needsReview,
    reasons,
  };
}
