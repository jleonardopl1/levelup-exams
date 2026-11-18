import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Public question interface - does NOT include the correct answer
export interface Question {
  id: string;
  enunciado: string;
  alternativas: string[];
  categoria: string;
  dificuldade: string;
  explicacao: string | null;
  created_at: string;
  subject_id: string | null;
  is_premium: boolean;
  topico?: string | null;
  origem?: string | null;
  nivel?: string | null;
}

// Response from server-side answer validation
export interface AnswerValidationResult {
  is_correct: boolean;
  correct_index: number;
  explicacao: string | null;
  error?: string;
}

/** srs = fila da revisão espaçada (get_review_queue): erros que vencem hoje, de todas as matérias. */
export type PracticeMode = 'smart' | 'review' | 'new' | 'weekly' | 'srs';

interface UseQuestionsOptions {
  limit?: number;
  categoria?: string;
  subjectId?: string;
  /** Nivel do modulo da trilha ('medio' | 'superior'): filtra questoes exclusivas do outro nivel. */
  nivel?: string;
  mode?: PracticeMode;
}

export function useQuestions(options: UseQuestionsOptions = {}) {
  const { limit = 10, categoria, subjectId, nivel, mode = 'smart' } = options;
  
  return useQuery({
    queryKey: ['questions', limit, categoria, subjectId, nivel, mode],
    // O conjunto de um quiz em andamento e um snapshot: nunca refazer a busca em
    // segundo plano (foco/reconexao), pois o RPC sorteia e reordena as questoes.
    // gcTime 0 descarta o cache ao sair, entao a proxima tentativa busca um novo conjunto.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (mode === 'srs') {
        const { data: queue, error: qErr } = await supabase.rpc('get_review_queue', { p_limit: limit });
        if (qErr) throw qErr;
        const ids = ((queue as { question_ids?: string[] } | null)?.question_ids ?? []).filter(Boolean);
        if (ids.length === 0) return [] as Question[];
        const { data, error } = await supabase
          .from('questions_public')
          .select('id, enunciado, alternativas, categoria, dificuldade, created_at, subject_id, is_premium, topico, origem, nivel')
          .in('id', ids);
        if (error) throw error;
        const order = new Map(ids.map((id, i) => [id, i]));
        return ((data ?? []) as Omit<Question, 'explicacao'>[])
          .map((q) => ({ ...q, explicacao: null }))
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) as Question[];
      }

      if (subjectId) {
        // Selecao no servidor: ineditas primeiro, depois erros; 'review' traz so os erros.
        const { data, error } = await supabase.rpc('get_practice_questions', {
          p_subject_id: subjectId,
          p_nivel: nivel ?? undefined,
          p_limit: limit,
          p_mode: mode,
        });
        if (error) throw error;
        return (data ?? []).map((q) => ({ ...q, explicacao: null })) as Question[];
      }

      // Simulado geral: selecao no servidor (ineditas -> erradas -> demais, aleatorio).
      // Antes a busca era um SELECT sem ordenacao e trazia sempre as mesmas questoes.
      const { data, error } = await supabase.rpc('get_quiz_questions', {
        p_categoria: categoria && categoria !== 'Todas' ? categoria : undefined,
        p_limit: limit,
      });

      if (error) throw error;
      return (data ?? []).map((q) => ({ ...q, explicacao: null })) as Question[];
    },
  });
}

// Hook to validate an answer server-side
export function useValidateAnswer() {
  return useMutation({
    mutationFn: async ({ questionId, selectedIndex }: { questionId: string; selectedIndex: number }) => {
      const { data, error } = await supabase.rpc('validate_answer', {
        p_question_id: questionId,
        p_selected_index: selectedIndex,
      });
      
      if (error) throw error;
      const result = data as unknown as AnswerValidationResult | null;
      // A RPC devolve { error } (rate limit, questao inexistente...) em vez de lancar.
      if (!result || result.error || typeof result.is_correct !== 'boolean') {
        throw new Error(
          result?.error?.startsWith('Rate limit')
            ? 'Muitas respostas em sequência. Aguarde alguns segundos e tente de novo.'
            : 'Não foi possível validar a resposta. Verifique sua conexão e tente novamente.',
        );
      }
      return result;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // Only fetch the categoria column instead of all question data
      const { data, error } = await supabase
        .from('questions_public')
        .select('categoria');
      
      if (error) throw error;
      
      const unique = [...new Set(data.map(q => q.categoria))];
      return ['Todas', ...unique];
    },
    staleTime: 10 * 60 * 1000, // Categories rarely change, cache for 10 minutes
  });
}

export interface ReviewQueueStatus {
  due_total: number;
  done_today: number;
  limited: boolean;
  free_remaining_today: number | null;
  question_ids: string[];
}

/** Situação da revisão espaçada de hoje (card no início e na trilha). */
export function useReviewQueue(enabled = true) {
  return useQuery({
    queryKey: ['review-queue'],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_review_queue', { p_limit: 100 });
      if (error) throw error;
      return data as unknown as ReviewQueueStatus;
    },
  });
}
