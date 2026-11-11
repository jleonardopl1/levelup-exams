import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell, Crown, Handshake, KeyRound, Loader2, LogOut, Mail, Save, Settings as SettingsIcon, Shield,
  ShieldCheck, Trash2, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PremiumBadge } from '@/components/PremiumBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { ACCESS_LEVEL_LABELS, useAccess } from '@/hooks/useAccess';
import { useStreakReminder } from '@/hooks/useStreakReminder';
import { AVATAR_OPTIONS } from '@/lib/avatars';
import { getSafeDisplayName } from '@/lib/displayName';
import { MIN_PASSWORD_LENGTH, passwordErrorMessage, validateNewPassword } from '@/lib/authErrors';

const PROVIDER_LABELS: Record<string, string> = {
  email: 'E-mail e senha',
  google: 'Google',
  github: 'GitHub',
  azure: 'Microsoft / Outlook',
  microsoft: 'Microsoft / Outlook',
  apple: 'Apple',
  linkedin_oidc: 'LinkedIn',
  facebook: 'Facebook',
};

function validateName(name: string): string | null {
  const n = name.trim();
  if (!n) return 'Informe seu nome.';
  if (n.length > 60) return 'Use no máximo 60 caracteres.';
  if (n.includes('@')) return 'O nome não pode ser um e-mail (ele aparece no ranking).';
  return null;
}

function SectionTitle({ icon: Icon, children }: { icon: typeof UserIcon; children: React.ReactNode }) {
  return (
    <CardTitle className="text-base flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" aria-hidden /> {children}
    </CardTitle>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Foto do provedor de login (ex.: Google) como opção extra, se for https.
  const providerPhoto = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const url = (meta.avatar_url ?? meta.picture) as string | undefined;
    return typeof url === 'string' && url.startsWith('https://') ? url : null;
  }, [user]);
  const options = useMemo(
    () => (providerPhoto ? [providerPhoto, ...AVATAR_OPTIONS] : AVATAR_OPTIONS),
    [providerPhoto],
  );

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name && !profile.display_name.includes('@') ? profile.display_name : '');
    setAvatar(profile.avatar_url);
  }, [profile]);

  const dirty = !!profile && (name.trim() !== (profile.display_name ?? '') || avatar !== profile.avatar_url);

  const save = () => {
    const problem = validateName(name);
    setNameError(problem);
    if (problem) return;
    update.mutate(
      { display_name: name.trim(), avatar_url: avatar },
      {
        onSuccess: () => toast.success('Perfil atualizado!'),
        onError: () => toast.error('Não foi possível salvar o perfil.'),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle icon={UserIcon}>Perfil</SectionTitle>
        <CardDescription>Seu nome e foto aparecem no ranking e no compartilhamento de conquistas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="display-name">Nome de exibição</Label>
              <Input
                id="display-name"
                value={name}
                maxLength={60}
                placeholder="Como você quer ser chamado"
                onChange={(e) => { setName(e.target.value); setNameError(null); }}
                aria-invalid={!!nameError}
              />
              {nameError && <p className="text-xs text-destructive" role="alert">{nameError}</p>}
            </div>
            <div className="space-y-2">
              <Label>Foto</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Escolher foto">
                {options.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    role="radio"
                    aria-checked={avatar === url}
                    aria-label={i === 0 && providerPhoto ? 'Foto da conta Google' : `Avatar ${i + 1}`}
                    onClick={() => setAvatar(url)}
                    className={cn(
                      'rounded-full p-0.5 border-2 transition-colors',
                      avatar === url ? 'border-primary' : 'border-transparent hover:border-muted-foreground/40',
                    )}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={url} alt="" referrerPolicy="no-referrer" />
                      <AvatarFallback>{i + 1}</AvatarFallback>
                    </Avatar>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={save} disabled={!dirty || update.isPending} className="gap-1.5">
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar perfil
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AccountSection() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { access } = useAccess();
  const navigate = useNavigate();
  const providers = Array.from(new Set((user?.identities ?? []).map((i) => i.provider)));

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle icon={Mail}>Conta</SectionTitle>
        <CardDescription>Dados da sua conta no LevelUp Exams.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium break-all">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Formas de login</dt>
            <dd className="flex flex-wrap gap-1 mt-0.5">
              {providers.length === 0 ? '—' : providers.map((p) => (
                <Badge key={p} variant="outline">{PROVIDER_LABELS[p] ?? p}</Badge>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Plano</dt>
            <dd className="flex items-center gap-2 mt-0.5">
              <PremiumBadge tier={profile?.tier ?? 'free'} />
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/upgrade')}>
                {profile?.tier === 'plus' ? 'Gerenciar assinatura' : 'Fazer upgrade'}
              </Button>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Membro desde</dt>
            <dd className="font-medium">
              {user?.created_at ? format(parseISO(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nível de acesso</dt>
            <dd className="flex items-center gap-2 mt-0.5">
              <Badge
                variant="outline"
                className={cn('gap-1', access.isMaster && 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-transparent')}
              >
                {access.isMaster ? <Crown className="w-3 h-3" /> : access.isStaff ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {ACCESS_LEVEL_LABELS[access.accessLevel]}
              </Badge>
              {access.isStaff && (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/admin')}>Abrir painel</Button>
              )}
            </dd>
          </div>
          {access.isAffiliate && (
            <div>
              <dt className="text-muted-foreground">Programa de afiliados</dt>
              <dd className="mt-0.5">
                <Button variant="link" size="sm" className="h-auto p-0 gap-1" onClick={() => navigate('/affiliate')}>
                  <Handshake className="w-3 h-3" /> Ver meu painel de afiliado
                </Button>
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function SecuritySection() {
  const { user, updatePassword, signOutEverywhere } = useAuth();
  const navigate = useNavigate();
  const hasPassword = (user?.identities ?? []).some((i) => i.provider === 'email');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirm);
    setError(problem);
    if (problem) return;
    setSaving(true);
    const { error: err } = await updatePassword(password);
    setSaving(false);
    if (err) {
      setError(passwordErrorMessage(err));
      return;
    }
    setPassword('');
    setConfirm('');
    toast.success(hasPassword ? 'Senha alterada!' : 'Senha criada! Agora você também pode entrar com e-mail e senha.');
  };

  const logoutAll = async () => {
    setSigningOut(true);
    const { error: err } = await signOutEverywhere();
    setSigningOut(false);
    if (err) {
      toast.error('Não foi possível encerrar as sessões. Verifique sua conexão e tente novamente.');
      return;
    }
    toast.success('Sessões encerradas em todos os dispositivos.');
    navigate('/auth');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle icon={KeyRound}>Segurança</SectionTitle>
        <CardDescription>
          {hasPassword
            ? 'Altere a senha usada para entrar com e-mail.'
            : 'Sua conta entra pelo Google. Crie uma senha para também poder entrar com e-mail e senha.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} className="space-y-3 max-w-md">
          {/* Campo oculto ajuda gerenciadores de senha a associar a conta. */}
          <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <div className="space-y-1.5">
            <Label htmlFor="settings-new-password">{hasPassword ? 'Nova senha' : 'Senha'}</Label>
            <Input id="settings-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">Mínimo de {MIN_PASSWORD_LENGTH} caracteres, com letras e números.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-confirm-password">Confirmar senha</Label>
            <Input id="settings-confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={saving || !password} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {hasPassword ? 'Alterar senha' : 'Criar senha'}
          </Button>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Sair de todos os dispositivos</p>
            <p className="text-xs text-muted-foreground">Encerra o acesso em outros celulares e computadores, inclusive este.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="gap-1.5 shrink-0"><LogOut className="w-4 h-4" /> Sair de todos</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair de todos os dispositivos?</AlertDialogTitle>
                <AlertDialogDescription>Você precisará entrar novamente em cada aparelho.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={logoutAll} disabled={signingOut}>Sair de todos</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsSection() {
  const { isSupported, isEnabled, permission, enableNotifications, disableNotifications } = useStreakReminder();
  const [busy, setBusy] = useState(false);

  const toggle = async (on: boolean) => {
    if (!on) {
      disableNotifications();
      toast.success('Lembretes desativados.');
      return;
    }
    setBusy(true);
    const ok = await enableNotifications();
    setBusy(false);
    if (ok) toast.success('Lembretes ativados!');
    else toast.error('Permita as notificações no navegador para ativar os lembretes.');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle icon={Bell}>Notificações</SectionTitle>
        <CardDescription>Lembretes para não perder sua sequência de estudos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="streak-reminder" className="text-sm font-medium">Lembrete diário de sequência</Label>
            <p className="text-xs text-muted-foreground">
              {!isSupported
                ? 'Este navegador não suporta notificações.'
                : permission === 'denied'
                  ? 'Notificações bloqueadas no navegador. Libere nas configurações do site.'
                  : 'Receba um aviso neste navegador quando ainda não tiver estudado no dia.'}
            </p>
          </div>
          <Switch
            id="streak-reminder"
            checked={isEnabled}
            disabled={!isSupported || permission === 'denied' || busy}
            onCheckedChange={toggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PrivacySection() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionTitle icon={Trash2}>Privacidade e dados</SectionTitle>
        <CardDescription>
          Você pode pedir a exclusão da sua conta e dos seus dados (LGPD). Assinaturas ativas são canceladas junto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="text-destructive" onClick={() => navigate('/faq')}>
          Solicitar exclusão pelo formulário de contato
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { user, loading } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="px-4 py-6 space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile?.avatar_url || undefined} alt="" referrerPolicy="no-referrer" />
            <AvatarFallback><SettingsIcon className="w-5 h-5" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold">Configurações</h1>
            <p className="text-sm text-muted-foreground truncate">
              {getSafeDisplayName(profile?.display_name, 'Defina seu nome abaixo')} · {user.email}
            </p>
          </div>
        </div>
        <ProfileSection />
        <AccountSection />
        <SecuritySection />
        <NotificationsSection />
        <PrivacySection />
      </div>
    </div>
  );
}
