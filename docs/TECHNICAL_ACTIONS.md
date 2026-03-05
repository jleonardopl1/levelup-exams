# Acoes Tecnicas Recomendadas - LevelUp Exams

## P0 - Acoes Imediatas (Antes do Proximo Deploy)

### 1. Rotacionar Credenciais Expostas
- A chave publica do Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY`) estava commitada no repositorio
- Embora seja uma chave publica (anon key), e recomendado rotaciona-la como medida de precaucao
- **Acao:** Gerar nova chave no dashboard do Supabase > Settings > API
- **Acao:** Atualizar `.env` local e variaveis de ambiente no servico de deploy

### 2. Configurar CORS Restrito em Producao
- As Edge Functions agora usam `ALLOWED_ORIGIN` como variavel de ambiente
- **Acao:** Configurar no Supabase Dashboard > Edge Functions > Secrets:
  ```
  ALLOWED_ORIGIN=https://seu-dominio.com.br
  ```

### 3. Executar Migration de Operacoes Atomicas
- A migration `20260305030000_atomic_operations_and_indexes.sql` cria:
  - `redeem_reward()` - Resgate atomico de recompensas
  - `increment_daily_usage()` - Incremento atomico de uso diario
  - `increment_user_points()` - Incremento atomico de pontos
  - Indices de performance para queries frequentes
- **Acao:** Executar via `supabase db push` ou aplicar manualmente no SQL Editor

---

## P1 - Acoes de Curto Prazo (1-2 Semanas)

### 4. Implementar Testes Unitarios
- **Framework recomendado:** Vitest (compativel com Vite)
- **Prioridade de testes:**
  1. Hooks criticos: `useRewards`, `useDailyUsage`, `useQuizRewards`
  2. Funcoes utilitarias: `calculateLevel`, `getPointsForNextLevel`, `escapeHtml`
  3. Componentes: `ErrorBoundary`, formularios de autenticacao
- **Acao:** Instalar `vitest`, `@testing-library/react`, `@testing-library/jest-dom`

### 5. Configurar CI/CD
- **Plataforma recomendada:** GitHub Actions
- **Pipeline sugerido:**
  1. Lint (`npm run lint`)
  2. Type check (`npm run typecheck`)
  3. Testes (`npm run test`)
  4. Build (`npm run build`)
  5. Deploy automatico (Vercel, Netlify ou Supabase Hosting)

### 6. Implementar Error Tracking
- **Ferramenta recomendada:** Sentry
- Integrar no `ErrorBoundary` e nas Edge Functions
- Configurar alertas para erros criticos

### 7. Adicionar Coluna `email` na Tabela `profiles`
- O webhook do Stripe precisa encontrar usuarios por email
- Atualmente faz fallback para `listUsers` quando nao encontra pelo profile
- **Acao:** Adicionar coluna `email` em profiles e manter sincronizado via trigger

---

## P2 - Acoes de Medio Prazo (1-2 Meses)

### 8. Implementar Caching
- Cache de categorias no frontend (ja implementado com staleTime)
- Cache HTTP (headers `Cache-Control`) nas Edge Functions para dados estaticos
- Considerar Redis/Upstash para rate limiting de alta performance

### 9. Implementar Paginacao
- Admin: lista de usuarios, questoes, audit logs
- Ranking: paginacao infinita ou virtual scrolling
- **Impacto:** Melhoria significativa de performance com crescimento dos dados

### 10. Monitoramento e Observabilidade
- Metricas de performance (Core Web Vitals)
- Dashboard de metricas de negocio
- Alertas de anomalias (picos de erros, latencia)
- **Ferramentas:** Vercel Analytics, PostHog, ou Grafana

### 11. PWA e Offline Support
- Service Worker para caching de assets
- Manifest.json ja existe (melhorar configuracao)
- Push notifications para lembretes de estudo

---

## Checklist de Deploy Seguro

- [ ] Variaveis de ambiente configuradas (ALLOWED_ORIGIN, STRIPE_*, RESEND_*)
- [ ] Migrations aplicadas (`supabase db push`)
- [ ] Edge Functions deployadas (`supabase functions deploy`)
- [ ] Build sem erros (`npm run build`)
- [ ] Lint sem erros criticos (`npm run lint`)
- [ ] Type check passando (`npm run typecheck`)
- [ ] CORS testado (request de origem diferente rejeitado)
- [ ] Webhook Stripe configurado e testado
- [ ] SSL/TLS habilitado no dominio
- [ ] DNS configurado corretamente

---

## Matriz de Prioridade vs Impacto

| Acao | Prioridade | Impacto | Esforco |
|------|------------|---------|---------|
| Rotacionar credenciais | P0 | Alto | Baixo |
| Configurar CORS | P0 | Alto | Baixo |
| Executar migration atomica | P0 | Alto | Baixo |
| Testes unitarios | P1 | Alto | Medio |
| CI/CD | P1 | Medio | Medio |
| Error tracking (Sentry) | P1 | Alto | Baixo |
| Coluna email em profiles | P1 | Medio | Baixo |
| Caching | P2 | Medio | Medio |
| Paginacao | P2 | Alto | Medio |
| Monitoramento | P2 | Medio | Alto |
| PWA | P2 | Baixo | Alto |
