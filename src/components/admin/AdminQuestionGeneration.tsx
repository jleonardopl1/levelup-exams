import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface RunRow {
  id: number;
  run_date: string;
  requested: number;
  inserted: number;
  status: string;
  error: string | null;
  created_at: string;
  subjects: { name: string } | null;
}

/** Painel do admin: acompanha e dispara a geração automática diária de questões das trilhas. */
export function AdminQuestionGeneration() {
  const queryClient = useQueryClient();
  const { data: runs, isLoading } = useQuery({
    queryKey: ['admin-generation-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('question_generation_runs')
        .select('id, run_date, requested, inserted, status, error, created_at, subjects(name)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as RunRow[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-track-questions', { body: {} });
      if (error) throw error;
      return data as { processed: { subject: string; inserted: number; status: string }[]; remaining_subjects: number };
    },
    onSuccess: (data) => {
      const inserted = data.processed.reduce((acc, r) => acc + r.inserted, 0);
      toast.success(
        data.processed.length === 0
          ? 'Meta de hoje já cumprida para todas as matérias.'
          : `${inserted} questão(ões) publicada(s). Matérias pendentes: ${data.remaining_subjects}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin-generation-runs'] });
    },
    onError: () => toast.error('Falha ao gerar questões. Verifique os logs da função.'),
  });

  const today = runs?.filter((r) => r.run_date === new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' }));
  const insertedToday = today?.reduce((acc, r) => acc + r.inserted, 0) ?? 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" /> Questões novas das trilhas</p>
            <p className="text-xs text-muted-foreground">
              Geração automática diária (3 por matéria, revisadas por um segundo passe). Hoje: {insertedToday} publicadas.
            </p>
          </div>
          <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar agora'}
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : runs && runs.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {runs.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{r.subjects?.name ?? '—'}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{r.inserted}/{r.requested}</span>
                  <Badge variant={r.status === 'success' ? 'secondary' : r.status === 'error' ? 'destructive' : 'outline'}>{r.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}
