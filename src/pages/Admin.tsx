import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  BookOpen, 
  Users, 
  Crown, 
  Search, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Hook to check admin role
function useIsAdmin() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await (supabase.rpc as any)('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      
      return data as boolean;
    },
    enabled: !!user,
  });
}

// Hook to fetch questions for admin
function useAdminQuestions(search: string) {
  return useQuery({
    queryKey: ['admin-questions', search],
    queryFn: async () => {
      let query = supabase
        .from('questions')
        .select('id, enunciado, categoria, dificuldade, is_premium, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (search) {
        query = query.ilike('enunciado', `%${search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Hook to fetch referral codes for admin
function useAdminReferralCodes() {
  return useQuery({
    queryKey: ['admin-referral-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [questionSearch, setQuestionSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const { data: questions, isLoading: questionsLoading, refetch: refetchQuestions } = useAdminQuestions(debouncedSearch);
  const { data: referralCodes, isLoading: codesLoading, refetch: refetchCodes } = useAdminReferralCodes();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(questionSearch), 300);
    return () => clearTimeout(timer);
  }, [questionSearch]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Toggle question premium status
  const togglePremium = useMutation({
    mutationFn: async ({ id, is_premium }: { id: string; is_premium: boolean }) => {
      const { error } = await supabase
        .from('questions')
        .update({ is_premium: !is_premium })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
      toast.success('Status premium atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + (error as Error).message);
    },
  });

  // Toggle referral code active status
  const toggleCodeActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('referral_codes')
        .update({ is_active: !is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-referral-codes'] });
      toast.success('Status do código atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + (error as Error).message);
    },
  });

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <Shield className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground text-center mb-4">
            Você não tem permissão para acessar o painel administrativo.
          </p>
          <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Gerencie conteúdo e códigos</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{questions?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Questões</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold">{referralCodes?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Códigos de Afiliados</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions" className="gap-2">
              <BookOpen className="w-4 h-4" /> Questões
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2">
              <Users className="w-4 h-4" /> Afiliados
            </TabsTrigger>
          </TabsList>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar questões..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetchQuestions()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {questionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : questions?.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Nenhuma questão encontrada
                  </CardContent>
                </Card>
              ) : (
                questions?.map((question) => (
                  <Card key={question.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium line-clamp-2 flex-1">
                          {question.enunciado}
                        </p>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={question.is_premium}
                            onCheckedChange={() => togglePremium.mutate({ 
                              id: question.id, 
                              is_premium: question.is_premium 
                            })}
                          />
                          {question.is_premium ? (
                            <Crown className="w-4 h-4 text-amber-500" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{question.categoria}</Badge>
                        <Badge variant="outline">{question.dificuldade}</Badge>
                        {question.is_premium && (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Premium
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => refetchCodes()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </div>

            <div className="space-y-3">
              {codesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : referralCodes?.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    Nenhum código de afiliado encontrado
                  </CardContent>
                </Card>
              ) : (
                referralCodes?.map((code) => (
                  <Card key={code.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-muted rounded text-sm font-mono font-bold">
                            {code.code}
                          </code>
                          {code.is_active ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <Switch
                          checked={code.is_active}
                          onCheckedChange={() => toggleCodeActive.mutate({ 
                            id: code.id, 
                            is_active: code.is_active 
                          })}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="font-bold">{code.total_uses}</p>
                          <p className="text-xs text-muted-foreground">Usos</p>
                        </div>
                        <div>
                          <p className="font-bold">{code.discount_percent}%</p>
                          <p className="text-xs text-muted-foreground">Desconto</p>
                        </div>
                        <div>
                          <p className="font-bold text-success">
                            R$ {Number(code.total_earnings).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">Ganhos</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
