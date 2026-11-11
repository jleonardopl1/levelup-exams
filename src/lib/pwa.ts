import { useEffect, useState } from 'react';

/** Evento do Chrome/Edge/Samsung Internet que permite instalar o app com um toque. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'desktop';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  // Capturado o quanto antes: o navegador dispara uma única vez, logo após carregar.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

/** Pré-visualização do editor Lovable / localhost: sem service worker (evita cache velho). */
function isPreviewHost(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.includes('id-preview--') || h.endsWith('lovableproject.com')
    || h.endsWith('lovableproject-dev.com');
}

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD || isPreviewHost() || isFramed()) {
    // Remove registros antigos em ambientes onde não queremos cache.
    navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister())).catch(() => undefined);
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Já está aberto como app instalado (tela inicial)? */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

/** No iPhone só o Safari instala apps da web; Chrome/Instagram/WhatsApp no iOS não. */
export function isIosNonSafari(): boolean {
  const ua = navigator.userAgent;
  return detectPlatform() === 'ios' && /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(ua);
}

/** Navegadores internos de apps (Instagram, Facebook...) não permitem instalar. */
export function isInAppBrowser(): boolean {
  return /Instagram|FBAN|FBAV|WhatsApp|Line\/|TikTok|Snapchat/i.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(() => deferredPrompt !== null);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && isStandalone());

  useEffect(() => {
    const update = () => {
      setCanPrompt(deferredPrompt !== null);
      if (deferredPrompt === null && isStandalone()) setInstalled(true);
    };
    const onInstalled = () => setInstalled(true);
    listeners.add(update);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      listeners.delete(update);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    const event = deferredPrompt;
    deferredPrompt = null;
    notify();
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    return outcome;
  };

  return { canPrompt, installed, promptInstall };
}
