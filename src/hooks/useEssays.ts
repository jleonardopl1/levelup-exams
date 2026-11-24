import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseErrorBody } from '@/lib/errorBody';

/** Correção da discursiva (Edge Function essay-review + migration 20261115130000). */

export interface EssayCriterion { key: string; nome: string; max: number; nota: number; comentario: string }
export interface EssayError { trecho: string; tipo: string; correcao: string }
export interface EssayFeedback {
  versao: number;
  conteudo: { nota: number; max: number; criterios: EssayCriterion[] };
  formal: { nota: number; max: number; desconto_por_erro: number; erros: EssayError[] };
  aspectos_ausentes: string[];
  pontos_fortes: string[];
  melhorias: string[];
  reescrita: { original: string; sugerida: string } | null;
  linhas?: { estimadas: number; minimo: number; maximo: number; aviso: string | null };
}

export interface EssaySubmission {
  id: string;
  cargo: string;
  tema: string;
  texto: string;
  line_count: number;
  status: 'pending' | 'done' | 'error';
  score: number | null;
  feedback: EssayFeedback | null;
  created_at: string;
}

export interface EssayQuota { plus: boolean; limit: number; used: number; remaining: number; next_slot_at: string | null }

/** Mesma conta do servidor: cada parágrafo começa numa linha nova, ~75 caracteres por linha. */
export function estimateLines(text: string): number {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => acc + Math.max(1, Math.ceil(p.length / 75)), 0);
}

async function invokeEssay<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('essay-review', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const payload = parseErrorBody(await ctx?.json?.().catch(() => null));
    throw new Error(payload.error || 'Não foi possível falar com o corretor. Tente de novo.');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useEssayQuota() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['essay-quota', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_essay_quota');
      if (error) throw error;
      return data as unknown as EssayQuota;
    },
  });
}

export function useMyEssays() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['essays', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('essay_submissions')
        .select('id, cargo, tema, texto, line_count, status, score, feedback, created_at')
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as EssaySubmission[];
    },
  });
}

export function useEssayTheme() {
  return useMutation({
    mutationFn: (input: { moduleId: string; cargo: string }) =>
      invokeEssay<{ tema: string; orientacoes: string[] }>({ action: 'theme', module_id: input.moduleId, cargo: input.cargo }),
  });
}

export function useSubmitEssay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { moduleId: string; cargo: string; tema: string; texto: string }) =>
      invokeEssay<{ id: string; score: number; line_count: number; feedback: EssayFeedback }>({
        action: 'review', module_id: input.moduleId, cargo: input.cargo, tema: input.tema, texto: input.texto,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['essay-quota'] });
      qc.invalidateQueries({ queryKey: ['essays'] });
    },
  });
}
