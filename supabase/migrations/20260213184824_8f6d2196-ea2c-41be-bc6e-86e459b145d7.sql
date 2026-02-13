
-- Drop the existing restrictive SELECT policy on questions
DROP POLICY IF EXISTS "Allow SELECT on questions for authenticated via view" ON public.questions;

-- Create a permissive SELECT policy instead
CREATE POLICY "Allow SELECT on questions for authenticated"
ON public.questions
FOR SELECT
TO authenticated
USING (true);
