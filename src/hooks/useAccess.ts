import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AccessLevel = 'master' | 'admin' | 'moderator' | 'user';

export interface MyAccess {
  accessLevel: AccessLevel;
  isMaster: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isAffiliate: boolean;
  affiliateActive: boolean;
}

const NO_ACCESS: MyAccess = {
  accessLevel: 'user',
  isMaster: false,
  isAdmin: false,
  isStaff: false,
  isAffiliate: false,
  affiliateActive: false,
};

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  master: 'Admin Master',
  admin: 'Administrador',
  moderator: 'Moderador',
  user: 'Usuário',
};

/**
 * Nível de acesso do usuário logado, calculado no servidor (RPC get_my_access).
 * Serve apenas para montar a interface: toda ação é revalidada no banco.
 */
export function useAccess() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['my-access', user?.id],
    queryFn: async (): Promise<MyAccess> => {
      const { data, error } = await supabase.rpc('get_my_access');
      if (error || !data || typeof data !== 'object') return NO_ACCESS;
      const d = data as Record<string, unknown>;
      const level = (['master', 'admin', 'moderator'].includes(String(d.access_level))
        ? d.access_level
        : 'user') as AccessLevel;
      return {
        accessLevel: level,
        isMaster: d.is_master === true,
        isAdmin: d.is_admin === true,
        isStaff: d.is_staff === true,
        isAffiliate: d.is_affiliate === true,
        affiliateActive: d.affiliate_active === true,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { access: query.data ?? NO_ACCESS, isLoading: !!user?.id && query.isLoading, refetch: query.refetch };
}
