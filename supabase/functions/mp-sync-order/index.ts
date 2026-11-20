import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders, withCors } from "../_shared/cors.ts";
import { checkRateLimit, jsonResponse, readJson, requireUser, UUID_RE } from "../_shared/utils.ts";
import { applyPaymentToOrder, getMpConfig, MpClient } from "../_shared/mercadopago.ts";

/**
 * Situação de um pedido do próprio aluno, conferida no Mercado Pago. Usada na volta do
 * checkout (/upgrade?pedido=<id>) e pelo suporte: cobre webhook atrasado ou perdido.
 * Os parâmetros que o Mercado Pago acrescenta à URL de volta nunca são usados.
 */

// Sem pagamento confirmado: um Pix pago depois de um cartão recusado também conta.
const OPEN = new Set(["created", "pending", "expired", "failed", "canceled"]);

serve(withCors(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const auth = await requireUser(supabase, req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    // A tela consulta a cada poucos segundos enquanto o Pix não confirma.
    const rl = await checkRateLimit(supabase, `user:${user.id}`, "mp-sync-order", 60_000, 20);
    if (!rl.allowed) return jsonResponse({ error: "Muitas requisições" }, 429, { "Retry-After": "60" });

    const body = await readJson<{ orderId?: unknown }>(req, 1024);
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim().toLowerCase() : "";
    if (!UUID_RE.test(orderId)) return jsonResponse({ error: "Pedido inválido" }, 400);

    const select = "id, user_id, product, status, amount_cents, currency, payment_method_type, installments, paid_at, expires_at, checkout_url";
    const { data: before } = await supabase.from("payment_orders").select(select).eq("id", orderId).maybeSingle();
    if (!before || before.user_id !== user.id) return jsonResponse({ error: "Pedido não encontrado" }, 404);

    // Pedido ainda sem confirmação: pergunta ao Mercado Pago. Pedido pago também é conferido
    // (estorno ou disputa recentes), mas uma falha da API não impede a resposta.
    const cfg = getMpConfig();
    let checked = false;
    if (cfg && (OPEN.has(before.status) || before.paid_at)) {
      try {
        const payments = await new MpClient(cfg.accessToken).searchPaymentsByReference(orderId);
        for (const p of payments) await applyPaymentToOrder(supabase, cfg, p);
        checked = true;
      } catch {
        console.error("[MP-SYNC] provider error");
      }
    }

    const { data: order } = await supabase.from("payment_orders").select(select).eq("id", orderId).maybeSingle();
    if (!order) return jsonResponse({ error: "Pedido não encontrado" }, 404);
    const { data: access } = await supabase.rpc("get_premium_access", { p_user_id: user.id });
    const a = (access ?? {}) as { tier?: string; source?: string | null; access_until?: string | null; paid_until?: string | null };
    const isOpen = order.status === "created" || order.status === "pending";
    const stillValid = new Date(order.expires_at).getTime() > Date.now();
    return jsonResponse({
      checked,
      order: {
        id: order.id,
        product: order.product,
        status: isOpen && !stillValid ? "expired" : order.status,
        amount_cents: order.amount_cents,
        currency: order.currency,
        payment_method_type: order.payment_method_type,
        installments: order.installments,
        paid_at: order.paid_at,
        checkout_url: isOpen && stillValid ? order.checkout_url : null,
      },
      access: { tier: a.tier ?? "free", source: a.source ?? null, access_until: a.access_until ?? null, paid_until: a.paid_until ?? null },
    });
  } catch {
    console.error("[MP-SYNC] error");
    return jsonResponse({ error: "Não foi possível consultar o pagamento" }, 500);
  }
}));
