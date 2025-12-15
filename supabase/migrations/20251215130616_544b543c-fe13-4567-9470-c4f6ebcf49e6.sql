-- Add UPDATE policy for referral_codes table
CREATE POLICY "Users can update their own referral code"
ON public.referral_codes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for user_redemptions table
CREATE POLICY "Users can update their own redemptions"
ON public.user_redemptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);