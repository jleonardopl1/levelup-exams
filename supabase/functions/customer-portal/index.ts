import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp, getSiteUrl, jsonResponse, logAuditEvent, requireUser } from "../_shared/utils.ts";
import { findCustomerForUser, getStripe } from "../_shared/stripe.ts";

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 5;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const stripe = getStripe();
    if (!stripe) return jsonResponse({ error: "Serviço de pagamento indisponível" }, 503);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const rl = await checkRateLimit(supabase, `user:${user.id}`, "customer-portal", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!rl.allowed) {
      await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", user.id, null, clientIp, userAgent, false, "customer-portal");
      return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429, { "Retry-After": "60" });
    }

    const customer = await findCustomerForUser(stripe, user);
    if (!customer) {
      return jsonResponse({ error: "Nenhuma assinatura encontrada" }, 404);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${getSiteUrl()}/upgrade`,
    });

    await logAuditEvent(supabase, "PORTAL_ACCESSED", user.id, null, clientIp, userAgent, true);
    return jsonResponse({ url: portalSession.url });
  } catch {
    console.error("Portal error");
    return jsonResponse({ error: "Não foi possível processar sua solicitação" }, 500);
  }
}));
