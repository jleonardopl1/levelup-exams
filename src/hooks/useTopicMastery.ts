import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { masteryByTopic, type AttemptRecord, type TopicMastery } from '@/lib/mastery';

/**
 * Respostas mais recentes lidas POR MATÉRIA. É o teto padrão de linhas por consulta do
 * PostgREST (`max_rows` = 1000): pedir mais não traz mais. Consultar cada matéria à parte
 * impede que praticar muito uma matéria apague os tópicos de outra.
 * Agregar o histórico inteiro por tópico exige uma RPC no banco (backlog).
 */
export const ATTEMPTS_PER_SUBJECT = 1000;

type Row = {
  question_id: string;
  is_correct: boolean;
  created_at: string;
  questions: { subject_id: string | null; topico: string | null } | null;
};

async function attemptsOfSubject(subjectId: string): Promise<AttemptRecord[]> {
  const { data, error } = await supabase
    .from('user_question_attempts')
    .select('question_id, is_correct, created_at, questions!inner(subject_id, topico)')
    .eq('questions.subject_id', subjectId)
    .order('created_at', { ascending: false })
    .limit(ATTEMPTS_PER_SUBJECT);
  if (error) throw error;
  const out: AttemptRecord[] = [];
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.questions?.subject_id) continue;
    out.push({
      questionId: row.question_id,
      subjectId: row.questions.subject_id,
      topic: row.questions.topico,
      isCorrect: row.is_correct,
      at: row.created_at,
    });
  }
  return out;
}

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
      const perSubject = await Promise.all(ids.map(attemptsOfSubject));
      return masteryByTopic(perSubject.flat());
    },
  });
}
