import { corsHeaders } from "./cors.ts";

export const escapeHtml = (str: string): string => {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/** Remove CR/LF e caracteres de controle (evita header/subject injection). */
export const stripControlChars = (str: string): string =>
  // deno-lint-ignore no-control-regex
  String(str).replace(/[\u0000-\u001F\u007F]+/g, " ").trim(); // eslint-disable-line no-control-regex

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

/**
 * IP do cliente para rate limit de endpoints ANONIMOS.
 * Cabecalhos de IP sao controlaveis pelo cliente em alguns caminhos de rede, por isso
 * endpoints autenticados devem limitar por user.id (ver rateLimitKey).
 */
export function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Extrai o token Bearer de forma estrita. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9\-_.]+)$/.exec(header.trim());
  return match ? match[1] : null;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface AuthedUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
}

/** Valida o JWT com o Supabase Auth e recusa usuarios banidos. */
export async function requireUser(
  supabase: SupabaseClient,
  req: Request,
): Promise<{ user: AuthedUser } | { error: Response }> {
  const token = getBearerToken(req);
  if (!token) return { error: jsonResponse({ error: "Não autorizado" }, 401) };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: jsonResponse({ error: "Sessão inválida ou expirada" }, 401) };
  }

  const { data: banned } = await supabase.rpc("is_user_banned", { p_user_id: data.user.id });
  if (banned === true) {
    return { error: jsonResponse({ error: "Conta suspensa" }, 403) };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      emailConfirmed: !!data.user.email_confirmed_at,
    },
  };
}

export async function requireAdmin(
  supabase: SupabaseClient,
  req: Request,
): Promise<{ user: AuthedUser } | { error: Response }> {
  const result = await requireUser(supabase, req);
  if ("error" in result) return result;
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: result.user.id,
    _role: "admin",
  });
  if (error || isAdmin !== true) {
    return { error: jsonResponse({ error: "Acesso negado" }, 403) };
  }
  return result;
}

/**
 * Rate limit atomico (RPC check_rate_limit). Fail-closed: se o banco falhar,
 * a requisicao e negada.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  endpoint: string,
  windowMs: number,
  maxRequests: number,
): Promise<{ allowed: boolean }> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_window_seconds: Math.ceil(windowMs / 1000),
    p_max: maxRequests,
  });
  if (error) {
    console.error("rate limit check failed");
    return { allowed: false };
  }
  return { allowed: data === true };
}

/** Le o corpo JSON com limite de tamanho. */
export async function readJson<T = unknown>(req: Request, maxBytes = 64 * 1024): Promise<T | null> {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return null;
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** URL publica do app (para redirects do Stripe). Nunca usar o header Origin. */
export function getSiteUrl(): string {
  const raw = Deno.env.get("SITE_URL") || Deno.env.get("ALLOWED_ORIGIN") || "https://simuladosconcursos.com.br";
  return raw.replace(/\/+$/, "");
}

export async function logAuditEvent(
  supabase: SupabaseClient,
  eventType: string,
  userId: string | null | undefined,
  userEmail: string | null | undefined,
  ipAddress: string | null,
  userAgent: string | null,
  success: boolean,
  errorMessage: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("audit_logs").insert({
      event_type: eventType,
      user_id: userId,
      user_email: userEmail,
      ip_address: ipAddress,
      user_agent: userAgent ? userAgent.slice(0, 300) : null,
      success,
      error_message: errorMessage ? errorMessage.slice(0, 500) : null,
      metadata,
    });
  } catch {
    console.error("Failed to log audit event");
  }
}
