import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { checkoutRedirectUrl } from '@/lib/checkout';

/**
 * Planos de assinatura. O app envia só o NOME do plano; o servidor (create-checkout)
 * escolhe o preço certo do Stripe e confere a periodicidade antes de cobrar.
 */
export type SubscriptionPlan = 'monthly' | 'annual' | 'exam_pass';

/** Extrai a mensagem real de erro de uma Edge Function (o corpo traz o motivo). */
async function functionError(error: unknown): Promise<Error & { code?: string }> {
  const context = (error as { context?: Response }).context;
  const body = await context?.json?.().catch(() => null);
  const err = new Error(body?.error || (error as Error)?.message || 'Erro inesperado') as Error & { code?: string };
  err.code = body?.code;
  return err;
}

/**
 * Origem do Plus: assinatura paga na Stripe, pagamento avulso no Mercado Pago (anual pré-pago
 * ou Passe), liberação pela administração ou conta do admin master.
 */
export type PremiumSource = 'stripe' | 'mercadopago' | 'grant' | 'master' | null;

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: 'free' | 'plus';
  subscription_end: string | null;
  source?: PremiumSource;
  /** Plano pago no Stripe ('plus' = há assinatura para gerenciar), independente da origem do acesso. */
  billing_tier?: 'free' | 'plus';
  /** Fim do Plus liberado pela administração ou pago no Mercado Pago (null = sem prazo). */
  access_until?: string | null;
  /** Plus liberado: Passe Concurso comprado ('exam_pass') ou cortesia da equipe ('staff'). */
  grant_kind?: 'exam_pass' | 'staff' | null;
  /** Fim do acesso pago no Mercado Pago, mesmo quando outra origem prevalece. */
  paid_until?: string | null;
  paid_product?: MpProduct | null;
}

export interface ExamPassOffer {
  available: boolean;
  amount_cents?: number;
  currency?: string;
  track?: { id: string; shortName: string; examDate: string };
  access_until?: string;
}

/** Passe Concurso: preço e validade vêm do servidor (Stripe + data da prova). */
export function useExamPassOffer(enabled: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['exam-pass-offer', session?.user?.id],
    enabled: enabled && !!session,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<ExamPassOffer> => {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: 'exam_pass', preview: true },
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (error || !data) return { available: false };
      return data as ExamPassOffer;
    },
  });
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
      openCheckoutUrl(data?.url);
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
      openCheckoutUrl(data?.url);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao abrir portal');
    },
  });
}

/**
 * Leva o usuário ao pagamento (Stripe ou Mercado Pago) NA MESMA ABA. Antes era
 * `window.open(..., '_blank')` depois de uma chamada assíncrona: Safari/iPhone, app instalado
 * (PWA) e bloqueadores de pop-up barravam a janela e o botão parecia não fazer nada.
 * Só aceita os hosts de `CHECKOUT_HOSTS` (src/lib/checkout.ts).
 */
function openCheckoutUrl(url: unknown) {
  const target = checkoutRedirectUrl(url);
  if (!target) {
    toast.error(typeof url === 'string' ? 'Link de pagamento inválido' : 'Não foi possível abrir o pagamento. Tente novamente.');
    return;
  }
  window.location.assign(target);
}

// ---------------------------------------------------------------------------
// Mercado Pago: Pix ou cartão em até 12x (Plus anual pré-pago e Passe Concurso)
// ---------------------------------------------------------------------------

export type MpProduct = 'plus_annual' | 'exam_pass';

export interface MpOffer {
  available: boolean;
  product: MpProduct;
  amount_cents?: number;
  currency?: string;
  max_installments?: number;
  interest_free_installments?: number;
  track?: { id: string; shortName: string; examDate: string };
  access_until?: string;
}

/** Oferta do Mercado Pago: preço e parcelas vêm do servidor (secrets), não do app. */
export function useMpOffer(product: MpProduct, enabled: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['mp-offer', product, session?.user?.id],
    enabled: enabled && !!session,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<MpOffer> => {
      const { data, error } = await supabase.functions.invoke('mp-create-checkout', {
        body: { product, preview: true },
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (error || !data) return { available: false, product };
      return data as MpOffer;
    },
  });
}

export function useMpCheckout() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ product, referralCode, trackId }: { product: MpProduct; referralCode?: string; trackId?: string }) => {
      if (!session) throw new Error('Você precisa estar logado');
      const { data, error } = await supabase.functions.invoke('mp-create-checkout', {
        body: { product, ...(referralCode ? { referralCode } : {}), ...(trackId ? { trackId } : {}) },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw await functionError(error);
      if (data?.error) throw new Error(data.error);
      return data as { url: string; orderId: string };
    },
    onSuccess: (data) => {
      openCheckoutUrl(data?.url);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao abrir o pagamento');
    },
  });
}

export interface MpOrderStatus {
  checked: boolean;
  order: {
    id: string;
    product: MpProduct;
    status: string;
    amount_cents: number;
    currency: string;
    payment_method_type: string | null;
    installments: number | null;
    paid_at: string | null;
    checkout_url: string | null;
  };
  access: { tier: 'free' | 'plus'; source: PremiumSource; access_until: string | null; paid_until: string | null };
}

/** Situação do pedido conferida no Mercado Pago pelo servidor (nunca pela URL de volta). */
export async function syncMpOrder(accessToken: string, orderId: string): Promise<MpOrderStatus | null> {
  const { data, error } = await supabase.functions.invoke('mp-sync-order', {
    body: { orderId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error || !data || data.error) return null;
  return data as MpOrderStatus;
}

export interface MyPaymentOrder {
  id: string;
  product: MpProduct;
  status: string;
  amount_cents: number;
  created_at: string;
  expires_at: string;
  checkout_url: string | null;
}

/** Pedidos do próprio aluno (para retomar um Pix em aberto). Sem a migration, lista vazia. */
export function useMyPaymentOrders(enabled: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-payment-orders', session?.user?.id],
    enabled: enabled && !!session,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<MyPaymentOrder[]> => {
      // RPC nova (migration 20261120120000): ainda não está nos tipos gerados (types.ts é gerado).
      const { data, error } = await (supabase as unknown as SupabaseClient).rpc('get_my_payment_orders', { p_limit: 5 });
      if (error || !Array.isArray(data)) return [];
      return data as MyPaymentOrder[];
    },
  });
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
