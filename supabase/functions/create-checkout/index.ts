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
 * Ordem de resolução do preço (a primeira que existir vence):
 *   1. secrets STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL (forçar um preço específico);
 *   2. lookup_key no Stripe: "levelup_plus_monthly" / "levelup_plus_annual" — criados na
 *      conta de PRODUÇÃO em 15/11/2026; assim a troca teste -> produção só exige a chave;
 *   3. preços da conta de TESTE (sandbox) conferidos em 11/11/2026.
 * Em qualquer caso, a periodicidade e o status do preço são conferidos antes de cobrar.
 */
type Plan = "monthly" | "annual";
const PLAN_PRICES: Record<Plan, { envPriceId: string | null; lookupKey: string; legacyPriceId: string; interval: "month" | "year" }> = {
  monthly: {
    envPriceId: Deno.env.get("STRIPE_PRICE_MONTHLY")?.trim() || null,
    lookupKey: "levelup_plus_monthly",
    legacyPriceId: "price_1SdkMfFQ1QkvCgEAnMRl3MXq",
    interval: "month",
  },
  annual: {
    envPriceId: Deno.env.get("STRIPE_PRICE_ANNUAL")?.trim() || null,
    lookupKey: "levelup_plus_annual",
    legacyPriceId: "price_1SdkO4FQ1QkvCgEAJsa9KbIE",
    interval: "year",
  },
};
const PRICE_TO_PLAN = new Map<string, Plan>(
  (Object.entries(PLAN_PRICES) as [Plan, (typeof PLAN_PRICES)[Plan]][]).flatMap(([plan, p]) =>
    [p.envPriceId, p.legacyPriceId].filter((id): id is string => !!id).map((id) => [id, plan] as [string, Plan])
  ),
);

/** Devolve o preço ativo do plano (ver ordem acima) ou null. */
async function resolvePrice(stripe: NonNullable<ReturnType<typeof getStripe>>, plan: Plan) {
  const cfg = PLAN_PRICES[plan];
  if (cfg.envPriceId) return await stripe.prices.retrieve(cfg.envPriceId).catch(() => null);
  const byKey = await stripe.prices.list({ lookup_keys: [cfg.lookupKey], active: true, limit: 1 }).catch(() => null);
  if (byKey?.data?.[0]) return byKey.data[0];
  return await stripe.prices.retrieve(cfg.legacyPriceId).catch(() => null);
}

function resolvePlan(body: { plan?: unknown; priceId?: unknown } | null): Plan | null {
  if (body?.plan === "monthly" || body?.plan === "annual") return body.plan;
  // Compatibilidade com versões antigas do app que ainda enviam o ID do preço.
  if (typeof body?.priceId === "string") return PRICE_TO_PLAN.get(body.priceId) ?? null;
  return null;
}
/**
 * Passe Concurso: pagamento único (mode=payment) que libera o Plus até 15 dias depois da
 * prova da trilha. Só aparece se STRIPE_PRICE_EXAM_PASS apontar para um preço avulso ativo.
 * Quem libera o acesso é o stripe-webhook (grant_exam_pass), nunca esta função.
 */
const EXAM_PASS_PRICE = (Deno.env.get("STRIPE_PRICE_EXAM_PASS") ?? "").trim();
const EXAM_PASS_EXTRA_DAYS = 15;

async function examPassOffer(stripe: NonNullable<ReturnType<typeof getStripe>>, supabase: SupabaseClient, trackId: unknown) {
  if (!EXAM_PASS_PRICE) return null;
  const price = await stripe.prices.retrieve(EXAM_PASS_PRICE).catch(() => null);
  if (!price || !price.active || price.type !== "one_time" || !price.unit_amount) return null;

  const today = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); // Cuiabá
  let query = supabase.from("study_tracks").select("id, short_name, exam_date")
    .eq("is_active", true).gte("exam_date", today).order("exam_date", { ascending: true }).limit(1);
  if (typeof trackId === "string" && /^[0-9a-f-]{36}$/i.test(trackId)) query = query.eq("id", trackId);
  const { data: track } = await query.maybeSingle();
  if (!track?.exam_date) return null;

  const until = new Date(`${track.exam_date}T00:00:00-04:00`);
  until.setUTCDate(until.getUTCDate() + EXAM_PASS_EXTRA_DAYS);
  return {
    priceId: EXAM_PASS_PRICE,
    amountCents: price.unit_amount as number,
    currency: (price.currency as string).toUpperCase(),
    track: { id: track.id as string, shortName: track.short_name as string, examDate: track.exam_date as string },
    accessUntil: until.toISOString(),
  };
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

    const body = await readJson<{ plan?: unknown; priceId?: unknown; referralCode?: unknown; trackId?: unknown; preview?: unknown }>(req, 4 * 1024);

    if (body?.plan === "exam_pass") {
      const offer = await examPassOffer(stripe, supabase, body.trackId);
      if (body.preview === true) {
        return jsonResponse(offer
          ? { available: true, amount_cents: offer.amountCents, currency: offer.currency, track: offer.track, access_until: offer.accessUntil }
          : { available: false });
      }
      if (!offer) return jsonResponse({ error: "Passe Concurso indisponível no momento." }, 503);

      const referral = await resolveReferral(supabase, body?.referralCode, user.id);
      if (referral && "error" in referral) {
        return jsonResponse({ error: `${referral.error}. Remova o código para continuar.`, code: "referral_invalid" }, 400);
      }

      let customer = await findCustomerForUser(stripe, user);
      if (customer) {
        const ent = await getCustomerEntitlement(stripe, customer.id);
        if (ent.tier === "plus") return jsonResponse({ error: "Você já possui uma assinatura ativa." }, 409);
        if (customer.metadata?.supabase_user_id !== user.id) {
          customer = await stripe.customers.update(customer.id, { metadata: { supabase_user_id: user.id } });
        }
      } else {
        customer = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
      }
      // Já tem Plus liberado por mais tempo que o passe? Não cobra à toa.
      const { data: access } = await supabase.rpc("get_premium_access", { p_user_id: user.id });
      const a = access as { source?: string | null; access_until?: string | null } | null;
      const grantEnd = a?.access_until ? new Date(a.access_until).getTime() : null;
      if (a?.source === "master" || (a?.source === "grant" && (grantEnd === null || grantEnd >= new Date(offer.accessUntil).getTime()))) {
        return jsonResponse({ error: "Seu Plus já vale até depois da prova." }, 409);
      }

      const siteUrl = getSiteUrl();
      const discounts = referral && referral.discount > 0
        ? [{ coupon: await ensureReferralCoupon(stripe, referral.discount) }]
        : undefined;
      const meta: Record<string, string> = {
        supabase_user_id: user.id,
        plan: "exam_pass",
        track_id: offer.track.id,
        ...(referral ? { referral_code_id: referral.id } : {}),
      };
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        client_reference_id: user.id,
        line_items: [{ price: offer.priceId, quantity: 1 }],
        mode: "payment",
        payment_intent_data: { metadata: meta },
        metadata: meta,
        ...(discounts ? { discounts } : { allow_promotion_codes: false }),
        success_url: `${siteUrl}/upgrade?success=true`,
        cancel_url: `${siteUrl}/upgrade?canceled=true`,
      }, { idempotencyKey: `exam-pass:${user.id}:${offer.track.id}:${referral?.id ?? "none"}:${Math.floor(Date.now() / 60000)}` });

      await logAuditEvent(supabase, "CHECKOUT_CREATED", user.id, null, clientIp, userAgent, true, null, {
        plan: "exam_pass",
        price_id: offer.priceId,
        track_id: offer.track.id,
        livemode: session.livemode,
        ...(referral ? { referral_code_id: referral.id } : {}),
      });
      return jsonResponse({ url: session.url });
    }

    const plan = resolvePlan(body);
    if (!plan) {
      await logAuditEvent(supabase, "CHECKOUT_INVALID_PRICE", user.id, null, clientIp, userAgent, false, "Invalid plan");
      return jsonResponse({ error: "Plano inválido" }, 400);
    }
    const { interval } = PLAN_PRICES[plan];

    // Trava de segurança: o preço tem que estar ativo e ter a periodicidade do plano
    // escolhido. Evita cobrar o anual de quem escolheu o mensal (erro que já aconteceu).
    const price = await resolvePrice(stripe, plan);
    if (!price || !price.active || price.recurring?.interval !== interval) {
      await logAuditEvent(supabase, "CHECKOUT_PRICE_MISCONFIGURED", user.id, null, clientIp, userAgent, false,
        `plan=${plan} price=${price?.id ?? "missing"} interval=${price?.recurring?.interval ?? "none"} active=${price?.active ?? "missing"}`);
      return jsonResponse({ error: "Plano temporariamente indisponível. Tente novamente mais tarde." }, 503);
    }
    const priceId = price.id;

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
