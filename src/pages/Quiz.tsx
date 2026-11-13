import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuestions, useValidateAnswer, AnswerValidationResult, type PracticeMode } from '@/hooks/useQuestions';
import { useSubmitQuiz } from '@/hooks/useQuizResults';
import { useQuestionLimits, useIncrementUsage } from '@/hooks/useDailyUsage';
import { useProcessQuizRewards } from '@/hooks/useQuizRewards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Clock, CheckCircle, XCircle, Loader2, Flag, RotateCcw, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DailyLimitModal } from '@/components/DailyLimitModal';
import { Confetti, CelebrationGlow } from '@/components/Confetti';
import { PremiumContentBadge } from '@/components/PremiumContentBadge';
import { PremiumUpsellModal } from '@/components/PremiumUpsellModal';
import { ReportQuestionDialog } from '@/components/ReportQuestionDialog';
import { saveQuizResult, type QuizResultState, type QuizReviewItem } from '@/lib/quizSession';

const QUIZ_SECONDS = 600; // 10 minutos

type Answer = { questionId: string; selected: number; correct: boolean; correctIndex: number; explicacao: string | null };

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const categoria = searchParams.get('categoria') || undefined;
  const subjectId = searchParams.get('subject') || undefined;
  const nivelParam = searchParams.get('nivel');
  const nivel = nivelParam === 'medio' || nivelParam === 'superior' ? nivelParam : undefined;
  const modeParam = searchParams.get('mode');
  const mode: PracticeMode = modeParam === 'review' || modeParam === 'new' || modeParam === 'weekly' ? modeParam : 'smart';
  const trilha = searchParams.get('trilha');
  const backPath = trilha && /^[a-z0-9-]{1,80}$/.test(trilha) ? `/trilhas/${trilha}` : '/';
  const { user, loading: authLoading } = useAuth();
  const { data: questions, isLoading, isError, refetch } = useQuestions({ limit: 10, categoria, subjectId, nivel, mode });
  const validateAnswer = useValidateAnswer();
  const submitQuiz = useSubmitQuiz();
  const incrementUsage = useIncrementUsage();
  const { hasReachedLimit, isPremium } = useQuestionLimits();
  const { processRewards, showConfetti, setShowConfetti, showGlow } = useProcessQuizRewards();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [validationResult, setValidationResult] = useState<AnswerValidationResult | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUIZ_SECONDS);
  const [phase, setPhase] = useState<'playing' | 'saving' | 'save_error'>('playing');
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Refs: o cronômetro e o atalho de teclado leem o estado mais recente sem
  // depender de closures antigas (antes, o fim por tempo calculava a nota com
  // a lista de respostas vazia e o aluno recebia 0%).
  const answersRef = useRef<Answer[]>([]);
  const timeLeftRef = useRef(QUIZ_SECONDS);
  const finishingRef = useRef(false);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const pendingResultRef = useRef<QuizResultState | null>(null);
  // O limite diário é cobrado uma única vez, mesmo se o aluno repetir "Tentar salvar".
  const usageRecordedRef = useRef(false);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (!authLoading && hasReachedLimit && !isPremium) setShowLimitModal(true);
  }, [authLoading, hasReachedLimit, isPremium]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const currentQuestion = questions?.[currentIndex];
  useEffect(() => {
    if (currentQuestion?.is_premium && !isPremium) setShowUpsellModal(true);
  }, [currentIndex, currentQuestion?.is_premium, isPremium]);

  const buildResult = useCallback((timedOut: boolean): QuizResultState => {
    const list = questions ?? [];
    const byId = new Map(answersRef.current.map((a) => [a.questionId, a]));
    const review: QuizReviewItem[] = list.map((q) => {
      const a = byId.get(q.id);
      return {
        questionId: q.id,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        categoria: q.categoria,
        topico: q.topico ?? null,
        selected: a ? a.selected : null,
        correctIndex: a ? a.correctIndex : null,
        correct: a?.correct ?? false,
        explicacao: a?.explicacao ?? null,
      };
    });
    const correct = review.filter((r) => r.correct).length;
    const total = list.length;
    return {
      score: total > 0 ? Math.round((correct / total) * 100) : 0,
      correct,
      total,
      timeSpent: QUIZ_SECONDS - timeLeftRef.current,
      backPath,
      retry: `${location.pathname}${location.search}`,
      timedOut,
      review,
    };
  }, [questions, backPath, location.pathname, location.search]);

  const persistAndShow = useCallback(async (result: QuizResultState) => {
    setPhase('saving');
    try {
      const answered = answersRef.current.length;
      if (!isPremium && answered > 0 && !usageRecordedRef.current) {
        // Só conta no limite diário o que o aluno realmente respondeu.
        await incrementUsage.mutateAsync(answered).then(
          () => { usageRecordedRef.current = true; },
          () => undefined,
        );
      }
      await submitQuiz.mutateAsync({
        score: result.score,
        correctAnswers: result.correct,
        totalQuestions: result.total,
        timeSpentSeconds: result.timeSpent,
        categoria: categoria || 'Todas',
      });
    } catch {
      pendingResultRef.current = result;
      setPhase('save_error');
      return;
    }

    let pointsEarned = 0;
    try {
      const rewards = await processRewards({
        correctAnswers: result.correct,
        totalQuestions: result.total,
        timeSpentSeconds: result.timeSpent,
        consecutiveCorrect: maxStreakRef.current,
      });
      pointsEarned = rewards.pointsEarned;
    } catch {
      /* recompensas não devem impedir o aluno de ver o resultado */
    }

    const final = { ...result, pointsEarned, saved: true, userId: user?.id };
    saveQuizResult(final);
    navigate('/result', { state: final, replace: true });
  }, [categoria, incrementUsage, isPremium, navigate, processRewards, submitQuiz, user?.id]);

  const finishQuiz = useCallback((timedOut = false) => {
    if (finishingRef.current || !questions || questions.length === 0) return;
    finishingRef.current = true;
    void persistAndShow(buildResult(timedOut));
  }, [buildResult, persistAndShow, questions]);

  const finishRef = useRef(finishQuiz);
  useEffect(() => { finishRef.current = finishQuiz; }, [finishQuiz]);

  // Cronômetro
  useEffect(() => {
    if (phase !== 'playing' || !questions || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          timeLeftRef.current = 0;
          setTimeout(() => finishRef.current(true), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, questions]);

  // Aviso ao fechar/recarregar a aba no meio do simulado
  useEffect(() => {
    if (phase !== 'playing' || answers.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase, answers.length]);

  const progress = questions && questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleSelect = (index: number) => {
    if (showResult || validateAnswer.isPending) return;
    setSelectedAnswer(index);
  };

  const handleConfirm = async () => {
    if (selectedAnswer === null || !currentQuestion || validateAnswer.isPending) return;
    try {
      const result = await validateAnswer.mutateAsync({
        questionId: currentQuestion.id,
        selectedIndex: selectedAnswer,
      });
      setValidationResult(result);
      const next = [...answersRef.current, {
        questionId: currentQuestion.id,
        selected: selectedAnswer,
        correct: result.is_correct,
        correctIndex: result.correct_index,
        explicacao: result.explicacao,
      }];
      answersRef.current = next;
      setAnswers(next);

      if (result.is_correct) {
        streakRef.current += 1;
        maxStreakRef.current = Math.max(maxStreakRef.current, streakRef.current);
      } else {
        streakRef.current = 0;
      }
      setShowResult(true);
    } catch (error) {
      toast.error((error as Error).message || 'Não foi possível validar a resposta.');
    }
  };

  const handleNext = () => {
    if (!questions) return;
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setValidationResult(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      finishQuiz(false);
    }
  };

  const handleBack = () => {
    if (answers.length > 0 && phase === 'playing') setConfirmExit(true);
    else navigate(backPath);
  };

  // Atalhos: 1-6 / A-F escolhem a alternativa, Enter confirma / avança.
  const handleConfirmRef = useRef(handleConfirm);
  const handleNextRef = useRef(handleNext);
  handleConfirmRef.current = handleConfirm;
  handleNextRef.current = handleNext;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'playing' || reportOpen || confirmExit || showLimitModal || showUpsellModal) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const total = currentQuestion?.alternativas.length ?? 0;
      const key = e.key.toLowerCase();
      let idx = -1;
      if (/^[1-6]$/.test(key)) idx = Number(key) - 1;
      else if (/^[a-f]$/.test(key)) idx = key.charCodeAt(0) - 97;
      if (idx >= 0 && idx < total) {
        e.preventDefault();
        handleSelect(idx);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (showResult) handleNextRef.current();
        else void handleConfirmRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (isLoading || (!questions && !isError)) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando questões">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isError || !questions) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="font-semibold text-lg">Não foi possível carregar as questões.</p>
        <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(backPath)}>Voltar</Button>
          <Button onClick={() => refetch()}><RotateCcw className="w-4 h-4 mr-2" /> Tentar de novo</Button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <CheckCircle className="w-12 h-12 text-success" />
        <p className="font-semibold text-lg">
          {mode === 'review' ? 'Nenhum erro para revisar nesta matéria.' : 'Nenhuma questão disponível para este filtro.'}
        </p>
        <p className="text-sm text-muted-foreground">
          {mode === 'review' ? 'Continue praticando: as questões que você errar aparecerão aqui.' : 'Tente outro modo ou volte mais tarde.'}
        </p>
        <Button variant="outline" onClick={() => navigate(backPath)}>Voltar</Button>
      </div>
    );
  }

  if (phase !== 'playing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        {phase === 'saving' ? (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="font-semibold">Calculando seu resultado...</p>
          </>
        ) : (
          <>
            <XCircle className="w-12 h-12 text-destructive" />
            <p className="font-semibold text-lg">Não conseguimos salvar seu resultado.</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Suas respostas continuam aqui. Verifique a conexão e tente salvar de novo.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => pendingResultRef.current && persistAndShow(pendingResultRef.current)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Tentar salvar de novo
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const r = { ...(pendingResultRef.current ?? buildResult(false)), saved: false, userId: user?.id };
                  saveQuizResult(r);
                  navigate('/result', { state: r, replace: true });
                }}
              >
                Ver resultado sem salvar
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-background p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Sair do simulado">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <Progress value={progress} variant="gradient" size="sm" aria-label={`Questão ${currentIndex + 1} de ${questions.length}`} />
        </div>
        <div
          className={cn('flex items-center gap-1 text-sm font-medium tabular-nums', timeLeft < 60 && 'text-destructive animate-pulse')}
          aria-label={`Tempo restante ${formatTime(timeLeft)}`}
        >
          <Clock className="w-4 h-4 text-primary" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">
          Questão {currentIndex + 1} de {questions.length}
          <span className="ml-2 text-success">· {answers.filter((a) => a.correct).length} acerto(s)</span>
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => setReportOpen(true)}
        >
          <Flag className="w-3.5 h-3.5 mr-1" /> Reportar erro
        </Button>
      </div>

      {/* Question */}
      <Card variant="elevated" className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-primary font-medium">
              {currentQuestion?.categoria}
              {currentQuestion?.topico && <span className="text-muted-foreground font-normal"> · {currentQuestion.topico}</span>}
              {mode === 'review' && <span className="ml-2 text-xs text-destructive">revisão</span>}
            </p>
            {currentQuestion?.is_premium && <PremiumContentBadge size="sm" />}
          </div>
          <h2 className="text-lg font-semibold leading-relaxed whitespace-pre-line">{currentQuestion?.enunciado}</h2>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="space-y-3 mb-6" role="radiogroup" aria-label="Alternativas">
        {currentQuestion?.alternativas.map((alt, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = showResult && validationResult && index === validationResult.correct_index;
          const isWrong = showResult && isSelected && validationResult && index !== validationResult.correct_index;

          return (
            <button
              key={index}
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(index)}
              disabled={showResult || validateAnswer.isPending}
              className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all duration-300',
                'flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                !showResult && isSelected && 'border-primary bg-primary/5',
                !showResult && !isSelected && 'border-border hover:border-primary/50',
                isCorrect && 'border-success bg-success/10',
                isWrong && 'border-destructive bg-destructive/10 animate-shake',
              )}
            >
              <span className={cn(
                'w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold',
                isCorrect ? 'bg-success text-success-foreground'
                  : isWrong ? 'bg-destructive text-destructive-foreground'
                  : isSelected ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}>
                {isCorrect ? <CheckCircle className="w-5 h-5" />
                  : isWrong ? <XCircle className="w-5 h-5" />
                  : String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1 font-medium">{alt}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback + explanation */}
      {showResult && validationResult && (
        <Card variant="glass" className="mb-6 animate-slide-up" aria-live="polite">
          <CardContent className="p-4">
            <p className={cn('text-sm font-semibold mb-1', validationResult.is_correct ? 'text-success' : 'text-destructive')}>
              {validationResult.is_correct
                ? 'Resposta correta!'
                : `Resposta incorreta. Gabarito: ${String.fromCharCode(65 + validationResult.correct_index)}`}
            </p>
            {validationResult.explicacao && (
              <p className="text-sm text-muted-foreground">{validationResult.explicacao}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <Button
        variant={showResult ? 'gradient-success' : 'hero'}
        size="xl"
        className="w-full"
        onClick={showResult ? handleNext : handleConfirm}
        disabled={(selectedAnswer === null && !showResult) || validateAnswer.isPending}
      >
        {validateAnswer.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validando...</>
        ) : showResult ? (isLast ? 'Ver Resultado' : 'Próxima') : 'Confirmar'}
      </Button>

      <p className="hidden md:flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <Keyboard className="w-3.5 h-3.5" /> Atalhos: teclas A–E ou 1–5 escolhem, Enter confirma
      </p>

      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do simulado?</AlertDialogTitle>
            <AlertDialogDescription>
              Você respondeu {answers.length} de {questions.length} questões. Pode encerrar agora e ver o
              resultado parcial, ou sair sem salvar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Continuar respondendo</AlertDialogCancel>
            <Button variant="outline" onClick={() => { setConfirmExit(false); navigate(backPath); }}>
              Sair sem salvar
            </Button>
            <AlertDialogAction onClick={() => finishQuiz(false)}>Encerrar e ver resultado</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportQuestionDialog questionId={currentQuestion?.id ?? null} open={reportOpen} onOpenChange={setReportOpen} />
      <DailyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
      <PremiumUpsellModal open={showUpsellModal} onOpenChange={setShowUpsellModal} triggerContext="question" />

      <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CelebrationGlow isActive={showGlow} />
    </div>
  );
}
