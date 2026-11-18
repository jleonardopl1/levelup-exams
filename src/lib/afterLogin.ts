/**
 * Página que o visitante tentou abrir antes de entrar. Guardada na sessão do navegador
 * para sobreviver ao vaivém do login com Google/Apple/Microsoft, que volta sempre para "/".
 */
const KEY = 'levelup:after-login';

/** Só caminhos internos do app (nunca URL externa, nunca a própria tela de login). */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/auth');
}

export function rememberAfterLogin(path: string) {
  if (!isSafePath(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* storage indisponível */ }
}

/** Devolve (e apaga) a página guardada; sem página guardada, devolve o fallback. */
export function takeAfterLogin(fallback = '/'): string {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (path && isSafePath(path)) return path;
  } catch { /* storage indisponível */ }
  return fallback;
}
