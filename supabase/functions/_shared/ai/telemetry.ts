/**
 * Telemetria das chamadas de IA (tabela public.ai_runs).
 *
 * Coleta os metadados de cada chamada (agente, modelo, versão do prompt, tentativas,
 * latência, tokens) durante a requisição e grava tudo de uma vez no fim (`flush`).
 * Nunca guarda conteúdo de prompts nem respostas (LGPD: dados do aluno não saem daqui).
 *
 * É "best effort": se a tabela ainda não existir (função publicada antes da migration
 * 20261116120000_ai_runtime_observability.sql) ou o insert falhar, só registra um aviso.
 * A telemetria nunca derruba a funcionalidade.
 */
import type { LlmCallMeta } from "./llm.ts";

export interface AiRunRow {
  function_name: string;
  agent: string;
  model: string | null;
  prompt_version: string | null;
  status: "ok" | "error";
  attempts: number;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  subject_id: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
type Supabase = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Telemetry {
  /** Registra uma chamada; `extra` permite anexar subject_id e metadados não sensíveis. */
  record(meta: LlmCallMeta, extra?: { subjectId?: string | null; metadata?: Record<string, unknown> }): void;
  /** Linhas pendentes (útil em testes). */
  readonly rows: readonly AiRunRow[];
  /** Grava as linhas pendentes. Nunca lança. */
  flush(supabase: Supabase): Promise<void>;
}

export function toRow(
  functionName: string,
  meta: LlmCallMeta,
  extra: { subjectId?: string | null; metadata?: Record<string, unknown> } = {},
): AiRunRow {
  return {
    function_name: functionName,
    agent: meta.agent.slice(0, 60),
    model: meta.model ? meta.model.slice(0, 120) : null,
    prompt_version: meta.promptVersion ? meta.promptVersion.slice(0, 80) : null,
    status: meta.status,
    attempts: meta.attempts,
    latency_ms: Number.isFinite(meta.latencyMs) ? Math.round(meta.latencyMs) : null,
    input_tokens: meta.inputTokens,
    output_tokens: meta.outputTokens,
    subject_id: extra.subjectId ?? null,
    error: meta.error ? meta.error.slice(0, 300) : null,
    metadata: extra.metadata ?? {},
  };
}

export function createTelemetry(functionName: string): Telemetry {
  const rows: AiRunRow[] = [];
  return {
    rows,
    record(meta, extra) {
      rows.push(toRow(functionName, meta, extra));
    },
    async flush(supabase) {
      if (!rows.length) return;
      const batch = rows.splice(0, rows.length);
      try {
        const { error } = await supabase.from("ai_runs").insert(batch);
        if (error) console.warn(`telemetria de IA não gravada (${functionName}): ${String(error.message).slice(0, 120)}`);
      } catch {
        console.warn(`telemetria de IA não gravada (${functionName})`);
      }
    },
  };
}
