-- =============================================================================
-- SECURITY HARDENING (auditoria 2026-11-10)
-- Ver docs/SECURITY_AUDIT.md para a descricao de cada achado (IDs entre colchetes).
--
-- Principios aplicados:
--   * Nada que tenha valor economico (tier, pontos, resgates, comissoes) pode ser
--     escrito livremente pelo cliente.
--   * Toda funcao SECURITY DEFINER: search_path fixo, valida auth.uid(), e
--     EXECUTE revogado de PUBLIC/anon (Postgres concede EXECUTE a PUBLIC por padrao).
--   * Dados pessoais (e-mail, UUIDs) nao sao expostos em endpoints publicos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [C1] Gabarito exposto: qualquer usuario autenticado lia questions.correta e
--      questoes premium diretamente da tabela base.
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.questions FROM anon, authenticated;

-- Somente colunas nao sensiveis. `correta` e `explicacao` (que revela a resposta)
-- so saem pela RPC validate_answer, depois que o usuario responde.
GRANT SELECT (id, enunciado, alternativas, categoria, dificuldade, created_at, subject_id, is_premium)
  ON public.questions TO anon, authenticated;
-- anon nao tem policy de SELECT => recebe 0 linhas (comportamento anterior), sem erro.
-- Admin alterna is_premium pelo painel; INSERT de questoes fica com service_role.
GRANT UPDATE (is_premium) ON public.questions TO authenticated;

DROP POLICY IF EXISTS "Authenticated can view questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;

-- [C1] Paywall aplicado no banco (RLS), nao apenas na view.
CREATE POLICY "Questions readable by tier"
  ON public.questions FOR SELECT TO authenticated
  USING (
    is_premium = false
    OR (SELECT public.get_user_tier(auth.uid())) = 'plus'
    OR (SELECT public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can update questions"
  ON public.questions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP VIEW IF EXISTS public.questions_public;
CREATE VIEW public.questions_public
WITH (security_invoker = on, security_barrier = true) AS
SELECT q.id, q.enunciado, q.alternativas, q.categoria, q.dificuldade,
       q.created_at, q.subject_id, q.is_premium
FROM public.questions q;
-- O filtro premium agora e feito pela RLS da tabela base (security_invoker).

REVOKE ALL ON public.questions_public FROM anon, authenticated;
GRANT SELECT ON public.questions_public TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- [H5] has_role / get_user_tier: qualquer um (inclusive anon) podia consultar o
--      papel ou o plano de QUALQUER usuario (enumeracao de admins / privacidade).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      -- Clientes so podem perguntar sobre si mesmos; service_role (auth.uid() nulo
      -- e papel service_role) pode perguntar sobre qualquer um.
      AND (_user_id = auth.uid() OR auth.role() = 'service_role')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier FROM public.profiles
      WHERE user_id = p_user_id
        AND (p_user_id = auth.uid() OR auth.role() = 'service_role')
      LIMIT 1),
    'free')
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tier(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- [C1] validate_answer: liberava gabarito de questoes premium para usuarios free
--      e era executavel por anon (bucket de rate-limit compartilhado "anonymous").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_answer(p_question_id uuid, p_selected_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_correct integer;
  v_explicacao text;
  v_premium boolean;
  v_count integer;
  v_rate_limit constant integer := 60;
  v_window constant interval := interval '1 minute';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_selected_index IS NULL OR p_selected_index < 0 OR p_selected_index > 10 THEN
    RETURN jsonb_build_object('error', 'Invalid answer');
  END IF;

  -- Rate limit atomico por usuario
  INSERT INTO public.rate_limits AS rl (identifier, endpoint, request_count, window_start)
  VALUES (v_user_id::text, 'validate_answer', 1, now())
  ON CONFLICT (identifier, endpoint) DO UPDATE SET
    request_count = CASE WHEN rl.window_start > now() - v_window THEN rl.request_count + 1 ELSE 1 END,
    window_start  = CASE WHEN rl.window_start > now() - v_window THEN rl.window_start ELSE now() END,
    updated_at = now()
  RETURNING request_count INTO v_count;

  IF v_count > v_rate_limit THEN
    RETURN jsonb_build_object('error', 'Rate limit exceeded. Please wait before trying again.');
  END IF;

  SELECT correta, explicacao, is_premium INTO v_correct, v_explicacao, v_premium
  FROM public.questions WHERE id = p_question_id;

  IF v_correct IS NULL THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  IF v_premium AND public.get_user_tier(v_user_id) <> 'plus'
     AND NOT public.has_role(v_user_id, 'admin') THEN
    RETURN jsonb_build_object('error', 'Question not found');
  END IF;

  RETURN jsonb_build_object(
    'is_correct', p_selected_index = v_correct,
    'correct_index', v_correct,
    'explicacao', v_explicacao
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_answer(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_answer(uuid, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- [C2] Auto-upgrade para Plus: a policy "Users can update their own profile" nao
--      restringia colunas, entao o usuario podia fazer UPDATE profiles SET tier='plus'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Somente service_role / funcoes SECURITY DEFINER (current_user = owner) alteram tier.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.tier := 'free';
    ELSE
      NEW.tier := OLD.tier;
      NEW.user_id := OLD.user_id;
      NEW.id := OLD.id;
      NEW.created_at := OLD.created_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tier_valid CHECK (tier IN ('free', 'plus')) NOT VALID,
  ADD CONSTRAINT profiles_stats_non_negative CHECK (
    total_quizzes >= 0 AND total_correct >= 0 AND total_questions >= 0 AND streak_days >= 0
    AND total_correct <= total_questions
  ) NOT VALID,
  ADD CONSTRAINT profiles_display_name_len CHECK (display_name IS NULL OR char_length(display_name) <= 60) NOT VALID,
  ADD CONSTRAINT profiles_avatar_https CHECK (avatar_url IS NULL OR avatar_url ~ '^https://') NOT VALID;

-- -----------------------------------------------------------------------------
-- [H2] Vazamento de e-mail (LGPD): o display_name padrao era o e-mail do usuario,
--      exposto publicamente no ranking.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := NULLIF(btrim(new.raw_user_meta_data ->> 'display_name'), '');
BEGIN
  IF v_name IS NOT NULL AND (position('@' in v_name) > 0 OR char_length(v_name) > 60) THEN
    v_name := NULL;
  END IF;
  INSERT INTO public.profiles (user_id, display_name) VALUES (new.id, v_name);
  RETURN new;
END;
$$;

UPDATE public.profiles SET display_name = NULL WHERE display_name LIKE '%@%';

-- -----------------------------------------------------------------------------
-- [H1] get_leaderboard: expunha user_id de todos os jogadores (insumo para os
--      ataques via RPC abaixo), aceitava limit_count ilimitado (DoS) e era anon.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_leaderboard(text, int);
CREATE FUNCTION public.get_leaderboard(period text DEFAULT 'all', limit_count int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  display_name text,
  score int,
  correct_answers int,
  total_questions int,
  is_current_user boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
  v_limit int := LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
BEGIN
  v_since := CASE period
    WHEN 'today' THEN date_trunc('day', now())
    WHEN 'week'  THEN now() - interval '7 days'
    WHEN 'month' THEN now() - interval '30 days'
    ELSE '-infinity'::timestamptz
  END;

  RETURN QUERY
  SELECT qr.id,
         CASE WHEN p.display_name IS NULL OR position('@' in p.display_name) > 0
              THEN 'Anônimo' ELSE p.display_name END,
         qr.score, qr.correct_answers, qr.total_questions,
         (auth.uid() IS NOT NULL AND qr.user_id = auth.uid()),
         qr.created_at
  FROM public.quiz_results qr
  LEFT JOIN public.profiles p ON p.user_id = qr.user_id
  WHERE qr.created_at >= v_since
  ORDER BY qr.score DESC, qr.created_at ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, int) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- [C3] RPCs SECURITY DEFINER sem checagem de identidade, sem search_path e com
--      EXECUTE para PUBLIC: qualquer pessoa (ate anon) podia
--        * increment_user_points(<qualquer usuario>, 999999)
--        * redeem_reward(<vitima>, <premio>, -100000)   -> pontos infinitos / premio gratis
--        * increment_daily_usage(<vitima>, hoje, 9999)  -> bloquear vitima
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.increment_user_points(uuid, integer);

CREATE OR REPLACE FUNCTION public.redeem_reward(p_user_id uuid, p_reward_id uuid, p_points_cost integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_reward public.reward_catalog%ROWTYPE;
  v_points integer;
  v_already integer;
  v_redemption_id uuid;
BEGIN
  -- p_user_id / p_points_cost mantidos apenas por compatibilidade de assinatura;
  -- identidade e custo sao SEMPRE derivados do servidor.
  IF v_uid IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  SELECT * INTO v_reward FROM public.reward_catalog WHERE id = p_reward_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recompensa indisponível');
  END IF;

  IF v_reward.points_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recompensa inválida');
  END IF;

  IF v_reward.available_for_tier = 'plus' AND public.get_user_tier(v_uid) <> 'plus' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recompensa exclusiva para assinantes Plus');
  END IF;

  SELECT total_points INTO v_points FROM public.user_rewards WHERE user_id = v_uid FOR UPDATE;
  IF v_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User rewards not found');
  END IF;

  SELECT count(*) INTO v_already FROM public.user_redemptions
  WHERE user_id = v_uid AND reward_id = v_reward.id;
  IF (v_reward.max_redemptions IS NOT NULL AND v_already >= v_reward.max_redemptions)
     OR (v_reward.reward_type = 'top_player' AND v_already > 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Limite de resgates atingido');
  END IF;

  IF v_points < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pontos insuficientes');
  END IF;

  UPDATE public.user_rewards
     SET total_points = total_points - v_reward.points_cost, updated_at = now()
   WHERE user_id = v_uid;

  INSERT INTO public.user_redemptions (user_id, reward_id, points_spent)
  VALUES (v_uid, v_reward.id, v_reward.points_cost)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object('success', true, 'redemption_id', v_redemption_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_usage(p_user_id uuid, p_date date, p_count integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new integer;
BEGIN
  IF v_uid IS NULL OR (p_user_id IS NOT NULL AND p_user_id <> v_uid) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 100 THEN
    RAISE EXCEPTION 'invalid count' USING ERRCODE = '22023';
  END IF;
  -- Data e definida pelo servidor (o cliente nao escolhe o "dia" que consome).
  INSERT INTO public.daily_question_usage (user_id, usage_date, questions_used)
  VALUES (v_uid, (now() AT TIME ZONE 'UTC')::date, p_count)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET questions_used = daily_question_usage.questions_used + EXCLUDED.questions_used,
        updated_at = now()
  RETURNING questions_used INTO v_new;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.increment_daily_usage(uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_daily_usage(uuid, date, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- [C4] Economia de pontos manipulavel pelo cliente (UPDATE direto em user_rewards,
--      INSERT/UPDATE direto em user_redemptions, usage counters, etc.).
-- -----------------------------------------------------------------------------

-- Usuario nao cria resgates nem altera resgates (somente via redeem_reward).
DROP POLICY IF EXISTS "Users can insert their own redemptions" ON public.user_redemptions;
DROP POLICY IF EXISTS "Users can update their own redemptions" ON public.user_redemptions;

-- Contadores de uso: somente via RPC / edge function (service_role).
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.daily_question_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.daily_question_usage;
DROP POLICY IF EXISTS "Users can insert their own AI mentor usage" ON public.ai_mentor_usage;
DROP POLICY IF EXISTS "Users can update their own AI mentor usage" ON public.ai_mentor_usage;

-- Pontos de conquista agora sao creditados pelo servidor, uma unica vez por
-- conquista (UNIQUE user_id+achievement_id), com o valor do catalogo.
CREATE OR REPLACE FUNCTION public.award_achievement_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
BEGIN
  SELECT points_reward INTO v_points FROM public.achievements WHERE id = NEW.achievement_id;
  IF COALESCE(v_points, 0) > 0 THEN
    INSERT INTO public.user_rewards (user_id, total_points)
    VALUES (NEW.user_id, v_points)
    ON CONFLICT (user_id) DO UPDATE
      SET total_points = user_rewards.total_points + EXCLUDED.total_points,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_achievement_points ON public.user_achievements;
CREATE TRIGGER award_achievement_points
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW EXECUTE FUNCTION public.award_achievement_points();

-- Limites para escritas diretas do cliente em user_rewards.
ALTER TABLE public.user_rewards
  ADD COLUMN IF NOT EXISTS daily_points_date date,
  ADD COLUMN IF NOT EXISTS daily_points_earned integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.level_for_points(p_points integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_threshold integer := 0;
  v_inc integer := 100;
BEGIN
  WHILE p_points >= v_threshold + v_inc LOOP
    v_threshold := v_threshold + v_inc;
    v_level := v_level + 1;
    v_inc := v_inc + 100;
  END LOOP;
  RETURN v_level;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_user_rewards()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c_max_per_write constant integer := 1000;   -- maior premio legitimo de um quiz/desafio
  c_max_per_day   constant integer := 5000;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_delta integer;
  v_earned integer;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    NEW.current_level := public.level_for_points(NEW.total_points);
    RETURN NEW;  -- service_role / SECURITY DEFINER (redeem_reward, conquistas)
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.total_points := 0;
    NEW.current_level := 1;
    NEW.daily_points_date := NULL;
    NEW.daily_points_earned := 0;
    RETURN NEW;
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.daily_points_date := OLD.daily_points_date;
  NEW.daily_points_earned := OLD.daily_points_earned;

  v_delta := NEW.total_points - OLD.total_points;
  IF v_delta <> 0 THEN
    -- Cliente nunca diminui pontos (gasto so via redeem_reward) e tem teto por escrita/dia.
    v_delta := LEAST(GREATEST(v_delta, 0), c_max_per_write);
    v_earned := CASE WHEN OLD.daily_points_date = v_today THEN OLD.daily_points_earned ELSE 0 END;
    v_delta := LEAST(v_delta, GREATEST(c_max_per_day - v_earned, 0));
    NEW.total_points := OLD.total_points + v_delta;
    NEW.daily_points_date := v_today;
    NEW.daily_points_earned := v_earned + v_delta;
  END IF;

  NEW.current_level := public.level_for_points(NEW.total_points);
  NEW.consecutive_correct := GREATEST(NEW.consecutive_correct, 0);
  NEW.max_consecutive_correct := LEAST(GREATEST(NEW.max_consecutive_correct, OLD.max_consecutive_correct), 500);
  NEW.total_time_seconds := GREATEST(NEW.total_time_seconds, OLD.total_time_seconds);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_rewards ON public.user_rewards;
CREATE TRIGGER guard_user_rewards
  BEFORE INSERT OR UPDATE ON public.user_rewards
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_rewards();

DROP POLICY IF EXISTS "Users can update their own rewards" ON public.user_rewards;
CREATE POLICY "Users can update their own rewards"
  ON public.user_rewards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Resultados de quiz: limites de sanidade (o ranking usa score).
ALTER TABLE public.quiz_results
  ADD CONSTRAINT quiz_results_sane CHECK (
    total_questions BETWEEN 1 AND 200
    AND correct_answers BETWEEN 0 AND total_questions
    AND score BETWEEN 0 AND 100
    AND (time_spent_seconds IS NULL OR time_spent_seconds >= 0)
  ) NOT VALID;

-- -----------------------------------------------------------------------------
-- [C5] Fraude no programa de indicacao: o usuario podia criar codigo sem ser Top
--      Player e definir/alterar commission_percent, discount_percent e
--      total_earnings (valor a pagar!) do proprio codigo.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can insert their own referral code" ON public.referral_codes;

CREATE POLICY "Top players can create their referral code"
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND code ~ '^[A-Z0-9]{4,20}$'
    AND discount_percent = 10
    AND commission_percent = 3.00
    AND total_uses = 0
    AND total_earnings = 0
    AND is_active = true
    -- Mesma regra de negocio da UI (Rewards.tsx), agora verificada no servidor:
    -- Plus + 10.000 pontos, ou resgate do premio "Top Player".
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

-- Admin so alterna is_active pelo painel; demais colunas financeiras: service_role.
DROP POLICY IF EXISTS "Admins can update referral codes" ON public.referral_codes;
CREATE POLICY "Admins can update referral codes"
  ON public.referral_codes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE UPDATE ON public.referral_codes FROM authenticated;
GRANT UPDATE (is_active) ON public.referral_codes TO authenticated;

-- validate_referral_code: executavel apenas por usuarios autenticados.
REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- [M4] Funcoes de manutencao executaveis por qualquer um (anon podia apagar logs
--      de auditoria antigos e zerar janelas de rate limit).
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.cleanup_rate_limits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_audit_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_audit_logs() TO service_role;

-- -----------------------------------------------------------------------------
-- [M5] audit_logs: admin podia FORJAR registros de auditoria pelo cliente.
--      Logs sao escritos apenas por service_role; admin somente le.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;  -- RLS limita a admins

-- user_bans: usuarios comuns nao enxergam a tabela; admins via RLS.
REVOKE ALL ON public.user_bans FROM anon;

-- -----------------------------------------------------------------------------
-- Helpers usados pelas Edge Functions (somente service_role).
-- -----------------------------------------------------------------------------

-- [H6] Rate limit atomico (o anterior era read-modify-write com race condition).
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text, p_endpoint text, p_window_seconds integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window interval := make_interval(secs => p_window_seconds);
BEGIN
  INSERT INTO public.rate_limits AS rl (identifier, endpoint, request_count, window_start)
  VALUES (left(p_identifier, 200), p_endpoint, 1, now())
  ON CONFLICT (identifier, endpoint) DO UPDATE SET
    request_count = CASE WHEN rl.window_start > now() - v_window THEN rl.request_count + 1 ELSE 1 END,
    window_start  = CASE WHEN rl.window_start > now() - v_window THEN rl.window_start ELSE now() END,
    updated_at = now()
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

-- [H7] Cota diaria do Mentor IA consumida atomicamente (antes: race condition).
CREATE OR REPLACE FUNCTION public.consume_ai_mentor_quota(p_user_id uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_used integer;
BEGIN
  INSERT INTO public.ai_mentor_usage (user_id, usage_date, questions_used)
  VALUES (p_user_id, v_today, 0)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  UPDATE public.ai_mentor_usage
     SET questions_used = questions_used + 1, updated_at = now()
   WHERE user_id = p_user_id AND usage_date = v_today AND questions_used < p_limit
  RETURNING questions_used INTO v_used;

  RETURN v_used IS NOT NULL;
END;
$$;

-- [C6] Lookup exato de usuario por e-mail confirmado (substitui listUsers sem filtro).
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users
  WHERE lower(email) = lower(p_email) AND email_confirmed_at IS NOT NULL
  LIMIT 1
$$;

-- [H3] Banimento efetivo: indica se o usuario tem ban ativo.
CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = p_user_id AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_mentor_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_user_banned(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_mentor_quota(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO service_role;

-- Trigger functions nao devem ser chamaveis via RPC.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_achievement_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_user_rewards() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

-- [M6] Idempotencia do webhook Stripe (replay / reentrega).
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
