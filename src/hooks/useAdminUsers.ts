import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { AccessLevel } from '@/hooks/useAccess';

export type UserFilter = 'all' | 'staff' | 'affiliates' | 'banned' | 'plus' | 'granted';
export type ManageableLevel = Exclude<AccessLevel, 'master'>;

export interface AdminUserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  tier: string;
  total_quizzes: number;
  total_correct: number;
  total_questions: number;
  streak_days: number;
  created_at: string;
  last_sign_in_at: string | null;
  access_level: AccessLevel;
  is_banned: boolean;
  ban_type: string | null;
  ban_expires_at: string | null;
  ban_reason: string | null;
  affiliate_status: 'active' | 'paused' | 'removed' | null;
  affiliate_code: string | null;
  can_moderate: boolean;
  /** 'master' (permanente), 'stripe' (pago), 'grant' (liberado pela administração) ou null. */
  premium_source: 'master' | 'stripe' | 'grant' | null;
  /** Fim da liberação manual (null = sem prazo ou sem liberação). */
  premium_grant_expires_at: string | null;
  /** Motivo da liberação (visível só para o master). */
  premium_grant_reason: string | null;
  /** Há liberação manual vigente (mesmo que o usuário também pague a assinatura). */
  has_premium_grant: boolean;
  total_count: number;
}

export const USERS_PAGE_SIZE = 25;

/** Mensagem legível a partir de erros do PostgREST/RPC. */
export function rpcErrorMessage(error: unknown): string {
  const msg = (error as { message?: string })?.message ?? '';
  if (msg.includes('permission denied')) return 'Você não tem permissão para esta ação.';
  return msg || 'Erro inesperado. Tente novamente.';
}

/** Efeitos colaterais (bloqueio no Auth + e-mail). A ação já foi aplicada e auditada pela RPC. */
async function notifyAdminAction(action: string, targetUserId: string, targetName: string, details: Record<string, string> = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-notify', {
      body: { action, targetUserId, targetName, details },
    });
    if (error || (data as { error?: string })?.error) {
      toast.warning('Ação registrada, mas a notificação ao usuário falhou.');
    }
  } catch {
    toast.warning('Ação registrada, mas a notificação ao usuário falhou.');
  }
}

export function useAdminUsers(search: string, filter: UserFilter, page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-users', user?.id, search, filter, page],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users', {
        p_search: search || undefined,
        p_filter: filter,
        p_limit: USERS_PAGE_SIZE,
        p_offset: page * USERS_PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data ?? []) as AdminUserRow[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
  };
}

export function useSetAccessLevel() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ userId, level, reason, userName }: {
      userId: string; level: ManageableLevel; reason?: string; userName?: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_set_access_level', {
        p_user_id: userId, p_level: level, p_reason: reason || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      const changed = (data as { changed?: boolean })?.changed === true;
      if (changed) await notifyAdminAction('access_level_changed', userId, userName || 'Usuário');
      return changed;
    },
    onSuccess: (changed) => {
      invalidate();
      toast.success(changed ? 'Nível de acesso atualizado!' : 'O usuário já possui este nível.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBanUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ userId, banType, days, reason, userName }: {
      userId: string; banType: 'temporary' | 'permanent'; days?: number; reason?: string; userName?: string;
    }) => {
      const { error } = await supabase.rpc('admin_ban_user', {
        p_user_id: userId,
        p_ban_type: banType,
        p_days: banType === 'temporary' ? days : undefined,
        p_reason: reason || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      await notifyAdminAction('user_banned', userId, userName || 'Usuário', { reason: reason || '' });
    },
    onSuccess: () => { invalidate(); toast.success('Usuário banido.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnbanUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ userId, userName }: { userId: string; userName?: string }) => {
      const { error } = await supabase.rpc('admin_unban_user', { p_user_id: userId });
      if (error) throw new Error(rpcErrorMessage(error));
      await notifyAdminAction('user_unbanned', userId, userName || 'Usuário');
    },
    onSuccess: () => { invalidate(); toast.success('Banimento removido.'); },
    onError: (e: Error) => toast.error(e.message),
  });
}

function useInvalidateUsersAndPlan() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    queryClient.invalidateQueries({ queryKey: ['admin-platform-overview'] });
  };
}

/** Libera o Plus (todas as funcionalidades pagas) sem cobrança. Somente o admin master. */
export function useGrantPremium() {
  const invalidate = useInvalidateUsersAndPlan();
  return useMutation({
    mutationFn: async ({ userId, days, reason }: { userId: string; days: number | null; reason?: string }) => {
      const { data, error } = await supabase.rpc('admin_grant_premium', {
        p_user_id: userId,
        p_days: days ?? undefined,
        p_reason: reason || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as { expires_at: string | null };
    },
    onSuccess: (data) => {
      invalidate();
      toast.success(data?.expires_at
        ? `Plus liberado até ${new Date(data.expires_at).toLocaleDateString('pt-BR')}.`
        : 'Plus liberado sem prazo.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Retira o Plus liberado pela administração (assinatura paga, se houver, continua). */
export function useRevokePremium() {
  const invalidate = useInvalidateUsersAndPlan();
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('admin_revoke_premium', {
        p_user_id: userId,
        p_reason: reason || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as { changed: boolean; tier: string };
    },
    onSuccess: (data) => {
      invalidate();
      if (!data?.changed) toast.info('Este usuário não tinha Plus liberado pela administração.');
      else if (data.tier === 'plus') toast.success('Liberação retirada. O usuário continua Plus pela assinatura paga.');
      else toast.success('Liberação retirada. O usuário voltou ao plano Free.');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
