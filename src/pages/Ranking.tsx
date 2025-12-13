import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaderboardFiltered } from '@/hooks/useQuizResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Crown, Medal, Award, Trophy, Calendar } from 'lucide-react';

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

const periodLabels: Record<PeriodFilter, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
  all: 'Geral',
};

export default function Ranking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const { data: leaderboard, isLoading } = useLeaderboardFiltered(period, 50);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-accent-foreground" />;
    if (index === 1) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (index === 2) return <Award className="w-5 h-5 text-muted-foreground" />;
    return <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>;
  };

  const getRankStyle = (index: number) => {
    if (index === 0) return 'gradient-accent';
    if (index === 1) return 'bg-secondary';
    if (index === 2) return 'bg-muted';
    return 'bg-muted/50';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="gradient-hero px-4 pt-6 pb-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="glass" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-primary-foreground">Ranking</h1>
            <p className="text-primary-foreground/70 text-sm">Melhores pontuações</p>
          </div>
          <div className="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center shadow-glow-accent">
            <Trophy className="w-6 h-6 text-accent-foreground" />
          </div>
        </div>

        {/* Period Filters */}
        <div className="flex gap-2">
          {(Object.keys(periodLabels) as PeriodFilter[]).map((key) => (
            <Button
              key={key}
              variant={period === key ? 'gradient-accent' : 'glass'}
              size="sm"
              onClick={() => setPeriod(key)}
              className="flex-1"
            >
              <Calendar className="w-4 h-4 mr-1" />
              {periodLabels[key]}
            </Button>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 py-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          leaderboard.map((entry, index) => (
            <Card
              key={entry.id}
              variant={index < 3 ? 'elevated' : 'default'}
              className={`overflow-hidden ${entry.user_id === user?.id ? 'ring-2 ring-primary' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRankStyle(index)}`}>
                    {getRankIcon(index)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {entry.display_name}
                      {entry.user_id === user?.id && (
                        <span className="ml-2 text-xs text-primary">(Você)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.correct_answers}/{entry.total_questions} acertos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">{entry.score}</p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card variant="elevated" className="p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum resultado encontrado para este período</p>
          </Card>
        )}
      </div>
    </div>
  );
}
