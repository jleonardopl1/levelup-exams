import { useEffect, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Ban, ChevronDown, ChevronLeft, ChevronRight, Crown, Gift, Handshake, Info, Loader2, RefreshCw, Search,
  Shield, ShieldCheck, UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCESS_LEVEL_LABELS, useAccess, type AccessLevel } from '@/hooks/useAccess';
import {
  USERS_PAGE_SIZE, useAdminUsers, useBanUser, useGrantPremium, useRevokePremium, useSetAccessLevel, useUnbanUser,
  type AdminUserRow, type ManageableLevel, type UserFilter,
} from '@/hooks/useAdminUsers';
import { AFFILIATE_STATUS_LABELS } from '@/hooks/useAffiliates';
import { AddAffiliateDialog, type AddAffiliatePrefill } from '@/components/admin/AffiliateDialogs';

const LEVEL_STYLES: Record<AccessLevel, string> = {
  master: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-transparent',
  admin: 'bg-primary/10 text-primary border-primary/30',
  moderator: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  user: 'bg-muted text-muted-foreground border-transparent',
};

const LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  master: 'Dono da plataforma. Único que cria, altera e revoga níveis de acesso, gerencia afiliados, pagamentos e configurações.',
  admin: 'Painel completo: métricas, questões, auditoria e moderação de usuários comuns. Vê afiliados, mas não os altera.',
  moderator: 'Painel restrito: moderação de usuários comuns (banir/desbanir) e curadoria de questões.',
  user: 'Acesso normal ao aplicativo, sem permissões administrativas.',
};

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'staff', label: 'Equipe' },
  { value: 'affiliates', label: 'Afiliados' },
  { value: 'plus', label: 'Plus (todos)' },
  { value: 'granted', label: 'Plus liberado' },
  { value: 'banned', label: 'Banidos' },
];

// Duração da liberação do Plus ('none' = sem prazo).
const GRANT_DURATIONS: { value: string; label: string }[] = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '6 meses' },
  { value: '365', label: '1 ano' },
  { value: 'none', label: 'Sem prazo' },
];

function PlusBadge({ u }: { u: AdminUserRow }) {
  if (u.tier !== 'plus' || !u.premium_source) return null;
  const label = u.premium_source === 'master'
    ? 'Plus permanente'
    : u.premium_source === 'grant'
      ? (u.premium_grant_expires_at
        ? `Plus liberado até ${format(parseISO(u.premium_grant_expires_at), 'dd/MM/yy')}`
        : 'Plus liberado · sem prazo')
      : 'Plus · assinante';
  return (
    <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30">
      {u.premium_source === 'grant' ? <Gift className="w-3 h-3" /> : <Crown className="w-3 h-3" />} {label}
    </Badge>
  );
}

const LevelIcon = ({ level, className }: { level: AccessLevel; className?: string }) => {
  const Icon = level === 'master' ? Crown : level === 'admin' ? ShieldCheck : level === 'moderator' ? Shield : UserCog;
  return <Icon className={className} aria-hidden />;
};

function AccessLevelGuide() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 text-left" aria-expanded={open}>
            <span className="flex items-center gap-2 text-sm font-medium">
              <Info className="w-4 h-4 text-primary" /> Hierarquia de acesso
            </span>
            <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-2">
            {(['master', 'admin', 'moderator', 'user'] as AccessLevel[]).map((lvl) => (
              <div key={lvl} className="flex items-start gap-3">
                <Badge variant="outline" className={cn('gap-1 shrink-0 w-32 justify-center', LEVEL_STYLES[lvl])}>
                  <LevelIcon level={lvl} className="w-3 h-3" /> {ACCESS_LEVEL_LABELS[lvl]}
                </Badge>
                <p className="text-xs text-muted-foreground">{LEVEL_DESCRIPTIONS[lvl]}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              <Handshake className="inline w-3 h-3 mr-1" />
              Afiliado não é um nível de acesso: é um usuário com código de indicação, que vê apenas o próprio painel de KPIs.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function AdminUserManagement() {
  const { access } = useAccess();
  const isMaster = access.isMaster;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [page, setPage] = useState(0);

  const [levelTarget, setLevelTarget] = useState<AdminUserRow | null>(null);
  const [newLevel, setNewLevel] = useState<ManageableLevel>('user');
  const [levelReason, setLevelReason] = useState('');

  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary');
  const [banDays, setBanDays] = useState('7');
  const [banReason, setBanReason] = useState('');

  const [affiliatePrefill, setAffiliatePrefill] = useState<AddAffiliatePrefill | null>(null);

  const [plusTarget, setPlusTarget] = useState<AdminUserRow | null>(null);
  const [plusDuration, setPlusDuration] = useState('30');
  const [plusReason, setPlusReason] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useAdminUsers(debouncedSearch, filter, page);
  const setAccessLevel = useSetAccessLevel();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const grantPremium = useGrantPremium();
  const revokePremium = useRevokePremium();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const banDaysN = Number(banDays);
  const banValid = banType === 'permanent' || (Number.isInteger(banDaysN) && banDaysN >= 1 && banDaysN <= 3650);

  const openLevelDialog = (u: AdminUserRow) => {
    setLevelTarget(u);
    setNewLevel(u.access_level === 'master' ? 'admin' : u.access_level);
    setLevelReason('');
  };

  const openBanDialog = (u: AdminUserRow) => {
    setBanTarget(u);
    setBanType('temporary');
    setBanDays('7');
    setBanReason('');
  };

  const openPlusDialog = (u: AdminUserRow) => {
    setPlusTarget(u);
    setPlusDuration('30');
    setPlusReason('');
  };

  const nameOf = (u: AdminUserRow) => u.display_name || (isMaster && u.email) || 'Usuário sem nome';

  return (
    <div className="space-y-4">
      {isMaster && <AccessLevelGuide />}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={isMaster ? 'Buscar por nome, e-mail ou código...' : 'Buscar por nome ou código...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar usuários"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => { setFilter(v as UserFilter); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar usuários"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar lista">
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {total} usuário(s) encontrado(s)
        {!isMaster && ' · e-mails visíveis apenas para o admin master (LGPD)'}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((u) => {
            const isMasterRow = u.access_level === 'master';
            const accuracy = u.total_questions > 0 ? Math.round((u.total_correct / u.total_questions) * 100) : 0;
            return (
              <Card
                key={u.user_id}
                className={cn(u.is_banned && 'border-destructive/50', isMasterRow && 'border-amber-500/50')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs">{nameOf(u).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{nameOf(u)}</p>
                      {isMaster && u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        <Badge variant="outline" className={cn('text-[10px] gap-1', LEVEL_STYLES[u.access_level])}>
                          <LevelIcon level={u.access_level} className="w-3 h-3" />
                          {ACCESS_LEVEL_LABELS[u.access_level]}
                        </Badge>
                        <PlusBadge u={u} />
                        {u.affiliate_status && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Handshake className="w-3 h-3" /> {u.affiliate_code} · {AFFILIATE_STATUS_LABELS[u.affiliate_status]}
                          </Badge>
                        )}
                        {u.is_banned && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <Ban className="w-3 h-3" />
                            {u.ban_type === 'permanent' || !u.ban_expires_at
                              ? 'Banido'
                              : `Banido até ${format(parseISO(u.ban_expires_at), 'dd/MM/yy')}`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                    <div><p className="font-bold tabular-nums">{u.total_quizzes}</p><p className="text-muted-foreground">Quizzes</p></div>
                    <div><p className="font-bold tabular-nums">{accuracy}%</p><p className="text-muted-foreground">Acertos</p></div>
                    <div><p className="font-bold tabular-nums">{u.streak_days}</p><p className="text-muted-foreground">Streak</p></div>
                    <div>
                      <p className="font-bold truncate" title={u.last_sign_in_at ?? undefined}>
                        {u.last_sign_in_at ? formatDistanceToNow(parseISO(u.last_sign_in_at), { locale: ptBR }) : '—'}
                      </p>
                      <p className="text-muted-foreground">Últ. acesso</p>
                    </div>
                  </div>

                  {u.is_banned && u.ban_reason && (
                    <p className="text-xs text-destructive mb-3 line-clamp-2">Motivo: {u.ban_reason}</p>
                  )}

                  {isMasterRow ? (
                    <p className="text-xs text-center text-muted-foreground">Conta protegida: o admin master não pode ser alterado.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {isMaster && (
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openLevelDialog(u)}>
                          <UserCog className="w-3 h-3" /> Nível de acesso
                        </Button>
                      )}
                      {isMaster && (
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openPlusDialog(u)}>
                          <Gift className="w-3 h-3" /> {u.premium_source === 'grant' ? 'Plus liberado' : 'Liberar Plus'}
                        </Button>
                      )}
                      {isMaster && u.affiliate_status !== 'active' && u.affiliate_status !== 'paused' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => setAffiliatePrefill({ userId: u.user_id, name: u.display_name, email: u.email })}
                        >
                          <Handshake className="w-3 h-3" /> Tornar afiliado
                        </Button>
                      )}
                      {u.can_moderate && (u.is_banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1 text-success"
                          disabled={unbanUser.isPending}
                          onClick={() => unbanUser.mutate({ userId: u.user_id, userName: u.display_name ?? undefined })}
                        >
                          Desbanir
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="flex-1 gap-1 text-destructive" onClick={() => openBanDialog(u)}>
                          <Ban className="w-3 h-3" /> Banir
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">{page + 1} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Próxima <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Nível de acesso (master) */}
      <Dialog open={!!levelTarget} onOpenChange={(o) => !o && setLevelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nível de acesso</DialogTitle>
            <DialogDescription>
              {levelTarget ? nameOf(levelTarget) : ''} · atual: {levelTarget ? ACCESS_LEVEL_LABELS[levelTarget.access_level] : ''}
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={newLevel} onValueChange={(v) => setNewLevel(v as ManageableLevel)} className="space-y-2">
            {(['admin', 'moderator', 'user'] as ManageableLevel[]).map((lvl) => (
              <Label
                key={lvl}
                htmlFor={`lvl-${lvl}`}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 cursor-pointer font-normal',
                  newLevel === lvl && 'border-primary bg-primary/5',
                )}
              >
                <RadioGroupItem id={`lvl-${lvl}`} value={lvl} className="mt-0.5" />
                <span>
                  <span className="flex items-center gap-1.5 font-medium text-sm">
                    <LevelIcon level={lvl} className="w-4 h-4" /> {ACCESS_LEVEL_LABELS[lvl]}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{LEVEL_DESCRIPTIONS[lvl]}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          {newLevel === 'admin' && levelTarget?.access_level !== 'admin' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Administradores veem métricas financeiras e logs de auditoria. Conceda apenas a pessoas de confiança.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="level-reason">Motivo (registrado na auditoria)</Label>
            <Textarea id="level-reason" value={levelReason} maxLength={500} onChange={(e) => setLevelReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLevelTarget(null)}>Cancelar</Button>
            <Button
              disabled={setAccessLevel.isPending || newLevel === levelTarget?.access_level}
              onClick={() => levelTarget && setAccessLevel.mutate(
                { userId: levelTarget.user_id, level: newLevel, reason: levelReason, userName: levelTarget.display_name ?? undefined },
                { onSuccess: () => setLevelTarget(null) },
              )}
            >
              {setAccessLevel.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar nível
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Banimento */}
      <Dialog open={!!banTarget} onOpenChange={(o) => !o && setBanTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Banir usuário</DialogTitle>
            <DialogDescription>
              {banTarget ? nameOf(banTarget) : ''} perderá o acesso ao app e será avisado por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={banType} onValueChange={(v) => setBanType(v as 'temporary' | 'permanent')}>
              <SelectTrigger aria-label="Tipo de banimento"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="temporary">Temporário</SelectItem>
                <SelectItem value="permanent">Permanente</SelectItem>
              </SelectContent>
            </Select>
            {banType === 'temporary' && (
              <div className="space-y-1.5">
                <Label htmlFor="ban-days">Duração (dias)</Label>
                <Input id="ban-days" type="number" min={1} max={3650} value={banDays} onChange={(e) => setBanDays(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ban-reason">Motivo</Label>
              <Textarea id="ban-reason" value={banReason} maxLength={500} onChange={(e) => setBanReason(e.target.value)} placeholder="Será incluído no e-mail ao usuário" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!banValid || banUser.isPending}
              onClick={() => banTarget && banUser.mutate(
                {
                  userId: banTarget.user_id,
                  banType,
                  days: banType === 'temporary' ? banDaysN : undefined,
                  reason: banReason,
                  userName: banTarget.display_name ?? undefined,
                },
                { onSuccess: () => setBanTarget(null) },
              )}
            >
              {banUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Banir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liberar Plus (master) */}
      <Dialog open={!!plusTarget} onOpenChange={(o) => !o && setPlusTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="w-5 h-5 text-amber-500" /> Liberar Plus</DialogTitle>
            <DialogDescription>
              {plusTarget ? nameOf(plusTarget) : ''} terá todas as funcionalidades do plano pago (questões ilimitadas,
              questões premium, Mentor IA e recompensas Plus), sem cobrança.
            </DialogDescription>
          </DialogHeader>
          {plusTarget?.premium_source === 'grant' && (
            <p className="text-xs rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
              Liberado agora: {plusTarget.premium_grant_expires_at
                ? `até ${format(parseISO(plusTarget.premium_grant_expires_at), "dd/MM/yyyy 'às' HH:mm")}`
                : 'sem prazo'}
              {plusTarget.premium_grant_reason && ` · ${plusTarget.premium_grant_reason}`}.
              Uma nova liberação substitui a atual.
            </p>
          )}
          {plusTarget?.premium_source === 'stripe' && (
            <p className="text-xs text-muted-foreground">
              Este usuário já é assinante pago. A liberação garante o Plus mesmo se a assinatura for cancelada.
            </p>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Duração</Label>
              <Select value={plusDuration} onValueChange={setPlusDuration}>
                <SelectTrigger aria-label="Duração da liberação"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRANT_DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plus-reason">Motivo (registrado na auditoria)</Label>
              <Textarea
                id="plus-reason"
                value={plusReason}
                maxLength={500}
                placeholder="Ex.: cortesia, parceria, teste, suporte"
                onChange={(e) => setPlusReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {plusTarget?.premium_source === 'grant' && (
              <Button
                variant="outline"
                className="text-destructive sm:mr-auto"
                disabled={revokePremium.isPending}
                onClick={() => plusTarget && revokePremium.mutate(
                  { userId: plusTarget.user_id, reason: plusReason },
                  { onSuccess: () => setPlusTarget(null) },
                )}
              >
                {revokePremium.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Retirar liberação
              </Button>
            )}
            <Button variant="outline" onClick={() => setPlusTarget(null)}>Cancelar</Button>
            <Button
              disabled={grantPremium.isPending}
              onClick={() => plusTarget && grantPremium.mutate(
                {
                  userId: plusTarget.user_id,
                  days: plusDuration === 'none' ? null : Number(plusDuration),
                  reason: plusReason,
                },
                { onSuccess: () => setPlusTarget(null) },
              )}
            >
              {grantPremium.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Liberar Plus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddAffiliateDialog
        open={!!affiliatePrefill}
        onOpenChange={(o) => !o && setAffiliatePrefill(null)}
        prefill={affiliatePrefill ?? undefined}
      />
    </div>
  );
}
