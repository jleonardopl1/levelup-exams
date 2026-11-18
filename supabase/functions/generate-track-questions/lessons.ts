/**
 * Memória de lições por matéria (tabela public.ai_lessons).
 *
 * Inspirada no "memory log" com reflexão do TradingAgents e no Reflexion (Shinn et al.,
 * 2023): o que o revisor, o árbitro e o portão determinístico reprovam vira uma lição
 * curta, contada por recorrência, que volta ao prompt do elaborador nas próximas
 * rodadas. É memória AUDITÁVEL (a equipe lê e desativa lições no banco), não um vetor
 * escondido — mesma filosofia da memória em camadas do DeepTutor.
 *
 * Tolerante à ordem de publicação: se a migration ainda não foi aplicada, ler devolve
 * lista vazia e gravar só avisa no log.
 */
import type { LessonSource } from "./types.ts";

// deno-lint-ignore no-explicit-any
type Supabase = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const MIN_LEN = 12;
const MAX_LEN = 240;

/** Normaliza o texto de uma lição; `null` se for curto/genérico demais para servir. */
export function normalizeLesson(raw: string): string | null {
  const s = String(raw)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < MIN_LEN) return null;
  if (/^(reprovad[ao]|ok|n[aã]o aprovad[ao])\.?$/i.test(s)) return null;
  // Motivos sobre letras (pré-embaralhamento) não ensinam nada ao elaborador.
  if (/^solucionador cego marcou/i.test(s)) return null;
  return s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s;
}

/** Agrupa por origem, normaliza e remove repetidas — o formato da RPC record_ai_lessons. */
export function groupLessons(items: { source: LessonSource; lesson: string }[]): Map<LessonSource, string[]> {
  const out = new Map<LessonSource, string[]>();
  const seen = new Set<string>();
  for (const it of items) {
    const lesson = normalizeLesson(it.lesson);
    if (!lesson) continue;
    const key = `${it.source}::${lesson.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.set(it.source, [...(out.get(it.source) ?? []), lesson]);
  }
  return out;
}

/** Lições ativas mais recorrentes da matéria, para o prompt do elaborador. */
export async function loadLessons(supabase: Supabase, subjectId: string, limit = 8): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("ai_lessons")
      .select("lesson")
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .order("hits", { ascending: false })
      .order("last_seen", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r: { lesson: unknown }) => (typeof r.lesson === "string" ? normalizeLesson(r.lesson) : null))
      .filter((s: string | null): s is string => !!s);
  } catch {
    return [];
  }
}

/** Grava as lições da rodada (incrementa a recorrência das que já existem). Nunca lança. */
export async function saveLessons(
  supabase: Supabase,
  subjectId: string,
  items: { source: LessonSource; lesson: string }[],
): Promise<void> {
  const grouped = groupLessons(items);
  for (const [source, lessons] of grouped) {
    try {
      const { error } = await supabase.rpc("record_ai_lessons", {
        p_subject_id: subjectId,
        p_source: source,
        p_lessons: lessons.slice(0, 20),
      });
      if (error) {
        console.warn(`lições não gravadas (${source}): ${String(error.message).slice(0, 120)}`);
        return;
      }
    } catch {
      console.warn(`lições não gravadas (${source})`);
      return;
    }
  }
}
