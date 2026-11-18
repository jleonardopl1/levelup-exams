/**
 * SEO das páginas públicas — lógica pura, testada em seo.test.ts.
 *
 * Inspirado no claude-seo (AgriciDaniel): título e descrição por página, URL canônica e
 * dados estruturados schema.org em JSON-LD. Os dados estruturados também ajudam buscadores
 * com IA (ChatGPT, Perplexity, Gemini) a citar a página certa. Regra: o JSON-LD só descreve
 * o que está visível na página (exigência do Google para FAQ).
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Corta no limite sem quebrar palavra, com reticências. */
export function clip(text: string, max: number): string {
  const t = squash(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

/** "Página | LevelUp Exams", sem repetir a marca e dentro do limite de ~60 caracteres. */
export function pageTitle(page: string, siteName: string): string {
  const p = squash(page);
  if (!p || p === siteName) return siteName;
  if (p.includes(siteName)) return clip(p, TITLE_MAX);
  return `${clip(p, TITLE_MAX - siteName.length - 3)} | ${siteName}`;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

type JsonLd = Record<string, unknown>;

export function faqPageJsonLd(items: readonly FaqEntry[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: squash(i.question),
      acceptedAnswer: { '@type': 'Answer', text: squash(i.answer) },
    })),
  };
}

export interface SiteInfo {
  name: string;
  url: string;
  logo: string;
  description: string;
  email?: string;
}

export function organizationJsonLd(site: SiteInfo): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: site.logo,
    description: site.description,
    ...(site.email ? { email: site.email } : {}),
  };
}

/** O app em si: aplicativo web educacional, instalável, com plano gratuito. */
export function webApplicationJsonLd(site: SiteInfo): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: site.name,
    url: site.url,
    description: site.description,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web, Android, iOS',
    inLanguage: 'pt-BR',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', description: 'Plano gratuito' },
  };
}

/**
 * Serializa JSON-LD para dentro de <script>: escapa "<" para o conteúdo nunca fechar a tag
 * (um "</script>" num texto de FAQ viraria injeção de HTML).
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
