
-- Drop ALL existing policies on questions table and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Allow SELECT on questions for authenticated" ON public.questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Allow SELECT on questions for authenticated via view" ON public.questions;

-- Recreate as explicitly PERMISSIVE
CREATE POLICY "Authenticated can view questions"
ON public.questions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert questions"
ON public.questions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update questions"
ON public.questions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
