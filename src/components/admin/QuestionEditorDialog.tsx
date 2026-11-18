import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpdateQuestion, type AdminQuestionRow, type QuestionPatch } from '@/hooks/useAdminConsole';

interface Props {
  question: AdminQuestionRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Moderadores só alteram Premium/Ativa (regra repetida no banco). */
  canEditContent: boolean;
}

const DIFICULDADES = ['Fácil', 'Médio', 'Difícil'];

export function QuestionEditorDialog({ question, open, onOpenChange, canEditContent }: Props) {
  const update = useUpdateQuestion();
  const [form, setForm] = useState<QuestionPatch>({});

  useEffect(() => {
    if (question) {
      setForm({
        enunciado: question.enunciado,
        alternativas: [...question.alternativas],
        correta: question.correta,
        explicacao: question.explicacao ?? '',
        categoria: question.categoria,
        topico: question.topico ?? '',
        dificuldade: question.dificuldade,
        is_premium: question.is_premium,
        is_active: question.is_active,
      });
    }
  }, [question]);

  if (!question) return null;
  const alts = form.alternativas ?? [];

  const setAlt = (i: number, v: string) =>
    setForm((f) => ({ ...f, alternativas: (f.alternativas ?? []).map((a, j) => (j === i ? v : a)) }));
  const removeAlt = (i: number) =>
    setForm((f) => {
      const next = (f.alternativas ?? []).filter((_, j) => j !== i);
      let correta = f.correta ?? 0;
      if (i === correta) correta = 0;
      else if (i < correta) correta -= 1;
      return { ...f, alternativas: next, correta };
    });

  const diff = (): QuestionPatch => {
    const patch: QuestionPatch = {};
    if (canEditContent) {
      if (form.enunciado?.trim() !== question.enunciado) patch.enunciado = form.enunciado?.trim();
      if (JSON.stringify(alts.map((a) => a.trim())) !== JSON.stringify(question.alternativas)) patch.alternativas = alts.map((a) => a.trim());
      if (form.correta !== question.correta) patch.correta = form.correta;
      if ((form.explicacao ?? '').trim() !== (question.explicacao ?? '')) patch.explicacao = (form.explicacao ?? '').trim();
      if (form.categoria?.trim() !== question.categoria) patch.categoria = form.categoria?.trim();
      if ((form.topico ?? '').trim() !== (question.topico ?? '')) patch.topico = (form.topico ?? '').trim();
      if (form.dificuldade !== question.dificuldade) patch.dificuldade = form.dificuldade;
    }
    if (form.is_premium !== question.is_premium) patch.is_premium = form.is_premium;
    if (form.is_active !== question.is_active) patch.is_active = form.is_active;
    return patch;
  };

  const save = async () => {
    const patch = diff();
    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync({ id: question.id, patch });
      toast.success('Questão atualizada', {
        description: patch.correta !== undefined ? 'O gabarito novo vale a partir da próxima resposta.' : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canEditContent ? 'Editar questão' : 'Curadoria da questão'}</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="secondary">{question.subject_name ?? question.categoria}</Badge>
            <Badge variant="outline">{question.origem === 'ia_diaria' ? 'Gerada por IA' : question.origem}</Badge>
            {question.nivel && <Badge variant="outline">Nível {question.nivel}</Badge>}
            <Badge variant="outline">
              {question.attempts > 0 ? `${question.accuracy}% de acerto em ${question.attempts} respostas` : 'Ainda sem respostas'}
            </Badge>
            {question.open_reports > 0 && (
              <Badge variant="destructive">{question.open_reports} reporte(s) aberto(s)</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-enunciado">Enunciado</Label>
            <Textarea
              id="q-enunciado"
              rows={4}
              value={form.enunciado ?? ''}
              disabled={!canEditContent}
              onChange={(e) => setForm((f) => ({ ...f, enunciado: e.target.value }))}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-1">Alternativas <span className="text-muted-foreground font-normal">(clique na letra para marcar o gabarito)</span></legend>
            {alts.map((alt, i) => {
              const isCorrect = form.correta === i;
              return (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canEditContent}
                    onClick={() => setForm((f) => ({ ...f, correta: i }))}
                    aria-label={`Marcar alternativa ${String.fromCharCode(65 + i)} como correta`}
                    aria-pressed={isCorrect}
                    className={cn(
                      'w-8 h-8 shrink-0 rounded-full text-sm font-bold flex items-center justify-center border-2 transition-colors',
                      isCorrect ? 'bg-success text-success-foreground border-success' : 'border-border text-muted-foreground hover:border-success/60',
                    )}
                  >
                    {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : String.fromCharCode(65 + i)}
                  </button>
                  <Input value={alt} disabled={!canEditContent} onChange={(e) => setAlt(i, e.target.value)} />
                  {canEditContent && alts.length > 2 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAlt(i)} aria-label="Remover alternativa">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {canEditContent && alts.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, alternativas: [...(f.alternativas ?? []), ''] }))}
              >
                <Plus className="w-4 h-4 mr-1" /> Alternativa
              </Button>
            )}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="q-explicacao">Explicação (mostrada após a resposta)</Label>
            <Textarea
              id="q-explicacao"
              rows={3}
              value={form.explicacao ?? ''}
              disabled={!canEditContent}
              onChange={(e) => setForm((f) => ({ ...f, explicacao: e.target.value }))}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-categoria">Categoria</Label>
              <Input id="q-categoria" value={form.categoria ?? ''} disabled={!canEditContent}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-topico">Tópico</Label>
              <Input id="q-topico" value={form.topico ?? ''} disabled={!canEditContent}
                onChange={(e) => setForm((f) => ({ ...f, topico: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Dificuldade</Label>
              <Select value={form.dificuldade} disabled={!canEditContent}
                onValueChange={(v) => setForm((f) => ({ ...f, dificuldade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(DIFICULDADES.includes(question.dificuldade) ? DIFICULDADES : [question.dificuldade, ...DIFICULDADES]).map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 rounded-lg border p-3">
            <label className="flex items-center gap-3 flex-1 cursor-pointer">
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <span className="text-sm">
                <span className="font-medium">Em circulação</span>
                <span className="block text-xs text-muted-foreground">Desligada, sai dos simulados e trilhas (histórico mantido)</span>
              </span>
            </label>
            <label className="flex items-center gap-3 flex-1 cursor-pointer">
              <Switch checked={!!form.is_premium} onCheckedChange={(v) => setForm((f) => ({ ...f, is_premium: v }))} />
              <span className="text-sm">
                <span className="font-medium">Exclusiva Plus</span>
                <span className="block text-xs text-muted-foreground">Visível só para assinantes</span>
              </span>
            </label>
          </div>

          {!canEditContent && (
            <p className="text-xs text-muted-foreground">
              Como moderador, você altera apenas circulação e Premium. Para corrigir conteúdo ou gabarito, peça a um administrador.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
