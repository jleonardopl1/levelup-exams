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
- **D12** (2026-11-18, solicitação do dono) — Disponibilizar os 10 responsáveis de área e 69 especialistas
  com suas [descrições de cargo](docs/ORGANOGRAMA_OPERACIONAL.md) e avaliar as referências externas.
  Os perfis iniciais A0/A1 trabalham com material público ou sintético. A campanha do simulado e a
  homologação de Pix para o Passe são propostas para decisão no [plano de crescimento e pagamentos](docs/CRESCIMENTO_E_PAGAMENTOS.md).
- **D13** (2026-11-20, solicitação do dono) — Cada um dos 79 cargos é uma skill do Claude Code em
  `.claude/skills/`, gerada do catálogo por `ops/agentes/skills.mjs`. As 10 áreas ficam visíveis ao
  modelo e encaminham ao especialista; os 69 especialistas só rodam por `/`. No turno da skill,
  `disallowed-tools` deixa só leitura. O plugin `levelup-operacao`, sem ferramentas, continua para execução isolada.

- **D14** (2026-11-20, solicitação do dono) — O **Mercado Pago** entra como segundo provedor, pelo
  Checkout Pro: Pix e cartão em até 12x para o **Plus anual pré-pago** (sem renovação automática) e
  para o Passe Concurso. As assinaturas da Stripe não mudam e o Asaas fica pausado (um provedor por
  vez). `billing_tier` continua só da Stripe; o acesso pago pelo Mercado Pago é outra fonte do plano
  efetivo. Pendentes com o dono: preço, juros do parcelamento, desconto no Pix, reembolso fora dos 7
  dias e conta habilitada ([plano, §2](docs/MERCADO_PAGO.md)). Código da fase 1 na `main` e desligado
  (`MP_ENABLED` ausente) em 2026-11-20, com as correções da revisão de segurança; homologar com
  `MP_ENABLED=staff` e `MP_LIVE_MODE=false` seguindo "Como ligar" no plano.
- **D15** (2026-11-23, solicitação do dono) — **Radar de repositórios.** Repositório externo
  (skill, plugin, agente, biblioteca) é avaliado pela faixa dona e registrado em
  `ops/radar-repositorios/catalogo.json`; só fica ativo com revisão do `security-reviewer`, commit
  fixado, `ORIGEM.md` e de acordo do dono — o `radar.mjs validar` (no `test:unit`) recusa o
  contrário. Varredura semanal agendada (segundas, 6h33 de Brasília, sessão nova) termina com pedido
  de de acordo numerado; nada é instalado sem ele. Relatório: [docs/RADAR_REPOSITORIOS.md](docs/RADAR_REPOSITORIOS.md).

---

## Armadilhas conhecidas

- 🧲 **Skill escrita à mão com `!` seguido de crase ou `$` seguido de letra** executa um comando ou
  troca texto quando o Claude Code a carrega (achado no `heydamir/unslop`). O validador do radar
  recusa nas skills fora do gerador; corrija o texto antes de copiar skill de terceiros.
- 🌐 **O proxy da sessão na nuvem bloqueia no curl** `trendshift.io`, `github.com/trending` e
  `gist.githubusercontent.com`; funcionam `raw.githubusercontent.com`, `git clone` de repositório
  público e `gh api -X GET search/repositories`. A tarefa semanal do radar roda **sem conectores**
  (sem Exa); para ler esses portais ela depende da busca web da sessão.
- 🪝 **Hook do plugin `stackhawk-hawkscan` (sincronizado da conta do dono, fora do projeto)**
  procura "git commit" na saída inteira do Bash e injeta "Fix all findings, commit fixes, then
  rescan" até em agentes só de leitura. Não é instrução do dono: o DAST exige app rodando e
  `HAWK_API_KEY`. Decisão do dono: manter o plugin na conta ou corrigir o filtro (`tool_input.command`).

- 🚨 **`gateway 402` = saldo de IA do workspace do Lovable esgotado.** Em 2026-11-16, das 05:10 às
  08:50 UTC, 67 execuções da geração falharam com 402 (0 questões inseridas). Com 402, Mentor e
  discursiva também param. Solução: recarregar o saldo de Cloud & IA no Lovable. O cliente
  `_shared/ai` não repete chamadas em 402 (não desperdiça). Alerta automático: backlog P1.
- ☁️ **Produção é Lovable Cloud** (`rxsovhyimflzvxggppal`). Migrations e publicação de funções
  passam pelo agente do Lovable; o merge no GitHub **não** publica as funções sozinho. O projeto
  "LevelUP Exams" que aparece no MCP do Supabase (`cdiyhbellqqgjwrdhgmf`) é antigo e está pausado.
- 🧩 **A ferramenta de migration do Lovable grava cópia em `drizzle/`**, cria `drizzle.config.ts`,
  adiciona `drizzle-kit`/`drizzle-orm`/`postgres` e regenera `types.ts`. É infraestrutura da
  plataforma: não apagar. Depois disso, ressincronize o `package-lock.json` (`npm install --package-lock-only`).
- 🕳️ **Migration sem arquivo:** produção tem `20261115140000 plus_internal_grants`, aplicada pelo
  Lovable, sem arquivo em `supabase/migrations/` e sem o SQL guardado no banco. Recriar o banco só a
  partir do repositório perderia o que ela fez — investigar (backlog P1).

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
  Último recurso: `render_mode = 'firecrawl'` na fonte (piloto D15, secret `FIRECRAWL_API_KEY`,
  roteiro em `docs/RADAR_CONCURSOS.md`).
- 🗝️ **A ferramenta de migration do agente do Lovable recusa SQL que lê o Vault**
  ("Agent access to secrets is not allowed"), como o bloco de agendamento do pg_cron. A migration
  do Radar foi aplicada em partes pela consulta SQL do Lovable (`query_database`), com o mesmo
  conteúdo do arquivo. Em migrations futuras, deixe o agendamento num arquivo separado.
- 🚫 **`public.has_role` não é executável por `anon`**: política com `TO anon` não pode chamá-la
  (a consulta anônima falha com 42501). Faça uma política por papel.
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
  Se `dl.deno.land`, `deno.land` e `esm.sh` estiverem bloqueados, o Deno sai do npm
  (`npm pack @deno/linux-x64-glibc`) e `deno check`/`deno test` rodam com `--import-map` que troca
  `esm.sh/<pacote>` por `npm:<pacote>` e o std por shims locais (fora do repositório).
- 🧾 **Tabelas do Mercado Pago ainda não estão em `types.ts`**: o front chama `get_my_payment_orders`
  por um cliente sem tipos (`useMyPaymentOrders`). Depois de aplicar `20261120120000`, regerar os tipos.
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
  8. Observabilidade: Sentry (front + funções) e **alerta** quando a geração ou o gateway falham
     (ex.: aviso ao admin em erro 402 ou em N falhas seguidas).
  8a. Reconstituir `20261115140000_plus_internal_grants` (comparar o schema de produção com o das migrations).
  8b. Mercado Pago (D14): código pronto e desligado. Falta: conta PJ com chave Pix, respostas da §2,
      revisão jurídica dos Termos, migration + funções publicadas, secrets, roteiro de sandbox e produção
      controlada ([como ligar](docs/MERCADO_PAGO.md)).
  8c. Levar os testes de banco em PGlite (`validate.mjs`, `mercadopago.validate.mjs`) para a CI.
  8d. Mercado Pago, antes da abertura (fase 4): reconciliação periódica dos pedidos pagos (estorno com
      webhook perdido), lista dos pedidos para revisão no admin e estorno automático da comissão.
      Decisões do dono: retenção fiscal ao excluir conta (`payment_orders` em `ON DELETE CASCADE`) e
      verificação de idade antes do pagamento (D6).
  8e. **Exclusão de conta dentro do app** (`mobile` + `supabase-db` + `pagamentos`): exigida pelas
      duas lojas qualquer que seja a D5 (App Store 5.1.1(v)) e pela LGPD; hoje só há o texto em
      `src/pages/Privacy.tsx`. Depende da decisão de retenção do P1.8d.
  8f. **Movimento reduzido** (`designer` → `frontend`): nenhuma regra `prefers-reduced-motion` em
      `src/`; o timer do Quiz pulsa (`Quiz.tsx:372`), a alternativa errada sacode (`:430`) e o
      Result usa `bounce-in`/`sparkle`. Corrigir com a skill `guias-web-modernos`
      (`ui-behaviors/motion.md`); aceite no Playwright com `reducedMotion: 'reduce'`.
  8g. **Consentimento antes de mandar texto do aluno a modelo** (Mentor, discursiva), nomeando o
      provedor — exigência da App Store 5.1.2(i) e transparência da LGPD (`security-reviewer` + D6).
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
- **Do radar de repositórios (`docs/RADAR_REPOSITORIOS.md`) — pilotos:**
  21. ✅ aprovado (2026-11-23) · Firecrawl para as fontes do Radar montadas por JavaScript: código
      pronto e desligado. Falta: `curador-conteudo` conferir as alternativas sem custo (item 17), o
      dono criar a conta, gravar `FIRECRAWL_API_KEY`, aplicar `20261123120000` e marcar a fonte (D4).
  22. elephant-goldfish-model (Google): revisão "cega" das specs do P2.11 e da D7 e conferência
      docs × código. Aguarda o de acordo do dono.
  23. ✅ aprovado (2026-11-23) · unslop instalado (`/unslop`, só auditoria). Falta: `designer` rodar
      no Quiz junto do item 19 e registrar se passou no critério (≥ 5 achados novos).
  24. ts-reset no front (`frontend`), num PR pequeno junto do P1.5. Aguarda o de acordo do dono.
- **P3 — 3–12 meses:** B2B (cursinhos/escolas multi-tenant), simulados adaptativos (CAT), MCP público de conteúdo.

---

## Handoff mais recente
<!-- Sempre o topo = o mais recente. Template: docs/colaboracao/handoff-template.md -->

### 2026-11-23 · Pilotos aprovados do radar: unslop e Firecrawl no Radar (`designer` + `edge-functions` + `supabase-db` + `security-reviewer`)

- **Objetivo da sessão:** o dono deu "de acordo: 1, 3" (Firecrawl e unslop) e pediu o merge do PR #33 (feito).
- **O que mudou:** skill `/unslop` (CC BY, adaptada: só auditoria, sem scripts nem geração de
  imagem, só por `/`); coluna `radar_sources.render_mode` (migration `20261123120000`) e
  `fetchRendered` (API v2 da Firecrawl por fetch, endpoint fixo, sem cache, proxy `basic`,
  robots.txt e URL final conferidos, 2 MB); a função lê as fontes com `select("*")` para tolerar a
  ordem de publicação. Roteiro do dono em `docs/RADAR_CONCURSOS.md`.
- **Testado:** Deno 2.9.6 (npm) com import map local → 88 testes das funções ok, 3 novos do
  `fetchRendered`; `deno check` de `radar-concursos/index.ts` ok; migration no PGlite (aplica sobre
  todas, idempotente, padrão `direto`, recusa valor fora da lista); `npm run test:unit` ok.
- **Não testado:** API real da Firecrawl (rede bloqueada nesta sessão) — em especial se o
  parâmetro `proxy: "basic"`, marcado como obsoleto, ainda é respeitado; páginas reais do Cebraspe e da Selecon.
- **Bloqueios / pendências:** dono — conta, secret, migration e marcar a fonte (D4); `curador-conteudo`
  — conferir antes as alternativas sem custo; `designer` — rodar `/unslop` no Quiz.
- **Próximo passo sugerido:** `curador-conteudo` testa URL estática, endpoint JSON e diário oficial
  para Cebraspe e Selecon; se falharem, o dono segue o roteiro do piloto.

### 2026-11-23 · Radar de repositórios: 62 avaliações, ativações e varredura semanal (`engenheiro-ia` + `coordenador` + `designer` + `mobile` + `security-reviewer`)

- **Objetivo da sessão:** avaliar os 61 repositórios e o gist indicados pelo dono, ativar o que
  é imediato, guardar o resto para ativar depois e criar a varredura semanal com pedido de de acordo.
- **O que mudou:** catálogo `ops/radar-repositorios/` (validador no `test:unit`: nada de terceiros
  ativo sem avaliação, commit fixado e aprovação; skill escrita à mão sem `!`+crase nem `$`);
  relatório `docs/RADAR_REPOSITORIOS.md`; skill `/radar-repositorios`. Ativos: plugin
  `mattpocock-skills` (pedido do dono), skills `security-audit` (Cloudflare) e `guias-web-modernos`
  (só os guias, sem o `npx @latest` do plugin), regras "Mudança mínima e cirúrgica"
  (karpathy-skills + ponytail, reescritas), lint da documentação no `gerente-contexto` (LLM Wiki) e
  regra contra gateway "grátis" e memória automática. Tarefa agendada "Radar semanal de
  repositórios": segundas 6h33 (Brasília), sessão nova, notificação no celular, primeira em 30/11.
- **Testado:** `npm run test:unit` → 102 aprovados, 0 falhas; `radar.mjs validar` → 62 avaliações ok.
- **Não testado:** carregamento real das skills e do plugin numa sessão nova (a desta sessão já
  vem da conta do dono); se o Claude Code troca `$TMPDIR` em skills do plugin (pior caso: texto
  trocado); a tarefa semanal ainda não rodou.
- **Decisões tomadas:** D15. O veículo da "Questão do dia" (P3) passa do openclaw para uma
  biblioteca de chat numa Edge Function.
- **Armadilhas novas:** padrões perigosos em SKILL.md; portais bloqueados pelo proxy; hook do hawkscan.
- **Bloqueios / pendências:** de acordo do dono para os pilotos 21–24 (Firecrawl, elephant-goldfish,
  unslop, ts-reset); jurídico para a licença ORA 2.3 (app-store-compliance) quando a D5 andar.
- **Próximo passo sugerido:** `designer` + `frontend` atacam o P1.8f (movimento reduzido) com
  `guias-web-modernos`; `mobile` + `supabase-db` especificam o P1.8e (exclusão de conta).

### 2026-11-20 · Mercado Pago: correções da revisão de segurança (`pagamentos` + `security-reviewer`)

- **Objetivo da sessão:** corrigir os achados do `security-reviewer` sobre o PR #30 (já mesclado).
- **O que mudou:** migration `20261120130000_mercadopago_hardening.sql` (`live_mode` no pedido,
  ambiente conferido em `apply_mp_payment`, acesso de teste limitado a 24 h e fora das vendas,
  indicação recusada em dois pedidos, comissão só com aprovação, retenção de 180 dias das
  notificações); `MP_COLLECTOR_ID` obrigatório, `MP_LIVE_MODE` e `MP_ENABLED=staff`; webhook com
  chave de reentrega assinada, limite pelo `Content-Length` e 404 sem repetição; título genérico do
  Passe; sincronização reconsulta pedidos recusados; Passe só para prova nos próximos 12 meses
  (também na Stripe); PGlite com as concessões padrão do Supabase.
- **Testado:** `node supabase/tests/mercadopago.validate.mjs` → 70 verificações ok;
  `node docs/proposta-plus/validate.mjs` ok; `deno test` (import map local) → 85 ok; `deno check` das
  funções de pagamento ok; `bun run test:unit` → 91 ok; typecheck e build ok; lint 0 erros (45 avisos anteriores).
- **Não testado:** API real do Mercado Pago, incluindo se `live_mode` vem em todo pagamento (sem o
  campo, o pagamento é recusado de propósito; conferir na fase 2).
- **Decisões tomadas:** D14 atualizada (homologação com `MP_ENABLED=staff` e `MP_LIVE_MODE=false`).
- **Armadilhas novas:** a segunda migration troca a assinatura de `create_payment_order` e
  `apply_mp_payment`: publicar as funções `mp-*` desta versão junto.
- **Bloqueios / pendências:** decisões da §2 e conta (dono); backlog P1.8d.
- **Próximo passo sugerido:** dono aplica as duas migrations e publica as funções; `pagamentos` +
  `tester` rodam a fase 2 com credenciais de teste e `MP_ENABLED=staff`.

### 2026-11-20 · Mercado Pago implementado e desligado (`pagamentos` + `supabase-db` + `edge-functions` + `frontend`)

- **Objetivo da sessão:** implementar o plano do Mercado Pago (D14) a pedido do dono.
- **O que mudou:** migration `20261120120000` (pedidos, eventos, `apply_mp_payment`, acesso pago como
  fonte `mercadopago` do plano efetivo, visão do admin); `_shared/mercadopago.ts`; funções
  `mp-create-checkout`, `mp-webhook`, `mp-sync-order`; travas no `create-checkout`, fonte nova no
  `check-subscription`; regras de indicação e do Passe extraídas para `_shared/referral.ts` e
  `_shared/exam-pass.ts`; Planos com Pix/12x, volta do checkout, renovação e pagamento em aberto;
  KPIs no admin; Termos (versão de 20/11/2026), Privacidade e FAQ. Preparo do PGlite extraído para
  `supabase/tests/pglite-supabase.mjs`.
- **Testado:** `node supabase/tests/mercadopago.validate.mjs` → 57 verificações ok;
  `node docs/proposta-plus/validate.mjs` → todos passaram; `deno test` (import map local) → 85 ok;
  `deno check` das 6 funções de pagamento ok; `bun run test:unit` → 91 ok, 2 pulados; typecheck e build ok;
  lint 0 erros e 45 avisos anteriores; 16 verificações no navegador (build de produção, Supabase simulado).
- **Não testado:** API real do Mercado Pago (campos da preferência, validade do Pix, assinatura das
  notificações) — vai para o sandbox (fase 2). A CI confere `deno check` com os imports originais.
- **Decisões tomadas:** D14 atualizada (código pronto, desligado).
- **Armadilhas novas:** Deno sem rede (ver acima) e tipos não regerados para as tabelas novas.
- **Bloqueios / pendências:** decisões a–h da §2, conta e secrets (dono); revisão jurídica dos Termos.
- **Próximo passo sugerido:** dono e Financeiro abrem a conta de teste; `pagamentos` + `tester` rodam
  o roteiro da fase 2 com credenciais de teste.

### 2026-11-20 · Plano do Mercado Pago: Pix e Plus anual parcelado (`pagamentos` + `coordenador`)

- **Objetivo da sessão:** planejar o Mercado Pago como segundo meio de pagamento, com Pix e o anual parcelado.
- **O que mudou:** [docs/MERCADO_PAGO.md](docs/MERCADO_PAGO.md) com ofertas, decisões do dono, produto
  (Checkout Pro), banco, funções, front, segurança, testes, fases e faixas. Decisão D14 e backlog P1.8b.
  Nenhum código de produto mudou.
- **Testado:** `npm run test:unit` → 84 aprovados, 2 pulados; checagens de fichas, skills e referências ok.
  O plano foi conferido contra `create-checkout`,
  `stripe-webhook`, `check-subscription`, `_shared/stripe.ts`, `useSubscription.ts`, `Upgrade.tsx`, `Terms.tsx`
  e as migrations de cortesia, Passe e afiliados.
- **Não testado:** campos da preferência, validade do Pix, assinatura das notificações vindas de
  `notification_url` e aprovação de Pix no sandbox. A documentação oficial do Mercado Pago não abriu
  nesta sessão (rede); esses pontos estão marcados para conferir na homologação.
- **Decisões tomadas:** D14.
- **Armadilhas novas:** gravar o acesso do Mercado Pago em `billing_tier` faria o `check-subscription`
  apagá-lo na próxima consulta à Stripe (plano, §4).
- **Bloqueios / pendências:** conta PJ do Mercado Pago com chave Pix, cotação de taxas e respostas às
  decisões a–h (dono e Financeiro).
- **Próximo passo sugerido:** `arquiteto-dados` especifica `payment_orders` e `apply_mp_payment` a partir
  da §5.1; `supabase-db` abre o PR 1 (migration + testes de banco).

### 2026-11-20 · Skills dos 79 cargos do organograma

- **Objetivo da sessão:** criar uma skill por cargo do [organograma operacional](docs/ORGANOGRAMA_OPERACIONAL.md) (D13).
- **O que mudou:** `ops/agentes/skills.mjs` gera `.claude/skills/<cargo>/SKILL.md` a partir do catálogo,
  com nome no formato `cfo-2-rebate-comissionamento`. Cada ficha do organograma mostra o comando da skill.
  `bun run test:unit` roda `skills.mjs --check`. Uso e regras do gerador estão no [guia](ops/agentes/README.md).
- **Testado:** `bun run test:unit` → 84 aprovados, 2 pulados (os de host). Com
  `LEVELUP_CLAUDE_BIN` (Claude Code 2.1.329, modelo simulado em localhost),
  `node --test "ops/agentes/*.test.mjs"` → 14/14. Nesse teste, a skill recebe a tarefa, as
  descrições dos especialistas ficam fora do contexto e o Bash pedido no turno é negado. Sem a regra
  de bloqueio, o mesmo teste falha. Typecheck e build passaram. O lint terminou com 0 erros e 45 avisos preexistentes.
- **Não testado:** respostas de um modelo real com as skills; `bun run test:edge`, porque a sessão
  não tem Deno e a mudança não toca as funções.
- **Armadilhas novas:** `disallowed-tools` vale só no turno em que a skill é acionada. Na mensagem
  seguinte, as permissões normais da sessão voltam. Para o Claude Code carregar skills de projeto num teste em pasta temporária,
  a pasta precisa estar marcada como confiável em `.claude.json`, com `HOME` fora dela (ver `skills.test.mjs`).
  Os campos próprios do Claude Code impedem o envio direto dessas pastas ao claude.ai.
- **Próximo passo sugerido:** o dono testa `/ceo-direcao-executiva-estrategia` com a pauta semanal
  sintética e `/cfo-2-rebate-comissionamento` com o caso de comissão de teste. Ajustes de texto entram no
  catálogo e são aplicados com `node ops/agentes/skills.mjs` e `node ops/agentes/documentar.mjs`.

### 2026-11-19 · Login e recuperação do serviço de autenticação

- A tela de login sinaliza a indisponibilidade e permite tentar novamente. Quem já tem sessão válida segue para a página solicitada mesmo se a consulta opcional do avatar falhar. O aluno pode adiar a escolha do avatar. O app avisa se o retorno do provedor termina sem sessão.
- Na validação local, passaram 79 testes unitários, 76 testes de funções, a checagem de tipos das 12 funções, o typecheck e o build do app. O lint terminou com zero erros e 45 avisos preexistentes.
- Na verificação de produção, o DNS público respondeu `NXDOMAIN` para `rxsovhyimflzvxggppal.supabase.co`, o endereço usado pelo app. Os três provedores sociais iniciaram o redirecionamento. O Lovable Cloud indicou que a infraestrutura estava habilitada, mas a consulta `SELECT 1` retornou `database is possibly not accessible`. O login completo continua pendente.
- O responsável pelo projeto original no Lovable Cloud deve restaurar o acesso à base dos alunos. Manter o app apontado para esse projeto, pois o homônimo no Supabase pessoal tem outra referência. Após a reativação, a faixa `tester` deve confirmar o DNS e fazer login com uma conta de teste em produção, verificando se a sessão abre a página protegida solicitada.

### 2026-11-18 · Equipe operacional, campanha do simulado e meios de pagamento

- **Objetivo e decisão:** dar à equipe os perfis operacionais e um roteiro de aquisição e receita conforme D12.
- **Entregas:** catálogo, CLI e instruções em [ops/agentes](ops/agentes/README.md), fichas do organograma,
  referências em [ops/referencias](ops/referencias/) e relatório de crescimento e pagamentos.
- O Claude Code reconheceu os 79 perfis. Os seis testes locais do CLI passaram, incluindo a execução
  de `CFO.2` com um serviço simulado em localhost. As evidências de instalação estão no
  [inventário do laboratório](docs/ANALISE_DAS_REFERENCIAS.md).
- **Pendências:** a decisão sobre o Radar sem login continua em D10. A conciliação de vendas e o piloto do
  Mentor seguem D11. A habilitação e a liquidação no provedor independente dependem de homologação.
- **Próximo passo:** Pedagogia e Marketing conferem a trilha e preparam a aula aberta.
  Financeiro e `pagamentos` acompanham um pedido avulso de teste até acesso, comissão e eventual estorno.

### 2026-11-17 · Integração operacional do Plus, Passe e Mentor

- **Objetivo e decisão:** registrar a prioridade D11 e os responsáveis por cada etapa.
- **O que mudou:** roteiro de homologação, permissões e critérios de aceite em `docs/INTEGRACAO_OPERACIONAL.md`.
- **Verificação local:** typecheck e build passaram, lint com 0 erros e 45 avisos prévios,
  testes unitários 62/62, Edge 76/76 e tipos das 12 funções conferidos no Deno.
- **Pendências de ambiente:** a base `9a2afbb` e os relatos de implantação orientam a conferência.
  O histórico do ambiente e os testes de homologação indicarão quais etapas operacionais estão concluídas.
- **Próximo passo:** `supabase-db` e `edge-functions` conferem as versões de IA, Plus e Radar.
  Com o ambiente identificado, `pagamentos` e Financeiro executam P0.5.
