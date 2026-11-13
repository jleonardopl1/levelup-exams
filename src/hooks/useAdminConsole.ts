import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { rpcErrorMessage } from '@/hooks/useAdminUsers';

// ---------------------------------------------------------------------------
// Visão geral da plataforma (admin_platform_overview)
// ---------------------------------------------------------------------------
export interface PlatformOverview {
  generated_at: string;
  users: {
    total: number; plus: number; new_7d: number; new_30d: number;
    active_1d: number; active_7d: number; active_30d: number; banned: number;
  };
  quizzes: {
    total: number; this_week: number; last_week: number; avg_score_30d: number | null;
    weekly: { week: string; quizzes: number; students: number }[];
  };
  signups_daily: { day: string; signups: number; active: number }[];
  answers: { attempts_7d: number; accuracy_30d: number | null };
  top_subjects: { name: string; attempts: number; accuracy: number }[];
  content: {
    questions_active: number; questions_inactive: number; questions_premium: number;
    questions_new_7d: number; reports_open: number;
  };
  health: {
    last_stripe_event_at: string | null; stripe_events_30d: number;
    last_generation_at: string | null; generation_errors_7d: number; generation_inserted_7d: number;
    failed_events_24h: number;
  };
}

export function usePlatformOverview(enabled = true) {
  return useQuery({
    queryKey: ['admin-platform-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_platform_overview');
      if (error) throw new Error(rpcErrorMessage(error));
      return data as unknown as PlatformOverview;
    },
    enabled,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Banco de questões
// ---------------------------------------------------------------------------
export type QuestionStatusFilter = 'active' | 'inactive' | 'reported' | 'all';
export type QuestionSort = 'recent' | 'hardest' | 'reported' | 'most_answered';

export interface AdminQuestionRow {
  id: string;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string | null;
  categoria: string;
  dificuldade: string;
  topico: string | null;
  origem: string;
  nivel: string | null;
  is_premium: boolean;
  is_active: boolean;
  subject_name: string | null;
  created_at: string;
  updated_at: string | null;
  attempts: number;
  correct_count: number;
  accuracy: number | null;
  open_reports: number;
}

export interface QuestionFilters {
  search: string;
  categoria: string;
  origem: string;
  status: QuestionStatusFilter;
  premium: 'all' | 'premium' | 'free';
  sort: QuestionSort;
  page: number;
}

export const QUESTIONS_PAGE_SIZE = 20;

export function useAdminQuestionList(f: QuestionFilters) {
  return useQuery({
    queryKey: ['admin-question-list', f],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_questions', {
        p_search: f.search || undefined,
        p_categoria: f.categoria === 'Todas' ? undefined : f.categoria,
        p_origem: f.origem === 'all' ? undefined : f.origem,
        p_status: f.status,
        p_premium: f.premium === 'all' ? undefined : f.premium === 'premium',
        p_sort: f.sort,
        p_limit: QUESTIONS_PAGE_SIZE,
        p_offset: f.page * QUESTIONS_PAGE_SIZE,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      const d = data as unknown as { total: number; rows: AdminQuestionRow[] };
      return { total: d?.total ?? 0, rows: d?.rows ?? [] };
    },
    placeholderData: keepPreviousData,
  });
}

export type QuestionPatch = Partial<Pick<AdminQuestionRow,
  'enunciado' | 'alternativas' | 'correta' | 'explicacao' | 'categoria' | 'topico' | 'dificuldade' | 'is_premium' | 'is_active'>>;

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: QuestionPatch }) => {
      const { data, error } = await supabase.rpc('admin_update_question', {
        p_question_id: id,
        p_patch: patch as never,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as unknown as { ok: boolean; changed: string[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-question-list'] });
      qc.invalidateQueries({ queryKey: ['admin-question-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-platform-overview'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reportes de questões
// ---------------------------------------------------------------------------
export type ReportStatus = 'open' | 'resolved' | 'dismissed' | 'all';

export interface QuestionReportRow {
  id: string;
  question_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter_name: string | null;
  resolver_name: string | null;
  enunciado: string;
  categoria: string;
  is_active: boolean;
  open_for_question: number;
}

export function useQuestionReports(status: ReportStatus, page = 0, pageSize = 20) {
  return useQuery({
    queryKey: ['admin-question-reports', status, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_question_reports', {
        p_status: status,
        p_limit: pageSize,
        p_offset: page * pageSize,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      const d = data as unknown as { total: number; rows: QuestionReportRow[] };
      return { total: d?.total ?? 0, rows: d?.rows ?? [] };
    },
    placeholderData: keepPreviousData,
  });
}

/** Contador de reportes abertos (badge da aba). */
export function useOpenReportsCount(enabled = true) {
  return useQuery({
    queryKey: ['admin-question-reports', 'open-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_question_reports', { p_status: 'open', p_limit: 1 });
      if (error) return 0;
      return (data as unknown as { total: number })?.total ?? 0;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'resolved' | 'dismissed' | 'open'; note?: string }) => {
      const { data, error } = await supabase.rpc('admin_resolve_question_report', {
        p_report_id: input.id,
        p_status: input.status,
        p_note: input.note?.trim() || undefined,
      });
      if (error) throw new Error(rpcErrorMessage(error));
      return data as unknown as { ok: boolean; updated: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-question-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-question-list'] });
      qc.invalidateQueries({ queryKey: ['admin-platform-overview'] });
    },
  });
}
