# Changelog

## [1.2.0] - 2026-11-10

### Features
- Admin Master: conta do dono da plataforma com controle exclusivo de níveis de acesso (admin, moderador, usuário), protegida contra revogação
- Painel admin reorganizado por nível de acesso (Master, Administrador, Moderador), com busca paginada, filtros (equipe, afiliados, Plus, banidos) e guia da hierarquia
- Gestão de afiliados pelo master: adicionar (por e-mail ou a partir de um usuário), editar comissão/desconto, pausar, remover, registrar pagamentos e ligar/desligar a autoinscrição de Top Players
- Novo dashboard do afiliado com KPIs: comissão do mês (vs. mês anterior), saldo a receber, conversões, receita, ticket médio, indicados ativos/retenção, visitas, taxa de conversão, ranking, gráfico mensal e funil
- Link de indicação `/?ref=CODIGO` com contagem de visitas e aplicação automática do código no checkout
- Atribuição real de vendas: o código de indicação é aplicado no checkout (cupom Stripe) e a comissão é registrada pelo webhook de forma idempotente

### Security
- Escrita direta do cliente em `user_roles`, `user_bans`, `referral_codes` (exceto autoinscrição) e `referral_uses` revogada; ações passam por RPCs com hierarquia validada no banco
- Moderadores e administradores só moderam usuários comuns; somente o master modera a equipe
- E-mails de usuários visíveis apenas para o master (LGPD)
- `admin-notify` relê o estado no banco antes de bloquear contas ou enviar e-mails
- Busca de auditoria sanitizada antes de montar o filtro do PostgREST


## [1.1.0] - 2026-11-10

### Features
- Trilhas de estudo por concurso, começando pela Câmara Municipal de Cuiabá-MT 2026 (Selecon): módulos de nível médio e superior, seletor de cargo, quadro de pesos do edital, projeção de nota, foco do dia e conteúdo programático por matéria
- Banco inicial de 1.091 questões autorais (19 matérias, no mínimo 50 por matéria e por nível)
- Seleção inteligente de questões (inéditas primeiro, depois erros), modo "Revisar erros" e "Novas da semana"
- Geração automática diária de questões novas (3 por matéria por dia) com passe revisor e agendamento via pg_cron
- Painel admin para acompanhar e disparar a geração


## [1.0.0] - 2026-03-05

### Features
- Sistema de quizzes com validacao server-side
- Gamificacao completa: pontos, niveis, conquistas, ranking
- Desafios diarios e sistema de recompensas
- Mentor IA com Gemini 2.5 Flash (exclusivo Plus)
- Assinaturas Free/Plus via Stripe
- Portal de gerenciamento de assinatura
- Painel administrativo (usuarios, questoes, metricas, audit logs)
- Sistema de indicacoes/afiliados
- Formulario de contato com email via Resend
- Notificacoes in-app

### Security
- CORS restrito por variavel de ambiente em todas as Edge Functions
- Sanitizacao HTML (XSS) em todos os templates de email
- Rate limiting em todos os endpoints publicos e admin
- RPC functions atomicas para prevenir race conditions
- Validacao de action types em endpoints administrativos
- Stripe webhook signature verification
- Price ID whitelist para checkout

### Performance
- Code splitting com React.lazy em todas as rotas
- QueryClient otimizado com staleTime e gcTime
- Vendor splitting no build (react, supabase, radix-ui, recharts)
- Polling de subscription reduzido de 1min para 5min
- Queries paralelas em processRewards (Promise.all)
- Indices de banco otimizados

### Code Quality
- TypeScript strict mode habilitado
- ESLint no-unused-vars como warning
- React StrictMode habilitado
- Error Boundary para tratamento de erros
- Utilidades compartilhadas nas Edge Functions (_shared/)
- Versoes de dependencias normalizadas nas Edge Functions
