import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 5;

async function checkRateLimit(supabase: any, identifier: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { data: existing } = await supabase.from("rate_limits").select("*").eq("identifier", identifier).eq("endpoint", endpoint).gte("window_start", windowStart).maybeSingle();

  if (existing) {
    if (existing.request_count >= RATE_LIMIT_MAX_REQUESTS) return { allowed: false, remaining: 0 };
    await supabase.from("rate_limits").update({ request_count: existing.request_count + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - existing.request_count - 1 };
  }

  await supabase.from("rate_limits").upsert({ identifier, endpoint, request_count: 1, window_start: new Date().toISOString() }, { onConflict: "identifier,endpoint" });
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
}

async function logAuditEvent(supabase: any, eventType: string, userId: string | null | undefined, userEmail: string | null | undefined, ipAddress: string | null, userAgent: string | null, success: boolean, errorMessage: string | null = null, metadata: Record<string, unknown> = {}) {
  try {
    await supabase.from("audit_logs").insert({ event_type: eventType, user_id: userId, user_email: userEmail, ip_address: ipAddress, user_agent: userAgent, success, error_message: errorMessage, metadata });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return new Response(JSON.stringify({ error: "Payment service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

    const rateLimitResult = await checkRateLimit(supabase, clientIp, "customer-portal");
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
