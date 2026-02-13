
-- 1. Admin can view ALL profiles (for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Admin can update any profile (for banning)
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Admin can view ALL quiz_results (for metrics)
CREATE POLICY "Admins can view all quiz results"
ON public.quiz_results FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. User bans table
CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  banned_by uuid NOT NULL,
  ban_type text NOT NULL DEFAULT 'temporary',
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bans"
ON public.user_bans FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Grant permissions
GRANT SELECT ON public.user_bans TO authenticated;
GRANT INSERT ON public.user_bans TO authenticated;
GRANT UPDATE ON public.user_bans TO authenticated;
GRANT DELETE ON public.user_bans TO authenticated;

-- 6. Admin can manage all user_roles (grant missing perms)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT INSERT ON public.user_roles TO authenticated;
GRANT UPDATE ON public.user_roles TO authenticated;
GRANT DELETE ON public.user_roles TO authenticated;

-- 7. Admin can view all referral_codes (already has policy, ensure grants)
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT UPDATE ON public.referral_codes TO authenticated;
