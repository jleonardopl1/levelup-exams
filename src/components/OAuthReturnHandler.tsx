import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { oauthReturnError } from '@/lib/oauth';

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
    const message = oauthReturnError(location.search, location.hash);
    if (!message) return;

    toast.error(message, { id: 'oauth-return-error' });
    // A rota pretendida já está na sessão do navegador. Descarte os parâmetros do provedor.
    navigate('/auth', { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}
