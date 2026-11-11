/* LevelUp Exams — service worker do app instalável (Android/iPhone/desktop).
 *
 * Regras de segurança/atualização:
 * - Só trata GET do próprio domínio. Supabase, Stripe, Google etc. nunca passam por aqui.
 * - Páginas: rede primeiro (sempre a versão publicada mais nova); sem internet, usa a
 *   última cópia salva do app.
 * - /assets/* (arquivos com hash do build): cache primeiro — nunca mudam de conteúdo.
 * - Rotas de login do Lovable (/~oauth/...) e qualquer /~ são ignoradas.
 */
const VERSION = 'v1';
const MAX_ASSETS = 400; // limite de arquivos guardados (publicações antigas saem primeiro)
const SHELL_CACHE = `levelup-shell-${VERSION}`;
const ASSET_CACHE = `levelup-assets-${VERSION}`;
const SHELL_URL = '/';

/** Salva a página inicial e os arquivos principais do build (JS/CSS que ela referencia). */
async function cacheShell() {
  const response = await fetch(SHELL_URL, { cache: 'no-store' });
  if (!response.ok) return;
  const html = await response.clone().text();
  const shell = await caches.open(SHELL_CACHE);
  await shell.put(SHELL_URL, response);
  await shell.addAll(['/manifest.json', '/icon-192.png', '/icon-512.png']).catch(() => undefined);
  const fromHtml = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  // Lista completa gerada no build (vite.config.ts): inclui as telas carregadas sob demanda.
  const listed = await fetch('/asset-manifest.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { files: [] }))
    .then((m) => (Array.isArray(m.files) ? m.files : []))
    .catch(() => []);
  const assets = [...new Set([...fromHtml, ...listed])];
  const assetCache = await caches.open(ASSET_CACHE);
  await Promise.all(assets.map((url) => assetCache.add(url).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('levelup-') && k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => trimAssets())
      .then(() => self.clients.claim()),
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  const excess = keys.length - MAX_ASSETS;
  if (excess > 0) await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/~')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })),
    );
  }
});
