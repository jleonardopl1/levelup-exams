
-- Allow admins to read audit_logs (currently blocked by restrictive policy)
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin-metrics edge function to insert audit logs (service role already can, but let's add a permissive insert for admin actions via edge function)
CREATE POLICY "Admins can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
