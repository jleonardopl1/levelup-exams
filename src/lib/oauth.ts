import type { OAuthTokens, SignInWithOAuthResult } from '@lovable.dev/cloud-auth-js';
import { AUTH_UNAVAILABLE_MESSAGE, isAuthServiceError } from './authService.ts';

export const OAUTH_SESSION_UNCONFIRMED = 'A sessão de login não foi confirmada. Inicie o login novamente neste navegador.';

type EstablishSession = (tokens: OAuthTokens) => Promise<{
  data: { session: unknown };
  error: Error | null;
}>;

/** No navegador a página segue para o provedor. No popup, o Supabase ainda precisa aceitar a sessão. */
export async function completeManagedSignIn(result: SignInWithOAuthResult, establishSession: EstablishSession) {
  if (result.redirected || result.error) return { error: result.error };
  const { data, error } = await establishSession(result.tokens);
  if (error) return { error };
  return { error: data.session ? null : new Error('OAuth session missing') };
}

/** Os códigos e descrições do provedor servem para escolher mensagens fixas do aplicativo. */
export function oauthErrorMessage(error: unknown): string {
  const fields = typeof error === 'object' && error !== null
    ? ['code' in error && error.code, 'message' in error && error.message]
    : [error];
  const message = fields.filter((value): value is string => typeof value === 'string')
    .join(' ').toLowerCase().replace(/[_-]/g, ' ');

  if (/preview mode|legacy flow/.test(message)) {
    return 'Abra o aplicativo em uma nova aba para entrar com essa conta.';
  }
  if (/unsupported provider|provider (?:is )?(?:not supported|disabled|not enabled)|invalid client|redirect uri mismatch/.test(message)) {
    return 'Este método de login está indisponível. Escolha outra opção ou entre com e-mail e senha.';
  }
  if (/email/.test(message) && /missing|not provided|verif/.test(message)) {
    return 'Não recebemos um e-mail verificado dessa conta. Tente outra forma de login.';
  }
  if (/bad oauth state|state is invalid|flow state|bad code verifier|session missing|session (?:not found|expired)|no tokens received/.test(message)) {
    return OAUTH_SESSION_UNCONFIRMED;
  }
  if (/access denied|cancel/.test(message)) return 'Login cancelado. Tente novamente quando quiser.';
  if (/popup|timed out/.test(message)) {
    return 'A janela de login foi bloqueada ou demorou demais. Abra o app no navegador e tente novamente.';
  }
  if (isAuthServiceError(typeof error === 'string' ? { message: error } : error) ||
      /temporarily unavailable|service unavailable|server error/.test(message)) return AUTH_UNAVAILABLE_MESSAGE;
  return 'Não foi possível entrar com essa conta. Tente novamente ou use e-mail e senha.';
}

export function oauthReturnError(search: string, hash: string): string | null {
  const fields = ['error_code', 'error', 'error_description'];
  const parameters = [new URLSearchParams(search), new URLSearchParams(hash.replace(/^#/, ''))];
  const details = parameters.flatMap(params => fields.map(field => params.get(field))).filter(Boolean);
  return details.length ? oauthErrorMessage(details.join(' ')) : null;
}

export function hasOAuthSessionParameters(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return ['code', 'access_token', 'refresh_token'].some(field => query.has(field) || fragment.has(field));
}
