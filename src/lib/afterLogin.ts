/**
 * Página que o visitante tentou abrir antes de entrar. Guardada na sessão do navegador
 * para sobreviver ao vaivém do login com Google/Apple/Microsoft, que volta sempre para "/".
 */
const KEY = 'levelup:after-login';
const ORIGIN_FOR_PARSING = 'https://levelup.invalid';
const OAUTH_FIELDS = new Set([
  'code', 'code_verifier', 'code_challenge', 'state', 'session_state', 'access_token', 'refresh_token',
  'provider_token', 'provider_refresh_token', 'id_token', 'token', 'token_hash', 'token_type',
  'expires_in', 'expires_at', 'nonce', 'login_hint', 'id_token_hint', 'error', 'error_code', 'error_description',
]);

/** Guarda o caminho interno de estudo e seus filtros, descartando dados temporários do login. */
function studyPath(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  const url = new URL(path, ORIGIN_FOR_PARSING);
  if (url.origin !== ORIGIN_FOR_PARSING || url.pathname.startsWith('//') ||
      url.pathname.startsWith('/auth') || url.pathname.startsWith('/~')) return null;
  for (const key of Array.from(url.searchParams.keys())) {
    if (OAUTH_FIELDS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.pathname + url.search;
}

export function rememberAfterLogin(path: string) {
  try {
    const target = studyPath(path);
    if (target) sessionStorage.setItem(KEY, target);
  } catch { /* storage indisponível ou endereço inválido */ }
}

/** Devolve (e apaga) a página guardada; sem página guardada, devolve o fallback. */
export function takeAfterLogin(fallback = '/'): string {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (path) return studyPath(path) ?? fallback;
  } catch { /* storage indisponível */ }
  return fallback;
}
