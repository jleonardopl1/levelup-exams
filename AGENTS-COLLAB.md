# AGENTS-COLLAB.md — Estado vivo do LevelUp Exams

> **O que é isto.** O *agora* do projeto, não o histórico. Resolve a "amnésia entre agentes":
> vários agentes (e o dono) trabalham em sessões diferentes, às vezes em paralelo, e cada um
> chega sem saber das decisões recentes. Aqui ficam **decisões ativas**, **armadilhas**,
> **backlog priorizado** e o **último handoff**.
>
> **Leia em ≤ 3 minutos.** Cresceu demais? O `gerente-contexto` promove o que estabilizou para o
> `CLAUDE.md` e remove daqui. Metodologia: `docs/colaboracao/metodologia.md`.

Ordem de leitura: **este arquivo → `CLAUDE.md` → `rules/` → `docs/` → código.**
Elenco e faixas: `AGENTS.md` e `.claude/agents/README.md`.

---

## Decisões ativas
<!-- Formato: D# (data, quem decidiu) — decisão. -->

- **D1** (2026-11-16, dono + Claude Code) — Adotada a metodologia **AGENTS-COLLAB** com elenco de
  **17 agentes** de faixas sem sobreposição (`.claude/agents/`), camada `rules/`, CI e templates.
- **D2** (2026-11-16, dono + Claude Code) — Toda chamada nova a modelo passa pela camada
  `supabase/functions/_shared/ai/` (saída estruturada validada, prazo, novas tentativas,
  telemetria só de metadados, conteúdo externo cercado).
- **D3** (2026-11-16, dono + Claude Code) — **Fábrica de questões multiagente** é o padrão:
  Elaborador → portão determinístico → Solucionador cego ∥ Revisor → Árbitro nas divergências →
  lições por matéria. Interruptor de segurança: secret `QUESTION_PIPELINE=classic`.
- **D4** (herdada) — Nada aplicado em **banco remoto** nem em secrets de produção sem aprovação do
  dono. A migration `20261116120000_ai_runtime_observability.sql` está pronta e **aguarda aplicação**.
- **D5** (pendente — dono) — Estratégia de lojas: Capacitor (recomendado) vs. TWA só Android;
  cobrança dentro do app nas lojas (IAP) vs. link externo. Ver `docs/ARQUITETURA_MULTIAGENTE.md` §6.
- **D6** (pendente — dono) — Garantia de idade e supervisão parental exigidas pelo **ECA Digital**
  (Lei 15.211/2025, em vigor desde 17/03/2026) para alunos menores. Ver §7.2.
- **D8** (2026-11-17, dono + Claude Code) — **Radar de Concursos** é um grupo de agentes
  hierárquico (gerente master em código → coordenador por área → especialistas). Fato só com
  evidência literal da fonte oficial; retificação, regressão de fase e verificador indisponível
  vão para revisão humana; rascunho de trilha só é publicado por admin. Migration
  `20261117120000_radar_concursos.sql` **aguarda aplicação** (D4).
- **D7** (pendente — dono) — Correção dupla independente da discursiva (modelo INEP: 2 corretores,
  3º na discrepância) dobra o custo por correção. Ver §5.5.

---

## Armadilhas conhecidas

- 📦 **Lockfile oficial é `bun.lockb`** (o do Lovable). O `package-lock.json` ficou para trás quando
  o Lovable adicionou os plugins de dev; foi sincronizado em 2026-11-16. A CI usa `bun install --frozen-lockfile`.
- 🦕 **`deno check` precisa de `DENO_NO_PACKAGE_JSON=1`** (o `package.json` da raiz é do front);
  `auth-email-hook` é checado de dentro da própria pasta (tem `deno.json` com JSX). Já está na CI e em `bun run test:edge`.
- ⏱️ **O pg_cron espera 150 s** pela `generate-track-questions`. O pipeline tem orçamento de 140 s
  (`QUESTION_RUN_BUDGET_MS`): solucionador e revisor rodam em paralelo e o árbitro só entra se
  sobrar ≥ 20 s; disputa não arbitrada é reprovada (lado seguro).
- 🔀 **Embaralhar alternativas quebra explicação que cita letra.** O Elaborador agora é instruído a
  não citar letras e `shuffleAlternatives` não embaralha quando a explicação cita (`quality.ts`).
  Questões `ia_diaria` antigas podem ter esse defeito — auditar (backlog P1).
- 🧾 **Telemetria e lições são "best effort"**: sem a migration aplicada, as funções seguem
  funcionando e só registram aviso no log. Não conclua que "a IA não roda" por falta de linhas em `ai_runs`.
- 🕸️ **Radar: páginas montadas por JavaScript chegam vazias ao coletor** (Cebraspe, portal da
  Selecon) e a Fundatec tem anti-robô — semeadas desligadas. Fonte com "página sem texto" no
  painel precisa de outra URL (página do órgão, diário oficial). O coletor não executa JS.
- 🧩 **Tabelas do Radar ainda não estão em `types.ts`**: o front usa `radarDb` (cliente sem tipos)
  em `src/hooks/useRadar.ts`. Depois de aplicar a migration, regerar os tipos e trocar por `supabase`.
- 🔐 **`auth-email-hook` e `.lovable/` são gerenciados pelo Lovable** — não editar à mão.
- 🕛 **O limite diário do Free renova à meia-noite UTC** (21h de Brasília), não à meia-noite local.
- 💳 **Stripe:** confirmar em produção o endpoint do webhook registrado e o segredo de assinatura
  (o diagnóstico de `.lovable/plan.md` encontrou preços em modo de teste e nenhum webhook).

---

## Backlog priorizado
<!-- Detalhe, justificativa e referências: docs/ARQUITETURA_MULTIAGENTE.md §10 -->

- **P0 — fazer já (dono aprova):**
  1. Aplicar a migration `20261116120000` e publicar `generate-track-questions`, `essay-review`, `ai-mentor`.
  2. Acompanhar 7 dias de `ai_runs` (taxa de disputa, aprovação, custo) antes de ajustar modelos.
  3. ECA Digital: inventário de dados de menores, base legal, verificação de idade e supervisão (D6).
  4. Aplicar `20261117120000_radar_concursos.sql`, publicar `radar-concursos` e rodar Admin → Radar →
     Verificar agora; ampliar as fontes (órgãos e diários oficiais por área) com o `curador-conteudo`.
- **P1 — próximas 2–4 semanas:**
  4. Auditar questões `ia_diaria` publicadas: explicação com letras e gabarito (rodar o Solucionador cego em lote).
  5. Harness de testes do front (Vitest + Testing Library) para `lib/` e hooks críticos (`tester`).
  6. Painel admin: custo/latência por agente (de `ai_runs`) e curadoria de `ai_lessons`.
  7. Reportes de alunos resolvidos como "gabarito errado" viram lições (fonte `aluno`, cercadas).
  8. Observabilidade: Sentry (front + funções) e alertas da geração de questões.
- **P2 — próximos 1–3 meses:**
  9. Revisão espaçada FSRS no lugar das caixas fixas (1/3/7/14/30) (`cientista-aprendizagem`).
  10. Calibração TRI (3PL) das questões com as respostas reais → nota estimada estilo ENEM.
  11. Mentor socrático com ferramentas (progresso, fila de revisão) e cache de explicações por questão.
  12. App nas lojas (D5): Capacitor + push nativo + offline das trilhas.
- **P3 — 3–12 meses:** B2B (cursinhos/escolas multi-tenant), simulados adaptativos (CAT), MCP público de conteúdo.

---

## Handoff mais recente
<!-- Sempre o topo = o mais recente. Template: docs/colaboracao/handoff-template.md -->

### 2026-11-17 · Radar de Concursos (Claude Code, nas faixas de `engenheiro-ia`, `supabase-db`, `frontend` e `documentation-writer`)
- **Objetivo:** grupo de agentes (master → coordenador por área → especialistas) para pesquisar e
  monitorar concursos com edital previsto/publicado, manter o aluno avisado e criar trilhas novas.
- **O que mudou:** Edge Function `radar-concursos` (`fetcher.ts` coletor seguro + diff, `agents.ts`
  6 papéis, `evidence.ts` portão e consolidação, `scoring.ts` relevância, `pipeline.ts` orquestração,
  `tracks.ts` rascunho de trilha); migration `20261117120000` (7 tabelas, RLS, RPCs, sementes, cron
  a cada 3 h); páginas `/radar` e `/radar/:slug`, cartão na trilha, atalho em Trilhas, notificação
  clicável, aba Admin → Radar; guarda em `generate-track-questions` para legislação local sem fatos;
  `docs/RADAR_CONCURSOS.md`.
- **Testado:** `bun run typecheck` ✅ · `bun run lint` ✅ (0 erros; 48 avisos antigos) · `bun run build` ✅ ·
  `deno test` ✅ 65/65 (35 novos) · `deno check` ✅ 12/12 funções · migration no PGlite ✅ (2×, RLS,
  RPCs, fan-out sem duplicar, publicação de trilha, limite de follows) · coletor contra as fontes reais ✅
  (5 com texto; 3 dinâmicas/anti-robô semeadas desligadas).
- **Não testado:** chamadas reais ao gateway de IA (sem `LOVABLE_API_KEY` nesta sessão) e publicação no Supabase.
- **Bloqueios:** aplicação da migration e deploy dependem do dono (D4).
- **Próximo passo:** P0.4 do backlog; depois, fontes por área e banco autoral inicial das trilhas novas.

### 2026-11-16 · fundação multiagente (`coordenador` + `engenheiro-ia` + `supabase-db` + `reviewer` + `documentation-writer`)
- **Objetivo:** analisar AgroDecision, TradingAgents e o ecossistema `multi-agent-systems`;
  pesquisar referências mundiais; estruturar o LevelUp como sistema multiagente robusto.
- **O que mudou:** relatório `docs/ARQUITETURA_MULTIAGENTE.md`; governança (`CLAUDE.md`,
  `AGENTS.md`, este arquivo, `.claude/agents/` com 17 agentes, `rules/`, `docs/colaboracao/`,
  `CONTRIBUTING.md`, CI e templates); camada `_shared/ai` (cliente, telemetria, guardrails);
  `generate-track-questions` reescrita como pipeline multiagente com memória de lições;
  `essay-review` no cliente compartilhado (texto do aluno cercado); `ai-mentor` com `MENTOR_MODEL`
  e telemetria; migration `20261116120000` (ai_runs, ai_lessons, RPC, retenção); 9 erros de lint
  corrigidos; `package-lock.json` sincronizado.
- **Testado:** `bun run typecheck` ✅ · `bun run lint` ✅ (0 erros; 48 avisos antigos) ·
  `bun run build` ✅ · `deno test` ✅ 30/30 · `deno check` ✅ 11/11 funções · migration
  executada em Postgres em memória (PGlite) ✅ (idempotente, RPC, privilégios, retenção).
- **Não testado:** chamadas reais ao gateway de IA e publicação no Supabase (sem credenciais nesta sessão).
- **Bloqueios:** aplicação da migration e deploy das funções dependem do dono (D4).
- **Próximo passo:** P0 do backlog.
