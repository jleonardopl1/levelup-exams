import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, logAuditEvent } from "../_shared/utils.ts";

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return new Response(JSON.stringify({ error: "Payment service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const rateLimitResult = await checkRateLimit(supabase, clientIp, "customer-portal", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!rateLimitResult.allowed) {
      await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", null, null, clientIp, userAgent, false, "Rate limit exceeded");
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde um momento." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await logAuditEvent(supabase, "PORTAL_AUTH_FAILED", null, null, clientIp, userAgent, false, "No authorization header");
      return new Response(JSON.stringify({ error: "No authorization header provided" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user?.email) {
      await logAuditEvent(supabase, "PORTAL_AUTH_FAILED", null, null, clientIp, userAgent, false, userError?.message || "Invalid token");
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const user = userData.user;
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      await logAuditEvent(supabase, "PORTAL_NO_CUSTOMER", user.id, user.email, clientIp, userAgent, false, "No Stripe customer found");
      return new Response(JSON.stringify({ error: "No subscription found for this user" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin");
    if (!origin) {
      await logAuditEvent(supabase, "PORTAL_MISSING_ORIGIN", user.id, user.email, clientIp, userAgent, false, "Origin header required");
      return new Response(JSON.stringify({ error: "Origin header required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const portalSession = await stripe.billingPortal.sessions.create({ customer: customers.data[0].id, return_url: `${origin}/upgrade` });

    await logAuditEvent(supabase, "PORTAL_ACCESSED", user.id, user.email, clientIp, userAgent, true);

    return new Response(JSON.stringify({ url: portalSession.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Portal error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
