import { ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE } from '@/config/site';

interface LegalLayoutProps {
  title: string;
  children: ReactNode;
}

/** Moldura das páginas legais: leitura confortável, cabeçalho com a marca e rodapé. */
export function LegalLayout({ title, children }: LegalLayoutProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | ${SITE.name}`;
    window.scrollTo(0, 0);
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" aria-label={`Ir para a página inicial do ${SITE.name}`}>
            <Logo size="sm" animated={false} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 py-10 legal-content">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Versão vigente desde {SITE.legalUpdatedAt}
          </p>
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Seção numerada com título e conteúdo. */
export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-8 scroll-mt-6">
      <h2 className="font-display text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
