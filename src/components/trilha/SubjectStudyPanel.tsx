import { useMemo } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { BarChart3, ClipboardList, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MASTERY_LABEL, type MasteryLevel, type SubjectMastery } from '@/lib/mastery';
import { editalProgress, parseSyllabus } from '@/lib/edital';
import { useEditalState } from '@/hooks/useEditalState';
import type { TrackSubject } from '@/hooks/useStudyTracks';

const LEVEL_TEXT: Record<MasteryLevel, string> = {
  fragil: 'text-destructive',
  construcao: 'text-warning',
  quase: 'text-primary',
  dominado: 'text-success',
};

const MAX_TOPICS = 6;

/** Rótulo curto do domínio da matéria (para o cabeçalho do cartão). */
export function MasteryTag({ mastery }: { mastery?: SubjectMastery }) {
  if (!mastery?.level || mastery.mastery === null) return null;
  return (
    <span className={cn('font-medium', LEVEL_TEXT[mastery.level])}>
      {` · domínio: ${MASTERY_LABEL[mastery.level].toLowerCase()}`}
    </span>
  );
}

interface Props {
  trackSlug: string;
  subject: TrackSubject;
  mastery?: SubjectMastery;
}

/**
 * Detalhe de estudo de uma matéria da trilha: domínio por tópico (das questões que o aluno
 * respondeu), edital verticalizado (teoria/revisão por item) e como a banca cobra.
 */
export function SubjectStudyPanel({ trackSlug, subject, mastery }: Props) {
  const items = useMemo(() => parseSyllabus(subject.syllabus), [subject.syllabus]);
  const { state, toggle } = useEditalState(trackSlug, subject.subject.slug ?? subject.subject_id);
  const progress = editalProgress(items, state);
  const topics = mastery?.topics ?? [];

  if (!items.length && !subject.study_tips && !topics.length) return null;

  return (
    <Accordion type="multiple">
      {topics.length > 0 && (
        <AccordionItem value="dominio" className="border-b-0">
          <AccordionTrigger className="py-1 text-sm text-primary hover:no-underline">
            <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Domínio por tópico</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <ul className="space-y-2">
              {topics.slice(0, MAX_TOPICS).map((t) => (
                <li key={t.topic} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{t.topic}</span>
                    <span className={cn('text-xs font-medium shrink-0', LEVEL_TEXT[t.level])}>
                      {MASTERY_LABEL[t.level]}
                      {t.lastWrong ? ' · errou a última' : ''}
                    </span>
                  </div>
                  <Progress
                    value={Math.round(t.mastery * 100)}
                    size="sm"
                    aria-label={`Domínio em ${t.topic}: ${Math.round(t.mastery * 100)}%, ${t.evidence} resposta(s)`}
                  />
                </li>
              ))}
            </ul>
            {topics.length > MAX_TOPICS && (
              <p className="text-xs text-muted-foreground">
                Mostrando os {MAX_TOPICS} tópicos mais frágeis de {topics.length}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Conta suas 5 últimas respostas de cada tópico, com mais peso para as recentes. Com 1 ou 2 respostas o
              domínio fica limitado a 50% e 80%, e repetir a mesma questão logo depois de ver a explicação não conta.
            </p>
          </AccordionContent>
        </AccordionItem>
      )}

      {items.length > 0 && (
        <AccordionItem value="edital" className="border-b-0">
          <AccordionTrigger className="py-1 text-sm text-primary hover:no-underline">
            <span className="flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" /> Edital verticalizado
              <span className="text-xs font-normal text-muted-foreground">
                ({progress.teoria}/{progress.total} com teoria)
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Marque cada item do conteúdo do edital quando estudar a teoria e quando revisar. Fica salvo neste aparelho.
            </p>
            <Progress
              value={progress.total ? Math.round((progress.teoria / progress.total) * 100) : 0}
              size="sm"
              variant="gradient"
              aria-label={`Teoria estudada em ${progress.teoria} de ${progress.total} itens`}
            />
            <ol className="space-y-2">
              {items.map((item) => {
                const done = state[item.id] ?? {};
                const tId = `ed-${subject.id}-${item.id}-t`;
                const rId = `ed-${subject.id}-${item.id}-r`;
                return (
                  <li key={item.id} className="rounded-lg border border-border/60 p-2.5 space-y-2">
                    <p className={cn('leading-snug', done.teoria && done.revisao && 'text-muted-foreground')}>
                      {item.number !== null && <span className="font-mono text-xs text-muted-foreground mr-1.5">{item.number}.</span>}
                      {item.text}
                    </p>
                    <div className="flex gap-4 text-xs">
                      <label htmlFor={tId} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox id={tId} checked={!!done.teoria} onCheckedChange={() => toggle(item.id, 'teoria')} />
                        Teoria
                      </label>
                      <label htmlFor={rId} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox id={rId} checked={!!done.revisao} onCheckedChange={() => toggle(item.id, 'revisao')} />
                        Revisão
                      </label>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs text-muted-foreground">
              Revisados: {progress.revisao} de {progress.total}.
            </p>
          </AccordionContent>
        </AccordionItem>
      )}

      {subject.study_tips && (
        <AccordionItem value="dicas" className="border-b-0">
          <AccordionTrigger className="py-1 text-sm text-primary hover:no-underline">
            <span className="flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> Como a banca cobra</span>
          </AccordionTrigger>
          <AccordionContent className="text-sm">
            <p className="rounded-lg bg-primary/5 border border-primary/15 p-3">{subject.study_tips}</p>
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
}
