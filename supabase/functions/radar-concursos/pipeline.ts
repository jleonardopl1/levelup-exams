/**
 * Orquestração do monitoramento (o "Gerente master" em código), sem acesso a banco:
 * recebe as páginas que mudaram e devolve as decisões consolidadas. Testável com LLM falso.
 *
 *   páginas novas ──► Batedor (1 por página, em paralelo) ──► agrupa por área
 *        ──► Coordenador de cada área (em paralelo) ──► fila única por prioridade (orçamento)
 *        ──► por concurso: [detalhe do link] ► Analista de edital ► portão de evidência
 *                           ► Verificador independente ► consolidação em código
 */
import type { LlmClient } from "../_shared/ai/llm.ts";
import {
  COORDINATOR_TOOL,
  coordinatorPrompts,
  EXTRACT_TOOL,
  extractionPrompts,
  parseCoordinator,
  parseExtraction,
  parseScout,
  parseVerification,
  PROMPT_VERSIONS,
  SCOUT_TOOL,
  scoutPrompts,
  VERIFY_TOOL,
  verificationPrompts,
} from "./agents.ts";
import { type CheckedClaim, checkClaims, consolidate, evidenceInSource, norm } from "./evidence.ts";
import { windowAround } from "./fetcher.ts";
import type { Area, Candidate, ConcursoRecord, Consolidation, CoordinatorDecision, FetchedPage } from "./types.ts";

export interface MonitorModels {
  scout: string;
  coordinator: string;
  extractor: string;
  verifier: string;
}

export interface MonitorConfig {
  /** Instante (epoch ms) a partir do qual nenhuma etapa nova começa. */
  deadline: number;
  now: () => number;
  /** Teto de concursos analisados a fundo por execução (orçamento do master). */
  maxExtractions: number;
  /** Teto de páginas de detalhe baixadas por execução. */
  maxDetailFetches: number;
  today: string;
}

export interface ChangedPage {
  sourceId: string;
  sourceName: string;
  /** Área fixa da fonte (fonte especializada) ou null (fonte geral). */
  areaSlug: string | null;
  page: FetchedPage;
  /** Só as linhas novas desde a última visita. */
  newText: string;
}

export interface MonitorInput {
  pages: ChangedPage[];
  areas: Area[];
  existingByArea: Map<string, ConcursoRecord[]>;
  /** Baixa a página de detalhe de um concurso (mesmas regras de segurança do coletor). */
  fetchDetail?: (url: string) => Promise<FetchedPage | null>;
}

export interface ConcursoOutcome {
  areaSlug: string;
  sourceId: string;
  evidenceUrl: string;
  orgao: string;
  nome: string;
  existing: ConcursoRecord | null;
  consolidation: Consolidation | null;
  claims: CheckedClaim[];
  rejected: { campo: string; reason: string }[];
  verified: boolean;
  coordinator: { prioridade: number; motivo: string };
}

export interface MonitorStats {
  pages: number;
  candidates: number;
  candidatesDiscarded: number;
  selected: number;
  ignoredByCoordinators: number;
  skippedForBudget: number;
  extractionsFailed: number;
  verifierUnavailable: number;
  claimsRejected: number;
  degraded: string[];
  /** Fontes cuja triagem falhou: o snapshot delas não avança (nova tentativa na próxima execução). */
  scoutFailed: string[];
  /**
   * Fontes com concurso que ficou sem análise (fora do orçamento, sem tempo ou extração com
   * falha): o snapshot também não avança, senão o aviso se perderia no próximo diff.
   */
  unfinishedSources: string[];
}

const MIN_STAGE_MS = 20_000;

/** Executa tarefas com concorrência limitada, preservando a ordem dos resultados. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Fonte vencida? Fontes com falhas seguidas esperam mais (recuo exponencial até 7 dias). */
export function isSourceDue(
  s: { last_checked_at: string | null; check_interval_hours: number; consecutive_failures: number },
  now: number,
): boolean {
  if (!s.last_checked_at) return true;
  const hours = Math.min(168, s.check_interval_hours * 2 ** Math.min(s.consecutive_failures, 4));
  return now - Date.parse(s.last_checked_at) >= hours * 3_600_000;
}

/** Anos (2000–2099) citados num texto: identificam a edição do concurso. */
export function yearsIn(text: string): Set<string> {
  return new Set(text.match(/\b20\d{2}\b/g) ?? []);
}

const FINISHED = new Set(["resultado_final", "homologado", "cancelado"]);

/**
 * O candidato é a MESMA edição do concurso acompanhado? Um órgão abre concursos
 * diferentes ao longo dos anos: anos citados que não batem, ou concurso já encerrado sem
 * o mesmo ano no texto, indicam edição nova (que não pode herdar seguidores nem trilha).
 */
export function sameEdition(existing: ConcursoRecord, hint: string): boolean {
  const mine = yearsIn(`${existing.slug} ${existing.nome}`);
  const theirs = yearsIn(hint);
  const shared = [...theirs].some((y) => mine.has(y));
  if (mine.size && theirs.size && !shared) return false;
  if (FINISHED.has(existing.status) && !shared) return false;
  return true;
}

const keyOf = (c: Candidate) => `${norm(c.orgao)}|${c.uf ?? ""}|${[...yearsIn(`${c.resumo} ${c.trecho}`)].sort().join(",")}`;

/** Concurso já acompanhado: mesmo órgão, mesma UF (quando ambas existem) e mesma edição. */
export function findExisting(existing: ConcursoRecord[], orgao: string, uf: string | null, hint = ""): ConcursoRecord | null {
  const o = norm(orgao);
  return existing.find((e) => norm(e.orgao) === o && (!uf || !e.uf || e.uf === uf) && sameEdition(e, hint)) ?? null;
}

interface AreaItem {
  candidate: Candidate;
  page: ChangedPage;
}

export async function runMonitor(
  llm: LlmClient,
  input: MonitorInput,
  models: MonitorModels,
  config: MonitorConfig,
): Promise<{ outcomes: ConcursoOutcome[]; stats: MonitorStats }> {
  const stats: MonitorStats = {
    pages: input.pages.length, candidates: 0, candidatesDiscarded: 0, selected: 0, ignoredByCoordinators: 0,
    skippedForBudget: 0, extractionsFailed: 0, verifierUnavailable: 0, claimsRejected: 0, degraded: [], scoutFailed: [], unfinishedSources: [],
  };
  const areaBySlug = new Map(input.areas.map((a) => [a.slug, a]));
  const areaSlugs = new Set(areaBySlug.keys());
  const fallbackArea = areaBySlug.has("administrativa") ? "administrativa" : input.areas[0]?.slug ?? "";
  const timeLeft = () => config.deadline - config.now();

  // 1. Batedor: uma triagem por página que mudou.
  const scouted = await Promise.all(input.pages.map(async (p) => {
    if (!p.newText.trim()) return [] as AreaItem[];
    if (timeLeft() < MIN_STAGE_MS) {
      stats.scoutFailed.push(p.sourceId);
      return [] as AreaItem[];
    }
    const { system, user } = scoutPrompts({ name: p.sourceName, url: p.page.url }, p.newText, p.page.links, input.areas);
    try {
      const { data } = await llm.callTool({
        agent: "batedor", promptVersion: PROMPT_VERSIONS.batedor, model: models.scout, system, user,
        tool: SCOUT_TOOL, parse: (a) => parseScout(a, areaSlugs), timeoutMs: 45_000, maxAttempts: 2,
        deadline: config.deadline, temperature: 0,
      });
      const normalized = norm(p.page.text);
      const items: AreaItem[] = [];
      for (const c of data) {
        stats.candidates++;
        // Portão: o trecho citado precisa existir na fonte (senão é alucinação do Batedor).
        if (!evidenceInSource(c.trecho, normalized)) {
          stats.candidatesDiscarded++;
          continue;
        }
        const area = p.areaSlug && areaSlugs.has(p.areaSlug) ? p.areaSlug : c.area || fallbackArea;
        items.push({ candidate: { ...c, area }, page: p });
      }
      return items;
    } catch {
      stats.degraded.push(`batedor falhou: ${p.sourceName}`);
      stats.scoutFailed.push(p.sourceId);
      return [] as AreaItem[];
    }
  }));

  // Agrupa por área, sem duplicar o mesmo órgão/UF vindo de fontes diferentes.
  const byArea = new Map<string, AreaItem[]>();
  for (const item of scouted.flat()) {
    const list = byArea.get(item.candidate.area) ?? [];
    const k = keyOf(item.candidate);
    if (!list.some((x) => keyOf(x.candidate) === k)) list.push(item);
    byArea.set(item.candidate.area, list);
  }

  // 2. Coordenador de cada área.
  type Selected = AreaItem & { area: Area; decision: CoordinatorDecision; existing: ConcursoRecord | null };
  const perArea = await Promise.all([...byArea.entries()].map(async ([slug, items]) => {
    const area = areaBySlug.get(slug);
    if (!area) return [] as Selected[];
    const existing = input.existingByArea.get(slug) ?? [];
    const known = new Set(existing.map((e) => e.slug));
    let decisions: CoordinatorDecision[];
    try {
      if (timeLeft() < MIN_STAGE_MS) throw new Error("sem tempo");
      const { system, user } = coordinatorPrompts(area, items.map((i) => i.candidate), existing.map((e) => ({
        slug: e.slug, nome: e.nome, orgao: e.orgao, uf: e.uf ?? null, status: e.status,
      })));
      const { data } = await llm.callTool({
        agent: `coordenador:${slug}`, promptVersion: PROMPT_VERSIONS.coordenador, model: models.coordinator, system, user,
        tool: COORDINATOR_TOOL, parse: (a) => parseCoordinator(a, items.length, known), timeoutMs: 40_000, maxAttempts: 2,
        deadline: config.deadline, temperature: 0,
      });
      decisions = data;
    } catch {
      // Degradação explícita: sem coordenador, todos seguem com prioridade mínima e a
      // correspondência é feita só em código. O portão de evidência continua valendo.
      stats.degraded.push(`coordenador indisponível: ${slug}`);
      decisions = items.map((_, i) => ({ indice: i, acao: "novo", slug: null, prioridade: 1, motivo: "coordenador indisponível" }));
    }
    const out: Selected[] = [];
    for (const d of decisions) {
      if (d.acao === "ignorar") {
        stats.ignoredByCoordinators++;
        continue;
      }
      const item = items[d.indice];
      // A deduplicação final é em código: "novo" com órgão já acompanhado vira atualização.
      const hint = `${item.candidate.resumo} ${item.candidate.trecho}`;
      const chosen = d.slug ? existing.find((e) => e.slug === d.slug && sameEdition(e, hint)) ?? null : null;
      const match = chosen ?? findExisting(existing, item.candidate.orgao, item.candidate.uf, hint);
      out.push({ ...item, area, decision: d, existing: match });
    }
    return out;
  }));

  // 3. Fila única do master: prioridade do coordenador × peso da área.
  const queue = perArea.flat().sort((a, b) =>
    b.decision.prioridade * b.area.priority - a.decision.prioridade * a.area.priority
  );
  const selected = queue.slice(0, config.maxExtractions);
  stats.skippedForBudget += queue.length - selected.length;
  stats.selected = selected.length;
  const unfinished = new Set<string>();
  for (const s of queue.slice(config.maxExtractions)) unfinished.add(s.page.sourceId);

  let detailBudget = config.maxDetailFetches;
  const outcomes = await pool(selected, 3, async (s): Promise<ConcursoOutcome | null> => {
    if (timeLeft() < MIN_STAGE_MS) {
      stats.skippedForBudget++;
      unfinished.add(s.page.sourceId);
      return null;
    }
    let sourceText = windowAround(s.page.page.text, s.candidate.trecho, 6_000);
    let links = s.page.page.links;
    let evidenceUrl = s.page.page.url;
    const link = s.candidate.link && links.some((l) => l.href === s.candidate.link) ? s.candidate.link : null;
    if (link && input.fetchDetail && detailBudget > 0) {
      detailBudget--;
      const detail = await input.fetchDetail(link).catch(() => null);
      if (detail && !detail.binary && detail.text) {
        sourceText = `${sourceText}\n\n--- Página do concurso (${detail.url}) ---\n${detail.text.slice(0, 30_000)}`;
        links = [...links, ...detail.links];
        evidenceUrl = detail.url;
      }
    }
    const normalizedSource = norm(sourceText);

    // Analista de edital.
    let extraction;
    try {
      const { system, user } = extractionPrompts(s.candidate, sourceText, links);
      extraction = (await llm.callTool({
        agent: "analista-edital", promptVersion: PROMPT_VERSIONS.analista_edital, model: models.extractor, system, user,
        tool: EXTRACT_TOOL, parse: parseExtraction, timeoutMs: 60_000, maxAttempts: 2, deadline: config.deadline, temperature: 0,
      })).data;
    } catch {
      stats.extractionsFailed++;
      unfinished.add(s.page.sourceId);
      return null;
    }

    // Portão determinístico (evidência literal + coerência de valor).
    const gate = checkClaims(extraction.claims, {
      normalizedSource, links: new Set(links.map((l) => l.href)), today: config.today,
    });
    const rejected = gate.rejected.map((r) => ({ campo: r.claim.campo, reason: r.reason }));
    let claims = gate.accepted;

    // Verificador independente (outro modelo). Indisponível = revisão humana.
    let verified = false;
    if (claims.length) {
      try {
        if (timeLeft() < MIN_STAGE_MS) throw new Error("sem tempo");
        const asClaims = claims.map((c) => ({ campo: c.campo, valor: Array.isArray(c.valor) ? c.valor.join("; ") : String(c.valor), evidencia: c.evidencia }));
        const { system, user } = verificationPrompts(s.candidate.orgao, asClaims, sourceText);
        const { data: verdicts } = await llm.callTool({
          agent: "verificador", promptVersion: PROMPT_VERSIONS.verificador, model: models.verifier, system, user,
          tool: VERIFY_TOOL, parse: (a) => parseVerification(a, asClaims.length), timeoutMs: 60_000, maxAttempts: 2,
          deadline: config.deadline, temperature: 0,
        });
        const kept: CheckedClaim[] = [];
        verdicts.forEach((v, i) => {
          if (v.suportada) kept.push(claims[i]);
          else rejected.push({ campo: claims[i].campo, reason: `verificador: ${v.motivo || "não suportada"}` });
        });
        claims = kept;
        verified = true;
      } catch {
        stats.verifierUnavailable++;
      }
    }
    stats.claimsRejected += rejected.length;

    const nome = String(claims.find((c) => c.campo === "nome")?.valor ?? extraction.nome ?? s.candidate.orgao).slice(0, 160) ||
      s.candidate.orgao;
    // Concurso novo sem nenhum fato verificado não entra no radar.
    if (!s.existing && !claims.length) return null;
    if (!s.existing && !claims.some((c) => c.campo === "nome")) {
      claims = [{ campo: "nome", valor: nome, evidencia: s.candidate.trecho }, ...claims];
    }
    if (!s.existing && s.candidate.esfera && !claims.some((c) => c.campo === "esfera")) {
      // Esfera classificada pelo Batedor: dado de organização, não fato do edital.
      claims.push({ campo: "esfera", valor: s.candidate.esfera, evidencia: s.candidate.trecho });
    }
    const consolidation = consolidate({ existing: s.existing, orgao: s.candidate.orgao, claims, verified });
    return {
      areaSlug: s.area.slug,
      sourceId: s.page.sourceId,
      evidenceUrl,
      orgao: s.candidate.orgao,
      nome,
      existing: s.existing,
      consolidation,
      claims,
      rejected,
      verified,
      coordinator: { prioridade: s.decision.prioridade, motivo: s.decision.motivo },
    };
  });

  stats.unfinishedSources = [...unfinished];
  return { outcomes: outcomes.filter((o): o is ConcursoOutcome => o !== null), stats };
}
