/**
 * Edital verticalizado — lógica pura, testada em edital.test.ts.
 *
 * Quebra o conteúdo programático do edital ("1. Leitura... 2. Pontuação...") em itens e
 * guarda, por item, se o aluno já estudou a teoria e se já revisou. É a técnica que o
 * concurseiro faz à mão numa planilha; a ideia de status por tópico vem dos roadmaps do
 * roadmap.sh (developer-roadmap), onde cada nó tem "estudando/feito".
 */

export interface EditalItem {
  /** Estável enquanto o texto do item não muda (hash do texto normalizado). */
  id: string;
  /** Número do item no edital (null quando o edital não numera). */
  number: number | null;
  text: string;
}

export type EditalField = 'teoria' | 'revisao';

export type EditalState = Record<string, Partial<Record<EditalField, boolean>>>;

const MAX_ITEMS = 60;

/** FNV-1a 32 bits em base 36: curto, determinístico e sem dependências. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim();

const cleanItem = (s: string) => {
  const t = normalize(s).replace(/^[;,.\s]+/, '').replace(/[;\s]+$/, '');
  // Itens vindos de "a; b; c" começam em minúscula: só a exibição muda (o id usa minúsculas).
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
};

function toItems(parts: { number: number | null; text: string }[]): EditalItem[] {
  const seen = new Set<string>();
  const out: EditalItem[] = [];
  for (const p of parts) {
    const text = cleanItem(p.text);
    if (text.length < 2) continue;
    let id = hashText(text.toLowerCase());
    // Itens repetidos no mesmo edital: o segundo ganha sufixo para não dividir o estado.
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    out.push({ id, number: p.number, text });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Itens do conteúdo programático. Aceita a numeração "1. … 2. …" (só divide quando o número
 * é o próximo da sequência, então "art. 5. Direitos" ou "Windows 10" não quebram o item).
 * Sem numeração, divide por ";" ou por linha; se nada disso existir, o texto vira um item.
 */
export function parseSyllabus(raw: string | null | undefined): EditalItem[] {
  const text = normalize(raw ?? '');
  if (!text) return [];

  const marker = /(^|\s)(\d{1,2})\s?[.)-]\s+(?=\S)/g;
  const cuts: { number: number; start: number; contentStart: number }[] = [];
  let expected = 1;
  for (let m = marker.exec(text); m; m = marker.exec(text)) {
    const n = Number(m[2]);
    if (n !== expected) continue;
    cuts.push({ number: n, start: m.index + m[1].length, contentStart: m.index + m[0].length });
    expected += 1;
  }
  if (cuts.length >= 2) {
    const parts = cuts.map((c, i) => ({
      number: c.number,
      text: text.slice(c.contentStart, i + 1 < cuts.length ? cuts[i + 1].start : text.length),
    }));
    const preamble = text.slice(0, cuts[0].start);
    return toItems(preamble.trim().length > 3 ? [{ number: null, text: preamble }, ...parts] : parts);
  }

  const lines = (raw ?? '').split(/\r?\n/).map(normalize).filter(Boolean);
  if (lines.length >= 2) return toItems(lines.map((l) => ({ number: null, text: l.replace(/^[-•*]\s*/, '') })));

  const bySemicolon = text.split(/;\s+/);
  if (bySemicolon.length >= 2) return toItems(bySemicolon.map((t) => ({ number: null, text: t })));

  return toItems([{ number: null, text }]);
}

/** Alterna um campo de um item (imutável). Item sem nenhum campo marcado sai do estado. */
export function toggleEditalItem(state: EditalState, id: string, field: EditalField): EditalState {
  const current = { ...(state[id] ?? {}) };
  if (current[field]) delete current[field];
  else current[field] = true;
  const next = { ...state };
  if (Object.keys(current).length === 0) delete next[id];
  else next[id] = current;
  return next;
}

export interface EditalProgress {
  total: number;
  teoria: number;
  revisao: number;
}

/** Quantos itens do edital ATUAL já têm teoria e revisão (ignora itens que saíram do edital). */
export function editalProgress(items: readonly EditalItem[], state: EditalState): EditalProgress {
  let teoria = 0;
  let revisao = 0;
  for (const item of items) {
    if (state[item.id]?.teoria) teoria += 1;
    if (state[item.id]?.revisao) revisao += 1;
  }
  return { total: items.length, teoria, revisao };
}

/** Lê o estado salvo; qualquer coisa fora do formato vira estado vazio. */
export function parseEditalState(raw: string | null): EditalState {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: EditalState = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object' || id.length > 40) continue;
      const v = value as Record<string, unknown>;
      const entry: Partial<Record<EditalField, boolean>> = {};
      if (v.teoria === true) entry.teoria = true;
      if (v.revisao === true) entry.revisao = true;
      if (Object.keys(entry).length) out[id] = entry;
    }
    return out;
  } catch {
    return {};
  }
}
