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
import { BookOpen, Trophy, Target, Flame, Play, Crown, Medal, Award, LogOut, Sparkles, Bot, HelpCircle, TrendingUp, Zap, Star, ArrowUpRight } from 'lucide-react';
import heroPattern from '@/assets/hero-pattern.png';
import { PremiumBadge, UsageMeter, UpgradeCard } from '@/components/PremiumBadge';
import { DailyLimitModal } from '@/components/DailyLimitModal';
import { AppHeader } from '@/components/AppHeader';
import { DailyChallengesCard } from '@/components/DailyChallengesCard';
import { MilestoneModal } from '@/components/MilestoneModal';
import { RecentAchievementsCard } from '@/components/RecentAchievementsCard';
import { StreakReminderBanner, StreakReminderToggle } from '@/components/StreakReminderToggle';

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

  // Calculate user level and progress
  const totalPoints = (profile?.total_correct || 0) * 10;
  const currentLevel = Math.floor(totalPoints / 500) + 1;
  const pointsInCurrentLevel = totalPoints % 500;
  const levelProgress = (pointsInCurrentLevel / 500) * 100;

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Bom dia', emoji: '☀️' };
    if (hour < 18) return { text: 'Boa tarde', emoji: '🌤️' };
    return { text: 'Boa noite', emoji: '🌙' };
  };
  const greeting = getGreeting();

  // Get motivational message based on stats
  const getMotivationalMessage = () => {
    if (!profile || profile.total_quizzes === 0) {
      return { text: 'Pronto para começar sua jornada?', highlight: 'Faça seu primeiro simulado!' };
    }
    if (profile.streak_days >= 7) {
      return { text: `${profile.streak_days} dias seguidos estudando!`, highlight: 'Você está no caminho certo! 🔥' };
    }
    if (accuracy >= 80) {
      return { text: `${accuracy}% de precisão`, highlight: 'Excelente desempenho!' };
    }
    if (accuracy >= 50) {
      return { text: 'Continue assim!', highlight: 'Cada questão conta.' };
    }
    return { text: 'A prática leva à perfeição!', highlight: 'Continue estudando.' };
  };
  const motivation = getMotivationalMessage();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      {/* Hero Section - Enhanced */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroPattern} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 gradient-hero opacity-90" />
        </div>
        
        <div className="relative z-10 px-4 pt-6 pb-24">
          {/* Greeting & Profile Header */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{greeting.emoji}</span>
                <p className="text-primary-foreground/80 text-sm font-medium">{greeting.text}</p>
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-primary-foreground">
                {profile?.display_name || 'Estudante'}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1">
              <PremiumBadge tier={tier} />
              <div className="flex items-center gap-1 text-primary-foreground/70 text-xs">
                <Star className="w-3 h-3 fill-current" />
                <span>Nível {currentLevel}</span>
              </div>
            </div>
          </div>

          {/* Motivational Card */}
          <div className="mb-5 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary-foreground/90 text-sm font-medium">{motivation.text}</p>
                <p className="text-primary-foreground font-semibold text-base">{motivation.highlight}</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-primary-foreground/50 shrink-0" />
            </div>
            
            {/* Level Progress */}
            {profile && profile.total_quizzes > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-primary-foreground/70 mb-1.5">
                  <span>Progresso para nível {currentLevel + 1}</span>
                  <span>{pointsInCurrentLevel}/500 XP</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-accent to-success rounded-full transition-all duration-500"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Stats Cards - Enhanced */}
          <div className="grid grid-cols-3 gap-3">
            <Card variant="glass" className="text-center p-4 group hover:scale-105 transition-transform duration-300">
              <div className="relative mx-auto w-10 h-10 mb-2 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary/30 flex items-center justify-center">
                  <TrendingUp className="w-2.5 h-2.5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{profile?.total_quizzes || 0}</p>
              <p className="text-xs text-muted-foreground">Simulados</p>
              {profile && profile.total_quizzes > 0 && (
                <p className="text-[10px] text-primary/70 mt-1">
                  +{profile.total_questions} questões
                </p>
              )}
            </Card>
            
            <Card variant="glass" className="text-center p-4 group hover:scale-105 transition-transform duration-300">
              <div className="relative mx-auto w-10 h-10 mb-2 rounded-xl bg-accent/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-accent" />
                {accuracy >= 70 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                    <span className="text-[8px]">⭐</span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">Precisão</p>
              <p className="text-[10px] text-accent/70 mt-1">
                {accuracy >= 80 ? 'Excelente!' : accuracy >= 60 ? 'Muito bom!' : accuracy > 0 ? 'Continue!' : 'Comece já!'}
              </p>
            </Card>
            
            <Card variant="glass" className="text-center p-4 group hover:scale-105 transition-transform duration-300">
              <div className="relative mx-auto w-10 h-10 mb-2 rounded-xl bg-destructive/20 flex items-center justify-center">
                <Flame className={`w-5 h-5 text-destructive ${profile?.streak_days && profile.streak_days > 0 ? 'animate-pulse' : ''}`} />
                {profile?.streak_days && profile.streak_days >= 3 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                    <span className="text-[8px]">🔥</span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{profile?.streak_days || 0}</p>
              <p className="text-xs text-muted-foreground">Dias Seguidos</p>
              <p className="text-[10px] text-destructive/70 mt-1">
                {profile?.streak_days && profile.streak_days > 0 ? 'Não perca!' : 'Inicie sua sequência!'}
              </p>
            </Card>
          </div>

          {/* Streak Reminder Banner */}
          <div className="mt-4">
            <StreakReminderBanner />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-20 px-4 -mt-10 pb-8 space-y-6">
        {/* Usage Meter for Free Users */}
        {!isPremium && (
          <Card variant="elevated">
            <CardContent className="p-4">
              <UsageMeter questionsRemaining={questionsRemaining} dailyLimit={dailyLimit} />
            </CardContent>
          </Card>
        )}

        {/* Recent Achievements */}
        <RecentAchievementsCard />

        {/* Start Quiz CTA - Organic Style */}
        <div 
          className="relative cursor-pointer group"
          onClick={handleStartQuiz}
        >
          {/* Organic background blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-6 -right-4 w-28 h-28 bg-gradient-to-br from-accent/25 to-success/15 rounded-[55%_45%_40%_60%/50%_35%_65%_50%] blur-xl" />
            <div className="absolute -bottom-4 -left-2 w-20 h-20 bg-gradient-to-tr from-success/20 to-accent/10 rounded-[45%_55%_60%_40%/55%_50%_50%_45%] blur-lg" />
          </div>

          <div className="relative flex items-center gap-5 p-5 bg-gradient-to-br from-card/95 via-card/90 to-card/80 backdrop-blur-sm rounded-[1.5rem_2rem_1.5rem_2rem] border border-border/50 shadow-lg group-hover:shadow-xl group-hover:scale-[1.02] transition-all duration-500">
            
            {/* Play icon with organic shape */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-accent to-success rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-accent via-success to-accent rounded-[50%_50%_45%_55%/45%_55%_50%_50%] flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl">🎯</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-background rounded-full border-2 border-success shadow-md flex items-center justify-center">
                <Play className="w-3.5 h-3.5 text-success" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-accent/70 font-medium mb-0.5">Pronto para estudar?</p>
              <h3 className="font-display font-bold text-lg text-foreground group-hover:text-accent transition-colors duration-300">
                Iniciar Simulado
              </h3>
              <p className="text-sm text-muted-foreground">10 questões aleatórias 🚀</p>
            </div>

            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-accent/20 to-success/20 rounded-[45%_55%_50%_50%/50%_45%_55%_50%] flex items-center justify-center group-hover:bg-accent/30 group-hover:translate-x-1 transition-all duration-300">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>

          <div className="absolute -bottom-2 right-8 flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent/20" />
            <div className="w-2 h-2 rounded-full bg-success/30" />
            <div className="w-2 h-2 rounded-full bg-accent/40" />
          </div>
        </div>

        {/* AI Mentor Card - Organic Style */}
        <div 
          className="relative cursor-pointer group"
          onClick={() => navigate('/mentor')}
        >
          {/* Organic background blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-4 left-1/4 w-24 h-24 bg-gradient-to-br from-primary/25 to-accent/20 rounded-[60%_40%_50%_50%/45%_55%_45%_55%] blur-xl" />
            <div className="absolute -bottom-6 -right-4 w-28 h-28 bg-gradient-to-tr from-accent/20 to-primary/15 rounded-[45%_55%_35%_65%/50%_40%_60%_50%] blur-lg" />
          </div>

          <div className="relative flex items-center gap-5 p-5 bg-gradient-to-br from-card/95 via-primary/5 to-accent/5 backdrop-blur-sm rounded-[2rem_1.5rem_2rem_1.5rem] border border-primary/20 shadow-lg group-hover:shadow-xl group-hover:scale-[1.02] transition-all duration-500">
            
            {/* Bot icon with organic shape */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-primary via-accent to-primary rounded-[48%_52%_55%_45%/52%_48%_52%_48%] flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform duration-500">
                <span className="text-3xl">🤖</span>
              </div>
              <div className="absolute -top-2 -right-1 w-7 h-7 bg-background rounded-full border-2 border-primary shadow-md flex items-center justify-center group-hover:-translate-y-1 group-hover:rotate-12 transition-all duration-300">
                <span className="text-xs bg-primary/10 text-primary px-1 rounded font-bold">+</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs text-primary/70 font-medium">Exclusivo Plus</p>
                <span className="text-xs">✨</span>
              </div>
              <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                Mentor IA
              </h3>
              <p className="text-sm text-muted-foreground">Tire dúvidas com inteligência artificial</p>
            </div>

            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary/15 to-accent/15 rounded-[50%_50%_45%_55%/55%_45%_55%_45%] flex items-center justify-center group-hover:bg-primary/25 group-hover:translate-x-1 transition-all duration-300">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </div>

          <div className="absolute -bottom-2 left-12 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary/40" />
            <div className="w-2 h-2 rounded-full bg-accent/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
          </div>
        </div>

        {/* Daily Challenges */}
        <DailyChallengesCard />

        {/* Categories - Organic Grid */}
        <div>
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            <span>📚</span> Categorias
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {categories?.slice(0, 4).map((cat, index) => (
              <div 
                key={cat} 
                className="relative cursor-pointer group"
                onClick={() => handleCategoryClick(cat)}
              >
                {/* Subtle organic blob */}
                <div className="absolute inset-0 overflow-hidden">
                  <div 
                    className={`absolute w-16 h-16 blur-lg opacity-30 ${
                      index === 0 ? '-top-2 -left-2 bg-primary/40 rounded-[60%_40%_50%_50%]' :
                      index === 1 ? '-top-2 -right-2 bg-accent/40 rounded-[40%_60%_50%_50%]' :
                      index === 2 ? '-bottom-2 -left-2 bg-success/40 rounded-[50%_50%_60%_40%]' :
                      '-bottom-2 -right-2 bg-secondary/40 rounded-[50%_50%_40%_60%]'
                    }`} 
                  />
                </div>

                <div className={`relative p-4 bg-gradient-to-br from-card/95 to-card/85 backdrop-blur-sm border border-border/50 shadow-md group-hover:shadow-lg group-hover:scale-[1.03] transition-all duration-300 ${
                  index === 0 ? 'rounded-[1.5rem_1rem_1.5rem_1rem]' :
                  index === 1 ? 'rounded-[1rem_1.5rem_1rem_1.5rem]' :
                  index === 2 ? 'rounded-[1rem_1.5rem_1rem_1.5rem]' :
                  'rounded-[1.5rem_1rem_1.5rem_1rem]'
                }`}>
                  <div className={`w-10 h-10 mb-3 flex items-center justify-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] ${
                    index === 0 ? 'bg-primary/15' :
                    index === 1 ? 'bg-accent/15' :
                    index === 2 ? 'bg-success/15' :
                    'bg-secondary/15'
                  }`}>
                    <BookOpen className={`w-5 h-5 ${
                      index === 0 ? 'text-primary' :
                      index === 1 ? 'text-accent' :
                      index === 2 ? 'text-success' :
                      'text-secondary-foreground'
                    }`} />
                  </div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{cat}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade Card for Free Users */}
        {!isPremium && (
          <UpgradeCard onUpgrade={() => navigate('/upgrade')} />
        )}

        {/* Leaderboard Preview - Organic Style */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <span>🏆</span> Ranking
            </h2>
            <Link to="/ranking" className="text-sm text-primary font-medium hover:underline">Ver todos →</Link>
          </div>
          
          <div className="relative">
            {/* Background blobs */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-4 right-1/3 w-20 h-20 bg-gradient-to-br from-accent/15 to-primary/10 rounded-[50%_50%_45%_55%] blur-xl" />
              <div className="absolute -bottom-4 left-1/4 w-16 h-16 bg-gradient-to-tr from-primary/15 to-accent/10 rounded-[45%_55%_50%_50%] blur-lg" />
            </div>

            <div className="relative p-5 bg-gradient-to-br from-card/95 via-card/90 to-card/85 backdrop-blur-sm rounded-[1.5rem_2rem_1.5rem_2rem] border border-border/50 shadow-lg space-y-3">
              {leaderboard?.slice(0, 3).map((entry, index) => (
                <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-[1rem_1.5rem_1rem_1.5rem] transition-all duration-300 hover:bg-muted/30 ${
                  index === 0 ? 'bg-gradient-to-r from-accent/10 to-transparent' : ''
                }`}>
                  <div className={`w-10 h-10 flex items-center justify-center shadow-md ${
                    index === 0 ? 'bg-gradient-to-br from-accent to-amber-400 rounded-[45%_55%_50%_50%/55%_45%_55%_45%]' : 
                    index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 rounded-[50%_50%_45%_55%]' : 
                    'bg-gradient-to-br from-amber-600 to-amber-700 rounded-[55%_45%_50%_50%]'
                  }`}>
                    {index === 0 ? <span className="text-lg">👑</span> :
                     index === 1 ? <span className="text-lg">🥈</span> :
                     <span className="text-lg">🥉</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{entry.display_name}</p>
                  </div>
                  <p className="font-bold text-primary">{entry.score} pts</p>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                <p className="text-center text-muted-foreground py-4">Nenhum resultado ainda 🌱</p>
              )}
            </div>

            <div className="absolute -bottom-2 right-10 flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-accent/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
              <div className="w-2 h-2 rounded-full bg-accent/20" />
            </div>
          </div>
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
      
      {/* Milestone Celebration Modal */}
      <MilestoneModal />
    </div>
  );
}
