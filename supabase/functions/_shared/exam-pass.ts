// Passe Concurso: Plus até a prova da trilha + 15 dias. Mesma trilha e mesmo prazo na Stripe
// (create-checkout) e no Mercado Pago (mp-create-checkout).

// deno-lint-ignore no-explicit-any
type SupabaseClient = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export const EXAM_PASS_EXTRA_DAYS = 15;
/** Prova a mais de 12 meses não tem Passe: ele renderia mais que o Plus anual. */
export const EXAM_PASS_MAX_DAYS_AHEAD = 365;

export interface ExamPassTrack {
  track: { id: string; shortName: string; examDate: string };
  /** Fim do acesso: meia-noite (Cuiabá) do dia da prova + 15 dias. */
  accessUntil: string;
}

/** Próxima trilha ativa com prova ainda por vir (ou a trilha pedida, se for uma delas). */
export async function findExamPassTrack(supabase: SupabaseClient, trackId: unknown, now = Date.now()): Promise<ExamPassTrack | null> {
  const today = new Date(now - 4 * 3600 * 1000).toISOString().slice(0, 10); // Cuiabá
  const horizon = new Date(now - 4 * 3600 * 1000 + EXAM_PASS_MAX_DAYS_AHEAD * 24 * 3600 * 1000).toISOString().slice(0, 10);
  let query = supabase.from("study_tracks").select("id, short_name, exam_date")
    .eq("is_active", true).gte("exam_date", today).lte("exam_date", horizon)
    .order("exam_date", { ascending: true }).limit(1);
  if (typeof trackId === "string" && /^[0-9a-f-]{36}$/i.test(trackId)) query = query.eq("id", trackId);
  const { data: track } = await query.maybeSingle();
  if (!track?.exam_date) return null;

  const until = new Date(`${track.exam_date}T00:00:00-04:00`);
  until.setUTCDate(until.getUTCDate() + EXAM_PASS_EXTRA_DAYS);
  return {
    track: { id: track.id as string, shortName: track.short_name as string, examDate: track.exam_date as string },
    accessUntil: until.toISOString(),
  };
}
