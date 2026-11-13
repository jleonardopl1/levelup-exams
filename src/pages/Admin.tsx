import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ACCESS_LEVEL_LABELS, useAccess } from '@/hooks/useAccess';
import { useOpenReportsCount } from '@/hooks/useAdminConsole';
import { AppHeader } from '@/components/AppHeader';
import { AdminPlatformOverview } from '@/components/admin/AdminPlatformOverview';
import { AdminUserManagement } from '@/components/admin/AdminUserManagement';
import { AdminAuditLogs } from '@/components/admin/AdminAuditLogs';
import { AdminQuestionGeneration } from '@/components/admin/AdminQuestionGeneration';
import { AdminAffiliates } from '@/components/admin/AdminAffiliates';
import { AdminQuestionBank } from '@/components/admin/AdminQuestionBank';
import { AdminQuestionReports } from '@/components/admin/AdminQuestionReports';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, BookOpen, Users, Crown, BarChart3, FileText, Handshake, Flag, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MainTab = 'overview' | 'users' | 'affiliates' | 'questions' | 'reports' | 'audit';
type QuestionsView = 'bank' | 'generation';

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { access, isLoading: adminLoading } = useAccess();
  const { isAdmin, isStaff, isMaster } = access;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: openReports = 0 } = useOpenReportsCount(isStaff);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

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

  const adminOnly: MainTab[] = ['overview', 'affiliates', 'audit'];
  const requested = params.get('tab') as MainTab | null;
  const tab: MainTab = requested && (isAdmin || !adminOnly.includes(requested))
    && ['overview', 'users', 'affiliates', 'questions', 'reports', 'audit'].includes(requested)
    ? requested
    : (isAdmin ? 'overview' : 'reports');
  const questionsView: QuestionsView = params.get('view') === 'generation' && isAdmin ? 'generation' : 'bank';

  const setTab = (next: string) => setParams({ tab: next }, { replace: true });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="px-4 py-6 space-y-6 max-w-6xl mx-auto">
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
                ? 'Controle total: métricas, acessos, afiliados, conteúdo e auditoria'
                : isAdmin ? 'Métricas, moderação, conteúdo e auditoria' : 'Moderação de usuários e curadoria de conteúdo'}
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

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
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
              <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
                <Flag className="w-4 h-4" /> Reportes
                {openReports > 0 && (
                  <span className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold flex items-center justify-center">
                    {openReports > 99 ? '99+' : openReports}
                  </span>
                )}
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
              <AdminPlatformOverview onOpenReports={() => setTab('reports')} />
            </TabsContent>
          )}

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="affiliates">
              <AdminAffiliates />
            </TabsContent>
          )}

          <TabsContent value="questions" className="space-y-4">
            {isAdmin && (
              <div className="flex rounded-full bg-muted p-0.5 text-sm w-fit" role="tablist" aria-label="Seção de questões">
                {([['bank', 'Banco de questões', BookOpen], ['generation', 'Geração com IA', Sparkles]] as const).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={questionsView === v}
                    onClick={() => setParams({ tab: 'questions', view: v }, { replace: true })}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors',
                      questionsView === v ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            )}
            {questionsView === 'generation' ? <AdminQuestionGeneration /> : <AdminQuestionBank canEditContent={isAdmin} />}
          </TabsContent>

          <TabsContent value="reports">
            <AdminQuestionReports canEditContent={isAdmin} />
          </TabsContent>

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
