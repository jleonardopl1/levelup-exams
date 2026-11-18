import { useEffect } from 'react';
import { SITE, siteUrl } from '@/config/site';
import { clip, DESCRIPTION_MAX, pageTitle, serializeJsonLd } from '@/lib/seo';

interface SeoOptions {
  /** Título da página (a marca é acrescentada). */
  title: string;
  description: string;
  /** Caminho canônico, ex.: "/faq". */
  path: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SCRIPT_ID = 'page-jsonld';

function upsert(selector: string, create: () => HTMLElement, attr: string, value: string): () => void {
  let el = document.head.querySelector<HTMLElement>(selector);
  const existed = !!el;
  const previous = el?.getAttribute(attr) ?? null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
  return () => {
    if (!existed) el?.remove();
    else if (previous !== null) el?.setAttribute(attr, previous);
  };
}

const meta = (key: 'name' | 'property', id: string) => () => {
  const el = document.createElement('meta');
  el.setAttribute(key, id);
  return el;
};

/**
 * Título, descrição, URL canônica, Open Graph e JSON-LD de uma página pública. Ao sair da
 * página, devolve o <head> como estava (o app é uma SPA).
 */
export function useSeo({ title, description, path, jsonLd }: SeoOptions) {
  const ld = jsonLd ? serializeJsonLd(jsonLd) : null;
  useEffect(() => {
    const fullTitle = pageTitle(title, SITE.name);
    const desc = clip(description, DESCRIPTION_MAX);
    const url = siteUrl(path);
    const previousTitle = document.title;
    document.title = fullTitle;
    const restores = [
      upsert('meta[name="description"]', meta('name', 'description'), 'content', desc),
      upsert('meta[property="og:title"]', meta('property', 'og:title'), 'content', fullTitle),
      upsert('meta[property="og:description"]', meta('property', 'og:description'), 'content', desc),
      upsert('meta[property="og:url"]', meta('property', 'og:url'), 'content', url),
      upsert('link[rel="canonical"]', () => {
        const el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        return el;
      }, 'href', url),
    ];
    let script: HTMLScriptElement | null = null;
    if (ld) {
      document.getElementById(SCRIPT_ID)?.remove();
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.type = 'application/ld+json';
      script.textContent = ld;
      document.head.appendChild(script);
    }
    return () => {
      document.title = previousTitle;
      restores.forEach((r) => r());
      script?.remove();
    };
  }, [title, description, path, ld]);
}
