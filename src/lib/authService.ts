export const AUTH_UNAVAILABLE_MESSAGE =
  'Não foi possível conectar ao serviço de login. Verifique sua conexão e tente novamente.';

export async function readAuthProviders(url: string, publishableKey: string): Promise<Set<string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: publishableKey },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(AUTH_UNAVAILABLE_MESSAGE);
    const settings = await response.json();
    if (!settings?.external || typeof settings.external !== 'object' || Array.isArray(settings.external)) {
      throw new Error(AUTH_UNAVAILABLE_MESSAGE);
    }
    return new Set(Object.entries(settings.external).filter(([, on]) => on === true).map(([name]) => name));
  } finally {
    clearTimeout(timeout);
  }
}

export function isAuthServiceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { status, name, message } = error as { status?: unknown; name?: unknown; message?: unknown };
  return status === 0 || (typeof status === 'number' && status >= 500) ||
    name === 'AuthRetryableFetchError' || name === 'TimeoutError' ||
    (typeof message === 'string' && /failed to fetch|fetch failed|network.?error|load failed|network request failed/i.test(message));
}

/** Erros que podem ser exibidos na recuperação sem revelar se o endereço tem conta. */
export function authAvailabilityMessage(error: unknown): string | null {
  if (isAuthServiceError(error)) return AUTH_UNAVAILABLE_MESSAGE;
  if (!error || typeof error !== 'object') return null;
  const { code, message, status } = error as { code?: unknown; message?: unknown; status?: unknown };
  if (status === 401 || code === 'email_provider_disabled' ||
      (typeof message === 'string' && /invalid api key|missing api key/i.test(message))) {
    return AUTH_UNAVAILABLE_MESSAGE;
  }
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' ||
      (typeof message === 'string' && /rate limit|only request this after/i.test(message))) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return null;
}

export function emailAuthErrorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message.toLowerCase() : '';
  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) return 'Email ou senha incorretos.';
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  const unavailable = authAvailabilityMessage(error);
  if (unavailable) return unavailable;
  if (code === 'weak_password') return 'Use uma senha mais forte para criar a conta.';
  if (code === 'user_already_exists' || /already registered|already exists/.test(text)) {
    return 'Se você já tem conta, tente entrar ou recuperar sua senha.';
  }
  return 'Não foi possível concluir. Tente novamente.';
}
