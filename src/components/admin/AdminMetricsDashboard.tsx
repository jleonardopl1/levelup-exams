import { Card, CardContent } from '@/components/ui/card';
import { Users, BookOpen, Crown, DollarSign, TrendingUp, BarChart3, Loader2 } from 'lucide-react';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

export function AdminMetricsDashboard() {
  const { data: metrics, isLoading } = useAdminMetrics();

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const stats = [
    { label: 'Total Usuários', value: metrics?.users.total || 0, icon: Users, color: 'text-primary' },
    { label: 'Usuários Premium', value: metrics?.users.premium || 0, icon: Crown, color: 'text-amber-500' },
    { label: 'Total Questões', value: metrics?.content.totalQuestions || 0, icon: BookOpen, color: 'text-blue-500' },
    { label: 'Quizzes Realizados', value: metrics?.content.totalQuizzes || 0, icon: BarChart3, color: 'text-green-500' },
    { label: 'MRR', value: formatCurrency(metrics?.revenue.mrr || 0), icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Receita (30d)', value: formatCurrency(metrics?.revenue.totalRevenue || 0), icon: DollarSign, color: 'text-emerald-600' },
    { label: 'Assinaturas Ativas', value: metrics?.revenue.activeSubscriptions || 0, icon: Crown, color: 'text-primary' },
    { label: 'Cancelamentos', value: metrics?.revenue.canceledSubscriptions || 0, icon: Users, color: 'text-destructive' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4 text-center">
            <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
