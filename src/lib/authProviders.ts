import { useQuery } from '@tanstack/react-query';

/**
 * Catálogo dos logins sociais.
 *
 * - `supabase`: provedor nativo do Supabase Auth. Só aparece na tela se estiver
 *   ATIVADO no backend (lido em /auth/v1/settings), para nunca mostrar um botão
 *   que responde "Unsupported provider".
 * - `managed`: provedor gerenciado pelo Lovable Cloud (broker OAuth). Ativado em
 *   Cloud → Users → Auth settings. Controlado por VITE_MANAGED_OAUTH_PROVIDERS.
 *
 * Situação verificada em 10/11/2026 no backend publicado: Google ativo; GitHub,
 * LinkedIn, Microsoft (azure) e Facebook desativados no Supabase. O Lovable Cloud
 * oferece Google, Apple e Microsoft gerenciados; GitHub/LinkedIn/Facebook não são
 * suportados por ele (LinkedIn só via configuração OIDC própria).
 */
export type SocialProviderId = 'google' | 'microsoft' | 'apple' | 'github' | 'linkedin_oidc' | 'facebook';

export interface SocialProvider {
  id: SocialProviderId;
  label: string;
  via: 'supabase' | 'managed';
  /** Nome do provedor no Supabase (para checar se está ativo). */
  supabaseName?: string;
  /** Parâmetros extras: força a tela de escolha de conta. */
  queryParams?: Record<string, string>;
}

export const SOCIAL_PROVIDERS: SocialProvider[] = [
  { id: 'google', label: 'Google', via: 'supabase', supabaseName: 'google', queryParams: { prompt: 'select_account' } },
  { id: 'microsoft', label: 'Microsoft', via: 'managed' }, // contas Outlook/Hotmail/Live
  { id: 'apple', label: 'Apple', via: 'managed' },
  { id: 'github', label: 'GitHub', via: 'supabase', supabaseName: 'github' },
  { id: 'linkedin_oidc', label: 'LinkedIn', via: 'supabase', supabaseName: 'linkedin_oidc' },
  { id: 'facebook', label: 'Facebook', via: 'supabase', supabaseName: 'facebook' },
];

/** Provedores gerenciados pelo Lovable que foram ligados no painel (padrão: Microsoft). */
const MANAGED_ENABLED = new Set(
  (import.meta.env.VITE_MANAGED_OAUTH_PROVIDERS ?? 'microsoft')
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean),
);

/** Se a consulta ao backend falhar, mostramos só o que sabemos que funciona. */
const FALLBACK_SUPABASE_ENABLED = new Set(['google']);

async function fetchEnabledSupabaseProviders(): Promise<Set<string>> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`auth settings ${res.status}`);
  const body = (await res.json()) as { external?: Record<string, boolean> };
  return new Set(Object.entries(body.external ?? {}).filter(([, on]) => on === true).map(([name]) => name));
}

export function isProviderEnabled(p: SocialProvider, supabaseEnabled: Set<string>): boolean {
  if (p.via === 'managed') return MANAGED_ENABLED.has(p.id);
  return !!p.supabaseName && supabaseEnabled.has(p.supabaseName);
}

/** Lista de logins sociais realmente disponíveis neste ambiente. */
export function useAvailableSocialProviders() {
  const query = useQuery({
    queryKey: ['auth-providers'],
    queryFn: fetchEnabledSupabaseProviders,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const enabled = query.data ?? (query.isError ? FALLBACK_SUPABASE_ENABLED : null);
  return {
    loading: enabled === null,
    providers: enabled ? SOCIAL_PROVIDERS.filter((p) => isProviderEnabled(p, enabled)) : [],
  };
}

export function providerLabel(id: string): string {
  return SOCIAL_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

/**
 * Traduz erros devolvidos pelo OAuth (na URL de retorno ou pela API) para português.
 */
export function oauthErrorMessage(raw: string | null | undefined): string {
  const msg = (raw ?? '').toLowerCase();
  if (msg.includes('not supported') || msg.includes('unsupported provider') || msg.includes('not enabled')) {
    return 'Este método de login ainda não está ativado. Use outra opção ou entre com e-mail e senha.';
  }
  if (msg.includes('access_denied') || msg.includes('denied') || msg.includes('cancel')) {
    return 'Login cancelado. Tente novamente quando quiser.';
  }
  if (msg.includes('email') && (msg.includes('missing') || msg.includes('not provided') || msg.includes('verified'))) {
    return 'Não recebemos um e-mail verificado dessa conta. Tente outra forma de login.';
  }
  if (msg.includes('preview mode') || msg.includes('new tab')) {
    return 'No modo de pré-visualização o login social não funciona. Abra o app em uma nova aba.';
  }
  if (msg.includes('popup') || msg.includes('timed out')) {
    return 'A janela de login foi fechada ou demorou demais. Tente novamente.';
  }
  return 'Não foi possível entrar com essa conta. Tente novamente ou use e-mail e senha.';
}
