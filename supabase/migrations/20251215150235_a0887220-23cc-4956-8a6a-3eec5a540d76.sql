-- Explicitly revoke all permissions on audit_logs for anon and authenticated roles
-- This provides defense-in-depth alongside the RLS policy
REVOKE ALL ON public.audit_logs FROM anon, authenticated;

-- Grant only to service role (service role bypasses RLS anyway, but this is explicit)
GRANT ALL ON public.audit_logs TO service_role;

-- Also secure the rate_limits table with the same approach
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;