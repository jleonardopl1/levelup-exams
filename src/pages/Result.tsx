import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Target, Clock, Home, RotateCcw, Star } from 'lucide-react';
import { Confetti, CelebrationGlow } from '@/components/Confetti';

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { score = 0, correct = 0, total = 0, timeSpent = 0 } = location.state || {};
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  // Trigger celebration for high scores
  useEffect(() => {
    if (score >= 80) {
      setShowConfetti(true);
      setShowGlow(true);
    }
  }, [score]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getMessage = () => {
    if (score >= 80) return { text: 'Excelente!', emoji: '🎉', color: 'text-accent' };
    if (score >= 60) return { text: 'Muito bem!', emoji: '👏', color: 'text-success' };
    if (score >= 40) return { text: 'Continue praticando!', emoji: '💪', color: 'text-primary' };
    return { text: 'Não desista!', emoji: '📚', color: 'text-muted-foreground' };
  };

  const message = getMessage();

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6 animate-scale-in">
        {/* Trophy Icon */}
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="w-24 h-24 rounded-full gradient-accent flex items-center justify-center shadow-glow-accent animate-bounce-in">
              <Trophy className="w-12 h-12 text-accent-foreground" />
            </div>
            {score === 100 && (
              <>
                <Star className="absolute -top-2 -left-2 w-6 h-6 text-accent animate-sparkle" style={{ animationDelay: '0s' }} />
                <Star className="absolute -top-1 -right-3 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: '0.2s' }} />
                <Star className="absolute -bottom-1 -left-3 w-4 h-4 text-accent animate-sparkle" style={{ animationDelay: '0.4s' }} />
                <Star className="absolute -bottom-2 right-0 w-5 h-5 text-accent animate-sparkle" style={{ animationDelay: '0.6s' }} />
              </>
            )}
          </div>
          <h1 className={`text-3xl font-display font-bold ${message.color}`}>
            {message.text} {message.emoji}
          </h1>
          <p className="text-muted-foreground mt-2">Simulado concluído</p>
        </div>

        {/* Score Card */}
        <Card variant="primary" className="text-center py-8 relative overflow-hidden">
          <CardContent className="p-0 relative z-10">
            <p className="text-6xl font-display font-bold animate-scale-up">{score}%</p>
            <p className="text-primary-foreground/80 mt-2">Sua pontuação</p>
          </CardContent>
          {score >= 80 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          )}
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card variant="elevated" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-success" />
              <p className="text-2xl font-bold">{correct}/{total}</p>
              <p className="text-xs text-muted-foreground">Acertos</p>
            </CardContent>
          </Card>
          <Card variant="elevated" className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{formatTime(timeSpent)}</p>
              <p className="text-xs text-muted-foreground">Tempo</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <Button variant="hero" size="xl" className="w-full" onClick={() => navigate('/quiz')}>
            <RotateCcw className="w-5 h-5 mr-2" />
            Tentar Novamente
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/')}>
            <Home className="w-5 h-5 mr-2" />
            Voltar ao Início
          </Button>
        </div>
      </div>

      {/* Celebration Effects */}
      <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />
      <CelebrationGlow isActive={showGlow} />
    </div>
  );
}
