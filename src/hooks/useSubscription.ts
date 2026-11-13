import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';

/**
 * Planos de assinatura. O app envia só o NOME do plano; o servidor (create-checkout)
 * escolhe o preço certo do Stripe e confere a periodicidade antes de cobrar.
 */
export type SubscriptionPlan = 'monthly' | 'annual';

/** Extrai a mensagem real de erro de uma Edge Function (o corpo traz o motivo). */
async function functionError(error: unknown): Promise<Error & { code?: string }> {
  const context = (error as { context?: Response }).context;
  const body = await context?.json?.().catch(() => null);
  const err = new Error(body?.error || (error as Error)?.message || 'Erro inesperado') as Error & { code?: string };
  err.code = body?.code;
  return err;
}

/** Origem do Plus: assinatura paga, liberação pela administração ou conta do admin master. */
export type PremiumSource = 'stripe' | 'grant' | 'master' | null;

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'plus';
  subscription_end: string | null;
  source?: PremiumSource;
  /** Fim do Plus liberado pela administração (null = sem prazo). */
  access_until?: string | null;
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
    mutationFn: async ({ plan, referralCode }: { plan: SubscriptionPlan; referralCode?: string }) => {
      if (!session) {
        throw new Error('Você precisa estar logado');
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: referralCode ? { plan, referralCode } : { plan },
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

const SYNC_KEY_PREFIX = 'levelup:sub-sync:';
const RETRY_DELAY_MS = 60_000;
const syncInFlight = new Set<string>();

function readSynced(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}

function markSynced(key: string) {
  try { sessionStorage.setItem(key, '1'); } catch { /* storage indisponível */ }
}

function clearSyncMarkers() {
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(SYNC_KEY_PREFIX)).forEach((k) => sessionStorage.removeItem(k));
  } catch { /* storage indisponível */ }
}

/**
 * Sincroniza o plano uma vez por login. Garante o Plus mesmo se o webhook do Stripe
 * atrasar ou falhar (e rebaixa quem cancelou), sem depender de abrir a página de planos.
 * Só marca como feito quando a consulta dá certo; se falhar (sem internet, função fora
 * do ar), tenta de novo ao reconectar ou após 1 minuto. Sair da conta zera a marcação.
 */
export function useSubscriptionSync() {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      // Só após a sessão carregar: no início da página o usuário ainda não foi restaurado.
      if (!loading) clearSyncMarkers();
      return;
    }
    const key = `${SYNC_KEY_PREFIX}${userId}`;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attempt = async () => {
      if (disposed || readSynced(key) || syncInFlight.has(key)) return;
      syncInFlight.add(key);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const status = token ? await syncSubscription(token) : null;
        if (status) {
          markSynced(key);
          queryClient.setQueryData(['subscription', userId], status);
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        } else if (!disposed) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => void attempt(), RETRY_DELAY_MS);
        }
      } finally {
        syncInFlight.delete(key);
      }
    };

    const onOnline = () => void attempt();
    window.addEventListener('online', onOnline);
    void attempt();
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, loading, queryClient]);
}
