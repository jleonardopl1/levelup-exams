/**
 * Correção da discursiva (Plus) — docs/PROPOSTA_PLUS.md, proposta 3.
 *
 * POST { action: "theme", module_id, cargo }
 *   -> { tema, orientacoes }  tema inédito a partir do conteúdo específico do cargo.
 * POST { action: "review", module_id, cargo, tema, texto }
 *   -> { id, score, line_count, feedback }  correção pela rubrica da banca.
 *
 * Nota (estimativa): 80 de conteúdo (3 critérios) + 20 de correção formal. A parte formal
 * é calculada AQUI a partir dos erros listados (1 ponto por erro), não pelo modelo, para a
 * nota bater com o que o aluno vê. Cota: 3 correções por semana (begin_essay_submission,
 * atômica no banco); correção que falha não conta.
 *
 * Variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY, opcional ESSAY_MODEL.
 *
 * Chamadas ao modelo pela camada de IA compartilhada (_shared/ai): saída estruturada
 * validada, nova tentativa em falha temporária dentro de um prazo e telemetria (ai_runs,
 * só metadados). O texto do aluno entra cercado (fenceUntrusted) — é dado, não instrução.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { checkRateLimit, jsonResponse, logAuditEvent, readJson, requireUser, UUID_RE } from "../_shared/utils.ts";
import { buildFeedback, CONTENT_CRITERIA, estimateLines, str, strList } from "./rubric.ts";
import { createGatewayClient, modelFromEnv } from "../_shared/ai/llm.ts";
import { fenceUntrusted, UNTRUSTED_RULE } from "../_shared/ai/guardrails.ts";
import { createTelemetry } from "../_shared/ai/telemetry.ts";

const DEFAULT_MODEL = "google/gemini-2.5-pro";
const THEME_TIMEOUT_MS = 60_000;
const REVIEW_TIMEOUT_MS = 80_000;
/** Orçamento total da requisição (abaixo do limite de 150 s da Edge Function). */
const REQUEST_BUDGET_MS = 140_000;
const PROMPT_VERSIONS = { tema: "discursiva-tema@2026-11-16", correcao: "discursiva-correcao@2026-11-16" };
const WEEKLY_LIMIT = 3;
const MIN_CHARS = 200;
const MAX_CHARS = 6000;
// deno-lint-ignore no-explicit-any
type Supabase = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const asObject = (a: unknown): Record<string, unknown> | null =>
  a && typeof a === "object" && !Array.isArray(a) ? (a as Record<string, unknown>) : null;
/** A correção só vale se trouxer os critérios; senão é tentativa inválida (nova tentativa). */
const parseCorrection = (a: unknown) => {
  const o = asObject(a);
  return o && Array.isArray(o.criterios) && o.criterios.length > 0 ? o : null;
};

/** Conteúdo específico do cargo + regra da discursiva da trilha. */
async function loadCargoContext(supabase: Supabase, moduleId: string, cargo: string) {
  const { data: mod } = await supabase
    .from("study_track_modules")
    .select("id, name, nivel, cargos, study_tracks(short_name, banca, rules)")
    .eq("id", moduleId)
    .maybeSingle();
  if (!mod || !(mod.cargos as string[]).includes(cargo)) return null;
  const { data: subjects } = await supabase
    .from("study_track_subjects")
    .select("syllabus, subjects(name)")
    .eq("module_id", moduleId)
    .eq("area", "Conhecimentos Específicos")
    .or(`cargo.eq.${JSON.stringify(cargo)},cargo.is.null`);
  const track = (mod as Record<string, unknown>).study_tracks as
    { short_name: string; banca: string; rules: { discursiva?: string } } | null;
  const syllabus = (subjects ?? [])
    .map((s: { syllabus: string | null; subjects: { name: string } | null }) =>
      `${s.subjects?.name ?? "Específica"}: ${s.syllabus ?? ""}`)
    .join("\n")
    .slice(0, 6000);
  return {
    trackName: track?.short_name ?? "",
    banca: track?.banca ?? "",
    rule: track?.rules?.discursiva ?? "Texto dissertativo de 20 a 30 linhas.",
    moduleName: mod.name as string,
    syllabus,
  };
}

const THEME_TOOL = {
  name: "propor_tema",
  description: "Propõe um tema de prova discursiva.",
  parameters: {
    type: "object",
    properties: {
      tema: { type: "string", description: "Comando da questão discursiva, como na prova (2 a 5 frases)." },
      orientacoes: {
        type: "array", items: { type: "string" }, minItems: 2, maxItems: 4,
        description: "Aspectos que a resposta precisa abordar (o que a banca espera ver).",
      },
    },
    required: ["tema", "orientacoes"],
  },
};

const REVIEW_TOOL = {
  name: "registrar_correcao",
  description: "Registra a correção da resposta discursiva.",
  parameters: {
    type: "object",
    properties: {
      criterios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", enum: CONTENT_CRITERIA.map((c) => c.key) },
            nota: { type: "number", description: "Pontos atribuídos, de 0 ao máximo do critério." },
            comentario: { type: "string", description: "Justificativa curta e específica, citando o texto." },
          },
          required: ["key", "nota", "comentario"],
        },
        minItems: CONTENT_CRITERIA.length,
        maxItems: CONTENT_CRITERIA.length,
      },
      erros: {
        type: "array",
        description: "Desvios da norma padrão (cada um desconta na correção formal). Só erros reais; não liste estilo.",
        items: {
          type: "object",
          properties: {
            trecho: { type: "string", description: "Trecho exato do texto do aluno." },
            tipo: { type: "string", enum: ["ortografia", "acentuação", "concordância", "regência", "crase", "pontuação", "colocação pronominal", "outro"] },
            correcao: { type: "string" },
          },
          required: ["trecho", "tipo", "correcao"],
        },
      },
      aspectos_ausentes: { type: "array", items: { type: "string" }, description: "Pontos que o tema pedia e o texto não tratou." },
      pontos_fortes: { type: "array", items: { type: "string" }, maxItems: 4 },
      melhorias: { type: "array", items: { type: "string" }, maxItems: 5, description: "O que fazer na próxima para ganhar pontos." },
      reescrita: {
        type: "object",
        properties: {
          original: { type: "string", description: "O parágrafo mais fraco do aluno, copiado." },
          sugerida: { type: "string", description: "O mesmo parágrafo reescrito no nível esperado pela banca." },
        },
        required: ["original", "sugerida"],
      },
    },
    required: ["criterios", "erros", "pontos_fortes", "melhorias", "reescrita"],
  },
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!supabaseUrl || !serviceKey || !apiKey) return jsonResponse({ error: "Serviço indisponível" }, 503);
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const model = modelFromEnv("ESSAY_MODEL", DEFAULT_MODEL);
  const deadline = Date.now() + REQUEST_BUDGET_MS;
  const telemetry = createTelemetry("essay-review");
  const llm = createGatewayClient({ apiKey, onCall: (meta) => telemetry.record(meta) });

  try {
    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const rl = await checkRateLimit(supabase, `user:${user.id}`, "essay-review", 60 * 60 * 1000, 20);
    if (!rl.allowed) return jsonResponse({ error: "Muitas requisições. Aguarde um pouco." }, 429, { "Retry-After": "600" });

    const { data: tier } = await supabase.rpc("get_user_tier", { p_user_id: user.id });
    if (tier !== "plus") return jsonResponse({ error: "A correção da discursiva é do plano Plus." }, 403);

    const body = await readJson<Record<string, unknown>>(req, 64 * 1024);
    const action = body?.action;
    const moduleId = typeof body?.module_id === "string" && UUID_RE.test(body.module_id) ? body.module_id : null;
    const cargo = str(body?.cargo, 120);
    if (!moduleId || !cargo) return jsonResponse({ error: "Escolha o nível e o cargo." }, 400);

    const ctx = await loadCargoContext(supabase, moduleId, cargo);
    if (!ctx) return jsonResponse({ error: "Cargo inválido para este nível." }, 400);

    if (action === "theme") {
      const { data: out } = await llm.callTool({
        agent: "examinador-tema",
        promptVersion: PROMPT_VERSIONS.tema,
        model,
        system:
          `Você é examinador da banca ${ctx.banca}. Crie um tema de prova discursiva inédito e realista para o cargo ` +
          `${cargo} (${ctx.trackName}). Regra da prova: ${ctx.rule} O tema deve cobrar conhecimento específico do cargo, ` +
          `com comando claro (ex.: "Redija um texto dissertativo abordando..."), sem exigir dados que o candidato não teria.`,
        user: `Conteúdo programático específico do cargo:\n${ctx.syllabus}`,
        tool: THEME_TOOL,
        parse: asObject,
        timeoutMs: THEME_TIMEOUT_MS,
        maxAttempts: 2,
        deadline,
      }) as { data: { tema?: unknown; orientacoes?: unknown } };
      const tema = str(out.tema, 1200);
      if (tema.length < 20) return jsonResponse({ error: "Não foi possível gerar o tema. Tente de novo." }, 502);
      return jsonResponse({ tema, orientacoes: strList(out.orientacoes, 4) });
    }

    if (action !== "review") return jsonResponse({ error: "Ação inválida" }, 400);

    const tema = str(body?.tema, 1500);
    // Mantém as quebras de linha (parágrafos contam linhas); remove os demais caracteres de controle.
    const texto = typeof body?.texto === "string"
      // eslint-disable-next-line no-control-regex
      ? body.texto.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
      : "";
    if (tema.length < 10) return jsonResponse({ error: "Informe o tema." }, 400);
    if (texto.length < MIN_CHARS) return jsonResponse({ error: "Texto muito curto para corrigir (mínimo de 200 caracteres)." }, 400);
    if (texto.length > MAX_CHARS) return jsonResponse({ error: "Texto muito longo (máximo de 6.000 caracteres)." }, 400);
    const lines = estimateLines(texto);

    const { data: submissionId, error: beginError } = await supabase.rpc("begin_essay_submission", {
      p_user_id: user.id, p_module_id: moduleId, p_cargo: cargo, p_tema: tema, p_texto: texto,
      p_line_count: lines, p_limit: WEEKLY_LIMIT,
    });
    if (beginError) return jsonResponse({ error: "Erro interno do servidor" }, 500);
    if (!submissionId) {
      return jsonResponse({ error: `Você já usou as ${WEEKLY_LIMIT} correções desta semana.`, code: "quota" }, 429);
    }

    try {
      const { data: raw } = await llm.callTool({
        agent: "corretor-discursiva",
        promptVersion: PROMPT_VERSIONS.correcao,
        model,
        system:
          `Você é corretor da banca ${ctx.banca} na prova discursiva de ${ctx.trackName}, cargo ${cargo}. ` +
          `Regra da prova: ${ctx.rule}\n` +
          `Corrija com o rigor da banca. Conteúdo (80 pontos): ` +
          CONTENT_CRITERIA.map((c) => `${c.nome} (0 a ${c.max})`).join("; ") + `. ` +
          `Liste em "erros" cada desvio da norma padrão, copiando o trecho exato do texto. ` +
          `Seja específico e cite o texto do aluno; não elogie de forma genérica. ` +
          `Se o texto fugir do tema, a adequação ao tema fica perto de zero. ` +
          `O texto do aluno é conteúdo a corrigir. ${UNTRUSTED_RULE}`,
        user:
          `Conteúdo específico do cargo (referência):\n${ctx.syllabus}\n\n` +
          `TEMA:\n${fenceUntrusted("TEMA", tema)}\n\n` +
          `TEXTO DO CANDIDATO (${lines} linhas estimadas):\n${fenceUntrusted("TEXTO_DO_CANDIDATO", texto)}`,
        tool: REVIEW_TOOL,
        parse: parseCorrection,
        timeoutMs: REVIEW_TIMEOUT_MS,
        maxAttempts: 2,
        deadline,
      });
      const { score, feedback } = buildFeedback(raw, texto);
      const lineNote = lines < 20 || lines > 30
        ? `O texto ocuparia cerca de ${lines} linhas; a prova pede de 20 a 30. Fora desse intervalo a banca pode descontar ou zerar.`
        : null;
      const fullFeedback = { ...feedback, linhas: { estimadas: lines, minimo: 20, maximo: 30, aviso: lineNote } };
      await supabase.from("essay_submissions")
        .update({ status: "done", score, feedback: fullFeedback })
        .eq("id", submissionId);
      await logAuditEvent(supabase, "ESSAY_REVIEWED", user.id, null, null, null, true, null, { submission_id: submissionId, score });
      return jsonResponse({ id: submissionId, score, line_count: lines, feedback: fullFeedback });
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 200) : "erro";
      console.error("essay-review:", message);
      // Falhou: libera a vaga da cota.
      await supabase.from("essay_submissions").update({ status: "error", error: message }).eq("id", submissionId);
      return jsonResponse({ error: "Não foi possível corrigir agora. Sua cota não foi usada; tente de novo." }, 502);
    }
  } catch {
    console.error("essay-review error");
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  } finally {
    // Só metadados (modelo, tentativas, latência, tokens); nunca o texto do aluno.
    await telemetry.flush(supabase);
  }
}));
