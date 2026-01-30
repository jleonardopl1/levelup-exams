import { useState } from 'react';
import { useReferralAnalytics } from '@/hooks/useReferralAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  DollarSign, 
  Percent, 
  Copy, 
  Check, 
  TrendingUp,
  Clock,
  Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function ReferralAnalyticsDashboard() {
  const { data: analytics, isLoading, error } = useReferralAnalytics();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (!analytics?.code) return;
    
    try {
      await navigator.clipboard.writeText(analytics.code);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Falha ao copiar código');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center text-destructive">
          Erro ao carregar dados de referência
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum código de referência</h3>
          <p className="text-muted-foreground text-sm">
            Você ainda não tem um código de afiliado. Entre em contato para se tornar um afiliado.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header with Code */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Dashboard de Afiliado</h2>
          <p className="text-muted-foreground text-sm">
            Acompanhe suas indicações e comissões
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Seu código:</span>
            <span className="font-mono font-bold text-lg">{analytics.code}</span>
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleCopyCode}
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
          <Badge variant={analytics.isActive ? 'default' : 'secondary'}>
            {analytics.isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total de Indicações</p>
                <p className="text-3xl font-bold">{analytics.totalUses}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Ganhos Totais</p>
                <p className="text-3xl font-bold text-success">
                  {formatCurrency(analytics.totalEarnings)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Sua Comissão</p>
                <p className="text-3xl font-bold text-amber-600">
                  {analytics.commissionPercent}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Desconto para indicados: {analytics.discountPercent}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Percent className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Indicações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.recentReferrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma indicação ainda</p>
              <p className="text-sm">Compartilhe seu código para começar a ganhar!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor Assinatura</TableHead>
                  <TableHead className="text-right">Sua Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.recentReferrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium">
                      {format(new Date(referral.createdAt), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="text-right">
                      {referral.subscriptionAmount 
                        ? formatCurrency(referral.subscriptionAmount)
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn(
                        "font-semibold",
                        referral.commissionEarned ? "text-success" : "text-muted-foreground"
                      )}>
                        {referral.commissionEarned 
                          ? formatCurrency(referral.commissionEarned)
                          : 'Pendente'
                        }
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
