import { useQuery } from '@tanstack/react-query';
import { readAuthProviders } from './authService';

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
 * LinkedIn e Facebook desativados no Supabase. Microsoft e Apple via Lovable (11/11). O Lovable Cloud
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

/**
 * Provedores que passam pelo broker OAuth do Lovable (Cloud → Users → Auth settings).
 *
 * A publicação usa Google, Microsoft e Apple no broker. Se o ambiente omitir
 * Google da lista explícita, o cliente consulta a habilitação nativa no Supabase.
 */
const MANAGED_ENABLED = new Set(
  (import.meta.env.VITE_MANAGED_OAUTH_PROVIDERS ?? 'microsoft,apple,google')
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean),
);

const GOOGLE_VIA_BROKER = MANAGED_ENABLED.has('google');

export const SOCIAL_PROVIDERS: SocialProvider[] = [
  GOOGLE_VIA_BROKER
    ? { id: 'google', label: 'Google', via: 'managed', queryParams: { prompt: 'select_account' } }
    : { id: 'google', label: 'Google', via: 'supabase', supabaseName: 'google', queryParams: { prompt: 'select_account' } },
  { id: 'microsoft', label: 'Microsoft', via: 'managed' }, // contas Outlook/Hotmail/Live
  { id: 'apple', label: 'Apple', via: 'managed' },
  { id: 'github', label: 'GitHub', via: 'supabase', supabaseName: 'github' },
  { id: 'linkedin_oidc', label: 'LinkedIn', via: 'supabase', supabaseName: 'linkedin_oidc' },
  { id: 'facebook', label: 'Facebook', via: 'supabase', supabaseName: 'facebook' },
];

export function isProviderEnabled(p: SocialProvider, supabaseEnabled: Set<string>): boolean {
  if (p.via === 'managed') return MANAGED_ENABLED.has(p.id);
  return !!p.supabaseName && supabaseEnabled.has(p.supabaseName);
}

/** Lista de logins sociais realmente disponíveis neste ambiente. */
export function useAvailableSocialProviders() {
  const query = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => readAuthProviders(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
    staleTime: 30_000,
    retry: false,
    networkMode: 'always',
  });
  const enabled = query.isSuccess ? query.data : null;
  return {
    loading: query.isPending,
    unavailable: query.isError,
    retrying: query.isFetching,
    retry: query.refetch,
    providers: enabled ? SOCIAL_PROVIDERS.filter((p) => isProviderEnabled(p, enabled)) : [],
  };
}

export function providerLabel(id: string): string {
  return SOCIAL_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

export { oauthErrorMessage } from './oauth';
