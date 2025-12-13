import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { 
  useUserRewards, 
  useAchievements, 
  useUserAchievements, 
  useRewardCatalog, 
  useUserRedemptions,
  useRedeemReward,
  useReferralCode,
  useCreateReferralCode,
  calculateLevel, 
  getPointsForNextLevel,
  getTierColor
} from '@/hooks/useRewards';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Gift, 
  Star, 
  Trophy,
  Zap,
  Flame,
  Clock,
  BookOpen,
  CheckCircle,
  Lock,
  Sparkles,
  Crown,
  Copy,
  Check,
  Users
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  'trophy': <Trophy className="w-5 h-5" />,
  'flame': <Flame className="w-5 h-5" />,
  'check-circle': <CheckCircle className="w-5 h-5" />,
  'zap': <Zap className="w-5 h-5" />,
  'book-open': <BookOpen className="w-5 h-5" />,
  'clock': <Clock className="w-5 h-5" />,
  'star': <Star className="w-5 h-5" />,
};

export default function Rewards() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = useProfile();
  const { data: rewards } = useUserRewards();
  const { data: achievements } = useAchievements();
  const { data: userAchievements } = useUserAchievements();
  const { data: catalog } = useRewardCatalog();
  const { data: redemptions } = useUserRedemptions();
  const { data: referralCode } = useReferralCode();
  const { isPremium, tier } = useQuestionLimits();
  const redeemReward = useRedeemReward();
  const createReferralCode = useCreateReferralCode();
  const navigate = useNavigate();

  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<typeof catalog extends (infer T)[] | null | undefined ? T : never | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

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

  const currentPoints = rewards?.total_points || 0;
  const currentLevel = rewards?.current_level || calculateLevel(currentPoints);
  const pointsForNext = getPointsForNextLevel(currentLevel);
  const levelProgress = (currentPoints / pointsForNext) * 100;

  const unlockedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || []);

  const handleRedeemClick = (reward: NonNullable<typeof catalog>[number]) => {
    setSelectedReward(reward);
    setRedeemDialogOpen(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;
    
    await redeemReward.mutateAsync({
      rewardId: selectedReward.id,
      pointsCost: selectedReward.points_cost,
    });
    
    setRedeemDialogOpen(false);
    setSelectedReward(null);
  };

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode.code);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleCreateReferralCode = async () => {
    if (!referralCodeInput.trim()) {
      toast.error('Digite um código');
      return;
    }
    await createReferralCode.mutateAsync(referralCodeInput.trim());
    setReferralCodeInput('');
  };

  // Check if user is a Top Player (has referral code or can create one)
  const isTopPlayer = !!referralCode || (currentPoints >= 10000 && isPremium);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Gift className="w-6 h-6 text-accent" />
              Recompensas
            </h1>
            <p className="text-sm text-muted-foreground">Ganhe pontos e resgate prêmios</p>
          </div>
        </div>

        {/* Points & Level Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/10" />
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center shadow-lg">
                  <Star className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seus Pontos</p>
                  <p className="font-display text-3xl font-bold text-accent">{currentPoints}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Nível</p>
                <p className="font-display text-2xl font-bold">{currentLevel}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Próximo nível</span>
                <span className="text-muted-foreground">{currentPoints}/{pointsForNext}</span>
              </div>
              <Progress value={levelProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="achievements">Conquistas</TabsTrigger>
            <TabsTrigger value="redeem">Resgatar</TabsTrigger>
            <TabsTrigger value="referral">Indicação</TabsTrigger>
          </TabsList>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            <div className="grid gap-3">
              {achievements?.map((achievement) => {
                const isUnlocked = unlockedIds.has(achievement.id);
                
                return (
                  <Card 
                    key={achievement.id}
                    className={`transition-all ${isUnlocked ? 'border-accent/50 bg-accent/5' : 'opacity-60'}`}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isUnlocked 
                          ? `bg-gradient-to-br ${getTierColor(achievement.tier)} text-white shadow-md` 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isUnlocked ? iconMap[achievement.icon] || <Star className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{achievement.name}</p>
                          <Badge variant="outline" className="text-xs capitalize">{achievement.tier}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-accent">+{achievement.points_reward}</p>
                        <p className="text-xs text-muted-foreground">pontos</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Redeem Tab */}
          <TabsContent value="redeem" className="space-y-4">
            <div className="grid gap-4">
              {catalog?.map((reward) => {
                const canAfford = currentPoints >= reward.points_cost;
                const isTierEligible = reward.available_for_tier === 'free' || 
                  (reward.available_for_tier === 'plus' && isPremium);
                const canRedeem = canAfford && isTierEligible;

                return (
                  <Card key={reward.id} className={!canRedeem ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            reward.reward_type === 'extra_questions' ? 'bg-primary/10' :
                            reward.reward_type === 'discount_coupon' ? 'bg-accent/10' :
                            reward.reward_type === 'free_trial' ? 'bg-success/10' :
                            'bg-gradient-to-br from-accent to-primary/50'
                          }`}>
                            {reward.reward_type === 'extra_questions' ? <Zap className="w-6 h-6 text-primary" /> :
                             reward.reward_type === 'discount_coupon' ? <Sparkles className="w-6 h-6 text-accent" /> :
                             reward.reward_type === 'free_trial' ? <Gift className="w-6 h-6 text-success" /> :
                             <Crown className="w-6 h-6 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{reward.name}</p>
                              {reward.available_for_tier === 'plus' && (
                                <Badge variant="secondary" className="text-xs">Plus</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{reward.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{reward.points_cost}</p>
                          <p className="text-xs text-muted-foreground mb-2">pontos</p>
                          <Button
                            size="sm"
                            disabled={!canRedeem}
                            onClick={() => handleRedeemClick(reward)}
                          >
                            {!isTierEligible ? 'Plus Only' : !canAfford ? 'Pontos insuf.' : 'Resgatar'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Redemption History */}
            {redemptions && redemptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Resgates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {redemptions.slice(0, 5).map((redemption) => (
                    <div key={redemption.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-sm">{redemption.reward?.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={redemption.status === 'active' ? 'default' : 'secondary'}>
                          {redemption.status === 'active' ? 'Ativo' : 'Usado'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(redemption.redeemed_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Referral Tab */}
          <TabsContent value="referral" className="space-y-4">
            {isTopPlayer ? (
              <>
                {referralCode ? (
                  <Card className="border-accent/50 bg-gradient-to-br from-accent/5 to-primary/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-accent" />
                        Seu Código de Top Player
                      </CardTitle>
                      <CardDescription>
                        Compartilhe e ganhe 3% de comissão em cada assinatura
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 p-4 bg-background rounded-xl border-2 border-dashed border-accent/50">
                          <p className="font-mono text-2xl font-bold text-center text-accent">
                            {referralCode.code}
                          </p>
                        </div>
                        <Button variant="outline" size="icon" onClick={handleCopyReferralCode}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-muted/50 rounded-xl text-center">
                          <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                          <p className="text-2xl font-bold">{referralCode.total_uses}</p>
                          <p className="text-xs text-muted-foreground">Indicações</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-xl text-center">
                          <Sparkles className="w-6 h-6 mx-auto mb-2 text-accent" />
                          <p className="text-2xl font-bold">R$ {Number(referralCode.total_earnings).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">Ganhos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-accent" />
                        Criar Código de Indicação
                      </CardTitle>
                      <CardDescription>
                        Você atingiu 10.000 pontos! Crie seu código personalizado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Seu código (ex: JOAO2024)"
                          value={referralCodeInput}
                          onChange={(e) => setReferralCodeInput(e.target.value.toUpperCase())}
                          maxLength={20}
                        />
                        <Button onClick={handleCreateReferralCode} disabled={createReferralCode.isPending}>
                          Criar
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Com seu código, você receberá 3% de comissão em cada nova assinatura que utilizar seu código.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="text-center">
                <CardContent className="py-12">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Crown className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">Torne-se um Top Player</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Acumule 10.000 pontos e seja assinante Plus para desbloquear seu código de indicação 
                    e ganhar comissões de 3% em cada nova assinatura.
                  </p>
                  <div className="space-y-2">
                    <Progress value={(currentPoints / 10000) * 100} className="h-2" />
                    <p className="text-sm text-muted-foreground">{currentPoints} / 10.000 pontos</p>
                  </div>
                  {!isPremium && (
                    <Button className="mt-4" onClick={() => navigate('/upgrade')}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Fazer Upgrade para Plus
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* How it works */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Como Funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Acumule Pontos</p>
                    <p className="text-sm text-muted-foreground">Complete quizzes, mantenha sequências e desbloqueie conquistas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Atinja 10.000 Pontos + Plus</p>
                    <p className="text-sm text-muted-foreground">Desbloqueie o status de Top Player</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Compartilhe seu Código</p>
                    <p className="text-sm text-muted-foreground">Ganhe 3% de comissão em cada assinatura</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Redeem Confirmation Dialog */}
      <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Resgate</DialogTitle>
            <DialogDescription>
              Você está prestes a resgatar "{selectedReward?.name}" por {selectedReward?.points_cost} pontos.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-sm text-muted-foreground">Seus pontos após o resgate:</p>
            <p className="text-2xl font-bold">{currentPoints - (selectedReward?.points_cost || 0)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmRedeem} disabled={redeemReward.isPending}>
              Confirmar Resgate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
