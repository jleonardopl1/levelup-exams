import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Question {
  id: string;
  enunciado: string;
  alternativas: string[];
  correta: number;
  categoria: string;
  dificuldade: string;
  explicacao: string | null;
  created_at: string;
  subject_id: string | null;
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
      let query = supabase
        .from('questions')
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

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('categoria');
      
      if (error) throw error;
      
      const unique = [...new Set(data.map(q => q.categoria))];
      return ['Todas', ...unique];
    },
  });
}
