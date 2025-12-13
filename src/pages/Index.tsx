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

        {/* FAQ Link - Modern Card Design */}
        <Card 
          variant="interactive" 
          className="overflow-hidden cursor-pointer group"
          onClick={() => navigate('/faq')}
        >
          <div className="relative p-6">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/20 to-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-500" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-primary/15 to-accent/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative flex items-center gap-4">
              {/* Icon with gradient background */}
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/90 to-primary/80 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <HelpCircle className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-accent flex items-center justify-center">
                  <span className="text-[10px] font-bold text-accent">?</span>
                </div>
              </div>
              
              <div className="flex-1">
                <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                  Perguntas Frequentes
                </h3>
                <p className="text-sm text-muted-foreground">
                  Tire todas as suas dúvidas sobre o app
                </p>
              </div>
              
              {/* Arrow indicator */}
              <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:translate-x-1 transition-all duration-300">
                <svg 
                  className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <DailyLimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
    </div>
  );
}
