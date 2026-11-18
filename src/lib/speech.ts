/**
 * Leitura em voz alta — lógica pura, testada em speech.test.ts.
 *
 * Ideia do VoiceStudio (narrar texto) e do DeepTutor (ler o trecho selecionado), feita com a
 * síntese de voz do próprio navegador (Web Speech API): sem custo de servidor, funciona
 * offline no app instalado e ajuda quem tem baixa visão, dislexia ou estuda no ônibus.
 *
 * O texto de prova tem abreviações que a voz lê mal ("art.", "§", "nº", "8.112/1990");
 * `speakable` as expande antes de ler.
 */

/** Expande abreviações jurídicas e de prova para a voz ler direito. */
export function speakable(text: string): string {
  return text
    // NFC (não NFKC): NFKC transformaria "º" em "o".
    .normalize('NFC')
    .replace(/§§/g, 'parágrafos ')
    .replace(/§\s*/g, 'parágrafo ')
    .replace(/\barts\.\s*/gi, 'artigos ')
    .replace(/\bart\.\s*/gi, 'artigo ')
    .replace(/\bincs?\.\s*/gi, 'inciso ')
    .replace(/\bn\.?\s?[º°]\s*/gi, 'número ')
    // "Lei no 13.709" (nº escrito sem o símbolo) só depois de nome de norma.
    .replace(/\b(Lei|Decreto|Resolução|Portaria|Emenda|Súmula|Edital|Complementar|LC)\s+no\s+(?=\d)/g, '$1 número ')
    .replace(/\bCF\/88\b/g, 'Constituição Federal de 1988')
    .replace(/\bLC\b/g, 'Lei Complementar')
    .replace(/\bCF\b/g, 'Constituição Federal')
    // "8.112/1990" → "8.112 de 1990" (ano de norma; frações como 1/2 ficam como estão).
    .replace(/(\d)\/((?:19|20)\d{2})\b/g, '$1 de $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const LETTERS = 'ABCDEFGHIJ';

/** Garante pausa no fim: mantém "." "?" "!" e troca ":" ";" ou nada por ".". */
const endSentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s.replace(/[:;,]$/, '')}.`);

/** Texto da questão para ler: enunciado e alternativas com a letra de cada uma. */
export function questionSpeechText(enunciado: string, alternativas: readonly string[]): string {
  const stem = endSentence(speakable(enunciado));
  const alts = alternativas
    .map((a, i) => `Alternativa ${LETTERS[i] ?? i + 1}: ${endSentence(speakable(a))}`)
    .join(' ');
  return `${stem} ${alts}`.trim();
}

/**
 * Quebra o texto em trechos curtos, nas pontuações: alguns navegadores (Chrome) param de
 * falar no meio de frases muito longas. Palavra maior que o limite vai inteira.
 */
export function splitForSpeech(text: string, max = 220): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';
  const push = () => { if (current.trim()) chunks.push(current.trim()); current = ''; };
  for (const sentence of sentences) {
    if ((current + sentence).length <= max) {
      current += sentence;
      continue;
    }
    push();
    if (sentence.length <= max) {
      current = sentence;
      continue;
    }
    // Frase longa demais: divide nas vírgulas e, em último caso, nas palavras.
    for (const word of sentence.split(/(?<=,)\s+|\s+/)) {
      if ((current + ' ' + word).trim().length > max) push();
      current = current ? `${current} ${word}` : word;
    }
  }
  push();
  return chunks;
}

export interface VoiceLike {
  lang: string;
  name: string;
  default?: boolean;
  localService?: boolean;
}

/**
 * Voz em português do Brasil: pt-BR exato primeiro (a padrão do sistema na frente), depois
 * qualquer português. Sem voz em português, `null` (o navegador usa a do `lang` da fala).
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const lang = (v: V) => v.lang.replace('_', '-').toLowerCase();
  const br = voices.filter((v) => lang(v) === 'pt-br');
  if (br.length) return br.find((v) => v.default) ?? br[0];
  return voices.find((v) => lang(v).startsWith('pt')) ?? null;
}
