/** Traduz erros do Supabase Auth relacionados a senha para mensagens claras em português. */
export function passwordErrorMessage(error: unknown): string {
  const raw = (error as { message?: string; code?: string }) ?? {};
  const msg = (raw.message ?? '').toLowerCase();
  const code = raw.code ?? '';

  if (code === 'same_password' || msg.includes('different from the old')) {
    return 'A nova senha precisa ser diferente da atual.';
  }
  if (code === 'weak_password' || msg.includes('password should') || msg.includes('weak')) {
    return 'Senha fraca: use pelo menos 8 caracteres, misturando letras e números.';
  }
  if (code === 'reauthentication_needed' || msg.includes('reauthentication')) {
    return 'Por segurança, saia e entre novamente antes de trocar a senha.';
  }
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('only request this after')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (msg.includes('session') && (msg.includes('missing') || msg.includes('expired'))) {
    return 'O link expirou ou já foi usado. Solicite um novo e-mail de redefinição.';
  }
  return raw.message || 'Não foi possível concluir. Tente novamente.';
}

/** Regras mínimas de senha usadas em todas as telas (o servidor pode exigir mais). */
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.';
  if (password !== confirm) return 'As senhas não coincidem.';
  return null;
}
