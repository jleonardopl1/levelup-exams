import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { oauthErrorMessage } from '@/lib/authProviders';

/**
 * Ao voltar de um login social com falha, o provedor (Supabase ou broker do Lovable)
 * coloca `error`/`error_description` na URL e o app abria a home sem explicar nada.
 * Aqui o erro vira uma mensagem clara e o usuário volta para a tela de login.
 * A página de redefinição de senha trata os próprios erros.
 */
export function OAuthReturnHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/redefinir-senha') return;
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const error = query.get('error') || hash.get('error');
    if (!error) return;

    const description = query.get('error_description') || hash.get('error_description') || error;
    toast.error(oauthErrorMessage(description));

    ['error', 'error_code', 'error_description', 'state'].forEach((k) => query.delete(k));
    const search = query.toString();
    navigate({ pathname: '/auth', search: search ? `?${search}` : '', hash: '' }, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
