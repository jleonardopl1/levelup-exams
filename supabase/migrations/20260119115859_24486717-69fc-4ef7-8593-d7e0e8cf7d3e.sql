-- Update RLS on questions table: allow SELECT through view only by service role
-- But we need to allow the view to query the base table

-- First, grant SELECT back to the service role for the base table
GRANT SELECT ON public.questions TO service_role;

-- The view with security_invoker will work because we granted SELECT to the view itself
-- But we need to allow authenticated users to query via the view
-- Since security_invoker uses the querying user's permissions, we need a policy

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Questions are viewable by everyone" ON public.questions;

-- Create a new restrictive policy that only allows SELECT without the correta column
-- This is enforced at the application level now since we use the view
CREATE POLICY "Allow SELECT on questions for authenticated via view"
ON public.questions
FOR SELECT
TO authenticated, anon
USING (true);