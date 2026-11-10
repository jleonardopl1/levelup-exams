import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  getClientIp,
  getSiteUrl,
  jsonResponse,
  logAuditEvent,
  readJson,
  requireUser,
} from "../_shared/utils.ts";
import { findCustomerForUser, getCustomerEntitlement, getStripe } from "../_shared/stripe.ts";

const ALLOWED_PRICE_IDS = (Deno.env.get("STRIPE_ALLOWED_PRICE_IDS") ??
  "price_1SdkO4FQ1QkvCgEAJsa9KbIE,price_1SdkMfFQ1QkvCgEAnMRl3MXq").split(",").map((s) => s.trim()).filter(Boolean);
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    const stripe = getStripe();
    if (!stripe) return jsonResponse({ error: "Serviço de pagamento indisponível" }, 503);

    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const rl = await checkRateLimit(supabase, `user:${user.id}`, "create-checkout", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!rl.allowed) {
      await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", user.id, null, clientIp, userAgent, false, "create-checkout");
      return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429, { "Retry-After": "60" });
    }

    if (!user.email || !user.emailConfirmed) {
      return jsonResponse({ error: "Confirme seu e-mail antes de assinar." }, 403);
    }

    const body = await readJson<{ priceId?: unknown }>(req, 4 * 1024);
    const priceId = body?.priceId;
    if (typeof priceId !== "string" || !ALLOWED_PRICE_IDS.includes(priceId)) {
      await logAuditEvent(supabase, "CHECKOUT_INVALID_PRICE", user.id, null, clientIp, userAgent, false, "Invalid price ID");
      return jsonResponse({ error: "Plano inválido" }, 400);
    }

    let customer = await findCustomerForUser(stripe, user);
    if (customer) {
      // Evita assinatura duplicada (cobranca em dobro).
      const ent = await getCustomerEntitlement(stripe, customer.id);
      if (ent.tier === "plus") return jsonResponse({ error: "Você já possui uma assinatura ativa." }, 409);
      if (customer.metadata?.supabase_user_id !== user.id) {
        customer = await stripe.customers.update(customer.id, { metadata: { supabase_user_id: user.id } });
      }
    } else {
      customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
    }

    // Redirect fixo (SITE_URL). O header Origin e controlado pelo cliente e permitiria
    // redirecionar a vitima, apos o pagamento, para um dominio de phishing.
    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: { metadata: { supabase_user_id: user.id } },
      metadata: { supabase_user_id: user.id },
      success_url: `${siteUrl}/upgrade?success=true`,
      cancel_url: `${siteUrl}/upgrade?canceled=true`,
    }, { idempotencyKey: `checkout:${user.id}:${priceId}:${Math.floor(Date.now() / 60000)}` });

    await logAuditEvent(supabase, "CHECKOUT_CREATED", user.id, null, clientIp, userAgent, true, null, { price_id: priceId });
    return jsonResponse({ url: session.url });
  } catch {
    console.error("Checkout error");
    return jsonResponse({ error: "Não foi possível processar sua solicitação" }, 500);
  }
});
