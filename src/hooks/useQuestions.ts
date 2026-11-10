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

export type PracticeMode = 'smart' | 'review' | 'new' | 'weekly';

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

      let query = supabase
        .from('questions_public')
        .select('*')
        .limit(limit);
      
      if (categoria && categoria !== 'Todas') {
        query = query.eq('categoria', categoria);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Question[];
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
      return data as unknown as AnswerValidationResult;
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
