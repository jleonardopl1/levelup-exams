import { Link } from 'react-router-dom';
import { BookOpenCheck, Route as RouteIcon, Trophy, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE, siteUrl } from '@/config/site';
import { useSeo } from '@/hooks/useSeo';
import { organizationJsonLd, webApplicationJsonLd } from '@/lib/seo';

const ABOUT_DESCRIPTION =
  'Plataforma gamificada de estudos para concursos públicos: trilhas por edital, simulados no formato da banca, revisão espaçada dos erros e Mentor com IA.';

const ABOUT_JSONLD = [
  organizationJsonLd({
    name: SITE.name,
    url: siteUrl('/'),
    logo: siteUrl('/icon-512.png'),
    description: ABOUT_DESCRIPTION,
    email: SITE.contactEmail,
  }),
  webApplicationJsonLd({ name: SITE.name, url: siteUrl('/'), logo: siteUrl('/icon-512.png'), description: ABOUT_DESCRIPTION }),
];

const FEATURES = [
  {
    icon: BookOpenCheck,
    title: 'Simulados por concurso',
    text: 'Questões organizadas por área e matéria, com correção na hora e explicação de cada alternativa.',
  },
  {
    icon: RouteIcon,
    title: 'Trilhas de estudo',
    text: 'Um caminho de módulos guiado pelo edital, para saber exatamente o que estudar a seguir.',
  },
  {
    icon: Trophy,
    title: 'Ranking e conquistas',
    text: 'Pontos, sequência de dias e medalhas que transformam a rotina de estudo em hábito.',
  },
  {
    icon: Sparkles,
    title: 'Mentor IA',
    text: 'Tire dúvidas de conteúdo a qualquer hora com um mentor de inteligência artificial.',
  },
];

/**
 * Página pública de apresentação. É a "página inicial do aplicativo" informada ao
 * Google na tela de consentimento OAuth: precisa ser acessível sem login, mostrar o
 * nome exato "LevelUp Exams", explicar o propósito do app e ligar à Política de Privacidade.
 */
export default function About() {
  useSeo({
    title: `${SITE.name} — Estudos gamificados para concursos públicos`,
    description: ABOUT_DESCRIPTION,
    path: '/sobre',
    jsonLd: ABOUT_JSONLD,
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center">
          <div className="flex justify-center mb-6">
            <Logo size="xl" showText={false} />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground">{SITE.name}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Plataforma gamificada de estudos para concursos públicos. Pratique com simulados, siga trilhas guiadas pelo
            edital e acompanhe sua evolução.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth">Começar grátis</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/faq">Dúvidas frequentes</Link>
            </Button>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 pb-16 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card p-5 text-left">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
