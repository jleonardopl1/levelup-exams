import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Price IDs from Stripe
export const PRICE_IDS = {
  monthly: 'price_1SdkO4FQ1QkvCgEAJsa9KbIE',
  annual: 'price_1SdkMfFQ1QkvCgEAnMRl3MXq',
} as const;

interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'plus';
  subscription_end: string | null;
}

export function useSubscription() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['subscription', session?.user?.id],
    queryFn: async (): Promise<SubscriptionStatus> => {
      if (!session) {
        return { subscribed: false, tier: 'free', subscription_end: null };
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        return { subscribed: false, tier: 'free', subscription_end: null };
      }

      return data as SubscriptionStatus;
    },
    enabled: !!session,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

export function useCreateCheckout() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (priceId: string) => {
      if (!session) {
        throw new Error('Você precisa estar logado');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar sessão de pagamento');
    },
  });
}

export function useCustomerPortal() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error('Você precisa estar logado');
      }

      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao abrir portal');
    },
  });
}
