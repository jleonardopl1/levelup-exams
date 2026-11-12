import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
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

/**
 * Planos -> preços do Stripe, definidos NO SERVIDOR (o app só envia "monthly" ou "annual").
 * Para trocar de ambiente (teste -> produção) basta mudar os secrets, sem tocar no código:
 *   STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL
 * Padrões = preços atuais (conferidos no Stripe em 11/11/2026):
 *   price_1SdkMf... = "Plus - Mensal" R$ 19,90/mês | price_1SdkO4... = "Plus Anual" R$ 159,90/ano
 */
const PLAN_PRICES: Record<"monthly" | "annual", { priceId: string; interval: "month" | "year" }> = {
  monthly: { priceId: (Deno.env.get("STRIPE_PRICE_MONTHLY") ?? "price_1SdkMfFQ1QkvCgEAnMRl3MXq").trim(), interval: "month" },
  annual: { priceId: (Deno.env.get("STRIPE_PRICE_ANNUAL") ?? "price_1SdkO4FQ1QkvCgEAJsa9KbIE").trim(), interval: "year" },
};
const PRICE_TO_PLAN = new Map(Object.entries(PLAN_PRICES).map(([plan, p]) => [p.priceId, plan as "monthly" | "annual"]));

function resolvePlan(body: { plan?: unknown; priceId?: unknown } | null): "monthly" | "annual" | null {
  if (body?.plan === "monthly" || body?.plan === "annual") return body.plan;
  // Compatibilidade com versões antigas do app que ainda enviam o ID do preço.
  if (typeof body?.priceId === "string") return PRICE_TO_PLAN.get(body.priceId) ?? null;
  return null;
}
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const REFERRAL_CODE_RE = /^[A-Z0-9]{4,20}$/;

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Valida o codigo de indicacao no servidor. Regras:
 *  - codigo ativo e nao removido;
 *  - nao e o codigo do proprio comprador;
 *  - o comprador ainda nao usou nenhum codigo (1 indicacao por usuario).
 */
async function resolveReferral(
  supabase: SupabaseClient,
  rawCode: unknown,
  userId: string,
): Promise<{ id: string; discount: number } | { error: string } | null> {
  if (rawCode === undefined || rawCode === null || rawCode === "") return null;
  if (typeof rawCode !== "string") return { error: "Código de indicação inválido" };
  const code = rawCode.trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return { error: "Código de indicação inválido" };

  const { data: ref } = await supabase
    .from("referral_codes")
    .select("id, user_id, discount_percent, is_active, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (!ref || !ref.is_active || ref.revoked_at) return { error: "Código de indicação inválido ou inativo" };
  if (ref.user_id === userId) return { error: "Você não pode usar o seu próprio código de indicação" };

  const { count } = await supabase
    .from("referral_uses")
    .select("id", { count: "exact", head: true })
    .eq("referred_user_id", userId);
  if ((count ?? 0) > 0) return { error: "Você já utilizou um código de indicação" };

  return { id: ref.id as string, discount: Number(ref.discount_percent) || 0 };
}

/** Cupom reutilizavel por percentual (primeira cobranca), criado sob demanda. */
async function ensureReferralCoupon(stripe: NonNullable<ReturnType<typeof getStripe>>, percent: number): Promise<string> {
  const id = `LEVELUP_REF_${percent}`;
  try {
    const existing = await stripe.coupons.retrieve(id);
    if (existing && !(existing as unknown as { deleted?: boolean }).deleted && existing.valid) return id;
  } catch {
    // inexistente: cria abaixo
  }
  try {
    await stripe.coupons.create({ id, percent_off: percent, duration: "once", name: `Indicação ${percent}%` });
  } catch (e) {
    // Corrida com outra requisicao criando o mesmo cupom: segue com o id.
    if ((e as { code?: string })?.code !== "resource_already_exists") throw e;
  }
  return id;
}

serve(withCors(async (req) => {
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

    const body = await readJson<{ plan?: unknown; priceId?: unknown; referralCode?: unknown }>(req, 4 * 1024);
    const plan = resolvePlan(body);
    if (!plan) {
      await logAuditEvent(supabase, "CHECKOUT_INVALID_PRICE", user.id, null, clientIp, userAgent, false, "Invalid plan");
      return jsonResponse({ error: "Plano inválido" }, 400);
    }
    const { priceId, interval } = PLAN_PRICES[plan];

    // Trava de segurança: o preço tem que estar ativo e ter a periodicidade do plano
    // escolhido. Evita cobrar o anual de quem escolheu o mensal (erro que já aconteceu).
    const price = await stripe.prices.retrieve(priceId).catch(() => null);
    if (!price || !price.active || price.recurring?.interval !== interval) {
      await logAuditEvent(supabase, "CHECKOUT_PRICE_MISCONFIGURED", user.id, null, clientIp, userAgent, false,
        `plan=${plan} price=${priceId} interval=${price?.recurring?.interval ?? "none"} active=${price?.active ?? "missing"}`);
      return jsonResponse({ error: "Plano temporariamente indisponível. Tente novamente mais tarde." }, 503);
    }

    const referral = await resolveReferral(supabase, body?.referralCode, user.id);
    if (referral && "error" in referral) {
      await logAuditEvent(supabase, "CHECKOUT_INVALID_REFERRAL", user.id, null, clientIp, userAgent, false, referral.error);
      return jsonResponse({ error: `${referral.error}. Remova o código para continuar.`, code: "referral_invalid" }, 400);
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
    const discounts = referral && referral.discount > 0
      ? [{ coupon: await ensureReferralCoupon(stripe, referral.discount) }]
      : undefined;
    const referralMeta: Record<string, string> = referral ? { referral_code_id: referral.id } : {};
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: { metadata: { supabase_user_id: user.id, ...referralMeta } },
      metadata: { supabase_user_id: user.id, ...referralMeta },
      ...(discounts ? { discounts } : { allow_promotion_codes: false }),
      success_url: `${siteUrl}/upgrade?success=true`,
      cancel_url: `${siteUrl}/upgrade?canceled=true`,
    }, { idempotencyKey: `checkout:${user.id}:${priceId}:${referral?.id ?? "none"}:${Math.floor(Date.now() / 60000)}` });

    await logAuditEvent(supabase, "CHECKOUT_CREATED", user.id, null, clientIp, userAgent, true, null, {
      plan,
      price_id: priceId,
      livemode: session.livemode,
      ...(referral ? { referral_code_id: referral.id } : {}),
    });
    return jsonResponse({ url: session.url });
  } catch {
    console.error("Checkout error");
    return jsonResponse({ error: "Não foi possível processar sua solicitação" }, 500);
  }
}));
