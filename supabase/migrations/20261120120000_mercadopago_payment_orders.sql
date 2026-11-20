-- =============================================================================
-- MERCADO PAGO (D14): Pix e Plus anual parcelado
--
-- Pagamentos avulsos pelo Checkout Pro do Mercado Pago:
--   * Plus anual pré-pago (12 meses, sem renovação automática);
--   * Passe Concurso (até a prova + 15 dias, mesma regra do Passe pela Stripe).
--
-- Regra central: profiles.billing_tier continua sendo SÓ da Stripe. O
-- check-subscription reescreve esse campo com a resposta da Stripe; se o acesso
-- do Mercado Pago fosse gravado ali, a próxima consulta o apagaria. O acesso pago
-- pelo Mercado Pago é mais uma fonte do plano efetivo (profiles.tier), calculada
-- a partir de payment_orders.
--
-- Escrita só pelas Edge Functions (service_role): mp-create-checkout cria o pedido,
-- mp-webhook e mp-sync-order aplicam o estado do pagamento relido na API do
-- Mercado Pago. Idempotente e tolerante à ordem de publicação: sem esta migration
-- as funções novas respondem "indisponível"; as antigas ignoram os campos novos.
-- Plano: docs/MERCADO_PAGO.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pedidos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  product text NOT NULL,
  track_id uuid REFERENCES public.study_tracks(id),
  list_amount_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  referral_code_id uuid REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'created',
  -- Acesso concedido: anual = meses a partir do pagamento; Passe = data fixa.
  access_months smallint,
  access_until_fixed timestamptz,
  provider_preference_id text,
  provider_payment_id text,
  checkout_url text,
  provider_status text,
  provider_status_detail text,
  payment_method_type text,
  installments smallint,
  refunded_cents integer NOT NULL DEFAULT 0,
  paid_at timestamptz,
  access_revoked_at timestamptz,
  -- Para o Financeiro: estorno/disputa com indicação e possível pagamento em dobro.
  commission_review boolean NOT NULL DEFAULT false,
  possible_duplicate boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_orders_provider_valid CHECK (provider IN ('mercadopago')),
  CONSTRAINT payment_orders_product_valid CHECK (product IN ('plus_annual', 'exam_pass')),
  CONSTRAINT payment_orders_status_valid CHECK (status IN (
    'created', 'pending', 'paid', 'partially_refunded', 'refunded', 'charged_back',
    'in_dispute', 'failed', 'canceled', 'expired')),
  CONSTRAINT payment_orders_currency_valid CHECK (currency = 'BRL'),
  CONSTRAINT payment_orders_amounts_valid CHECK (
    list_amount_cents > 0 AND discount_cents >= 0 AND amount_cents > 0
    AND amount_cents = list_amount_cents - discount_cents AND refunded_cents >= 0),
  CONSTRAINT payment_orders_access_shape CHECK (
    (product = 'plus_annual' AND access_months = 12 AND access_until_fixed IS NULL AND track_id IS NULL)
    OR (product = 'exam_pass' AND access_months IS NULL AND access_until_fixed IS NOT NULL AND track_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_payment_uniq
  ON public.payment_orders(provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
-- No máximo um pedido aberto por aluno, produto e trilha (evita dois QR Codes do mesmo pedido).
CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_one_open
  ON public.payment_orders(user_id, product, COALESCE(track_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('created', 'pending');
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_paid ON public.payment_orders(user_id, paid_at)
  WHERE status IN ('paid', 'partially_refunded', 'in_dispute') AND access_revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_orders_open ON public.payment_orders(expires_at)
  WHERE status IN ('created', 'pending');

-- Sem acesso direto do cliente: leitura pela RPC get_my_payment_orders.
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Notificações recebidas dos provedores (só metadados, para auditoria e reentregas)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  topic text NOT NULL,
  resource_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  PRIMARY KEY (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_provider_events_received
  ON public.payment_provider_events(provider, received_at DESC);
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_provider_events FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Acesso pago pelo Mercado Pago
-- -----------------------------------------------------------------------------
-- Fim do acesso, calculado na leitura a partir dos pedidos pagos e não revogados, em
-- ordem de pagamento: cada anual soma seus meses a partir do maior entre a data do
-- pagamento e o fim anterior; o Passe vale até a data fixa. Calcular na leitura faz o
-- estorno do primeiro anual não abrir buraco no segundo.
CREATE OR REPLACE FUNCTION public._paid_access_until(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz;
  r record;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  FOR r IN
    SELECT o.paid_at, o.access_months, o.access_until_fixed
    FROM public.payment_orders o
    WHERE o.user_id = p_user_id
      AND o.status IN ('paid', 'partially_refunded', 'in_dispute')
      AND o.access_revoked_at IS NULL
      AND o.paid_at IS NOT NULL
    ORDER BY o.paid_at, o.created_at
  LOOP
    IF r.access_months IS NOT NULL THEN
      v_end := GREATEST(COALESCE(v_end, r.paid_at), r.paid_at) + make_interval(months => r.access_months);
    ELSE
      v_end := GREATEST(COALESCE(v_end, r.access_until_fixed), r.access_until_fixed);
    END IF;
  END LOOP;
  RETURN v_end;
END;
$$;

CREATE OR REPLACE FUNCTION public._has_paid_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public._paid_access_until(p_user_id) > now(), false)
$$;

-- Status do pagamento no Mercado Pago -> status do pedido (NULL = desconhecido).
CREATE OR REPLACE FUNCTION public._mp_order_status(p_status text, p_refunded_cents integer, p_amount_cents integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_status
    WHEN 'approved' THEN CASE
      WHEN COALESCE(p_refunded_cents, 0) >= p_amount_cents THEN 'refunded'
      WHEN COALESCE(p_refunded_cents, 0) > 0 THEN 'partially_refunded'
      ELSE 'paid' END
    WHEN 'authorized' THEN 'pending'
    WHEN 'pending' THEN 'pending'
    WHEN 'in_process' THEN 'pending'
    WHEN 'in_mediation' THEN 'in_dispute'
    WHEN 'refunded' THEN 'refunded'
    WHEN 'charged_back' THEN 'charged_back'
    WHEN 'rejected' THEN 'failed'
    WHEN 'cancelled' THEN 'canceled'
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public._paid_access_until(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._has_paid_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._mp_order_status(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._has_paid_access(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Plano efetivo: Stripe, Mercado Pago, cortesia ou admin master
--    (corpos iguais aos de 20261113150000/20261115120000 + a fonte nova)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._premium_source(p_user_id uuid, p_billing_tier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public._is_master(p_user_id) THEN 'master'
    WHEN p_billing_tier = 'plus' THEN 'stripe'
    WHEN public._has_paid_access(p_user_id) THEN 'mercadopago'
    WHEN public._has_premium_grant(p_user_id) THEN 'grant'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION public._premium_source(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_effective_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Compatibilidade: versoes anteriores das Edge Functions gravavam o plano do Stripe
  -- direto em "tier". Uma escrita assim passa a valer como billing_tier.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tier IS DISTINCT FROM OLD.tier AND NEW.billing_tier IS NOT DISTINCT FROM OLD.billing_tier THEN
      NEW.billing_tier := NEW.tier;
    END IF;
  ELSIF NEW.tier = 'plus' AND COALESCE(NEW.billing_tier, 'free') = 'free' THEN
    NEW.billing_tier := 'plus';
  END IF;

  NEW.tier := CASE
    WHEN NEW.billing_tier = 'plus'
      OR public._has_premium_grant(NEW.user_id)
      OR public._has_paid_access(NEW.user_id) THEN 'plus'
    ELSE 'free'
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_effective_tier() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR NOT (p_user_id = auth.uid() OR auth.role() = 'service_role') THEN 'free'
    WHEN COALESCE((SELECT billing_tier FROM public.profiles WHERE user_id = p_user_id LIMIT 1), 'free') = 'plus'
      OR public._has_premium_grant(p_user_id)
      OR public._has_paid_access(p_user_id) THEN 'plus'
    ELSE 'free'
  END
$$;
REVOKE ALL ON FUNCTION public.get_user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_premium_access(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_billing text;
  v_grant public.premium_grants;
  v_source text;
  v_paid_until timestamptz;
  v_paid_product text;
BEGIN
  IF v_uid IS NULL OR NOT (v_uid = auth.uid() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(billing_tier, 'free') INTO v_billing FROM public.profiles WHERE user_id = v_uid;
  v_billing := COALESCE(v_billing, 'free');
  v_source := public._premium_source(v_uid, v_billing);
  v_grant := public._active_premium_grant(v_uid);
  v_paid_until := public._paid_access_until(v_uid);
  IF v_paid_until IS NOT NULL AND v_paid_until <= now() THEN v_paid_until := NULL; END IF;
  IF v_paid_until IS NOT NULL THEN
    SELECT o.product INTO v_paid_product FROM public.payment_orders o
    WHERE o.user_id = v_uid AND o.status IN ('paid', 'partially_refunded', 'in_dispute')
      AND o.access_revoked_at IS NULL
    ORDER BY o.paid_at DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'tier', CASE WHEN v_source IS NULL THEN 'free' ELSE 'plus' END,
    'billing_tier', v_billing,
    'source', v_source,
    -- Fim do acesso por cortesia ou pago pelo Mercado Pago (NULL = sem prazo ou nao se aplica).
    'access_until', CASE
      WHEN v_source = 'grant' THEN v_grant.expires_at
      WHEN v_source = 'mercadopago' THEN v_paid_until
    END,
    'granted_at', CASE WHEN v_source = 'grant' THEN v_grant.granted_at END,
    'grant_kind', CASE WHEN v_source = 'grant' THEN
      CASE WHEN EXISTS (SELECT 1 FROM public.exam_pass_purchases p
                        WHERE p.user_id = v_uid AND p.expires_at = v_grant.expires_at)
           THEN 'exam_pass' ELSE 'staff' END
    END,
    -- Acesso pago pelo Mercado Pago, mesmo quando outra fonte prevalece (ex.: assinante Stripe).
    'paid_until', v_paid_until,
    'paid_product', v_paid_product
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_premium_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_premium_access(uuid) TO authenticated, service_role;

-- Job horário (pg_cron 'expire-premium-grants', já agendado): rebaixa quem perdeu o
-- acesso e encerra pedidos abertos vencidos. Pagamento confirmado depois disso ainda
-- é honrado (apply_mp_payment aceita 'expired' -> 'paid').
CREATE OR REPLACE FUNCTION public.expire_premium_grants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.profiles p SET tier = p.tier
  WHERE p.tier = 'plus' AND p.billing_tier <> 'plus'
    AND NOT public._has_premium_grant(p.user_id)
    AND NOT public._has_paid_access(p.user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.payment_orders SET status = 'expired', updated_at = now()
  WHERE status IN ('created', 'pending') AND expires_at <= now();
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_premium_grants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_premium_grants() TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Criação do pedido (mp-create-checkout)
-- -----------------------------------------------------------------------------
-- Reaproveita o pedido aberto do mesmo aluno, produto e trilha quando nada mudou (mesmo
-- valor e indicação), para não gerar dois QR Codes. Se mudou, encerra o anterior como
-- 'expired' (um pagamento que chegue depois ainda é honrado) e cria outro.
CREATE OR REPLACE FUNCTION public.create_payment_order(
  p_user_id uuid,
  p_product text,
  p_track_id uuid,
  p_list_amount_cents integer,
  p_discount_cents integer,
  p_referral_code_id uuid,
  p_access_until_fixed timestamptz,
  p_ttl_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount integer;
  v_open public.payment_orders;
  v_new public.payment_orders;
BEGIN
  IF auth.role() <> 'service_role' THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  IF p_user_id IS NULL OR p_product NOT IN ('plus_annual', 'exam_pass') THEN
    RETURN jsonb_build_object('error', 'invalid_product');
  END IF;
  IF p_list_amount_cents IS NULL OR p_list_amount_cents <= 0
     OR COALESCE(p_discount_cents, 0) < 0 OR COALESCE(p_discount_cents, 0) >= p_list_amount_cents THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;
  IF p_product = 'exam_pass' AND (p_track_id IS NULL OR p_access_until_fixed IS NULL OR p_access_until_fixed <= now()) THEN
    RETURN jsonb_build_object('error', 'invalid_track');
  END IF;
  v_amount := p_list_amount_cents - COALESCE(p_discount_cents, 0);

  UPDATE public.payment_orders SET status = 'expired', updated_at = now()
  WHERE user_id = p_user_id AND status IN ('created', 'pending') AND expires_at <= now();

  SELECT * INTO v_open FROM public.payment_orders
  WHERE user_id = p_user_id AND product = p_product
    AND track_id IS NOT DISTINCT FROM (CASE WHEN p_product = 'exam_pass' THEN p_track_id END)
    AND status IN ('created', 'pending')
  FOR UPDATE;

  IF FOUND THEN
    IF v_open.amount_cents = v_amount
       AND v_open.referral_code_id IS NOT DISTINCT FROM p_referral_code_id
       AND v_open.checkout_url IS NOT NULL THEN
      RETURN jsonb_build_object('order_id', v_open.id, 'reused', true, 'checkout_url', v_open.checkout_url,
                                'amount_cents', v_open.amount_cents, 'expires_at', v_open.expires_at);
    END IF;
    IF v_open.checkout_url IS NULL AND v_open.created_at > now() - interval '30 seconds' THEN
      -- Outra requisição está criando a preferência deste pedido agora.
      RETURN jsonb_build_object('error', 'busy');
    END IF;
    UPDATE public.payment_orders SET status = 'expired', updated_at = now() WHERE id = v_open.id;
  END IF;

  BEGIN
    INSERT INTO public.payment_orders (
      user_id, provider, product, track_id, list_amount_cents, discount_cents, amount_cents,
      referral_code_id, access_months, access_until_fixed, expires_at)
    VALUES (
      p_user_id, 'mercadopago', p_product,
      CASE WHEN p_product = 'exam_pass' THEN p_track_id END,
      p_list_amount_cents, COALESCE(p_discount_cents, 0), v_amount, p_referral_code_id,
      CASE WHEN p_product = 'plus_annual' THEN 12 END,
      CASE WHEN p_product = 'exam_pass' THEN p_access_until_fixed END,
      now() + make_interval(mins => GREATEST(5, LEAST(COALESCE(p_ttl_minutes, 60), 1440))))
    RETURNING * INTO v_new;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'busy');
  END;

  RETURN jsonb_build_object('order_id', v_new.id, 'reused', false, 'amount_cents', v_new.amount_cents,
                            'expires_at', v_new.expires_at);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Estado do pagamento -> pedido, acesso e comissão (mp-webhook e mp-sync-order)
-- -----------------------------------------------------------------------------
-- Chamada com o pagamento RELIDO na API do Mercado Pago (nunca com o corpo da
-- notificação). Idempotente: reentregas e eventos fora de ordem não mudam o resultado.
--   * estados finais (refunded, charged_back) nunca voltam;
--   * um pedido pago não volta a pendente/recusado;
--   * pagamento aprovado depois de o pedido expirar é honrado;
--   * outro pagamento aprovado para um pedido já pago vira alerta de duplicidade;
--   * a comissão de indicação é registrada uma vez, na primeira aprovação.
CREATE OR REPLACE FUNCTION public.apply_mp_payment(
  p_order_id uuid,
  p_payment_id text,
  p_status text,
  p_status_detail text,
  p_amount_cents integer,
  p_refunded_cents integer,
  p_currency text,
  p_method_type text,
  p_installments integer,
  p_approved_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.payment_orders;
  v_new text;
  v_locked boolean;
  v_was_paid boolean;
  v_now_paid boolean;
  v_paid_at timestamptz;
  v_duplicate boolean := false;
BEGIN
  IF auth.role() <> 'service_role' THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  IF p_payment_id IS NULL OR p_payment_id = '' THEN RETURN jsonb_build_object('error', 'invalid_payment'); END IF;

  SELECT * INTO o FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  IF p_currency IS DISTINCT FROM o.currency OR p_amount_cents IS DISTINCT FROM o.amount_cents THEN
    INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
    VALUES ('PAYMENT_AMOUNT_MISMATCH', o.user_id, false, jsonb_build_object(
      'order_id', o.id, 'provider', o.provider, 'payment_id', p_payment_id,
      'expected_cents', o.amount_cents, 'received_cents', p_amount_cents, 'currency', p_currency));
    RETURN jsonb_build_object('error', 'amount_mismatch');
  END IF;

  v_new := public._mp_order_status(p_status, p_refunded_cents, o.amount_cents);
  IF v_new IS NULL THEN RETURN jsonb_build_object('error', 'unknown_status'); END IF;

  -- Pedido já preso a um pagamento confirmado: outro pagamento só gera alerta.
  v_locked := o.status IN ('paid', 'partially_refunded', 'in_dispute', 'refunded', 'charged_back');
  IF v_locked AND o.provider_payment_id IS DISTINCT FROM p_payment_id THEN
    IF v_new IN ('paid', 'partially_refunded', 'in_dispute') THEN
      UPDATE public.payment_orders SET possible_duplicate = true, updated_at = now() WHERE id = o.id;
      INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
      VALUES ('PAYMENT_DUPLICATE', o.user_id, false, jsonb_build_object(
        'order_id', o.id, 'provider', o.provider, 'payment_id', p_payment_id,
        'kept_payment_id', o.provider_payment_id));
      RETURN jsonb_build_object('order_id', o.id, 'status', o.status, 'duplicate_payment', true);
    END IF;
    RETURN jsonb_build_object('order_id', o.id, 'status', o.status, 'ignored', 'other_payment');
  END IF;

  -- Monotonia: final não volta; pago não regride para pendente/recusado/cancelado.
  IF (o.status IN ('refunded', 'charged_back') AND v_new NOT IN ('refunded', 'charged_back'))
     OR (o.status IN ('paid', 'partially_refunded', 'in_dispute') AND v_new IN ('pending', 'failed', 'canceled')) THEN
    RETURN jsonb_build_object('order_id', o.id, 'status', o.status, 'unchanged', true);
  END IF;

  v_was_paid := o.paid_at IS NOT NULL;
  v_now_paid := v_new IN ('paid', 'partially_refunded', 'in_dispute', 'refunded', 'charged_back');
  v_paid_at := CASE WHEN v_was_paid THEN o.paid_at
                    WHEN v_now_paid THEN COALESCE(p_approved_at, now()) END;

  IF v_now_paid AND NOT v_was_paid AND EXISTS (
    SELECT 1 FROM public.payment_orders x
    WHERE x.user_id = o.user_id AND x.product = o.product AND x.id <> o.id
      AND x.track_id IS NOT DISTINCT FROM o.track_id
      AND x.status IN ('paid', 'partially_refunded', 'in_dispute')
      AND x.paid_at > v_paid_at - interval '24 hours') THEN
    v_duplicate := true;
  END IF;

  UPDATE public.payment_orders SET
    status = v_new,
    provider_payment_id = p_payment_id,
    provider_status = left(p_status, 40),
    provider_status_detail = left(p_status_detail, 80),
    payment_method_type = COALESCE(left(p_method_type, 40), payment_method_type),
    installments = COALESCE(LEAST(GREATEST(p_installments, 1), 99)::smallint, installments),
    refunded_cents = GREATEST(COALESCE(p_refunded_cents, 0), 0),
    paid_at = v_paid_at,
    access_revoked_at = CASE WHEN v_new IN ('refunded', 'charged_back') THEN COALESCE(access_revoked_at, now())
                             ELSE access_revoked_at END,
    commission_review = commission_review OR (referral_code_id IS NOT NULL
                          AND v_new IN ('partially_refunded', 'refunded', 'charged_back', 'in_dispute')),
    possible_duplicate = possible_duplicate OR v_duplicate,
    updated_at = now()
  WHERE id = o.id;

  IF v_new IS DISTINCT FROM o.status THEN
    INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
    VALUES ('PAYMENT_ORDER_UPDATED', o.user_id, true, jsonb_build_object(
      'order_id', o.id, 'provider', o.provider, 'product', o.product, 'payment_id', p_payment_id,
      'from', o.status, 'to', v_new, 'possible_duplicate', v_duplicate));
  END IF;

  -- Comissão: só na primeira aprovação, sobre o valor do produto (sem os juros do parcelamento).
  IF v_now_paid AND NOT v_was_paid AND o.referral_code_id IS NOT NULL THEN
    PERFORM public.record_referral_conversion(o.referral_code_id, o.user_id, o.amount_cents / 100.0, 'mp:' || o.id::text);
  END IF;

  PERFORM public._refresh_profile_tier(o.user_id);

  RETURN jsonb_build_object('order_id', o.id, 'status', v_new, 'previous', o.status,
                            'paid_until', public._paid_access_until(o.user_id),
                            'possible_duplicate', v_duplicate);
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Pedidos do próprio aluno (Configurações e retomada do Pix)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_payment_orders(p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
      SELECT o.id, o.product, o.track_id, o.amount_cents, o.currency,
             CASE WHEN o.status IN ('created', 'pending') AND o.expires_at <= now() THEN 'expired' ELSE o.status END AS status,
             o.payment_method_type, o.installments, o.created_at, o.paid_at, o.expires_at,
             CASE WHEN o.status IN ('created', 'pending') AND o.expires_at > now() THEN o.checkout_url END AS checkout_url
      FROM public.payment_orders o
      WHERE o.user_id = v_uid
      ORDER BY o.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20)
    ) x), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_order(uuid, text, uuid, integer, integer, uuid, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_mp_payment(uuid, text, text, text, integer, integer, text, text, integer, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_payment_orders(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_order(uuid, text, uuid, integer, integer, uuid, timestamptz, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_mp_payment(uuid, text, text, text, integer, integer, text, text, integer, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_payment_orders(integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Visão geral do admin: igual a 20261113150000 + vendas do Mercado Pago.
--    Quem tem acesso pago pelo Mercado Pago sai de "liberado" (cortesia) e entra
--    em users.plus_mercadopago; receita em payments.mercadopago (centavos).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level text := public._access_level(auth.uid());
  v_tz constant text := 'America/Sao_Paulo';
  v_week_start timestamptz := date_trunc('week', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_level NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH activity AS (
    SELECT user_id, created_at FROM public.quiz_results WHERE created_at > now() - interval '30 days'
    UNION ALL
    SELECT user_id, created_at FROM public.user_question_attempts WHERE created_at > now() - interval '30 days'
  ),
  weeks AS (
    SELECT generate_series(v_week_start - interval '11 weeks', v_week_start, interval '1 week') AS wk
  ),
  days AS (
    SELECT generate_series(
      ((now() AT TIME ZONE v_tz)::date - 29), (now() AT TIME ZONE v_tz)::date, interval '1 day'
    )::date AS d
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM public.profiles),
      'plus', (SELECT count(*) FROM public.profiles WHERE billing_tier = 'plus'),
      'plus_granted', (SELECT count(*) FROM public.profiles p WHERE p.tier = 'plus' AND p.billing_tier <> 'plus'
                       AND NOT public._has_paid_access(p.user_id)),
      -- Só quem tem pedido pago entra no cálculo (não percorre a base inteira).
      'plus_mercadopago', (SELECT count(*) FROM public.profiles p
                           WHERE p.billing_tier <> 'plus'
                             AND p.user_id IN (SELECT o.user_id FROM public.payment_orders o
                                               WHERE o.status IN ('paid', 'partially_refunded', 'in_dispute')
                                                 AND o.access_revoked_at IS NULL)
                             AND public._has_paid_access(p.user_id)),
      'new_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
      'active_1d', (SELECT count(DISTINCT user_id) FROM activity WHERE created_at > now() - interval '1 day'),
      'active_7d', (SELECT count(DISTINCT user_id) FROM activity WHERE created_at > now() - interval '7 days'),
      'active_30d', (SELECT count(DISTINCT user_id) FROM activity),
      'banned', (SELECT count(DISTINCT b.user_id) FROM public.user_bans b
                 WHERE b.is_active AND (b.ban_type = 'permanent' OR b.expires_at IS NULL OR b.expires_at > now()))
    ),
    'quizzes', jsonb_build_object(
      'total', (SELECT count(*) FROM public.quiz_results),
      'this_week', (SELECT count(*) FROM public.quiz_results WHERE created_at >= v_week_start),
      'last_week', (SELECT count(*) FROM public.quiz_results
                    WHERE created_at >= v_week_start - interval '1 week' AND created_at < v_week_start),
      'avg_score_30d', (SELECT round(avg(score))::int FROM public.quiz_results WHERE created_at > now() - interval '30 days'),
      'weekly', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'week', to_char(w.wk AT TIME ZONE v_tz, 'YYYY-MM-DD'),
          'quizzes', (SELECT count(*) FROM public.quiz_results r
                      WHERE r.created_at >= w.wk AND r.created_at < w.wk + interval '1 week'),
          'students', (SELECT count(DISTINCT r.user_id) FROM public.quiz_results r
                       WHERE r.created_at >= w.wk AND r.created_at < w.wk + interval '1 week')
        ) ORDER BY w.wk), '[]'::jsonb)
        FROM weeks w
      )
    ),
    'signups_daily', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d.d, 'YYYY-MM-DD'),
        'signups', (SELECT count(*) FROM public.profiles p WHERE (p.created_at AT TIME ZONE v_tz)::date = d.d),
        'active', (SELECT count(DISTINCT a.user_id) FROM activity a WHERE (a.created_at AT TIME ZONE v_tz)::date = d.d)
      ) ORDER BY d.d), '[]'::jsonb)
      FROM days d
    ),
    'answers', jsonb_build_object(
      'attempts_7d', (SELECT count(*) FROM public.user_question_attempts WHERE created_at > now() - interval '7 days'),
      'accuracy_30d', (SELECT round(100.0 * avg(CASE WHEN is_correct THEN 1 ELSE 0 END))::int
                       FROM public.user_question_attempts WHERE created_at > now() - interval '30 days')
    ),
    'top_subjects', (
      SELECT coalesce(jsonb_agg(t ORDER BY t.attempts DESC), '[]'::jsonb) FROM (
        SELECT q.categoria AS name,
               count(*) AS attempts,
               round(100.0 * avg(CASE WHEN a.is_correct THEN 1 ELSE 0 END))::int AS accuracy
        FROM public.user_question_attempts a
        JOIN public.questions q ON q.id = a.question_id
        WHERE a.created_at > now() - interval '30 days'
        GROUP BY q.categoria
        ORDER BY count(*) DESC
        LIMIT 8
      ) t
    ),
    'content', jsonb_build_object(
      'questions_active', (SELECT count(*) FROM public.questions WHERE is_active),
      'questions_inactive', (SELECT count(*) FROM public.questions WHERE NOT is_active),
      'questions_premium', (SELECT count(*) FROM public.questions WHERE is_active AND is_premium),
      'questions_new_7d', (SELECT count(*) FROM public.questions WHERE created_at > now() - interval '7 days'),
      'reports_open', (SELECT count(*) FROM public.question_reports WHERE status = 'open')
    ),
    'payments', jsonb_build_object(
      'mercadopago', jsonb_build_object(
        'paid_30d', (SELECT count(*) FROM public.payment_orders
                     WHERE paid_at > now() - interval '30 days'
                       AND status IN ('paid', 'partially_refunded', 'in_dispute', 'refunded', 'charged_back')),
        'received_30d_cents', (SELECT coalesce(sum(amount_cents), 0) FROM public.payment_orders
                               WHERE paid_at > now() - interval '30 days'
                                 AND status IN ('paid', 'partially_refunded', 'in_dispute', 'refunded', 'charged_back')),
        'refunded_30d_cents', (SELECT coalesce(sum(CASE WHEN status = 'charged_back' THEN amount_cents ELSE refunded_cents END), 0)
                               FROM public.payment_orders
                               WHERE paid_at > now() - interval '30 days'
                                 AND status IN ('partially_refunded', 'refunded', 'charged_back')),
        'pix_30d', (SELECT count(*) FROM public.payment_orders
                    WHERE paid_at > now() - interval '30 days' AND payment_method_type = 'bank_transfer'),
        'installments_30d', (SELECT count(*) FROM public.payment_orders
                             WHERE paid_at > now() - interval '30 days' AND installments > 1),
        'open_orders', (SELECT count(*) FROM public.payment_orders
                        WHERE status IN ('created', 'pending') AND expires_at > now()),
        'needs_review', (SELECT count(*) FROM public.payment_orders
                         WHERE commission_review OR possible_duplicate OR status = 'in_dispute')
      )
    ),
    'health', jsonb_build_object(
      'last_stripe_event_at', (SELECT max(received_at) FROM public.stripe_webhook_events),
      'stripe_events_30d', (SELECT count(*) FROM public.stripe_webhook_events WHERE received_at > now() - interval '30 days'),
      'last_mercadopago_event_at', (SELECT max(received_at) FROM public.payment_provider_events WHERE provider = 'mercadopago'),
      'last_generation_at', (SELECT max(created_at) FROM public.question_generation_runs),
      'generation_errors_7d', (SELECT count(*) FROM public.question_generation_runs
                               WHERE status = 'error' AND created_at > now() - interval '7 days'),
      'generation_inserted_7d', (SELECT coalesce(sum(inserted), 0) FROM public.question_generation_runs
                                 WHERE created_at > now() - interval '7 days'),
      'failed_events_24h', (SELECT count(*) FROM public.audit_logs
                            WHERE NOT success AND created_at > now() - interval '1 day')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_overview() TO authenticated;
