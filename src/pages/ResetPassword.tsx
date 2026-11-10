import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2, Lock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MIN_PASSWORD_LENGTH, passwordErrorMessage, validateNewPassword } from '@/lib/authErrors';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

/** Lê erros que o Supabase devolve na URL quando o link é inválido/expirado. */
function urlError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('error_description') || hash.get('error_description');
}

/**
 * Destino do link de "Esqueci minha senha". O supabase-js troca o token da URL por uma
 * sessão de recuperação; com ela o usuário define a nova senha via updateUser.
 */
export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (urlError()) {
      setStage('invalid');
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setStage((s) => (s === 'done' ? s : 'ready'));
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sem sessão alguns segundos depois de carregar: link inválido, expirado ou já usado.
  useEffect(() => {
    if (loading || stage !== 'checking') return;
    if (user) {
      setStage('ready');
      return;
    }
    const t = setTimeout(() => setStage((s) => (s === 'checking' ? 'invalid' : s)), 3000);
    return () => clearTimeout(t);
  }, [loading, user, stage]);

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
    setStage('done');
    toast.success('Senha atualizada!');
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center"><Logo /></div>
          <CardTitle className="flex items-center justify-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Criar nova senha
          </CardTitle>
          <CardDescription>
            {stage === 'done'
              ? 'Tudo certo! Use a nova senha para entrar com e-mail.'
              : 'Escolha uma senha para entrar com seu e-mail.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stage === 'checking' && (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground" role="status">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Validando o link...</p>
            </div>
          )}

          {stage === 'invalid' && (
            <div className="space-y-4 text-center" role="alert">
              <XCircle className="w-12 h-12 mx-auto text-destructive" />
              <p className="text-sm text-muted-foreground">
                Este link é inválido, expirou ou já foi usado. Os links de redefinição valem por tempo limitado e só uma vez.
              </p>
              <Button className="w-full" onClick={() => navigate('/auth')}>Solicitar um novo link</Button>
            </div>
          )}

          {stage === 'ready' && (
            <form onSubmit={submit} className="space-y-4">
              {user?.email && (
                <p className="text-sm text-center text-muted-foreground">
                  Conta: <span className="font-medium text-foreground">{user.email}</span>
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    autoFocus
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Mínimo de {MIN_PASSWORD_LENGTH} caracteres, com letras e números.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar nova senha
              </Button>
            </form>
          )}

          {stage === 'done' && (
            <div className="space-y-4 text-center" role="status">
              <CheckCircle2 className="w-12 h-12 mx-auto text-success" />
              <Button className="w-full" onClick={() => navigate('/')}>Ir para o início</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
