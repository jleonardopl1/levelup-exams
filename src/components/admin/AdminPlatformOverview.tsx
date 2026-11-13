import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, CheckCircle2, Crown, DollarSign,
  Flag, Loader2, RefreshCw, Sparkles, Target, TrendingUp, UserPlus, Users, Webhook, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatformOverview } from '@/hooks/useAdminConsole';
import { useAdminMetrics } from '@/hooks/useAdminMetrics';

const brl = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const num = (n: number | null | undefined) => new Intl.NumberFormat('pt-BR').format(n ?? 0);

function Kpi({ label, value, hint, icon: Icon, tone = 'text-primary', trend }: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  tone?: string;
  trend?: number | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn('w-5 h-5', tone)} aria-hidden />
          {trend !== undefined && trend !== null && (
            <span className={cn('flex items-center text-xs font-medium', trend >= 0 ? 'text-success' : 'text-destructive')}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

type HealthState = 'ok' | 'warn' | 'error';
function HealthRow({ state, title, detail, icon: Icon }: { state: HealthState; title: string; detail: string; icon: typeof Webhook }) {
  const StateIcon = state === 'ok' ? CheckCircle2 : state === 'warn' ? AlertTriangle : XCircle;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <StateIcon
        className={cn('w-4 h-4 shrink-0', state === 'ok' ? 'text-success' : state === 'warn' ? 'text-amber-500' : 'text-destructive')}
        aria-label={state === 'ok' ? 'OK' : state === 'warn' ? 'Atenção' : 'Problema'}
      />
    </div>
  );
}

const ago = (iso: string | null) =>
  iso ? formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR }) : null;

export function AdminPlatformOverview({ onOpenReports }: { onOpenReports?: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePlatformOverview();
  const { data: stripe, isLoading: stripeLoading } = useAdminMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-sm">Não foi possível carregar a visão geral.</p>
          <p className="text-xs text-muted-foreground">
            {(error as Error)?.message?.includes('admin_platform_overview')
              ? 'A migration 20261113120000 ainda não foi aplicada no banco.'
              : (error as Error)?.message}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
        </CardContent>
      </Card>
    );
  }

  const { users, quizzes, content, health, answers } = data;
  const weeklyTrend = quizzes.last_week > 0
    ? Math.round(((quizzes.this_week - quizzes.last_week) / quizzes.last_week) * 100)
    : null;
  const conversion = users.total > 0 ? Math.round((users.plus / users.total) * 1000) / 10 : 0;
  const stickiness = users.active_30d > 0 ? Math.round((users.active_1d / users.active_30d) * 100) : 0;

  const weekly = quizzes.weekly.map((w) => ({ ...w, label: format(parseISO(w.week), 'dd/MM') }));
  const daily = data.signups_daily.map((d) => ({ ...d, label: format(parseISO(d.day), 'dd/MM') }));

  // Saúde do sistema
  const stripeState: HealthState = health.last_stripe_event_at
    ? (Date.now() - parseISO(health.last_stripe_event_at).getTime() > 30 * 86400_000 ? 'warn' : 'ok')
    : 'error';
  const genState: HealthState = !health.last_generation_at
    ? 'warn'
    : Date.now() - parseISO(health.last_generation_at).getTime() > 2 * 86400_000
      ? 'warn'
      : health.generation_errors_7d > 0 ? 'warn' : 'ok';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Atualizado {ago(data.generated_at)} · horário de Brasília
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-1.5">Atualizar</span>
        </Button>
      </div>

      {/* Métrica estrela */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Métrica estrela
            </p>
            <p className="text-sm text-muted-foreground">Simulados concluídos nesta semana</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-4xl font-display font-bold tabular-nums">{num(quizzes.this_week)}</span>
              {weeklyTrend !== null && (
                <Badge variant="outline" className={cn(weeklyTrend >= 0 ? 'text-success border-success/40' : 'text-destructive border-destructive/40')}>
                  {weeklyTrend >= 0 ? '+' : ''}{weeklyTrend}% vs semana passada ({num(quizzes.last_week)})
                </Badge>
              )}
            </div>
          </div>
          <div className="h-28 md:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number, name) => [num(v), name === 'quizzes' ? 'Simulados' : 'Alunos']}
                  labelFormatter={(l) => `Semana de ${l}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="quizzes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Alunos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Usuários" value={num(users.total)} hint={`+${num(users.new_7d)} nos últimos 7 dias`} icon={Users} />
        <Kpi label="Ativos hoje / 7d / 30d" value={`${num(users.active_1d)} / ${num(users.active_7d)} / ${num(users.active_30d)}`} hint={`Engajamento diário: ${stickiness}% dos ativos do mês`} icon={Activity} tone="text-blue-500" />
        <Kpi label="Assinantes Plus" value={num(users.plus)} hint={`Conversão: ${conversion}% da base`} icon={Crown} tone="text-amber-500" />
        <Kpi label="Novos (30 dias)" value={num(users.new_30d)} hint={users.banned > 0 ? `${users.banned} banido(s) ativo(s)` : undefined} icon={UserPlus} tone="text-emerald-500" />
      </div>

      {/* Estudo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Simulados no total" value={num(quizzes.total)} hint={quizzes.avg_score_30d !== null ? `Nota média (30d): ${quizzes.avg_score_30d}%` : undefined} icon={Target} tone="text-green-500" />
        <Kpi label="Respostas (7 dias)" value={num(answers.attempts_7d)} hint={answers.accuracy_30d !== null ? `Acerto médio (30d): ${answers.accuracy_30d}%` : undefined} icon={TrendingUp} />
        <Kpi label="Questões ativas" value={num(content.questions_active)} hint={`+${num(content.questions_new_7d)} na semana · ${num(content.questions_premium)} premium`} icon={BookOpen} tone="text-blue-500" />
        <button className="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={onOpenReports}>
          <Kpi
            label="Reportes abertos"
            value={num(content.reports_open)}
            hint={content.reports_open > 0 ? 'Toque para revisar' : 'Fila vazia'}
            icon={Flag}
            tone={content.reports_open > 0 ? 'text-destructive' : 'text-muted-foreground'}
          />
        </button>
      </div>

      {/* Receita (Stripe) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stripeLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Kpi label="MRR" value={brl(stripe?.revenue.mrr ?? 0)} icon={TrendingUp} tone="text-emerald-500" />
            <Kpi label="Receita (30 dias)" value={brl(stripe?.revenue.totalRevenue ?? 0)} icon={DollarSign} tone="text-emerald-600" />
            <Kpi label="Assinaturas ativas (Stripe)" value={num(stripe?.revenue.activeSubscriptions)} icon={Crown} />
            <Kpi label="Cancelamentos" value={num(stripe?.revenue.canceledSubscriptions)} icon={XCircle} tone="text-destructive" />
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Cadastros e alunos ativos (30 dias)</CardTitle></CardHeader>
          <CardContent className="h-56 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="active" name="Ativos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="signups" name="Cadastros" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Matérias mais praticadas (30 dias)</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {data.top_subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem respostas no período.</p>
            ) : data.top_subjects.map((s) => (
              <div key={s.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="truncate pr-2 font-medium">{s.name}</span>
                  <span className="text-muted-foreground tabular-nums">{num(s.attempts)} resp. · {s.accuracy}% acerto</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
                  <div
                    className={cn('h-full rounded-full', s.accuracy >= 70 ? 'bg-success' : s.accuracy >= 45 ? 'bg-accent' : 'bg-destructive')}
                    style={{ width: `${s.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">Saúde do sistema</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border">
          <HealthRow
            state={stripeState}
            icon={Webhook}
            title="Webhook do Stripe"
            detail={health.last_stripe_event_at
              ? `Último evento ${ago(health.last_stripe_event_at)} · ${num(health.stripe_events_30d)} em 30 dias`
              : 'Nenhum evento recebido. Cadastre o endpoint stripe-webhook no Stripe (ver docs/LOGIN_PAGAMENTO_APP.md); sem ele, assinaturas dependem só da sincronização no login.'}
          />
          <HealthRow
            state={genState}
            icon={Sparkles}
            title="Geração automática de questões"
            detail={health.last_generation_at
              ? `Última execução ${ago(health.last_generation_at)} · ${num(health.generation_inserted_7d)} questões novas em 7 dias${health.generation_errors_7d > 0 ? ` · ${health.generation_errors_7d} erro(s)` : ''}`
              : 'Nenhuma execução registrada. Confira o agendamento (pg_cron) e dispare manualmente na aba Questões.'}
          />
          <HealthRow
            state={health.failed_events_24h > 0 ? 'warn' : 'ok'}
            icon={AlertTriangle}
            title="Falhas registradas (24h)"
            detail={health.failed_events_24h > 0
              ? `${health.failed_events_24h} evento(s) com falha na auditoria. Veja a aba Auditoria.`
              : 'Nenhuma falha nas últimas 24 horas.'}
          />
          <HealthRow
            state={content.reports_open > 10 ? 'warn' : 'ok'}
            icon={Flag}
            title="Qualidade do conteúdo"
            detail={`${num(content.reports_open)} reporte(s) de alunos aguardando revisão · ${num(content.questions_inactive)} questão(ões) fora de circulação`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
