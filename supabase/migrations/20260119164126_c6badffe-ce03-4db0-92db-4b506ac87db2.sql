-- Fix referral_uses RLS to hide financial details from referred users
-- The issue: "Users can view referrals they used" policy exposes commission_earned and subscription_amount

-- Drop existing policies
DROP POLICY IF EXISTS "Referral owners can view their uses" ON public.referral_uses;
DROP POLICY IF EXISTS "Users can view referrals they used" ON public.referral_uses;
DROP POLICY IF EXISTS "Users can view their own referral uses" ON public.referral_uses;

-- Create a single consolidated policy for referral code owners (who should see all financial data)
CREATE POLICY "Referral code owners can view their referral uses" 
ON public.referral_uses 
FOR SELECT 
USING (
  referral_code_id IN (
    SELECT id FROM public.referral_codes WHERE user_id = auth.uid()
  )
);

-- Create a secure view for referred users that hides financial columns
-- This allows users to see that they used a referral code without exposing commission data
CREATE OR REPLACE VIEW public.referral_uses_limited
WITH (security_invoker = on)
AS
SELECT 
  ru.id,
  ru.referral_code_id,
  ru.referred_user_id,
  ru.created_at
  -- commission_earned and subscription_amount are intentionally excluded
FROM public.referral_uses ru
WHERE ru.referred_user_id = auth.uid();

-- Grant access to the limited view
GRANT SELECT ON public.referral_uses_limited TO authenticated;

-- Add comment explaining the security design
COMMENT ON VIEW public.referral_uses_limited IS 'Limited view of referral uses for referred users. Excludes financial data (commission_earned, subscription_amount) which is only visible to referral code owners via direct table access.';

COMMENT ON TABLE public.referral_uses IS 'Full referral uses table. Financial columns (commission_earned, subscription_amount) are only visible to referral code owners via RLS. Referred users should use the referral_uses_limited view instead.';