import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AuditLogRow {
  id: string;
  event_type: string;
  created_at: string;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  actor_name: string | null;
  /** Somente para o admin master (LGPD). */
  actor_email: string | null;
  /** Somente para o admin master (LGPD). */
  ip_address: string | null;
  target_name: string | null;
}

/** Logs de auditoria via RPC: e-mails/IPs mascarados para quem não é o admin master. */
export function useAdminAuditLogs(search: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-audit-logs', user?.id, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_audit_logs', {
        p_search: search.trim().slice(0, 80) || undefined,
        p_limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as AuditLogRow[];
    },
    enabled: !!user,
  });
}
