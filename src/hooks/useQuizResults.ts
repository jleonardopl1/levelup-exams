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
      // Use secure RPC function that exposes only necessary leaderboard data
      const { data, error } = await supabase.rpc('get_leaderboard', {
        period: period,
        limit_count: limit
      });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((r: { id: string; user_id: string; score: number; correct_answers: number; total_questions: number; display_name: string | null; created_at: string }) => ({
        id: r.id,
        user_id: r.user_id,
        score: r.score,
        correct_answers: r.correct_answers,
        total_questions: r.total_questions,
        created_at: r.created_at,
        display_name: r.display_name || 'Anônimo',
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
