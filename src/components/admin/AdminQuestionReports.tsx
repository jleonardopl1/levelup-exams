import { useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, ChevronLeft, ChevronRight, Flag, Inbox, Loader2, Pencil, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { REPORT_REASON_LABELS, type QuestionReportReason } from '@/hooks/useQuestionReports';
import {
  useQuestionReports, useResolveReport, type AdminQuestionRow, type QuestionReportRow, type ReportStatus,
} from '@/hooks/useAdminConsole';
import { QuestionEditorDialog } from '@/components/admin/QuestionEditorDialog';
import { rpcErrorMessage } from '@/hooks/useAdminUsers';

const PAGE = 20;
const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: 'Abertos' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'dismissed', label: 'Descartados' },
  { value: 'all', label: 'Todos' },
];

export function AdminQuestionReports({ canEditContent }: { canEditContent: boolean }) {
  const [status, setStatus] = useState<ReportStatus>('open');
  const [page, setPage] = useState(0);
  const { data, isLoading, isFetching } = useQuestionReports(status, page, PAGE);
  const resolve = useResolveReport();
  const [closing, setClosing] = useState<{ report: QuestionReportRow; status: 'resolved' | 'dismissed' } | null>(null);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<AdminQuestionRow | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState<string | null>(null);

  const openQuestion = async (questionId: string) => {
    setLoadingQuestion(questionId);
    const { data: res, error } = await supabase.rpc('admin_list_questions', {
      p_search: questionId, p_status: 'all', p_limit: 1,
    });
    setLoadingQuestion(null);
    if (error) return toast.error(rpcErrorMessage(error));
    const row = (res as unknown as { rows: AdminQuestionRow[] })?.rows?.[0];
    if (!row) return toast.error('Questão não encontrada');
    setEditing(row);
  };

  const confirmClose = async () => {
    if (!closing) return;
    try {
      const r = await resolve.mutateAsync({ id: closing.report.id, status: closing.status, note });
      toast.success(closing.status === 'resolved'
        ? `Resolvido${r.updated > 1 ? ` (${r.updated} reportes da mesma questão)` : ''}. Os alunos foram avisados.`
        : 'Reporte descartado');
      setClosing(null);
      setNote('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const reopen = async (report: QuestionReportRow) => {
    try {
      await resolve.mutateAsync({ id: report.id, status: 'open' });
      toast.success('Reporte reaberto');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex rounded-full bg-muted p-0.5 text-xs" role="tablist" aria-label="Situação dos reportes">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={status === t.value}
              onClick={() => { setStatus(t.value); setPage(0); }}
              className={cn('px-3 py-1.5 rounded-full transition-colors', status === t.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          {isFetching && <Loader2 className="w-3 h-3 animate-spin" />} {total} reporte(s)
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {status === 'open' ? 'Nenhum reporte aguardando revisão. 🎉' : 'Nada por aqui.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={r.status === 'open' ? 'destructive' : 'outline'} className="gap-1">
                    <Flag className="w-3 h-3" />
                    {REPORT_REASON_LABELS[r.reason as QuestionReportReason] ?? r.reason}
                  </Badge>
                  <Badge variant="secondary">{r.categoria}</Badge>
                  {r.open_for_question > 1 && r.status === 'open' && (
                    <Badge variant="outline" className="border-destructive/40 text-destructive">{r.open_for_question} alunos reportaram</Badge>
                  )}
                  {!r.is_active && <Badge variant="outline">Fora de circulação</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {r.reporter_name ?? 'Aluno'} · {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm line-clamp-2">{r.enunciado}</p>
                {r.details && (
                  <blockquote className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 italic">“{r.details}”</blockquote>
                )}
                {r.status !== 'open' && (
                  <p className="text-xs text-muted-foreground">
                    {r.status === 'resolved' ? 'Resolvido' : 'Descartado'}
                    {r.resolver_name ? ` por ${r.resolver_name}` : ''}
                    {r.resolved_at ? ` ${formatDistanceToNow(parseISO(r.resolved_at), { addSuffix: true, locale: ptBR })}` : ''}
                    {r.resolution_note ? ` — ${r.resolution_note}` : ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openQuestion(r.question_id)} disabled={loadingQuestion === r.question_id}>
                    {loadingQuestion === r.question_id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Pencil className="w-4 h-4 mr-1.5" />}
                    {canEditContent ? 'Ver e corrigir questão' : 'Ver questão'}
                  </Button>
                  {r.status === 'open' ? (
                    <>
                      <Button size="sm" onClick={() => setClosing({ report: r, status: 'resolved' })}>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" /> Resolver
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setClosing({ report: r, status: 'dismissed' })}>
                        <XCircle className="w-4 h-4 mr-1.5" /> Descartar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => reopen(r)} disabled={resolve.isPending}>
                      <RotateCcw className="w-4 h-4 mr-1.5" /> Reabrir
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-muted-foreground tabular-nums">{page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      <Dialog open={!!closing} onOpenChange={(o) => { if (!o) { setClosing(null); setNote(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{closing?.status === 'resolved' ? 'Resolver reporte' : 'Descartar reporte'}</DialogTitle>
            <DialogDescription>
              {closing?.status === 'resolved'
                ? 'Todos os reportes abertos desta questão serão fechados e os alunos recebem uma notificação de agradecimento (com a observação abaixo, se houver).'
                : 'Use quando a questão está correta. O aluno não é notificado.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={3}
            placeholder={closing?.status === 'resolved' ? 'Ex.: Gabarito corrigido para a alternativa B.' : 'Motivo (interno, opcional)'}
            aria-label="Observação"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setClosing(null); setNote(''); }}>Cancelar</Button>
            <Button onClick={confirmClose} disabled={resolve.isPending}>
              {resolve.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionEditorDialog
        question={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        canEditContent={canEditContent}
      />
    </div>
  );
}
