import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import {
  checkRateLimit,
  getClientIp,
  jsonResponse,
  logAuditEvent,
  readJson,
  requireUser,
  UUID_RE,
} from "../_shared/utils.ts";
import { modelFromEnv } from "../_shared/ai/llm.ts";
import { createTelemetry } from "../_shared/ai/telemetry.ts";
import { buildSystemPrompt, parseMode, promptVersionFor } from "./prompt.ts";

const DAILY_LIMIT = 6;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 40000;
const UPSTREAM_TIMEOUT_MS = 60000;
// "Explicar esta questão" (1ª mensagem com question_id) tem cota própria e não gasta as 6 perguntas.
const EXPLAIN_DAILY_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MODEL = "google/gemini-2.5-flash";
type ChatMessage = { role: "user" | "assistant"; content: string };

// deno-lint-ignore no-explicit-any
type Supabase = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Contexto do aluno montado no servidor (nunca vem do cliente): trilha, cargo, dias até a
 * prova, último Simulado Oficial e as matérias com pior acerto nos últimos 30 dias.
 */
async function buildStudentContext(supabase: Supabase, userId: string): Promise<string> {
  const lines: string[] = [];
  try {
    const { data: lastExam } = await supabase
      .from("mock_exams")
      .select("cargo, score, approved, finished_at, area_scores, study_track_modules(name, study_tracks(short_name, exam_date))")
      .eq("user_id", userId)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastExam) {
      const mod = (lastExam as Record<string, unknown>).study_track_modules as
        { name?: string; study_tracks?: { short_name?: string; exam_date?: string | null } } | null;
      const track = mod?.study_tracks;
      if (track?.short_name) lines.push(`Concurso: ${track.short_name} (${mod?.name ?? ""}), cargo ${lastExam.cargo}.`);
      if (track?.exam_date) {
        const days = Math.ceil((new Date(`${track.exam_date}T12:00:00-04:00`).getTime() - Date.now()) / DAY_MS);
        if (days >= 0) lines.push(`Faltam ${days} dias para a prova.`);
      }
      const areas = (Array.isArray(lastExam.area_scores) ? lastExam.area_scores : []) as
        { area: string; acertos: number; questoes: number }[];
      lines.push(
        `Último Simulado Oficial: ${lastExam.score}/100, ${lastExam.approved ? "habilitado" : "não habilitado"}` +
        (areas.length ? ` (${areas.map((a) => `${a.area} ${a.acertos}/${a.questoes}`).join("; ")}).` : "."),
      );
    }

    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const { data: attempts } = await supabase
      .from("user_question_attempts")
      .select("is_correct, questions(categoria)")
      .eq("user_id", userId)
      .gte("created_at", since)
      .limit(3000);
    const bySubject = new Map<string, { ok: number; n: number }>();
    for (const a of (attempts ?? []) as { is_correct: boolean; questions: { categoria: string } | null }[]) {
      const cat = a.questions?.categoria;
      if (!cat) continue;
      const v = bySubject.get(cat) ?? { ok: 0, n: 0 };
      v.n += 1;
      if (a.is_correct) v.ok += 1;
      bySubject.set(cat, v);
    }
    const weakest = [...bySubject.entries()]
      .filter(([, v]) => v.n >= 5)
      .sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)
      .slice(0, 3);
    if (weakest.length) {
      lines.push(`Matérias com menor acerto (30 dias): ${weakest
        .map(([cat, v]) => `${cat} ${Math.round((100 * v.ok) / v.n)}% de ${v.n}`).join("; ")}.`);
    }
  } catch {
    // Contexto é opcional: sem ele o Mentor responde como antes.
  }
  return lines.join("\n").slice(0, 1500);
}

const letter = (i: number | null | undefined) =>
  i === null || i === undefined || i < 0 ? "—" : String.fromCharCode(65 + i);

/**
 * Bloco da questão a explicar. Recusa questão de Simulado Oficial em andamento (o gabarito
 * vazaria) e questão que o aluno ainda não respondeu (o Mentor não é um gabarito avulso).
 */
async function loadQuestionBlock(
  supabase: Supabase, userId: string, questionId: string,
): Promise<{ block: string } | { error: string; status: number }> {
  const { data: openItem } = await supabase
    .from("mock_exam_items")
    .select("exam_id, mock_exams!inner(user_id, finished_at)")
    .eq("question_id", questionId)
    .eq("mock_exams.user_id", userId)
    .is("mock_exams.finished_at", null)
    .limit(1)
    .maybeSingle();
  if (openItem) return { error: "Termine o Simulado Oficial para ver a explicação desta questão.", status: 409 };

  const { data: attempt } = await supabase
    .from("user_question_attempts")
    .select("selected_index")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!attempt) return { error: "Responda a questão antes de pedir a explicação.", status: 409 };

  const { data: q } = await supabase
    .from("questions")
    .select("enunciado, alternativas, correta, explicacao, categoria, topico")
    .eq("id", questionId)
    .maybeSingle();
  if (!q) return { error: "Questão não encontrada", status: 404 };

  const alts = (q.alternativas as string[]).map((a, i) => `${letter(i)}) ${a}`).join("\n");
  return {
    block:
      `Questão que o aluno pediu para explicar (${q.categoria}${q.topico ? ` · ${q.topico}` : ""}):\n` +
      `${q.enunciado}\n\n${alts}\n\n` +
      `Resposta do aluno: ${letter(attempt.selected_index)}. Gabarito: ${letter(q.correta)}.\n` +
      (q.explicacao ? `Explicação oficial (fonte confiável; não contradiga): ${q.explicacao}\n` : "") +
      `Explique por que o gabarito está certo, por que a alternativa marcada está errada (se errou) e ` +
      `dê uma dica prática para não errar de novo. Não invente artigos de lei além dos citados na explicação oficial.`,
  };
}


function sanitizeMessages(raw: unknown): ChatMessage[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Formato de requisição inválido";
  if (raw.length > MAX_MESSAGES) return `Limite de mensagens excedido (máximo ${MAX_MESSAGES})`;
  let total = 0;
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") return "Formato de mensagem inválido";
    const { role, content } = m as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return "Função de mensagem inválida";
    if (typeof content !== "string" || content.trim().length === 0) return "Conteúdo da mensagem deve ser texto";
    if (content.length > MAX_MESSAGE_CHARS) return `Mensagem muito longa (máximo ${MAX_MESSAGE_CHARS} caracteres)`;
    total += content.length;
    // Somente role/content seguem para o provedor (descarta campos extras como "name", "tool_calls").
    out.push({ role, content });
  }
  if (total > MAX_TOTAL_CHARS) return "Conversa muito longa. Inicie uma nova conversa.";
  if (out[out.length - 1].role !== "user") return "A última mensagem deve ser do usuário";
  return out;
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!supabaseUrl || !supabaseServiceKey || !LOVABLE_API_KEY) {
    console.error("ai-mentor: missing configuration");
    return jsonResponse({ error: "Serviço indisponível" }, 503);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  try {
    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    // Rate limit por usuario autenticado (nao falsificavel, e nao penaliza varios
    // alunos atras do mesmo IP/NAT de uma escola).
    const byUser = await checkRateLimit(supabase, `user:${user.id}`, "ai-mentor", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!byUser.allowed) {
      await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", user.id, null, clientIp, userAgent, false, "ai-mentor");
      return jsonResponse({ error: "Muitas requisições. Aguarde um momento." }, 429, { "Retry-After": "60" });
    }

    // Plano efetivo calculado na hora (assinatura paga OU Plus liberado pela administração,
    // inclusive o fim do prazo de uma cortesia).
    const { data: tier, error: tierError } = await supabase.rpc("get_user_tier", { p_user_id: user.id });
    if (tierError) {
      return jsonResponse({ error: "Erro ao verificar perfil" }, 500);
    }
    if (tier !== "plus") {
      await logAuditEvent(supabase, "ACCESS_DENIED", user.id, null, clientIp, userAgent, false, "Non-plus user");
      return jsonResponse({ error: "O Mentor IA é exclusivo para assinantes Plus!" }, 403);
    }

    // Valida ANTES de consumir a cota.
    const body = await readJson<{ messages?: unknown; question_id?: unknown; mode?: unknown }>(req, 128 * 1024);
    const messages = sanitizeMessages(body?.messages);
    if (typeof messages === "string") {
      await logAuditEvent(supabase, "VALIDATION_FAILED", user.id, null, clientIp, userAgent, false, messages);
      return jsonResponse({ error: messages }, 400);
    }
    const questionId = typeof body?.question_id === "string" && UUID_RE.test(body.question_id) ? body.question_id : null;
    if (body?.question_id !== undefined && body?.question_id !== null && !questionId) {
      return jsonResponse({ error: "Questão inválida" }, 400);
    }

    // Modo do Mentor: "direto" (explica) ou "socratico" (guia com perguntas). Ausente = direto.
    const mode = parseMode(body?.mode);
    if (!mode) return jsonResponse({ error: "Modo do Mentor inválido" }, 400);

    let questionBlock: string | null = null;
    if (questionId) {
      const loaded = await loadQuestionBlock(supabase, user.id, questionId);
      if ("error" in loaded) return jsonResponse({ error: loaded.error }, loaded.status);
      questionBlock = loaded.block;
    }

    // A 1ª mensagem de uma explicação usa a cota de explicações; o resto, a cota de perguntas.
    const isExplanation = !!questionId && messages.length === 1;
    if (isExplanation) {
      const explain = await checkRateLimit(supabase, `user:${user.id}`, "ai-mentor-explain", DAY_MS, EXPLAIN_DAILY_LIMIT);
      if (!explain.allowed) {
        return jsonResponse({ error: `Você usou as ${EXPLAIN_DAILY_LIMIT} explicações de questões de hoje.` }, 429);
      }
    } else {
      // Consumo atomico da cota diaria (sem race condition).
      const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_mentor_quota", {
        p_user_id: user.id,
        p_limit: DAILY_LIMIT,
      });
      if (quotaError) return jsonResponse({ error: "Erro interno do servidor" }, 500);
      if (allowed !== true) {
        await logAuditEvent(supabase, "DAILY_LIMIT_REACHED", user.id, null, clientIp, userAgent, false, "Daily limit reached");
        return jsonResponse({ error: "Limite diário de perguntas atingido. Tente novamente amanhã!" }, 429);
      }
    }

    const studentContext = await buildStudentContext(supabase, user.id);
    const system: { role: "system"; content: string }[] = [{ role: "system", content: buildSystemPrompt(mode) }];
    if (studentContext) {
      system.push({
        role: "system",
        content: `Dados do aluno no app (use para personalizar quando ajudar; não repita a lista sem motivo):\n${studentContext}`,
      });
    }
    if (questionBlock) system.push({ role: "system", content: questionBlock });

    // Metadados apenas (nunca o conteudo das mensagens) vao para o log.
    await logAuditEvent(supabase, "AI_MENTOR_REQUEST", user.id, null, clientIp, userAgent, true, null, {
      messages_count: messages.length,
      explanation: isExplanation,
      with_context: !!studentContext,
      mode,
    });

    const model = modelFromEnv("MENTOR_MODEL", DEFAULT_MODEL);
    const startedAt = Date.now();
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [...system, ...messages],
        stream: true,
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    // Telemetria (só metadados): latência até o início da resposta em streaming.
    const telemetry = createTelemetry("ai-mentor");
    telemetry.record({
      agent: isExplanation ? "mentor-explicacao" : "mentor",
      model,
      promptVersion: promptVersionFor(mode),
      status: response.ok && response.body ? "ok" : "error",
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      inputTokens: null,
      outputTokens: null,
      ...(response.ok ? {} : { error: `gateway ${response.status}` }),
    }, { metadata: { streaming: true, with_context: !!studentContext, messages_count: messages.length, mode } });
    await telemetry.flush(supabase);

    if (!response.ok || !response.body) {
      const status = response.status;
      if (status === 429) return jsonResponse({ error: "Limite de requisições excedido" }, 429);
      if (status === 402) return jsonResponse({ error: "Serviço temporariamente indisponível" }, 503);
      return jsonResponse({ error: "Erro ao conectar com o Mentor IA" }, 502);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
    });
  } catch {
    console.error("AI Mentor error");
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
}));
