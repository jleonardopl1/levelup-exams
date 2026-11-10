import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Nivel = 'medio' | 'superior';

export interface TrackRules {
  prova_objetiva?: string;
  aprovacao?: string;
  discursiva?: string;
  titulos?: string;
  desempate?: string;
  cronograma?: { data: string; evento: string }[];
}

export interface StudyTrack {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  organ: string;
  banca: string;
  exam_date: string | null;
  edital_url: string | null;
  description: string | null;
  rules: TrackRules;
}

export interface ExamArea {
  area: string;
  questoes: number;
  pontos_por_questao: number;
  disciplinas: string[];
}

export interface TrackSubject {
  id: string;
  subject_id: string;
  area: string;
  cargo: string | null;
  syllabus: string | null;
  study_tips: string | null;
  weekly_target: number;
  display_order: number;
  subject: { id: string; name: string; icon: string; slug: string | null };
}

export interface TrackModule {
  id: string;
  slug: string;
  name: string;
  nivel: Nivel;
  description: string | null;
  cargos: string[];
  structure: ExamArea[];
  display_order: number;
  subjects: TrackSubject[];
}

export interface SubjectProgress {
  subject_id: string;
  total_questions: number;
  new_this_week: number;
  answered: number;
  correct_latest: number;
  wrong_latest: number;
  attempts_7d: number;
}

export function useStudyTracks() {
  return useQuery({
    queryKey: ['study-tracks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('study_tracks')
        .select('*')
        .order('exam_date', { ascending: true });
      if (error) throw error;
      return data as unknown as StudyTrack[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useStudyTrack(slug: string | undefined) {
  return useQuery({
    queryKey: ['study-track', slug],
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: track, error } = await supabase
        .from('study_tracks')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      if (!track) return null;

      const { data: modules, error: modError } = await supabase
        .from('study_track_modules')
        .select('id, slug, name, nivel, description, cargos, structure, display_order, study_track_subjects(id, subject_id, area, cargo, syllabus, study_tips, weekly_target, display_order, subjects(id, name, icon, slug))')
        .eq('track_id', track.id)
        .order('display_order', { ascending: true });
      if (modError) throw modError;

      type RawSubject = Omit<TrackSubject, 'subject'> & { subjects: TrackSubject['subject'] | null };
      type RawModule = Omit<TrackModule, 'subjects'> & { study_track_subjects: RawSubject[] };

      const parsed: TrackModule[] = ((modules ?? []) as unknown as RawModule[]).map((m) => ({
        ...m,
        structure: (m.structure ?? []) as ExamArea[],
        subjects: (m.study_track_subjects ?? [])
          .filter((s) => s.subjects)
          .map(({ subjects, ...rest }) => ({ ...rest, subject: subjects! }))
          .sort((a, b) => a.display_order - b.display_order),
      }));

      return { track: track as unknown as StudyTrack, modules: parsed };
    },
  });
}

export function useTrackProgress(moduleId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['track-progress', moduleId, user?.id],
    enabled: !!moduleId && !!user,
    // As respostas sao gravadas no servidor durante o quiz: sempre recarregar ao voltar a trilha.
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_track_progress', { p_module_id: moduleId! });
      if (error) throw error;
      const map = new Map<string, SubjectProgress>();
      for (const row of (data ?? []) as SubjectProgress[]) map.set(row.subject_id, row);
      return map;
    },
  });
}

/** Dias inteiros até a data da prova (horário local). */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
