
-- Drop the restrictive policy that blocks everything
DROP POLICY IF EXISTS "Service role only - audit_logs" ON public.audit_logs;

-- The new permissive policies for admin SELECT and INSERT already exist from previous migration
-- Now non-admin users still can't access because they won't match the USING clause
