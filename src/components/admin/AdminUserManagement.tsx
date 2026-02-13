import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, RefreshCw, Shield, Ban, Loader2, UserPlus, XCircle } from 'lucide-react';
import { useAdminUsers, useAdminUserRoles, useAdminBans, useAssignRole, useRevokeRole, useBanUser, useUnbanUser } from '@/hooks/useAdminUsers';
import { useAuth } from '@/contexts/AuthContext';

export function AdminUserManagement() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: '', name: '' });
  const [banDialog, setBanDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: '', name: '' });
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'user'>('moderator');
  const [banType, setBanType] = useState<'temporary' | 'permanent'>('temporary');
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState('7');

  const { data: users, isLoading, refetch } = useAdminUsers(debouncedSearch);
  const { data: roles } = useAdminUserRoles();
  const { data: bans } = useAdminBans();
  const assignRole = useAssignRole();
  const revokeRole = useRevokeRole();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();

  // Debounce
  useState(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  });

  const getUserRoles = (userId: string) => roles?.filter(r => r.user_id === userId) || [];
  const getUserBan = (userId: string) => bans?.find(b => b.user_id === userId && b.is_active);

  const handleAssignRole = () => {
    assignRole.mutate({ userId: roleDialog.userId, role: selectedRole });
    setRoleDialog({ open: false, userId: '', name: '' });
  };

  const handleBanUser = () => {
    if (!user) return;
    const expiresAt = banType === 'temporary'
      ? new Date(Date.now() + parseInt(banDays) * 86400000).toISOString()
      : undefined;
    banUser.mutate({
      userId: banDialog.userId,
      bannedBy: user.id,
      banType,
      reason: banReason,
      expiresAt,
    });
    setBanDialog({ open: false, userId: '', name: '' });
    setBanReason('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setTimeout(() => setDebouncedSearch(e.target.value), 300); }}
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
      ) : (
        <div className="space-y-3">
          {users?.map((u) => {
            const userRoles = getUserRoles(u.user_id);
            const ban = getUserBan(u.user_id);
            return (
              <Card key={u.id} className={ban ? 'border-destructive/50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs">
                        {(u.display_name || 'U').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{u.display_name || 'Sem nome'}</p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        <Badge variant="outline" className="text-xs">{u.tier}</Badge>
                        {userRoles.map(r => (
                          <Badge key={r.id} variant="secondary" className="text-xs gap-1">
                            <Shield className="w-3 h-3" />
                            {r.role}
                            <button
                              onClick={() => revokeRole.mutate({ userId: u.user_id, role: r.role })}
                              className="ml-0.5 hover:text-destructive"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        {ban && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <Ban className="w-3 h-3" /> Banido
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <p className="font-bold">{u.total_quizzes}</p>
                      <p className="text-muted-foreground">Quizzes</p>
                    </div>
                    <div>
                      <p className="font-bold">{u.total_correct}/{u.total_questions}</p>
                      <p className="text-muted-foreground">Acertos</p>
                    </div>
                    <div>
                      <p className="font-bold">{u.streak_days}🔥</p>
                      <p className="text-muted-foreground">Streak</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => setRoleDialog({ open: true, userId: u.user_id, name: u.display_name || 'Usuário' })}
                    >
                      <UserPlus className="w-3 h-3" /> Role
                    </Button>
                    {ban ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 text-success"
                        onClick={() => unbanUser.mutate(ban.id)}
                      >
                        Desbanir
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1 text-destructive"
                        onClick={() => setBanDialog({ open: true, userId: u.user_id, name: u.display_name || 'Usuário' })}
                      >
                        <Ban className="w-3 h-3" /> Banir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Role Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(o) => setRoleDialog(prev => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Role</DialogTitle>
            <DialogDescription>Atribuir uma role para {roleDialog.name}</DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as 'admin' | 'moderator' | 'user')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderador</SelectItem>
              <SelectItem value="user">Usuário</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog({ open: false, userId: '', name: '' })}>Cancelar</Button>
            <Button onClick={handleAssignRole}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={banDialog.open} onOpenChange={(o) => setBanDialog(prev => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Banir Usuário</DialogTitle>
            <DialogDescription>Banir {banDialog.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={banType} onValueChange={(v) => setBanType(v as 'temporary' | 'permanent')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="temporary">Temporário</SelectItem>
                <SelectItem value="permanent">Permanente</SelectItem>
              </SelectContent>
            </Select>
            {banType === 'temporary' && (
              <Input
                type="number"
                placeholder="Dias de banimento"
                value={banDays}
                onChange={(e) => setBanDays(e.target.value)}
              />
            )}
            <Textarea
              placeholder="Motivo do banimento..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialog({ open: false, userId: '', name: '' })}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBanUser}>Banir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
