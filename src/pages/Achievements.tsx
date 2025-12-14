import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useAchievements, useUserAchievements, Achievement } from '@/hooks/useRewards';
import { useUserRewards } from '@/hooks/useRewards';
import { AppHeader } from '@/components/AppHeader';
import { AchievementShareModal } from '@/components/AchievementShareModal';
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
  Award,
  Share2,
  HelpCircle,
  Eye
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
  secret: { label: 'Secreta', color: 'text-violet-500', bgColor: 'from-violet-500/20 to-purple-400/10', icon: '🔮' },
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
  secret: '🔮',
};

// Secret achievement codes (these achievements are hidden until unlocked)
const SECRET_ACHIEVEMENT_CODES = [
  'perfect_quiz',      // Complete a quiz with 100% accuracy
  'speed_demon',       // Complete a quiz in under 2 minutes
  'night_owl',         // Complete a quiz between midnight and 5am
  'early_bird',        // Complete a quiz between 5am and 7am
  'streak_master',     // Reach a 30-day streak
  'point_collector',   // Reach 10,000 points
  'quiz_veteran',      // Complete 100 quizzes
];

export default function Achievements() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useProfile();
  const { data: achievements } = useAchievements();
  const { data: userAchievements } = useUserAchievements();
  const { data: rewards } = useUserRewards();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  // Check if an achievement is secret
  const isSecretAchievement = (code: string) => SECRET_ACHIEVEMENT_CODES.includes(code);

  // Handle share button click
  const handleShare = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setShareModalOpen(true);
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

  // Filter achievements by tier (including secret filter)
  const filteredAchievements = achievements?.filter(a => {
    if (selectedTier === 'all') return true;
    if (selectedTier === 'secret') return isSecretAchievement(a.code);
    return a.tier === selectedTier;
  }) || [];

  // Sort: unlocked first, then by tier
  const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aUnlocked = unlockedIds.has(a.id);
    const bUnlocked = unlockedIds.has(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
  });

  // Count secret achievements
  const secretAchievementsCount = achievements?.filter(a => isSecretAchievement(a.code)).length || 0;
  const unlockedSecretCount = achievements?.filter(a => 
    isSecretAchievement(a.code) && unlockedIds.has(a.id)
  ).length || 0;

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
          <TabsList className="w-full grid grid-cols-7 h-auto p-1">
            <TabsTrigger value="all" className="text-xs py-2">Todas</TabsTrigger>
            <TabsTrigger value="bronze" className="text-xs py-2">🥉</TabsTrigger>
            <TabsTrigger value="silver" className="text-xs py-2">🥈</TabsTrigger>
            <TabsTrigger value="gold" className="text-xs py-2">🥇</TabsTrigger>
            <TabsTrigger value="platinum" className="text-xs py-2">💠</TabsTrigger>
            <TabsTrigger value="diamond" className="text-xs py-2">💎</TabsTrigger>
            <TabsTrigger value="secret" className="text-xs py-2 relative">
              🔮
              {secretAchievementsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {unlockedSecretCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Secret achievements hint */}
        {selectedTier === 'secret' && (
          <Card className="mb-6 p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/5 border-violet-500/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Conquistas Secretas</h4>
                <p className="text-sm text-muted-foreground">
                  Estas conquistas são reveladas apenas quando você as desbloqueia! 
                  Continue explorando o app para descobrir todas elas.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Achievements Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {sortedAchievements.map((achievement) => {
            const isUnlocked = unlockedIds.has(achievement.id);
            const userAchievement = userAchievements?.find(ua => ua.achievement_id === achievement.id);
            const progress = getProgress(achievement.requirement_type, achievement.requirement_value);
            const isSecret = isSecretAchievement(achievement.code);
            const tier = isSecret && !isUnlocked 
              ? tierConfig.secret 
              : (tierConfig[achievement.tier] || tierConfig.bronze);

            // For secret achievements that are not unlocked, hide details
            const showDetails = !isSecret || isUnlocked;

            return (
              <Card 
                key={achievement.id}
                className={`relative overflow-hidden transition-all duration-300 ${
                  isUnlocked 
                    ? 'bg-gradient-to-br ' + tier.bgColor + ' border-primary/30 shadow-md' 
                    : isSecret
                      ? 'bg-gradient-to-br from-violet-900/20 to-purple-900/10 border-violet-500/20'
                      : 'bg-card/50 border-border/50 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Unlock indicator or share button */}
                {isUnlocked && (
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => handleShare(achievement)}
                      className="w-7 h-7 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                )}

                {/* Secret badge for locked secret achievements */}
                {isSecret && !isUnlocked && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/30 text-violet-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Secreta
                    </span>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                      isUnlocked 
                        ? 'bg-gradient-to-br from-primary to-accent shadow-lg' 
                        : isSecret
                          ? 'bg-gradient-to-br from-violet-500/30 to-purple-500/20'
                          : 'bg-muted/50'
                    }`}>
                      {showDetails ? (
                        <span className={`text-2xl ${!isUnlocked ? 'grayscale opacity-50' : ''}`}>
                          {iconMap[achievement.icon] || '🏆'}
                        </span>
                      ) : (
                        <span className="text-2xl">🔮</span>
                      )}
                      {!isUnlocked && !isSecret && (
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
                          {showDetails ? achievement.name : '???'}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {showDetails 
                          ? achievement.description 
                          : 'Continue usando o app para descobrir esta conquista secreta!'
                        }
                      </p>
                      
                      {/* Points */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isUnlocked ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                        }`}>
                          {showDetails ? `+${achievement.points_reward} pts` : '??? pts'}
                        </span>
                        <span className={`text-xs ${tier.color}`}>
                          {tier.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar (only for locked non-secret achievements) */}
                  {!isUnlocked && !isSecret && (
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

                  {/* Mystery progress for secret achievements */}
                  {!isUnlocked && isSecret && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-violet-400">Progresso oculto</span>
                        <span className="font-medium text-violet-300">???</span>
                      </div>
                      <div className="h-2 rounded-full bg-violet-500/20 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Unlocked date and share for unlocked achievements */}
                  {isUnlocked && userAchievement && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
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

      {/* Achievement Share Modal */}
      <AchievementShareModal 
        achievement={selectedAchievement}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
      />
    </div>
  );
}
