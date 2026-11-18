/**
 * Cliente LLM compartilhado das Edge Functions (camada de IA do LevelUp).
 *
 * Um único lugar para: chamada ao gateway (compatível com a API de chat da OpenAI),
 * saída estruturada por ferramenta obrigatória, validação do resultado, novas
 * tentativas com backoff exponencial + jitter, respeito a um prazo global (deadline)
 * e metadados de cada chamada (modelo, tentativas, latência, tokens) para telemetria.
 *
 * Princípios (docs/ARQUITETURA_MULTIAGENTE.md):
 *  - Saída do modelo é dado NÃO confiável: só sai daqui depois de passar pelo `parse`.
 *  - Falha fechada: sem resultado válido dentro do orçamento, lança LlmError.
 *  - Ciente de prazo: não começa uma tentativa que não caberia no tempo restante.
 *  - Testável: fetch, relógio e espera são injetáveis (ver llm.test.ts).
 */

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallOptions<T> {
  /** Papel do agente (ex.: "elaborador", "solucionador"); vai para a telemetria. */
  agent: string;
  /** Versão do prompt (ex.: "elaborador@2026-11-16"); permite comparar versões. */
  promptVersion: string;
  model: string;
  system: string;
  user: string;
  tool: ToolSpec;
  /** Valida e normaliza os argumentos da ferramenta. `null` = tentativa inválida. */
  parse: (args: unknown) => T | null;
  /** Tempo máximo de cada tentativa. */
  timeoutMs?: number;
  /** Total de tentativas (inclui a primeira). */
  maxAttempts?: number;
  /** Instante (epoch ms) a partir do qual nenhuma tentativa nova começa. */
  deadline?: number;
  temperature?: number;
}

export interface LlmCallMeta {
  agent: string;
  model: string;
  promptVersion: string;
  status: "ok" | "error";
  attempts: number;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  error?: string;
}

export interface LlmResult<T> {
  data: T;
  meta: LlmCallMeta;
}

export class LlmError extends Error {
  constructor(message: string, readonly meta: LlmCallMeta) {
    super(message);
    this.name = "LlmError";
  }
}

export interface LlmClient {
  callTool<T>(opts: ToolCallOptions<T>): Promise<LlmResult<T>>;
}

export interface GatewayClientOptions {
  apiKey: string;
  url?: string;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  /** Chamado ao fim de cada chamada (sucesso ou falha final) — use para telemetria. */
  onCall?: (meta: LlmCallMeta) => void;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 8_000;
const MIN_ATTEMPT_MS = 5_000;
/** Status HTTP em que vale tentar de novo (limite, sobrecarga, falha temporária). */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

/** Erro de uma tentativa: `retryable` decide se outra tentativa faz sentido. */
class AttemptError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly retryAfterMs: number | null = null) {
    super(message);
  }
}

/** Atraso antes da tentativa `attempt` (2, 3, ...): exponencial com jitter e teto. */
export function backoffDelay(attempt: number, random: () => number, retryAfterMs: number | null = null): number {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 2));
  const jitter = Math.floor(random() * 250);
  const hinted = retryAfterMs !== null ? Math.min(BACKOFF_CAP_MS, retryAfterMs) : 0;
  return Math.max(exp + jitter, hinted);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

function toInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createGatewayClient(options: GatewayClientOptions): LlmClient {
  const url = options.url ?? GATEWAY_URL;
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  async function attemptOnce<T>(opts: ToolCallOptions<T>, timeoutMs: number) {
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
          tools: [{ type: "function", function: opts.tool }],
          tool_choice: { type: "function", function: { name: opts.tool.name } },
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      throw new AttemptError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "falha de rede", true);
    }

    if (!res.ok) {
      // Corpo descartado de propósito: pode conter detalhes do provedor que não devem vazar.
      await res.body?.cancel().catch(() => {});
      throw new AttemptError(`gateway ${res.status}`, RETRYABLE_STATUS.has(res.status), parseRetryAfter(res.headers.get("retry-after")));
    }

    let payload: Record<string, unknown>;
    try {
      payload = await res.json();
    } catch {
      throw new AttemptError("resposta não é JSON", true);
    }
    const choices = payload?.choices as { message?: { tool_calls?: { function?: { arguments?: unknown } }[] } }[] | undefined;
    const rawArgs = choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (typeof rawArgs !== "string") throw new AttemptError("resposta sem tool_call", true);
    let args: unknown;
    try {
      args = JSON.parse(rawArgs);
    } catch {
      throw new AttemptError("argumentos da ferramenta não são JSON", true);
    }
    const data = opts.parse(args);
    if (data === null) throw new AttemptError("saída fora do esquema", true);
    const usage = payload.usage as { prompt_tokens?: unknown; completion_tokens?: unknown } | undefined;
    return { data, inputTokens: toInt(usage?.prompt_tokens), outputTokens: toInt(usage?.completion_tokens) };
  }

  return {
    async callTool<T>(opts: ToolCallOptions<T>): Promise<LlmResult<T>> {
      const started = now();
      const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_ATTEMPTS);
      const baseTimeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      let attempts = 0;
      let lastError = "sem tentativa";
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;

      const meta = (status: "ok" | "error", error?: string): LlmCallMeta => ({
        agent: opts.agent,
        model: opts.model,
        promptVersion: opts.promptVersion,
        status,
        attempts,
        latencyMs: now() - started,
        inputTokens,
        outputTokens,
        ...(error ? { error } : {}),
      });

      while (attempts < maxAttempts) {
        const remaining = opts.deadline !== undefined ? opts.deadline - now() : Infinity;
        if (remaining < MIN_ATTEMPT_MS) {
          lastError = attempts === 0 ? "sem tempo para chamar o modelo" : `${lastError}; sem tempo para nova tentativa`;
          break;
        }
        attempts += 1;
        try {
          const out = await attemptOnce(opts, Math.min(baseTimeout, remaining));
          inputTokens = out.inputTokens;
          outputTokens = out.outputTokens;
          const m = meta("ok");
          options.onCall?.(m);
          return { data: out.data, meta: m };
        } catch (e) {
          const err = e instanceof AttemptError ? e : new AttemptError("erro inesperado", false);
          lastError = err.message;
          if (!err.retryable || attempts >= maxAttempts) break;
          const delay = backoffDelay(attempts + 1, random, err.retryAfterMs);
          if (opts.deadline !== undefined && now() + delay + MIN_ATTEMPT_MS > opts.deadline) {
            lastError = `${lastError}; sem tempo para nova tentativa`;
            break;
          }
          await sleep(delay);
        }
      }

      const m = meta("error", lastError);
      options.onCall?.(m);
      throw new LlmError(`${opts.agent}: ${lastError}`, m);
    },
  };
}

/**
 * Modelo de um papel, configurável por variável de ambiente.
 * Separar os papéis permite usar modelos diferentes para quem gera e quem confere
 * (erros correlacionados são o maior risco de um "revisor" igual ao "autor").
 */
export function modelFromEnv(name: string, fallback: string): string {
  const v = (Deno.env.get(name) ?? "").trim();
  return v || fallback;
}

/** Lista de modelos (ex.: "google/gemini-2.5-flash,openai/gpt-5-mini"). */
export function modelListFromEnv(name: string, fallback: string[]): string[] {
  const list = (Deno.env.get(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
}
