import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCustomerEntitlement, getStripe } from "../_shared/stripe.ts";

// Webhook servidor-a-servidor: sem CORS (nao deve ser chamado por navegadores).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const log = (step: string, details?: Record<string, unknown>) =>
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? " " + JSON.stringify(details) : ""}`);

const RELEVANT_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripe = getStripe();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripe || !webhookSecret) {
    console.error("[STRIPE-WEBHOOK] missing configuration");
    return json({ error: "Not configured" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "No signature" }, 400);

  const body = await req.text();
  if (body.length > 512 * 1024) return json({ error: "Payload too large" }, 413);

  let event: Stripe.Event;
  try {
    // Versao async: obrigatoria no runtime Deno/WebCrypto. Tolerancia padrao de 300s contra replay.
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch {
    log("Signature verification failed");
    return json({ error: "Invalid signature" }, 400);
  }

  if (!RELEVANT_EVENTS.has(event.type)) return json({ received: true });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Idempotencia: ignora reentregas do mesmo evento.
  const { error: dupError } = await supabase
    .from("stripe_webhook_events")
    .insert({ id: event.id, type: event.type });
  if (dupError) {
    if ((dupError as { code?: string }).code === "23505") return json({ received: true, duplicate: true });
    console.error("[STRIPE-WEBHOOK] could not record event");
    return json({ error: "Temporary failure" }, 500); // Stripe re-tentara
  }

  try {
    const obj = event.data.object as { customer?: string | { id: string } | null; id?: string };
    const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
    if (!customerId) {
      log("Event without customer", { type: event.type, id: event.id });
      return json({ received: true });
    }

    if (event.type === "invoice.payment_failed") {
      await audit(supabase, "PAYMENT_FAILED", null, { stripe_customer_id: customerId, invoice_id: obj.id });
    }

    if (event.type === "checkout.session.completed") {
      await recordReferralConversion(supabase, event.data.object as Stripe.Checkout.Session);
    }

    // Nao confia no tipo/ordem do evento: recalcula o direito a partir do estado atual no Stripe.
    await syncCustomerTier(supabase, stripe, customerId);
    return json({ received: true });
  } catch {
    console.error("[STRIPE-WEBHOOK] processing error");
    // Libera o evento para que a re-tentativa do Stripe seja processada.
    await supabase.from("stripe_webhook_events").delete().eq("id", event.id);
    return json({ error: "Processing error" }, 500);
  }
});

async function resolveUserId(supabase: SupabaseClient, customer: Stripe.Customer): Promise<string | null> {
  // 1) Vinculo forte gravado no checkout.
  const metaId = customer.metadata?.supabase_user_id;
  if (metaId) {
    const { data } = await supabase.auth.admin.getUserById(metaId);
    if (data?.user?.id) return data.user.id;
  }
  // 2) Fallback: correspondencia EXATA de e-mail confirmado (antes: listUsers sem filtro,
  //    que atualizava o PRIMEIRO usuario da base em vez do pagante).
  if (customer.email) {
    const { data } = await supabase.rpc("get_user_id_by_email", { p_email: customer.email });
    if (typeof data === "string") return data;
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Atribui a venda ao afiliado. Os IDs vem do metadata gravado pelo create-checkout
 * (servidor) e chegam aqui por um evento com assinatura verificada. A RPC e
 * idempotente (sessao e indicado unicos), entao re-entregas nao duplicam comissao.
 */
async function recordReferralConversion(supabase: SupabaseClient, session: Stripe.Checkout.Session) {
  const referralCodeId = session.metadata?.referral_code_id;
  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id;
  if (!referralCodeId || !userId || !UUID_RE.test(referralCodeId) || !UUID_RE.test(userId)) return;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;

  const amount = (session.amount_total ?? 0) / 100; // valor efetivamente pago (ja com desconto)
  const { data, error } = await supabase.rpc("record_referral_conversion", {
    p_referral_code_id: referralCodeId,
    p_referred_user_id: userId,
    p_amount: amount,
    p_checkout_session_id: session.id,
  });
  if (error) throw new Error("referral conversion failed");
  log("Referral conversion", { referralCodeId, result: data });
}

async function syncCustomerTier(supabase: SupabaseClient, stripe: Stripe, customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted) {
    log("Customer deleted", { customerId });
    return;
  }

  const userId = await resolveUserId(supabase, customer as Stripe.Customer);
  if (!userId) {
    log("No matching user for customer", { customerId });
    await audit(supabase, "STRIPE_UNMATCHED_CUSTOMER", null, { stripe_customer_id: customerId });
    return;
  }

  const { tier } = await getCustomerEntitlement(stripe, customerId);
  const { error } = await supabase
    .from("profiles")
    .update({ tier, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error("profile update failed");

  log("Tier synced", { userId, tier });
  await audit(supabase, "TIER_UPDATED", userId, { stripe_customer_id: customerId, new_tier: tier });
}

async function audit(supabase: SupabaseClient, eventType: string, userId: string | null, metadata: Record<string, unknown>) {
  try {
    await supabase.from("audit_logs").insert({ event_type: eventType, user_id: userId, metadata, success: true });
  } catch {
    console.error("[STRIPE-WEBHOOK] audit insert failed");
  }
}
