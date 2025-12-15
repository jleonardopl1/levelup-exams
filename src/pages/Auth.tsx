import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, User, Github } from 'lucide-react';
import heroPattern from '@/assets/hero-pattern.png';
import ProfileCompletionModal from '@/components/ProfileCompletionModal';
import { supabase } from '@/integrations/supabase/client';
import Logo from '@/components/Logo';
import { z } from 'zod';

// Validation schemas
const emailSchema = z.string().trim().email({ message: "Email inválido" }).max(255);
const passwordSchema = z.string().min(6, { message: "Senha deve ter pelo menos 6 caracteres" }).max(128);
const displayNameSchema = z.string().trim().min(2, { message: "Nome deve ter pelo menos 2 caracteres" }).max(100).optional();

// Social provider icons
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { signIn, signUp, signInWithGoogle, signInWithOAuth, user } = useAuth();
  const navigate = useNavigate();

  // Check if user needs to complete profile after signup
  useEffect(() => {
    const checkProfileCompletion = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .maybeSingle();

        // If profile exists but has no avatar (new user via email signup)
        if (profile && !profile.avatar_url) {
          setShowProfileModal(true);
        } else if (profile) {
          navigate('/');
        }
      }
    };

    checkProfileCompletion();
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate email
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        toast.error(emailResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Validate password
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        toast.error(passwordResult.error.errors[0].message);
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await signIn(emailResult.data, password);
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
      } else {
        // Validate display name for signup
        const nameResult = displayNameSchema.safeParse(displayName || undefined);
        if (displayName && !nameResult.success) {
          toast.error(nameResult.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await signUp(emailResult.data, password, displayName?.trim() || undefined);
        if (error) throw error;
        toast.success('Conta criada com sucesso!');
        // Profile modal will be shown via useEffect when user state updates
      }
    } catch (error: any) {
      // Handle specific Supabase auth errors with user-friendly messages
      const errorMessage = error.message?.toLowerCase() || '';
      if (errorMessage.includes('user already registered') || errorMessage.includes('already exists')) {
        toast.error('Este email já está cadastrado. Tente fazer login.');
      } else if (errorMessage.includes('invalid login credentials')) {
        toast.error('Email ou senha incorretos.');
      } else if (errorMessage.includes('email not confirmed')) {
        toast.error('Por favor, confirme seu email antes de fazer login.');
      } else {
        toast.error(error.message || 'Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github' | 'linkedin_oidc' | 'azure' | 'facebook') => {
    setLoading(true);
    const providerNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      linkedin_oidc: 'LinkedIn',
      azure: 'Microsoft',
      facebook: 'Facebook'
    };
    try {
      if (provider === 'google') {
        const { error } = await signInWithGoogle();
        if (error) throw error;
      } else {
        const { error } = await signInWithOAuth(provider);
        if (error) throw error;
      }
    } catch (error: any) {
      toast.error(error.message || `Erro ao entrar com ${providerNames[provider]}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileModal(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={heroPattern} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
      </div>
      
      <Card variant="elevated" className="w-full max-w-md z-10 animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <Logo size="xl" showText={false} />
          </div>
          <CardTitle className="text-2xl font-display">
            {isLogin ? 'Bem-vindo de volta!' : 'Criar conta'}
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Entre para continuar seus estudos na LevelUp Exams' : 'Comece sua jornada gamificada de estudos'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthSignIn('google')}
              disabled={loading}
            >
              <GoogleIcon />
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthSignIn('github')}
              disabled={loading}
            >
              <Github className="w-5 h-5" />
              GitHub
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthSignIn('linkedin_oidc')}
              disabled={loading}
            >
              <LinkedInIcon />
              LinkedIn
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => handleOAuthSignIn('azure')}
              disabled={loading}
            >
              <MicrosoftIcon />
              Microsoft
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => handleOAuthSignIn('facebook')}
            disabled={loading}
          >
            <FacebookIcon />
            Continuar com Facebook
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Seu nome"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10"
              />
            </div>
            
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
            </button>
          </div>
        </CardContent>
      </Card>

      <ProfileCompletionModal
        open={showProfileModal}
        onComplete={handleProfileComplete}
      />
    </div>
  );
}
