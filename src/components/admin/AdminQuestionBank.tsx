import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Crown, Flag, Loader2, Pencil, Search, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCategories } from '@/hooks/useQuestions';
import {
  QUESTIONS_PAGE_SIZE, useAdminQuestionList, useUpdateQuestion,
  type AdminQuestionRow, type QuestionFilters,
} from '@/hooks/useAdminConsole';
import { QuestionEditorDialog } from '@/components/admin/QuestionEditorDialog';

const INITIAL: QuestionFilters = {
  search: '', categoria: 'Todas', origem: 'all', status: 'active', premium: 'all', sort: 'recent', page: 0,
};

const SORT_LABELS: Record<QuestionFilters['sort'], string> = {
  recent: 'Mais recentes',
  hardest: 'Maior taxa de erro',
  reported: 'Mais reportadas',
  most_answered: 'Mais respondidas',
};

function AccuracyPill({ q }: { q: AdminQuestionRow }) {
  if (q.attempts === 0) return <span className="text-xs text-muted-foreground">sem respostas</span>;
  const acc = q.accuracy ?? 0;
  // Acerto muito baixo com amostra razoável costuma indicar gabarito errado ou enunciado ambíguo.
  const suspicious = q.attempts >= 5 && acc < 25;
  return (
    <span className={cn(
      'text-xs font-medium tabular-nums',
      suspicious ? 'text-destructive' : acc >= 70 ? 'text-success' : acc >= 40 ? 'text-accent' : 'text-destructive',
    )} title={suspicious ? 'Acerto muito baixo: confira o gabarito' : undefined}>
      {acc}% acerto · {q.attempts} resp.{suspicious ? ' ⚠' : ''}
    </span>
  );
}

export function AdminQuestionBank({ canEditContent, initialStatus }: {
  canEditContent: boolean;
  initialStatus?: QuestionFilters['status'];
}) {
  const [filters, setFilters] = useState<QuestionFilters>({ ...INITIAL, status: initialStatus ?? 'active' });
  const [searchInput, setSearchInput] = useState('');
  const [editing, setEditing] = useState<AdminQuestionRow | null>(null);
  const { data: categories } = useCategories();
  const { data, isLoading, isFetching, isError, error } = useAdminQuestionList(filters);
  const update = useUpdateQuestion();

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 0 })), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const set = <K extends keyof QuestionFilters>(key: K, value: QuestionFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? (value as number) : 0 }));

  const quickToggle = async (q: AdminQuestionRow, field: 'is_premium' | 'is_active') => {
    try {
      await update.mutateAsync({ id: q.id, patch: { [field]: !q[field] } });
      toast.success(field === 'is_active'
        ? (q.is_active ? 'Questão retirada de circulação' : 'Questão de volta aos simulados')
        : (q.is_premium ? 'Questão liberada para todos' : 'Questão agora é exclusiva Plus'));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / QUESTIONS_PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar por enunciado, tópico ou ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            aria-label="Buscar questões"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Select value={filters.categoria} onValueChange={(v) => set('categoria', v)}>
            <SelectTrigger aria-label="Categoria"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(categories ?? ['Todas']).filter((c): c is string => !!c).map((c) => <SelectItem key={c} value={c}>{c === 'Todas' ? 'Todas as categorias' : c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => set('status', v as QuestionFilters['status'])}>
            <SelectTrigger aria-label="Situação"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Em circulação</SelectItem>
              <SelectItem value="inactive">Fora de circulação</SelectItem>
              <SelectItem value="reported">Com reporte aberto</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.origem} onValueChange={(v) => set('origem', v)}>
            <SelectTrigger aria-label="Origem"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              <SelectItem value="autoral">Autorais</SelectItem>
              <SelectItem value="ia_diaria">Geradas por IA</SelectItem>
              <SelectItem value="adaptada">Adaptadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.premium} onValueChange={(v) => set('premium', v as QuestionFilters['premium'])}>
            <SelectTrigger aria-label="Acesso"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Free e Plus</SelectItem>
              <SelectItem value="free">Somente Free</SelectItem>
              <SelectItem value="premium">Somente Plus</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => set('sort', v as QuestionFilters['sort'])}>
            <SelectTrigger aria-label="Ordenar" className="col-span-2 md:col-span-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as QuestionFilters['sort'][]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{isLoading ? 'Carregando...' : `${new Intl.NumberFormat('pt-BR').format(total)} questão(ões)`}</span>
        {isFetching && !isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      </div>

      {isError ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">{(error as Error).message}</CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : data && data.rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma questão encontrada</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {data?.rows.map((q) => (
            <Card key={q.id} className={cn(!q.is_active && 'opacity-70 border-dashed')}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(q)}>
                    <p className="text-sm font-medium line-clamp-2">{q.enunciado}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge variant="secondary" className="text-[11px]">{q.categoria}</Badge>
                      {q.topico && <Badge variant="outline" className="text-[11px] max-w-[12rem] truncate">{q.topico}</Badge>}
                      <Badge variant="outline" className="text-[11px]">{q.dificuldade}</Badge>
                      {q.origem === 'ia_diaria' && <Badge variant="outline" className="text-[11px]">IA</Badge>}
                      {q.is_premium && <Badge className="text-[11px] bg-amber-500/10 text-amber-600 border-amber-500/20"><Crown className="w-3 h-3 mr-0.5" />Plus</Badge>}
                      {!q.is_active && <Badge variant="outline" className="text-[11px]"><EyeOff className="w-3 h-3 mr-0.5" />Fora de circulação</Badge>}
                      {q.open_reports > 0 && <Badge variant="destructive" className="text-[11px]"><Flag className="w-3 h-3 mr-0.5" />{q.open_reports}</Badge>}
                      <AccuracyPill q={q} />
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(q)} aria-label="Editar questão">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title="Exclusiva Plus">
                      <Crown className="w-3 h-3" />
                      <Switch
                        className="scale-75"
                        checked={q.is_premium}
                        onCheckedChange={() => quickToggle(q, 'is_premium')}
                        aria-label="Exclusiva Plus"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground" title="Em circulação">
                      <EyeOff className="w-3 h-3" />
                      <Switch
                        className="scale-75"
                        checked={q.is_active}
                        onCheckedChange={() => quickToggle(q, 'is_active')}
                        aria-label="Em circulação"
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={filters.page === 0} onClick={() => set('page', filters.page - 1)}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{filters.page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={filters.page + 1 >= pages} onClick={() => set('page', filters.page + 1)}>
            Próxima <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <QuestionEditorDialog
        question={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        canEditContent={canEditContent}
      />
    </div>
  );
}
