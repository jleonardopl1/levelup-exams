import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { masteryByTopic, type AttemptRecord, type TopicMastery } from '@/lib/mastery';

/** Respostas mais recentes lidas para calcular o domínio (bastam as últimas por tópico). */
const MAX_ATTEMPTS = 2000;

/**
 * Domínio por tópico das matérias de um módulo, a partir das respostas do próprio aluno
 * (RLS: cada um lê só as suas tentativas; `topico` e `subject_id` são colunas públicas da
 * questão — o gabarito nunca é lido). O cálculo fica em `@/lib/mastery`.
 */
export function useTopicMastery(subjectIds: string[]) {
  const { user } = useAuth();
  const ids = [...new Set(subjectIds)].sort();
  return useQuery({
    queryKey: ['topic-mastery', user?.id, ids.join(',')],
    enabled: !!user && ids.length > 0,
    // As respostas são gravadas durante o quiz: recalcula ao voltar para a trilha.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<TopicMastery[]> => {
      const { data, error } = await supabase
        .from('user_question_attempts')
        .select('question_id, is_correct, created_at, questions!inner(subject_id, topico)')
        .in('questions.subject_id', ids)
        .order('created_at', { ascending: false })
        .limit(MAX_ATTEMPTS);
      if (error) throw error;
      type Row = {
        question_id: string;
        is_correct: boolean;
        created_at: string;
        questions: { subject_id: string | null; topico: string | null } | null;
      };
      const attempts: AttemptRecord[] = [];
      for (const row of (data ?? []) as unknown as Row[]) {
        if (!row.questions?.subject_id) continue;
        attempts.push({
          questionId: row.question_id,
          subjectId: row.questions.subject_id,
          topic: row.questions.topico,
          isCorrect: row.is_correct,
          at: row.created_at,
        });
      }
      return masteryByTopic(attempts);
    },
  });
}
