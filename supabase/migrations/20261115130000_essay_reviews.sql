-- =============================================================================
-- Correção da discursiva (Plus) — docs/PROPOSTA_PLUS.md, proposta 3
--
-- A Edge Function essay-review reserva a correção aqui (cota semanal atômica),
-- chama o modelo e grava a nota/rubrica na mesma linha. O cliente só lê as próprias.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.essay_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.study_track_modules(id) ON DELETE CASCADE,
  cargo text NOT NULL CHECK (char_length(cargo) <= 120),
  tema text NOT NULL CHECK (char_length(tema) BETWEEN 10 AND 1500),
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 200 AND 6000),
  line_count integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'error')),
  score numeric(5,2),            -- estimativa 0..100 (80 conteúdo + 20 formal)
  feedback jsonb,                -- rubrica completa devolvida pelo corretor
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_essay_user_created ON public.essay_submissions(user_id, created_at DESC);

ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.essay_submissions FROM anon, authenticated;
GRANT SELECT ON public.essay_submissions TO authenticated;
DROP POLICY IF EXISTS "own essays" ON public.essay_submissions;
CREATE POLICY "own essays" ON public.essay_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Correções que contam na cota: as concluídas e as em andamento (erro não conta).
CREATE OR REPLACE FUNCTION public._essay_used_7d(p_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::int FROM public.essay_submissions
  WHERE user_id = p_user_id AND status IN ('pending', 'done')
    AND created_at > now() - interval '7 days';
$$;

-- Situação da cota para a tela.
CREATE OR REPLACE FUNCTION public.get_essay_quota()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit constant integer := 3;
  v_used integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'not_authenticated'); END IF;
  v_used := public._essay_used_7d(v_uid);
  RETURN jsonb_build_object(
    'plus', public.get_user_tier(v_uid) = 'plus',
    'limit', v_limit,
    'used', v_used,
    'remaining', greatest(0, v_limit - v_used),
    'next_slot_at', CASE WHEN v_used >= v_limit THEN (
      SELECT min(created_at) + interval '7 days' FROM public.essay_submissions
      WHERE user_id = v_uid AND status IN ('pending', 'done') AND created_at > now() - interval '7 days')
    END);
END;
$$;

-- Reserva atômica (só service_role): trava por aluno, confere a cota e cria a linha
-- 'pending'. Devolve o id ou NULL se a cota acabou.
CREATE OR REPLACE FUNCTION public.begin_essay_submission(
  p_user_id uuid, p_module_id uuid, p_cargo text, p_tema text, p_texto text,
  p_line_count integer, p_limit integer DEFAULT 3)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('essay:' || p_user_id::text));
  IF public._essay_used_7d(p_user_id) >= p_limit THEN RETURN NULL; END IF;
  INSERT INTO public.essay_submissions (user_id, module_id, cargo, tema, texto, line_count)
  VALUES (p_user_id, p_module_id, p_cargo, p_tema, p_texto, p_line_count)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._essay_used_7d(uuid), public.get_essay_quota(),
  public.begin_essay_submission(uuid, uuid, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_essay_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.begin_essay_submission(uuid, uuid, text, text, text, integer, integer) TO service_role;
