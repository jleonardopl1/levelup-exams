import { Link } from 'react-router-dom';
import { ChevronRight, Radar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTrackRadar } from '@/hooks/useRadar';
import { formatDateBr, STATUS_LABEL, statusTone } from '@/lib/radar';
import { cn } from '@/lib/utils';
import { RadarFollowButton } from './RadarFollowButton';

/** "Radar do edital" na página da trilha: fase atual, última novidade e botão Acompanhar. */
export function TrackRadarCard({ trackId }: { trackId: string | undefined }) {
  const { data } = useTrackRadar(trackId);
  if (!data) return null;
  const { concurso: c, updates } = data;
  const last = updates[0];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Radar className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Radar do edital</p>
              <Badge variant="outline" className={cn('text-[11px]', statusTone(c.status))}>{STATUS_LABEL[c.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {last ? last.title : 'Monitoramos o edital: retificações e mudanças de data chegam como aviso.'}
            </p>
            {!last && c.data_prova && <p className="text-xs text-muted-foreground mt-1">Prova: {formatDateBr(c.data_prova)}</p>}
          </div>
          <RadarFollowButton concursoId={c.id} label={c.nome} />
        </div>
        <Link to={`/radar/${c.slug}`} className="flex items-center justify-end gap-1 text-sm text-primary hover:underline">
          Ver atualizações do concurso <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
