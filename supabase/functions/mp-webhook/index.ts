import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  applyPaymentToOrder,
  getMpConfig,
  MP_PAYMENT_ID_RE,
  MpApiError,
  MpClient,
  parseSignatureHeader,
  verifyMpSignature,
} from "../_shared/mercadopago.ts";

/**
 * Notificações do Mercado Pago (servidor a servidor, sem CORS).
 *  1. confere o x-signature ANTES de usar o corpo;
 *  2. só trata o tópico "payment" (merchant_order e outros são confirmados e ignorados);
 *  3. grava a notificação (descarta reentregas pela chave assinada: data.id + x-request-id + ts);
 *  4. relê o pagamento na API — o corpo é só um aviso — e aplica ao pedido (apply_mp_payment).
 * Em falha temporária libera a notificação e responde 500: o Mercado Pago tenta de novo.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[MP-WEBHOOK] ${step}${details ? " " + JSON.stringify(details) : ""}`);

const MAX_BODY_BYTES = 64 * 1024;

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cfg = getMpConfig();
  if (!cfg?.webhookSecret) {
    console.error("[MP-WEBHOOK] missing configuration");
    return json({ error: "Not configured" }, 500);
  }

  // Recusa pelo tamanho declarado antes de ler; o corpo lido também é conferido.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);
  let body: { id?: unknown; type?: unknown; topic?: unknown; data?: { id?: unknown } } = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: "Invalid body" }, 400);
  }

  // O Mercado Pago assina o data.id da query string (cai para o do corpo se faltar).
  const url = new URL(req.url);
  const rawDataId = url.searchParams.get("data.id") ?? (body?.data?.id !== undefined ? String(body.data.id) : null);
  const dataId = rawDataId && rawDataId.length <= 64 ? rawDataId : null;
  const requestId = req.headers.get("x-request-id");
  const signature = req.headers.get("x-signature");
  const valid = await verifyMpSignature({
    signature,
    requestId,
    dataId,
    secret: cfg.webhookSecret,
  });
  if (!valid) {
    log("Signature verification failed");
    return json({ error: "Invalid signature" }, 401);
  }

  const topic = String(body?.type ?? url.searchParams.get("type") ?? body?.topic ?? "");
  if (topic !== "payment") return json({ received: true });
  if (!dataId || !MP_PAYMENT_ID_RE.test(dataId)) return json({ received: true, ignored: "invalid_id" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Chave da reentrega só com campos assinados: repetir a mesma requisição assinada (trocando o
  // corpo, que não é assinado) não gera nova consulta à API.
  const ts = parseSignatureHeader(signature)!.ts;
  const eventId = `${dataId}:${(requestId ?? "").slice(0, 64)}:${ts}`;
  const { error: dupError } = await supabase
    .from("payment_provider_events")
    .insert({ provider: "mercadopago", event_id: eventId, topic, resource_id: dataId });
  if (dupError) {
    if ((dupError as { code?: string }).code === "23505") return json({ received: true, duplicate: true });
    console.error("[MP-WEBHOOK] could not record event");
    return json({ error: "Temporary failure" }, 500);
  }

  const markProcessed = () => supabase.from("payment_provider_events").update({ processed_at: new Date().toISOString() })
    .eq("provider", "mercadopago").eq("event_id", eventId);

  try {
    let payment;
    try {
      payment = await new MpClient(cfg.accessToken).getPayment(dataId);
    } catch (e) {
      // Pagamento inexistente (ou id de outro tópico): repetir não muda nada.
      if (e instanceof MpApiError && e.permanent) {
        log("Payment not found", { payment_id: dataId });
        await markProcessed();
        return json({ received: true, ignored: "not_found" });
      }
      throw e;
    }
    const outcome = await applyPaymentToOrder(supabase, cfg, payment);
    log(outcome.applied ? "Payment applied" : "Payment ignored", {
      payment_id: dataId,
      ...(outcome.applied ? { status: outcome.result.status } : { reason: outcome.reason }),
    });
    await markProcessed();
    return json({ received: true });
  } catch {
    console.error("[MP-WEBHOOK] processing error");
    await supabase.from("payment_provider_events").delete().eq("provider", "mercadopago").eq("event_id", eventId);
    return json({ error: "Processing error" }, 500);
  }
});
