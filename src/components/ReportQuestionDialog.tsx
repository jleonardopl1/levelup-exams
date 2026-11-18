import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  REPORT_REASON_LABELS, useReportQuestion, type QuestionReportReason,
} from '@/hooks/useQuestionReports';

interface ReportQuestionDialogProps {
  questionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportQuestionDialog({ questionId, open, onOpenChange }: ReportQuestionDialogProps) {
  const [reason, setReason] = useState<QuestionReportReason>('gabarito_errado');
  const [details, setDetails] = useState('');
  const report = useReportQuestion();

  const close = (next: boolean) => {
    if (!next) {
      setReason('gabarito_errado');
      setDetails('');
    }
    onOpenChange(next);
  };

  const submit = async () => {
    if (!questionId) return;
    try {
      const res = await report.mutateAsync({ questionId, reason, details });
      toast.success(res.duplicate ? 'Você já reportou esta questão' : 'Obrigado! A equipe vai revisar esta questão.', {
        description: res.duplicate ? 'Avisaremos quando ela for revisada.' : 'Você recebe uma notificação quando ela for corrigida.',
      });
      close(false);
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível enviar o reporte.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar problema na questão</DialogTitle>
          <DialogDescription>
            Encontrou algo errado? Conte o que aconteceu e a equipe revisa a questão.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={(v) => setReason(v as QuestionReportReason)} className="space-y-1">
          {(Object.keys(REPORT_REASON_LABELS) as QuestionReportReason[]).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <RadioGroupItem value={key} id={`reason-${key}`} />
              <Label htmlFor={`reason-${key}`} className="font-normal cursor-pointer">{REPORT_REASON_LABELS[key]}</Label>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="report-details">Detalhes (opcional)</Label>
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
            placeholder="Ex.: a alternativa C também está correta segundo o art. 37 da CF."
            rows={3}
          />
          <p className="text-xs text-muted-foreground text-right">{details.length}/1000</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => close(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={report.isPending || !questionId}>
            {report.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
