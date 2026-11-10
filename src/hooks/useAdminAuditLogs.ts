import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAdminAuditLogs(search: string) {
  return useQuery({
    queryKey: ['admin-audit-logs', search],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Remove caracteres com significado na sintaxe de filtros do PostgREST (, . ( ) * %).
      const term = search.replace(/[^\p{L}\p{N}@_\- ]/gu, '').trim().slice(0, 80);
      if (term) {
        query = query.or(`event_type.ilike.*${term}*,user_email.ilike.*${term}*`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
