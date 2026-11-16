import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVoice, splitForSpeech } from '@/lib/speech';

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/**
 * Fala um texto com a voz pt-BR do aparelho (Web Speech API). Um texto por vez: falar outro
 * interrompe o anterior. Para sozinho ao desmontar a tela.
 */
export function useSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const runRef = useRef(0);
  const isSupported = supported();

  useEffect(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    // As vozes chegam de forma assíncrona em alguns navegadores (evento voiceschanged).
    const load = () => setVoice(pickVoice(synth.getVoices()));
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      runRef.current += 1;
      synth.cancel();
    };
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    runRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [isSupported]);

  const speak = useCallback((id: string, text: string) => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    const run = ++runRef.current;
    synth.cancel();
    const chunks = splitForSpeech(text);
    if (!chunks.length) return;
    setSpeakingId(id);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = 'pt-BR';
      if (voice) u.voice = voice;
      u.rate = 1;
      if (i === chunks.length - 1) {
        u.onend = () => { if (runRef.current === run) setSpeakingId(null); };
      }
      u.onerror = () => { if (runRef.current === run) setSpeakingId(null); };
      synth.speak(u);
    });
  }, [isSupported, voice]);

  return { isSupported, speakingId, speak, stop };
}
