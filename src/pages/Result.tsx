import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Trophy, Target, Clock, Home, RotateCcw, Star, Zap, CheckCircle2, XCircle, MinusCircle,
  Bot, Flag, ChevronDown, AlertTriangle, BookOpenCheck,
} from 'lucide-react';
import { Confetti, CelebrationGlow } from '@/components/Confetti';
import { ReportQuestionDialog } from '@/components/ReportQuestionDialog';
import { cn } from '@/lib/utils';
import { buildMentorPrompt, loadQuizResult, type QuizResultState, type QuizReviewItem } from '@/lib/quizSession';

type ReviewFilter = 'wrong' | 'all';

function ReviewCard({ item, index, onReport, onMentor }: {
  item: QuizReviewItem;
  index: number;
  onReport: () => void;
  onMentor: () => void;
}) {
  const [open, setOpen] = useState(!item.correct);
  const status = item.selected === null ? 'skipped' : item.correct ? 'correct' : 'wrong';
  const StatusIcon = status === 'correct' ? CheckCircle2 : status === 'wrong' ? XCircle : MinusCircle;

  return (
    <Card className={cn(
      'overflow-hidden border-l-4',
      status === 'correct' ? 'border-l-success' : status === 'wrong' ? 'border-l-destructive' : 'border-l-muted-foreground/40',
    )}>
      <button
        className="w-full flex items-start gap-3 p-4 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <StatusIcon className={cn(
          'w-5 h-5 shrink-0 mt-0.5',
          status === 'correct' ? 'text-success' : status === 'wrong' ? 'text-destructive' : 'text-muted-foreground',
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">
            Questão {index + 1} · {item.categoria}{item.topico ? ` · ${item.topico}` : ''}
          </p>
          <p className={cn('text-sm font-medium', !open && 'line-clamp-2')}>{item.enunciado}</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 shrink-0 mt-1 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <CardContent className="pt-0 pb-4 space-y-3">
          <ul className="space-y-1.5">
            {item.alternativas.map((alt, i) => {
              const isCorrect = i === item.correctIndex;
              const isMine = i === item.selected;
              return (
                <li
                  key={i}
                  className={cn(
                    'flex gap-2 text-sm rounded-lg px-3 py-2 border',
                    isCorrect ? 'border-success/40 bg-success/10'
                      : isMine ? 'border-destructive/40 bg-destructive/10'
                      : 'border-transparent bg-muted/40',
                  )}
                >
                  <span className="font-bold w-4 shrink-0">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1">{alt}</span>
                  {isCorrect && <Badge variant="outline" className="h-5 text-[10px] border-success/50 text-success">Gabarito</Badge>}
                  {isMine && !isCorrect && <Badge variant="outline" className="h-5 text-[10px] border-destructive/50 text-destructive">Sua resposta</Badge>}
                </li>
              );
            })}
          </ul>

          {item.selected === null && (
            <p className="text-xs text-muted-foreground">Não respondida — o gabarito aparece quando você responde a questão.</p>
          )}

          {item.explicacao && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <p className="text-xs font-semibold text-primary mb-1">Explicação</p>
              <p className="text-sm text-muted-foreground">{item.explicacao}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!item.correct && item.selected !== null && (
              <Button size="sm" variant="outline" onClick={onMentor}>
                <Bot className="w-4 h-4 mr-1.5" /> Explicar com o Mentor IA
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onReport}>
              <Flag className="w-4 h-4 mr-1.5" /> Reportar erro
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const data: QuizResultState | null = useMemo(() => {
    const fromNav = location.state as QuizResultState | null;
    if (fromNav && (!fromNav.userId || fromNav.userId === user?.id)) return fromNav;
    return loadQuizResult(user?.id);
  }, [location.state, user?.id]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('wrong');
  const [reportId, setReportId] = useState<string | null>(null);

  const score = data?.score ?? 0;
  useEffect(() => {
    if (location.state && score >= 80) {
      setShowConfetti(true);
      setShowGlow(true);
    }
  }, [score, location.state]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <BookOpenCheck className="w-12 h-12 text-primary" />
        <p className="font-semibold text-lg">Nenhum resultado recente</p>
        <p className="text-sm text-muted-foreground">Faça um simulado para ver seu desempenho aqui.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>Início</Button>
          <Button onClick={() => navigate('/quiz')}>Iniciar simulado</Button>
        </div>
      </div>
    );
  }

  const { correct, total, timeSpent, pointsEarned, timedOut, saved, review = [] } = data;
  const safeBack = typeof data.backPath === 'string' && data.backPath.startsWith('/') && !data.backPath.startsWith('//') ? data.backPath : '/';
  const safeRetry = typeof data.retry === 'string' && data.retry.startsWith('/quiz') ? data.retry : '/quiz';

  // Na trilha, "Revisar erros" reabre a mesma matéria no modo revisão.
  const reviewMistakesPath = (() => {
    if (!safeRetry.includes('subject=')) return null;
    const url = new URL(safeRetry, window.location.origin);
    url.searchParams.set('mode', 'review');
    return `${url.pathname}${url.search}`;
  })();

  const wrong = review.filter((r) => !r.correct);
  const skipped = review.filter((r) => r.selected === null).length;
  const shown = filter === 'wrong' ? wrong : review;

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  const message = score >= 80
    ? { text: 'Excelente!', emoji: '🎉', color: 'text-accent' }
    : score >= 60 ? { text: 'Muito bem!', emoji: '👏', color: 'text-success' }
    : score >= 40 ? { text: 'Continue praticando!', emoji: '💪', color: 'text-primary' }
    : { text: 'Não desista!', emoji: '📚', color: 'text-muted-foreground' };

  // Por matéria (simulados com mais de uma categoria)
  const byCategory = Object.entries(
    review.reduce<Record<string, { c: number; t: number }>>((acc, r) => {
      acc[r.categoria] = acc[r.categoria] ?? { c: 0, t: 0 };
      acc[r.categoria].t += 1;
      if (r.correct) acc[r.categoria].c += 1;
      return acc;
    }, {}),
  ).sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t);

  return (
    <div className="min-h-screen bg-background p-4 pb-12">
      <div className="w-full max-w-2xl mx-auto space-y-6 animate-scale-in">
        <div className="text-center pt-4">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="w-24 h-24 rounded-full gradient-accent flex items-center justify-center shadow-glow-accent animate-bounce-in">
              <Trophy className="w-12 h-12 text-accent-foreground" />
            </div>
            {score === 100 && (
              <>
                <Star className="absolute -top-2 -left-2 w-6 h-6 text-accent animate-sparkle" />
                <Star className="absolute -top-1 -right-3 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: '0.2s' }} />
                <Star className="absolute -bottom-2 right-0 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: '0.6s' }} />
              </>
            )}
          </div>
          <h1 className={`text-3xl font-display font-bold ${message.color}`}>{message.text} {message.emoji}</h1>
          <p className="text-muted-foreground mt-2">{timedOut ? 'Tempo esgotado — simulado encerrado' : 'Simulado concluído'}</p>
        </div>

        {saved === false && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>Este resultado não foi salvo no seu histórico por falha de conexão. As respostas de cada questão foram registradas.</p>
          </div>
        )}

        <Card variant="primary" className="text-center py-8 relative overflow-hidden">
          <CardContent className="p-0 relative z-10">
            <p className="text-6xl font-display font-bold animate-scale-up">{score}%</p>
            <p className="text-primary-foreground/80 mt-2">Sua pontuação</p>
          </CardContent>
          {score >= 80 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />}
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card variant="elevated">
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-2xl font-bold">{correct}/{total}</p>
              <p className="text-xs text-muted-foreground">Acertos</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{formatTime(timeSpent)}</p>
              <p className="text-xs text-muted-foreground">Tempo</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold">+{pointsEarned ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </CardContent>
          </Card>
        </div>

        {byCategory.length > 1 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">Desempenho por matéria</p>
              {byCategory.map(([cat, v]) => {
                const pct = Math.round((v.c / v.t) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate pr-2">{cat}</span>
                      <span className="text-muted-foreground tabular-nums">{v.c}/{v.t}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-accent' : 'bg-destructive')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {reviewMistakesPath && wrong.length > 0 ? (
            <Button variant="hero" size="xl" className="w-full" onClick={() => navigate(reviewMistakesPath)}>
              <RotateCcw className="w-5 h-5 mr-2" /> Revisar meus erros
            </Button>
          ) : (
            <Button variant="hero" size="xl" className="w-full" onClick={() => navigate(safeRetry)}>
              <RotateCcw className="w-5 h-5 mr-2" /> Novo simulado
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {reviewMistakesPath && wrong.length > 0 && (
              <Button variant="outline" size="lg" onClick={() => navigate(safeRetry)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Novo simulado
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className={cn(!(reviewMistakesPath && wrong.length > 0) && 'col-span-2')}
              onClick={() => navigate(safeBack)}
            >
              <Home className="w-4 h-4 mr-2" /> {safeBack === '/' ? 'Início' : 'Voltar à trilha'}
            </Button>
          </div>
        </div>

        {review.length > 0 && (
          <section className="space-y-3" aria-labelledby="review-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="review-title" className="font-display font-bold text-lg">Revisão das questões</h2>
              <div className="flex rounded-full bg-muted p-0.5 text-xs" role="tablist">
                {(['wrong', 'all'] as ReviewFilter[]).map((f) => (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn('px-3 py-1 rounded-full transition-colors', filter === f ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}
                  >
                    {f === 'wrong' ? `Erros (${wrong.length})` : `Todas (${review.length})`}
                  </button>
                ))}
              </div>
            </div>
            {skipped > 0 && (
              <p className="text-xs text-muted-foreground">{skipped} questão(ões) ficaram sem resposta.</p>
            )}
            {shown.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum erro neste simulado. Mandou bem! 🎯</CardContent></Card>
            ) : (
              shown.map((item) => (
                <ReviewCard
                  key={item.questionId}
                  item={item}
                  index={review.indexOf(item)}
                  onReport={() => setReportId(item.questionId)}
                  onMentor={() => navigate(`/mentor?q=${encodeURIComponent(buildMentorPrompt(item))}`)}
                />
              ))
            )}
          </section>
        )}
      </div>

      <ReportQuestionDialog questionId={reportId} open={!!reportId} onOpenChange={(o) => !o && setReportId(null)} />
      <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CelebrationGlow isActive={showGlow} />
    </div>
  );
}
