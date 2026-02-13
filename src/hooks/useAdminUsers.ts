import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function notifyAdminAction(action: string, targetUserId: string, targetName: string, details: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  try {
    await supabase.functions.invoke('admin-notify', {
      body: { action, targetUserId, targetName, details },
    });
  } catch (e) {
    console.error('Notify error:', e);
  }
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, tier, total_quizzes, total_correct, total_questions, streak_days, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (search) query = query.ilike('display_name', `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminUserRoles() {
  return useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*').order('user_id');
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminBans() {
  return useQuery({
    queryKey: ['admin-bans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_bans')
        .select('*')
        .eq('is_active', true)
        .order('banned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, userName }: { userId: string; role: 'admin' | 'moderator' | 'user'; userName?: string }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
      await notifyAdminAction('role_assigned', userId, userName || 'Usuário', { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success('Role atribuída com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role, userName }: { userId: string; role: 'admin' | 'moderator' | 'user'; userName?: string }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
      await notifyAdminAction('role_revoked', userId, userName || 'Usuário', { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success('Role revogada com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, bannedBy, banType, reason, expiresAt, userName, banDays }: {
      userId: string;
      bannedBy: string;
      banType: 'temporary' | 'permanent';
      reason?: string;
      expiresAt?: string;
      userName?: string;
      banDays?: string;
    }) => {
      const { error } = await supabase.from('user_bans').insert({
        user_id: userId,
        banned_by: bannedBy,
        ban_type: banType,
        reason,
        expires_at: expiresAt || null,
      });
      if (error) throw error;
      await notifyAdminAction('user_banned', userId, userName || 'Usuário', {
        ban_type: banType,
        reason: reason || '',
        ban_days: banDays || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success('Usuário banido com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ banId, userId, userName }: { banId: string; userId: string; userName?: string }) => {
      const { error } = await supabase.from('user_bans').update({ is_active: false }).eq('id', banId);
      if (error) throw error;
      await notifyAdminAction('user_unbanned', userId, userName || 'Usuário', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success('Ban removido com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}
