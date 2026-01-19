-- Drop the old view and recreate with security_invoker
DROP VIEW IF EXISTS public.questions_public;

-- Create a public view with security_invoker=on (uses querying user's permissions)
CREATE VIEW public.questions_public
WITH (security_invoker=on) AS
SELECT 
  id,
  enunciado,
  alternativas,
  categoria,
  dificuldade,
  explicacao,
  created_at,
  subject_id
FROM public.questions;

-- Grant access to the view
GRANT SELECT ON public.questions_public TO anon, authenticated;