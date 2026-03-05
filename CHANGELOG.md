# Changelog

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
