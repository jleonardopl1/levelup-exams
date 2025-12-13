import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserRewards {
  id: string;
  user_id: string;
  total_points: number;
  current_level: number;
  consecutive_correct: number;
  max_consecutive_correct: number;
  total_time_seconds: number;
  last_session_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  points_reward: number;
  tier: string;
  requirement_type: string;
  requirement_value: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  achievement?: Achievement;
}

export interface RewardCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  points_cost: number;
  reward_type: string;
  reward_value: Record<string, unknown>;
  available_for_tier: string;
  is_active: boolean;
  max_redemptions: number | null;
}

export interface UserRedemption {
  id: string;
  user_id: string;
  reward_id: string;
  points_spent: number;
  redeemed_at: string;
  status: string;
  expires_at: string | null;
  reward?: RewardCatalogItem;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  discount_percent: number;
  commission_percent: number;
  is_active: boolean;
  total_uses: number;
  total_earnings: number;
  created_at: string;
}

// Get or create user rewards
export function useUserRewards() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-rewards', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Try to get existing rewards
      let { data, error } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // If no rewards exist, create them
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from('user_rewards')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newData;
      }

      return data as UserRewards;
    },
    enabled: !!user,
  });
}

// Update user rewards (add points, update stats)
export function useUpdateRewards() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<UserRewards>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_rewards')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rewards'] });
    },
  });
}

// Get all achievements
export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('tier', { ascending: true })
        .order('requirement_value', { ascending: true });

      if (error) throw error;
      return data as Achievement[];
    },
  });
}

// Get user's unlocked achievements
export function useUserAchievements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-achievements', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements(*)
        `)
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;
      return data as UserAchievement[];
    },
    enabled: !!user,
  });
}

// Unlock achievement
export function useUnlockAchievement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (achievementId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_achievements')
        .insert({ user_id: user.id, achievement_id: achievementId })
        .select(`
          *,
          achievement:achievements(*)
        `)
        .single();

      if (error) {
        // Ignore duplicate key errors (already unlocked)
        if (error.code === '23505') return null;
        throw error;
      }
      return data as UserAchievement;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-achievements'] });
      queryClient.invalidateQueries({ queryKey: ['user-rewards'] });
      if (data?.achievement) {
        toast.success(`🏆 Conquista desbloqueada: ${data.achievement.name}!`, {
          description: `+${data.achievement.points_reward} pontos`,
        });
      }
    },
  });
}

// Get reward catalog
export function useRewardCatalog() {
  return useQuery({
    queryKey: ['reward-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward_catalog')
        .select('*')
        .eq('is_active', true)
        .order('points_cost', { ascending: true });

      if (error) throw error;
      return data as RewardCatalogItem[];
    },
  });
}

// Get user redemptions
export function useUserRedemptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-redemptions', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_redemptions')
        .select(`
          *,
          reward:reward_catalog(*)
        `)
        .eq('user_id', user.id)
        .order('redeemed_at', { ascending: false });

      if (error) throw error;
      return data as UserRedemption[];
    },
    enabled: !!user,
  });
}

// Redeem a reward
export function useRedeemReward() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ rewardId, pointsCost }: { rewardId: string; pointsCost: number }) => {
      if (!user) throw new Error('Not authenticated');

      // First, check if user has enough points
      const { data: rewards, error: rewardsError } = await supabase
        .from('user_rewards')
        .select('total_points')
        .eq('user_id', user.id)
        .single();

      if (rewardsError) throw rewardsError;
      if (!rewards || rewards.total_points < pointsCost) {
        throw new Error('Pontos insuficientes');
      }

      // Create redemption
      const { data: redemption, error: redemptionError } = await supabase
        .from('user_redemptions')
        .insert({
          user_id: user.id,
          reward_id: rewardId,
          points_spent: pointsCost,
        })
        .select()
        .single();

      if (redemptionError) throw redemptionError;

      // Deduct points
      const { error: updateError } = await supabase
        .from('user_rewards')
        .update({ total_points: rewards.total_points - pointsCost })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      return redemption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['user-redemptions'] });
      toast.success('🎁 Recompensa resgatada com sucesso!');
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao resgatar recompensa');
    },
  });
}

// Get user's referral code
export function useReferralCode() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as ReferralCode | null;
    },
    enabled: !!user,
  });
}

// Create referral code (for Top Players)
export function useCreateReferralCode() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('referral_codes')
        .insert({
          user_id: user.id,
          code: code.toUpperCase(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as ReferralCode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-code'] });
      toast.success('🌟 Código de indicação criado!');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Este código já está em uso');
      } else {
        toast.error('Erro ao criar código');
      }
    },
  });
}

// Calculate level from points
export function calculateLevel(points: number): number {
  // Level thresholds: 0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500...
  let level = 1;
  let threshold = 0;
  let increment = 100;
  
  while (points >= threshold + increment) {
    threshold += increment;
    level++;
    increment += 100;
  }
  
  return level;
}

// Get points needed for next level
export function getPointsForNextLevel(currentLevel: number): number {
  let threshold = 0;
  let increment = 100;
  
  for (let i = 1; i < currentLevel; i++) {
    threshold += increment;
    increment += 100;
  }
  
  return threshold + increment;
}

// Get tier badge color
export function getTierColor(tier: string): string {
  switch (tier) {
    case 'bronze': return 'from-amber-600 to-amber-700';
    case 'silver': return 'from-slate-300 to-slate-400';
    case 'gold': return 'from-yellow-400 to-amber-500';
    case 'platinum': return 'from-cyan-300 to-blue-400';
    default: return 'from-gray-400 to-gray-500';
  }
}
