import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  BarChart3, DollarSign, Eye, Handshake, Loader2, MoreVertical, Pause, Pencil, Play, Plus, RefreshCw,
  Search, ShoppingCart, Trash2, Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  AFFILIATE_STATUS_LABELS, formatBRL, useAffiliateOverview, useUpdateAffiliate, useUpdateSetting,
  type AffiliateRow, type AffiliateStatus,
} from '@/hooks/useAffiliates';
import { AffiliateDashboard } from '@/components/affiliate/AffiliateDashboard';
import {
  AddAffiliateDialog, EditAffiliateDialog, PayoutDialog, RemoveAffiliateDialog,
} from '@/components/admin/AffiliateDialogs';

const STATUS_BADGE: Record<AffiliateStatus, string> = {
  active: 'bg-success/10 text-success border-success/30',
  paused: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  removed: 'bg-muted text-muted-foreground border-transparent',
};

const fmtInt = (n: number) => new Intl.NumberFormat('pt-BR').format(n || 0);

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Wallet }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function AdminAffiliates() {
  const { data, isLoading, isFetching, refetch, error } = useAffiliateOverview();
  const updateAffiliate = useUpdateAffiliate();
  const updateSetting = useUpdateSetting();

  const [search, setSearch] = useState('');
  const [showRemoved, setShowRemoved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AffiliateRow | null>(null);
  const [removing, setRemoving] = useState<AffiliateRow | null>(null);
  const [paying, setPaying] = useState<AffiliateRow | null>(null);
  const [viewing, setViewing] = useState<AffiliateRow | null>(null);

  const canManage = data?.can_manage === true;

  const affiliates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.affiliates ?? []).filter((a) =>
      (showRemoved || a.status !== 'removed')
      && (!q || a.code.toLowerCase().includes(q)
        || (a.display_name ?? '').toLowerCase().includes(q)
        || (a.email ?? '').toLowerCase().includes(q)));
  }, [data, search, showRemoved]);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (error || !data) {
    return <Alert variant="destructive"><AlertDescription>{(error as Error)?.message ?? 'Erro ao carregar afiliados'}</AlertDescription></Alert>;
  }

  const t = data.totals;

  return (
    <div className="space-y-4">
      {/* KPIs do programa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Afiliados ativos" value={fmtInt(t.affiliates_active)} hint={`${fmtInt(t.affiliates_paused)} pausado(s) · ${fmtInt(t.affiliates_removed)} removido(s)`} icon={Handshake} />
        <Stat label="Receita via afiliados" value={formatBRL(t.gross_revenue)} hint={`${fmtInt(t.conversions_total)} assinatura(s) no total`} icon={ShoppingCart} />
        <Stat label="Comissões (30 dias)" value={formatBRL(t.commission_30d)} hint={`${fmtInt(t.conversions_30d)} conversão(ões) · ${fmtInt(t.visits_30d)} visitas`} icon={BarChart3} />
        <Stat label="Saldo a pagar" value={formatBRL(t.balance_due)} hint={`Já pago: ${formatBRL(t.paid_out)}`} icon={Wallet} />
      </div>

      {/* Configurações do programa */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Programa de afiliados</CardTitle>
              <CardDescription>
                {canManage
                  ? 'Somente você (admin master) adiciona, edita, remove afiliados e registra pagamentos.'
                  : 'Modo leitura: apenas o admin master gerencia afiliados.'}
              </CardDescription>
            </div>
            {canManage && (
              <Button onClick={() => setAddOpen(true)} className="gap-1.5 shrink-0">
                <Plus className="w-4 h-4" /> Adicionar afiliado
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="self-enroll" className="text-sm font-medium">Autoinscrição de Top Players</Label>
              <p className="text-xs text-muted-foreground">
                Quando ligada, assinantes Plus com 10.000+ pontos criam o próprio código (comissão 3%, desconto 10%).
              </p>
            </div>
            <Switch
              id="self-enroll"
              checked={data.self_enrollment}
              disabled={!canManage || updateSetting.isPending}
              onCheckedChange={(v) => updateSetting.mutate({ key: 'affiliate_self_enrollment', value: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por código, nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Buscar afiliados" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="show-removed" checked={showRemoved} onCheckedChange={setShowRemoved} />
            <Label htmlFor="show-removed" className="text-sm whitespace-nowrap">Mostrar removidos</Label>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {affiliates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Handshake className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum afiliado encontrado.</p>
            {canManage && <Button variant="outline" onClick={() => setAddOpen(true)}>Adicionar o primeiro afiliado</Button>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Condições</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Comissão total</TableHead>
                  <TableHead className="text-right">A pagar</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((a) => (
                  <TableRow key={a.id} className={cn(a.status === 'removed' && 'opacity-60')}>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold">{a.code}</span>
                        <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[a.status])}>{AFFILIATE_STATUS_LABELS[a.status]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[14rem]">
                        {a.display_name || a.email || 'Sem nome'}
                        {a.display_name && a.email ? ` · ${a.email}` : ''}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.source === 'admin' ? 'Adicionado pela equipe' : 'Autoinscrição'} · desde {format(parseISO(a.created_at), 'dd/MM/yy')}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right text-xs tabular-nums whitespace-nowrap">
                      {a.commission_percent.toLocaleString('pt-BR')}% com.<br />{a.discount_percent}% desc.
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(a.total_uses)}
                      <span className="block text-[11px] text-muted-foreground">{fmtInt(a.conversions_30d)} em 30d</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{formatBRL(a.total_earnings)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums font-medium', a.balance_due > 0 && 'text-amber-600 dark:text-amber-400')}>
                      {formatBRL(a.balance_due)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações para ${a.code}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(a)}><Eye className="w-4 h-4 mr-2" /> Ver dashboard</DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem disabled={a.balance_due <= 0} onClick={() => setPaying(a)}>
                                <DollarSign className="w-4 h-4 mr-2" /> Registrar pagamento
                              </DropdownMenuItem>
                              {a.status !== 'removed' && (
                                <>
                                  <DropdownMenuItem onClick={() => setEditing(a)}><Pencil className="w-4 h-4 mr-2" /> Editar condições</DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateAffiliate.mutate({ id: a.id, isActive: a.status !== 'active' })}
                                  >
                                    {a.status === 'active'
                                      ? <><Pause className="w-4 h-4 mr-2" /> Pausar código</>
                                      : <><Play className="w-4 h-4 mr-2" /> Reativar código</>}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoving(a)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Remover afiliado
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AddAffiliateDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditAffiliateDialog affiliate={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <RemoveAffiliateDialog affiliate={removing} onOpenChange={(o) => !o && setRemoving(null)} />
      <PayoutDialog affiliate={paying} onOpenChange={(o) => !o && setPaying(null)} />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dashboard do afiliado {viewing?.code}</DialogTitle>
            <DialogDescription>Exatamente o que o afiliado vê no próprio painel.</DialogDescription>
          </DialogHeader>
          {viewing && <AffiliateDashboard referralCodeId={viewing.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
