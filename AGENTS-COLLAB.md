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
  dono. Para a migration `20261116120000_ai_runtime_observability.sql`, conferir o histórico do ambiente (P0.1).
- **D5** (pendente — dono) — Estratégia de lojas: Capacitor (recomendado) vs. TWA só Android;
  cobrança dentro do app nas lojas (IAP) vs. link externo. Ver `docs/ARQUITETURA_MULTIAGENTE.md` §6.
- **D6** (pendente — dono) — Garantia de idade e supervisão parental exigidas pelo **ECA Digital**
  (Lei 15.211/2025, em vigor desde 17/03/2026) para alunos menores. Ver §7.2.
- **D8** (2026-11-17, dono + Claude Code) — **Radar de Concursos** é um grupo de agentes
  hierárquico (gerente master em código → coordenador por área → especialistas). Fato só com
  evidência literal da fonte oficial; retificação, regressão de fase e verificador indisponível
  vão para revisão humana; rascunho de trilha só é publicado por admin. Conferir no ambiente a
  implantação de `20261117120000_radar_concursos.sql` (D4, P0.4).
- **D9** (2026-11-17, dono + Claude Code) — Referências externas entram pelo filtro da
  estrela-guia e do stack: só vira código o que ajuda o candidato ou protege quem estuda/os agentes,
  com teste; o resto vai para backlog com motivo (`docs/REFERENCIAS_REPOSITORIOS.md`). Convenções
  que não podem falhar ficam também em código (`.claude/hooks/guardrails.mjs`).
- **D10** (pendente — dono) — Abrir o Radar (`/radar/:slug`) sem login como página de entrada por
  concurso (SEO e aquisição). Exige política de leitura para `anon` nas tabelas publicadas do Radar.
- **D7** (pendente — dono) — Correção dupla independente da discursiva (modelo INEP: 2 corretores,
  3º na discrepância) dobra o custo por correção. Ver §5.5.
- **D11** (2026-11-17, dono) — Priorizar a conciliação de pagamento, acesso e comissão do Plus e do
  Passe Concurso e o piloto de leitura da revisão e do desempenho do próprio aluno no Mentor.
  As fases seguintes têm prazos estimados e critérios de avanço no [plano de integração operacional](docs/INTEGRACAO_OPERACIONAL.md).

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
- 🔐 **`auth-email-hook` e `.lovable/` são gerenciados pelo Lovable** — não editar à mão (o hook de
  guardrails bloqueia).
- 🧪 **`tsc --noEmit` no tsconfig raiz não checa nada** (`"files": []` + referências). O
  `bun run typecheck` agora usa `-p tsconfig.app.json` e `-p tsconfig.node.json`; não volte.
- 🔤 **`normalize('NFKC')` troca "º" por "o"** ("1º" vira "1o"). Para texto exibido ou falado use
  NFC; NFKC só para comparar/deduplicar.
- 💬 **O Mentor mostra texto puro** (sem renderizar Markdown): o prompt pede texto simples. Se um
  dia renderizar Markdown, sanitize (saída de modelo em sink HTML é risco do OWASP LLM).
- 🦕 **Sessões na nuvem podem vir sem Deno**: baixe o binário de `dl.deno.land` para rodar
  `bun run test:edge`. `bun run test:unit` precisa de Node 22.18+ (TypeScript sem flag).
- 🕛 **O limite diário do Free renova à meia-noite UTC** (21h de Brasília), não à meia-noite local.
- 💳 **Stripe:** confirmar em produção o endpoint do webhook registrado e o segredo de assinatura
  antes de planejar a ativação. O [PR #18](https://github.com/jleonardopl1/levelup-exams/pull/18) registra pendências no momento do diagnóstico.
- **Registros de implantação em branches diferentes:** os PRs [#20](https://github.com/jleonardopl1/levelup-exams/pull/20),
  [#22](https://github.com/jleonardopl1/levelup-exams/pull/22) e [#24](https://github.com/jleonardopl1/levelup-exams/pull/24)
  relatam implantações de Plus, IA e Radar. O #22 também registra um erro 402 do gateway em 16/11.
  Confrontar esses relatos com o histórico de migrations, versões publicadas e saúde atual do serviço.

---

## Backlog priorizado
<!-- Detalhe, justificativa e referências: docs/ARQUITETURA_MULTIAGENTE.md §10 -->

- **P0 — fazer já (dono aprova):**
  1. Conferir a migration `20261116120000` e as versões publicadas de `generate-track-questions`, `essay-review` e `ai-mentor`.
     Identificar o que falta e confirmar com o dono antes de aplicar uma migration ou alterar secrets (D4).
  2. Acompanhar 7 dias de `ai_runs` (taxa de disputa, aprovação, custo) antes de ajustar modelos.
  3. ECA Digital: inventário de dados de menores, base legal, verificação de idade e supervisão (D6).
  4. Conferir a migration `20261117120000_radar_concursos.sql` e a publicação de `radar-concursos` (D4).
     Depois de confirmadas, rodar Admin → Radar → Verificar agora e ampliar as fontes com o `curador-conteudo`.
  5. `pagamentos` e Financeiro acompanham em homologação uma compra de Plus e uma de Passe, do
     checkout ao acesso e à comissão aplicável, e registram as divergências (D11).
- **P1 — próximas 2–4 semanas:**
  4. Auditar questões `ia_diaria` publicadas: explicação com letras e gabarito (rodar o Solucionador cego em lote).
  5. Harness de testes do front (Vitest + Testing Library) para `lib/` e hooks críticos (`tester`).
  6. Painel admin: custo/latência por agente (de `ai_runs`) e curadoria de `ai_lessons`.
  7. Reportes de alunos resolvidos como "gabarito errado" viram lições (fonte `aluno`, cercadas).
  8. Observabilidade: Sentry (front + funções) e alertas da geração de questões.
- **P2 — próximos 1–3 meses:**
  9. Revisão espaçada FSRS no lugar das caixas fixas (1/3/7/14/30) (`cientista-aprendizagem`).
  10. Calibração TRI (3PL) das questões com as respostas reais → nota estimada estilo ENEM.
  11. Mentor socrático com ferramentas (progresso, fila de revisão) e cache de explicações por questão. O piloto de leitura segue D11.
  12. App nas lojas (D5): Capacitor + push nativo + offline das trilhas.
- **Das referências (`docs/REFERENCIAS_REPOSITORIOS.md`):**
  13. Revisão por estabilidade/recuperabilidade (DeepTutor) — spec pronta no fim do relatório (refina o P2.9).
  14. Edital verticalizado sincronizado entre aparelhos (tabela com RLS) e links de lei seca por item.
  15. Questões com texto-base comum (freeCodeCamp `questionSets.context`) para Português.
  16. Exportar caderno de erros para o Anki (RPC só com questões já respondidas).
  17. Fonte "Querido Diário" no Radar para órgãos com site em JavaScript; IBGE para municípios por UF.
  18. Eventos tipados (AG-UI) no streaming do Mentor quando ele ganhar ferramentas (P2.11).
  19. Auditoria de UI das telas de estudo com Impeccable (`critique`/`audit`) pelo `designer`.
  20. RPC que agregue o domínio por tópico no banco (hoje o front lê as 1.000 respostas mais
      recentes de cada matéria — teto `max_rows` do PostgREST; tópico sem resposta nesse recorte some).
- **P3 — 3–12 meses:** B2B (cursinhos/escolas multi-tenant), simulados adaptativos (CAT), MCP público de conteúdo.

---

## Handoff mais recente
<!-- Sempre o topo = o mais recente. Template: docs/colaboracao/handoff-template.md -->

### 2026-11-17 · Integração operacional do Plus, Passe e Mentor

- **Objetivo e decisão:** registrar a prioridade D11 e os responsáveis por cada etapa.
- **O que mudou:** roteiro de homologação, permissões e critérios de aceite em `docs/INTEGRACAO_OPERACIONAL.md`.
- **Verificação local:** typecheck e build passaram, lint com 0 erros e 45 avisos prévios,
  testes unitários 62/62, Edge 76/76 e tipos das 12 funções conferidos no Deno.
- **Pendências de ambiente:** a base `9a2afbb` e os relatos de implantação orientam a conferência.
  O histórico do ambiente e os testes de homologação indicarão quais etapas operacionais estão concluídas.
- **Próximo passo:** `supabase-db` e `edge-functions` conferem as versões de IA, Plus e Radar.
  Com o ambiente identificado, `pagamentos` e Financeiro executam P0.5.

### 2026-11-17 · Referências externas: 32 repositórios (Claude Code, nas faixas de `frontend`, `engenheiro-ia`, `tester`, `security-reviewer` e `documentation-writer`)
- **Objetivo:** investigar os repositórios indicados pelo dono e incorporar o que melhora o app e o processo.
- **O que mudou:** relatório `docs/REFERENCIAS_REPOSITORIOS.md`; domínio por tópico (`src/lib/mastery.ts`,
  `useTopicMastery`) e edital verticalizado (`src/lib/edital.ts`, `useEditalState`) no painel
  `components/trilha/SubjectStudyPanel.tsx` da trilha; leitura em voz alta (`src/lib/speech.ts`,
  `useSpeech`, `SpeakButton`) no quiz; Mentor com modos direto/socrático (`ai-mentor/prompt.ts`,
  `mentor@2026-11-17`) e seletor na tela; portão de questões (termos absolutos, comando negativo;
  `elaborador@2026-11-17`); SEO (`src/lib/seo.ts`, `useSeo`, sitemap, robots); guardrails
  (`.claude/hooks/guardrails.mjs` + `settings.json`); `security-reviewer`, `tester`,
  `rules/common/writing.md`, `rules/common/ai-agents.md`; `typecheck` que de fato checa; CI com `test:unit`.
- **Testado:** `bun run typecheck` ✅ · `bun run lint` ✅ (0 erros; 45 avisos antigos) · `bun run test:unit` ✅
  62/62 · `bun run test:edge` ✅ 76/76 · `deno check` ✅ todas as funções · `bun run build` ✅ ·
  parser do edital rodado contra as 26 ementas reais da trilha ✅.
- **Não testado:** voz no navegador real e chamadas reais ao gateway de IA (sem `LOVABLE_API_KEY`);
  nenhuma migration nova nesta entrega.
- **Bloqueios:** D10 (Radar público) é decisão do dono.
- **Próximo passo:** P0 do backlog continua prioritário; depois itens 13–19.

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
