import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No stripe-signature header");
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Signature verification failed", { error: errMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Event verified", { type: event.type, id: event.id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    switch (event.type) {
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        logStep("Subscription deleted", { customerId, subscriptionId: subscription.id });
        
        await updateUserTier(supabaseClient, stripe, customerId, "free");
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        logStep("Subscription updated", { customerId, status, subscriptionId: subscription.id });

        if (status === "active" || status === "trialing") {
          await updateUserTier(supabaseClient, stripe, customerId, "plus");
        } else if (status === "canceled" || status === "unpaid" || status === "past_due") {
          await updateUserTier(supabaseClient, stripe, customerId, "free");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        logStep("Payment failed", { customerId, invoiceId: invoice.id });

        await logAuditEvent(supabaseClient, "PAYMENT_FAILED", customerId, {
          invoice_id: invoice.id,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        logStep("Payment succeeded", { customerId, invoiceId: invoice.id });

        await updateUserTier(supabaseClient, stripe, customerId, "plus");
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        logStep("Subscription created", { customerId, subscriptionId: subscription.id });

        if (subscription.status === "active" || subscription.status === "trialing") {
          await updateUserTier(supabaseClient, stripe, customerId, "plus");
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function updateUserTier(
  supabase: any,
  stripe: Stripe,
  customerId: string,
  tier: "free" | "plus"
) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      logStep("Customer deleted in Stripe", { customerId });
      return;
    }

    const email = customer.email;
    if (!email) {
      logStep("No email found for customer", { customerId });
      return;
    }

    logStep("Updating user tier", { email, tier });

    // Find user by email via profile instead of listing all users
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      // Fallback: try auth admin getUserByEmail (more efficient than listUsers)
      const { data: userData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        filter: email,
      });

      const user = userData?.users?.[0];
      if (!user) {
        logStep("No user found with email", { email });
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tier, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (updateError) {
        logStep("Error updating profile tier", { error: updateError.message });
        return;
      }

      logStep("Successfully updated user tier", { userId: user.id, email, tier });
      await logAuditEvent(supabase, "TIER_UPDATED", customerId, { user_id: user.id, email, new_tier: tier });
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ tier, updated_at: new Date().toISOString() })
      .eq("user_id", profile.user_id);

    if (updateError) {
      logStep("Error updating profile tier", { error: updateError.message });
      return;
    }

    logStep("Successfully updated user tier", { userId: profile.user_id, email, tier });
    await logAuditEvent(supabase, "TIER_UPDATED", customerId, { user_id: profile.user_id, email, new_tier: tier });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logStep("Error in updateUserTier", { error: errMessage });
  }
}

async function logAuditEvent(
  supabase: any,
  eventType: string,
  customerId: string,
  metadata: Record<string, unknown>
) {
  try {
    await supabase.from("audit_logs").insert({
      event_type: eventType,
      metadata: { stripe_customer_id: customerId, ...metadata },
      success: true,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logStep("Failed to log audit event", { error: errMessage });
  }
}
