/**
 * Mercado Pago (Checkout Pro) para pagamentos avulsos: Plus anual pré-pago e Passe Concurso.
 * Plano e decisões: docs/MERCADO_PAGO.md (D14).
 *
 * Sem imports remotos (só fetch e WebCrypto): as regras puras daqui são testadas offline em
 * mercadopago.test.ts. Quem concede acesso é a RPC apply_mp_payment, sempre com o pagamento
 * RELIDO na API do Mercado Pago — nunca com o corpo de uma notificação ou da URL de retorno.
 */

export const MP_API_BASE = "https://api.mercadopago.com";
/** Hosts do init_point do Checkout Pro no Brasil. O front só redireciona para estes. */
export const MP_CHECKOUT_HOSTS = new Set(["www.mercadopago.com.br"]);

export type MpProduct = "plus_annual" | "exam_pass";
export const MP_PRODUCTS: readonly MpProduct[] = ["plus_annual", "exam_pass"];

/** Validade do pedido e da preferência (o Pix pago depois disso ainda é honrado). */
export const ORDER_TTL_MINUTES = 60;
/** A renovação do anual pré-pago abre nos últimos 30 dias do período. */
export const RENEWAL_WINDOW_DAYS = 30;
/** Menor valor cobrado (centavos): evita pedido de R$ 0,00 por desconto mal configurado. */
export const MIN_AMOUNT_CENTS = 100;

/** Quem vê a oferta: ninguém, só a equipe (homologação) ou todos. */
export type MpAvailability = "off" | "staff" | "all";

export interface MpConfig {
  /**
   * MP_ENABLED=true liga a oferta para todos; MP_ENABLED=staff, só para a equipe (fase de
   * homologação). Webhook e sincronização funcionam mesmo desligado (estornos continuam chegando).
   */
  availability: MpAvailability;
  /**
   * Ambiente das credenciais: MP_LIVE_MODE=false para credenciais de teste. Pagamento de outro
   * ambiente é recusado, e o de teste dá no máximo 24 h de acesso (migration 20261120130000).
   */
  liveMode: boolean;
  accessToken: string;
  webhookSecret: string | null;
  /** Id da conta recebedora (obrigatório): pagamento de outra conta é recusado. */
  collectorId: string;
  priceAnnualCents: number | null;
  priceExamPassCents: number | null;
  maxInstallments: number;
  /** Só para exibir ("sem juros"); quem aplica é a configuração da conta no Mercado Pago. */
  interestFreeInstallments: number;
  notificationUrl: string | null;
}

type Env = { get(key: string): string | undefined };

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

function intEnv(env: Env, key: string): number | null {
  const raw = env.get(key)?.trim();
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
}

function priceEnv(env: Env, key: string): number | null {
  const cents = intEnv(env, key);
  return cents !== null && cents >= MIN_AMOUNT_CENTS ? cents : null;
}

/**
 * Lê a configuração dos secrets. Sem MP_ACCESS_TOKEN ou sem MP_COLLECTOR_ID, o Mercado Pago não
 * existe (null): sem a conta recebedora não há como recusar pagamento de outra conta.
 */
export function getMpConfig(env: Env = Deno.env): MpConfig | null {
  const accessToken = env.get("MP_ACCESS_TOKEN")?.trim();
  const collectorId = env.get("MP_COLLECTOR_ID")?.trim();
  if (!accessToken || !collectorId || !/^\d{1,20}$/.test(collectorId)) return null;
  const maxInstallments = clamp(intEnv(env, "MP_MAX_INSTALLMENTS") ?? 12, 1, 12);
  const notification = env.get("MP_NOTIFICATION_URL")?.trim() ?? "";
  const enabled = env.get("MP_ENABLED")?.trim().toLowerCase();
  return {
    availability: enabled === "true" ? "all" : enabled === "staff" ? "staff" : "off",
    // Fail-closed: só "false" explícito aceita pagamentos de teste.
    liveMode: env.get("MP_LIVE_MODE")?.trim().toLowerCase() !== "false",
    accessToken,
    webhookSecret: env.get("MP_WEBHOOK_SECRET")?.trim() || null,
    collectorId,
    priceAnnualCents: priceEnv(env, "MP_PRICE_PLUS_ANNUAL_CENTS"),
    priceExamPassCents: priceEnv(env, "MP_PRICE_EXAM_PASS_CENTS"),
    maxInstallments,
    interestFreeInstallments: clamp(intEnv(env, "MP_INTEREST_FREE_INSTALLMENTS") ?? 1, 1, maxInstallments),
    notificationUrl: /^https:\/\/[^\s]+$/.test(notification) ? notification : null,
  };
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/** Reais (número da API) -> centavos inteiros. */
export function toCents(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Desconto de indicação (percentual inteiro 0–100) arredondado ao centavo. */
export function applyDiscount(listCents: number, percent: number): { discountCents: number; amountCents: number } {
  const p = Number.isFinite(percent) ? clamp(Math.trunc(percent), 0, 100) : 0;
  const discountCents = Math.round((listCents * p) / 100);
  return { discountCents, amountCents: listCents - discountCents };
}

// ---------------------------------------------------------------------------
// Preferência do Checkout Pro
// ---------------------------------------------------------------------------

/** Data no formato aceito pela API, no horário de Brasília (-03:00, sem horário de verão). */
export function mpDate(d: Date): string {
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().replace("Z", "-03:00");
}

export interface PreferenceInput {
  orderId: string;
  product: MpProduct;
  title: string;
  amountCents: number;
  payerEmail: string;
  siteUrl: string;
  maxInstallments: number;
  expiresAt: Date;
  notificationUrl: string | null;
  now?: Date;
}

/**
 * Corpo de POST /checkout/preferences. Valor, parcelas e validade vêm do servidor; o pedido
 * interno vai como external_reference; a volta usa SITE_URL (nunca o header Origin).
 */
export function buildPreference(input: PreferenceInput): Record<string, unknown> {
  const back = `${input.siteUrl.replace(/\/+$/, "")}/upgrade?pedido=${encodeURIComponent(input.orderId)}`;
  const now = input.now ?? new Date();
  return {
    items: [{
      id: input.product,
      title: input.title.slice(0, 120),
      quantity: 1,
      unit_price: input.amountCents / 100,
      currency_id: "BRL",
    }],
    payer: { email: input.payerEmail },
    external_reference: input.orderId,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: "approved",
    payment_methods: {
      excluded_payment_types: [{ id: "ticket" }],
      installments: clamp(input.maxInstallments, 1, 12),
    },
    statement_descriptor: "LEVELUP",
    binary_mode: false,
    expires: true,
    expiration_date_from: mpDate(now),
    expiration_date_to: mpDate(input.expiresAt),
    date_of_expiration: mpDate(input.expiresAt),
    ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
  };
}

/** Só aceita init_point HTTPS de um host do Checkout Pro. */
export function isAllowedCheckoutUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && MP_CHECKOUT_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Assinatura das notificações (x-signature)
// ---------------------------------------------------------------------------

/** "ts=1704908010,v1=abc..." -> { ts, v1 }. */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const i = piece.indexOf("=");
    if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
  }
  if (!/^\d{1,20}$/.test(parts.ts ?? "") || !/^[0-9a-f]{64}$/i.test(parts.v1 ?? "")) return null;
  return { ts: parts.ts, v1: parts.v1.toLowerCase() };
}

/** Texto assinado: id:<data.id>;request-id:<x-request-id>;ts:<ts>; (partes ausentes saem). */
export function signatureManifest(dataId: string | null, requestId: string | null, ts: string): string {
  const id = dataId && /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId;
  return `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação em tempo constante (mesmo comprimento esperado: 64 hex). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Confere o x-signature da notificação. Sem data.id, ts ou v1, recusa. */
export async function verifyMpSignature(opts: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): Promise<boolean> {
  const parsed = parseSignatureHeader(opts.signature);
  if (!parsed || !opts.dataId || !opts.secret) return false;
  const expected = await hmacSha256Hex(opts.secret, signatureManifest(opts.dataId, opts.requestId, parsed.ts));
  return timingSafeEqual(expected, parsed.v1);
}

// ---------------------------------------------------------------------------
// Pagamento -> pedido
// ---------------------------------------------------------------------------

/** Campos de GET /v1/payments/{id} usados aqui. */
export interface MpPayment {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  currency_id?: string;
  collector_id?: number | string;
  payment_type_id?: string;
  installments?: number;
  date_approved?: string | null;
  date_created?: string | null;
  /** false = pagamento feito com credenciais de teste. */
  live_mode?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids de pagamento do Mercado Pago são numéricos; nada além disso vai para a URL da API. */
export const MP_PAYMENT_ID_RE = /^\d{1,20}$/;

export type PaymentCheck =
  | { ok: true; orderId: string }
  | { ok: false; reason: "no_reference" | "collector_mismatch" | "environment_mismatch" | "invalid_payment" };

/** Conferências que não dependem do pedido: id, referência, conta recebedora e ambiente. */
export function checkPayment(payment: MpPayment, cfg: Pick<MpConfig, "collectorId" | "liveMode">): PaymentCheck {
  if (!MP_PAYMENT_ID_RE.test(String(payment?.id ?? "")) || typeof payment.status !== "string") {
    return { ok: false, reason: "invalid_payment" };
  }
  const ref = typeof payment.external_reference === "string" ? payment.external_reference.trim() : "";
  if (!UUID_RE.test(ref)) return { ok: false, reason: "no_reference" };
  if (String(payment.collector_id ?? "") !== cfg.collectorId) {
    return { ok: false, reason: "collector_mismatch" };
  }
  // Sem o campo, recusa: um pagamento de teste não pode virar acesso real por omissão.
  if (payment.live_mode !== cfg.liveMode) return { ok: false, reason: "environment_mismatch" };
  return { ok: true, orderId: ref.toLowerCase() };
}

/** Argumentos de apply_mp_payment a partir do pagamento relido na API (já conferido). */
export function applyArgs(orderId: string, payment: MpPayment, liveMode: boolean) {
  return {
    p_order_id: orderId,
    p_payment_id: String(payment.id),
    p_status: String(payment.status ?? ""),
    p_status_detail: payment.status_detail ? String(payment.status_detail) : null,
    p_amount_cents: toCents(payment.transaction_amount),
    p_refunded_cents: toCents(payment.transaction_amount_refunded) ?? 0,
    p_currency: payment.currency_id ? String(payment.currency_id) : null,
    p_method_type: payment.payment_type_id ? String(payment.payment_type_id) : null,
    p_installments: Number.isInteger(payment.installments) ? payment.installments : null,
    p_approved_at: payment.date_approved ?? null,
    p_live_mode: liveMode,
  };
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ApplyOutcome =
  | { applied: true; result: Record<string, unknown> }
  | { applied: false; reason: string };

/**
 * Aplica um pagamento ao pedido. Pagamento sem pedido nosso ou de outra conta é ignorado
 * (fica na auditoria). Erro da RPC lança: o webhook responde 500 e o Mercado Pago repete.
 */
export async function applyPaymentToOrder(supabase: SupabaseClient, cfg: MpConfig, payment: MpPayment): Promise<ApplyOutcome> {
  const check = checkPayment(payment, cfg);
  if (!check.ok) {
    await audit(supabase, "MP_PAYMENT_IGNORED", null, { payment_id: String(payment?.id ?? ""), reason: check.reason });
    return { applied: false, reason: check.reason };
  }
  const { data, error } = await supabase.rpc("apply_mp_payment", applyArgs(check.orderId, payment, cfg.liveMode));
  if (error) throw new Error("apply_mp_payment failed");
  const result = (data ?? {}) as Record<string, unknown>;
  if (result.error === "order_not_found") {
    await audit(supabase, "MP_PAYMENT_IGNORED", null, { payment_id: String(payment.id), reason: "unknown_order" });
    return { applied: false, reason: "unknown_order" };
  }
  if (typeof result.error === "string") return { applied: false, reason: result.error };
  return { applied: true, result };
}

async function audit(supabase: SupabaseClient, eventType: string, userId: string | null, metadata: Record<string, unknown>) {
  try {
    await supabase.from("audit_logs").insert({ event_type: eventType, user_id: userId, metadata, success: false });
  } catch {
    console.error("[MP] audit insert failed");
  }
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

/** Erro da API sem o corpo da resposta (pode trazer dados do pagador). */
export class MpApiError extends Error {
  constructor(readonly status: number) {
    super(`Mercado Pago API ${status}`);
  }

  /** 400/404: repetir não muda nada (id inexistente ou de outro tópico). */
  get permanent(): boolean {
    return this.status === 400 || this.status === 404;
  }
}

export class MpClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await this.fetchImpl(`${MP_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new MpApiError(res.status);
    }
    return await res.json() as T;
  }

  /** Cria a preferência. A chave de idempotência é o id do pedido. */
  createPreference(body: Record<string, unknown>, idempotencyKey: string) {
    return this.request<{ id?: string; init_point?: string }>("POST", "/checkout/preferences", body, idempotencyKey);
  }

  async getPayment(id: string): Promise<MpPayment> {
    if (!MP_PAYMENT_ID_RE.test(id)) throw new MpApiError(400);
    return await this.request<MpPayment>("GET", `/v1/payments/${id}`);
  }

  /** Pagamentos de um pedido, do mais antigo ao mais novo. */
  async searchPaymentsByReference(externalReference: string): Promise<MpPayment[]> {
    if (!UUID_RE.test(externalReference)) return [];
    const qs = new URLSearchParams({
      external_reference: externalReference,
      sort: "date_created",
      criteria: "asc",
      limit: "20",
    });
    const data = await this.request<{ results?: MpPayment[] }>("GET", `/v1/payments/search?${qs}`);
    return Array.isArray(data.results) ? data.results : [];
  }
}
