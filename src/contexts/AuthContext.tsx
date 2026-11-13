import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { SOCIAL_PROVIDERS, type SocialProviderId } from '@/lib/authProviders';
import { clearQuizResult } from '@/lib/quizSession';

type OAuthProvider = SocialProviderId;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Envia o e-mail de redefinição (também serve para contas Google criarem uma senha). */
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  /** Encerra a sessão em todos os dispositivos. */
  signOutEverywhere: () => Promise<{ error: Error | null }>;
}

const PASSWORD_RESET_PATH = '/redefinir-senha';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null | undefined>(undefined);

  // Nunca reaproveitar respostas em cache de outra conta (ex.: dados restritos ao
  // admin master vistos por outro usuário no mesmo navegador após trocar de login).
  // Só limpa quando uma conta logada dá lugar a outra (ou sai). Na abertura do app
  // (sem usuário -> usuário restaurado) NÃO limpa: o clear() destruía as consultas
  // que as telas tinham acabado de iniciar e o início ficava com "Estudante",
  // nível 1 e 0 simulados até o aluno navegar.
  useEffect(() => {
    if (loading) return;
    const current = user?.id ?? null;
    if (lastUserId.current && lastUserId.current !== current) {
      queryClient.clear();
      clearQuizResult();
    }
    lastUserId.current = current;
  }, [user?.id, loading, queryClient]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signInWithOAuth = async (provider: OAuthProvider) => {
    const config = SOCIAL_PROVIDERS.find((p) => p.id === provider);
    if (!config) return { error: new Error('Provedor de login desconhecido') };

    // Google, Apple e Microsoft gerenciados pelo Lovable Cloud passam pelo broker OAuth.
    if (config.via === 'managed') {
      try {
        const result = await lovable.auth.signInWithOAuth(provider as 'microsoft' | 'apple' | 'google', {
          redirect_uri: `${window.location.origin}/`,
          extraParams: config.queryParams,
        });
        if (result.error) {
          return { error: result.error instanceof Error ? result.error : new Error(String(result.error)) };
        }
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: config.supabaseName as Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'],
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: config.queryParams,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = () => signInWithOAuth('google');

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signOutEverywhere = async () => {
    // signOut resolve com { error } (não rejeita) quando o servidor falha: propagar.
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    return { error: error as Error | null };
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${PASSWORD_RESET_PATH}`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, signUp, signIn, signInWithGoogle, signInWithOAuth, signOut,
      requestPasswordReset, updatePassword, signOutEverywhere,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
