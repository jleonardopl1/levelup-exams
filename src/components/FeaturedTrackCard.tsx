import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, ChevronRight, Map as MapIcon } from 'lucide-react';
import { daysUntil, useStudyTracks } from '@/hooks/useStudyTracks';

/** Destaque da próxima trilha de concurso (a de prova mais próxima ainda não realizada). */
export function FeaturedTrackCard() {
  const { data: tracks } = useStudyTracks();
  const next = tracks
    ?.map((t) => ({ t, days: daysUntil(t.exam_date) }))
    .filter((x) => x.days === null || x.days >= 0)
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))[0];
  if (!next) return null;
  const { t, days } = next;

  return (
    <Link to={`/trilhas/${t.slug}`} className="block">
      <Card variant="primary" className="overflow-hidden">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <MapIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary-foreground/80">Trilha do concurso · {t.banca}</p>
            <p className="font-display font-bold text-lg leading-tight">{t.short_name}</p>
            {days !== null && (
              <p className="flex items-center gap-1 text-sm text-primary-foreground/90 mt-1">
                <CalendarClock className="w-4 h-4" /> {days === 0 ? 'Prova hoje' : `${days} dias para a prova`}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
