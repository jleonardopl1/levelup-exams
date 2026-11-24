/**
 * radar-concursos — grupo multiagente de pesquisa e monitoramento de concursos.
 *
 * GERENTE MASTER (este arquivo + pipeline.ts, decisões em código):
 *   - escolhe as fontes vencidas (prioridade da área, tempo desde a última visita);
 *   - coleta as páginas com segurança e calcula só o trecho NOVO (fetcher.ts);
 *   - aciona o Batedor, os Coordenadores de área e os especialistas (agents.ts);
 *   - aplica orçamento (fontes, análises, páginas de detalhe, prazo global);
 *   - consolida (evidence.ts), publica ou manda para revisão humana, recalcula a
 *     relevância (scoring.ts) e avisa quem acompanha (RPC radar_fanout_update).
 *
 * Ações (POST, JSON):
 *   { "action": "monitor", "source_id"?: uuid }        — cron (x-cron-secret) ou admin
 *   { "action": "draft_track", "concurso_id": uuid, "edital_text"?: string } — só admin
 *
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY e opcionais
 *   RADAR_MODEL (Batedor, Coordenadores, Analista de edital; padrão google/gemini-2.5-flash)
 *   RADAR_VERIFIER_MODEL (Verificador; padrão google/gemini-2.5-pro — outro modelo de propósito)
 *   RADAR_TRACK_MODEL (Analista de banca e Arquiteto de trilha; padrão google/gemini-2.5-pro)
 *   RADAR_MAX_SOURCES (8) · RADAR_MAX_EXTRACTIONS (8) · RADAR_MAX_DETAIL_FETCHES (4)
 *   RADAR_RUN_BUDGET_MS (140000) · QUESTION_CRON_SECRET (sem ela, o segredo vem do Vault)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { jsonResponse, readJson, requireAdmin, UUID_RE } from "../_shared/utils.ts";
import { createGatewayClient, modelFromEnv } from "../_shared/ai/llm.ts";
import { createTelemetry } from "../_shared/ai/telemetry.ts";
import { slugify } from "./evidence.ts";
import { diffNewLines, fetchPage, FetchError, fetchRendered, RENDER_TIMEOUT_MS } from "./fetcher.ts";
import { type ChangedPage, type ConcursoOutcome, isSourceDue, pool, requireReviewForRendered, runMonitor } from "./pipeline.ts";
import { relevanceScore, shouldSuggestTrack } from "./scoring.ts";
import { runTrackDraft } from "./tracks.ts";
import type { Area, ConcursoRecord, FetchedPage } from "./types.ts";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const DEFAULT_STRONG_MODEL = "google/gemini-2.5-pro";
const SNAPSHOT_MAX = 200_000;
/** Quantas execuções seguidas uma fonte com trabalho pendente espera antes de avançar. */
const MAX_DEFERRALS = 3;
const CONCURSO_COLUMNS =
  "id, slug, area_id, nome, orgao, banca, esfera, uf, municipio, status, cargos, vagas, salario_max, escolaridade, inscricoes_inicio, inscricoes_fim, data_prova, link_oficial, is_published, track_id";

// deno-lint-ignore no-explicit-any
type Supa = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface SourceRow {
  id: string;
  name: string;
  url: string;
  area_id: string | null;
  check_interval_hours: number;
  last_checked_at: string | null;
  last_hash: string | null;
  last_text: string | null;
  consecutive_failures: number;
  pending_retries: number;
  /** 'firecrawl' = página montada por JavaScript, renderizada pelo serviço (piloto D15). Sem a coluna = 'direto'. */
  render_mode?: string | null;
}

/** Tempo reservado a agentes e persistência antes de iniciar uma renderização (piloto Firecrawl). */
const RENDER_RESERVE_MS = 60_000;

const intEnv = (name: string, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number(Deno.env.get(name) ?? fallback) || fallback));

const todayBr = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function uniqueSlug(supabase: Supa, base: string): Promise<string> {
  const root = base.length >= 3 ? base : `concurso-${base || "novo"}`;
  const options = [root, ...[2, 3, 4, 5, 6].map((n) => `${root.slice(0, 74)}-${n}`)];
  const { data } = await supabase.from("radar_concursos").select("slug").in("slug", options);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  return options.find((s) => !taken.has(s)) ?? `${root.slice(0, 70)}-${crypto.randomUUID().slice(0, 6)}`;
}

/** JSON com chaves ordenadas (comparação estável de patches). */
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>).sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

async function samePendingExists(supabase: Supa, concursoId: string, patch: unknown): Promise<boolean> {
  const { data } = await supabase.from("radar_updates").select("patch")
    .eq("concurso_id", concursoId).eq("review_status", "pendente").limit(20);
  const target = stableJson(patch);
  return (data ?? []).some((r: { patch: unknown }) => stableJson(r.patch) === target);
}

/** Grava um resultado consolidado. Retorna o que aconteceu (para o resumo da execução). */
async function persistOutcome(
  supabase: Supa,
  o: ConcursoOutcome,
  areaIdBySlug: Map<string, string>,
): Promise<{ result: "publicada" | "pendente" | "nada"; concursoId?: string }> {
  const c = o.consolidation;
  if (!c) return { result: "nada" };
  let concursoId: string;

  if (!o.existing) {
    const slug = await uniqueSlug(supabase, slugify(o.nome));
    const { data, error } = await supabase.from("radar_concursos").insert({
      slug,
      area_id: areaIdBySlug.get(o.areaSlug) ?? null,
      nome: o.nome,
      orgao: o.orgao,
      // Fato não aprovado não entra no registro canônico: em revisão, o concurso nasce só
      // com a identificação e os fatos ficam no patch da atualização pendente (aplicado
      // por radar_review_update na aprovação; descartado na rejeição).
      ...(c.needsReview ? {} : c.patch),
      is_published: !c.needsReview,
      source_id: o.sourceId,
    }).select("id").single();
    if (error) throw new Error(`concurso: ${error.message}`);
    concursoId = data.id;
  } else {
    concursoId = o.existing.id;
    if (c.needsReview && await samePendingExists(supabase, concursoId, c.patch)) {
      // A mesma mudança já espera revisão (página reprocessada): não duplica a fila.
      return { result: "nada", concursoId };
    }
    if (!c.needsReview) {
      const { error } = await supabase.rpc("radar_apply_patch", { p_concurso_id: concursoId, p: c.patch });
      if (error) throw new Error(`patch: ${error.message}`);
    }
  }

  const status = c.needsReview ? "pendente" : "publicada";
  const { data: upd, error: updErr } = await supabase.from("radar_updates").insert({
    concurso_id: concursoId,
    source_id: o.sourceId,
    kind: c.kind,
    severity: c.severity,
    title: c.title,
    summary: c.summary,
    changes: c.changes,
    patch: c.patch,
    evidence_url: o.evidenceUrl,
    review_status: status,
    review_reason: c.reasons.join("; ").slice(0, 300) || null,
  }).select("id").single();
  if (updErr) throw new Error(`atualização: ${updErr.message}`);
  if (status === "publicada") await supabase.rpc("radar_fanout_update", { p_update_id: upd.id });
  return { result: status, concursoId };
}

/** Recalcula relevância e sugestão de trilha dos concursos tocados. */
async function refreshRelevance(supabase: Supa, ids: string[]) {
  if (!ids.length) return;
  const [{ data: rows }, { data: counts }] = await Promise.all([
    supabase.from("radar_concursos").select(CONCURSO_COLUMNS).in("id", ids),
    supabase.rpc("radar_follower_counts"),
  ]);
  const followers = new Map<string, number>((counts ?? []).map((r: { concurso_id: string; followers: number }) => [r.concurso_id, Number(r.followers)]));
  for (const r of (rows ?? []) as ConcursoRecord[]) {
    const relevance = relevanceScore({ ...r, salario_max: r.salario_max == null ? undefined : Number(r.salario_max) }, followers.get(r.id) ?? 0);
    await supabase.from("radar_concursos").update({
      relevance,
      track_suggested: shouldSuggestTrack({ status: r.status, relevance, track_id: r.track_id }),
    }).eq("id", r.id);
  }
}

// ---------------------------------------------------------------------------
// Monitoramento
// ---------------------------------------------------------------------------

async function monitor(supabase: Supa, apiKey: string, trigger: "cron" | "admin", sourceId: string | null, startedAt: number) {
  const { data: run, error: runErr } = await supabase.from("radar_runs").insert({ trigger }).select("id").single();
  if (runErr) return jsonResponse({ error: "Radar indisponível (migration pendente?)" }, 503);

  const deadline = startedAt + intEnv("RADAR_RUN_BUDGET_MS", 140_000, 60_000, 380_000);
  const telemetry = createTelemetry("radar-concursos");
  const llm = createGatewayClient({ apiKey, onCall: (meta) => telemetry.record(meta, { metadata: { run_id: run.id } }) });
  const robotsCache = new Map<string, string[]>();

  const [{ data: areaRows }, { data: sourceRows }, { data: concursoRows }] = await Promise.all([
    supabase.from("radar_areas").select("id, slug, name, focus, priority").eq("is_active", true),
    supabase.from("radar_sources")
      // "*" e não a lista de colunas: a função publicada antes da migration de render_mode continua lendo as fontes.
      .select("*")
      .eq("is_active", true).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(200),
    supabase.from("radar_concursos").select(CONCURSO_COLUMNS).order("last_update_at", { ascending: false }).limit(2000),
  ]);
  const areas = (areaRows ?? []) as (Area & { id: string })[];
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const areaIdBySlug = new Map(areas.map((a) => [a.slug, a.id]));

  const now = Date.now();
  const due = ((sourceRows ?? []) as SourceRow[])
    .filter((s) => (sourceId ? s.id === sourceId : isSourceDue(s, now)))
    // Fontes especializadas de áreas com mais peso primeiro.
    .sort((a, b) => (areaById.get(b.area_id ?? "")?.priority ?? 1) - (areaById.get(a.area_id ?? "")?.priority ?? 1))
    .slice(0, intEnv("RADAR_MAX_SOURCES", 8, 1, 20))
    // Piloto Firecrawl: poucas fontes renderizadas por execução (cada uma pode levar até 45 s).
    .filter(((slots) => (s: SourceRow) => s.render_mode !== "firecrawl" || slots-- > 0)(intEnv("RADAR_MAX_RENDERED", 2, 0, 5)));

  // 1. Coleta (sem IA): baixa, normaliza e calcula o trecho novo.
  const fetched = await pool(due, 3, async (s) => {
    try {
      if (s.render_mode === "firecrawl") {
        // Reserva tempo para agentes e persistência; sem folga, a fonte fica para a próxima execução.
        const budget = deadline - Date.now() - RENDER_RESERVE_MS;
        if (budget < 10_000) return { source: s, page: null, error: null, skipped: true };
        const page = await fetchRendered(s.url, {
          robotsCache, apiKey: Deno.env.get("FIRECRAWL_API_KEY") ?? undefined, timeoutMs: Math.min(RENDER_TIMEOUT_MS, budget),
        });
        return { source: s, page: page as FetchedPage, error: null as string | null, skipped: false };
      }
      return { source: s, page: await fetchPage(s.url, { robotsCache }) as FetchedPage, error: null as string | null, skipped: false };
    } catch (e) {
      return { source: s, page: null, error: e instanceof FetchError ? e.message : "erro na coleta", skipped: false };
    }
  });
  const renderedSources = new Set(fetched.filter((f) => f.page?.rendered).map((f) => f.source.id));

  const changed: ChangedPage[] = [];
  const documentChanges: { source: SourceRow; page: FetchedPage }[] = [];
  const emptyPages = new Set<string>();
  let errors = 0;
  for (const f of fetched) {
    if (f.skipped) continue;
    if (!f.page) {
      errors++;
      await supabase.from("radar_sources").update({
        last_checked_at: new Date().toISOString(),
        last_status: (f.error ?? "erro").slice(0, 120),
        consecutive_failures: f.source.consecutive_failures + 1,
      }).eq("id", f.source.id);
      continue;
    }
    // Página sem texto: montada por JavaScript ou desafio anti-robô. Não é "sem novidade":
    // sinaliza no painel (e recua) para o admin trocar a URL.
    if (!f.page.binary && f.page.text.length < 200) {
      errors++;
      emptyPages.add(f.source.id);
      continue;
    }
    if (f.page.hash === f.source.last_hash) continue;
    if (f.page.binary) {
      if (f.source.last_hash) documentChanges.push({ source: f.source, page: f.page });
      continue;
    }
    changed.push({
      sourceId: f.source.id,
      sourceName: f.source.name,
      areaSlug: f.source.area_id ? areaById.get(f.source.area_id)?.slug ?? null : null,
      page: f.page,
      newText: diffNewLines(f.source.last_text, f.page.text),
    });
  }

  // 2. Agentes (Batedor → Coordenadores → especialistas), dentro do orçamento.
  const existingByArea = new Map<string, ConcursoRecord[]>();
  for (const c of (concursoRows ?? []) as ConcursoRecord[]) {
    const slug = c.area_id ? areaById.get(c.area_id)?.slug : undefined;
    if (!slug) continue;
    existingByArea.set(slug, [...(existingByArea.get(slug) ?? []), c]);
  }
  const { outcomes, stats } = changed.length
    ? await runMonitor(llm, {
      pages: changed,
      areas,
      existingByArea,
      fetchDetail: (url) => fetchPage(url, { robotsCache }).catch(() => null),
    }, {
      scout: modelFromEnv("RADAR_MODEL", DEFAULT_MODEL),
      coordinator: modelFromEnv("RADAR_MODEL", DEFAULT_MODEL),
      extractor: modelFromEnv("RADAR_MODEL", DEFAULT_MODEL),
      verifier: modelFromEnv("RADAR_VERIFIER_MODEL", DEFAULT_STRONG_MODEL),
    }, {
      deadline,
      now: Date.now,
      maxExtractions: intEnv("RADAR_MAX_EXTRACTIONS", 8, 1, 30),
      maxDetailFetches: intEnv("RADAR_MAX_DETAIL_FETCHES", 4, 0, 10),
      today: todayBr(),
    })
    : { outcomes: [], stats: null };

  // 3. Persistência e avisos.
  let published = 0, pending = 0;
  const touched = new Set<string>();
  const persistFailed = new Set<string>();
  for (const o of requireReviewForRendered(outcomes, renderedSources)) {
    try {
      const r = await persistOutcome(supabase, o, areaIdBySlug);
      if (r.result === "publicada") published++;
      if (r.result === "pendente") pending++;
      if (r.concursoId) touched.add(r.concursoId);
    } catch (e) {
      errors++;
      persistFailed.add(o.sourceId);
      console.error("radar-concursos: persistência", (e instanceof Error ? e.message : "erro").slice(0, 200));
    }
  }

  // Documento oficial (PDF) alterado numa fonte ligada a um concurso: humano confere.
  for (const d of documentChanges) {
    const { data: linked } = await supabase.from("radar_concursos").select("id, nome").eq("source_id", d.source.id);
    for (const c of linked ?? []) {
      await supabase.from("radar_updates").insert({
        concurso_id: c.id, source_id: d.source.id, kind: "documento", severity: "critica",
        title: `${c.nome}: documento oficial alterado`.slice(0, 140),
        summary: "O arquivo oficial monitorado mudou (possível retificação). Confira antes de publicar.",
        evidence_url: d.page.url, review_status: "pendente",
      });
      pending++;
    }
  }

  await refreshRelevance(supabase, [...touched]);

  // 4. Snapshots: só avançam as fontes cujo trecho novo foi TODO processado (triagem,
  // análise de cada concurso e gravação). Com trabalho pendente, a fonte é reprocessada na
  // próxima execução — no máximo MAX_DEFERRALS vezes, para um item problemático não travar
  // a fonte para sempre (aí avança e o descarte fica registrado em radar_runs).
  const failed = new Set([...(stats?.scoutFailed ?? []), ...(stats?.unfinishedSources ?? []), ...persistFailed]);
  const givenUp: string[] = [];
  const nowIso = new Date().toISOString();
  for (const f of fetched) {
    if (!f.page) continue;
    if (emptyPages.has(f.source.id)) {
      await supabase.from("radar_sources").update({
        last_checked_at: nowIso,
        last_status: "página sem texto (JavaScript ou anti-robô)",
        consecutive_failures: f.source.consecutive_failures + 1,
      }).eq("id", f.source.id);
      continue;
    }
    const isChanged = f.page.hash !== f.source.last_hash;
    const deferred = isChanged && failed.has(f.source.id) && (f.source.pending_retries ?? 0) < MAX_DEFERRALS;
    if (isChanged && failed.has(f.source.id) && !deferred) givenUp.push(f.source.name);
    await supabase.from("radar_sources").update({
      last_checked_at: nowIso,
      last_status: deferred ? `trabalho pendente (${(f.source.pending_retries ?? 0) + 1}/${MAX_DEFERRALS})` : "ok",
      consecutive_failures: 0,
      pending_retries: deferred ? (f.source.pending_retries ?? 0) + 1 : 0,
      ...(isChanged && !deferred
        ? { last_hash: f.page.hash, last_text: f.page.binary ? null : f.page.text.slice(0, SNAPSHOT_MAX), last_changed_at: nowIso }
        : {}),
    }).eq("id", f.source.id);
  }

  await telemetry.flush(supabase);
  const summary = {
    sources_checked: due.length,
    sources_changed: changed.length + documentChanges.length,
    candidates: stats?.candidates ?? 0,
    updates_published: published,
    updates_pending: pending,
    errors,
  };
  await supabase.from("radar_runs").update({
    ...summary,
    finished_at: new Date().toISOString(),
    details: { stats, sources_given_up: givenUp, elapsed_ms: Date.now() - startedAt },
  }).eq("id", run.id);

  return jsonResponse({ run_id: run.id, ...summary, degraded: stats?.degraded ?? [], elapsed_ms: Date.now() - startedAt });
}

// ---------------------------------------------------------------------------
// Rascunho de trilha
// ---------------------------------------------------------------------------

async function previousTracksSummary(supabase: Supa, orgao: string, banca: string | null): Promise<string> {
  const term = orgao.replace(/[%_,()]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 3).join("%");
  const filters = [term ? `organ.ilike.%${term}%` : null, banca ? `banca.eq.${banca.replace(/[,()]/g, " ")}` : null].filter(Boolean).join(",");
  if (!filters) return "";
  const { data } = await supabase.from("study_tracks")
    .select("name, banca, exam_date, study_track_modules(name, nivel, structure, study_track_subjects(area, cargo, subjects(name)))")
    .or(filters).limit(3);
  return (data ?? []).map((t: Record<string, unknown>) => {
    const mods = (t.study_track_modules as Record<string, unknown>[] ?? []).map((m) => {
      const subjects = (m.study_track_subjects as Record<string, unknown>[] ?? [])
        .map((s) => (s.subjects as { name?: string } | null)?.name).filter(Boolean).slice(0, 25).join(", ");
      return `  ${m.name} (${m.nivel}): quadro ${JSON.stringify(m.structure).slice(0, 600)}; matérias: ${subjects}`;
    }).join("\n");
    return `- ${t.name} (${t.banca}, prova ${t.exam_date ?? "?"})\n${mods}`;
  }).join("\n").slice(0, 8_000);
}

async function draftTrack(supabase: Supa, apiKey: string, adminId: string, body: Record<string, unknown>, startedAt: number) {
  const concursoId = String(body.concurso_id ?? "");
  if (!UUID_RE.test(concursoId)) return jsonResponse({ error: "concurso_id inválido" }, 400);
  const { data: c } = await supabase.from("radar_concursos").select("id, slug, nome, orgao, banca, data_prova, link_oficial, track_id")
    .eq("id", concursoId).maybeSingle();
  if (!c) return jsonResponse({ error: "Concurso não encontrado" }, 404);
  if (c.track_id) return jsonResponse({ error: "Este concurso já tem trilha" }, 409);

  let editalText = typeof body.edital_text === "string" ? body.edital_text.slice(0, 150_000) : "";
  if (editalText.length < 1500 && c.link_oficial) {
    const page = await fetchPage(c.link_oficial).catch(() => null);
    if (page && !page.binary) editalText = page.text.slice(0, 150_000);
  }
  if (editalText.length < 1500) {
    return jsonResponse({ error: "Cole o texto do edital (o link oficial é PDF ou não tem o conteúdo programático)." }, 422);
  }

  const telemetry = createTelemetry("radar-concursos");
  const llm = createGatewayClient({ apiKey, onCall: (meta) => telemetry.record(meta, { metadata: { concurso_id: c.id } }) });
  const strong = modelFromEnv("RADAR_TRACK_MODEL", DEFAULT_STRONG_MODEL);
  const result = await runTrackDraft(llm, {
    concurso: { slug: c.slug, nome: c.nome, orgao: c.orgao, banca: c.banca, data_prova: c.data_prova, link_oficial: c.link_oficial },
    editalText,
    previousTracks: await previousTracksSummary(supabase, c.orgao, c.banca),
  }, { architect: strong, banca: strong }, startedAt + intEnv("RADAR_RUN_BUDGET_MS", 140_000, 60_000, 380_000));
  await telemetry.flush(supabase);

  const { data: draft, error } = await supabase.from("radar_track_drafts").insert({
    concurso_id: c.id,
    status: result.draft ? "pendente_revisao" : "falhou",
    draft: result.draft ?? {},
    banca_profile: result.profile ?? {},
    warnings: result.warnings.slice(0, 40),
    error: result.error,
    created_by: adminId,
  }).select("id, status").single();
  if (error) return jsonResponse({ error: "Falha ao salvar o rascunho" }, 500);
  return jsonResponse({ draft_id: draft.id, status: draft.status, warnings: result.warnings, error: result.error });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!supabaseUrl || !serviceKey || !apiKey) return jsonResponse({ error: "Serviço indisponível" }, 503);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Autorização: cron (mesmo segredo do Vault usado pela fábrica de questões) ou admin.
  let cronSecret = Deno.env.get("QUESTION_CRON_SECRET") ?? "";
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  if (!cronSecret && providedSecret) {
    const { data } = await supabase.rpc("get_question_cron_secret");
    cronSecret = typeof data === "string" ? data : "";
  }
  const isCron = cronSecret.length >= 32 && providedSecret.length > 0 && timingSafeEqual(providedSecret, cronSecret);
  let adminId: string | null = null;
  if (!isCron) {
    const auth = await requireAdmin(supabase, req);
    if ("error" in auth) return auth.error;
    adminId = auth.user.id;
  }

  const body = (await readJson<Record<string, unknown>>(req, 200_000)) ?? {};
  const action = body.action === "draft_track" ? "draft_track" : "monitor";

  if (action === "draft_track") {
    if (!adminId) return jsonResponse({ error: "Acesso negado" }, 403);
    return await draftTrack(supabase, apiKey, adminId, body, startedAt);
  }
  const sourceId = typeof body.source_id === "string" && UUID_RE.test(body.source_id) ? body.source_id : null;
  return await monitor(supabase, apiKey, isCron ? "cron" : "admin", sourceId, startedAt);
}));
