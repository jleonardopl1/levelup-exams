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

      // Simulado geral: selecao no servidor (ineditas -> erradas -> demais, aleatorio).
      // Antes a busca era um SELECT sem ordenacao e trazia sempre as mesmas questoes.
      const { data, error } = await supabase.rpc('get_quiz_questions', {
        p_categoria: categoria && categoria !== 'Todas' ? categoria : undefined,
        p_limit: limit,
      });

      if (error) throw error;
      return (data ?? []).map((q) => ({ ...q, explicacao: null })) as Question[];
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
