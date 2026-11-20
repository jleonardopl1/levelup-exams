// Regras puras do Mercado Pago. Usa node:assert e node:crypto (sem rede), então roda também
// em sessões sem acesso ao deno.land.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  applyArgs,
  applyDiscount,
  applyPaymentToOrder,
  buildPreference,
  checkPayment,
  getMpConfig,
  isAllowedCheckoutUrl,
  MpApiError,
  MpClient,
  mpDate,
  parseSignatureHeader,
  signatureManifest,
  timingSafeEqual,
  toCents,
  verifyMpSignature,
} from "./mercadopago.ts";

const env = (vars: Record<string, string>) => ({ get: (k: string) => vars[k] });
const ORDER = "6f1c2b9e-3d4a-4b8e-9f10-1a2b3c4d5e6f";

Deno.test("config: sem token não existe; MP_ENABLED liga só o checkout", () => {
  assert.equal(getMpConfig(env({})), null);
  const off = getMpConfig(env({ MP_ACCESS_TOKEN: "APP_USR-x" }))!;
  assert.equal(off.enabled, false);
  assert.equal(off.maxInstallments, 12);
  assert.equal(off.priceAnnualCents, null);
  const on = getMpConfig(env({
    MP_ACCESS_TOKEN: "APP_USR-x",
    MP_ENABLED: "true",
    MP_PRICE_PLUS_ANNUAL_CENTS: "15990",
    MP_PRICE_EXAM_PASS_CENTS: "99", // abaixo do mínimo: oferta desligada
    MP_MAX_INSTALLMENTS: "18",
    MP_INTEREST_FREE_INSTALLMENTS: "20",
    MP_NOTIFICATION_URL: "http://inseguro.example",
  }))!;
  assert.equal(on.enabled, true);
  assert.equal(on.priceAnnualCents, 15990);
  assert.equal(on.priceExamPassCents, null);
  assert.equal(on.maxInstallments, 12);
  assert.equal(on.interestFreeInstallments, 12);
  assert.equal(on.notificationUrl, null);
});

Deno.test("valores: centavos e desconto de indicação", () => {
  assert.equal(toCents(159.9), 15990);
  assert.equal(toCents("143.91"), 14391);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(undefined), null);
  assert.deepEqual(applyDiscount(15990, 10), { discountCents: 1599, amountCents: 14391 });
  assert.deepEqual(applyDiscount(4990, 15), { discountCents: 749, amountCents: 4241 });
  assert.deepEqual(applyDiscount(15990, 0), { discountCents: 0, amountCents: 15990 });
  assert.deepEqual(applyDiscount(15990, 250), { discountCents: 15990, amountCents: 0 });
});

Deno.test("preferência: valor, parcelas, boleto excluído, volta pelo SITE_URL", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const pref = buildPreference({
    orderId: ORDER,
    product: "plus_annual",
    title: "LevelUp Exams Plus · 12 meses",
    amountCents: 14391,
    payerEmail: "aluno@example.com",
    siteUrl: "https://levelupexams.com.br/",
    maxInstallments: 12,
    expiresAt: new Date(now.getTime() + 3600_000),
    notificationUrl: null,
    now,
  });
  assert.deepEqual(pref.items, [{ id: "plus_annual", title: "LevelUp Exams Plus · 12 meses", quantity: 1, unit_price: 143.91, currency_id: "BRL" }]);
  assert.equal(pref.external_reference, ORDER);
  const back = `https://levelupexams.com.br/upgrade?pedido=${ORDER}`;
  assert.deepEqual(pref.back_urls, { success: back, pending: back, failure: back });
  assert.deepEqual(pref.payment_methods, { excluded_payment_types: [{ id: "ticket" }], installments: 12 });
  assert.equal(pref.expiration_date_from, "2026-11-20T09:00:00.000-03:00");
  assert.equal(pref.expiration_date_to, "2026-11-20T10:00:00.000-03:00");
  assert.equal("notification_url" in pref, false);
  assert.equal(mpDate(new Date("2026-01-01T02:30:00Z")), "2025-12-31T23:30:00.000-03:00");
});

Deno.test("redirecionamento só para o Checkout Pro em HTTPS", () => {
  assert.equal(isAllowedCheckoutUrl("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1"), true);
  assert.equal(isAllowedCheckoutUrl("http://www.mercadopago.com.br/checkout"), false);
  assert.equal(isAllowedCheckoutUrl("https://www.mercadopago.com.br.evil.com/checkout"), false);
  assert.equal(isAllowedCheckoutUrl("https://sandbox.mercadopago.com.br/checkout"), false);
  assert.equal(isAllowedCheckoutUrl(42), false);
});

Deno.test("assinatura: confere o HMAC do Mercado Pago e recusa alterações", async () => {
  const secret = "segredo-de-teste";
  const ts = "1732100000";
  const reqId = "bb56a2f1-6aae-46ac-982e-9dcd3581d08e";
  const v1 = createHmac("sha256", secret).update(`id:123456;request-id:${reqId};ts:${ts};`).digest("hex");
  const signature = `ts=${ts},v1=${v1}`;
  assert.equal(await verifyMpSignature({ signature, requestId: reqId, dataId: "123456", secret }), true);
  assert.equal(await verifyMpSignature({ signature, requestId: reqId, dataId: "123457", secret }), false);
  assert.equal(await verifyMpSignature({ signature, requestId: "outro", dataId: "123456", secret }), false);
  assert.equal(await verifyMpSignature({ signature, requestId: reqId, dataId: "123456", secret: "errado" }), false);
  assert.equal(await verifyMpSignature({ signature: `ts=1732100001,v1=${v1}`, requestId: reqId, dataId: "123456", secret }), false);
  assert.equal(await verifyMpSignature({ signature: null, requestId: reqId, dataId: "123456", secret }), false);
  assert.equal(await verifyMpSignature({ signature, requestId: reqId, dataId: null, secret }), false);
  // Ordem e espaços no cabeçalho não importam.
  assert.equal(await verifyMpSignature({ signature: ` v1=${v1.toUpperCase()} , ts=${ts}`, requestId: reqId, dataId: "123456", secret }), true);
});

Deno.test("assinatura: formato do cabeçalho e do texto assinado", () => {
  assert.equal(parseSignatureHeader("ts=abc,v1=00"), null);
  assert.equal(parseSignatureHeader("v1=" + "a".repeat(64)), null);
  assert.deepEqual(parseSignatureHeader(`ts=1,v1=${"A".repeat(64)}`), { ts: "1", v1: "a".repeat(64) });
  assert.equal(signatureManifest("ABC123", null, "9"), "id:abc123;ts:9;");
  assert.equal(signatureManifest("123", "r-1", "9"), "id:123;request-id:r-1;ts:9;");
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "ab"), false);
});

Deno.test("pagamento: referência, conta recebedora e argumentos da RPC", () => {
  const payment = {
    id: 987654321,
    status: "approved",
    status_detail: "accredited",
    external_reference: ORDER.toUpperCase(),
    transaction_amount: 143.91,
    transaction_amount_refunded: 0,
    currency_id: "BRL",
    collector_id: 555,
    payment_type_id: "credit_card",
    installments: 12,
    date_approved: "2026-11-20T10:00:00.000-03:00",
  };
  assert.deepEqual(checkPayment(payment, { collectorId: "555" }), { ok: true, orderId: ORDER });
  assert.deepEqual(checkPayment(payment, { collectorId: "999" }), { ok: false, reason: "collector_mismatch" });
  assert.deepEqual(checkPayment({ ...payment, external_reference: "pedido-123" }, { collectorId: null }), { ok: false, reason: "no_reference" });
  assert.deepEqual(checkPayment({ ...payment, id: "../v1/x" }, { collectorId: null }), { ok: false, reason: "invalid_payment" });
  assert.deepEqual(applyArgs(ORDER, payment), {
    p_order_id: ORDER,
    p_payment_id: "987654321",
    p_status: "approved",
    p_status_detail: "accredited",
    p_amount_cents: 14391,
    p_refunded_cents: 0,
    p_currency: "BRL",
    p_method_type: "credit_card",
    p_installments: 12,
    p_approved_at: "2026-11-20T10:00:00.000-03:00",
  });
});

function fakeSupabase(rpcResult: { data?: unknown; error?: unknown }) {
  const calls: { rpc: unknown[]; audits: unknown[] } = { rpc: [], audits: [] };
  const client = {
    rpc: (name: string, args: unknown) => { calls.rpc.push([name, args]); return Promise.resolve(rpcResult); },
    from: () => ({ insert: (row: unknown) => { calls.audits.push(row); return Promise.resolve({}); } }),
  };
  return { client, calls };
}

const CFG = getMpConfig(env({ MP_ACCESS_TOKEN: "x", MP_COLLECTOR_ID: "555" }))!;
const PAYMENT = { id: 1, status: "approved", external_reference: ORDER, transaction_amount: 10, currency_id: "BRL", collector_id: 555 };

Deno.test("applyPaymentToOrder: aplica, ignora pedido desconhecido e lança em erro do banco", async () => {
  const ok = fakeSupabase({ data: { order_id: ORDER, status: "paid" } });
  assert.deepEqual(await applyPaymentToOrder(ok.client, CFG, PAYMENT), { applied: true, result: { order_id: ORDER, status: "paid" } });
  assert.equal((ok.calls.rpc[0] as unknown[])[0], "apply_mp_payment");

  const unknown = fakeSupabase({ data: { error: "order_not_found" } });
  assert.deepEqual(await applyPaymentToOrder(unknown.client, CFG, PAYMENT), { applied: false, reason: "unknown_order" });
  assert.equal(unknown.calls.audits.length, 1);

  const foreign = fakeSupabase({ data: {} });
  assert.deepEqual(await applyPaymentToOrder(foreign.client, CFG, { ...PAYMENT, collector_id: 1 }), { applied: false, reason: "collector_mismatch" });
  assert.equal(foreign.calls.rpc.length, 0);

  const broken = fakeSupabase({ error: { message: "db down" } });
  await assert.rejects(() => applyPaymentToOrder(broken.client, CFG, PAYMENT));
});

Deno.test("cliente HTTP: idempotência, id numérico e erro sem corpo", async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const fakeFetch = ((url: string, init: RequestInit) => {
    seen.push({ url, init });
    if (url.includes("/v1/payments/search")) return Promise.resolve(new Response(JSON.stringify({ results: [{ id: 1 }] })));
    if (url.endsWith("/v1/payments/404")) return Promise.resolve(new Response("{\"payer\":\"dados\"}", { status: 404 }));
    return Promise.resolve(new Response(JSON.stringify({ id: "pref", init_point: "https://www.mercadopago.com.br/x" })));
  }) as typeof fetch;
  const mp = new MpClient("TOKEN", fakeFetch);

  await mp.createPreference({ a: 1 }, ORDER);
  const headers = seen[0].init.headers as Record<string, string>;
  assert.equal(headers["X-Idempotency-Key"], ORDER);
  assert.equal(headers.Authorization, "Bearer TOKEN");
  assert.equal(seen[0].url, "https://api.mercadopago.com/checkout/preferences");

  assert.deepEqual(await mp.searchPaymentsByReference(ORDER), [{ id: 1 }]);
  assert.match(seen[1].url, /external_reference=6f1c2b9e-3d4a-4b8e-9f10-1a2b3c4d5e6f&sort=date_created&criteria=asc/);
  assert.deepEqual(await mp.searchPaymentsByReference("nao-e-uuid"), []);

  await assert.rejects(() => mp.getPayment("1/../../users"), MpApiError);
  await assert.rejects(() => mp.getPayment("404"), (e: unknown) => e instanceof MpApiError && e.status === 404 && !e.message.includes("dados"));
});
