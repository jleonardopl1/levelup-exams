import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Crown, Check, Sparkles, Lock, Settings, Loader2, Ticket, X, CalendarCheck, QrCode, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { FREE_BENEFITS, PLUS_BENEFITS, PRICES } from '@/config/plans';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { clearStoredReferralCode, getStoredReferralCode, REFERRAL_CODE_RE, storeReferralCode } from '@/hooks/useAffiliates';
import { useQuestionLimits } from '@/hooks/useDailyUsage';
import { useProfile } from '@/hooks/useProfile';
import {
  useSubscription, useCreateCheckout, useCustomerPortal, useExamPassOffer, syncSubscription, type SubscriptionPlan,
  useMpOffer, useMpCheckout, useMyPaymentOrders, syncMpOrder, type MpOrderStatus, type MpProduct,
} from '@/hooks/useSubscription';
import { checkoutRedirectUrl, installmentHint, orderOutcome, renewalOpen } from '@/lib/checkout';
import { PremiumBadge } from '@/components/PremiumBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useSeo } from '@/hooks/useSeo';


export default function Upgrade() {
  const navigate = useNavigate();
  useSeo({
    title: 'Plano Plus e Passe Concurso',
    description: 'Compare o plano gratuito e o Plus do LevelUp Exams: questões e Simulados Oficiais ilimitados, revisão espaçada de todos os erros, correção da discursiva e Mentor IA.',
    path: '/upgrade',
  });
  const [searchParams] = useSearchParams();
  const { user, session } = useAuth();
  const stripeReturnHandled = useRef(false);
  const { tier, isPremium } = useQuestionLimits();
  const { data: subscription } = useSubscription();
  const { data: profile } = useProfile();
  // Há assinatura paga para gerenciar no portal? Vem do plano PAGO (billing_tier), não da
  // origem do acesso: o admin master ou quem tem Plus liberado também pode estar pagando.
  const hasPaidPlan = (subscription?.billing_tier ?? profile?.billing_tier) === 'plus';
  const createCheckout = useCreateCheckout();
  const { data: examPass } = useExamPassOffer(!!user && !isPremium);
  // Mercado Pago: Pix ou cartão parcelado, sem renovação automática (anual pré-pago e Passe).
  const canRenewMp = !hasPaidPlan && subscription?.paid_product === 'plus_annual' && renewalOpen(subscription?.paid_until);
  const { data: mpAnnual } = useMpOffer('plus_annual', !!user && (!isPremium || canRenewMp));
  const { data: mpPass } = useMpOffer('exam_pass', !!user && !isPremium);
  const mpCheckout = useMpCheckout();
  const { data: myOrders } = useMyPaymentOrders(!!user);
  const openOrder = myOrders?.find((o) => (o.status === 'created' || o.status === 'pending') && checkoutRedirectUrl(o.checkout_url));
  const [mpReturn, setMpReturn] = useState<MpOrderStatus | null>(null);
  const [mpRechecking, setMpRechecking] = useState(false);
  const mpReturnHandled = useRef(false);
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtMoney = (cents: number, currency = 'BRL') =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });
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

  // Retorno do Stripe. O webhook pode levar alguns segundos (ou minutos, em pagamentos
  // assíncronos): confirmamos o plano direto no Stripe e repetimos por ~30s antes de
  // atualizar o perfil, em vez de recarregar o perfil antes da confirmação.
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    if (success !== 'true' && canceled !== 'true') return;
    // Espera a sessão ser restaurada após o redirecionamento antes de confirmar.
    if (!session?.access_token) return;
    if (stripeReturnHandled.current) return;
    stripeReturnHandled.current = true;
    window.history.replaceState({}, '', '/upgrade');

    if (canceled === 'true') {
      toast.info('Pagamento não concluído. Você pode assinar quando quiser.');
      return;
    }

    clearStoredReferralCode();
    let cancelled = false;
    const toastId = toast.loading('Confirmando seu pagamento...');
    (async () => {
      for (let attempt = 0; attempt < 10 && !cancelled; attempt++) {
        const status = await syncSubscription(session.access_token);
        if (status?.tier === 'plus') {
          queryClient.setQueryData(['subscription', session.user.id], status);
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          toast.success('Assinatura confirmada! Bem-vindo ao Plus!', { id: toastId });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        toast.info('Pagamento recebido pelo Stripe. A liberação do Plus pode levar alguns minutos — atualize esta página em instantes.', { id: toastId, duration: 10000 });
      }
    })();
    return () => {
      cancelled = true;
      stripeReturnHandled.current = false; // StrictMode remonta o efeito: deixa a 2ª execução seguir
      toast.dismiss(toastId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session?.user?.id]);

  // Volta do Mercado Pago (/upgrade?pedido=<id>). Os parâmetros que o Mercado Pago acrescenta
  // à URL não valem nada: o servidor confere o pedido na API. Pix pode levar alguns segundos,
  // então a tela consulta de novo por até 2 minutos.
  useEffect(() => {
    const orderId = searchParams.get('pedido');
    if (!orderId || !session?.access_token) return;
    if (mpReturnHandled.current) return;
    mpReturnHandled.current = true;
    window.history.replaceState({}, '', '/upgrade');

    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        const status = await syncMpOrder(session.access_token, orderId);
        if (cancelled) return;
        if (status) {
          setMpReturn(status);
          const outcome = orderOutcome(status.order.status);
          if (outcome === 'approved') {
            clearStoredReferralCode();
            await queryClient.invalidateQueries({ queryKey: ['subscription'] });
            await queryClient.invalidateQueries({ queryKey: ['profile'] });
          }
          if (outcome !== 'waiting') break;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      if (!cancelled) void queryClient.invalidateQueries({ queryKey: ['my-payment-orders'] });
    })();
    return () => {
      cancelled = true;
      mpReturnHandled.current = false; // StrictMode remonta o efeito: deixa a 2ª execução seguir
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session?.user?.id]);

  const recheckMpOrder = async () => {
    if (!mpReturn || !session?.access_token) return;
    setMpRechecking(true);
    const status = await syncMpOrder(session.access_token, mpReturn.order.id);
    setMpRechecking(false);
    if (!status) {
      toast.error('Não foi possível consultar o pagamento agora. Tente de novo em instantes.');
      return;
    }
    setMpReturn(status);
    if (orderOutcome(status.order.status) === 'approved') {
      clearStoredReferralCode();
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  };

  const handleMpCheckout = (product: MpProduct, trackId?: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para pagar');
      navigate('/auth');
      return;
    }
    mpCheckout.mutate(
      { product, referralCode: referral?.code, trackId },
      {
        onError: (error) => {
          if ((error as Error & { code?: string }).code === 'referral_invalid') removeReferral();
        },
      },
    );
  };

  const handleSubscribe = (plan: SubscriptionPlan) => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar');
      navigate('/auth');
      return;
    }
    createCheckout.mutate(
      { plan, referralCode: referral?.code },
      {
        onError: (error) => {
          // Código recusado no servidor (ex.: já usado antes): remove para não travar a compra.
          if ((error as Error & { code?: string }).code === 'referral_invalid') removeReferral();
        },
      },
    );
  };

  const handleManageSubscription = () => {
    customerPortal.mutate();
  };

  // Bloqueia a assinatura enquanto o código de indicação é validado: um checkout criado
  // antes disso sairia sem desconto e sem atribuição ao afiliado.
  const isLoading = createCheckout.isPending || customerPortal.isPending || mpCheckout.isPending || checkingReferral;

  const stripePass = examPass?.available && examPass.amount_cents && examPass.track && examPass.access_until ? examPass : null;
  const mpPassOffer = mpPass?.available && mpPass.amount_cents && mpPass.track && mpPass.access_until ? mpPass : null;
  const passInfo = stripePass ?? mpPassOffer;
  const mpAnnualOffer = mpAnnual?.available && mpAnnual.amount_cents ? mpAnnual : null;
  const mpLabel = (offer: { max_installments?: number }) =>
    (offer.max_installments ?? 1) > 1 ? `Pagar com Pix ou em até ${offer.max_installments}x` : 'Pagar com Pix ou cartão';
  const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
  const mpHint = (offer: { amount_cents?: number; max_installments?: number; interest_free_installments?: number }) =>
    installmentHint(offer.amount_cents ?? 0, offer.max_installments ?? 1, offer.interest_free_installments ?? 1);

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
        {mpReturn && (
          <MpReturnCard
            status={mpReturn}
            rechecking={mpRechecking}
            onRecheck={recheckMpOrder}
            onClose={() => setMpReturn(null)}
            fmtDay={fmtDay}
          />
        )}

        {!mpReturn && !isPremium && openOrder && (
          <Card variant="default" className="border-primary/40">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <p className="text-sm">
                Você tem um pagamento em aberto ({openOrder.product === 'exam_pass' ? 'Passe Concurso' : 'Plus anual'},{' '}
                {fmtMoney(openOrder.amount_cents)}).
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { const url = checkoutRedirectUrl(openOrder.checkout_url); if (url) window.location.assign(url); }}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

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
              {FREE_BENEFITS.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0" />
                  <span>{feature.text}</span>
                </li>
              ))}
              <li className="flex items-center gap-3 text-muted-foreground">
                <Lock className="w-5 h-5 shrink-0" />
                <span>Mentor IA, correção da discursiva e PDF são do Plus</span>
              </li>
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
                <span className="text-2xl font-bold">{PRICES.monthly}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {PLUS_BENEFITS.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3">
                  <feature.icon className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>

            {!isPremium && (
              <Button 
                variant="hero" 
                size="xl" 
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500"
                onClick={() => handleSubscribe('monthly')}
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

            {isPremium && !hasPaidPlan && (
              <div className="text-center text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  {subscription?.source === 'master'
                    ? 'Plus permanente da conta administradora.'
                    : subscription?.source === 'mercadopago'
                      ? (subscription.paid_product === 'exam_pass' ? 'Seu Passe Concurso está ativo.' : 'Seu Plus anual está ativo.')
                      : subscription?.grant_kind === 'exam_pass'
                        ? 'Seu Passe Concurso está ativo.'
                        : 'Seu acesso Plus foi liberado pela equipe LevelUp.'}
                </p>
                {(subscription?.source === 'grant' || subscription?.source === 'mercadopago') && (
                  <p>
                    {subscription.access_until
                      ? `Válido até ${new Date(subscription.access_until).toLocaleDateString('pt-BR')}.`
                      : 'Sem prazo de validade.'}
                  </p>
                )}
                <p>
                  {subscription?.source === 'mercadopago'
                    ? 'Pago pelo Mercado Pago, sem renovação automática.'
                    : subscription?.grant_kind === 'exam_pass'
                      ? 'Pagamento único: não há renovação automática.'
                      : 'Todas as funcionalidades do plano estão ativas, sem cobrança.'}
                </p>
                {canRenewMp && mpAnnualOffer && (
                  <div className="pt-2 space-y-1.5">
                    <Button variant="outline" size="lg" className="w-full" onClick={() => handleMpCheckout('plus_annual')} disabled={isLoading}>
                      {mpCheckout.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                      Renovar por mais 12 meses
                    </Button>
                    <p className="text-xs">
                      {fmtMoney(mpAnnualOffer.amount_cents!)} no Pix ou no cartão. Os 12 meses novos começam quando o período atual terminar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isPremium && hasPaidPlan && (
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

        {/* Passe Concurso (pagamento único até a prova) */}
        {!isPremium && passInfo && (
          <Card variant="default" className="relative border-primary/40">
            <div className="absolute -top-3 right-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
              SEM RENOVAÇÃO
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  Passe Concurso
                  <CalendarCheck className="w-5 h-5 text-primary" />
                </span>
                <span className="text-2xl font-bold">{fmtMoney(passInfo.amount_cents!, passInfo.currency)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Todo o Plus até {fmtDay(passInfo.access_until!)}: a prova de {passInfo.track!.shortName} em{' '}
                {fmtDay(`${passInfo.track!.examDate}T12:00:00`)} e mais 15 dias para conferir o gabarito.
                Pagamento único, sem assinatura para cancelar.
              </p>
              {stripePass && (
                <Button variant="outline" size="lg" className="w-full" onClick={() => handleSubscribe('exam_pass')} disabled={isLoading}>
                  {createCheckout.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {mpPassOffer ? 'Pagar no cartão' : 'Comprar Passe Concurso'}
                </Button>
              )}
              {mpPassOffer && (
                <div className="space-y-1.5">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    aria-label={`Passe Concurso: ${lowerFirst(mpLabel(mpPassOffer))}`}
                    onClick={() => handleMpCheckout('exam_pass', mpPassOffer.track!.id)}
                    disabled={isLoading}
                  >
                    {mpCheckout.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                    {mpLabel(mpPassOffer)}
                    {stripePass && stripePass.amount_cents !== mpPassOffer.amount_cents ? ` · ${fmtMoney(mpPassOffer.amount_cents!)}` : ''}
                  </Button>
                  {mpHint(mpPassOffer) && <p className="text-xs text-muted-foreground text-center">Pelo Mercado Pago, {mpHint(mpPassOffer)}.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                  <span className="text-2xl font-bold">{PRICES.annual}</span>
                  <span className="text-sm text-muted-foreground">/ano</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Equivale a {PRICES.annualPerMonth}/mês. Todos os benefícios do Plus com desconto especial.
              </p>
              {mpAnnualOffer && (
                <div className="mb-3 space-y-1.5">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    aria-label={`Plus anual: ${lowerFirst(mpLabel(mpAnnualOffer))}`}
                    onClick={() => handleMpCheckout('plus_annual')}
                    disabled={isLoading}
                  >
                    {mpCheckout.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                    {mpLabel(mpAnnualOffer)}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {fmtMoney(mpAnnualOffer.amount_cents!)} por 12 meses de Plus, sem renovação automática
                    {mpHint(mpAnnualOffer) ? ` · ${mpHint(mpAnnualOffer)}` : ''}.
                  </p>
                </div>
              )}
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full"
                onClick={() => handleSubscribe('annual')}
                disabled={isLoading}
              >
                {createCheckout.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {mpAnnualOffer ? 'Assinar no cartão · renova todo ano' : 'Assinar Anual'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Situação do pagamento do Mercado Pago na volta do checkout. */
function MpReturnCard({ status, rechecking, onRecheck, onClose, fmtDay }: {
  status: MpOrderStatus;
  rechecking: boolean;
  onRecheck: () => void;
  onClose: () => void;
  fmtDay: (iso: string) => string;
}) {
  const outcome = orderOutcome(status.order.status);
  const until = status.access.access_until ?? status.access.paid_until;
  const resumeUrl = checkoutRedirectUrl(status.order.checkout_url);
  const content = {
    approved: {
      icon: CheckCircle2,
      tone: 'border-success/40 bg-success/5',
      title: 'Pagamento confirmado!',
      text: until ? `Seu Plus vale até ${fmtDay(until)}.` : 'Seu Plus já está ativo.',
    },
    waiting: {
      icon: Clock,
      tone: 'border-primary/40',
      title: 'Estamos esperando a confirmação do pagamento.',
      text: 'No Pix, a confirmação costuma chegar poucos segundos depois que você paga no app do banco.',
    },
    failed: {
      icon: AlertCircle,
      tone: 'border-destructive/40',
      title: 'O pagamento não foi aprovado.',
      text: 'Tente outro cartão ou pague com Pix.',
    },
    expired: {
      icon: AlertCircle,
      tone: 'border-amber-500/40',
      title: 'O prazo deste pagamento acabou.',
      text: 'Gere outro quando quiser. Se você já pagou, o Plus é liberado assim que o pagamento for confirmado.',
    },
    reversed: {
      icon: AlertCircle,
      tone: 'border-amber-500/40',
      title: 'Este pagamento foi estornado.',
      text: 'Se tiver dúvida sobre o estorno, fale com o suporte do LevelUp.',
    },
  }[outcome];
  const Icon = content.icon;

  return (
    <Card variant="default" className={content.tone} role="status" aria-live="polite">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1 space-y-1">
            <p className="font-medium">{content.title}</p>
            <p className="text-sm text-muted-foreground">{content.text}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Fechar aviso">
            <X className="w-4 h-4" />
          </Button>
        </div>
        {outcome === 'waiting' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRecheck} disabled={rechecking}>
              {rechecking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Já paguei
            </Button>
            {resumeUrl && (
              <Button size="sm" variant="outline" onClick={() => window.location.assign(resumeUrl)}>
                Voltar para o pagamento
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
