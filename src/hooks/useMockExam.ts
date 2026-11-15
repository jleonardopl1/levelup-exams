import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Simulado Oficial: prova completa no formato do edital (migration 20261115120000). */

export interface MockExamQuestion {
  pos: number;
  question_id: string;
  area: string;
  points: number;
  enunciado: string;
  alternativas: string[];
  subject_id: string;
  selected_index: number | null;
}

export interface MockAreaScore {
  area: string;
  questoes: number;
  acertos: number;
  pontos: number;
  max: number;
}

export interface MockExamResult {
  exam_id: string;
  score: number;
  approved: boolean;
  correct: number;
  total: number;
  areas: MockAreaScore[];
  duration_seconds: number;
  items: {
    pos: number;
    question_id: string;
    area: string;
    selected_index: number | null;
    correct_index: number;
    is_correct: boolean | null;
    explicacao: string | null;
  }[];
}

export type StartMockExamResult =
  | { exam_id: string; deadline: string; resumed: boolean }
  | { error: 'free_quota'; next_free_at: string }
  | { error: string };

export interface MockStanding {
  enough_data: boolean;
  candidates: number;
  needed?: number;
  /** false no Free: só vem above_median. */
  detail?: boolean;
  above_median?: boolean;
  position?: number;
  percentile?: number;
  approved_share?: number;
}

export interface MockExamSummary {
  id: string;
  cargo: string;
  started_at: string;
  deadline: string;
  finished_at: string | null;
  score: number | null;
  approved: boolean | null;
  correct_answers: number | null;
  total_questions: number;
}

const asJson = <T,>(data: unknown) => data as T;

export function useMyMockExams(moduleId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mock-exams', user?.id, moduleId],
    enabled: !!user && !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mock_exams')
        .select('id, cargo, started_at, deadline, finished_at, score, approved, correct_answers, total_questions')
        .eq('module_id', moduleId!)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as MockExamSummary[];
    },
  });
}

/** Linha do simulado (prazo, se já terminou) para retomar uma prova pela URL. */
export function useMockExamMeta(examId: string | undefined) {
  return useQuery({
    queryKey: ['mock-exam-meta', examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mock_exams')
        .select('id, module_id, cargo, started_at, deadline, finished_at, total_questions')
        .eq('id', examId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStartMockExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ moduleId, cargo }: { moduleId: string; cargo: string }) => {
      const { data, error } = await supabase.rpc('start_mock_exam', { p_module_id: moduleId, p_cargo: cargo });
      if (error) throw error;
      return asJson<StartMockExamResult>(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mock-exams'] }),
  });
}

export function useMockExamQuestions(examId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['mock-exam-questions', examId],
    enabled: !!examId && enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_mock_exam', { p_exam_id: examId! });
      if (error) throw error;
      return (data ?? []) as MockExamQuestion[];
    },
  });
}

export async function saveMockAnswer(examId: string, questionId: string, selected: number | null) {
  const { data, error } = await supabase.rpc('save_mock_answer', {
    p_exam_id: examId, p_question_id: questionId, p_selected_index: selected,
  });
  if (error) throw error;
  const res = asJson<{ success?: boolean; error?: string }>(data);
  if (res?.error) throw Object.assign(new Error(res.error), { code: res.error });
  return res;
}

export function useFinishMockExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (examId: string) => {
      const { data, error } = await supabase.rpc('finish_mock_exam', { p_exam_id: examId });
      if (error) throw error;
      const res = asJson<MockExamResult & { error?: string }>(data);
      if (res?.error) throw new Error(res.error);
      return res;
    },
    onSuccess: (res) => {
      qc.setQueryData(['mock-exam-result', res.exam_id], res);
      // Marca como entregue já no cache: a tela de resultado não volta para a prova
      // enquanto a releitura da linha ainda não chegou.
      qc.setQueryData(['mock-exam-meta', res.exam_id], (old: Record<string, unknown> | null | undefined) =>
        old ? { ...old, finished_at: old.finished_at ?? new Date().toISOString() } : old);
      qc.invalidateQueries({ queryKey: ['mock-exam-meta', res.exam_id] });
      qc.invalidateQueries({ queryKey: ['mock-exams'] });
      qc.invalidateQueries({ queryKey: ['track-progress'] });
      qc.invalidateQueries({ queryKey: ['review-queue'] });
    },
  });
}

/** Resultado de um simulado já finalizado (finish_mock_exam é idempotente). */
export function useMockExamResult(examId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['mock-exam-result', examId],
    enabled: !!examId && enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('finish_mock_exam', { p_exam_id: examId! });
      if (error) throw error;
      const res = asJson<MockExamResult & { error?: string }>(data);
      if (res?.error) throw new Error(res.error);
      return res;
    },
  });
}

export function useMockStanding(examId: string | undefined) {
  return useQuery({
    queryKey: ['mock-standing', examId],
    enabled: !!examId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_mock_exam_standing', { p_exam_id: examId! });
      if (error) throw error;
      return asJson<MockStanding & { error?: string }>(data);
    },
  });
}
