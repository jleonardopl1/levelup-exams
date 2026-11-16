import { Link } from 'react-router-dom';
import { CalendarClock, Flame, MapPin, Route, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RadarConcurso } from '@/hooks/useRadar';
import { daysFromToday, ESFERA_LABEL, formatDateBr, formatMoney, STATUS_LABEL, statusTone } from '@/lib/radar';
import { cn } from '@/lib/utils';
import { RadarFollowButton } from './RadarFollowButton';

/** Próximo prazo que importa para o aluno: fim das inscrições ou a prova. */
function nextDeadline(c: RadarConcurso): { label: string; days: number } | null {
  const fim = daysFromToday(c.inscricoes_fim);
  if (fim !== null && fim >= 0 && c.status !== 'inscricoes_encerradas') {
    return { label: fim === 0 ? 'Inscrições terminam hoje' : `Inscrições até ${formatDateBr(c.inscricoes_fim)} (${fim} dias)`, days: fim };
  }
  const prova = daysFromToday(c.data_prova);
  if (prova !== null && prova >= 0) {
    return { label: prova === 0 ? 'Prova hoje' : `Prova em ${formatDateBr(c.data_prova)} (${prova} dias)`, days: prova };
  }
  return null;
}

export function RadarConcursoCard({ concurso: c }: { concurso: RadarConcurso }) {
  const deadline = nextDeadline(c);
  const place = [c.municipio, c.uf].filter(Boolean).join(' · ');
  return (
    // Cartão com link "esticado" no título: o botão Acompanhar não fica dentro do <a>.
    <Card variant="interactive" className="relative">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <Badge variant="outline" className={cn('text-[11px] font-medium', statusTone(c.status))}>
                  {STATUS_LABEL[c.status]}
                </Badge>
                {c.relevance >= 60 && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-orange-500/30 text-orange-600 dark:text-orange-400">
                    <Flame className="w-3 h-3" /> Alta procura
                  </Badge>
                )}
                {c.track_id && (
                  <Badge variant="outline" className="text-[11px] gap-1 border-primary/30 text-primary">
                    <Route className="w-3 h-3" /> Tem trilha
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold leading-tight">
                <Link to={`/radar/${c.slug}`} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  {c.nome}
                </Link>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.orgao}
                {c.banca ? ` · ${c.banca}` : ''}
              </p>
            </div>
            <RadarFollowButton concursoId={c.id} label={c.nome} className="relative z-10" />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(c.esfera || place) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {[c.esfera ? ESFERA_LABEL[c.esfera] : null, place].filter(Boolean).join(' · ')}
              </span>
            )}
            {c.vagas !== null && c.vagas > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {c.vagas.toLocaleString('pt-BR')} vagas
              </span>
            )}
            {c.salario_max !== null && <span>até {formatMoney(c.salario_max)}</span>}
          </div>

          {deadline && (
            <p className={cn('flex items-center gap-1 text-sm font-medium', deadline.days <= 7 ? 'text-destructive' : 'text-primary')}>
              <CalendarClock className="w-4 h-4" /> {deadline.label}
            </p>
          )}
        </CardContent>
    </Card>
  );
}
