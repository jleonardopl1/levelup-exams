import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    // Fetch DB metrics
    const { count: totalUsers } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: totalQuizzes } = await supabaseClient
      .from("quiz_results")
      .select("*", { count: "exact", head: true });

    const { count: premiumUsers } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .neq("tier", "free");

    const { count: totalQuestions } = await supabaseClient
      .from("questions")
      .select("*", { count: "exact", head: true });

    // Stripe metrics
    let stripeMetrics = {
      mrr: 0,
      totalRevenue: 0,
      activeSubscriptions: 0,
      canceledSubscriptions: 0,
    };

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        const activeSubs = await stripe.subscriptions.list({ status: "active", limit: 100 });
        stripeMetrics.activeSubscriptions = activeSubs.data.length;

        let mrr = 0;
        for (const sub of activeSubs.data) {
          for (const item of sub.items.data) {
            const amount = item.price.unit_amount || 0;
            const interval = item.price.recurring?.interval;
            if (interval === "month") mrr += amount;
            else if (interval === "year") mrr += Math.round(amount / 12);
          }
        }
        stripeMetrics.mrr = mrr;

        const canceledSubs = await stripe.subscriptions.list({ status: "canceled", limit: 100 });
        stripeMetrics.canceledSubscriptions = canceledSubs.data.length;

        // Total revenue from balance transactions (last 30 days)
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
        const charges = await stripe.charges.list({
          created: { gte: thirtyDaysAgo },
          limit: 100,
        });
        stripeMetrics.totalRevenue = charges.data
          .filter((c) => c.paid && !c.refunded)
          .reduce((sum, c) => sum + c.amount, 0);
      } catch (e) {
        console.error("Stripe metrics error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        users: {
          total: totalUsers || 0,
          premium: premiumUsers || 0,
          free: (totalUsers || 0) - (premiumUsers || 0),
        },
        content: {
          totalQuestions: totalQuestions || 0,
          totalQuizzes: totalQuizzes || 0,
        },
        revenue: stripeMetrics,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && msg.includes("Forbidden") ? 403 : 500,
    });
  }
});
