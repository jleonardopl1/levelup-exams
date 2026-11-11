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
import { ArrowLeft, Clock, CheckCircle, XCircle, Loader2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DailyLimitModal } from '@/components/DailyLimitModal';
import { Confetti, CelebrationGlow } from '@/components/Confetti';
import { PremiumContentBadge } from '@/components/PremiumContentBadge';
import { PremiumUpsellModal } from '@/components/PremiumUpsellModal';

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
  const { processRewards, showConfetti, setShowConfetti, showGlow, setShowGlow } = useProcessQuizRewards();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [validationResult, setValidationResult] = useState<AnswerValidationResult | null>(null);
  const [answers, setAnswers] = useState<{ questionId: string; selected: number; correct: boolean }[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [quizFinished, setQuizFinished] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const maxStreakRef = useRef(0);
  const [showUpsellModal, setShowUpsellModal] = useState(false);

  // Check limit when quiz starts
  useEffect(() => {
    if (!authLoading && hasReachedLimit && !isPremium) {
      setShowLimitModal(true);
    }
  }, [authLoading, hasReachedLimit, isPremium]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  // Show upsell when free user encounters premium question
  const currentQuestion = questions?.[currentIndex];
  useEffect(() => {
    if (currentQuestion?.is_premium && !isPremium) {
      setShowUpsellModal(true);
    }
  }, [currentIndex, currentQuestion?.is_premium, isPremium]);

  // O cronometro so decrementa. Encerrar o quiz fica num efeito separado que usa a versao
  // mais recente de finishQuiz (via ref): antes, o intervalo chamava uma copia antiga,
  // de quando ainda nao havia respostas, e o aluno recebia nota 0 ao acabar o tempo.
  useEffect(() => {
    if (quizFinished || !questions || questions.length === 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [quizFinished, questions]);

  const progress = questions ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
  };

  const handleConfirm = async () => {
    if (selectedAnswer === null || !currentQuestion) return;
    
    // Validate answer server-side
    try {
      const result = await validateAnswer.mutateAsync({
        questionId: currentQuestion.id,
        selectedIndex: selectedAnswer,
      });
      
      setValidationResult(result);
      
      const isCorrect = result.is_correct;
      setAnswers([...answers, { 
        questionId: currentQuestion.id, 
        selected: selectedAnswer, 
        correct: isCorrect 
      }]);
      
      // Track consecutive correct answers
      if (isCorrect) {
        const newStreak = currentStreak + 1;
        setCurrentStreak(newStreak);
        maxStreakRef.current = Math.max(maxStreakRef.current, newStreak);
      } else {
        setCurrentStreak(0);
      }
      
      setShowResult(true);
    } catch (error) {
      console.error('Failed to validate answer:', error);
      toast.error('Não foi possível conferir sua resposta', {
        description: 'Verifique sua conexão e toque em Confirmar de novo.',
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < (questions?.length || 0) - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setValidationResult(null);
    } else {
      finishQuiz();
    }
  };

  const finishingRef = useRef(false);
  const finishQuiz = useCallback(async () => {
    if (quizFinished || finishingRef.current) return;
    finishingRef.current = true;
    setQuizFinished(true);

    // `answers` ja inclui a questao confirmada por ultimo (handleConfirm a adiciona antes
    // de mostrar o resultado). Somar validationResult de novo contava o ultimo acerto em dobro.
    const correctCount = answers.filter(a => a.correct).length;
    const total = questions?.length || 0;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const timeSpent = 600 - timeLeft;

    try {
      // Increment usage for free users
      if (!isPremium) {
        await incrementUsage.mutateAsync(total);
      }

      // Submit quiz result
      await submitQuiz.mutateAsync({
        score,
        correctAnswers: correctCount,
        totalQuestions: total,
        timeSpentSeconds: timeSpent,
        categoria: categoria || 'Todas',
      });

      // Process rewards and achievements
      await processRewards({
        correctAnswers: correctCount,
        totalQuestions: total,
        timeSpentSeconds: timeSpent,
        consecutiveCorrect: maxStreakRef.current,
      });
    } catch (error) {
      // Rede instavel no celular: nao prender o aluno na ultima questao.
      console.error('Failed to save quiz result:', error);
      toast.error('Não foi possível salvar este resultado', {
        description: 'Sua nota aparece abaixo, mas pode não entrar no histórico e no ranking.',
      });
    }

    navigate('/result', { 
      state: { score, correct: correctCount, total, timeSpent, backPath, retry: `${location.pathname}${location.search}` } 
    });
  }, [answers, navigate, questions, quizFinished, submitQuiz, timeLeft, categoria, isPremium, incrementUsage, processRewards, backPath, location.pathname, location.search]);

  const finishRef = useRef(finishQuiz);
  useEffect(() => {
    finishRef.current = finishQuiz;
  }, [finishQuiz]);
  useEffect(() => {
    if (timeLeft === 0) finishRef.current();
  }, [timeLeft]);

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <WifiOff className="w-12 h-12 text-muted-foreground" />
        <p className="font-semibold text-lg">Não foi possível carregar as questões.</p>
        <p className="text-sm text-muted-foreground">Verifique sua conexão com a internet e tente de novo.</p>
        <div className="flex gap-3">
          <Button onClick={() => refetch()}>Tentar de novo</Button>
          <Button variant="outline" onClick={() => navigate(backPath)}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !questions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)} aria-label="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <Progress value={progress} variant="gradient" size="sm" />
        </div>
        <div className="flex items-center gap-1 text-sm font-medium">
          <Clock className="w-4 h-4 text-primary" />
          <span className={timeLeft < 60 ? 'text-destructive' : ''}>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Counter */}
      <p className="text-sm text-muted-foreground mb-2">
        Questão {currentIndex + 1} de {questions.length}
      </p>

      {/* Question */}
      <Card variant="elevated" className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-primary font-medium">
              {currentQuestion?.categoria}
              {currentQuestion?.topico && <span className="text-muted-foreground font-normal"> · {currentQuestion.topico}</span>}
              {mode === 'review' && <span className="ml-2 text-xs text-destructive">revisão</span>}
            </p>
            {currentQuestion?.is_premium && (
              <PremiumContentBadge size="sm" />
            )}
          </div>
          <h2 className="text-lg font-semibold leading-relaxed">{currentQuestion?.enunciado}</h2>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion?.alternativas.map((alt, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = showResult && validationResult && index === validationResult.correct_index;
          const isWrong = showResult && isSelected && validationResult && index !== validationResult.correct_index;

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showResult || validateAnswer.isPending}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all duration-300",
                "flex items-center gap-3",
                !showResult && isSelected && "border-primary bg-primary/5",
                !showResult && !isSelected && "border-border hover:border-primary/50",
                isCorrect && "border-success bg-success/10",
                isWrong && "border-destructive bg-destructive/10 animate-shake"
              )}
            >
              <span className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                isCorrect ? "bg-success text-success-foreground" :
                isWrong ? "bg-destructive text-destructive-foreground" :
                isSelected ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              )}>
                {isCorrect ? <CheckCircle className="w-5 h-5" /> :
                 isWrong ? <XCircle className="w-5 h-5" /> :
                 String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1 font-medium">{alt}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && validationResult?.explicacao && (
        <Card variant="glass" className="mb-6 animate-slide-up">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-primary mb-1">Explicação:</p>
            <p className="text-sm text-muted-foreground">{validationResult.explicacao}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <Button 
        variant={showResult ? "gradient-success" : "hero"} 
        size="xl" 
        className="w-full"
        onClick={showResult ? handleNext : handleConfirm}
        disabled={(selectedAnswer === null && !showResult) || validateAnswer.isPending}
      >
        {validateAnswer.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validando...</>
        ) : showResult ? (
          currentIndex === questions.length - 1 ? 'Ver Resultado' : 'Próxima'
        ) : (
          'Confirmar'
        )}
      </Button>

      <DailyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
      <PremiumUpsellModal open={showUpsellModal} onOpenChange={setShowUpsellModal} triggerContext="question" />
      
      {/* Celebration Effects */}
      <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CelebrationGlow isActive={showGlow} />
    </div>
  );
}