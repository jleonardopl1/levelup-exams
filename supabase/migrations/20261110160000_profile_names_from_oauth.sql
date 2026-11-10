-- =============================================================================
-- Nome e foto do perfil a partir do provedor de login (Google, Azure, GitHub...)
--
-- Problema: handle_new_user so lia raw_user_meta_data->>'display_name' (cadastro por
-- e-mail). Provedores OAuth enviam o nome em 'full_name' / 'name' e a foto em
-- 'avatar_url' / 'picture', entao toda conta criada pelo Google ficava sem nome e o
-- app exibia "Estudante" / "Usuário".
-- =============================================================================

-- Nome seguro a partir dos metadados do provedor: nunca um e-mail, no maximo 60 caracteres.
CREATE OR REPLACE FUNCTION public._display_name_from_meta(p_meta jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_candidate text;
BEGIN
  FOREACH v_candidate IN ARRAY ARRAY[
    p_meta ->> 'display_name',
    p_meta ->> 'full_name',
    p_meta ->> 'name',
    NULLIF(btrim(concat_ws(' ', p_meta ->> 'given_name', p_meta ->> 'family_name')), ''),
    p_meta ->> 'user_name',
    p_meta ->> 'preferred_username'
  ] LOOP
    v_candidate := NULLIF(btrim(regexp_replace(COALESCE(v_candidate, ''), '[[:cntrl:]]', '', 'g')), '');
    IF v_candidate IS NOT NULL AND position('@' in v_candidate) = 0 THEN
      RETURN left(v_candidate, 60);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Foto do provedor (somente https, mesma regra da constraint profiles_avatar_https).
CREATE OR REPLACE FUNCTION public._avatar_from_meta(p_meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT v FROM (VALUES (p_meta ->> 'avatar_url'), (p_meta ->> 'picture')) AS t(v)
  WHERE v ~ '^https://' AND char_length(v) <= 1000
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public._display_name_from_meta(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._avatar_from_meta(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    new.id,
    public._display_name_from_meta(COALESCE(new.raw_user_meta_data, '{}'::jsonb)),
    public._avatar_from_meta(COALESCE(new.raw_user_meta_data, '{}'::jsonb))
  );
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Backfill: contas existentes sem nome/foto recebem os dados do provedor de login.
-- Nunca sobrescreve um nome ou foto que o usuario ja tenha definido.
--
-- As constraints de profiles foram criadas como NOT VALID (20261110120000), entao
-- linhas antigas podem viola-las (ex.: nome com mais de 60 caracteres). Um UPDATE
-- revalida a linha inteira e abortaria a migration; essas linhas sao ignoradas.
UPDATE public.profiles p
SET display_name = COALESCE(p.display_name, b.meta_name),
    avatar_url   = COALESCE(p.avatar_url, b.meta_avatar),
    updated_at   = now()
FROM (
  SELECT u.id AS user_id,
         public._display_name_from_meta(COALESCE(u.raw_user_meta_data, '{}'::jsonb)) AS meta_name,
         public._avatar_from_meta(COALESCE(u.raw_user_meta_data, '{}'::jsonb)) AS meta_avatar
  FROM auth.users u
) b
WHERE b.user_id = p.user_id
  AND ((p.display_name IS NULL AND b.meta_name IS NOT NULL)
       OR (p.avatar_url IS NULL AND b.meta_avatar IS NOT NULL))
  -- linha ja compativel com todas as constraints (exceto as colunas preenchidas aqui)
  AND (p.display_name IS NULL OR char_length(p.display_name) <= 60)
  AND (p.avatar_url IS NULL OR p.avatar_url ~ '^https://')
  AND p.tier IN ('free', 'plus')
  AND p.total_quizzes >= 0 AND p.total_correct >= 0 AND p.total_questions >= 0 AND p.streak_days >= 0
  AND p.total_correct <= p.total_questions;
