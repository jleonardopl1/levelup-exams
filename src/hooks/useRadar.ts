import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RadarEsfera, RadarStatus } from '@/lib/radar';

/**
 * As tabelas do Radar (migration 20261117120000_radar_concursos.sql) só entram em
 * src/integrations/supabase/types.ts quando os tipos forem regerados depois de aplicar a
 * migration. Até lá, acesso sem tipos, com as interfaces abaixo como contrato.
 */
export const radarDb = supabase as unknown as SupabaseClient;

export interface RadarArea {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  display_order: number;
}

export interface RadarConcurso {
  id: string;
  slug: string;
  area_id: string | null;
  nome: string;
  orgao: string;
  banca: string | null;
  esfera: RadarEsfera | null;
  uf: string | null;
  municipio: string | null;
  status: RadarStatus;
  cargos: string[];
  vagas: number | null;
  salario_max: number | null;
  escolaridade: string[];
  inscricoes_inicio: string | null;
  inscricoes_fim: string | null;
  data_prova: string | null;
  link_oficial: string | null;
  relevance: number;
  track_id: string | null;
  track_suggested: boolean;
  last_update_at: string;
  study_tracks?: { slug: string } | null;
}

export interface RadarChange {
  campo: string;
  antes: unknown;
  depois: unknown;
  evidencia?: string;
}

export interface RadarUpdate {
  id: string;
  concurso_id: string;
  kind: string;
  severity: 'critica' | 'info';
  title: string;
  summary: string | null;
  changes: RadarChange[];
  evidence_url: string | null;
  created_at: string;
}

export interface RadarFollow {
  id: string;
  concurso_id: string | null;
  area_id: string | null;
}

const CONCURSO_FIELDS =
  'id, slug, area_id, nome, orgao, banca, esfera, uf, municipio, status, cargos, vagas, salario_max, escolaridade, inscricoes_inicio, inscricoes_fim, data_prova, link_oficial, relevance, track_id, track_suggested, last_update_at, study_tracks(slug)';

export function useRadarAreas() {
  return useQuery({
    queryKey: ['radar-areas'],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_areas')
        .select('id, slug, name, description, icon, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RadarArea[];
    },
  });
}

export function useRadarConcursos() {
  return useQuery({
    queryKey: ['radar-concursos'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_concursos')
        .select(CONCURSO_FIELDS)
        .eq('is_published', true)
        .order('relevance', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as RadarConcurso[];
    },
  });
}

export function useRadarConcurso(slug: string | undefined) {
  return useQuery({
    queryKey: ['radar-concurso', slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: concurso, error } = await radarDb
        .from('radar_concursos')
        .select(CONCURSO_FIELDS)
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      if (!concurso) return null;
      const { data: updates, error: updError } = await radarDb
        .from('radar_updates')
        .select('id, concurso_id, kind, severity, title, summary, changes, evidence_url, created_at')
        .eq('concurso_id', (concurso as unknown as RadarConcurso).id)
        .eq('review_status', 'publicada')
        .order('created_at', { ascending: false })
        .limit(50);
      if (updError) throw updError;
      return { concurso: concurso as unknown as RadarConcurso, updates: (updates ?? []) as RadarUpdate[] };
    },
  });
}

/** Concurso do radar ligado a uma trilha (para o cartão "Radar do edital" na trilha). */
export function useTrackRadar(trackId: string | undefined) {
  return useQuery({
    queryKey: ['radar-track', trackId],
    enabled: !!trackId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: concurso, error } = await radarDb
        .from('radar_concursos')
        .select(CONCURSO_FIELDS)
        .eq('track_id', trackId!)
        .eq('is_published', true)
        .order('last_update_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      // Sem a migration aplicada a tabela não existe: o cartão simplesmente não aparece.
      if (error || !concurso) return null;
      const { data: updates } = await radarDb
        .from('radar_updates')
        .select('id, concurso_id, kind, severity, title, summary, changes, evidence_url, created_at')
        .eq('concurso_id', (concurso as unknown as RadarConcurso).id)
        .eq('review_status', 'publicada')
        .order('created_at', { ascending: false })
        .limit(3);
      return { concurso: concurso as unknown as RadarConcurso, updates: (updates ?? []) as RadarUpdate[] };
    },
  });
}

export function useRadarFollows() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['radar-follows', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await radarDb
        .from('radar_follows')
        .select('id, concurso_id, area_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data ?? []) as RadarFollow[];
    },
  });
}

/** Acompanhar/deixar de acompanhar um concurso ou uma área (atualização otimista). */
export function useToggleRadarFollow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['radar-follows', user?.id];
  return useMutation({
    mutationFn: async (target: { concursoId?: string; areaId?: string; follow: boolean }) => {
      if (!user) throw new Error('Entre na sua conta para acompanhar.');
      const column = target.concursoId ? 'concurso_id' : 'area_id';
      const value = target.concursoId ?? target.areaId;
      if (!value) throw new Error('Alvo inválido');
      if (target.follow) {
        const { error } = await radarDb.from('radar_follows').insert({ user_id: user.id, [column]: value });
        // Já acompanhava (clique duplo): não é erro para o aluno.
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await radarDb.from('radar_follows').delete().eq('user_id', user.id).eq(column, value);
        if (error) throw error;
      }
    },
    onMutate: async (target) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<RadarFollow[]>(key);
      const matches = (f: RadarFollow) =>
        target.concursoId ? f.concurso_id === target.concursoId : f.area_id === target.areaId;
      qc.setQueryData<RadarFollow[]>(key, (old = []) =>
        target.follow
          ? [...old, { id: `tmp-${Date.now()}`, concurso_id: target.concursoId ?? null, area_id: target.areaId ?? null }]
          : old.filter((f) => !matches(f)),
      );
      return { previous };
    },
    onError: (_e, _t, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
