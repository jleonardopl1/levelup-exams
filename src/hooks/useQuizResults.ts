import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface QuizResult {
  id: string;
  user_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  time_spent_seconds: number | null;
  categoria: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  created_at: string;
  display_name: string | null;
}

export function useQuizResults() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['quiz-results', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as QuizResult[];
    },
    enabled: !!user,
  });
}

export function useLeaderboard(limit: number = 10) {
  return useLeaderboardFiltered('all', limit);
}

export function useLeaderboardFiltered(period: 'today' | 'week' | 'month' | 'all' = 'all', limit: number = 10) {
  return useQuery({
    queryKey: ['leaderboard', period, limit],
    queryFn: async () => {
      let query = supabase
        .from('quiz_results')
        .select('id, user_id, score, correct_answers, total_questions, created_at')
        .order('score', { ascending: false })
        .limit(limit);

      // Apply date filter
      const now = new Date();
      if (period === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfDay);
      } else if (period === 'week') {
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', startOfWeek);
      } else if (period === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', startOfMonth);
      }

      const { data: results, error: resultsError } = await query;
      
      if (resultsError) throw resultsError;
      if (!results || results.length === 0) return [];

      // Get unique user IDs
      const userIds = [...new Set(results.map(r => r.user_id))];
      
      // Fetch profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);
      
      if (profilesError) throw profilesError;

      // Map profiles to results
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      
      return results.map(r => ({
        ...r,
        display_name: profileMap.get(r.user_id) || 'Anônimo',
      })) as LeaderboardEntry[];
    },
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      score,
      correctAnswers,
      totalQuestions,
      timeSpentSeconds,
      categoria,
    }: {
      score: number;
      correctAnswers: number;
      totalQuestions: number;
      timeSpentSeconds?: number;
      categoria?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('quiz_results')
        .insert({
          user_id: user.id,
          score,
          correct_answers: correctAnswers,
          total_questions: totalQuestions,
          time_spent_seconds: timeSpentSeconds,
          categoria,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Update profile stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_quizzes, total_correct, total_questions')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            total_quizzes: profile.total_quizzes + 1,
            total_correct: profile.total_correct + correctAnswers,
            total_questions: profile.total_questions + totalQuestions,
            last_activity_date: new Date().toISOString().split('T')[0],
          })
          .eq('user_id', user.id);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-results'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
