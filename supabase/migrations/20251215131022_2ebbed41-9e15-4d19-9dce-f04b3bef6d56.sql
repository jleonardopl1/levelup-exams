-- Ensure RLS is enabled on audit_logs (idempotent)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Ensure RLS is enabled on rate_limits (idempotent)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Add explicit deny policy for audit_logs - no user can read/write
-- Only service role bypasses RLS
CREATE POLICY "Service role only - audit_logs"
ON public.audit_logs
FOR ALL
USING (false)
WITH CHECK (false);

-- Add explicit deny policy for rate_limits - no user can read/write
-- Only service role bypasses RLS
CREATE POLICY "Service role only - rate_limits"
ON public.rate_limits
FOR ALL
USING (false)
WITH CHECK (false);