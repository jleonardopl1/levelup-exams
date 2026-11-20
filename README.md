# LevelUp Exams

Plataforma gamificada de estudos para concursos publicos, vestibulares e ENEM.

## Stack Tecnologico

- **Frontend:** React 18, TypeScript, Vite
- **UI:** shadcn-ui (Radix UI), Tailwind CSS
- **State:** TanStack React Query
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Pagamentos:** Stripe API
- **IA:** modelos via Lovable AI Gateway, com camada compartilhada (`supabase/functions/_shared/ai`) e fabrica multiagente de questoes
- **Email:** Resend API

## Funcionalidades

- Sistema de quizzes com validacao server-side
- Gamificacao: pontos, niveis, conquistas, ranking
- Desafios diarios e recompensas
- Sistema de assinaturas (Free/Plus) via Stripe
- Painel administrativo com niveis de acesso (Admin Master, Administrador, Moderador)
- Programa de afiliados gerenciado pelo Admin Master, com dashboard de KPIs (ver `docs/ADMIN_E_AFILIADOS.md`)
- Trilhas de estudo por concurso com questoes novas toda semana (ver `docs/TRILHAS.md`)
- Plus: Simulado Oficial no formato do edital com posicao entre candidatos, revisao espacada dos erros, correcao da discursiva, Mentor IA com contexto e Passe Concurso (ver `docs/PLUS_IMPLANTACAO.md`)

## Arquitetura multiagente e governanca

- Relatorio de analise, referencias e roadmap: [`docs/ARQUITETURA_MULTIAGENTE.md`](docs/ARQUITETURA_MULTIAGENTE.md)
- Convencoes permanentes: [`CLAUDE.md`](CLAUDE.md) · estado vivo: [`AGENTS-COLLAB.md`](AGENTS-COLLAB.md) · catalogo de agentes: [`AGENTS.md`](AGENTS.md)
- Regras "sempre-seguir": [`rules/`](rules/) · contribuicao: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Operação da LevelUp Exams

- Consulte as atribuições das dez áreas e dos 69 especialistas no [organograma](docs/ORGANOGRAMA_OPERACIONAL.md). No Claude Code, cada cargo é uma skill: digite `/` e o nome da ficha, como `/cfo-2-rebate-comissionamento`. Para os outros usos, veja o [guia dos agentes](ops/agentes/README.md).
- Consulte o que foi instalado e testado em cada um dos 32 repositórios no [inventário das referências](docs/ANALISE_DAS_REFERENCIAS.md).
- A campanha do primeiro simulado, as metas de aquisição e o piloto de Pix por um segundo provedor estão no [relatório de crescimento e pagamentos](docs/CRESCIMENTO_E_PAGAMENTOS.md).

## Setup Local

### Pre-requisitos

- Node.js 18+
- npm

### Instalacao

```bash
# Clonar repositorio
git clone <URL_DO_REPO>
cd levelup-exams

# Instalar dependencias
npm install

# Copiar variaveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais do Supabase

# Iniciar servidor de desenvolvimento
npm run dev
```

O app estara disponivel em `http://localhost:8080`.

### Scripts Disponiveis

| Script | Descricao |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de producao |
| `npm run lint` | Verificar problemas de lint |
| `npm run lint:fix` | Corrigir problemas de lint |
| `npm run typecheck` | Verificar tipos TypeScript |
| `npm run preview` | Preview do build |
| `npm run test:edge` | Testes das Edge Functions (requer Deno 2) |

O lockfile oficial e o `bun.lockb` (o mesmo usado pelo Lovable): `bun install` e `bun run <script>` funcionam igual. A CI (`.github/workflows/ci.yml`) roda typecheck, lint, build e os testes das Edge Functions em todo PR.

## Estrutura do Projeto

```
src/
  components/    # Componentes React (UI + feature-specific)
  contexts/      # AuthContext para estado de autenticacao
  hooks/         # Custom hooks para data fetching e mutations
  integrations/  # Configuracao do Supabase client
  lib/           # Funcoes utilitarias
  pages/         # Componentes de pagina (rotas)

supabase/
  functions/     # Edge Functions (Deno)
    _shared/     # Utilidades compartilhadas (CORS, rate limit, audit)
    ai-mentor/   # Endpoint do mentor IA
    admin-*/     # Endpoints administrativos
    create-checkout/    # Criacao de sessao Stripe
    customer-portal/    # Portal de gerenciamento Stripe
    check-subscription/ # Verificacao de assinatura
    send-contact/       # Formulario de contato
    stripe-webhook/     # Webhook do Stripe
  migrations/    # Migracoes SQL (schema, RLS, RPC functions)
```

## Arquitetura

### Frontend
- Code splitting com React.lazy para todas as rotas
- React Query com staleTime e gcTime configurados
- Error Boundary para tratamento de erros
- React StrictMode habilitado

### Backend (Edge Functions)
- CORS restrito por variavel de ambiente `ALLOWED_ORIGIN`
- Rate limiting por IP em todos os endpoints
- Audit logging para eventos criticos
- Validacao de input em todos os endpoints
- Sanitizacao HTML (escapeHtml) para prevencao de XSS

### Banco de Dados
- RLS (Row Level Security) em todas as tabelas
- RPC functions atomicas para operacoes criticas
- Indices otimizados para queries frequentes
- Validacao server-side de respostas (view `questions_public`)

### Seguranca
- JWT authentication via Supabase Auth
- Controle de acesso hierarquico (master > admin > moderador > usuario) aplicado no banco
- Stripe webhook signature verification
- Price ID whitelist para checkout
- Rate limiting em todos os endpoints publicos

## Variaveis de Ambiente

### Frontend (.env)
- `VITE_SUPABASE_URL` - URL do projeto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Chave publica (anon) do Supabase
- `VITE_SUPABASE_PROJECT_ID` - ID do projeto Supabase

### Edge Functions (Supabase Secrets)
- `SUPABASE_URL` - URL do Supabase (automatico)
- `SUPABASE_SERVICE_ROLE_KEY` - Chave service role (automatico)
- `STRIPE_SECRET_KEY` - Chave secreta do Stripe
- `STRIPE_WEBHOOK_SECRET` - Secret do webhook Stripe
- `RESEND_API_KEY` - Chave da API Resend
- `LOVABLE_API_KEY` - Chave da API Lovable (para Mentor IA)
- `ALLOWED_ORIGIN` - Origem permitida para CORS

## Licenca

Projeto privado. Todos os direitos reservados.
