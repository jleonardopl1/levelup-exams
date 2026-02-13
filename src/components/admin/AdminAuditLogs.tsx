import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Loader2, Shield, Ban, UserPlus, AlertTriangle } from 'lucide-react';
import { useAdminAuditLogs } from '@/hooks/useAdminAuditLogs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const eventIcons: Record<string, typeof Shield> = {
  role_assigned: UserPlus,
  role_revoked: Shield,
  user_banned: Ban,
  user_unbanned: AlertTriangle,
};

const eventLabels: Record<string, string> = {
  role_assigned: 'Role Atribuída',
  role_revoked: 'Role Revogada',
  user_banned: 'Usuário Banido',
  user_unbanned: 'Usuário Desbanido',
};

const eventColors: Record<string, string> = {
  role_assigned: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  role_revoked: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  user_banned: 'bg-destructive/10 text-destructive border-destructive/20',
  user_unbanned: 'bg-green-500/10 text-green-600 border-green-500/20',
};

export function AdminAuditLogs() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: logs, isLoading, refetch } = useAdminAuditLogs(debouncedSearch);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar logs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setTimeout(() => setDebouncedSearch(e.target.value), 300);
            }}
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
            const meta = log.metadata as Record<string, string> | null;
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
                        Admin: <span className="font-medium text-foreground">{log.user_email || 'Desconhecido'}</span>
                      </p>
                      {meta?.target_name && (
                        <p className="text-sm text-muted-foreground">
                          Alvo: <span className="font-medium text-foreground">{meta.target_name}</span>
                          {meta.role && <> — Role: <span className="font-semibold">{meta.role}</span></>}
                          {meta.ban_type && <> — Tipo: <span className="font-semibold">{meta.ban_type}</span></>}
                          {meta.reason && <> — Motivo: {meta.reason}</>}
                        </p>
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
