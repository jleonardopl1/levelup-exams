import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { radarDb, type RadarChange } from '@/hooks/useRadar';
import type { RadarStatus } from '@/lib/radar';

export interface AdminRadarSource {
  id: string;
  name: string;
  url: string;
  kind: string;
  area_id: string | null;
  is_active: boolean;
  check_interval_hours: number;
  last_checked_at: string | null;
  last_changed_at: string | null;
  last_status: string | null;
  consecutive_failures: number;
}

export interface AdminRadarPendingUpdate {
  id: string;
  kind: string;
  severity: 'critica' | 'info';
  title: string;
  summary: string | null;
  changes: RadarChange[];
  evidence_url: string | null;
  review_reason: string | null;
  created_at: string;
  radar_concursos: { slug: string; nome: string; is_published: boolean } | null;
}

export interface AdminRadarConcurso {
  id: string;
  slug: string;
  nome: string;
  orgao: string;
  banca: string | null;
  status: RadarStatus;
  relevance: number;
  link_oficial: string | null;
  track_suggested: boolean;
  track_id: string | null;
}

export interface AdminRadarDraft {
  id: string;
  status: 'pendente_revisao' | 'publicada' | 'rejeitada' | 'falhou';
  warnings: string[];
  error: string | null;
  created_at: string;
  draft: {
    name?: string;
    modules?: { nivel: string; name: string; subjects: { name: string; area: string; weekly_target: number }[] }[];
  };
  radar_concursos: { nome: string; slug: string } | null;
}

export interface AdminRadarRun {
  id: number;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  sources_checked: number;
  sources_changed: number;
  candidates: number;
  updates_published: number;
  updates_pending: number;
  errors: number;
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  for (const key of ['admin-radar-sources', 'admin-radar-pending', 'admin-radar-suggested', 'admin-radar-drafts', 'admin-radar-runs', 'radar-concursos']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
};

export function useAdminRadarSources() {
  return useQuery({
    queryKey: ['admin-radar-sources'],
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_sources')
        .select('id, name, url, kind, area_id, is_active, check_interval_hours, last_checked_at, last_changed_at, last_status, consecutive_failures')
        .order('name');
      if (error) throw error;
      return (data ?? []) as AdminRadarSource[];
    },
  });
}

export function useAdminRadarPending() {
  return useQuery({
    queryKey: ['admin-radar-pending'],
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_updates')
        .select('id, kind, severity, title, summary, changes, evidence_url, review_reason, created_at, radar_concursos(slug, nome, is_published)')
        .eq('review_status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as AdminRadarPendingUpdate[];
    },
  });
}

/** Concursos com edital na rua e sem trilha (candidatos a rascunho de trilha). */
export function useAdminRadarSuggested() {
  return useQuery({
    queryKey: ['admin-radar-suggested'],
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_concursos')
        .select('id, slug, nome, orgao, banca, status, relevance, link_oficial, track_suggested, track_id')
        .is('track_id', null)
        .in('status', ['edital_publicado', 'inscricoes_abertas', 'banca_definida', 'autorizado'])
        .order('track_suggested', { ascending: false })
        .order('relevance', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as AdminRadarConcurso[];
    },
  });
}

export function useAdminRadarDrafts() {
  return useQuery({
    queryKey: ['admin-radar-drafts'],
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_track_drafts')
        .select('id, status, warnings, error, created_at, draft, radar_concursos(nome, slug)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as AdminRadarDraft[];
    },
  });
}

export function useAdminRadarRuns() {
  return useQuery({
    queryKey: ['admin-radar-runs'],
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_runs')
        .select('id, trigger, started_at, finished_at, sources_checked, sources_changed, candidates, updates_published, updates_pending, errors')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AdminRadarRun[];
    },
  });
}

/** Dispara o gerente master agora (todas as fontes vencidas, ou uma fonte específica). */
export function useRunRadar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId?: string) => {
      const { data, error } = await supabase.functions.invoke('radar-concursos', {
        body: { action: 'monitor', ...(sourceId ? { source_id: sourceId } : {}) },
      });
      if (error) throw error;
      return data as { sources_checked: number; sources_changed: number; updates_published: number; updates_pending: number; degraded: string[] };
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useAddRadarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; url: string; kind: string; area_id: string | null; check_interval_hours: number }) => {
      const { error } = await radarDb.from('radar_sources').insert(input);
      if (error) throw error;
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useToggleRadarSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await radarDb.from('radar_sources').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useReviewRadarUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => {
      const { data, error } = await radarDb.rpc('radar_review_update', { p_update_id: id, p_approve: approve, p_reason: reason ?? null });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useGenerateTrackDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ concursoId, editalText }: { concursoId: string; editalText?: string }) => {
      const { data, error } = await supabase.functions.invoke('radar-concursos', {
        body: { action: 'draft_track', concurso_id: concursoId, ...(editalText ? { edital_text: editalText } : {}) },
      });
      if (error) throw error;
      return data as { draft_id: string; status: string; warnings: string[]; error: string | null };
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function usePublishTrackDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { data, error } = await radarDb.rpc('radar_publish_track_draft', { p_draft_id: draftId });
      if (error) throw error;
      return data as string;
    },
    onSettled: () => {
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ['study-tracks'] });
    },
  });
}

export function useRejectTrackDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await radarDb.from('radar_track_drafts').update({ status: 'rejeitada' }).eq('id', draftId);
      if (error) throw error;
    },
    onSettled: () => invalidateAll(qc),
  });
}
