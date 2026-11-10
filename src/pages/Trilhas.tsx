import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarClock, ChevronRight, Map as MapIcon } from 'lucide-react';
import { daysUntil, useStudyTracks } from '@/hooks/useStudyTracks';

export default function Trilhas() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { data: tracks, isLoading } = useStudyTracks();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background pb-10">
      <AppHeader />
      <div className="px-4 pt-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <MapIcon className="w-6 h-6 text-primary" />
          <h1 className="font-display font-bold text-2xl">Trilhas de concursos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Estudo direcionado pelo edital: matérias, pesos, questões no padrão da banca e novas questões toda semana.
        </p>

        {isLoading && <div className="h-28 rounded-2xl bg-muted/50 animate-pulse" />}

        {tracks?.map((t) => {
          const days = daysUntil(t.exam_date);
          return (
            <Link key={t.id} to={`/trilhas/${t.slug}`} className="block">
              <Card variant="interactive">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{t.banca}</p>
                    <h2 className="font-semibold text-lg leading-tight">{t.short_name}</h2>
                    {t.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
                    {days !== null && days >= 0 && (
                      <p className="flex items-center gap-1 text-sm text-primary font-medium mt-2">
                        <CalendarClock className="w-4 h-4" /> {days === 0 ? 'Prova hoje' : `${days} dias para a prova`}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {!isLoading && tracks?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma trilha disponível no momento.</p>
        )}
      </div>
    </div>
  );
}
