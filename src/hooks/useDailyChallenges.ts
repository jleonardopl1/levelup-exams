import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DailyChallenge {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  challenge_type: string;
  target_value: number;
  points_reward: number;
  difficulty: string;
}

export interface UserDailyChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  challenge_date: string;
  current_progress: number;
  is_completed: boolean;
  completed_at: string | null;
  points_claimed: boolean;
  challenge?: DailyChallenge;
}

export function useDailyChallenges() {
  return useQuery({
    queryKey: ['daily-challenges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('is_active', true)
        .order('difficulty', { ascending: true });

      if (error) throw error;
      return data as DailyChallenge[];
    },
  });
}

export function useUserDailyChallenges() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['user-daily-challenges', user?.id, today],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_daily_challenges')
        .select(`
          *,
          challenge:daily_challenges(*)
        `)
        .eq('user_id', user.id)
        .eq('challenge_date', today);

      if (error) throw error;
      return data as UserDailyChallenge[];
    },
    enabled: !!user,
  });
}

export function useInitializeDailyChallenges() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      // Get all active challenges
      const { data: challenges } = await supabase
        .from('daily_challenges')
        .select('id')
        .eq('is_active', true);

      if (!challenges) return [];

      // Check which challenges user already has for today
      const { data: existing } = await supabase
        .from('user_daily_challenges')
        .select('challenge_id')
        .eq('user_id', user.id)
        .eq('challenge_date', today);

      const existingIds = new Set(existing?.map(e => e.challenge_id) || []);

      // Create missing challenge entries
      const toInsert = challenges
        .filter(c => !existingIds.has(c.id))
        .map(c => ({
          user_id: user.id,
          challenge_id: c.id,
          challenge_date: today,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('user_daily_challenges')
          .insert(toInsert);

        if (error) throw error;
      }

      return toInsert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-daily-challenges'] });
    },
  });
}

export function useUpdateChallengeProgress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      correctAnswers,
      totalQuestions,
      accuracy,
      timeSpentSeconds,
      consecutiveCorrect,
      isPerfect,
    }: {
      correctAnswers: number;
      totalQuestions: number;
      accuracy: number;
      timeSpentSeconds: number;
      consecutiveCorrect: number;
      isPerfect: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Get user's challenges for today with challenge details
      const { data: userChallenges } = await supabase
        .from('user_daily_challenges')
        .select(`
          *,
          challenge:daily_challenges(*)
        `)
        .eq('user_id', user.id)
        .eq('challenge_date', today)
        .eq('is_completed', false);

      if (!userChallenges) return [];

      const completedChallenges: UserDailyChallenge[] = [];

      for (const uc of userChallenges) {
        const challenge = uc.challenge as DailyChallenge;
        if (!challenge) continue;

        let newProgress = uc.current_progress;
        let isCompleted = false;

        switch (challenge.challenge_type) {
          case 'quiz_count':
            newProgress += 1;
            break;
          case 'correct_answers':
            newProgress += correctAnswers;
            break;
          case 'perfect_score':
            if (isPerfect) newProgress += 1;
            break;
          case 'accuracy':
            if (accuracy >= challenge.target_value) newProgress += 1;
            break;
          case 'time_spent':
            newProgress += timeSpentSeconds;
            break;
          case 'streak':
            newProgress = Math.max(newProgress, consecutiveCorrect);
            break;
        }

        isCompleted = newProgress >= challenge.target_value;

        // Update progress
        await supabase
          .from('user_daily_challenges')
          .update({
            current_progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
          })
          .eq('id', uc.id);

        if (isCompleted && !uc.is_completed) {
          completedChallenges.push({ ...uc, challenge, is_completed: true });
        }
      }

      return completedChallenges;
    },
    onSuccess: (completedChallenges) => {
      queryClient.invalidateQueries({ queryKey: ['user-daily-challenges'] });
      
      // Show notifications for completed challenges
      completedChallenges.forEach(uc => {
        if (uc.challenge) {
          toast.success(`🎯 Desafio concluído: ${uc.challenge.title}!`, {
            description: `+${uc.challenge.points_reward} pontos disponíveis para resgate`,
            duration: 5000,
          });
        }
      });
    },
  });
}

export function useClaimChallengeReward() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Get the challenge
      const { data: uc, error: fetchError } = await supabase
        .from('user_daily_challenges')
        .select(`
          *,
          challenge:daily_challenges(*)
        `)
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId)
        .eq('challenge_date', today)
        .eq('is_completed', true)
        .eq('points_claimed', false)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!uc) throw new Error('Desafio não encontrado ou já resgatado');

      const challenge = uc.challenge as DailyChallenge;

      // Mark as claimed
      const { error: updateError } = await supabase
        .from('user_daily_challenges')
        .update({ points_claimed: true })
        .eq('id', uc.id);

      if (updateError) throw updateError;

      // Add points to user rewards
      const { data: rewards } = await supabase
        .from('user_rewards')
        .select('total_points')
        .eq('user_id', user.id)
        .maybeSingle();

      if (rewards) {
        await supabase
          .from('user_rewards')
          .update({ total_points: rewards.total_points + challenge.points_reward })
          .eq('user_id', user.id);
      }

      // Create notification
      await supabase.from('notifications').insert([{
        user_id: user.id,
        type: 'reward',
        title: `Recompensa Resgatada!`,
        message: `Você ganhou ${challenge.points_reward} pontos pelo desafio "${challenge.title}"`,
        icon: 'gift',
        data: { challenge_id: challengeId, points: challenge.points_reward },
      }]);

      return challenge.points_reward;
    },
    onSuccess: (points) => {
      queryClient.invalidateQueries({ queryKey: ['user-daily-challenges'] });
      queryClient.invalidateQueries({ queryKey: ['user-rewards'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`🎁 +${points} pontos resgatados!`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao resgatar recompensa');
    },
  });
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'bg-success/10 text-success border-success/20';
    case 'normal': return 'bg-primary/10 text-primary border-primary/20';
    case 'hard': return 'bg-accent/10 text-accent border-accent/20';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return 'Fácil';
    case 'normal': return 'Normal';
    case 'hard': return 'Difícil';
    default: return difficulty;
  }
}
