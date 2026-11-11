import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

// Price IDs from Stripe
export const PRICE_IDS = {
  monthly: 'price_1SdkO4FQ1QkvCgEAJsa9KbIE',
  annual: 'price_1SdkMfFQ1QkvCgEAnMRl3MXq',
} as const;

/** Extrai a mensagem real de erro de uma Edge Function (o corpo traz o motivo). */
async function functionError(error: unknown): Promise<Error & { code?: string }> {
  const context = (error as { context?: Response }).context;
  const body = await context?.json?.().catch(() => null);
  const err = new Error(body?.error || (error as Error)?.message || 'Erro inesperado') as Error & { code?: string };
  err.code = body?.code;
  return err;
}

export interface SubscriptionStatus {
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
    refetchInterval: 300000, // Refresh every 5 minutes instead of every minute
    staleTime: 240000, // Consider data fresh for 4 minutes
  });
}

export function useCreateCheckout() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ priceId, referralCode }: { priceId: string; referralCode?: string }) => {
      if (!session) {
        throw new Error('Você precisa estar logado');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: referralCode ? { priceId, referralCode } : { priceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw await functionError(error);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      openStripeUrl(data?.url);
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

      if (error) throw await functionError(error);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      openStripeUrl(data?.url);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao abrir portal');
    },
  });
}

/**
 * Leva o usuário ao Stripe NA MESMA ABA. Antes era `window.open(..., '_blank')` depois
 * de uma chamada assíncrona: Safari/iPhone, app instalado (PWA) e bloqueadores de pop-up
 * barravam a janela e o botão "Assinar" parecia não fazer nada. Só aceita URLs do Stripe.
 */
function openStripeUrl(url: unknown) {
  if (typeof url !== 'string') {
    toast.error('Não foi possível abrir o pagamento. Tente novamente.');
    return;
  }
  try {
    const parsed = new URL(url);
    const allowed = parsed.protocol === 'https:' &&
      (parsed.hostname === 'checkout.stripe.com' || parsed.hostname === 'billing.stripe.com');
    if (!allowed) {
      toast.error('Link de pagamento inválido');
      return;
    }
    window.location.assign(parsed.toString());
  } catch {
    toast.error('Link de pagamento inválido');
  }
}

/** Consulta o Stripe (via Edge Function) e atualiza o plano salvo no perfil. */
export async function syncSubscription(accessToken: string): Promise<SubscriptionStatus | null> {
  const { data, error } = await supabase.functions.invoke('check-subscription', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error || !data || data.error) return null;
  return data as SubscriptionStatus;
}

/**
 * Sincroniza o plano uma vez por login. Garante o Plus mesmo se o webhook do Stripe
 * atrasar ou falhar (e rebaixa quem cancelou), sem depender de abrir a página de planos.
 */
export function useSubscriptionSync() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  const token = session?.access_token;

  useEffect(() => {
    if (!userId || !token) return;
    const key = `levelup:sub-sync:${userId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* storage indisponível: sincroniza mesmo assim */ }
    void syncSubscription(token).then((status) => {
      if (!status) return;
      queryClient.setQueryData(['subscription', userId], status);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    });
    // token muda a cada renovação; sincronizar só quando o usuário muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, queryClient]);
}
