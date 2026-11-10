import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ACCESS_LEVEL_LABELS, useAccess } from '@/hooks/useAccess';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { AdminMetricsDashboard } from '@/components/admin/AdminMetricsDashboard';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';
import { AdminAuditLogs } from '@/components/admin/AdminAuditLogs';
import { AdminQuestionGeneration } from '@/components/admin/AdminQuestionGeneration';
import { AdminAffiliates } from '@/components/admin/AdminAffiliates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, BookOpen, Users, Crown, Search, RefreshCw, Loader2, BarChart3, FileText, Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { access, isLoading: adminLoading } = useAccess();
  const { isAdmin, isStaff, isMaster } = access;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [questionSearch, setQuestionSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: questions, isLoading: questionsLoading, refetch: refetchQuestions } = useAdminQuestions(debouncedSearch);

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

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (!isStaff) {
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
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isMaster ? 'bg-gradient-to-br from-amber-500 to-yellow-400' : 'bg-gradient-to-br from-primary to-accent',
          )}>
            {isMaster ? <Crown className="w-6 h-6 text-white" /> : <Shield className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-display font-bold">{isMaster ? 'Painel Admin Master' : 'Painel Admin'}</h1>
            <p className="text-sm text-muted-foreground">
              {isMaster
                ? 'Controle total: acessos, afiliados, conteúdo e métricas'
                : isAdmin ? 'Métricas, moderação, conteúdo e auditoria' : 'Moderação de usuários e conteúdo'}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn('gap-1', isMaster && 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white border-transparent')}
          >
            {isMaster ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {ACCESS_LEVEL_LABELS[access.accessLevel]}
          </Badge>
        </div>

        <Tabs defaultValue={isAdmin ? 'overview' : 'users'} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-max min-w-full justify-start sm:justify-center">
              {isAdmin && (
                <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
                  <BarChart3 className="w-4 h-4" /> Visão Geral
                </TabsTrigger>
              )}
              <TabsTrigger value="users" className="gap-1.5 text-xs sm:text-sm">
                <Users className="w-4 h-4" /> {isMaster ? 'Usuários & Acessos' : 'Usuários'}
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="affiliates" className="gap-1.5 text-xs sm:text-sm">
                  <Handshake className="w-4 h-4" /> Afiliados
                </TabsTrigger>
              )}
              <TabsTrigger value="questions" className="gap-1.5 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4" /> Questões
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="audit" className="gap-1.5 text-xs sm:text-sm">
                  <FileText className="w-4 h-4" /> Auditoria
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {isAdmin && (
            <TabsContent value="overview">
              <AdminMetricsDashboard />
            </TabsContent>
          )}

          {/* Users Tab */}
          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            {isAdmin && <AdminQuestionGeneration />}
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

          {isAdmin && (
            <TabsContent value="affiliates">
              <AdminAffiliates />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="audit">
              <AdminAuditLogs />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
