import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { rpcErrorMessage } from '@/hooks/useAdminUsers';

export type AffiliateStatus = 'active' | 'paused' | 'removed';

export interface AffiliateKpis {
  total_conversions: number;
  conversions_this_month: number;
  conversions_last_month: number;
  conversions_30d: number;
  gross_revenue: number;
  total_commission: number;
  commission_this_month: number;
  commission_last_month: number;
  paid_out: number;
  balance_due: number;
  avg_ticket: number;
  active_referrals: number;
  retention_rate: number | null;
  visits_total: number;
  visits_30d: number;
  conversion_rate_30d: number | null;
  last_conversion_at: string | null;
}

export interface AffiliateMonth {
  month: string; // YYYY-MM
  conversions: number;
  revenue: number;
  commission: number;
  visits: number;
}

export interface AffiliateDashboardData {
  referral_code_id: string;
  code: string;
  is_active: boolean;
  status: AffiliateStatus;
  commission_percent: number;
  discount_percent: number;
  member_since: string;
  kpis: AffiliateKpis;
  monthly: AffiliateMonth[];
  recent: {
    id: string;
    created_at: string;
    subscription_amount: number | null;
    commission_earned: number | null;
    is_active_subscriber: boolean;
  }[];
  payouts: { id: string; amount: number; paid_at: string; method: string; reference: string | null }[];
  rank: number | null;
  active_affiliates: number;
}

export interface AffiliateRow {
  id: string;
  user_id: string;
  code: string;
  display_name: string | null;
  email: string | null;
  status: AffiliateStatus;
  is_active: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  commission_percent: number;
  discount_percent: number;
  total_uses: number;
  total_earnings: number;
  paid_out: number;
  balance_due: number;
  gross_revenue: number;
  conversions_30d: number;
  commission_30d: number;
  visits_30d: number;
  last_conversion_at: string | null;
  created_at: string;
  source: 'self_service' | 'admin';
  notes: string | null;
}

export interface AffiliateOverview {
  can_manage: boolean;
  self_enrollment: boolean;
  totals: {
    affiliates_active: number;
    affiliates_paused: number;
    affiliates_removed: number;
    conversions_total: number;
    conversions_30d: number;
    gross_revenue: number;
    commission_total: number;
    commission_30d: number;
    paid_out: number;
    balance_due: number;
    visits_30d: number;
  };
  affiliates: AffiliateRow[];
}

/** jsonb numeric chega como number ou string; normaliza recursivamente os campos numéricos. */
const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v));

export const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export const AFFILIATE_STATUS_LABELS: Record<AffiliateStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  removed: 'Removido',
};

function normalizeDashboard(raw: unknown): AffiliateDashboardData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as AffiliateDashboardData;
  const k = (d.kpis ?? {}) as unknown as Record<string, unknown>;
  const kpis = Object.fromEntries(
    Object.entries(k).map(([key, v]) =>
      key === 'last_conversion_at' ? [key, v] : [key, v === null ? null : num(v)]),
  ) as unknown as AffiliateKpis;
  return {
    ...d,
    commission_percent: num(d.commission_percent),
    discount_percent: num(d.discount_percent),
    kpis,
    monthly: (d.monthly ?? []).map((m) => ({
      month: m.month,
      conversions: num(m.conversions),
      revenue: num(m.revenue),
      commission: num(m.commission),
      visits: num(m.visits),
    })),
    recent: (d.recent ?? []).map((r) => ({
      ...r,
      subscription_amount: r.subscription_amount === null ? null : num(r.subscription_amount),
      commission_earned: r.commission_earned === null ? null : num(r.commission_earned),
    })),
    payouts: (d.payouts ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
  };
}

/** Dashboard de KPIs do afiliado. Sem `referralCodeId`: o do próprio usuário. */
export function useAffiliateDashboard(referralCodeId?: string, months = 6) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['affiliate-dashboard', referralCodeId ?? user?.id, months],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_affiliate_dashboard', {
        p_referral_code_id: referralCodeId,
        p_months: months,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return normalizeDashboard(data);
    },
    enabled: !!user,
  });
}

export function useAffiliateOverview(enabled = true) {
  return useQuery({
    queryKey: ['admin-affiliate-overview'],
    queryFn: async (): Promise<AffiliateOverview> => {
      const { data, error } = await supabase.rpc('admin_affiliate_overview');
      if (error) throw new Error(rpcErrorMessage(error));
      const o = data as unknown as AffiliateOverview;
      const totals = Object.fromEntries(
        Object.entries(o.totals ?? {}).map(([k, v]) => [k, num(v)]),
      ) as AffiliateOverview['totals'];
      return {
        ...o,
        totals,
        affiliates: (o.affiliates ?? []).map((a) => ({
          ...a,
          commission_percent: num(a.commission_percent),
          discount_percent: num(a.discount_percent),
          total_uses: num(a.total_uses),
          total_earnings: num(a.total_earnings),
          paid_out: num(a.paid_out),
          balance_due: num(a.balance_due),
          gross_revenue: num(a.gross_revenue),
          conversions_30d: num(a.conversions_30d),
          commission_30d: num(a.commission_30d),
          visits_30d: num(a.visits_30d),
        })),
      };
    },
    enabled,
  });
}

function useAffiliateMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  successMessage: string | ((result: unknown) => string),
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-affiliate-overview'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast.success(typeof successMessage === 'function' ? successMessage(result) : successMessage);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddAffiliate() {
  return useAffiliateMutation(
    async (v: { email?: string; userId?: string; code: string; commission?: number; discount?: number; notes?: string }) => {
      const { data, error } = await supabase.rpc('admin_add_affiliate', {
        p_email: v.email || undefined,
        p_user_id: v.userId || undefined,
        p_code: v.code,
        p_commission_percent: v.commission,
        p_discount_percent: v.discount,
        p_notes: v.notes || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return data;
    },
    (r) => ((r as { reactivated?: boolean })?.reactivated ? 'Afiliado reativado!' : 'Afiliado adicionado!'),
  );
}

export function useUpdateAffiliate() {
  return useAffiliateMutation(
    async (v: { id: string; commission?: number; discount?: number; isActive?: boolean; notes?: string }) => {
      const { error } = await supabase.rpc('admin_update_affiliate', {
        p_referral_code_id: v.id,
        p_commission_percent: v.commission,
        p_discount_percent: v.discount,
        p_is_active: v.isActive,
        p_notes: v.notes,
      });
      if (error) throw new Error(rpcErrorMessage(error));
    },
    'Afiliado atualizado!',
  );
}

export function useRemoveAffiliate() {
  return useAffiliateMutation(
    async (v: { id: string; reason?: string }) => {
      const { error } = await supabase.rpc('admin_remove_affiliate', {
        p_referral_code_id: v.id,
        p_reason: v.reason || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
    },
    'Afiliado removido do programa.',
  );
}

export function useRegisterPayout() {
  return useAffiliateMutation(
    async (v: { id: string; amount: number; method: string; reference?: string; notes?: string }) => {
      const { error } = await supabase.rpc('admin_register_payout', {
        p_referral_code_id: v.id,
        p_amount: v.amount,
        p_method: v.method,
        p_reference: v.reference || undefined,
        p_notes: v.notes || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
    },
    'Pagamento registrado!',
  );
}

export function useUpdateSetting() {
  return useAffiliateMutation(
    async (v: { key: string; value: boolean | number }) => {
      const { error } = await supabase.rpc('admin_update_setting', { p_key: v.key, p_value: v.value });
      if (error) throw new Error(rpcErrorMessage(error));
    },
    'Configuração salva!',
  );
}

export function useAffiliateSelfEnrollment() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['affiliate-self-enrollment'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('affiliate_self_enrollment_enabled');
      if (error) return true;
      return data !== false;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Link de indicação (?ref=CODIGO): guardado por 30 dias e aplicado no checkout.
// ---------------------------------------------------------------------------
const REF_STORAGE_KEY = 'levelup_ref';
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const REFERRAL_CODE_RE = /^[A-Z0-9]{4,20}$/;

export function storeReferralCode(rawCode: string): string | null {
  const code = rawCode.trim().toUpperCase();
  if (!REFERRAL_CODE_RE.test(code)) return null;
  try {
    localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // armazenamento indisponível (modo privado): segue sem persistir
  }
  return code;
}

export function getStoredReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(REF_STORAGE_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number };
    if (!code || !at || Date.now() - at > REF_TTL_MS || !REFERRAL_CODE_RE.test(code)) {
      localStorage.removeItem(REF_STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(REF_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Conta a visita ao link uma vez por código por dia neste navegador. */
export async function trackReferralVisit(code: string) {
  const dayKey = `levelup_ref_visit_${code}_${new Date().toISOString().slice(0, 10)}`;
  try {
    if (localStorage.getItem(dayKey)) return;
    localStorage.setItem(dayKey, '1');
  } catch {
    // sem storage: ainda registra
  }
  await supabase.rpc('track_referral_visit', { p_code: code });
}

export function buildReferralLink(code: string) {
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}
