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
}

// Response from server-side answer validation
export interface AnswerValidationResult {
  is_correct: boolean;
  correct_index: number;
  explicacao: string | null;
  error?: string;
}

interface UseQuestionsOptions {
  limit?: number;
  categoria?: string;
  subjectId?: string;
}

export function useQuestions(options: UseQuestionsOptions = {}) {
  const { limit = 10, categoria, subjectId } = options;
  
  return useQuery({
    queryKey: ['questions', limit, categoria, subjectId],
    queryFn: async () => {
      // Query the public view that excludes the correct answer
      let query = supabase
        .from('questions_public')
        .select('*')
        .limit(limit);
      
      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      } else if (categoria && categoria !== 'Todas') {
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
      // Use the public view instead of the base table
      const { data, error } = await supabase
        .from('questions_public')
        .select('categoria');
      
      if (error) throw error;
      
      const unique = [...new Set(data.map(q => q.categoria))];
      return ['Todas', ...unique];
    },
  });
}
