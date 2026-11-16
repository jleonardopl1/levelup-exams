import { useCallback, useState } from 'react';
import { parseEditalState, toggleEditalItem, type EditalField, type EditalState } from '@/lib/edital';
import { readPref, writePref } from '@/lib/trackPrefs';

/**
 * Marcações do edital verticalizado (teoria/revisão por item), guardadas neste aparelho,
 * por trilha e matéria. Não é dado sensível nem decide nada no servidor.
 */
export function useEditalState(trackSlug: string, subjectKey: string) {
  const key = `edital:${trackSlug}:${subjectKey}`;
  const [state, setState] = useState<EditalState>(() => parseEditalState(readPref(key)));

  const toggle = useCallback((id: string, field: EditalField) => {
    setState((prev) => {
      const next = toggleEditalItem(prev, id, field);
      writePref(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  return { state, toggle };
}
