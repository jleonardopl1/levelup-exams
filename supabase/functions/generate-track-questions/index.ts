/**
 * generate-track-questions — fábrica multiagente de questões das trilhas.
 *
 * Publica automaticamente questões NOVAS para as matérias das trilhas de estudo
 * (ex.: Câmara de Cuiabá 2026). Meta: DAILY_PER_SUBJECT por matéria por dia
 * (padrão 3 => 21/semana, acima do mínimo de 15/semana exigido pela trilha).
 *
 * Fluxo por matéria (detalhe em pipeline.ts e docs/ARQUITETURA_MULTIAGENTE.md §5.3):
 *   1. monta o contexto (ementa do edital por nível, tópicos já cobertos, últimos
 *      enunciados, fatos verificados e as LIÇÕES da matéria — reprovações anteriores);
 *   2. Elaborador gera as candidatas no padrão da banca;
 *   3. portão determinístico (esquema + falhas clássicas de elaboração);
 *   4. em paralelo: Solucionador(es) CEGO(s) resolvem sem gabarito e o Revisor técnico
 *      confere gabarito/fundamento; divergência vai para o Árbitro (modelo mais forte);
 *   5. valida, embaralha, deduplica (content_hash) e grava com origem = 'ia_diaria';
 *   6. grava telemetria (ai_runs) e as lições novas (ai_lessons).
 *
 * Disparo:
 *   - pg_cron (migration 20261110130200) com o cabeçalho x-cron-secret; ou
 *   - administrador autenticado (botão no painel Admin).
 *
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY e opcionais:
 *   QUESTION_CRON_SECRET  (sem ela, o segredo é lido do Vault pela RPC get_question_cron_secret)
 *   QUESTIONS_PER_SUBJECT_DAY (mínimo por matéria; weekly_target/7 pode elevar, até 10/dia)
 *   QUESTION_PIPELINE      "multiagent" (padrão) | "classic" (só elaborador + revisor, como antes)
 *   QUESTION_MODEL         elaborador (padrão google/gemini-2.5-pro)
 *   QUESTION_REVIEW_MODEL  revisor (padrão = QUESTION_MODEL)
 *   QUESTION_SOLVER_MODELS solucionador(es) cego(s), separados por vírgula (padrão google/gemini-2.5-flash)
 *   QUESTION_ARBITER_MODEL árbitro (padrão = QUESTION_MODEL)
 *   QUESTION_MAX_ARBITRATIONS por matéria (padrão 3) · QUESTION_RUN_BUDGET_MS (padrão 140000)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { jsonResponse, readJson, requireAdmin } from "../_shared/utils.ts";
import { createGatewayClient, LlmError, modelFromEnv, modelListFromEnv } from "../_shared/ai/llm.ts";
import { createTelemetry } from "../_shared/ai/telemetry.ts";
import { todayInCuiaba } from "./agents.ts";
import { loadLessons, saveLessons } from "./lessons.ts";
import { type PipelineConfig, type PipelineMode, type PipelineModels, runQualityPipeline } from "./pipeline.ts";
import { norm, shuffleAlternatives } from "./quality.ts";
import type { Nivel, SubjectContext } from "./types.ts";

const DEFAULT_MODEL = "google/gemini-2.5-pro";
const DEFAULT_SOLVER_MODEL = "google/gemini-2.5-flash";
const MAX_SUBJECTS_PER_RUN = 3;
const TIME_ZONE_OFFSET = "-04:00"; // America/Cuiaba (sem horário de verão desde 2019)

interface TrackSubjectRow {
  subject_id: string;
  syllabus: string | null;
  cargo: string | null;
  area: string;
  weekly_target: number;
  ai_grounded_only: boolean;
  subjects: { name: string; slug: string | null } | null;
  study_track_modules: {
    nivel: Nivel;
    name: string;
    study_tracks: { name: string; banca: string; slug: string; is_active: boolean } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Mesmo algoritmo de scripts/build-track-seed.mjs (dedup entre seed e geração). */
async function contentHash(enunciado: string, alternativas: string[]): Promise<string> {
  const data = new TextEncoder().encode(norm(enunciado) + "||" + alternativas.map(norm).sort().join("|"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const intEnv = (name: string, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number(Deno.env.get(name) ?? fallback) || fallback));

// ---------------------------------------------------------------------------
// Processamento por matéria
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type Supa = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function processSubject(
  supabase: Supa,
  llm: ReturnType<typeof createGatewayClient>,
  ctx: SubjectContext,
  missing: number,
  models: PipelineModels,
  config: PipelineConfig,
) {
  const [{ data: recentRows }, { data: topicRows }, { data: factRows }, lessons] = await Promise.all([
    supabase.from("questions").select("enunciado").eq("subject_id", ctx.subjectId)
      .order("created_at", { ascending: false }).limit(40),
    supabase.from("questions").select("topico").eq("subject_id", ctx.subjectId).not("topico", "is", null).limit(1000),
    supabase.from("questions").select("explicacao").eq("subject_id", ctx.subjectId).eq("origem", "autoral")
      .not("explicacao", "is", null).limit(400),
    loadLessons(supabase, ctx.subjectId),
  ]);

  const recent = (recentRows ?? []).map((r: { enunciado: string }) => r.enunciado.slice(0, 160));
  const topicCount = new Map<string, number>();
  for (const r of topicRows ?? []) topicCount.set(r.topico, (topicCount.get(r.topico) ?? 0) + 1);
  const topics = [...topicCount.entries()].sort((a, b) => a[1] - b[1]).map(([t, n]) => `${t} (${n})`);
  const allFacts = (factRows ?? []).map((r: { explicacao: string }) => r.explicacao);
  // Legislação local só pode ser gerada a partir de fatos verificados. Sem base
  // (ex.: trilha nova publicada pelo Radar de Concursos), não gera nada — falha fechada.
  if (ctx.grounded && allFacts.length < 10) {
    throw new Error("legislação local sem fatos verificados suficientes (cadastre questões autorais)");
  }
  // Amostra aleatória de fatos para variar o foco a cada dia.
  const facts = allFacts.sort(() => Math.random() - 0.5).slice(0, ctx.grounded ? 60 : 15);

  const outcome = await runQualityPipeline(llm, { ctx, missing, recent, topics, facts, lessons }, models, config);
  // A memória é gravada mesmo quando nada foi aprovado — é aí que ela mais ensina.
  await saveLessons(supabase, ctx.subjectId, outcome.lessons);

  const allowedNivel = new Set(ctx.modules.map((m) => m.nivel));
  const rows = [];
  for (const q0 of outcome.accepted) {
    const q = shuffleAlternatives(q0);
    let nivel: Nivel | null = null;
    if (ctx.modules.length > 1 && q.nivel !== "ambos" && allowedNivel.has(q.nivel)) nivel = q.nivel;
    rows.push({
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      correta: q.correta,
      categoria: ctx.name,
      dificuldade: q.dificuldade,
      explicacao: q.explicacao,
      subject_id: ctx.subjectId,
      is_premium: false,
      topico: q.topico,
      origem: "ia_diaria",
      nivel,
      content_hash: await contentHash(q.enunciado, q.alternativas),
    });
  }

  let inserted = 0;
  if (rows.length) {
    const { data, error } = await supabase
      .from("questions")
      .upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`insert: ${error.message}`);
    inserted = data?.length ?? 0;
  }
  const error = rows.length ? null : outcome.stats.generated ? "nenhuma questão aprovada pelos agentes" : "nenhuma questão válida gerada";
  return { requested: missing, inserted, error, stats: outcome.stats, lessons: outcome.lessons.length };
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
  let cronSecret = Deno.env.get("QUESTION_CRON_SECRET") ?? "";
  if (!supabaseUrl || !serviceKey || !apiKey) return jsonResponse({ error: "Serviço indisponível" }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Autorização: cron (segredo compartilhado) ou administrador.
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  // Sem a variável QUESTION_CRON_SECRET, o segredo é lido do Vault (o mesmo que o
  // pg_cron envia), por uma RPC exclusiva do service_role. Assim o segredo nasce e
  // fica dentro do banco, sem precisar ser copiado para o painel de Secrets.
  if (!cronSecret && providedSecret) {
    const { data: vaultSecret } = await supabase.rpc("get_question_cron_secret");
    cronSecret = typeof vaultSecret === "string" ? vaultSecret : "";
  }
  const isCron = cronSecret.length >= 32 && providedSecret.length > 0 && timingSafeEqual(providedSecret, cronSecret);
  if (!isCron) {
    const auth = await requireAdmin(supabase, req);
    if ("error" in auth) return auth.error;
  }

  const body = (await readJson<{ track_slug?: string; subject_slug?: string; max_subjects?: number }>(req, 4096)) ?? {};
  const perDay = intEnv("QUESTIONS_PER_SUBJECT_DAY", 3, 1, 10);
  const maxSubjects = Math.min(Math.max(Number(body.max_subjects ?? MAX_SUBJECTS_PER_RUN) || MAX_SUBJECTS_PER_RUN, 1), 5);

  const generator = modelFromEnv("QUESTION_MODEL", DEFAULT_MODEL);
  const models: PipelineModels = {
    generator,
    reviewer: modelFromEnv("QUESTION_REVIEW_MODEL", generator),
    solvers: modelListFromEnv("QUESTION_SOLVER_MODELS", [DEFAULT_SOLVER_MODEL]).slice(0, 3),
    arbiter: modelFromEnv("QUESTION_ARBITER_MODEL", generator),
  };
  const mode: PipelineMode = (Deno.env.get("QUESTION_PIPELINE") ?? "").trim() === "classic" ? "classic" : "multiagent";
  const config: PipelineConfig = {
    mode,
    maxArbitrations: intEnv("QUESTION_MAX_ARBITRATIONS", 3, 0, 10),
    // O pg_cron espera até 150 s pela resposta; o orçamento fica abaixo disso.
    deadline: startedAt + intEnv("QUESTION_RUN_BUDGET_MS", 140_000, 60_000, 380_000),
    now: Date.now,
  };

  const telemetry = createTelemetry("generate-track-questions");
  // Um cliente por matéria (rodam em paralelo), para a telemetria saber de qual matéria
  // é cada chamada. Só metadados são registrados, nunca o conteúdo.
  const llmFor = (subjectId: string) =>
    createGatewayClient({ apiKey, onCall: (meta) => telemetry.record(meta, { subjectId }) });

  const { data: rows, error } = await supabase
    .from("study_track_subjects")
    .select("subject_id, syllabus, cargo, area, weekly_target, ai_grounded_only, subjects(name, slug), study_track_modules(nivel, name, study_tracks(name, banca, slug, is_active))");
  if (error) return jsonResponse({ error: "Falha ao carregar trilhas" }, 500);

  // Agrupa por matéria (a mesma matéria pode estar nos módulos médio e superior).
  const contexts = new Map<string, SubjectContext>();
  for (const r of (rows ?? []) as unknown as TrackSubjectRow[]) {
    const mod = r.study_track_modules;
    const track = mod?.study_tracks;
    if (!mod || !track?.is_active || !r.subjects || r.weekly_target <= 0) continue;
    if (body.track_slug && track.slug !== body.track_slug) continue;
    if (body.subject_slug && r.subjects.slug !== body.subject_slug) continue;
    const ctx = contexts.get(r.subject_id) ?? {
      subjectId: r.subject_id,
      name: r.subjects.name,
      slug: r.subjects.slug ?? r.subject_id,
      banca: track.banca,
      trackName: track.name,
      grounded: false,
      dailyTarget: perDay,
      modules: [],
    };
    ctx.grounded = ctx.grounded || r.ai_grounded_only;
    // weekly_target alto (ex.: específicas do cargo, que precisam de 40 por Simulado Oficial)
    // aumenta a meta diária daquela matéria; nunca abaixo do mínimo global nem acima de 10.
    ctx.dailyTarget = Math.min(10, Math.max(ctx.dailyTarget, Math.ceil(r.weekly_target / 7)));
    ctx.modules.push({ nivel: mod.nivel, name: mod.name, syllabus: r.syllabus ?? "", cargo: r.cargo, area: r.area });
    contexts.set(r.subject_id, ctx);
  }

  // Quantas questões automáticas cada matéria já recebeu hoje (horário de Cuiabá).
  const dayStart = `${todayInCuiaba()}T00:00:00${TIME_ZONE_OFFSET}`;
  const pending: { ctx: SubjectContext; missing: number }[] = [];
  for (const ctx of contexts.values()) {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", ctx.subjectId)
      .eq("origem", "ia_diaria")
      .gte("created_at", dayStart);
    const missing = ctx.dailyTarget - (count ?? 0);
    if (missing > 0) pending.push({ ctx, missing });
  }
  pending.sort((a, b) => b.missing - a.missing || Math.random() - 0.5);
  const batch = pending.slice(0, maxSubjects);

  const results = await Promise.all(
    batch.map(async ({ ctx, missing }) => {
      try {
        const r = await processSubject(supabase, llmFor(ctx.subjectId), ctx, missing, models, config);
        const status = r.inserted >= missing ? "success" : r.inserted > 0 ? "partial" : "error";
        await supabase.from("question_generation_runs").insert({
          subject_id: ctx.subjectId, requested: missing, inserted: r.inserted, status, model: models.generator, error: r.error,
        });
        // Linha de fluxo de trabalho (invoke_workflow, nas convenções OTel GenAI): o resumo da matéria.
        telemetry.record(
          { agent: "orquestrador", model: "", promptVersion: "pipeline@2026-11-16", status: "ok", attempts: 1, latencyMs: Date.now() - startedAt, inputTokens: null, outputTokens: null },
          { subjectId: ctx.subjectId, metadata: { operation: "invoke_workflow", requested: missing, inserted: r.inserted, lessons: r.lessons, ...r.stats } },
        );
        return { subject: ctx.slug, requested: missing, inserted: r.inserted, status, stats: r.stats };
      } catch (e) {
        const message = (e instanceof LlmError || e instanceof Error ? e.message : "erro desconhecido").slice(0, 300);
        console.error("generate-track-questions:", ctx.slug, message);
        await supabase.from("question_generation_runs").insert({
          subject_id: ctx.subjectId, requested: missing, inserted: 0, status: "error", model: models.generator, error: message,
        });
        return { subject: ctx.slug, requested: missing, inserted: 0, status: "error" };
      }
    }),
  );

  await telemetry.flush(supabase);

  return jsonResponse({
    date: todayInCuiaba(),
    pipeline: mode,
    processed: results,
    remaining_subjects: Math.max(pending.length - batch.length, 0),
    elapsed_ms: Date.now() - startedAt,
  });
}));
