import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { checkRateLimit, jsonResponse, requireAdmin } from "../_shared/utils.ts";
import { getStripe } from "../_shared/stripe.ts";

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 10;

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return jsonResponse({ error: "Método não permitido" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const auth = await requireAdmin(supabase, req);
    if ("error" in auth) return auth.error;

    const rl = await checkRateLimit(supabase, `user:${auth.user.id}`, "admin-metrics", RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
    if (!rl.allowed) return jsonResponse({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" });

    const [{ count: totalUsers }, { count: totalQuizzes }, { count: premiumUsers }, { count: totalQuestions }] =
      await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("quiz_results").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).neq("tier", "free"),
        supabase.from("questions").select("id", { count: "exact", head: true }),
      ]);

    const stripeMetrics = { mrr: 0, totalRevenue: 0, activeSubscriptions: 0, canceledSubscriptions: 0 };
    const stripe = getStripe();
    if (stripe) {
      try {
        const activeSubs = await stripe.subscriptions.list({ status: "active", limit: 100 });
        stripeMetrics.activeSubscriptions = activeSubs.data.length;
        for (const sub of activeSubs.data) {
          for (const item of sub.items.data) {
            const amount = item.price.unit_amount || 0;
            const interval = item.price.recurring?.interval;
            if (interval === "month") stripeMetrics.mrr += amount;
            else if (interval === "year") stripeMetrics.mrr += Math.round(amount / 12);
          }
        }
        const canceledSubs = await stripe.subscriptions.list({ status: "canceled", limit: 100 });
        stripeMetrics.canceledSubscriptions = canceledSubs.data.length;
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
        const charges = await stripe.charges.list({ created: { gte: thirtyDaysAgo }, limit: 100 });
        stripeMetrics.totalRevenue = charges.data
          .filter((c: { paid: boolean; refunded: boolean }) => c.paid && !c.refunded)
          .reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);
      } catch {
        console.error("Stripe metrics error");
      }
    }

    return jsonResponse({
      users: { total: totalUsers || 0, premium: premiumUsers || 0, free: (totalUsers || 0) - (premiumUsers || 0) },
      content: { totalQuestions: totalQuestions || 0, totalQuizzes: totalQuizzes || 0 },
      revenue: stripeMetrics,
    });
  } catch {
    console.error("admin-metrics error");
    return jsonResponse({ error: "Erro interno" }, 500);
  }
}));
