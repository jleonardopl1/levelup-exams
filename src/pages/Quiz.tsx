import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuestions, Question } from '@/hooks/useQuestions';
import { useSubmitQuiz } from '@/hooks/useQuizResults';
import { useQuestionLimits, useIncrementUsage } from '@/hooks/useDailyUsage';
import { useProcessQuizRewards } from '@/hooks/useQuizRewards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DailyLimitModal } from '@/components/DailyLimitModal';
import { Confetti, CelebrationGlow } from '@/components/Confetti';

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const categoria = searchParams.get('categoria') || undefined;
  const subjectId = searchParams.get('subject') || undefined;
  const { user, loading: authLoading } = useAuth();
  const { data: questions, isLoading } = useQuestions({ limit: 10, categoria, subjectId });
  const submitQuiz = useSubmitQuiz();
  const incrementUsage = useIncrementUsage();
  const { hasReachedLimit, questionsRemaining, isPremium } = useQuestionLimits();
  const { processRewards, showConfetti, setShowConfetti, showGlow, setShowGlow } = useProcessQuizRewards();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; selected: number; correct: boolean }[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [quizFinished, setQuizFinished] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const maxStreakRef = useRef(0);

  // Check limit when quiz starts
  useEffect(() => {
    if (!authLoading && hasReachedLimit && !isPremium) {
      setShowLimitModal(true);
    }
  }, [authLoading, hasReachedLimit, isPremium]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (quizFinished || !questions) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [quizFinished, questions]);

  const currentQuestion = questions?.[currentIndex];
  const progress = questions ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const handleSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
  };

  const handleConfirm = () => {
    if (selectedAnswer === null || !currentQuestion) return;
    
    const isCorrect = selectedAnswer === currentQuestion.correta;
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
  };

  const handleNext = () => {
    if (currentIndex < (questions?.length || 0) - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = useCallback(async () => {
    if (quizFinished) return;
    setQuizFinished(true);
    
    const correctCount = answers.filter(a => a.correct).length + 
      (showResult && selectedAnswer === currentQuestion?.correta ? 1 : 0);
    const total = questions?.length || 0;
    const score = Math.round((correctCount / total) * 100);
    const timeSpent = 600 - timeLeft;

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

    navigate('/result', { 
      state: { score, correct: correctCount, total, timeSpent } 
    });
  }, [answers, currentQuestion, navigate, questions, quizFinished, selectedAnswer, showResult, submitQuiz, timeLeft, categoria, isPremium, incrementUsage, processRewards]);

  if (isLoading || !questions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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
          <p className="text-sm text-primary font-medium mb-2">{currentQuestion?.categoria}</p>
          <h2 className="text-lg font-semibold leading-relaxed">{currentQuestion?.enunciado}</h2>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion?.alternativas.map((alt, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = showResult && index === currentQuestion.correta;
          const isWrong = showResult && isSelected && index !== currentQuestion.correta;

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={showResult}
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
      {showResult && currentQuestion?.explicacao && (
        <Card variant="glass" className="mb-6 animate-slide-up">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-primary mb-1">Explicação:</p>
            <p className="text-sm text-muted-foreground">{currentQuestion.explicacao}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <Button 
        variant={showResult ? "gradient-success" : "hero"} 
        size="xl" 
        className="w-full"
        onClick={showResult ? handleNext : handleConfirm}
        disabled={selectedAnswer === null && !showResult}
      >
        {showResult ? (currentIndex === questions.length - 1 ? 'Ver Resultado' : 'Próxima') : 'Confirmar'}
      </Button>

      <DailyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
      
      {/* Celebration Effects */}
      <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CelebrationGlow isActive={showGlow} />
    </div>
  );
}
