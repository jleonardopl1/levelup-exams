-- =============================================================================
-- ADMIN MASTER, NIVEIS DE ACESSO E PROGRAMA DE AFILIADOS
--
-- Modelo de acesso (do maior para o menor):
--   master    -> dono da plataforma (identificado pelo e-mail confirmado abaixo).
--                Unico que cria/altera/revoga niveis de acesso, adiciona/remove
--                afiliados, registra pagamentos de comissao e altera configuracoes.
--   admin     -> painel completo em modo leitura de acessos/afiliados; modera
--                usuarios comuns (banir/desbanir), conteudo e auditoria.
--   moderator -> painel restrito: moderacao de usuarios comuns e de questoes.
--   user      -> acesso normal ao app.
--   afiliado  -> nao e um nivel de acesso: e um usuario com codigo de indicacao
--                ativo (referral_codes). Ve somente o proprio dashboard.
--
-- Principios (mesmos de 20261110120000_security_hardening.sql):
--   * Toda escrita privilegiada passa por RPC SECURITY DEFINER que valida o
--     chamador no servidor; grants de escrita direta foram revogados.
--   * Toda RPC tem search_path fixo e EXECUTE revogado de PUBLIC/anon.
--   * Toda acao administrativa gera registro em audit_logs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Identidade do admin master
-- -----------------------------------------------------------------------------
-- Fixado no codigo (e nao em tabela editavel) de proposito: trocar o dono da
-- plataforma exige uma nova migration revisada, nunca uma escrita pelo app.
CREATE OR REPLACE FUNCTION public.master_admin_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 'jleonardopl@gmail.com'::text $$;

-- Uso interno (outras funcoes SECURITY DEFINER). Nao executavel por clientes.
CREATE OR REPLACE FUNCTION public._is_master(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id
      AND lower(u.email) = public.master_admin_email()
      AND u.email_confirmed_at IS NOT NULL
  )
$$;

-- Uso interno: papel de QUALQUER usuario (has_role so responde sobre o proprio chamador).
-- Membro da equipe banido perde os poderes na hora (sem esperar o token expirar).
CREATE OR REPLACE FUNCTION public._has_role(p_user_id uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.is_user_banned(p_user_id)
     AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role)
          OR (p_role = 'admin' AND public._is_master(p_user_id)))
$$;

-- Peso de cada nivel (para comparar quem emitiu um banimento com quem tenta altera-lo).
CREATE OR REPLACE FUNCTION public._level_rank(p_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_level WHEN 'master' THEN 3 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 1 ELSE 0 END
$$;

-- Nivel efetivo: master > admin > moderator > user.
CREATE OR REPLACE FUNCTION public._access_level(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public._is_master(p_user_id) THEN 'master'
    WHEN public._has_role(p_user_id, 'admin') THEN 'admin'
    WHEN public._has_role(p_user_id, 'moderator') THEN 'moderator'
    ELSE 'user'
  END
$$;

-- Registro de auditoria a partir das RPCs (audit_logs nao aceita escrita do cliente).
CREATE OR REPLACE FUNCTION public._audit(p_event text, p_metadata jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.audit_logs (event_type, user_id, user_email, success, metadata)
  VALUES (
    p_event,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    true,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._is_master(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._level_rank(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._access_level(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._audit(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._is_master(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public._access_level(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.master_admin_email() FROM PUBLIC, anon, authenticated;

-- has_role: o master e sempre admin (mesmo sem linha em user_roles). Mantem a
-- restricao [H5]: clientes so perguntam sobre si mesmos.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (_user_id = auth.uid() OR auth.role() = 'service_role')
     AND public._has_role(_user_id, _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Linha explicita de admin para o master (se a conta ja existir e estiver confirmada).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = public.master_admin_email() AND u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. Niveis de acesso: somente o master escreve em user_roles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

-- O papel de admin do master nunca pode ser removido (nem por service_role),
-- exceto quando a propria conta e excluida (cascade de auth.users).
CREATE OR REPLACE FUNCTION public.protect_master_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' AND public._is_master(OLD.user_id)
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'O acesso do admin master não pode ser revogado' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_master_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_master_role ON public.user_roles;
CREATE TRIGGER protect_master_role
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_master_role();

-- Define o nivel de acesso de um usuario de forma atomica (master apenas).
-- p_level: 'admin' | 'moderator' | 'user'
CREATE OR REPLACE FUNCTION public.admin_set_access_level(p_user_id uuid, p_level text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_before text;
BEGIN
  IF NOT public._is_master(v_uid) THEN
    RAISE EXCEPTION 'Somente o admin master pode alterar níveis de acesso' USING ERRCODE = '42501';
  END IF;
  IF p_level NOT IN ('admin', 'moderator', 'user') THEN
    RAISE EXCEPTION 'Nível de acesso inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF public._is_master(p_user_id) THEN
    RAISE EXCEPTION 'O nível do admin master não pode ser alterado' USING ERRCODE = '42501';
  END IF;

  v_before := public._access_level(p_user_id);
  IF v_before = p_level THEN
    RETURN jsonb_build_object('success', true, 'changed', false, 'level', p_level);
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role IN ('admin', 'moderator');
  IF p_level IN ('admin', 'moderator') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_level::public.app_role);
  END IF;

  PERFORM public._audit('access_level_changed', jsonb_build_object(
    'target_user_id', p_user_id,
    'from', v_before,
    'to', p_level,
    'reason', left(COALESCE(p_reason, ''), 500)
  ));

  RETURN jsonb_build_object('success', true, 'changed', true, 'from', v_before, 'level', p_level);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_access_level(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_access_level(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Moderacao (banimento) com hierarquia
--    * staff (admin/moderador) bane apenas usuarios comuns;
--    * somente o master bane/desbane membros da equipe;
--    * ninguem bane a si mesmo nem o master;
--    * um banimento so e alterado/retirado por quem tem nivel >= ao de quem o emitiu.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage bans" ON public.user_bans;
DROP POLICY IF EXISTS "Staff can view bans" ON public.user_bans;
CREATE POLICY "Staff can view bans"
  ON public.user_bans FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')) OR (SELECT public.has_role(auth.uid(), 'moderator')));
REVOKE INSERT, UPDATE, DELETE ON public.user_bans FROM anon, authenticated;
GRANT SELECT ON public.user_bans TO authenticated;

ALTER TABLE public.user_bans
  ADD CONSTRAINT user_bans_type_valid CHECK (ban_type IN ('temporary', 'permanent')) NOT VALID;

CREATE OR REPLACE FUNCTION public._can_moderate(p_actor uuid, p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_actor IS NOT NULL
     AND p_actor <> p_target
     AND NOT public._is_master(p_target)
     AND public._access_level(p_actor) IN ('master', 'admin', 'moderator')
     AND (public._is_master(p_actor) OR public._access_level(p_target) = 'user')
$$;
REVOKE ALL ON FUNCTION public._can_moderate(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._can_moderate(uuid, uuid) TO service_role;

-- O banimento ativo do alvo (se houver) foi emitido por alguem de nivel maior que o do ator?
CREATE OR REPLACE FUNCTION public._ban_outranks(p_actor uuid, p_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans b
    WHERE b.user_id = p_target AND b.is_active
      AND (b.expires_at IS NULL OR b.expires_at > now())
      AND public._level_rank(public._access_level(b.banned_by)) > public._level_rank(public._access_level(p_actor))
  )
$$;
REVOKE ALL ON FUNCTION public._ban_outranks(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ban_outranks(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id uuid, p_ban_type text, p_days integer DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expires timestamptz;
  v_ban_id uuid;
BEGIN
  IF public._access_level(v_uid) NOT IN ('master', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public._can_moderate(v_uid, p_user_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para banir este usuário' USING ERRCODE = '42501';
  END IF;
  IF public._ban_outranks(v_uid, p_user_id) THEN
    RAISE EXCEPTION 'Este banimento foi aplicado por um nível superior e só ele pode alterá-lo' USING ERRCODE = '42501';
  END IF;
  IF p_ban_type NOT IN ('temporary', 'permanent') THEN
    RAISE EXCEPTION 'Tipo de banimento inválido' USING ERRCODE = '22023';
  END IF;
  IF p_ban_type = 'temporary' THEN
    IF p_days IS NULL OR p_days < 1 OR p_days > 3650 THEN
      RAISE EXCEPTION 'Duração inválida (1 a 3650 dias)' USING ERRCODE = '22023';
    END IF;
    v_expires := now() + make_interval(days => p_days);
  END IF;

  -- Um unico banimento ativo por usuario.
  UPDATE public.user_bans SET is_active = false WHERE user_id = p_user_id AND is_active;

  INSERT INTO public.user_bans (user_id, banned_by, ban_type, reason, expires_at)
  VALUES (p_user_id, v_uid, p_ban_type, NULLIF(left(btrim(COALESCE(p_reason, '')), 500), ''), v_expires)
  RETURNING id INTO v_ban_id;

  PERFORM public._audit('user_banned', jsonb_build_object(
    'target_user_id', p_user_id, 'ban_type', p_ban_type,
    'ban_days', CASE WHEN p_ban_type = 'temporary' THEN p_days::text ELSE '' END,
    'reason', left(COALESCE(p_reason, ''), 500)));

  RETURN jsonb_build_object('success', true, 'ban_id', v_ban_id, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT public._can_moderate(v_uid, p_user_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para desbanir este usuário' USING ERRCODE = '42501';
  END IF;
  IF public._ban_outranks(v_uid, p_user_id) THEN
    RAISE EXCEPTION 'Este banimento foi aplicado por um nível superior e só ele pode retirá-lo' USING ERRCODE = '42501';
  END IF;
  UPDATE public.user_bans SET is_active = false WHERE user_id = p_user_id AND is_active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    PERFORM public._audit('user_unbanned', jsonb_build_object('target_user_id', p_user_id));
  END IF;
  RETURN jsonb_build_object('success', true, 'changed', v_count > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unban_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;

-- Admins nao editam perfis alheios (antes podiam alterar nome/estatisticas de qualquer
-- conta, inclusive do master, e manipular o ranking). O painel nao usa essa escrita.
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Moderadores: leitura de perfis e moderacao de questoes (premium on/off).
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;
CREATE POLICY "Moderators can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'moderator')));

DROP POLICY IF EXISTS "Questions readable by tier" ON public.questions;
CREATE POLICY "Questions readable by tier"
  ON public.questions FOR SELECT TO authenticated
  USING (
    is_premium = false
    OR (SELECT public.get_user_tier(auth.uid())) = 'plus'
    OR (SELECT public.has_role(auth.uid(), 'admin'))
    OR (SELECT public.has_role(auth.uid(), 'moderator'))
  );

DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
CREATE POLICY "Staff can update questions"
  ON public.questions FOR UPDATE TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')) OR (SELECT public.has_role(auth.uid(), 'moderator')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')) OR (SELECT public.has_role(auth.uid(), 'moderator')));

-- -----------------------------------------------------------------------------
-- 4. Configuracoes da plataforma (somente o master altera)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;

INSERT INTO public.platform_settings (key, value) VALUES
  ('affiliate_self_enrollment', 'true'::jsonb),            -- Top Players criam o proprio codigo
  ('affiliate_default_commission_percent', '3'::jsonb),    -- padrao do painel e da autoinscricao
  ('affiliate_default_discount_percent', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.affiliate_self_enrollment_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true'::jsonb FROM public.platform_settings
                   WHERE key = 'affiliate_self_enrollment'), true)
$$;
REVOKE ALL ON FUNCTION public.affiliate_self_enrollment_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_self_enrollment_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public._access_level(auth.uid()) NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((SELECT jsonb_object_agg(key, value) FROM public.platform_settings), '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_setting(p_key text, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
BEGIN
  IF NOT public._is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o admin master pode alterar configurações' USING ERRCODE = '42501';
  END IF;
  IF p_key = 'affiliate_self_enrollment' THEN
    IF jsonb_typeof(p_value) <> 'boolean' THEN
      RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023';
    END IF;
  ELSIF p_key = 'affiliate_default_commission_percent' THEN
    IF jsonb_typeof(p_value) <> 'number' OR (p_value)::numeric < 0 OR (p_value)::numeric > 50 THEN
      RAISE EXCEPTION 'Comissão deve estar entre 0 e 50%%' USING ERRCODE = '22023';
    END IF;
  ELSIF p_key = 'affiliate_default_discount_percent' THEN
    IF jsonb_typeof(p_value) <> 'number' OR (p_value)::numeric < 0 OR (p_value)::numeric > 50
       OR (p_value)::numeric <> trunc((p_value)::numeric) THEN
      RAISE EXCEPTION 'Desconto deve ser inteiro entre 0 e 50%%' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Configuração desconhecida' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_old FROM public.platform_settings WHERE key = p_key;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();

  PERFORM public._audit('setting_updated', jsonb_build_object('key', p_key, 'from', v_old, 'to', p_value));
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_get_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_setting(text, jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Afiliados: cadastro gerenciado pelo master
-- -----------------------------------------------------------------------------
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'self_service',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_source_valid CHECK (source IN ('self_service', 'admin')) NOT VALID,
  ADD CONSTRAINT referral_codes_commission_range CHECK (commission_percent BETWEEN 0 AND 50) NOT VALID,
  ADD CONSTRAINT referral_codes_discount_range CHECK (discount_percent BETWEEN 0 AND 50) NOT VALID,
  ADD CONSTRAINT referral_codes_code_format CHECK (code ~ '^[A-Z0-9]{4,20}$') NOT VALID,
  ADD CONSTRAINT referral_codes_totals_non_negative CHECK (total_uses >= 0 AND total_earnings >= 0) NOT VALID;

-- Admin (nao master) passa a ser somente leitura sobre afiliados.
DROP POLICY IF EXISTS "Admins can update referral codes" ON public.referral_codes;
REVOKE ALL ON public.referral_codes FROM anon, authenticated;
-- Colunas internas do master (notes, revoked_reason, created_by) nao sao legiveis pelo cliente;
-- o painel as obtem pela RPC admin_affiliate_overview.
GRANT SELECT (id, user_id, code, discount_percent, commission_percent, is_active, total_uses,
              total_earnings, created_at, updated_at, revoked_at, source)
  ON public.referral_codes TO authenticated;
GRANT INSERT (user_id, code) ON public.referral_codes TO authenticated;  -- autoinscricao (policy abaixo)

-- Condicoes padrao do programa (nao sensiveis; usadas pela autoinscricao e pelo painel).
CREATE OR REPLACE FUNCTION public.affiliate_default_terms()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'commission_percent', COALESCE((SELECT (value)::numeric FROM public.platform_settings
                                    WHERE key = 'affiliate_default_commission_percent'), 3),
    'discount_percent', COALESCE((SELECT (value)::numeric::integer FROM public.platform_settings
                                  WHERE key = 'affiliate_default_discount_percent'), 10))
$$;
REVOKE ALL ON FUNCTION public.affiliate_default_terms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.affiliate_default_terms() TO authenticated;

-- Autoinscricao: condicoes sempre definidas pelo servidor (padroes configurados pelo master).
-- SECURITY INVOKER de proposito: current_user identifica a escrita vinda do cliente.
CREATE OR REPLACE FUNCTION public.apply_self_enrollment_terms()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_terms jsonb;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    v_terms := public.affiliate_default_terms();
    NEW.commission_percent := round((v_terms->>'commission_percent')::numeric, 2);
    NEW.discount_percent := (v_terms->>'discount_percent')::integer;
    NEW.code := upper(btrim(NEW.code));
    NEW.is_active := true;
    NEW.total_uses := 0;
    NEW.total_earnings := 0;
    NEW.source := 'self_service';
    NEW.created_by := NULL;
    NEW.notes := NULL;
    NEW.revoked_at := NULL;
    NEW.revoked_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_self_enrollment_terms() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS apply_self_enrollment_terms ON public.referral_codes;
CREATE TRIGGER apply_self_enrollment_terms
  BEFORE INSERT ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.apply_self_enrollment_terms();

-- Autoinscricao de Top Players: mesma regra anterior + chave liga/desliga do master.
DROP POLICY IF EXISTS "Top players can create their referral code" ON public.referral_codes;
CREATE POLICY "Top players can create their referral code"
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT public.affiliate_self_enrollment_enabled())
    AND code ~ '^[A-Z0-9]{4,20}$'
    AND source = 'self_service'   -- demais condicoes forcadas pelo trigger apply_self_enrollment_terms
    AND (
      (
        (SELECT public.get_user_tier(auth.uid())) = 'plus'
        AND EXISTS (SELECT 1 FROM public.user_rewards r
                    WHERE r.user_id = auth.uid() AND r.total_points >= 10000)
      )
      OR EXISTS (
        SELECT 1 FROM public.user_redemptions ur
        JOIN public.reward_catalog rc ON rc.id = ur.reward_id
        WHERE ur.user_id = auth.uid() AND rc.reward_type = 'top_player'
      )
    )
  );

-- Pagamentos de comissao (registrados pelo master).
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'pix' CHECK (method IN ('pix', 'transferencia', 'outro')),
  reference text CHECK (reference IS NULL OR char_length(reference) <= 200),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_code ON public.affiliate_payouts(referral_code_id, paid_at DESC);
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
-- Sem acesso direto do cliente: leitura pelas RPCs de dashboard (sem notas internas).
REVOKE ALL ON public.affiliate_payouts FROM anon, authenticated;

-- Visitas ao link de indicacao (contador diario agregado, sem dados pessoais).
CREATE TABLE IF NOT EXISTS public.referral_link_visits (
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  visit_date date NOT NULL,
  visits integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
  PRIMARY KEY (referral_code_id, visit_date)
);
ALTER TABLE public.referral_link_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_link_visits FROM anon, authenticated;

-- Conversoes: vinculo com a sessao de checkout (idempotencia do webhook).
ALTER TABLE public.referral_uses
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS referral_uses_checkout_session_uniq
  ON public.referral_uses(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_uses_code_created ON public.referral_uses(referral_code_id, created_at DESC);

-- Sem acesso direto do cliente: o afiliado ve agregados pela RPC e nunca o id do indicado.
DROP POLICY IF EXISTS "Referral code owners can view their referral uses" ON public.referral_uses;
DROP VIEW IF EXISTS public.referral_uses_limited;  -- nao usada pelo app
REVOKE ALL ON public.referral_uses FROM anon, authenticated;

-- Direito de exclusao (LGPD): com conversoes reais registradas, as FKs antigas (NO ACTION)
-- impediam excluir a conta do indicado ou do afiliado. O indicado excluido vira anonimo
-- (a venda continua contabilizada); a exclusao do afiliado remove seu historico, que
-- permanece resumido em audit_logs.
ALTER TABLE public.referral_uses ALTER COLUMN referred_user_id DROP NOT NULL;
ALTER TABLE public.referral_uses DROP CONSTRAINT IF EXISTS referral_uses_referred_user_id_fkey;
ALTER TABLE public.referral_uses ADD CONSTRAINT referral_uses_referred_user_id_fkey
  FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.referral_uses DROP CONSTRAINT IF EXISTS referral_uses_referral_code_id_fkey;
ALTER TABLE public.referral_uses ADD CONSTRAINT referral_uses_referral_code_id_fkey
  FOREIGN KEY (referral_code_id) REFERENCES public.referral_codes(id) ON DELETE CASCADE;

-- Defesa em profundidade: TRUNCATE nunca e necessario para clientes.
REVOKE TRUNCATE ON public.user_roles, public.user_bans, public.referral_codes,
  public.referral_uses, public.profiles, public.audit_logs FROM anon, authenticated;

-- Acesso do proprio chamador (usado pelo frontend para montar menus e abas).
CREATE OR REPLACE FUNCTION public.get_my_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_level text;
  v_code public.referral_codes%ROWTYPE;
  v_found boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('access_level', 'anonymous', 'is_master', false, 'is_admin', false,
                              'is_staff', false, 'is_affiliate', false, 'affiliate_active', false);
  END IF;
  v_level := public._access_level(v_uid);
  SELECT * INTO v_code FROM public.referral_codes WHERE user_id = v_uid;
  v_found := FOUND;
  RETURN jsonb_build_object(
    'access_level', v_level,
    'is_master', v_level = 'master',
    'is_admin', v_level IN ('master', 'admin'),
    'is_staff', v_level IN ('master', 'admin', 'moderator'),
    'is_affiliate', v_found,
    'affiliate_active', v_found AND v_code.is_active AND v_code.revoked_at IS NULL
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_access() TO authenticated;

-- Adiciona (ou reativa) um afiliado. Master apenas.
CREATE OR REPLACE FUNCTION public.admin_add_affiliate(
  p_email text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_commission_percent numeric DEFAULT NULL,
  p_discount_percent integer DEFAULT NULL,
  p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid := p_user_id;
  v_code text := upper(btrim(COALESCE(p_code, '')));
  v_commission numeric;
  v_discount integer;
  v_existing public.referral_codes%ROWTYPE;
  v_id uuid;
  v_reactivated boolean := false;
BEGIN
  IF NOT public._is_master(v_uid) THEN
    RAISE EXCEPTION 'Somente o admin master pode adicionar afiliados' USING ERRCODE = '42501';
  END IF;

  IF v_target IS NULL THEN
    IF p_email IS NULL OR btrim(p_email) = '' THEN
      RAISE EXCEPTION 'Informe o e-mail do usuário' USING ERRCODE = '22023';
    END IF;
    SELECT id INTO v_target FROM auth.users
    WHERE lower(email) = lower(btrim(p_email)) AND email_confirmed_at IS NOT NULL
    LIMIT 1;
    IF v_target IS NULL THEN
      RAISE EXCEPTION 'Nenhuma conta confirmada com este e-mail' USING ERRCODE = 'P0002';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_target) THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_code !~ '^[A-Z0-9]{4,20}$' THEN
    RAISE EXCEPTION 'Código inválido: use de 4 a 20 letras/números, sem espaços' USING ERRCODE = '22023';
  END IF;

  v_commission := COALESCE(p_commission_percent,
    (SELECT (value)::numeric FROM public.platform_settings WHERE key = 'affiliate_default_commission_percent'), 3);
  v_discount := COALESCE(p_discount_percent,
    (SELECT (value)::numeric::integer FROM public.platform_settings WHERE key = 'affiliate_default_discount_percent'), 10);
  IF v_commission < 0 OR v_commission > 50 THEN
    RAISE EXCEPTION 'Comissão deve estar entre 0 e 50%%' USING ERRCODE = '22023';
  END IF;
  IF v_discount < 0 OR v_discount > 50 THEN
    RAISE EXCEPTION 'Desconto deve estar entre 0 e 50%%' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_codes WHERE code = v_code AND user_id <> v_target) THEN
    RAISE EXCEPTION 'Este código já está em uso por outro afiliado' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_existing FROM public.referral_codes WHERE user_id = v_target FOR UPDATE;
  IF FOUND THEN
    IF v_existing.is_active AND v_existing.revoked_at IS NULL THEN
      RAISE EXCEPTION 'Este usuário já é um afiliado ativo' USING ERRCODE = '23505';
    END IF;
    -- Reativacao preserva o historico financeiro (usos, ganhos e pagamentos).
    UPDATE public.referral_codes SET
      code = v_code,
      commission_percent = round(v_commission, 2),
      discount_percent = v_discount,
      notes = NULLIF(left(btrim(COALESCE(p_notes, '')), 500), ''),
      is_active = true,
      revoked_at = NULL,
      revoked_reason = NULL,
      updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_id;
    v_reactivated := true;
  ELSE
    INSERT INTO public.referral_codes
      (user_id, code, commission_percent, discount_percent, is_active, source, created_by, notes)
    VALUES
      (v_target, v_code, round(v_commission, 2), v_discount, true, 'admin', v_uid,
       NULLIF(left(btrim(COALESCE(p_notes, '')), 500), ''))
    RETURNING id INTO v_id;
  END IF;

  PERFORM public._audit('affiliate_added', jsonb_build_object(
    'target_user_id', v_target, 'referral_code_id', v_id, 'code', v_code,
    'commission_percent', v_commission, 'discount_percent', v_discount, 'reactivated', v_reactivated));

  RETURN jsonb_build_object('success', true, 'referral_code_id', v_id, 'code', v_code,
                            'user_id', v_target, 'reactivated', v_reactivated);
END;
$$;

-- Edita condicoes / pausa / retoma um afiliado. Master apenas.
CREATE OR REPLACE FUNCTION public.admin_update_affiliate(
  p_referral_code_id uuid,
  p_commission_percent numeric DEFAULT NULL,
  p_discount_percent integer DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.referral_codes%ROWTYPE;
BEGIN
  IF NOT public._is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o admin master pode editar afiliados' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.referral_codes WHERE id = p_referral_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Afiliado não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.revoked_at IS NOT NULL AND p_is_active IS TRUE THEN
    RAISE EXCEPTION 'Afiliado removido: use "Adicionar afiliado" para reativar' USING ERRCODE = '22023';
  END IF;
  IF p_commission_percent IS NOT NULL AND (p_commission_percent < 0 OR p_commission_percent > 50) THEN
    RAISE EXCEPTION 'Comissão deve estar entre 0 e 50%%' USING ERRCODE = '22023';
  END IF;
  IF p_discount_percent IS NOT NULL AND (p_discount_percent < 0 OR p_discount_percent > 50) THEN
    RAISE EXCEPTION 'Desconto deve estar entre 0 e 50%%' USING ERRCODE = '22023';
  END IF;

  UPDATE public.referral_codes SET
    commission_percent = COALESCE(round(p_commission_percent, 2), commission_percent),
    discount_percent = COALESCE(p_discount_percent, discount_percent),
    is_active = COALESCE(p_is_active, is_active),
    notes = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(left(btrim(p_notes), 500), '') END,
    updated_at = now()
  WHERE id = p_referral_code_id;

  PERFORM public._audit('affiliate_updated', jsonb_build_object(
    'target_user_id', v_row.user_id, 'referral_code_id', v_row.id, 'code', v_row.code,
    'commission_percent', p_commission_percent, 'discount_percent', p_discount_percent,
    'is_active', p_is_active));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Remove um afiliado do programa (o codigo deixa de funcionar imediatamente).
-- O historico financeiro e preservado: sem ele nao ha como prestar contas de
-- comissoes ja geradas ou pagas.
CREATE OR REPLACE FUNCTION public.admin_remove_affiliate(p_referral_code_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.referral_codes%ROWTYPE;
BEGIN
  IF NOT public._is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o admin master pode remover afiliados' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.referral_codes WHERE id = p_referral_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Afiliado não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'changed', false);
  END IF;

  UPDATE public.referral_codes SET
    is_active = false,
    revoked_at = now(),
    revoked_reason = NULLIF(left(btrim(COALESCE(p_reason, '')), 500), ''),
    updated_at = now()
  WHERE id = p_referral_code_id;

  PERFORM public._audit('affiliate_removed', jsonb_build_object(
    'target_user_id', v_row.user_id, 'referral_code_id', v_row.id, 'code', v_row.code,
    'reason', left(COALESCE(p_reason, ''), 500)));
  RETURN jsonb_build_object('success', true, 'changed', true);
END;
$$;

-- Registra um pagamento de comissao (nao pode exceder o saldo devido).
CREATE OR REPLACE FUNCTION public.admin_register_payout(
  p_referral_code_id uuid,
  p_amount numeric,
  p_method text DEFAULT 'pix',
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.referral_codes%ROWTYPE;
  v_paid numeric;
  v_balance numeric;
  v_id uuid;
BEGIN
  IF NOT public._is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Somente o admin master pode registrar pagamentos' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.referral_codes WHERE id = p_referral_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Afiliado não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_method, 'pix') NOT IN ('pix', 'transferencia', 'outro') THEN
    RAISE EXCEPTION 'Método inválido' USING ERRCODE = '22023';
  END IF;
  IF p_paid_at IS NOT NULL AND p_paid_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Data de pagamento no futuro' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_paid FROM public.affiliate_payouts WHERE referral_code_id = v_row.id;
  v_balance := v_row.total_earnings - v_paid;
  IF round(p_amount, 2) > v_balance THEN
    RAISE EXCEPTION 'Valor maior que o saldo a pagar (R$ %)', to_char(v_balance, 'FM999G999G990D00')
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.affiliate_payouts (referral_code_id, amount, method, reference, notes, paid_at, created_by)
  VALUES (v_row.id, round(p_amount, 2), COALESCE(p_method, 'pix'),
          NULLIF(left(btrim(COALESCE(p_reference, '')), 200), ''),
          NULLIF(left(btrim(COALESCE(p_notes, '')), 500), ''),
          COALESCE(p_paid_at, now()), auth.uid())
  RETURNING id INTO v_id;

  PERFORM public._audit('affiliate_payout', jsonb_build_object(
    'target_user_id', v_row.user_id, 'referral_code_id', v_row.id, 'code', v_row.code,
    'amount', round(p_amount, 2), 'method', COALESCE(p_method, 'pix')));
  RETURN jsonb_build_object('success', true, 'payout_id', v_id, 'balance', v_balance - round(p_amount, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_affiliate(text, uuid, text, numeric, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_affiliate(uuid, numeric, integer, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_affiliate(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_register_payout(uuid, numeric, text, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_affiliate(text, uuid, text, numeric, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_affiliate(uuid, numeric, integer, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_affiliate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_register_payout(uuid, numeric, text, text, text, timestamptz) TO authenticated;

-- validate_referral_code: ignora afiliados removidos.
CREATE OR REPLACE FUNCTION public.validate_referral_code(code_to_validate text)
RETURNS TABLE (id uuid, code text, discount_percent integer, is_valid boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.id, rc.code, rc.discount_percent, true
  FROM public.referral_codes rc
  WHERE rc.code = upper(btrim(code_to_validate))
    AND rc.is_active = true
    AND rc.revoked_at IS NULL
    -- mesmas regras do checkout: nao vale o proprio codigo, e cada comprador usa um so
    AND rc.user_id <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.referral_uses ru WHERE ru.referred_user_id = auth.uid())
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Rastreamento de visitas e conversoes
-- -----------------------------------------------------------------------------
-- Visita ao link /?ref=CODIGO. Nao retorna nada (nao serve para testar codigos).
-- O cliente deduplica por dia; o teto diario limita o impacto de abuso.
CREATE OR REPLACE FUNCTION public.track_referral_visit(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_code IS NULL OR upper(btrim(p_code)) !~ '^[A-Z0-9]{4,20}$' THEN
    RETURN;
  END IF;
  SELECT id INTO v_id FROM public.referral_codes
  WHERE code = upper(btrim(p_code)) AND is_active AND revoked_at IS NULL;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.referral_link_visits AS v (referral_code_id, visit_date, visits)
  VALUES (v_id, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
  ON CONFLICT (referral_code_id, visit_date) DO UPDATE
    SET visits = LEAST(v.visits + 1, 100000);
END;
$$;
REVOKE ALL ON FUNCTION public.track_referral_visit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_referral_visit(text) TO anon, authenticated;

-- Conversao confirmada pelo webhook do Stripe (service_role apenas). Idempotente.
CREATE OR REPLACE FUNCTION public.record_referral_conversion(
  p_referral_code_id uuid,
  p_referred_user_id uuid,
  p_amount numeric,
  p_checkout_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.referral_codes%ROWTYPE;
  v_amount numeric := round(GREATEST(COALESCE(p_amount, 0), 0), 2);
  v_commission numeric;
  v_use_id uuid;
BEGIN
  SELECT * INTO v_code FROM public.referral_codes WHERE id = p_referral_code_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'code_not_found');
  END IF;
  IF v_code.user_id = p_referred_user_id THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'self_referral');
  END IF;

  -- Comissao calculada com o percentual vigente no momento da venda. Uma sessao de
  -- checkout aberta antes de o codigo ser pausado/removido ainda conclui a venda (o
  -- comprador ja viu o desconto), mas nao gera comissao: a remocao vale na hora.
  v_commission := CASE WHEN v_code.is_active AND v_code.revoked_at IS NULL
                       THEN round(v_amount * v_code.commission_percent / 100, 2) ELSE 0 END;

  INSERT INTO public.referral_uses
    (referral_code_id, referred_user_id, subscription_amount, commission_earned, stripe_checkout_session_id)
  VALUES (v_code.id, p_referred_user_id, v_amount, v_commission, p_checkout_session_id)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_use_id;

  IF v_use_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'already_recorded');
  END IF;

  UPDATE public.referral_codes
     SET total_uses = total_uses + 1,
         total_earnings = total_earnings + v_commission,
         updated_at = now()
   WHERE id = v_code.id;

  INSERT INTO public.audit_logs (event_type, user_id, success, metadata)
  VALUES ('affiliate_conversion', v_code.user_id, true, jsonb_build_object(
    'referral_code_id', v_code.id, 'amount', v_amount, 'commission', v_commission));

  RETURN jsonb_build_object('recorded', true, 'referral_use_id', v_use_id, 'commission', v_commission);
END;
$$;
REVOKE ALL ON FUNCTION public.record_referral_conversion(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_referral_conversion(uuid, uuid, numeric, text) TO service_role;

-- -----------------------------------------------------------------------------
-- 7. KPIs
-- -----------------------------------------------------------------------------
-- Dashboard do afiliado. Sem argumento: o proprio chamador. Com argumento:
-- somente admin/master (para inspecionar um afiliado pelo painel).
-- Nunca expoe a identidade dos indicados.
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
    SELECT ru.*, (p.tier = 'plus') AS still_active
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
           COALESCE(p.tier = 'plus', false) AS is_active_subscriber
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

-- Visao geral do programa para o painel (admin e master; e-mail so para o master).
CREATE OR REPLACE FUNCTION public.admin_affiliate_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_level text := public._access_level(auth.uid());
  v_is_master boolean;
  v_affiliates jsonb;
  v_totals jsonb;
BEGIN
  IF v_level NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  v_is_master := v_level = 'master';

  WITH paid AS (
    SELECT referral_code_id, sum(amount) AS paid FROM public.affiliate_payouts GROUP BY 1
  ), conv AS (
    SELECT referral_code_id,
           sum(subscription_amount) AS revenue,
           count(*) FILTER (WHERE created_at > now() - interval '30 days') AS conv_30d,
           sum(commission_earned) FILTER (WHERE created_at > now() - interval '30 days') AS commission_30d,
           max(created_at) AS last_conversion_at
    FROM public.referral_uses GROUP BY 1
  ), vis AS (
    SELECT referral_code_id, sum(visits) FILTER (WHERE visit_date > current_date - 30) AS visits_30d
    FROM public.referral_link_visits GROUP BY 1
  ), aff AS (
    SELECT rc.id, rc.user_id, rc.code, rc.is_active, rc.revoked_at, rc.revoked_reason,
           rc.commission_percent, rc.discount_percent, rc.total_uses, rc.total_earnings,
           rc.created_at, rc.source, rc.notes,
           CASE WHEN p.display_name IS NULL OR position('@' in p.display_name) > 0
                THEN NULL ELSE p.display_name END AS display_name,
           CASE WHEN v_is_master THEN u.email ELSE NULL END AS email,
           COALESCE(pd.paid, 0) AS paid_out,
           GREATEST(rc.total_earnings - COALESCE(pd.paid, 0), 0) AS balance_due,
           COALESCE(c.revenue, 0) AS gross_revenue,
           COALESCE(c.conv_30d, 0) AS conversions_30d,
           COALESCE(c.commission_30d, 0) AS commission_30d,
           c.last_conversion_at,
           COALESCE(v.visits_30d, 0) AS visits_30d,
           CASE WHEN rc.revoked_at IS NOT NULL THEN 'removed'
                WHEN NOT rc.is_active THEN 'paused' ELSE 'active' END AS status
    FROM public.referral_codes rc
    LEFT JOIN public.profiles p ON p.user_id = rc.user_id
    LEFT JOIN auth.users u ON u.id = rc.user_id
    LEFT JOIN paid pd ON pd.referral_code_id = rc.id
    LEFT JOIN conv c ON c.referral_code_id = rc.id
    LEFT JOIN vis v ON v.referral_code_id = rc.id
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(r) ORDER BY (r.status = 'removed'), r.total_earnings DESC, r.created_at DESC), '[]'::jsonb),
    jsonb_build_object(
      'affiliates_active', count(*) FILTER (WHERE r.status = 'active'),
      'affiliates_paused', count(*) FILTER (WHERE r.status = 'paused'),
      'affiliates_removed', count(*) FILTER (WHERE r.status = 'removed'),
      'conversions_total', COALESCE(sum(r.total_uses), 0),
      'conversions_30d', COALESCE(sum(r.conversions_30d), 0),
      'gross_revenue', COALESCE(sum(r.gross_revenue), 0),
      'commission_total', COALESCE(sum(r.total_earnings), 0),
      'commission_30d', COALESCE(sum(r.commission_30d), 0),
      'paid_out', COALESCE(sum(r.paid_out), 0),
      'balance_due', COALESCE(sum(r.balance_due), 0),
      'visits_30d', COALESCE(sum(r.visits_30d), 0)
    )
  INTO v_affiliates, v_totals
  FROM aff r;

  RETURN jsonb_build_object(
    'can_manage', v_is_master,
    'self_enrollment', public.affiliate_self_enrollment_enabled(),
    'totals', v_totals,
    'affiliates', v_affiliates
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_affiliate_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_affiliate_overview() TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Lista de usuarios para o painel (staff). E-mail: somente o master (LGPD).
-- -----------------------------------------------------------------------------
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
  IF p_filter NOT IN ('all', 'staff', 'affiliates', 'banned', 'plus') THEN
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
           p.tier AS utier, p.total_quizzes AS tq, p.total_correct AS tc, p.total_questions AS tqs,
           p.streak_days AS sd, p.created_at AS cat, u.last_sign_in_at AS lsi,
           public._access_level(p.user_id) AS lvl,
           b.ban_type AS btype, b.expires_at AS bexp, b.reason AS breason, (b.id IS NOT NULL) AS banned,
           CASE WHEN rc.id IS NULL THEN NULL
                WHEN rc.revoked_at IS NOT NULL THEN 'removed'
                WHEN NOT rc.is_active THEN 'paused' ELSE 'active' END AS aff,
           rc.code AS acode
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT ub.id, ub.ban_type, ub.expires_at, ub.reason FROM public.user_bans ub
      WHERE ub.user_id = p.user_id AND ub.is_active AND (ub.expires_at IS NULL OR ub.expires_at > now())
      ORDER BY ub.banned_at DESC LIMIT 1
    ) b ON true
    LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
    WHERE (v_pattern IS NULL
           OR p.display_name ILIKE v_pattern
           OR (v_is_master AND u.email ILIKE v_pattern)
           OR rc.code ILIKE v_pattern)
  )
  SELECT b.uid, b.dname,
         CASE WHEN v_is_master THEN b.uemail ELSE NULL END,
         b.utier, b.tq, b.tc, b.tqs, b.sd, b.cat, b.lsi, b.lvl,
         b.banned, b.btype, b.bexp, b.breason, b.aff, b.acode,
         public._can_moderate(v_uid, b.uid),
         count(*) OVER ()
  FROM base b
  WHERE CASE p_filter
          WHEN 'staff' THEN b.lvl <> 'user'
          WHEN 'affiliates' THEN b.aff IS NOT NULL
          WHEN 'banned' THEN b.banned
          WHEN 'plus' THEN b.utier = 'plus'
          ELSE true
        END
  ORDER BY (b.lvl = 'master') DESC, b.cat DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated;

-- Indices de apoio
CREATE INDEX IF NOT EXISTS idx_user_bans_user_active ON public.user_bans(user_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- -----------------------------------------------------------------------------
-- 9. Auditoria para o painel. Admins nao leem a tabela diretamente: e-mails e IPs
--    da equipe aparecem somente para o master (LGPD); o alvo e resolvido por nome.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(p_search text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid,
  event_type text,
  created_at timestamptz,
  success boolean,
  error_message text,
  metadata jsonb,
  actor_name text,
  actor_email text,
  ip_address text,
  target_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_master boolean;
  v_pattern text;
BEGIN
  IF public._access_level(auth.uid()) NOT IN ('master', 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  v_is_master := public._is_master(auth.uid());
  IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
    v_pattern := '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  RETURN QUERY
  SELECT a.id, a.event_type, a.created_at, a.success, a.error_message, a.metadata,
         CASE WHEN pa.display_name IS NULL OR position('@' in pa.display_name) > 0
              THEN NULL ELSE pa.display_name END,
         CASE WHEN v_is_master THEN a.user_email ELSE NULL END,
         CASE WHEN v_is_master THEN a.ip_address ELSE NULL END,
         COALESCE(NULLIF(a.metadata->>'target_name', ''),
                  CASE WHEN pt.display_name IS NULL OR position('@' in pt.display_name) > 0
                       THEN NULL ELSE pt.display_name END)
  FROM public.audit_logs a
  LEFT JOIN public.profiles pa ON pa.user_id = a.user_id
  LEFT JOIN public.profiles pt
         ON pt.user_id = CASE WHEN (a.metadata->>'target_user_id') ~* '^[0-9a-f-]{36}$'
                              THEN (a.metadata->>'target_user_id')::uuid END
  WHERE v_pattern IS NULL
     OR a.event_type ILIKE v_pattern
     OR pa.display_name ILIKE v_pattern
     OR pt.display_name ILIKE v_pattern
     OR (v_is_master AND a.user_email ILIKE v_pattern)
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_audit_logs(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(text, integer) TO authenticated;
