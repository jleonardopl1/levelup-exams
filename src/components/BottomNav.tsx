import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Map as MapIcon, Play, Trophy, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { path: '/', icon: Home, label: 'Início' },
  { path: '/trilhas', icon: MapIcon, label: 'Trilhas' },
  { path: '/quiz', icon: Play, label: 'Simulado', primary: true },
  { path: '/ranking', icon: Trophy, label: 'Ranking' },
  { path: '/dashboard', icon: TrendingUp, label: 'Progresso' },
];

/**
 * Navegação inferior para celular e app instalado (PWA): as telas mais usadas
 * ficam a um toque, como num app nativo. Some em telas grandes (lg+), onde a
 * navegação do cabeçalho já aparece.
 */
export function BottomNav() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.classList.add('has-bottom-nav');
    return () => document.body.classList.remove('has-bottom-nav');
  }, []);

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5 h-16">
        {ITEMS.map(({ path, icon: Icon, label, primary }) => {
          const active = isActive(path);
          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {primary ? (
                  <span className="w-10 h-10 -mt-3 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center shadow-lg">
                    <Icon className="w-5 h-5 fill-current" />
                  </span>
                ) : (
                  <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
