import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, tier, total_quizzes, total_correct, total_questions, streak_days, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (search) {
        query = query.ilike('display_name', `%${search}%`);
      }

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
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('user_id');
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
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'moderator' | 'user' }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast.success('Role atribuída com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'moderator' | 'user' }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast.success('Role revogada com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, bannedBy, banType, reason, expiresAt }: {
      userId: string;
      bannedBy: string;
      banType: 'temporary' | 'permanent';
      reason?: string;
      expiresAt?: string;
    }) => {
      const { error } = await supabase
        .from('user_bans')
        .insert({
          user_id: userId,
          banned_by: bannedBy,
          ban_type: banType,
          reason,
          expires_at: expiresAt || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bans'] });
      toast.success('Usuário banido com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (banId: string) => {
      const { error } = await supabase
        .from('user_bans')
        .update({ is_active: false })
        .eq('id', banId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bans'] });
      toast.success('Ban removido com sucesso!');
    },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });
}
