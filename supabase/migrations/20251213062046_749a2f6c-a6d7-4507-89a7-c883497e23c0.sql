-- Drop the security definer view
DROP VIEW IF EXISTS public.referral_code_validation;

-- Create a security definer function to validate referral codes safely
CREATE OR REPLACE FUNCTION public.validate_referral_code(code_to_validate TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  discount_percent INTEGER,
  is_valid BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    rc.id,
    rc.code,
    rc.discount_percent,
    true as is_valid
  FROM public.referral_codes rc
  WHERE rc.code = UPPER(code_to_validate)
    AND rc.is_active = true
  LIMIT 1;
$$;

-- Update the referral_codes policy to be more restrictive
DROP POLICY IF EXISTS "Anyone can validate referral codes by code value only" ON public.referral_codes;

-- Only allow users to see their own referral codes (no public access)
-- The validate_referral_code function handles public validation securely