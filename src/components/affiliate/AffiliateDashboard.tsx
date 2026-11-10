import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Copy, DollarSign, Eye, Link2, Medal,
  MousePointerClick, Percent, Receipt, Repeat, ShoppingCart, Table2, Users, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  AFFILIATE_STATUS_LABELS, buildReferralLink, formatBRL, useAffiliateDashboard,
  type AffiliateDashboardData,
} from '@/hooks/useAffiliates';

type Metric = 'commission' | 'conversions' | 'visits';

const METRICS: Record<Metric, { label: string; isMoney: boolean }> = {
  commission: { label: 'Comissão', isMoney: true },
  conversions: { label: 'Conversões', isMoney: false },
  visits: { label: 'Visitas ao link', isMoney: false },
};

const PAYOUT_METHODS: Record<string, string> = { pix: 'PIX', transferencia: 'Transferência', outro: 'Outro' };

const monthLabel = (ym: string) => format(parseISO(`${ym}-01`), 'MMM/yy', { locale: ptBR });
const fmtInt = (n: number) => new Intl.NumberFormat('pt-BR').format(n || 0);
const fmtPct = (n: number | null) => (n === null || Number.isNaN(n) ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);

/** Variação percentual mês a mês; null quando não há base de comparação. */
function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function KpiTile({
  label, value, hint, icon: Icon, trend, emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  trend?: number | null;
  emphasis?: boolean;
}) {
  return (
    <Card className={cn(emphasis && 'border-primary/30 bg-primary/5')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-xl sm:text-2xl font-bold tabular-nums">{value}</p>
        <div className="flex items-center gap-1.5 mt-1 min-h-[1rem]">
          {trend !== undefined && trend !== null && (
            <span
              className={cn(
                'inline-flex items-center text-xs font-medium',
                trend >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground truncate">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function CopyField({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Copy }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg min-w-0 flex-1">
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
        <span className="font-mono text-sm font-semibold truncate">{value}</span>
      </div>
      <Button variant="outline" size="icon" onClick={copy} aria-label={`Copiar ${label.toLowerCase()}`}>
        {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

function PerformanceChart({ data }: { data: AffiliateDashboardData['monthly'] }) {
  const [metric, setMetric] = useState<Metric>('commission');
  const [showTable, setShowTable] = useState(false);
  const config = useMemo<ChartConfig>(
    () => ({ [metric]: { label: METRICS[metric].label, color: 'hsl(var(--primary))' } }),
    [metric],
  );
  const rows = data.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const fmt = (v: number) => (METRICS[metric].isMoney ? formatBRL(v) : fmtInt(v));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Desempenho mensal</CardTitle>
            <CardDescription>{METRICS[metric].label} nos últimos {data.length} meses</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={metric}
              onValueChange={(v) => v && setMetric(v as Metric)}
              aria-label="Métrica do gráfico"
            >
              <ToggleGroupItem value="commission" className="text-xs">Comissão</ToggleGroupItem>
              <ToggleGroupItem value="conversions" className="text-xs">Conversões</ToggleGroupItem>
              <ToggleGroupItem value="visits" className="text-xs">Visitas</ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant={showTable ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowTable((s) => !s)}
              aria-label={showTable ? 'Ver gráfico' : 'Ver tabela'}
              aria-pressed={showTable}
            >
              <Table2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.month}>
                  <TableCell className="capitalize">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(r.visits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(r.conversions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.commission)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer config={config} className="h-56 w-full aspect-auto">
            <BarChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} className="capitalize" />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={metric === 'commission' ? 64 : 32}
                allowDecimals={metric === 'commission'}
                tickFormatter={(v: number) => (metric === 'commission' ? `R$${v.toLocaleString('pt-BR')}` : fmtInt(v))}
              />
              <ChartTooltip
                cursor={{ className: 'fill-muted/50' }}
                content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />}
              />
              <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelCard({ kpis }: { kpis: AffiliateDashboardData['kpis'] }) {
  const max = Math.max(kpis.visits_30d, kpis.conversions_30d, 1);
  const steps = [
    { label: 'Visitas ao link', value: kpis.visits_30d, icon: MousePointerClick },
    { label: 'Assinaturas', value: kpis.conversions_30d, icon: ShoppingCart },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Funil (últimos 30 dias)</CardTitle>
        <CardDescription>Taxa de conversão: {fmtPct(kpis.conversion_rate_30d)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((s) => (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <s.icon className="w-4 h-4" aria-hidden /> {s.label}
              </span>
              <span className="font-semibold tabular-nums">{fmtInt(s.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max((s.value / max) * 100, s.value > 0 ? 3 : 0)}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Visitas contam aberturas do seu link (uma por pessoa por dia). Compartilhe o link para medir o funil.
        </p>
      </CardContent>
    </Card>
  );
}

interface AffiliateDashboardProps {
  /** Quando informado (painel admin), exibe o dashboard deste afiliado. */
  referralCodeId?: string;
}

export function AffiliateDashboard({ referralCodeId }: AffiliateDashboardProps) {
  const { data, isLoading, error } = useAffiliateDashboard(referralCodeId);
  const isAdminView = !!referralCodeId;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar o dashboard</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { kpis } = data;
  const commissionTrend = delta(kpis.commission_this_month, kpis.commission_last_month);
  const conversionsTrend = delta(kpis.conversions_this_month, kpis.conversions_last_month);
  const link = buildReferralLink(data.code);

  return (
    <div className="space-y-4">
      {/* Identidade do afiliado */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={data.status === 'active' ? 'default' : data.status === 'paused' ? 'secondary' : 'destructive'}
            >
              {AFFILIATE_STATUS_LABELS[data.status]}
            </Badge>
            <Badge variant="outline" className="gap-1"><Percent className="w-3 h-3" /> Comissão {data.commission_percent.toLocaleString('pt-BR')}%</Badge>
            <Badge variant="outline" className="gap-1"><Receipt className="w-3 h-3" /> Desconto p/ indicados {data.discount_percent}%</Badge>
            {data.rank && (
              <Badge variant="outline" className="gap-1">
                <Medal className="w-3 h-3" /> #{data.rank} de {data.active_affiliates} afiliados
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Afiliado desde {format(parseISO(data.member_since), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <CopyField label="Código" value={data.code} icon={Receipt} />
            <CopyField label="Link" value={link} icon={Link2} />
          </div>
        </CardContent>
      </Card>

      {data.status !== 'active' && (
        <Alert variant={data.status === 'removed' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{data.status === 'removed' ? 'Participação encerrada' : 'Código pausado'}</AlertTitle>
          <AlertDescription>
            {data.status === 'removed'
              ? 'Este código não gera novas comissões. O histórico e o saldo a receber continuam disponíveis.'
              : 'O código está temporariamente desativado e não aceita novas indicações.'}
            {!isAdminView && ' Em caso de dúvidas, fale com o suporte.'}
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Comissão no mês"
          value={formatBRL(kpis.commission_this_month)}
          trend={commissionTrend}
          hint="vs. mês anterior"
          icon={DollarSign}
          emphasis
        />
        <KpiTile
          label="Saldo a receber"
          value={formatBRL(kpis.balance_due)}
          hint={`Já pago: ${formatBRL(kpis.paid_out)}`}
          icon={Wallet}
          emphasis
        />
        <KpiTile
          label="Comissão acumulada"
          value={formatBRL(kpis.total_commission)}
          hint="desde o início"
          icon={DollarSign}
        />
        <KpiTile
          label="Conversões no mês"
          value={fmtInt(kpis.conversions_this_month)}
          trend={conversionsTrend}
          hint={`Total: ${fmtInt(kpis.total_conversions)}`}
          icon={ShoppingCart}
        />
        <KpiTile
          label="Receita gerada"
          value={formatBRL(kpis.gross_revenue)}
          hint={`Ticket médio ${formatBRL(kpis.avg_ticket)}`}
          icon={Receipt}
        />
        <KpiTile
          label="Indicados ativos"
          value={fmtInt(kpis.active_referrals)}
          hint={`Retenção ${fmtPct(kpis.retention_rate)}`}
          icon={Repeat}
        />
        <KpiTile
          label="Visitas (30 dias)"
          value={fmtInt(kpis.visits_30d)}
          hint={`Total: ${fmtInt(kpis.visits_total)}`}
          icon={Eye}
        />
        <KpiTile
          label="Taxa de conversão"
          value={fmtPct(kpis.conversion_rate_30d)}
          hint="visitas → assinaturas (30d)"
          icon={Users}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart data={data.monthly} />
        </div>
        <FunnelCard kpis={kpis} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversões recentes</CardTitle>
            <CardDescription>Os indicados são anônimos por privacidade (LGPD)</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma conversão ainda. Compartilhe seu link para começar!
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(r.created_at), 'dd/MM/yy')}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.subscription_amount !== null ? formatBRL(r.subscription_amount) : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{r.commission_earned !== null ? formatBRL(r.commission_earned) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.is_active_subscriber ? 'default' : 'outline'} className="text-[10px]">
                          {r.is_active_subscriber ? 'Assinante' : 'Cancelado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pagamentos recebidos</CardTitle>
            <CardDescription>Comissões repassadas pela plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            {data.payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(p.paid_at), 'dd/MM/yy')}</TableCell>
                      <TableCell>
                        {PAYOUT_METHODS[p.method] ?? p.method}
                        {p.reference && <span className="block text-xs text-muted-foreground truncate max-w-[10rem]">{p.reference}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatBRL(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
