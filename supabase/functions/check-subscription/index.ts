import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, jsonResponse, requireUser } from "../_shared/utils.ts";
import { findCustomerForUser, getCustomerEntitlement, getStripe } from "../_shared/stripe.ts";

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return jsonResponse({ error: "Método não permitido" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const stripe = getStripe();
    if (!stripe) return jsonResponse({ error: "Serviço de pagamento indisponível" }, 503);

    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    // Cada chamada consulta a API do Stripe: limitar para evitar abuso de custo/cota.
    const rl = await checkRateLimit(supabase, `user:${user.id}`, "check-subscription", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!rl.allowed) return jsonResponse({ error: "Muitas requisições" }, 429, { "Retry-After": "60" });

    const customer = await findCustomerForUser(stripe, user);
    const ent = customer
      ? await getCustomerEntitlement(stripe, customer.id)
      : { tier: "free" as const, subscriptionEnd: null };

    await supabase.from("profiles").update({ tier: ent.tier }).eq("user_id", user.id);

    return jsonResponse({
      subscribed: ent.tier === "plus",
      tier: ent.tier,
      subscription_end: ent.subscriptionEnd,
    });
  } catch {
    console.error("[CHECK-SUBSCRIPTION] error");
    return jsonResponse({ error: "Não foi possível verificar a assinatura" }, 500);
  }
});
