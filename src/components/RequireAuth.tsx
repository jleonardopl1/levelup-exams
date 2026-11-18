import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { rememberAfterLogin } from '@/lib/afterLogin';

/**
 * Exige login para abrir a tela. Quem não tem conta vai para /auth (entrar ou criar conta)
 * e, depois de entrar, volta para a página que tentou abrir.
 */
export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" aria-label="Carregando" />
      </div>
    );
  }
  if (!user) {
    // Guardado antes de redirecionar (gravação idempotente na sessão do navegador).
    rememberAfterLogin(`${location.pathname}${location.search}`);
    return <Navigate to="/auth" replace />;
  }
  return children;
}
