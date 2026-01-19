-- Fix rate_limits table - allow service role and the validate_answer function to work
DROP POLICY IF EXISTS "Block direct access to rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "rate_limits_policy" ON public.rate_limits;

-- Rate limits should only be accessed by service role (SECURITY DEFINER functions)
-- No client-side access needed, as the validate_answer function handles it

-- Fix referral_uses table - users can only see their own referral uses
-- First, enable RLS if not already enabled
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

-- Users can see referral uses where they are the referral code owner
CREATE POLICY "Users can view their own referral uses" 
ON public.referral_uses 
FOR SELECT 
TO authenticated
USING (
  referral_code_id IN (
    SELECT id FROM public.referral_codes WHERE user_id = auth.uid()
  )
);

-- Users can see referral uses where they are the referred user
CREATE POLICY "Users can view referrals they used" 
ON public.referral_uses 
FOR SELECT 
TO authenticated
USING (referred_user_id = auth.uid());

-- Only system can insert referral uses (via service role)
-- No INSERT policy for authenticated users

-- Fix audit_logs - keep blocking direct access but document why
-- The audit_logs table is accessed via SECURITY DEFINER functions only
-- The "false" policy is intentional to prevent any direct client access