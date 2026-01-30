import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHasReferralCode } from '@/hooks/useReferralAnalytics';
import { AppHeader } from '@/components/AppHeader';
import { ReferralAnalyticsDashboard } from '@/components/ReferralAnalyticsDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Gift, TrendingUp, Star } from 'lucide-react';

export default function Affiliate() {
  const { user, loading: authLoading } = useAuth();
  const { data: hasCode, isLoading } = useHasReferralCode();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-400/20 border border-amber-500/30">
            <Users className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">Programa de Afiliados</span>
          </div>
          <h1 className="text-2xl font-display font-bold">Ganhe com Indicações</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Compartilhe seu código com amigos e ganhe comissões em cada assinatura Plus
          </p>
        </div>

        {hasCode ? (
          <ReferralAnalyticsDashboard />
        ) : (
          <div className="space-y-6">
            {/* How it works */}
            <Card variant="elevated">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" />
                  Como Funciona
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Torne-se Top Player</p>
                      <p className="text-sm text-muted-foreground">
                        Alcance o ranking dos melhores jogadores para desbloquear seu código de afiliado
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Compartilhe seu Código</p>
                      <p className="text-sm text-muted-foreground">
                        Seus amigos ganham 10% de desconto na assinatura Plus
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Ganhe Comissões</p>
                      <p className="text-sm text-muted-foreground">
                        Receba 3% de comissão em cada assinatura feita com seu código
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card variant="glass">
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  Benefícios
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-center">
                    <p className="text-2xl font-bold text-success">3%</p>
                    <p className="text-xs text-muted-foreground">Comissão por venda</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                    <p className="text-2xl font-bold text-amber-500">10%</p>
                    <p className="text-xs text-muted-foreground">Desconto para amigos</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                    <p className="text-2xl font-bold text-primary">∞</p>
                    <p className="text-xs text-muted-foreground">Indicações ilimitadas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-center">
                    <p className="text-2xl font-bold text-accent">💰</p>
                    <p className="text-xs text-muted-foreground">Saque mensal</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border-primary/20">
              <CardContent className="p-6 text-center space-y-4">
                <Star className="w-12 h-12 mx-auto text-primary" />
                <div>
                  <h3 className="font-semibold text-lg">Ainda não é Top Player?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Continue estudando e suba no ranking para desbloquear o programa de afiliados
                  </p>
                </div>
                <Button variant="hero" onClick={() => navigate('/ranking')}>
                  Ver Ranking
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
