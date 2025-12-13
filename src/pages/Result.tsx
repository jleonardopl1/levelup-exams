import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Target, Clock, Home, RotateCcw } from 'lucide-react';

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { score = 0, correct = 0, total = 0, timeSpent = 0 } = location.state || {};

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getMessage = () => {
    if (score >= 80) return { text: 'Excelente!', emoji: '🎉' };
    if (score >= 60) return { text: 'Muito bem!', emoji: '👏' };
    if (score >= 40) return { text: 'Continue praticando!', emoji: '💪' };
    return { text: 'Não desista!', emoji: '📚' };
  };

  const message = getMessage();

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6 animate-scale-in">
        {/* Trophy Icon */}
        <div className="text-center">
          <div className="w-24 h-24 rounded-full gradient-accent mx-auto flex items-center justify-center shadow-glow-accent mb-4">
            <Trophy className="w-12 h-12 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold">{message.text} {message.emoji}</h1>
          <p className="text-muted-foreground mt-2">Simulado concluído</p>
        </div>

        {/* Score Card */}
        <Card variant="primary" className="text-center py-8">
          <CardContent className="p-0">
            <p className="text-6xl font-display font-bold">{score}%</p>
            <p className="text-primary-foreground/80 mt-2">Sua pontuação</p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* Actions */}
        <div className="space-y-3">
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
    </div>
  );
}
