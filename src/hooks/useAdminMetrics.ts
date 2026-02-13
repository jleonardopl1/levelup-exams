import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminMetrics {
  users: { total: number; premium: number; free: number };
  content: { totalQuestions: number; totalQuizzes: number };
  revenue: { mrr: number; totalRevenue: number; activeSubscriptions: number; canceledSubscriptions: number };
}

export function useAdminMetrics() {
  return useQuery<AdminMetrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-metrics');
      if (error) throw error;
      return data as AdminMetrics;
    },
    staleTime: 60_000,
  });
}
