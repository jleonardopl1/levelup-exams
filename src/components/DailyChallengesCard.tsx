import { useEffect } from 'react';
import { 
  Play, 
  Target, 
  Trophy, 
  CheckCircle, 
  Brain, 
  Crown, 
  Star, 
  Clock, 
  Flame,
  Gift
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  useDailyChallenges, 
  useUserDailyChallenges, 
  useInitializeDailyChallenges,
  useClaimChallengeReward,
  getDifficultyColor,
  getDifficultyLabel,
  DailyChallenge,
  UserDailyChallenge
} from '@/hooks/useDailyChallenges';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  play: Play,
  target: Target,
  trophy: Trophy,
  'check-circle': CheckCircle,
  brain: Brain,
  crown: Crown,
  star: Star,
  clock: Clock,
  flame: Flame,
};

export function DailyChallengesCard() {
  const { data: challenges = [] } = useDailyChallenges();
  const { data: userChallenges = [], isLoading } = useUserDailyChallenges();
  const initializeChallenges = useInitializeDailyChallenges();
  const claimReward = useClaimChallengeReward();

  // Initialize challenges when component mounts
  useEffect(() => {
    if (challenges.length > 0 && userChallenges.length === 0 && !isLoading) {
      initializeChallenges.mutate();
    }
  }, [challenges.length, userChallenges.length, isLoading]);

  // Merge challenges with user progress
  const challengesWithProgress = challenges.map(challenge => {
    const userChallenge = userChallenges.find(uc => uc.challenge_id === challenge.id);
    return {
      ...challenge,
      currentProgress: userChallenge?.current_progress || 0,
      isCompleted: userChallenge?.is_completed || false,
      pointsClaimed: userChallenge?.points_claimed || false,
    };
  });

  const completedCount = challengesWithProgress.filter(c => c.isCompleted).length;
  const claimableCount = challengesWithProgress.filter(c => c.isCompleted && !c.pointsClaimed).length;

  if (isLoading) {
    return (
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Target className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Desafios Diários</CardTitle>
              <p className="text-xs text-muted-foreground">
                {completedCount}/{challenges.length} concluídos
              </p>
            </div>
          </div>
          {claimableCount > 0 && (
            <Badge variant="default" className="animate-pulse">
              {claimableCount} para resgatar
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-3">
          {challengesWithProgress.slice(0, 5).map((challenge) => (
            <ChallengeItem
              key={challenge.id}
              challenge={challenge}
              onClaim={() => claimReward.mutate(challenge.id)}
              isClaimLoading={claimReward.isPending}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ChallengeItemProps {
  challenge: DailyChallenge & {
    currentProgress: number;
    isCompleted: boolean;
    pointsClaimed: boolean;
  };
  onClaim: () => void;
  isClaimLoading: boolean;
}

function ChallengeItem({ challenge, onClaim, isClaimLoading }: ChallengeItemProps) {
  const Icon = iconMap[challenge.icon] || Target;
  const progress = Math.min((challenge.currentProgress / challenge.target_value) * 100, 100);

  return (
    <div className={cn(
      "p-3 rounded-xl border transition-all",
      challenge.isCompleted 
        ? challenge.pointsClaimed 
          ? "bg-muted/30 border-border opacity-60" 
          : "bg-success/5 border-success/30"
        : "bg-card border-border hover:border-primary/30"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
          challenge.isCompleted ? "bg-success/10" : "bg-muted"
        )}>
          {challenge.isCompleted ? (
            <CheckCircle className="w-5 h-5 text-success" />
          ) : (
            <Icon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-sm font-medium",
              challenge.pointsClaimed && "line-through text-muted-foreground"
            )}>
              {challenge.title}
            </span>
            <Badge 
              variant="outline" 
              className={cn("text-xs", getDifficultyColor(challenge.difficulty))}
            >
              {getDifficultyLabel(challenge.difficulty)}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground mb-2">{challenge.description}</p>
          
          {!challenge.isCompleted && (
            <div className="flex items-center gap-2">
              <Progress value={progress} className="flex-1 h-1.5" />
              <span className="text-xs text-muted-foreground">
                {challenge.currentProgress}/{challenge.target_value}
              </span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {challenge.isCompleted && !challenge.pointsClaimed ? (
            <Button 
              size="sm" 
              variant="gradient-success"
              onClick={onClaim}
              disabled={isClaimLoading}
              className="h-8"
            >
              <Gift className="w-4 h-4 mr-1" />
              +{challenge.points_reward}
            </Button>
          ) : (
            <Badge variant="secondary" className="font-mono">
              +{challenge.points_reward}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
