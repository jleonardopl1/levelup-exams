import { createLovableAuth } from '@lovable.dev/cloud-auth-js';
import type { OAuthProvider as LovableOAuthProvider } from '@lovable.dev/cloud-auth-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Login social gerenciado pelo Lovable Cloud (Google, Apple, Microsoft).
 * O broker `/~oauth/initiate` do domínio publicado faz o OAuth e devolve tokens do
 * Supabase; aqui eles viram a sessão do app. Fora de iframe a página é redirecionada.
 */
const lovableAuth = createLovableAuth();

export type ManagedOAuthProvider = LovableOAuthProvider;

export async function signInWithManagedOAuth(
  provider: ManagedOAuthProvider,
  redirectUri: string = window.location.origin,
): Promise<{ error: Error | null; redirected?: boolean }> {
  const result = await lovableAuth.signInWithOAuth(provider, { redirect_uri: redirectUri });
  if (result.redirected) return { error: null, redirected: true };
  if (result.error) return { error: result.error };
  const { error } = await supabase.auth.setSession(result.tokens);
  return { error: error as Error | null };
}
