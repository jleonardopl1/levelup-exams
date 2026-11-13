-- =============================================================================
-- PLUS LIBERADO PELA ADMINISTRACAO (cortesia) + PLUS PERMANENTE DO ADMIN MASTER
--
-- Antes: profiles.tier era escrito somente pelo Stripe (check-subscription e
-- stripe-webhook). Nao havia como liberar o Plus sem cobranca.
--
-- Agora o plano tem duas origens independentes:
--   * profiles.billing_tier -> o que o Stripe diz (assinatura paga). Escrito so
--                              pelas Edge Functions de pagamento (service_role).
--   * premium_grants        -> liberacoes manuais feitas pelo admin master, com
--                              prazo (dias) ou sem prazo, sempre auditadas.
--   * admin master          -> sempre Plus, sem linha na tabela e sem poder ser
--                              revogado (mesma regra de identidade da migration
--                              20261110150000_master_admin_and_affiliates.sql).
--
-- profiles.tier continua sendo o plano EFETIVO lido pelo app inteiro
-- ('plus' se pago OU liberado), recalculado pelo trigger sync_profile_effective_tier
-- em qualquer escrita no perfil. get_user_tier (RLS, validate_answer, loja,
-- autoinscricao de afiliados) calcula na hora, entao o fim do prazo vale no
-- mesmo instante no servidor; um job horario (pg_cron) acerta profiles.tier.
--
-- Metricas de receita e de afiliados passam a usar billing_tier (cortesia nao
-- conta como venda nem como indicado ativo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Plano pago (Stripe) separado do plano efetivo
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_tier text NOT NULL DEFAULT 'free';

-- Ate aqui tier = plano do Stripe (unica fonte que o escrevia).
UPDATE public.profiles SET billing_tier = tier
WHERE tier IN ('free', 'plus') AND billing_tier IS DISTINCT FROM tier;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_billing_tier_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_tier_valid CHECK (billing_tier IN ('free', 'plus'));

CREATE INDEX IF NOT EXISTS idx_profiles_billing_tier ON public.profiles(billing_tier) WHERE billing_tier <> 'free';

-- O cliente continua sem poder alterar tier, e agora tambem billing_tier.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Somente service_role / funcoes SECURITY DEFINER (current_user = owner) alteram o plano.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.tier := 'free';
      NEW.billing_tier := 'free';
    ELSE
      NEW.tier := OLD.tier;
      NEW.billing_tier := OLD.billing_tier;
      NEW.user_id := OLD.user_id;
      NEW.id := OLD.id;
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Liberacoes manuais
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premium_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,                       -- NULL = sem prazo
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason text CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 500),
  CONSTRAINT premium_grants_expiry_after_grant CHECK (expires_at IS NULL OR expires_at > granted_at)
);
-- No maximo uma liberacao em aberto por usuario (uma nova substitui a anterior).
CREATE UNIQUE INDEX IF NOT EXISTS premium_grants_one_open_per_user
  ON public.premium_grants(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_premium_grants_user ON public.premium_grants(user_id, granted_at DESC);

-- Sem acesso direto do cliente: leitura e escrita somente pelas RPCs abaixo.
ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_grants FROM anon, authenticated;

-- Liberacao vigente (nao revogada e dentro do prazo) de um usuario.
CREATE OR REPLACE FUNCTION public._active_premium_grant(p_user_id uuid)
RETURNS public.premium_grants
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.* FROM public.premium_grants g
  WHERE g.user_id = p_user_id
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  ORDER BY g.granted_at DESC
  LIMIT 1
$$;

-- Plus sem cobranca: admin master (permanente) ou liberacao vigente.
CREATE OR REPLACE FUNCTION public._has_premium_grant(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND (
    public._is_master(p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.premium_grants g
      WHERE g.user_id = p_user_id
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
    )
  )
$$;

-- Origem do Plus de um usuario: 'master' | 'stripe' | 'grant' | NULL (free).
-- Quem paga e tambem tem cortesia aparece como 'stripe' (a cobranca prevalece).
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
    WHEN public._has_premium_grant(p_user_id) THEN 'grant'
    ELSE NULL
  END
$$;

REVOKE ALL ON FUNCTION public._active_premium_grant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._has_premium_grant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._premium_source(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._has_premium_grant(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Plano efetivo
-- -----------------------------------------------------------------------------
-- Recalcula profiles.tier a cada escrita no perfil. Roda DEPOIS de
-- protect_profile_privileged_columns (gatilhos BEFORE disparam em ordem alfabetica).
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
    WHEN NEW.billing_tier = 'plus' OR public._has_premium_grant(NEW.user_id) THEN 'plus'
    ELSE 'free'
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_effective_tier() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_profile_effective_tier ON public.profiles;
CREATE TRIGGER sync_profile_effective_tier
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_effective_tier();

-- Uso interno: forca o recalculo do plano efetivo de um usuario.
CREATE OR REPLACE FUNCTION public._refresh_profile_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  UPDATE public.profiles SET tier = tier WHERE user_id = p_user_id RETURNING tier INTO v_tier;
  RETURN v_tier;
END;
$$;
REVOKE ALL ON FUNCTION public._refresh_profile_tier(uuid) FROM PUBLIC, anon, authenticated;

-- get_user_tier: mesma restricao [H5] (clientes so perguntam sobre si mesmos), mas
-- calculado na hora: uma cortesia vencida deixa de valer no instante do vencimento.
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
      OR public._has_premium_grant(p_user_id) THEN 'plus'
    ELSE 'free'
  END
$$;
REVOKE ALL ON FUNCTION public.get_user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated, service_role;

-- Situacao do Plus do proprio usuario (tela de planos / configuracoes) ou de qualquer
-- usuario quando chamada pelas Edge Functions (service_role).
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
BEGIN
  IF v_uid IS NULL OR NOT (v_uid = auth.uid() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(billing_tier, 'free') INTO v_billing FROM public.profiles WHERE user_id = v_uid;
  v_billing := COALESCE(v_billing, 'free');
  v_source := public._premium_source(v_uid, v_billing);
  v_grant := public._active_premium_grant(v_uid);
  RETURN jsonb_build_object(
    'tier', CASE WHEN v_source IS NULL THEN 'free' ELSE 'plus' END,
    'billing_tier', v_billing,
    'source', v_source,
    -- Fim do acesso por cortesia (NULL = sem prazo ou nao se aplica).
    'access_until', CASE WHEN v_source = 'grant' THEN v_grant.expires_at END,
    'granted_at', CASE WHEN v_source = 'grant' THEN v_grant.granted_at END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_premium_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_premium_access(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. RPCs do painel (somente o admin master libera ou revoga)
-- -----------------------------------------------------------------------------
-- p_days NULL = sem prazo; 1..3650 dias. Uma nova liberacao substitui a anterior.
CREATE OR REPLACE FUNCTION public.admin_grant_premium(
  p_user_id uuid, p_days integer DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expires timestamptz;
  v_reason text := NULLIF(left(btrim(COALESCE(p_reason, '')), 500), '');
  v_tier text;
BEGIN
  IF NOT public._is_master(v_uid) THEN
    RAISE EXCEPTION 'Somente o admin master pode liberar o Plus' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF public._is_master(p_user_id) THEN
    RAISE EXCEPTION 'O admin master já tem o Plus permanente' USING ERRCODE = '22023';
  END IF;
  IF p_days IS NOT NULL THEN
    IF p_days < 1 OR p_days > 3650 THEN
      RAISE EXCEPTION 'Duração inválida (1 a 3650 dias)' USING ERRCODE = '22023';
    END IF;
    v_expires := now() + make_interval(days => p_days);
  END IF;

  UPDATE public.premium_grants
  SET revoked_at = now(), revoked_by = v_uid, revoke_reason = 'Substituída por nova liberação'
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  INSERT INTO public.premium_grants (user_id, granted_by, reason, expires_at)
  VALUES (p_user_id, v_uid, v_reason, v_expires);

  v_tier := public._refresh_profile_tier(p_user_id);

  PERFORM public._audit('premium_granted', jsonb_build_object(
    'target_user_id', p_user_id,
    'days', COALESCE(p_days::text, 'sem prazo'),
    'expires_at', v_expires,
    'reason', COALESCE(v_reason, '')));

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires, 'tier', COALESCE(v_tier, 'plus'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_premium(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_tier text;
BEGIN
  IF NOT public._is_master(v_uid) THEN
    RAISE EXCEPTION 'Somente o admin master pode revogar o Plus' USING ERRCODE = '42501';
  END IF;
  IF public._is_master(p_user_id) THEN
    RAISE EXCEPTION 'O Plus do admin master não pode ser revogado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.premium_grants
  SET revoked_at = now(), revoked_by = v_uid,
      revoke_reason = COALESCE(NULLIF(left(btrim(COALESCE(p_reason, '')), 500), ''), 'Revogada pelo admin master')
  WHERE user_id = p_user_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  v_tier := public._refresh_profile_tier(p_user_id);

  IF v_count > 0 THEN
    PERFORM public._audit('premium_revoked', jsonb_build_object(
      'target_user_id', p_user_id,
      'reason', left(COALESCE(p_reason, ''), 500),
      'still_plus_by_subscription', COALESCE(v_tier, 'free') = 'plus'));
  END IF;

  RETURN jsonb_build_object('success', true, 'changed', v_count > 0, 'tier', COALESCE(v_tier, 'free'));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_premium(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_premium(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Fim do prazo: acerta profiles.tier de quem perdeu a cortesia
--    (o servidor ja bloqueia na hora via get_user_tier; isto atualiza o app).
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
  WHERE p.tier = 'plus' AND p.billing_tier <> 'plus' AND NOT public._has_premium_grant(p.user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_premium_grants() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_premium_grants() TO service_role;

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron indisponivel: expiracao horaria das cortesias NAO agendada (o servidor ja bloqueia na hora).';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-premium-grants';
  PERFORM cron.schedule('expire-premium-grants', '7 * * * *', 'SELECT public.expire_premium_grants()');
END
$outer$;

-- -----------------------------------------------------------------------------
-- 6. Admin master: Plus permanente a partir de agora
-- -----------------------------------------------------------------------------
UPDATE public.profiles SET tier = tier
WHERE user_id IN (
  SELECT u.id FROM auth.users u
  WHERE lower(u.email) = public.master_admin_email() AND u.email_confirmed_at IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. Lista de usuarios do painel: origem do Plus e prazo da cortesia
--    (novo filtro 'granted' = Plus liberado pela administracao).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, integer, integer);
CREATE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text,
  tier text,
  total_quizzes integer,
  total_correct integer,
  total_questions integer,
  streak_days integer,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  access_level text,
  is_banned boolean,
  ban_type text,
  ban_expires_at timestamptz,
  ban_reason text,
  affiliate_status text,
  affiliate_code text,
  can_moderate boolean,
  premium_source text,
  premium_grant_expires_at timestamptz,
  premium_grant_reason text,
  total_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_level text := public._access_level(auth.uid());
  v_is_master boolean;
  v_pattern text;
BEGIN
  IF v_level NOT IN ('master', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  v_is_master := v_level = 'master';
  IF p_filter NOT IN ('all', 'staff', 'affiliates', 'banned', 'plus', 'granted') THEN
    p_filter := 'all';
  END IF;
  IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
    v_pattern := '%' || replace(replace(replace(left(btrim(p_search), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT p.user_id AS uid,
           CASE WHEN p.display_name IS NULL OR position('@' in p.display_name) > 0
                THEN NULL ELSE p.display_name END AS dname,
           u.email AS uemail,
           p.billing_tier AS ubilling,
           p.total_quizzes AS tq, p.total_correct AS tc, p.total_questions AS tqs,
           p.streak_days AS sd, p.created_at AS cat, u.last_sign_in_at AS lsi,
           public._access_level(p.user_id) AS lvl,
           b.ban_type AS btype, b.expires_at AS bexp, b.reason AS breason, (b.id IS NOT NULL) AS banned,
           CASE WHEN rc.id IS NULL THEN NULL
                WHEN rc.revoked_at IS NOT NULL THEN 'removed'
                WHEN NOT rc.is_active THEN 'paused' ELSE 'active' END AS aff,
           rc.code AS acode,
           g.id AS gid, g.expires_at AS gexp, g.reason AS greason
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT ub.id, ub.ban_type, ub.expires_at, ub.reason FROM public.user_bans ub
      WHERE ub.user_id = p.user_id AND ub.is_active AND (ub.expires_at IS NULL OR ub.expires_at > now())
      ORDER BY ub.banned_at DESC LIMIT 1
    ) b ON true
    LEFT JOIN LATERAL (
      SELECT pg.id, pg.expires_at, pg.reason FROM public.premium_grants pg
      WHERE pg.user_id = p.user_id AND pg.revoked_at IS NULL
        AND (pg.expires_at IS NULL OR pg.expires_at > now())
      ORDER BY pg.granted_at DESC LIMIT 1
    ) g ON true
    LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
    WHERE (v_pattern IS NULL
           OR p.display_name ILIKE v_pattern
           OR (v_is_master AND u.email ILIKE v_pattern)
           OR rc.code ILIKE v_pattern)
  ),
  enriched AS (
    SELECT b.*,
           CASE WHEN b.lvl = 'master' THEN 'master'
                WHEN b.ubilling = 'plus' THEN 'stripe'
                WHEN b.gid IS NOT NULL THEN 'grant'
                ELSE NULL END AS psource
    FROM base b
  )
  SELECT e.uid, e.dname,
         CASE WHEN v_is_master THEN e.uemail ELSE NULL END,
         CASE WHEN e.psource IS NULL THEN 'free' ELSE 'plus' END,
         e.tq, e.tc, e.tqs, e.sd, e.cat, e.lsi, e.lvl,
         e.banned, e.btype, e.bexp, e.breason, e.aff, e.acode,
         public._can_moderate(v_uid, e.uid),
         e.psource,
         e.gexp,
         CASE WHEN v_is_master THEN e.greason ELSE NULL END,
         count(*) OVER ()
  FROM enriched e
  WHERE CASE p_filter
          WHEN 'staff' THEN e.lvl <> 'user'
          WHEN 'affiliates' THEN e.aff IS NOT NULL
          WHEN 'banned' THEN e.banned
          WHEN 'plus' THEN e.psource IS NOT NULL
          WHEN 'granted' THEN e.gid IS NOT NULL
          ELSE true
        END
  ORDER BY (e.lvl = 'master') DESC, e.cat DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Metricas: receita e conversao contam so assinaturas pagas (billing_tier);
--    cortesias aparecem separadas em users.plus_granted.
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
      'plus_granted', (SELECT count(*) FROM public.profiles WHERE tier = 'plus' AND billing_tier <> 'plus'),
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
    'health', jsonb_build_object(
      'last_stripe_event_at', (SELECT max(received_at) FROM public.stripe_webhook_events),
      'stripe_events_30d', (SELECT count(*) FROM public.stripe_webhook_events WHERE received_at > now() - interval '30 days'),
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

-- -----------------------------------------------------------------------------
-- 9. Afiliados: "indicado ativo" = continua PAGANDO (cortesia nao conta).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_affiliate_dashboard(
  p_referral_code_id uuid DEFAULT NULL,
  p_months integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code public.referral_codes%ROWTYPE;
  v_months integer := LEAST(GREATEST(COALESCE(p_months, 6), 1), 24);
  v_tz constant text := 'America/Sao_Paulo';
  v_month_start timestamptz := date_trunc('month', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_prev_month_start timestamptz := (date_trunc('month', now() AT TIME ZONE v_tz) - interval '1 month') AT TIME ZONE v_tz;
  v_paid numeric;
  v_kpis jsonb;
  v_monthly jsonb;
  v_recent jsonb;
  v_payouts jsonb;
  v_rank integer;
  v_affiliates integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_referral_code_id IS NULL THEN
    SELECT * INTO v_code FROM public.referral_codes WHERE user_id = v_uid;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
  ELSE
    IF public._access_level(v_uid) NOT IN ('master', 'admin') THEN
      RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_code FROM public.referral_codes WHERE id = p_referral_code_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Afiliado não encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_paid FROM public.affiliate_payouts WHERE referral_code_id = v_code.id;

  WITH uses AS (
    SELECT ru.*, (p.billing_tier = 'plus') AS still_active
    FROM public.referral_uses ru
    LEFT JOIN public.profiles p ON p.user_id = ru.referred_user_id
    WHERE ru.referral_code_id = v_code.id
  ), visits AS (
    SELECT COALESCE(sum(visits), 0) AS total,
           COALESCE(sum(visits) FILTER (WHERE visit_date > (now() AT TIME ZONE v_tz)::date - 30), 0) AS last30
    FROM public.referral_link_visits WHERE referral_code_id = v_code.id
  )
  SELECT jsonb_build_object(
    'total_conversions', count(u.id),
    'conversions_this_month', count(u.id) FILTER (WHERE u.created_at >= v_month_start),
    'conversions_last_month', count(u.id) FILTER (WHERE u.created_at >= v_prev_month_start AND u.created_at < v_month_start),
    'conversions_30d', count(u.id) FILTER (WHERE u.created_at > now() - interval '30 days'),
    'gross_revenue', COALESCE(sum(u.subscription_amount), 0),
    'total_commission', v_code.total_earnings,
    'commission_this_month', COALESCE(sum(u.commission_earned) FILTER (WHERE u.created_at >= v_month_start), 0),
    'commission_last_month', COALESCE(sum(u.commission_earned) FILTER (WHERE u.created_at >= v_prev_month_start AND u.created_at < v_month_start), 0),
    'paid_out', v_paid,
    'balance_due', GREATEST(v_code.total_earnings - v_paid, 0),
    'avg_ticket', CASE WHEN count(u.id) > 0 THEN round(COALESCE(sum(u.subscription_amount), 0) / count(u.id), 2) ELSE 0 END,
    'active_referrals', count(u.id) FILTER (WHERE u.still_active),
    'retention_rate', CASE WHEN count(u.id) > 0
                       THEN round(100.0 * count(u.id) FILTER (WHERE u.still_active) / count(u.id), 1) ELSE NULL END,
    'visits_total', (SELECT total FROM visits),
    'visits_30d', (SELECT last30 FROM visits),
    'conversion_rate_30d', CASE WHEN (SELECT last30 FROM visits) > 0
      THEN round(100.0 * count(u.id) FILTER (WHERE u.created_at > now() - interval '30 days') / (SELECT last30 FROM visits), 1)
      ELSE NULL END,
    'last_conversion_at', max(u.created_at)
  ) INTO v_kpis
  FROM uses u;

  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now() AT TIME ZONE v_tz) - make_interval(months => v_months - 1),
      date_trunc('month', now() AT TIME ZONE v_tz),
      interval '1 month')::date AS m
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', to_char(m.m, 'YYYY-MM'),
    'conversions', (SELECT count(*) FROM public.referral_uses ru
                    WHERE ru.referral_code_id = v_code.id
                      AND date_trunc('month', ru.created_at AT TIME ZONE v_tz)::date = m.m),
    'revenue', (SELECT COALESCE(sum(subscription_amount), 0) FROM public.referral_uses ru
                WHERE ru.referral_code_id = v_code.id
                  AND date_trunc('month', ru.created_at AT TIME ZONE v_tz)::date = m.m),
    'commission', (SELECT COALESCE(sum(commission_earned), 0) FROM public.referral_uses ru
                   WHERE ru.referral_code_id = v_code.id
                     AND date_trunc('month', ru.created_at AT TIME ZONE v_tz)::date = m.m),
    'visits', (SELECT COALESCE(sum(visits), 0) FROM public.referral_link_visits rv
               WHERE rv.referral_code_id = v_code.id AND date_trunc('month', rv.visit_date)::date = m.m)
  ) ORDER BY m.m), '[]'::jsonb) INTO v_monthly
  FROM months m;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT ru.id, ru.created_at, ru.subscription_amount, ru.commission_earned,
           COALESCE(p.billing_tier = 'plus', false) AS is_active_subscriber
    FROM public.referral_uses ru
    LEFT JOIN public.profiles p ON p.user_id = ru.referred_user_id
    WHERE ru.referral_code_id = v_code.id
    ORDER BY ru.created_at DESC
    LIMIT 10
  ) r;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.paid_at DESC), '[]'::jsonb) INTO v_payouts
  FROM (
    SELECT id, amount, paid_at, method, reference
    FROM public.affiliate_payouts WHERE referral_code_id = v_code.id
    ORDER BY paid_at DESC LIMIT 10
  ) x;

  SELECT count(*) INTO v_affiliates FROM public.referral_codes WHERE is_active AND revoked_at IS NULL;
  SELECT 1 + count(*) INTO v_rank FROM public.referral_codes
  WHERE is_active AND revoked_at IS NULL AND total_earnings > v_code.total_earnings;

  RETURN jsonb_build_object(
    'referral_code_id', v_code.id,
    'code', v_code.code,
    'is_active', v_code.is_active AND v_code.revoked_at IS NULL,
    'status', CASE WHEN v_code.revoked_at IS NOT NULL THEN 'removed'
                   WHEN NOT v_code.is_active THEN 'paused' ELSE 'active' END,
    'commission_percent', v_code.commission_percent,
    'discount_percent', v_code.discount_percent,
    'member_since', v_code.created_at,
    'kpis', v_kpis,
    'monthly', v_monthly,
    'recent', v_recent,
    'payouts', v_payouts,
    'rank', CASE WHEN v_code.is_active AND v_code.revoked_at IS NULL THEN v_rank ELSE NULL END,
    'active_affiliates', v_affiliates
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_affiliate_dashboard(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_affiliate_dashboard(uuid, integer) TO authenticated;
