import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, CheckCircle2, ExternalLink, ListChecks, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/Logo';
import { daysUntil, type StudyTrack, type TrackModule } from '@/hooks/useStudyTracks';
import { rememberAfterLogin } from '@/lib/afterLogin';

/** Resumo público da trilha para quem ainda não entrou. Sem questões nem progresso. */
export function TrilhaPublica({ track, modules }: { track: StudyTrack; modules: TrackModule[] }) {
  const navigate = useNavigate();
  const days = daysUntil(track.exam_date);

  useEffect(() => {
    document.title = `${track.short_name} — trilha de estudos | LevelUp Exams`;
  }, [track.short_name]);

  const start = () => {
    rememberAfterLogin(`/trilhas/${track.slug}`);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="px-4 py-3 border-b border-border flex items-center justify-between max-w-3xl mx-auto">
        <Link to="/" aria-label="Página inicial"><Logo /></Link>
        <Button variant="ghost" size="sm" onClick={start}>Entrar</Button>
      </header>

      <main className="px-4 pt-5 max-w-3xl mx-auto space-y-5">
        <div>
          <p className="text-xs text-muted-foreground">{track.banca} · {track.organ}</p>
          <h1 className="font-display font-bold text-2xl leading-tight">{track.name}</h1>
          {track.description && <p className="text-muted-foreground mt-2">{track.description}</p>}
        </div>

        <Card variant="primary">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-primary-foreground/80 text-xs font-medium">
                <CalendarClock className="w-4 h-4" /> Prova
              </div>
              <p className="text-3xl font-bold leading-none mt-1">
                {days === null ? 'Data a definir' : days > 0 ? `${days} dias` : days === 0 ? 'Hoje' : 'Realizada'}
              </p>
              {track.exam_date && (
                <p className="text-xs text-primary-foreground/80 mt-1">{track.exam_date.split('-').reverse().join('/')}</p>
              )}
            </div>
            <Button size="lg" variant="secondary" onClick={start}>Criar conta grátis e começar</Button>
          </CardContent>
        </Card>

        <ul className="space-y-2 text-sm">
          {['Questões no estilo da banca, separadas por matéria do edital',
            'Revisão das questões que você errou no dia certo',
            'Projeção da sua nota pelo peso de cada área da prova'].map((t) => (
            <li key={t} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />{t}</li>
          ))}
        </ul>

        {modules.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <ListChecks className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold">{m.name}</h2>
                {m.cargos?.length > 0 && <Badge variant="outline">{m.cargos.length} cargos</Badge>}
              </div>
              {m.structure.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {m.structure.map((a) => (
                    <div key={a.area} className="rounded-md border border-border p-3">
                      <p className="font-medium text-sm">{a.area}</p>
                      <p className="text-xs text-muted-foreground">{a.questoes} questões · {a.pontos_por_questao.toLocaleString('pt-BR')} ponto(s) cada</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {[...new Map(m.subjects.map((s) => [s.subject_id, s.subject.name])).values()].map((n) => (
                  <Badge key={n} variant="secondary">{n}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <p className="text-sm flex gap-2"><Lock className="w-4 h-4 shrink-0 mt-0.5" />As questões e o seu progresso ficam na sua conta.</p>
            <Button onClick={start}>Começar agora</Button>
          </CardContent>
        </Card>

        {track.edital_url && (
          <a href={track.edital_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
            Ver edital oficial <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </main>
    </div>
  );
}
