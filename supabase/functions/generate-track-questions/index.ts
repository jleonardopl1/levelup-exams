/**
 * generate-track-questions
 *
 * Publica automaticamente questoes NOVAS para as materias das trilhas de estudo
 * (ex.: Camara de Cuiaba 2026). Meta: DAILY_PER_SUBJECT por materia por dia
 * (padrao 3 => 21/semana, acima do minimo de 15/semana exigido pela trilha).
 *
 * Fluxo por materia:
 *   1. monta o contexto (ementa do edital por nivel, topicos ja cobertos, ultimos
 *      enunciados para evitar repeticao e — nas materias "ai_grounded_only" — a base
 *      de fatos verificados extraida das explicacoes das questoes autorais);
 *   2. gera as questoes no padrao da banca (4 alternativas, 1 correta);
 *   3. um segundo passe REVISOR confere gabarito, unicidade da resposta e
 *      fundamentacao; so entram as aprovadas;
 *   4. valida, embaralha as alternativas, deduplica (content_hash) e grava com
 *      origem = 'ia_diaria'.
 *
 * Disparo:
 *   - pg_cron (migration 20261110130200) com o cabecalho x-cron-secret; ou
 *   - administrador autenticado (botao no painel Admin).
 *
 * Variaveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY,
 *            opcionais QUESTION_CRON_SECRET (sem ela, o segredo e lido do Vault pela
 *            RPC get_question_cron_secret), QUESTION_MODEL, QUESTION_REVIEW_MODEL,
 *            QUESTIONS_PER_SUBJECT_DAY.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { jsonResponse, readJson, requireAdmin } from "../_shared/utils.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-pro";
const UPSTREAM_TIMEOUT_MS = 65_000; // 2 chamadas sequenciais por materia, materias em paralelo
const MAX_SUBJECTS_PER_RUN = 3;
const TIME_ZONE_OFFSET = "-04:00"; // America/Cuiaba (sem horario de verao desde 2019)

type Nivel = "medio" | "superior";

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

interface SubjectContext {
  subjectId: string;
  name: string;
  slug: string;
  banca: string;
  trackName: string;
  grounded: boolean;
  modules: { nivel: Nivel; name: string; syllabus: string; cargo: string | null; area: string }[];
}

interface GeneratedQuestion {
  topico: string;
  dificuldade: "Fácil" | "Médio" | "Difícil";
  nivel: "ambos" | Nivel;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
}

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function todayInCuiaba(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Cuiaba" });
}

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** Mesmo algoritmo de scripts/build-track-seed.mjs (dedup entre seed e geracao). */
async function contentHash(enunciado: string, alternativas: string[]): Promise<string> {
  const data = new TextEncoder().encode(norm(enunciado) + "||" + alternativas.map(norm).sort().join("|"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const REFERS_TO_OTHERS = /anteriores|nenhuma das|todas as alternativas|^\s*(apenas\s+)?[IVX]+\b|\b[IVX]+\s*(,|e)\s*[IVX]+\b|^\s*[VF]\s*[-–,]\s*[VF]/i;

function shuffleAlternatives(q: GeneratedQuestion): GeneratedQuestion {
  if (q.alternativas.some((a) => REFERS_TO_OTHERS.test(a))) return q;
  const order = [0, 1, 2, 3];
  const rnd = new Uint32Array(4);
  crypto.getRandomValues(rnd);
  for (let i = 3; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, alternativas: order.map((k) => q.alternativas[k]), correta: order.indexOf(q.correta) };
}

function validate(q: unknown): GeneratedQuestion | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;
  const alts = o.alternativas;
  if (typeof o.enunciado !== "string" || o.enunciado.trim().length < 20 || o.enunciado.length > 2500) return null;
  if (!Array.isArray(alts) || alts.length !== 4) return null;
  if (!alts.every((a) => typeof a === "string" && a.trim().length > 0 && a.length <= 600)) return null;
  if (new Set(alts.map((a) => norm(a as string))).size !== 4) return null;
  if (!Number.isInteger(o.correta) || (o.correta as number) < 0 || (o.correta as number) > 3) return null;
  if (typeof o.explicacao !== "string" || o.explicacao.trim().length < 30 || o.explicacao.length > 2000) return null;
  const dificuldade = ["Fácil", "Médio", "Difícil"].includes(o.dificuldade as string) ? o.dificuldade : "Médio";
  const nivel = ["ambos", "medio", "superior"].includes(o.nivel as string) ? o.nivel : "ambos";
  return {
    topico: typeof o.topico === "string" ? o.topico.slice(0, 120) : "Geral",
    dificuldade: dificuldade as GeneratedQuestion["dificuldade"],
    nivel: nivel as GeneratedQuestion["nivel"],
    enunciado: o.enunciado.trim(),
    alternativas: (alts as string[]).map((a) => a.trim()),
    correta: o.correta as number,
    explicacao: o.explicacao.trim(),
  };
}

async function callModel(apiKey: string, model: string, system: string, user: string, tool: Record<string, unknown>) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      tools: [{ type: "function", function: tool }],
      tool_choice: { type: "function", function: { name: (tool as { name: string }).name } },
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (typeof args !== "string") throw new Error("resposta sem tool_call");
  return JSON.parse(args);
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const GENERATION_TOOL = {
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
            explicacao: { type: "string", description: "Justificativa didática com o fundamento (artigo de lei, conceito, cálculo) e por que as demais estão erradas." },
          },
          required: ["topico", "dificuldade", "nivel", "enunciado", "alternativas", "correta", "explicacao"],
        },
      },
    },
    required: ["questoes"],
  },
};

const REVIEW_TOOL = {
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
            motivo: { type: "string" },
          },
          required: ["indice", "aprovada"],
        },
      },
    },
    required: ["revisoes"],
  },
};

function generationPrompts(ctx: SubjectContext, count: number, recent: string[], topics: string[], facts: string[]) {
  const today = todayInCuiaba();
  const system = `Você é um elaborador sênior de questões de concursos públicos brasileiros, especialista na banca ${ctx.banca}.
Regras obrigatórias:
- Questões INÉDITAS, de múltipla escolha, com exatamente 4 alternativas e UMA única correta, no estilo da banca (enunciados contextualizados, distratores plausíveis, sem "todas/nenhuma das anteriores").
- Conteúdo estritamente dentro da ementa do edital informada e de acordo com a legislação, a jurisprudência e o entendimento técnico VIGENTES em ${today}.
- Nunca invente números de artigos, prazos, percentuais ou nomes. Se não tiver certeza absoluta de um dado, não o use.
- A explicação deve citar o fundamento (artigo, norma, conceito ou cálculo) e dizer por que as demais alternativas estão erradas.
- Português formal, norma-padrão, sem marcas de formatação.
- Não repita nem parafraseie questões já existentes listadas pelo usuário.`;

  const modules = ctx.modules
    .map((m) => `Nível ${m.nivel === "medio" ? "MÉDIO" : "SUPERIOR"} (${m.area}${m.cargo ? ` — ${m.cargo}` : ""}):\n${m.syllabus}`)
    .join("\n\n");
  const nivelRule = ctx.modules.length > 1
    ? `A matéria é cobrada em mais de um nível. Use nivel="ambos" quando o tópico constar da ementa de todos os níveis; use o nível específico ("medio" ou "superior") quando o tópico só existir na ementa daquele nível.`
    : `Use nivel="ambos".`;
  const grounded = ctx.grounded
    ? `\n\nATENÇÃO: esta matéria é de LEGISLAÇÃO LOCAL. Use EXCLUSIVAMENTE os fatos verificados abaixo (pode combiná-los, inverter o ângulo de cobrança ou criar situações-problema com eles), sem acrescentar nenhum dado externo:\n- ${facts.join("\n- ")}`
    : facts.length
      ? `\n\nBase de referência já validada (use para manter a precisão; não copie):\n- ${facts.slice(0, 15).join("\n- ")}`
      : "";

  const user = `Concurso: ${ctx.trackName}
Matéria: ${ctx.name}

Ementa do edital:
${modules}

${nivelRule}

Tópicos já cobertos (priorize os pouco explorados da ementa): ${topics.slice(0, 60).join("; ") || "nenhum"}

Enunciados recentes que NÃO podem ser repetidos:
${recent.map((r) => `- ${r}`).join("\n") || "- (nenhum)"}${grounded}

Gere ${count} questões inéditas, variando tópicos e dificuldade (pelo menos uma "Difícil"), e registre-as com a ferramenta salvar_questoes.`;
  return { system, user };
}

function reviewPrompts(ctx: SubjectContext, questions: GeneratedQuestion[], facts: string[]) {
  const system = `Você é um revisor técnico rigoroso de questões de concurso (${ctx.banca}). Reprove qualquer questão com: gabarito errado; mais de uma alternativa defensável; nenhuma correta; dado factual duvidoso, desatualizado ou inventado (artigos, prazos, percentuais); conteúdo fora da ementa; explicação que não sustenta o gabarito. Na dúvida, reprove.`;
  const grounded = ctx.grounded
    ? `\nFatos verificados permitidos (qualquer dado fora desta lista implica reprovação):\n- ${facts.join("\n- ")}`
    : "";
  const list = questions
    .map((q, i) => `#${i}\nEnunciado: ${q.enunciado}\n${q.alternativas.map((a, k) => `${"ABCD"[k]}) ${a}`).join("\n")}\nGabarito: ${"ABCD"[q.correta]}\nExplicação: ${q.explicacao}`)
    .join("\n\n");
  const user = `Matéria: ${ctx.name}${grounded}\n\nRevise cada questão e registre o veredito com a ferramenta registrar_revisao:\n\n${list}`;
  return { system, user };
}

// ---------------------------------------------------------------------------
// Processamento por materia
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type Supa = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function processSubject(
  supabase: Supa,
  apiKey: string,
  ctx: SubjectContext,
  missing: number,
  model: string,
  reviewModel: string,
) {
  const [{ data: recentRows }, { data: topicRows }, { data: factRows }] = await Promise.all([
    supabase.from("questions").select("enunciado").eq("subject_id", ctx.subjectId)
      .order("created_at", { ascending: false }).limit(40),
    supabase.from("questions").select("topico").eq("subject_id", ctx.subjectId).not("topico", "is", null).limit(1000),
    supabase.from("questions").select("explicacao").eq("subject_id", ctx.subjectId).eq("origem", "autoral")
      .not("explicacao", "is", null).limit(400),
  ]);

  const recent = (recentRows ?? []).map((r: { enunciado: string }) => r.enunciado.slice(0, 160));
  const topicCount = new Map<string, number>();
  for (const r of topicRows ?? []) topicCount.set(r.topico, (topicCount.get(r.topico) ?? 0) + 1);
  const topics = [...topicCount.entries()].sort((a, b) => a[1] - b[1]).map(([t, n]) => `${t} (${n})`);
  const allFacts = (factRows ?? []).map((r: { explicacao: string }) => r.explicacao);
  // Amostra aleatoria de fatos para variar o foco a cada dia.
  const facts = allFacts.sort(() => Math.random() - 0.5).slice(0, ctx.grounded ? 60 : 15);

  const askFor = missing + 2; // folga para as reprovacoes do revisor
  const gen = generationPrompts(ctx, askFor, recent, topics, facts);
  const generated = await callModel(apiKey, model, gen.system, gen.user, GENERATION_TOOL);
  const candidates = ((generated?.questoes ?? []) as unknown[]).map(validate).filter(Boolean) as GeneratedQuestion[];
  if (!candidates.length) return { requested: missing, inserted: 0, error: "nenhuma questão válida gerada" };

  const rev = reviewPrompts(ctx, candidates, facts);
  const review = await callModel(apiKey, reviewModel, rev.system, rev.user, REVIEW_TOOL);
  const approved = new Set<number>(
    ((review?.revisoes ?? []) as { indice: number; aprovada: boolean }[])
      .filter((r) => r && r.aprovada === true)
      .map((r) => r.indice),
  );
  const accepted = candidates.filter((_, i) => approved.has(i)).slice(0, missing);

  const allowedNivel = new Set(ctx.modules.map((m) => m.nivel));
  const rows = [];
  for (const q0 of accepted) {
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
  return { requested: missing, inserted, error: null as string | null };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  let cronSecret = Deno.env.get("QUESTION_CRON_SECRET") ?? "";
  if (!supabaseUrl || !serviceKey || !apiKey) return jsonResponse({ error: "Serviço indisponível" }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Autorizacao: cron (segredo compartilhado) ou administrador.
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  // Sem a variavel QUESTION_CRON_SECRET, o segredo e lido do Vault (o mesmo que o
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
  const perDay = Math.min(Math.max(Number(Deno.env.get("QUESTIONS_PER_SUBJECT_DAY") ?? 3) || 3, 1), 10);
  const maxSubjects = Math.min(Math.max(Number(body.max_subjects ?? MAX_SUBJECTS_PER_RUN) || MAX_SUBJECTS_PER_RUN, 1), 5);
  const model = Deno.env.get("QUESTION_MODEL") || DEFAULT_MODEL;
  const reviewModel = Deno.env.get("QUESTION_REVIEW_MODEL") || model;

  const { data: rows, error } = await supabase
    .from("study_track_subjects")
    .select("subject_id, syllabus, cargo, area, weekly_target, ai_grounded_only, subjects(name, slug), study_track_modules(nivel, name, study_tracks(name, banca, slug, is_active))");
  if (error) return jsonResponse({ error: "Falha ao carregar trilhas" }, 500);

  // Agrupa por materia (a mesma materia pode estar nos modulos medio e superior).
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
      modules: [],
    };
    ctx.grounded = ctx.grounded || r.ai_grounded_only;
    ctx.modules.push({ nivel: mod.nivel, name: mod.name, syllabus: r.syllabus ?? "", cargo: r.cargo, area: r.area });
    contexts.set(r.subject_id, ctx);
  }

  // Quantas questoes automaticas cada materia ja recebeu hoje (horario de Cuiaba).
  const dayStart = `${todayInCuiaba()}T00:00:00${TIME_ZONE_OFFSET}`;
  const pending: { ctx: SubjectContext; missing: number }[] = [];
  for (const ctx of contexts.values()) {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", ctx.subjectId)
      .eq("origem", "ia_diaria")
      .gte("created_at", dayStart);
    const missing = perDay - (count ?? 0);
    if (missing > 0) pending.push({ ctx, missing });
  }
  pending.sort((a, b) => b.missing - a.missing || Math.random() - 0.5);
  const batch = pending.slice(0, maxSubjects);

  const results = await Promise.all(
    batch.map(async ({ ctx, missing }) => {
      try {
        const r = await processSubject(supabase, apiKey, ctx, missing, model, reviewModel);
        const status = r.inserted >= missing ? "success" : r.inserted > 0 ? "partial" : "error";
        await supabase.from("question_generation_runs").insert({
          subject_id: ctx.subjectId, requested: missing, inserted: r.inserted, status, model, error: r.error,
        });
        return { subject: ctx.slug, requested: missing, inserted: r.inserted, status };
      } catch (e) {
        const message = e instanceof Error ? e.message.slice(0, 300) : "erro desconhecido";
        console.error("generate-track-questions:", ctx.slug, message);
        await supabase.from("question_generation_runs").insert({
          subject_id: ctx.subjectId, requested: missing, inserted: 0, status: "error", model, error: message,
        });
        return { subject: ctx.slug, requested: missing, inserted: 0, status: "error" };
      }
    }),
  );

  return jsonResponse({
    date: todayInCuiaba(),
    processed: results,
    remaining_subjects: Math.max(pending.length - batch.length, 0),
  });
}));
