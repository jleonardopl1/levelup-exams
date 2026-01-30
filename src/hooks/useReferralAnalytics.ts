import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReferralAnalytics {
  code: string;
  discountPercent: number;
  commissionPercent: number;
  totalUses: number;
  totalEarnings: number;
  isActive: boolean;
  recentReferrals: {
    id: string;
    createdAt: string;
    commissionEarned: number | null;
    subscriptionAmount: number | null;
  }[];
}

export function useReferralAnalytics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['referral-analytics', user?.id],
    queryFn: async (): Promise<ReferralAnalytics | null> => {
      if (!user) return null;

      // Fetch referral code
      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (codeError) throw codeError;
      if (!codeData) return null;

      // Fetch referral uses (owner can see full data)
      const { data: usesData, error: usesError } = await supabase
        .from('referral_uses')
        .select('*')
        .eq('referral_code_id', codeData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (usesError) throw usesError;

      return {
        code: codeData.code,
        discountPercent: codeData.discount_percent,
        commissionPercent: Number(codeData.commission_percent),
        totalUses: codeData.total_uses,
        totalEarnings: Number(codeData.total_earnings),
        isActive: codeData.is_active,
        recentReferrals: (usesData || []).map(use => ({
          id: use.id,
          createdAt: use.created_at,
          commissionEarned: use.commission_earned ? Number(use.commission_earned) : null,
          subscriptionAmount: use.subscription_amount ? Number(use.subscription_amount) : null,
        })),
      };
    },
    enabled: !!user,
  });
}

export function useHasReferralCode() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['has-referral-code', user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { count, error } = await supabase
        .from('referral_codes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!user,
  });
}
