import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Crown, Check, Sparkles, Zap, BarChart3, FileText, Lock, Bot, Settings, Loader2, Ticket, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { clearStoredReferralCode, getStoredReferralCode, REFERRAL_CODE_RE, storeReferralCode } from '@/hooks/useAffiliates';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { useSubscription, useCreateCheckout, useCustomerPortal, PRICE_IDS } from '@/hooks/useSubscription';
import { PremiumBadge } from '@/components/PremiumBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tier, isPremium } = useQuestionLimits();
  const { data: subscription, refetch: refetchSubscription } = useSubscription();
  const createCheckout = useCreateCheckout();
  const customerPortal = useCustomerPortal();
  const queryClient = useQueryClient();
  const [referralInput, setReferralInput] = useState(() => getStoredReferralCode() ?? '');
  const [referral, setReferral] = useState<{ code: string; discount: number } | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [checkingReferral, setCheckingReferral] = useState(false);

  const applyReferral = async (raw: string, silent = false) => {
    const code = raw.trim().toUpperCase();
    setReferralError(null);
    if (!REFERRAL_CODE_RE.test(code)) {
      setReferral(null);
      if (!silent) setReferralError('Código inválido: use de 4 a 20 letras ou números.');
      return;
    }
    setCheckingReferral(true);
    const { data, error } = await supabase.rpc('validate_referral_code', { code_to_validate: code });
    setCheckingReferral(false);
    const match = !error && data?.[0];
    if (match) {
      setReferral({ code: match.code, discount: match.discount_percent });
      storeReferralCode(match.code);
    } else {
      setReferral(null);
      if (!silent) setReferralError('Código não encontrado ou inativo.');
    }
  };

  // Código vindo de um link de afiliado (?ref=): valida automaticamente.
  useEffect(() => {
    const stored = getStoredReferralCode();
    if (user && stored && !isPremium) void applyReferral(stored, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isPremium]);

  const removeReferral = () => {
    setReferral(null);
    setReferralInput('');
    setReferralError(null);
    clearStoredReferralCode();
  };

  // Handle success/cancel from Stripe
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      clearStoredReferralCode();
      toast.success('Assinatura realizada com sucesso! Bem-vindo ao Plus!');
      refetchSubscription();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      // Clean URL
      window.history.replaceState({}, '', '/upgrade');
    } else if (canceled === 'true') {
      toast.info('Assinatura cancelada');
      window.history.replaceState({}, '', '/upgrade');
    }
  }, [searchParams, refetchSubscription, queryClient]);

  const handleSubscribe = (priceId: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar');
      navigate('/auth');
      return;
    }
    createCheckout.mutate({ priceId, referralCode: referral?.code });
  };

  const handleManageSubscription = () => {
    customerPortal.mutate();
  };

  const isLoading = createCheckout.isPending || customerPortal.isPending;

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
        {/* Referral / affiliate code */}
        {!isPremium && user && (
          <Card variant="default">
            <CardContent className="p-4 space-y-2">
              <label htmlFor="referral-code" className="text-sm font-medium flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" /> Código de indicação
              </label>
              {referral ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                  <span className="text-sm">
                    <span className="font-mono font-bold">{referral.code}</span> aplicado
                    {referral.discount > 0 && <> — <strong>{referral.discount}% de desconto</strong> na primeira cobrança</>}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeReferral} aria-label="Remover código">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="referral-code"
                    placeholder="Ex.: JOAO10"
                    value={referralInput}
                    maxLength={20}
                    autoComplete="off"
                    className="font-mono uppercase"
                    onChange={(e) => { setReferralInput(e.target.value.toUpperCase()); setReferralError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void applyReferral(referralInput); }}
                  />
                  <Button variant="outline" onClick={() => applyReferral(referralInput)} disabled={!referralInput || checkingReferral}>
                    {checkingReferral ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                  </Button>
                </div>
              )}
              {referralError && <p className="text-xs text-destructive">{referralError}</p>}
            </CardContent>
          </Card>
        )}

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
                onClick={() => handleSubscribe(PRICE_IDS.monthly)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Crown className="w-5 h-5 mr-2" />
                )}
                Assinar Plus
              </Button>
            )}

            {isPremium && (
              <div className="space-y-3">
                <div className="text-center text-sm text-muted-foreground">
                  Você já é assinante Plus!
                  {subscription?.subscription_end && (
                    <p className="mt-1">
                      Renova em: {new Date(subscription.subscription_end).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full"
                  onClick={handleManageSubscription}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4 mr-2" />
                  )}
                  Gerenciar Assinatura
                </Button>
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
                onClick={() => handleSubscribe(PRICE_IDS.annual)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Assinar Anual
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
