import { Link } from 'react-router-dom';
import { SITE } from '@/config/site';

/** Rodapé institucional: identifica o serviço e leva às páginas legais e de ajuda. */
export function SiteFooter({ className = '' }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={`border-t border-border/60 ${className}`}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          © {year} {SITE.name}. Todos os direitos reservados.
        </p>
        <nav aria-label="Links institucionais" className="flex items-center gap-4">
          <Link to="/privacidade" className="hover:text-foreground transition-colors">
            Privacidade
          </Link>
          <Link to="/termos" className="hover:text-foreground transition-colors">
            Termos de Uso
          </Link>
          <Link to="/faq" className="hover:text-foreground transition-colors">
            Ajuda
          </Link>
          <a href={`mailto:${SITE.contactEmail}`} className="hover:text-foreground transition-colors">
            Contato
          </a>
        </nav>
      </div>
    </footer>
  );
}
