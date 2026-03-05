import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from './useProfile';

export interface DailyUsage {
  id: string;
  user_id: string;
  usage_date: string;
  questions_used: number;
  created_at: string;
  updated_at: string;
}

// Free tier limits
export const FREE_DAILY_LIMIT = 30;
export const PLUS_DAILY_LIMIT = Infinity;

function getUTCDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function useDailyUsage() {
  const { user } = useAuth();
  const today = getUTCDate();

  return useQuery({
    queryKey: ['daily-usage', user?.id, today],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('daily_question_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .maybeSingle();
      
      if (error) throw error;
      return data as DailyUsage | null;
    },
    enabled: !!user,
  });
}

export function useQuestionLimits() {
  const { data: profile } = useProfile();
  const { data: usage } = useDailyUsage();
  
  const isPremium = profile?.tier === 'plus';
  const dailyLimit = isPremium ? PLUS_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const questionsUsed = usage?.questions_used || 0;
  const questionsRemaining = Math.max(0, dailyLimit - questionsUsed);
  const hasReachedLimit = !isPremium && questionsUsed >= FREE_DAILY_LIMIT;

  return {
    isPremium,
    dailyLimit,
    questionsUsed,
    questionsRemaining,
    hasReachedLimit,
    tier: profile?.tier || 'free',
  };
}

// Uses atomic RPC function to prevent race conditions
export function useIncrementUsage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (questionsCount: number) => {
      if (!user) throw new Error('Not authenticated');
      
      const today = getUTCDate();
      
      const { data, error } = await supabase.rpc('increment_daily_usage', {
        p_user_id: user.id,
        p_date: today,
        p_count: questionsCount,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-usage'] });
    },
  });
}
