import Stripe from "https://esm.sh/stripe@18.5.0";
import type { AuthedUser } from "./utils.ts";

export const STRIPE_API_VERSION = "2025-08-27.basil";

export function getStripe(): Stripe | null {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION });
}

/**
 * Localiza o cliente Stripe de um usuario.
 * Prioriza o vinculo forte (metadata.supabase_user_id) e so aceita vinculo por
 * e-mail quando o e-mail esta confirmado e o cliente nao pertence a outro usuario.
 */
export async function findCustomerForUser(
  stripe: Stripe,
  user: AuthedUser,
): Promise<Stripe.Customer | null> {
  if (!user.email || !user.emailConfirmed) return null;
  const customers = await stripe.customers.list({ email: user.email, limit: 10 });
  const live = customers.data.filter((c: Stripe.Customer) => !(c as unknown as { deleted?: boolean }).deleted);
  const owned = live.find((c: Stripe.Customer) => c.metadata?.supabase_user_id === user.id);
  if (owned) return owned;
  const unclaimed = live.find((c: Stripe.Customer) => !c.metadata?.supabase_user_id);
  return unclaimed ?? null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Fonte da verdade: consulta as assinaturas atuais do cliente no Stripe. */
export async function getCustomerEntitlement(
  stripe: Stripe,
  customerId: string,
): Promise<{ tier: "free" | "plus"; subscriptionEnd: string | null }> {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const active = subs.data.find((s: Stripe.Subscription) => ACTIVE_STATUSES.has(s.status));
  if (!active) return { tier: "free", subscriptionEnd: null };
  // A partir da API "basil", current_period_end fica nos itens da assinatura.
  const item = active.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const legacy = (active as unknown as { current_period_end?: number }).current_period_end;
  const end = item?.current_period_end ?? legacy;
  return { tier: "plus", subscriptionEnd: end ? new Date(end * 1000).toISOString() : null };
}

export function isAllowedStripeRedirect(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      (u.hostname === "checkout.stripe.com" || u.hostname === "billing.stripe.com");
  } catch {
    return false;
  }
}
