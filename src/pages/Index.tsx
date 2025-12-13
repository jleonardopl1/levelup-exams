import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useCategories } from '@/hooks/useQuestions';
import { useLeaderboard } from '@/hooks/useQuizResults';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Trophy, Target, Flame, Play, Crown, Medal, Award, LogOut, Sparkles, Bot, HelpCircle } from 'lucide-react';
import heroPattern from '@/assets/hero-pattern.png';
import { PremiumBadge, UsageMeter, UpgradeCard } from '@/components/PremiumBadge';
import { DailyLimitModal } from '@/components/DailyLimitModal';

export default function Index() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: categories } = useCategories();
  const { data: leaderboard } = useLeaderboard(5);
  const { isPremium, questionsRemaining, dailyLimit, hasReachedLimit, tier } = useQuestionLimits();
  const navigate = useNavigate();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleStartQuiz = () => {
    if (hasReachedLimit && !isPremium) {
      setShowLimitModal(true);
    } else {
      navigate('/quiz');
    }
  };

  const handleCategoryClick = (cat: string) => {
    if (hasReachedLimit && !isPremium) {
      setShowLimitModal(true);
    } else {
      navigate(`/quiz?categoria=${encodeURIComponent(cat)}`);
    }
  };

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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-primary-foreground/80 text-sm">Olá,</p>
                <h1 className="text-2xl font-display font-bold text-primary-foreground">
                  {profile?.display_name || 'Estudante'}
                </h1>
              </div>
              <PremiumBadge tier={tier} />
            </div>
            <div className="flex items-center gap-2">
              {!isPremium && (
                <Button 
                  variant="glass" 
                  size="sm" 
                  onClick={() => navigate('/upgrade')}
                  className="gap-1"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span className="hidden sm:inline">Upgrade</span>
                </Button>
              )}
              <Button variant="glass" size="icon" onClick={signOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
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
      <div className="relative z-20 px-4 -mt-8 pb-8 space-y-6">
        {/* Usage Meter for Free Users */}
        {!isPremium && (
          <Card variant="elevated">
            <CardContent className="p-4">
              <UsageMeter questionsRemaining={questionsRemaining} dailyLimit={dailyLimit} />
            </CardContent>
          </Card>
        )}

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
              <Button variant="gradient-accent" size="lg" onClick={handleStartQuiz}>
                Começar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Mentor Card - Premium Feature */}
        <Card variant="elevated" className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Bot className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-lg">Mentor IA</h3>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Plus</span>
                </div>
                <p className="text-sm text-muted-foreground">Tire dúvidas com IA</p>
              </div>
              <Button 
                variant={isPremium ? "gradient-accent" : "outline"} 
                size="lg" 
                onClick={() => navigate('/mentor')}
              >
                {isPremium ? 'Acessar' : 'Ver mais'}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Categorias</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories?.slice(0, 4).map((cat) => (
              <Card 
                key={cat} 
                variant="interactive"
                className="p-4"
                onClick={() => handleCategoryClick(cat)}
              >
                <BookOpen className="w-6 h-6 text-primary mb-2" />
                <p className="font-semibold text-sm">{cat}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Upgrade Card for Free Users */}
        {!isPremium && (
          <UpgradeCard onUpgrade={() => navigate('/upgrade')} />
        )}

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

        {/* FAQ - Organic Floating Element */}
        <div 
          className="relative cursor-pointer group"
          onClick={() => navigate('/faq')}
        >
          {/* Organic background blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-8 -left-4 w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/15 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] blur-xl animate-pulse" />
            <div className="absolute -bottom-6 -right-2 w-20 h-20 bg-gradient-to-tr from-accent/25 to-primary/10 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-lg" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 right-1/4 w-12 h-12 bg-primary/10 rounded-full blur-md" />
          </div>

          {/* Main content - organic shape */}
          <div className="relative flex items-center gap-5 p-5 bg-gradient-to-br from-card/95 via-card/90 to-card/80 backdrop-blur-sm rounded-[2rem_1rem_2rem_1rem] border border-border/50 shadow-lg group-hover:shadow-xl group-hover:scale-[1.02] transition-all duration-500">
            
            {/* Floating avatar/mascot style icon */}
            <div className="relative flex-shrink-0">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent to-primary rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              
              {/* Main bubble */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-accent via-primary to-accent rounded-[45%_55%_50%_50%/55%_45%_55%_45%] flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl">💬</span>
              </div>
              
              {/* Small floating question mark */}
              <div className="absolute -top-2 -right-1 w-7 h-7 bg-background rounded-full border-2 border-accent shadow-md flex items-center justify-center group-hover:-translate-y-1 group-hover:rotate-12 transition-all duration-300">
                <span className="text-sm">❓</span>
              </div>
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary/70 font-medium mb-0.5">Precisa de ajuda?</p>
              <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                Dúvidas Frequentes
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Encontre respostas rápidas aqui ✨
              </p>
            </div>

            {/* Organic arrow/indicator */}
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary/10 to-accent/10 rounded-[40%_60%_55%_45%/50%_45%_55%_50%] flex items-center justify-center group-hover:bg-primary/20 group-hover:translate-x-1 transition-all duration-300">
              <svg 
                className="w-5 h-5 text-primary" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>

          {/* Decorative dots */}
          <div className="absolute -bottom-2 left-8 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary/40" />
            <div className="w-2 h-2 rounded-full bg-accent/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
          </div>
        </div>
      </div>

      <DailyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
    </div>
  );
}
