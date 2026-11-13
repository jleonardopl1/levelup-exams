import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { checkRateLimit, jsonResponse, requireUser } from "../_shared/utils.ts";
import { findCustomerForUser, getCustomerEntitlement, getStripe } from "../_shared/stripe.ts";

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 20;

type PremiumAccess = {
  tier: "free" | "plus";
  billing_tier: "free" | "plus";
  source: "master" | "stripe" | "grant" | null;
  access_until: string | null;
};

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return jsonResponse({ error: "Método não permitido" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    // Cada chamada consulta a API do Stripe: limitar para evitar abuso de custo/cota.
    const rl = await checkRateLimit(supabase, `user:${user.id}`, "check-subscription", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!rl.allowed) return jsonResponse({ error: "Muitas requisições" }, 429, { "Retry-After": "60" });

    // 1. Assinatura paga (Stripe). Se o Stripe estiver fora, segue com o que o banco sabe:
    //    o Plus liberado pela administração (ou do admin master) não depende do Stripe.
    let stripeEnt: { tier: "free" | "plus"; subscriptionEnd: string | null } | null = null;
    const stripe = getStripe();
    if (stripe) {
      try {
        const customer = await findCustomerForUser(stripe, user);
        stripeEnt = customer
          ? await getCustomerEntitlement(stripe, customer.id)
          : { tier: "free", subscriptionEnd: null };
      } catch {
        console.error("[CHECK-SUBSCRIPTION] stripe error");
      }
    }

    // 2. Grava só o plano PAGO; o banco recalcula o plano efetivo (pago ou liberado) em
    //    profiles.tier. Sem resposta do Stripe, a escrita apenas recalcula (cortesia vencida).
    const patch = stripeEnt
      ? { billing_tier: stripeEnt.tier }
      : { updated_at: new Date().toISOString() };
    await supabase.from("profiles").update(patch).eq("user_id", user.id);

    // 3. Situação final (Stripe + liberação manual + admin master).
    const { data: access, error: accessError } = await supabase.rpc("get_premium_access", { p_user_id: user.id });
    if (accessError || !access) throw new Error("access lookup failed");
    const a = access as PremiumAccess;

    if (!stripeEnt && a.source !== "grant" && a.source !== "master") {
      // Comportamento anterior: sem confirmação do Stripe, não afirmar nada sobre a assinatura.
      return stripe
        ? jsonResponse({ error: "Não foi possível verificar a assinatura" }, 500)
        : jsonResponse({ error: "Serviço de pagamento indisponível" }, 503);
    }

    return jsonResponse({
      subscribed: a.tier === "plus",
      tier: a.tier,
      subscription_end: stripeEnt?.subscriptionEnd ?? null,
      source: a.source,
      // Assinatura paga no Stripe, independente da origem do acesso (o master também pode pagar).
      billing_tier: a.billing_tier,
      access_until: a.access_until,
    });
  } catch {
    console.error("[CHECK-SUBSCRIPTION] error");
    return jsonResponse({ error: "Não foi possível verificar a assinatura" }, 500);
  }
}));
