import { useState } from 'react';
import type { TrackModule } from '@/hooks/useStudyTracks';

export function readPref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* armazenamento indisponível */ }
}

/**
 * Nível (módulo) e cargo escolhidos na trilha, lembrados por trilha. A tela da trilha,
 * o Simulado Oficial e a discursiva leem a mesma escolha.
 */
export function useTrackSelection(slug: string | undefined, modules: TrackModule[]) {
  const [moduleSlug, setModuleSlug] = useState<string | null>(() => readPref(`trilha:${slug}:modulo`));
  const [cargo, setCargoState] = useState<string | null>(() => readPref(`trilha:${slug}:cargo`));

  const module = modules.find((m) => m.slug === moduleSlug) ?? modules[0];
  const cargoValid = module && cargo && module.cargos.includes(cargo) ? cargo : module?.cargos[0] ?? null;

  return {
    module,
    cargo: cargoValid,
    setModule: (value: string) => { setModuleSlug(value); writePref(`trilha:${slug}:modulo`, value); },
    setCargo: (value: string) => { setCargoState(value); writePref(`trilha:${slug}:cargo`, value); },
  };
}
