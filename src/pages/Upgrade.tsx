import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Crown, Check, Sparkles, Zap, BarChart3, FileText, Lock, Bot } from 'lucide-react';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { PremiumBadge } from '@/components/PremiumBadge';
import { toast } from 'sonner';

const features = {
  free: [
    { icon: Check, text: '30 questões por dia', included: true },
    { icon: Check, text: 'Categorias básicas', included: true },
    { icon: Check, text: 'Ranking global', included: true },
    { icon: Lock, text: 'Questões ilimitadas', included: false },
    { icon: Lock, text: 'Explicações em PDF', included: false },
    { icon: Lock, text: 'Estatísticas avançadas', included: false },
    { icon: Lock, text: 'Questões premium', included: false },
    { icon: Lock, text: 'Mentor IA (6 perguntas/dia)', included: false },
  ],
  plus: [
    { icon: Zap, text: 'Questões ilimitadas', included: true },
    { icon: Check, text: 'Todas as categorias', included: true },
    { icon: Check, text: 'Ranking global', included: true },
    { icon: FileText, text: 'Explicações em PDF', included: true },
    { icon: BarChart3, text: 'Estatísticas avançadas', included: true },
    { icon: Sparkles, text: 'Questões premium exclusivas', included: true },
    { icon: Bot, text: 'Mentor IA (6 perguntas/dia)', included: true },
    { icon: Crown, text: 'Acesso prioritário', included: true },
  ],
};

export default function Upgrade() {
  const navigate = useNavigate();
  const { tier, isPremium } = useQuestionLimits();

  const handleSubscribe = () => {
    // TODO: Integrate with Stripe
    toast.info('Integração com pagamento em breve!');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-90" />
        
        <div className="relative z-10 px-4 pt-6 pb-12">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="glass" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-display font-bold text-primary-foreground">Planos</h1>
          </div>
          
          <div className="text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-amber-300" />
            <h2 className="text-2xl font-display font-bold text-primary-foreground mb-2">
              Desbloqueie todo o potencial
            </h2>
            <p className="text-primary-foreground/80">
              Estude sem limites e acelere sua aprovação
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="px-4 -mt-6 pb-8 space-y-4">
        {/* Free Plan */}
        <Card variant={tier === 'free' ? 'elevated' : 'default'} className="relative">
          {tier === 'free' && (
            <div className="absolute -top-3 left-4 px-3 py-1 bg-muted text-muted-foreground text-xs font-bold rounded-full">
              PLANO ATUAL
            </div>
          )}
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Gratuito</span>
              <span className="text-2xl font-bold">R$ 0</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {features.free.map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <feature.icon className={`w-5 h-5 ${feature.included ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={feature.included ? '' : 'text-muted-foreground'}>{feature.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Plus Plan */}
        <Card 
          variant="elevated" 
          className="relative border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-primary/5"
        >
          {isPremium && (
            <div className="absolute -top-3 left-4">
              <PremiumBadge tier="plus" />
            </div>
          )}
          {!isPremium && (
            <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-white text-xs font-bold rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              RECOMENDADO
            </div>
          )}
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Plus
                <Crown className="w-5 h-5 text-amber-500" />
              </span>
              <div className="text-right">
                <span className="text-2xl font-bold">R$ 19,90</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {features.plus.map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <feature.icon className="w-5 h-5 text-amber-500" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            {!isPremium && (
              <Button 
                variant="hero" 
                size="xl" 
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500"
                onClick={handleSubscribe}
              >
                <Crown className="w-5 h-5 mr-2" />
                Assinar Plus
              </Button>
            )}

            {isPremium && (
              <div className="text-center text-sm text-muted-foreground">
                Você já é assinante Plus!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Annual Plan */}
        {!isPremium && (
          <Card variant="default" className="relative">
            <div className="absolute -top-3 right-4 px-3 py-1 bg-success text-success-foreground text-xs font-bold rounded-full">
              ECONOMIZE 33%
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Plus Anual
                  <Crown className="w-5 h-5 text-amber-500" />
                </span>
                <div className="text-right">
                  <span className="text-2xl font-bold">R$ 159,90</span>
                  <span className="text-sm text-muted-foreground">/ano</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Equivale a R$ 13,32/mês. Todos os benefícios do Plus com desconto especial.
              </p>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full"
                onClick={handleSubscribe}
              >
                Assinar Anual
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
