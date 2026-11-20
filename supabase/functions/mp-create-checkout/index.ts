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
import {
  applyDiscount,
  buildPreference,
  getMpConfig,
  isAllowedCheckoutUrl,
  MIN_AMOUNT_CENTS,
  MP_PRODUCTS,
  MpClient,
  type MpProduct,
  ORDER_TTL_MINUTES,
  RENEWAL_WINDOW_DAYS,
} from "../_shared/mercadopago.ts";
import { resolveReferral } from "../_shared/referral.ts";
import { findExamPassTrack } from "../_shared/exam-pass.ts";
import { findCustomerForUser, getCustomerEntitlement, getStripe } from "../_shared/stripe.ts";

/**
 * Checkout Pro do Mercado Pago: Pix ou cartão em até 12x para o Plus anual pré-pago e o
 * Passe Concurso. O app envia só a intenção ({ product, trackId?, referralCode? }); preço,
 * desconto, parcelas e validade são decididos aqui. Quem libera o acesso é o mp-webhook (ou
 * o mp-sync-order) com o pagamento relido na API, nunca esta função.
 * Com { preview: true } devolve a oferta para a tela mostrar o mesmo valor que será cobrado.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

type PremiumAccess = {
  source?: "master" | "stripe" | "mercadopago" | "grant" | null;
  billing_tier?: "free" | "plus";
  access_until?: string | null;
  paid_until?: string | null;
};

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const DAY_MS = 24 * 3600 * 1000;

/** Algo que o aluno já tem torna esta compra desnecessária? Devolve o motivo para a tela. */
async function conflictFor(
  supabase: SupabaseClient,
  user: { id: string; email: string | null; emailConfirmed: boolean },
  product: MpProduct,
  passUntil: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_premium_access", { p_user_id: user.id });
  if (error || !data) throw new Error("access lookup failed");
  const a = data as PremiumAccess;
  if (a.source === "master") return "Sua conta já tem o Plus permanente.";

  // Assinatura no cartão (Stripe): confere na Stripe quando possível; sem resposta, usa o banco.
  let stripePlus = a.billing_tier === "plus";
  const stripe = getStripe();
  if (stripe) {
    try {
      const customer = await findCustomerForUser(stripe, user);
      if (customer) stripePlus = (await getCustomerEntitlement(stripe, customer.id)).tier === "plus";
    } catch {
      console.error("[MP-CHECKOUT] stripe check failed");
    }
  }
  if (stripePlus) return "Você já tem uma assinatura Plus no cartão. Ela pode ser gerenciada na página de Planos.";

  const paidUntil = a.paid_until ? new Date(a.paid_until).getTime() : null;
  if (product === "plus_annual") {
    if (paidUntil && paidUntil - Date.now() > RENEWAL_WINDOW_DAYS * DAY_MS) {
      return `Seu Plus vale até ${fmtDay(a.paid_until!)}. A renovação abre ${RENEWAL_WINDOW_DAYS} dias antes do fim.`;
    }
    return null;
  }
  const passEnd = new Date(passUntil!).getTime();
  const grantEnd = a.source === "grant" ? (a.access_until ? new Date(a.access_until).getTime() : Infinity) : null;
  if ((paidUntil && paidUntil >= passEnd) || (grantEnd !== null && grantEnd >= passEnd)) {
    return "Seu Plus já vale até depois da prova.";
  }
  return null;
}

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });

  try {
    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const body = await readJson<{ product?: unknown; trackId?: unknown; referralCode?: unknown; preview?: unknown }>(req, 4 * 1024);
    const product = MP_PRODUCTS.find((p) => p === body?.product);
    if (!product) return jsonResponse({ error: "Produto inválido" }, 400);
    const preview = body?.preview === true;

    // A prévia é consultada ao abrir Planos: limite próprio, mais folgado que o do checkout.
    const rl = await checkRateLimit(supabase, `user:${user.id}`, preview ? "mp-offer" : "mp-create-checkout", 60_000, preview ? 30 : 5);
    if (!rl.allowed) {
      if (!preview) await logAuditEvent(supabase, "RATE_LIMIT_EXCEEDED", user.id, null, clientIp, userAgent, false, "mp-create-checkout");
      return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429, { "Retry-After": "60" });
    }

    const cfg = getMpConfig();
    const listCents = cfg?.enabled ? (product === "plus_annual" ? cfg.priceAnnualCents : cfg.priceExamPassCents) : null;
    const pass = listCents && product === "exam_pass" ? await findExamPassTrack(supabase, body?.trackId) : null;
    const available = !!cfg && !!listCents && (product === "plus_annual" || !!pass);

    if (preview) {
      return jsonResponse(available
        ? {
          available: true,
          product,
          amount_cents: listCents,
          currency: "BRL",
          max_installments: cfg!.maxInstallments,
          interest_free_installments: cfg!.interestFreeInstallments,
          ...(pass ? { track: pass.track, access_until: pass.accessUntil } : {}),
        }
        : { available: false, product });
    }
    if (!available) return jsonResponse({ error: "Pagamento por Pix e parcelado indisponível no momento." }, 503);

    if (!user.email || !user.emailConfirmed) {
      return jsonResponse({ error: "Confirme seu e-mail antes de pagar." }, 403);
    }

    const conflict = await conflictFor(supabase, user, product, pass?.accessUntil ?? null);
    if (conflict) return jsonResponse({ error: conflict, code: "already_covered" }, 409);

    const referral = await resolveReferral(supabase, body?.referralCode, user.id);
    if (referral && "error" in referral) {
      await logAuditEvent(supabase, "CHECKOUT_INVALID_REFERRAL", user.id, null, clientIp, userAgent, false, referral.error);
      return jsonResponse({ error: `${referral.error}. Remova o código para continuar.`, code: "referral_invalid" }, 400);
    }
    const { discountCents, amountCents } = applyDiscount(listCents!, referral?.discount ?? 0);
    if (amountCents < MIN_AMOUNT_CENTS) {
      return jsonResponse({ error: "Este código não vale para este pagamento. Remova o código para continuar.", code: "referral_invalid" }, 400);
    }

    const { data: created, error: orderError } = await supabase.rpc("create_payment_order", {
      p_user_id: user.id,
      p_product: product,
      p_track_id: pass?.track.id ?? null,
      p_list_amount_cents: listCents,
      p_discount_cents: discountCents,
      p_referral_code_id: referral?.id ?? null,
      p_access_until_fixed: pass?.accessUntil ?? null,
      p_ttl_minutes: ORDER_TTL_MINUTES,
    });
    const order = created as { order_id?: string; reused?: boolean; checkout_url?: string; expires_at?: string; error?: string } | null;
    if (orderError || !order) {
      console.error("[MP-CHECKOUT] create_payment_order failed");
      return jsonResponse({ error: "Pagamento por Pix e parcelado indisponível no momento." }, 503);
    }
    if (order.error === "busy") {
      return jsonResponse({ error: "Já estamos abrindo seu pagamento. Tente de novo em alguns segundos." }, 409);
    }
    if (order.error || !order.order_id || !order.expires_at) {
      return jsonResponse({ error: "Não foi possível abrir o pagamento." }, 400);
    }
    if (order.reused && isAllowedCheckoutUrl(order.checkout_url)) {
      return jsonResponse({ url: order.checkout_url, orderId: order.order_id });
    }

    const mp = new MpClient(cfg!.accessToken);
    let initPoint: string | undefined;
    let preferenceId: string | undefined;
    try {
      const pref = await mp.createPreference(buildPreference({
        orderId: order.order_id,
        product,
        title: product === "plus_annual" ? "LevelUp Exams Plus · 12 meses" : `Passe Concurso · ${pass!.track.shortName}`,
        amountCents,
        payerEmail: user.email,
        siteUrl: getSiteUrl(),
        maxInstallments: cfg!.maxInstallments,
        expiresAt: new Date(order.expires_at),
        notificationUrl: cfg!.notificationUrl,
      }), order.order_id);
      initPoint = pref.init_point;
      preferenceId = pref.id;
    } catch {
      console.error("[MP-CHECKOUT] preference error");
    }
    if (!preferenceId || !isAllowedCheckoutUrl(initPoint)) {
      // Libera o pedido: a próxima tentativa cria outro na hora.
      await supabase.from("payment_orders").update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", order.order_id).is("checkout_url", null);
      await logAuditEvent(supabase, "CHECKOUT_PROVIDER_ERROR", user.id, null, clientIp, userAgent, false, "mercadopago preference", { order_id: order.order_id });
      return jsonResponse({ error: "Não foi possível abrir o pagamento. Tente novamente em instantes." }, 502);
    }

    await supabase.from("payment_orders")
      .update({ provider_preference_id: preferenceId, checkout_url: initPoint, updated_at: new Date().toISOString() })
      .eq("id", order.order_id);
    await logAuditEvent(supabase, "CHECKOUT_CREATED", user.id, null, clientIp, userAgent, true, null, {
      provider: "mercadopago",
      plan: product,
      order_id: order.order_id,
      amount_cents: amountCents,
      ...(pass ? { track_id: pass.track.id } : {}),
      ...(referral ? { referral_code_id: referral.id } : {}),
    });
    return jsonResponse({ url: initPoint, orderId: order.order_id });
  } catch {
    console.error("[MP-CHECKOUT] error");
    return jsonResponse({ error: "Não foi possível processar sua solicitação" }, 500);
  }
}));
