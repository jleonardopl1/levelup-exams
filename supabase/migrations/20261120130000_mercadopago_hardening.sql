-- =============================================================================
-- MERCADO PAGO: correções da revisão de segurança (sobre 20261120120000)
--
--   * Ambiente: o pedido guarda live_mode (credencial de produção ou de teste) e
--     apply_mp_payment recusa pagamento de outro ambiente. Pagamento de teste
--     (homologação) dá no máximo 24 h de acesso e fica fora das vendas do admin.
--   * Indicação: o desconto não vale em dois pedidos abertos ou pagos ao mesmo tempo.
--   * Comissão: só na primeira aprovação (nunca sobre estorno lido primeiro); desconto
--     concedido sem comissão nova fica marcado para o Financeiro.
--   * Retenção: notificações recebidas valem 180 dias (job horário existente).
--
-- create_payment_order e apply_mp_payment ganham p_live_mode: as assinaturas antigas
-- saem (com as duas, a chamada por nome ficaria ambígua). Publicar junto com as funções
-- mp-* desta versão; até lá o Mercado Pago está desligado (MP_ENABLED ausente).
-- Plano: docs/MERCADO_PAGO.md
-- =============================================================================

ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS live_mode boolean NOT NULL DEFAULT true;

-- -----------------------------------------------------------------------------
-- 1. Acesso pago: pedido de teste vale no máximo 24 h
-- -----------------------------------------------------------------------------
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
    SELECT o.paid_at, o.access_months, o.access_until_fixed, o.live_mode
    FROM public.payment_orders o
    WHERE o.user_id = p_user_id
      AND o.status IN ('paid', 'partially_refunded', 'in_dispute')
      AND o.access_revoked_at IS NULL
      AND o.paid_at IS NOT NULL
    ORDER BY o.paid_at, o.created_at
  LOOP
    IF NOT r.live_mode THEN
      -- Pagamento de teste (homologação): no máximo 24 h de acesso, sem alongar os reais.
      v_end := GREATEST(COALESCE(v_end, r.paid_at), LEAST(r.paid_at + interval '24 hours',
                                                         COALESCE(r.access_until_fixed, r.paid_at + interval '24 hours')));
    ELSIF r.access_months IS NOT NULL THEN
      v_end := GREATEST(COALESCE(v_end, r.paid_at), r.paid_at) + make_interval(months => r.access_months);
    ELSE
      v_end := GREATEST(COALESCE(v_end, r.access_until_fixed), r.access_until_fixed);
    END IF;
  END LOOP;
  RETURN v_end;
END;
$$;

REVOKE ALL ON FUNCTION public._paid_access_until(uuid) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Criação do pedido: ambiente e indicação em uso
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_payment_order(uuid, text, uuid, integer, integer, uuid, timestamptz, integer);
CREATE OR REPLACE FUNCTION public.create_payment_order(
  p_user_id uuid,
  p_product text,
  p_track_id uuid,
  p_list_amount_cents integer,
  p_discount_cents integer,
  p_referral_code_id uuid,
  p_access_until_fixed timestamptz,
  p_ttl_minutes integer DEFAULT 60,
  p_live_mode boolean DEFAULT true)
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

  -- Uma indicação por aluno: o desconto não vale em dois pedidos abertos ou pagos ao mesmo tempo
  -- (o anual e o Passe com o mesmo código, por exemplo). referral_uses só registra no pagamento.
  IF p_referral_code_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.payment_orders x
    WHERE x.user_id = p_user_id AND x.referral_code_id IS NOT NULL
      AND x.status IN ('created', 'pending', 'paid', 'partially_refunded', 'in_dispute')) THEN
    RETURN jsonb_build_object('error', 'referral_in_use');
  END IF;

  BEGIN
    INSERT INTO public.payment_orders (
      user_id, provider, product, track_id, list_amount_cents, discount_cents, amount_cents,
      referral_code_id, access_months, access_until_fixed, expires_at, live_mode)
    VALUES (
      p_user_id, 'mercadopago', p_product,
      CASE WHEN p_product = 'exam_pass' THEN p_track_id END,
      p_list_amount_cents, COALESCE(p_discount_cents, 0), v_amount, p_referral_code_id,
      CASE WHEN p_product = 'plus_annual' THEN 12 END,
      CASE WHEN p_product = 'exam_pass' THEN p_access_until_fixed END,
      now() + make_interval(mins => GREATEST(5, LEAST(COALESCE(p_ttl_minutes, 60), 1440))),
      COALESCE(p_live_mode, true))
    RETURNING * INTO v_new;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'busy');
  END;

  RETURN jsonb_build_object('order_id', v_new.id, 'reused', false, 'amount_cents', v_new.amount_cents,
                            'expires_at', v_new.expires_at);
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Pagamento -> pedido: ambiente conferido e comissão só aprovada
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.apply_mp_payment(uuid, text, text, text, integer, integer, text, text, integer, timestamptz);
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
  p_approved_at timestamptz,
  p_live_mode boolean)
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
  v_conv jsonb;
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

  -- Pagamento de teste nunca vale para pedido real (e vice-versa).
  IF p_live_mode IS DISTINCT FROM o.live_mode THEN
    INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
    VALUES ('PAYMENT_ENVIRONMENT_MISMATCH', o.user_id, false, jsonb_build_object(
      'order_id', o.id, 'provider', o.provider, 'payment_id', p_payment_id,
      'order_live_mode', o.live_mode, 'payment_live_mode', p_live_mode));
    RETURN jsonb_build_object('error', 'environment_mismatch');
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
    -- Revisão da comissão só quando ela pode existir: estorno lido antes da aprovação não gera comissão.
    commission_review = commission_review OR (referral_code_id IS NOT NULL
                          AND v_new IN ('partially_refunded', 'refunded', 'charged_back', 'in_dispute')
                          AND NOT (NOT v_was_paid AND v_new IN ('refunded', 'charged_back'))),
    possible_duplicate = possible_duplicate OR v_duplicate,
    updated_at = now()
  WHERE id = o.id;

  IF v_new IS DISTINCT FROM o.status THEN
    INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
    VALUES ('PAYMENT_ORDER_UPDATED', o.user_id, true, jsonb_build_object(
      'order_id', o.id, 'provider', o.provider, 'product', o.product, 'payment_id', p_payment_id,
      'from', o.status, 'to', v_new, 'possible_duplicate', v_duplicate));
  END IF;

  -- Comissão: só na primeira aprovação (nunca quando o primeiro estado lido já é estorno),
  -- sobre o valor do produto, sem os juros do parcelamento. Desconto concedido sem comissão
  -- nova (indicado já registrado, código inválido) fica para o Financeiro revisar.
  IF NOT v_was_paid AND v_new IN ('paid', 'partially_refunded', 'in_dispute') AND o.referral_code_id IS NOT NULL THEN
    v_conv := public.record_referral_conversion(o.referral_code_id, o.user_id, o.amount_cents / 100.0, 'mp:' || o.id::text);
    IF (v_conv->>'recorded')::boolean IS DISTINCT FROM true THEN
      UPDATE public.payment_orders SET commission_review = true WHERE id = o.id;
    END IF;
  END IF;

  PERFORM public._refresh_profile_tier(o.user_id);

  RETURN jsonb_build_object('order_id', o.id, 'status', v_new, 'previous', o.status,
                            'paid_until', public._paid_access_until(o.user_id),
                            'possible_duplicate', v_duplicate);
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_order(uuid, text, uuid, integer, integer, uuid, timestamptz, integer, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_mp_payment(uuid, text, text, text, integer, integer, text, text, integer, timestamptz, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_order(uuid, text, uuid, integer, integer, uuid, timestamptz, integer, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_mp_payment(uuid, text, text, text, integer, integer, text, text, integer, timestamptz, boolean)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Job horário: retenção das notificações
-- -----------------------------------------------------------------------------
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

  -- Retenção (rules/common/privacy.md): notificações recebidas valem 180 dias.
  DELETE FROM public.payment_provider_events WHERE received_at < now() - interval '180 days';
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_premium_grants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_premium_grants() TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Visão do admin: só pagamentos reais nas vendas (igual a 20261120120000 + live_mode)
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
                                               WHERE o.live_mode
                                                 AND o.status IN ('paid', 'partially_refunded', 'in_dispute')
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
                     WHERE live_mode AND paid_at > now() - interval '30 days'
                       AND status IN ('paid', 'partially_refunded', 'in_dispute', 'refunded', 'charged_back')),
        'received_30d_cents', (SELECT coalesce(sum(amount_cents), 0) FROM public.payment_orders
                               WHERE live_mode AND paid_at > now() - interval '30 days'
                                 AND status IN ('paid', 'partially_refunded', 'in_dispute', 'refunded', 'charged_back')),
        'refunded_30d_cents', (SELECT coalesce(sum(CASE WHEN status = 'charged_back' THEN amount_cents ELSE refunded_cents END), 0)
                               FROM public.payment_orders
                               WHERE live_mode AND paid_at > now() - interval '30 days'
                                 AND status IN ('partially_refunded', 'refunded', 'charged_back')),
        'pix_30d', (SELECT count(*) FROM public.payment_orders
                    WHERE live_mode AND paid_at > now() - interval '30 days' AND payment_method_type = 'bank_transfer'),
        'installments_30d', (SELECT count(*) FROM public.payment_orders
                             WHERE live_mode AND paid_at > now() - interval '30 days' AND installments > 1),
        'open_orders', (SELECT count(*) FROM public.payment_orders
                        WHERE live_mode AND status IN ('created', 'pending') AND expires_at > now()),
        -- Pagamentos de teste (homologação) ficam fora das vendas; só a contagem aparece.
        'test_paid_30d', (SELECT count(*) FROM public.payment_orders
                          WHERE NOT live_mode AND paid_at > now() - interval '30 days'),
        'needs_review', (SELECT count(*) FROM public.payment_orders
                         WHERE live_mode AND (commission_review OR possible_duplicate OR status = 'in_dispute'))
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
