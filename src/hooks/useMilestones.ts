import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Milestone {
  id: string;
  user_id: string;
  milestone_type: string;
  milestone_value: number;
  achieved_at: string;
  notification_shown: boolean;
}

// Point milestones
export const POINT_MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

// Level milestones
export const LEVEL_MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

// Quiz milestones
export const QUIZ_MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

// Streak milestones
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

export function useUserMilestones() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-milestones', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_milestones')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      return data as Milestone[];
    },
    enabled: !!user,
  });
}

export function useUnshownMilestones() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['unshown-milestones', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_milestones')
        .select('*')
        .eq('user_id', user.id)
        .eq('notification_shown', false)
        .order('achieved_at', { ascending: true });

      if (error) throw error;
      return data as Milestone[];
    },
    enabled: !!user,
  });
}

export function useCheckAndCreateMilestones() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      totalPoints,
      currentLevel,
      totalQuizzes,
      streakDays,
    }: {
      totalPoints: number;
      currentLevel: number;
      totalQuizzes: number;
      streakDays: number;
    }) => {
      if (!user) return [];

      // Get existing milestones
      const { data: existing } = await supabase
        .from('user_milestones')
        .select('milestone_type, milestone_value')
        .eq('user_id', user.id);

      const existingSet = new Set(
        existing?.map(m => `${m.milestone_type}_${m.milestone_value}`) || []
      );

      const newMilestones: { milestone_type: string; milestone_value: number }[] = [];

      // Check point milestones
      for (const milestone of POINT_MILESTONES) {
        if (totalPoints >= milestone && !existingSet.has(`points_${milestone}`)) {
          newMilestones.push({ milestone_type: 'points', milestone_value: milestone });
        }
      }

      // Check level milestones
      for (const milestone of LEVEL_MILESTONES) {
        if (currentLevel >= milestone && !existingSet.has(`level_${milestone}`)) {
          newMilestones.push({ milestone_type: 'level', milestone_value: milestone });
        }
      }

      // Check quiz milestones
      for (const milestone of QUIZ_MILESTONES) {
        if (totalQuizzes >= milestone && !existingSet.has(`quizzes_${milestone}`)) {
          newMilestones.push({ milestone_type: 'quizzes', milestone_value: milestone });
        }
      }

      // Check streak milestones
      for (const milestone of STREAK_MILESTONES) {
        if (streakDays >= milestone && !existingSet.has(`streak_${milestone}`)) {
          newMilestones.push({ milestone_type: 'streak', milestone_value: milestone });
        }
      }

      // Insert new milestones
      if (newMilestones.length > 0) {
        const toInsert = newMilestones.map(m => ({
          user_id: user.id,
          milestone_type: m.milestone_type,
          milestone_value: m.milestone_value,
        }));

        const { error } = await supabase
          .from('user_milestones')
          .insert(toInsert);

        if (error) throw error;
      }

      return newMilestones;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-milestones'] });
      queryClient.invalidateQueries({ queryKey: ['unshown-milestones'] });
    },
  });
}

export function useMarkMilestoneShown() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (milestoneId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_milestones')
        .update({ notification_shown: true })
        .eq('id', milestoneId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unshown-milestones'] });
    },
  });
}

export function getMilestoneInfo(type: string, value: number): { title: string; description: string; icon: string; color: string } {
  switch (type) {
    case 'points':
      return {
        title: `${value.toLocaleString()} Pontos!`,
        description: `Você alcançou ${value.toLocaleString()} pontos totais!`,
        icon: 'star',
        color: 'from-amber-400 to-orange-500',
      };
    case 'level':
      return {
        title: `Nível ${value}!`,
        description: `Você chegou ao nível ${value}! Continue evoluindo!`,
        icon: 'zap',
        color: 'from-primary to-accent',
      };
    case 'quizzes':
      return {
        title: `${value} Quizzes!`,
        description: `Você completou ${value} quizzes! Impressionante!`,
        icon: 'book-open',
        color: 'from-success to-emerald-400',
      };
    case 'streak':
      return {
        title: `${value} Dias de Sequência!`,
        description: `Você manteve uma sequência de ${value} dias! Incrível dedicação!`,
        icon: 'flame',
        color: 'from-red-500 to-orange-400',
      };
    case 'ranking':
      return {
        title: value === 1 ? '1º Lugar no Ranking!' : `Top ${value}!`,
        description: value === 1 ? 'Você conquistou o primeiro lugar!' : `Você está entre os top ${value}!`,
        icon: 'trophy',
        color: 'from-yellow-400 to-amber-500',
      };
    default:
      return {
        title: 'Marco Alcançado!',
        description: 'Parabéns pela conquista!',
        icon: 'award',
        color: 'from-gray-400 to-gray-500',
      };
  }
}
