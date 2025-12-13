import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useQuizResults } from '@/hooks/useQuizResults';
import { useUserRewards, useUserAchievements, calculateLevel, getPointsForNextLevel } from '@/hooks/useRewards';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Trophy, 
  Target, 
  Flame, 
  CheckCircle, 
  XCircle, 
  Clock,
  TrendingUp,
  Zap,
  Star,
  Gift,
  Calendar
} from 'lucide-react';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useProfile();
  const { data: quizResults } = useQuizResults();
  const { data: rewards } = useUserRewards();
  const { data: achievements } = useUserAchievements();
  const { isPremium, tier } = useQuestionLimits();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const accuracy = profile && profile.total_questions > 0 
    ? Math.round((profile.total_correct / profile.total_questions) * 100) 
    : 0;

  const currentLevel = rewards?.current_level || calculateLevel(rewards?.total_points || 0);
  const pointsForNext = getPointsForNextLevel(currentLevel);
  const currentPoints = rewards?.total_points || 0;
  const levelProgress = (currentPoints / pointsForNext) * 100;

  // Calculate stats from quiz results
  const totalTimeMinutes = quizResults?.reduce((acc, r) => acc + (r.time_spent_seconds || 0), 0) || 0;
  const avgTimePerQuiz = quizResults && quizResults.length > 0 
    ? Math.round((totalTimeMinutes / quizResults.length) / 60) 
    : 0;

  // Recent performance (last 7 days)
  const recentResults = quizResults?.filter(r => {
    const date = new Date(r.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  }) || [];

  const recentAccuracy = recentResults.length > 0
    ? Math.round(recentResults.reduce((acc, r) => acc + (r.correct_answers / r.total_questions) * 100, 0) / recentResults.length)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Back Button & Title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Acompanhe sua evolução</p>
          </div>
        </div>

        {/* Level & Points Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <span className="text-2xl font-bold text-white">{currentLevel}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nível Atual</p>
                  <p className="font-display text-xl font-bold">
                    {currentLevel <= 5 ? 'Iniciante' : 
                     currentLevel <= 10 ? 'Intermediário' : 
                     currentLevel <= 20 ? 'Avançado' : 'Mestre'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{currentPoints}</p>
                <p className="text-sm text-muted-foreground">pontos</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso para nível {currentLevel + 1}</span>
                <span className="text-muted-foreground">{currentPoints}/{pointsForNext}</span>
              </div>
              <Progress value={levelProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{profile?.total_quizzes || 0}</p>
              <p className="text-xs text-muted-foreground">Simulados</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Precisão Geral</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Flame className="w-8 h-8 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold">{profile?.streak_days || 0}</p>
              <p className="text-xs text-muted-foreground">Dias de Sequência</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Zap className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-2xl font-bold">{rewards?.max_consecutive_correct || 0}</p>
              <p className="text-xs text-muted-foreground">Maior Combo</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                Desempenho
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span>Respostas Corretas</span>
                </div>
                <span className="font-bold text-success">{profile?.total_correct || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-destructive" />
                  <span>Respostas Incorretas</span>
                </div>
                <span className="font-bold text-destructive">
                  {(profile?.total_questions || 0) - (profile?.total_correct || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <span>Tempo Médio por Quiz</span>
                </div>
                <span className="font-bold">{avgTimePerQuiz} min</span>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-primary" />
                Últimos 7 Dias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <span>Simulados Realizados</span>
                <span className="font-bold">{recentResults.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <span>Precisão da Semana</span>
                <span className={`font-bold ${recentAccuracy >= 70 ? 'text-success' : recentAccuracy >= 50 ? 'text-warning' : 'text-destructive'}`}>
                  {recentAccuracy}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl border border-primary/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Tendência</span>
                </div>
                <span className="font-bold text-primary">
                  {recentAccuracy >= accuracy ? '📈 Melhorando!' : '📊 Continue praticando'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements Preview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-accent" />
              Conquistas Recentes
            </CardTitle>
            <Link to="/rewards" className="text-sm text-primary hover:underline">
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent>
            {achievements && achievements.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {achievements.slice(0, 4).map((ua) => (
                  <div 
                    key={ua.id} 
                    className="p-3 bg-gradient-to-br from-accent/10 to-primary/10 rounded-xl border border-accent/20 text-center"
                  >
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center">
                      <span className="text-lg">🏆</span>
                    </div>
                    <p className="text-xs font-medium truncate">{ua.achievement?.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-6">
                Complete quizzes para desbloquear conquistas! 🎯
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/quiz')}
          >
            <Target className="w-6 h-6 text-primary" />
            <span>Novo Simulado</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => navigate('/rewards')}
          >
            <Gift className="w-6 h-6 text-accent" />
            <span>Recompensas</span>
          </Button>
        </div>
      </main>
    </div>
  );
}
