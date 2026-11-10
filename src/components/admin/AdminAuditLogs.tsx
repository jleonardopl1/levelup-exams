import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, RefreshCw, Loader2, Shield, Ban, UserPlus, AlertTriangle, UserCog, Handshake, Wallet, Settings, DollarSign,
} from 'lucide-react';
import { useAdminAuditLogs, type AuditLogRow } from '@/hooks/useAdminAuditLogs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const eventIcons: Record<string, typeof Shield> = {
  access_level_changed: UserCog,
  affiliate_added: Handshake,
  affiliate_updated: Handshake,
  affiliate_removed: Handshake,
  affiliate_payout: Wallet,
  affiliate_conversion: DollarSign,
  setting_updated: Settings,
  role_assigned: UserPlus,
  role_revoked: Shield,
  user_banned: Ban,
  user_unbanned: AlertTriangle,
};

const eventLabels: Record<string, string> = {
  access_level_changed: 'Nível de Acesso Alterado',
  affiliate_added: 'Afiliado Adicionado',
  affiliate_updated: 'Afiliado Atualizado',
  affiliate_removed: 'Afiliado Removido',
  affiliate_payout: 'Pagamento de Comissão',
  affiliate_conversion: 'Venda de Afiliado',
  setting_updated: 'Configuração Alterada',
  role_assigned: 'Role Atribuída',
  role_revoked: 'Role Revogada',
  user_banned: 'Usuário Banido',
  user_unbanned: 'Usuário Desbanido',
};

const eventColors: Record<string, string> = {
  access_level_changed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  affiliate_added: 'bg-green-500/10 text-green-600 border-green-500/20',
  affiliate_updated: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  affiliate_removed: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  affiliate_payout: 'bg-green-500/10 text-green-600 border-green-500/20',
  affiliate_conversion: 'bg-green-500/10 text-green-600 border-green-500/20',
  setting_updated: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  role_assigned: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  role_revoked: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  user_banned: 'bg-destructive/10 text-destructive border-destructive/20',
  user_unbanned: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const LEVEL_LABELS: Record<string, string> = { master: 'Master', admin: 'Admin', moderator: 'Moderador', user: 'Usuário' };

/** Resumo legível do metadata de um evento de auditoria. */
function describeMeta(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  const str = (k: string) => (meta[k] === null || meta[k] === undefined || meta[k] === '' ? null : String(meta[k]));
  if (str('from') && str('to') && !str('key')) parts.push(`${LEVEL_LABELS[str('from')!] ?? str('from')} → ${LEVEL_LABELS[str('to')!] ?? str('to')}`);
  if (str('key')) parts.push(`${str('key')}: ${str('from') ?? '—'} → ${str('to')}`);
  if (str('code')) parts.push(`Código: ${str('code')}`);
  if (str('role')) parts.push(`Role: ${str('role')}`);
  if (str('ban_type')) parts.push(`Tipo: ${str('ban_type') === 'permanent' ? 'permanente' : `temporário${str('ban_days') ? ` (${str('ban_days')} dias)` : ''}`}`);
  if (str('commission_percent')) parts.push(`Comissão: ${str('commission_percent')}%`);
  if (str('discount_percent')) parts.push(`Desconto: ${str('discount_percent')}%`);
  if (str('amount')) parts.push(`Valor: R$ ${Number(meta.amount).toFixed(2).replace('.', ',')}`);
  if (str('commission')) parts.push(`Comissão gerada: R$ ${Number(meta.commission).toFixed(2).replace('.', ',')}`);
  if (str('reason')) parts.push(`Motivo: ${str('reason')}`);
  return parts.join(' · ');
}

/** Usuário afetado: nome resolvido no servidor ou, se a conta não tiver nome/existir mais, o id curto. */
function targetLabel(log: AuditLogRow): string | null {
  if (log.target_name) return log.target_name;
  const id = log.metadata?.target_user_id;
  return typeof id === 'string' && id ? `usuário ${id.slice(0, 8)}…` : null;
}

export function AdminAuditLogs() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: logs, isLoading, refetch } = useAdminAuditLogs(debouncedSearch);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !logs?.length ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum log de auditoria encontrado
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const Icon = eventIcons[log.event_type] || Shield;
            const meta = log.metadata;
            return (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={eventColors[log.event_type] || ''}>
                          {eventLabels[log.event_type] || log.event_type}
                        </Badge>
                        {log.success ? (
                          <Badge variant="outline" className="text-xs text-green-600">Sucesso</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Falha</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Autor:{' '}
                        <span className="font-medium text-foreground">
                          {log.actor_email || log.actor_name
                            || (log.event_type === 'affiliate_conversion' ? 'Sistema (Stripe)' : 'Sistema')}
                        </span>
                        {log.ip_address && <span className="text-xs"> · IP {log.ip_address}</span>}
                      </p>
                      {targetLabel(log) && (
                        <p className="text-sm text-muted-foreground">
                          Alvo: <span className="font-medium text-foreground">{targetLabel(log)}</span>
                        </p>
                      )}
                      {meta && describeMeta(meta) && (
                        <p className="text-sm text-muted-foreground break-words">{describeMeta(meta)}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
