import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CareerCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  career_category_id: string;
  name: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function useCareerCategories() {
  return useQuery({
    queryKey: ['career-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as CareerCategory[];
    },
  });
}

export function useSubjects(careerCategoryId?: string) {
  return useQuery({
    queryKey: ['subjects', careerCategoryId],
    queryFn: async () => {
      let query = supabase
        .from('subjects')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (careerCategoryId) {
        query = query.eq('career_category_id', careerCategoryId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Subject[];
    },
    enabled: !!careerCategoryId,
  });
}

export function useAllSubjects() {
  return useQuery({
    queryKey: ['all-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*, career_categories(name)')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}
