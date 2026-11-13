import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type QuestionReportReason =
  | 'gabarito_errado'
  | 'enunciado_confuso'
  | 'desatualizada'
  | 'erro_digitacao'
  | 'outro';

export const REPORT_REASON_LABELS: Record<QuestionReportReason, string> = {
  gabarito_errado: 'Gabarito errado',
  enunciado_confuso: 'Enunciado confuso ou ambíguo',
  desatualizada: 'Desatualizada (lei ou norma mudou)',
  erro_digitacao: 'Erro de digitação',
  outro: 'Outro problema',
};

/** Aluno reporta um problema em uma questão; a equipe trata no painel admin. */
export function useReportQuestion() {
  return useMutation({
    mutationFn: async (input: { questionId: string; reason: QuestionReportReason; details?: string }) => {
      const { data, error } = await supabase.rpc('report_question', {
        p_question_id: input.questionId,
        p_reason: input.reason,
        p_details: input.details?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; duplicate: boolean };
    },
  });
}
