import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { AdminMetricsDashboard } from '@/components/admin/AdminMetricsDashboard';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, BookOpen, Users, Crown, Search, RefreshCw,
  CheckCircle, XCircle, Loader2, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

function useAdminQuestions(search: string) {
  return useQuery({
    queryKey: ['admin-questions', search],
    queryFn: async () => {
      let query = supabase
        .from('questions')
        .select('id, enunciado, categoria, dificuldade, is_premium, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (search) query = query.ilike('enunciado', `%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

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
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [questionSearch, setQuestionSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: questions, isLoading: questionsLoading, refetch: refetchQuestions } = useAdminQuestions(debouncedSearch);
  const { data: referralCodes, isLoading: codesLoading, refetch: refetchCodes } = useAdminReferralCodes();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(questionSearch), 300);
    return () => clearTimeout(timer);
  }, [questionSearch]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const togglePremium = useMutation({
    mutationFn: async ({ id, is_premium }: { id: string; is_premium: boolean }) => {
      const { error } = await supabase.from('questions').update({ is_premium: !is_premium }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-questions'] }); toast.success('Status premium atualizado!'); },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
  });

  const toggleCodeActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('referral_codes').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-referral-codes'] }); toast.success('Status atualizado!'); },
    onError: (e) => toast.error('Erro: ' + (e as Error).message),
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
      <div className="px-4 py-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Métricas, usuários e conteúdo</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
              <Users className="w-4 h-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5 text-xs sm:text-sm">
              <BookOpen className="w-4 h-4" /> Questões
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-1.5 text-xs sm:text-sm">
              <Crown className="w-4 h-4" /> Afiliados
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <AdminMetricsDashboard />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar questões..." value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} className="pl-9" />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetchQuestions()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {questionsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : questions?.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma questão encontrada</CardContent></Card>
              ) : (
                questions?.map((q) => (
                  <Card key={q.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-medium line-clamp-2 flex-1">{q.enunciado}</p>
                        <div className="flex items-center gap-2">
                          <Switch checked={q.is_premium} onCheckedChange={() => togglePremium.mutate({ id: q.id, is_premium: q.is_premium })} />
                          {q.is_premium ? <Crown className="w-4 h-4 text-amber-500" /> : <BookOpen className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{q.categoria}</Badge>
                        <Badge variant="outline">{q.dificuldade}</Badge>
                        {q.is_premium && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Premium</Badge>}
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
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : referralCodes?.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum código encontrado</CardContent></Card>
              ) : (
                referralCodes?.map((code) => (
                  <Card key={code.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-muted rounded text-sm font-mono font-bold">{code.code}</code>
                          {code.is_active ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
                        </div>
                        <Switch checked={code.is_active} onCheckedChange={() => toggleCodeActive.mutate({ id: code.id, is_active: code.is_active })} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div><p className="font-bold">{code.total_uses}</p><p className="text-xs text-muted-foreground">Usos</p></div>
                        <div><p className="font-bold">{code.discount_percent}%</p><p className="text-xs text-muted-foreground">Desconto</p></div>
                        <div><p className="font-bold text-success">R$ {Number(code.total_earnings).toFixed(2)}</p><p className="text-xs text-muted-foreground">Ganhos</p></div>
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
