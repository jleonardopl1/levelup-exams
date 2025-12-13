import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useCategories } from '@/hooks/useQuestions';
import { useLeaderboard } from '@/hooks/useQuizResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Trophy, Target, Flame, Play, Crown, Medal, Award, LogOut } from 'lucide-react';
import heroPattern from '@/assets/hero-pattern.png';

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: categories } = useCategories();
  const { data: leaderboard } = useLeaderboard(5);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroPattern} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 gradient-hero opacity-90" />
        </div>
        
        <div className="relative z-10 px-4 pt-6 pb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-primary-foreground/80 text-sm">Olá,</p>
              <h1 className="text-2xl font-display font-bold text-primary-foreground">
                {profile?.display_name || 'Estudante'}
              </h1>
            </div>
            <Button variant="glass" size="icon" onClick={signOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card variant="glass" className="text-center p-4">
              <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{profile?.total_quizzes || 0}</p>
              <p className="text-xs text-muted-foreground">Simulados</p>
            </Card>
            <Card variant="glass" className="text-center p-4">
              <Trophy className="w-6 h-6 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-bold">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Precisão</p>
            </Card>
            <Card variant="glass" className="text-center p-4">
              <Flame className="w-6 h-6 mx-auto mb-2 text-destructive" />
              <p className="text-2xl font-bold">{profile?.streak_days || 0}</p>
              <p className="text-xs text-muted-foreground">Sequência</p>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-8 pb-8 space-y-6">
        {/* Start Quiz CTA */}
        <Card variant="elevated" className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center shadow-glow-accent">
                <Play className="w-7 h-7 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-lg">Iniciar Simulado</h3>
                <p className="text-sm text-muted-foreground">10 questões aleatórias</p>
              </div>
              <Button variant="gradient-accent" size="lg" asChild>
                <Link to="/quiz">Começar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Categories */}
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Categorias</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories?.slice(0, 4).map((cat) => (
              <Card 
                key={cat} 
                variant="interactive"
                className="p-4"
                onClick={() => navigate(`/quiz?categoria=${encodeURIComponent(cat)}`)}
              >
                <BookOpen className="w-6 h-6 text-primary mb-2" />
                <p className="font-semibold text-sm">{cat}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Leaderboard Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Ranking</h2>
            <Link to="/ranking" className="text-sm text-primary font-medium">Ver todos</Link>
          </div>
          <Card variant="elevated">
            <CardContent className="p-4 space-y-3">
              {leaderboard?.slice(0, 3).map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    index === 0 ? 'gradient-accent' : index === 1 ? 'bg-muted' : 'bg-muted'
                  }`}>
                    {index === 0 ? <Crown className="w-4 h-4 text-accent-foreground" /> :
                     index === 1 ? <Medal className="w-4 h-4 text-muted-foreground" /> :
                     <Award className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{entry.display_name}</p>
                  </div>
                  <p className="font-bold text-primary">{entry.score} pts</p>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                <p className="text-center text-muted-foreground py-4">Nenhum resultado ainda</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
