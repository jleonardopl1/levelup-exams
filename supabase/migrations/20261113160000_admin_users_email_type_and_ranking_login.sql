-- =============================================================================
-- 1. Painel admin -> Usuarios mostrava "Nenhum usuario encontrado".
--    auth.users.email e varchar(255) no Supabase, mas admin_list_users declara
--    "email text": o RETURN QUERY falhava ("structure of query does not match
--    function result type") e o painel recebia erro. Conversao explicita para text.
-- 2. Ranking so para quem tem conta: get_leaderboard (nomes dos alunos) deixa de
--    ser executavel por visitantes anonimos. O app exige login nessa tela.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_users(
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
  has_premium_grant boolean,
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
           u.email::text AS uemail,
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
         (e.gid IS NOT NULL),
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

-- Ranking: somente alunos logados.
REVOKE EXECUTE ON FUNCTION public.get_leaderboard(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, int) TO authenticated;
