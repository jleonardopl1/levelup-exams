import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useAchievements, useUserAchievements } from '@/hooks/useRewards';
import { useUserRewards } from '@/hooks/useRewards';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Star, 
  Lock, 
  CheckCircle2, 
  Flame, 
  Target, 
  BookOpen, 
  Crown,
  Zap,
  Medal,
  Gift,
  Sparkles,
  TrendingUp,
  Award
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Tier configuration
const tierConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  bronze: { label: 'Bronze', color: 'text-amber-700', bgColor: 'from-amber-700/20 to-amber-600/10', icon: '🥉' },
  silver: { label: 'Prata', color: 'text-slate-400', bgColor: 'from-slate-400/20 to-slate-300/10', icon: '🥈' },
  gold: { label: 'Ouro', color: 'text-yellow-500', bgColor: 'from-yellow-500/20 to-amber-400/10', icon: '🥇' },
  platinum: { label: 'Platina', color: 'text-cyan-400', bgColor: 'from-cyan-400/20 to-blue-400/10', icon: '💠' },
  diamond: { label: 'Diamante', color: 'text-purple-400', bgColor: 'from-purple-500/20 to-pink-400/10', icon: '💎' },
};

// Icon mapping
const iconMap: Record<string, string> = {
  star: '⭐',
  trophy: '🏆',
  medal: '🥇',
  fire: '🔥',
  flame: '🔥',
  zap: '⚡',
  target: '🎯',
  book: '📚',
  crown: '👑',
  rocket: '🚀',
  gem: '💎',
  heart: '❤️',
  lightning: '⚡',
  award: '🏅',
  gift: '🎁',
  sparkles: '✨',
};

export default function Achievements() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useProfile();
  const { data: achievements } = useAchievements();
  const { data: userAchievements } = useUserAchievements();
  const { data: rewards } = useUserRewards();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<string>('all');

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

  // Get unlocked achievement IDs
  const unlockedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || []);
  
  // Calculate stats
  const totalAchievements = achievements?.length || 0;
  const unlockedCount = unlockedIds.size;
  const progressPercent = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;
  const totalPoints = userAchievements?.reduce((sum, ua) => sum + (ua.achievement?.points_reward || 0), 0) || 0;

  // Get current progress for each achievement type
  const getProgress = (type: string, value: number): { current: number; percent: number } => {
    let current = 0;
    
    switch (type) {
      case 'quizzes_completed':
        current = profile?.total_quizzes || 0;
        break;
      case 'correct_answers':
        current = profile?.total_correct || 0;
        break;
      case 'streak_days':
        current = profile?.streak_days || 0;
        break;
      case 'total_points':
        current = rewards?.total_points || 0;
        break;
      case 'level':
        current = rewards?.current_level || 1;
        break;
      case 'accuracy':
        current = profile && profile.total_questions > 0 
          ? Math.round((profile.total_correct / profile.total_questions) * 100)
          : 0;
        break;
      default:
        current = 0;
    }

    const percent = Math.min((current / value) * 100, 100);
    return { current, percent };
  };

  // Filter achievements by tier
  const filteredAchievements = achievements?.filter(a => 
    selectedTier === 'all' || a.tier === selectedTier
  ) || [];

  // Sort: unlocked first, then by tier
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aUnlocked = unlockedIds.has(a.id);
    const bUnlocked = unlockedIds.has(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-background px-4 py-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-accent/20 to-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-primary/15 to-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
              <Trophy className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Conquistas</h1>
              <p className="text-muted-foreground">Desbloqueie medalhas e ganhe pontos</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center bg-card/80 backdrop-blur-sm border-border/50">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-accent/20 flex items-center justify-center">
                <Medal className="w-5 h-5 text-accent" />
              </div>
              <p className="text-2xl font-bold">{unlockedCount}</p>
              <p className="text-xs text-muted-foreground">Desbloqueadas</p>
            </Card>
            <Card className="p-4 text-center bg-card/80 backdrop-blur-sm border-border/50">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold">{totalAchievements}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </Card>
            <Card className="p-4 text-center bg-card/80 backdrop-blur-sm border-border/50">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-success/20 flex items-center justify-center">
                <Star className="w-5 h-5 text-success" />
              </div>
              <p className="text-2xl font-bold">{totalPoints}</p>
              <p className="text-xs text-muted-foreground">Pontos</p>
            </Card>
          </div>

          {/* Overall Progress */}
          <div className="mt-6 p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso Geral</span>
              <span className="text-sm text-muted-foreground">{unlockedCount}/{totalAchievements}</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {progressPercent.toFixed(0)}% das conquistas desbloqueadas
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Tier Tabs */}
        <Tabs value={selectedTier} onValueChange={setSelectedTier} className="mb-6">
          <TabsList className="w-full grid grid-cols-6 h-auto p-1">
            <TabsTrigger value="all" className="text-xs py-2">Todas</TabsTrigger>
            <TabsTrigger value="bronze" className="text-xs py-2">🥉</TabsTrigger>
            <TabsTrigger value="silver" className="text-xs py-2">🥈</TabsTrigger>
            <TabsTrigger value="gold" className="text-xs py-2">🥇</TabsTrigger>
            <TabsTrigger value="platinum" className="text-xs py-2">💠</TabsTrigger>
            <TabsTrigger value="diamond" className="text-xs py-2">💎</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Achievements Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {sortedAchievements.map((achievement) => {
            const isUnlocked = unlockedIds.has(achievement.id);
            const userAchievement = userAchievements?.find(ua => ua.achievement_id === achievement.id);
            const progress = getProgress(achievement.requirement_type, achievement.requirement_value);
            const tier = tierConfig[achievement.tier] || tierConfig.bronze;

            return (
              <Card 
                key={achievement.id}
                className={`relative overflow-hidden transition-all duration-300 ${
                  isUnlocked 
                    ? 'bg-gradient-to-br ' + tier.bgColor + ' border-primary/30 shadow-md' 
                    : 'bg-card/50 border-border/50 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Unlock indicator */}
                {isUnlocked && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                      isUnlocked 
                        ? 'bg-gradient-to-br from-primary to-accent shadow-lg' 
                        : 'bg-muted/50'
                    }`}>
                      <span className={`text-2xl ${!isUnlocked ? 'grayscale opacity-50' : ''}`}>
                        {iconMap[achievement.icon] || '🏆'}
                      </span>
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-2xl">
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      {/* Tier badge */}
                      <div className="absolute -bottom-1 -right-1 text-sm">
                        {tier.icon}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {achievement.name}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {achievement.description}
                      </p>
                      
                      {/* Points */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isUnlocked ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          +{achievement.points_reward} pts
                        </span>
                        <span className={`text-xs ${tier.color}`}>
                          {tier.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar (only for locked achievements) */}
                  {!isUnlocked && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-medium">
                          {progress.current}/{achievement.requirement_value}
                        </span>
                      </div>
                      <Progress value={progress.percent} className="h-2" />
                    </div>
                  )}

                  {/* Unlocked date */}
                  {isUnlocked && userAchievement && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Desbloqueada {formatDistanceToNow(new Date(userAchievement.unlocked_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {sortedAchievements.length === 0 && (
          <div className="text-center py-12">
            <Award className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma conquista nesta categoria</p>
          </div>
        )}

        {/* Back to rewards button */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/rewards')}
            className="gap-2"
          >
            <Gift className="w-4 h-4" />
            Ver Recompensas
          </Button>
        </div>
      </div>
    </div>
  );
}
