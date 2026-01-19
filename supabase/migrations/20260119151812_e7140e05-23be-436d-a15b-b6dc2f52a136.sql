-- Add premium flag to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Create index for faster premium question filtering
CREATE INDEX IF NOT EXISTS idx_questions_is_premium ON public.questions(is_premium);

-- Create a secure function to check user tier (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(tier, 'free') 
  FROM public.profiles 
  WHERE user_id = p_user_id
  LIMIT 1;
$$;

-- Drop and recreate the questions_public view with tier-based filtering
DROP VIEW IF EXISTS public.questions_public;

CREATE VIEW public.questions_public 
WITH (security_invoker = on)
AS
SELECT 
  q.id,
  q.enunciado,
  q.alternativas,
  q.categoria,
  q.dificuldade,
  q.explicacao,
  q.created_at,
  q.subject_id,
  q.is_premium
FROM public.questions q
WHERE 
  -- Show all non-premium questions to everyone
  q.is_premium = false
  OR 
  -- Show premium questions only to plus tier users
  (q.is_premium = true AND public.get_user_tier(auth.uid()) = 'plus');

-- Grant access to the view
GRANT SELECT ON public.questions_public TO authenticated;
GRANT SELECT ON public.questions_public TO anon;

-- Add IP tracking column to rate_limits for Edge Function rate limiting
ALTER TABLE public.rate_limits 
ADD COLUMN IF NOT EXISTS ip_address text;

-- Create index for IP-based lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint) WHERE ip_address IS NOT NULL;