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
- **D16** (2026-11-27, solicitação do dono) — **Modelo por faixa.** Cada agente de `.claude/agents/`
  fixa `model`, `effort` e `tools`: Haiku no `reviewer` e no `Explore` (busca), Opus no
  `arquiteto-dados` e no `security-reviewer`, Sonnet nos demais. Subagente sem modelo roda em Sonnet
  (`CLAUDE_CODE_SUBAGENT_MODEL`). Subir para Opus é decisão de cada chamada, pelos gatilhos de
  [.claude/agents/README.md](.claude/agents/README.md).

---

## Armadilhas conhecidas

- 🧲 **Skill escrita à mão com `!` seguido de crase ou `$` seguido de letra** executa um comando ou
  troca texto quando o Claude Code a carrega (achado no `heydamir/unslop`). O validador do radar
  recusa nas skills fora do gerador; corrija o texto antes de copiar skill de terceiros.
- 🌐 **O proxy da sessão na nuvem bloqueia no curl** `trendshift.io`, `github.com/trending` e
  `gist.githubusercontent.com`; funcionam `raw.githubusercontent.com`, `git clone` de repositório
  público e `gh api -X GET search/repositories`. Por isso a tarefa semanal do radar roda no ambiente
  **"Level Up"** (rede liberada), sem conectores.
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
- 🕸️ **Radar: página montada por JavaScript chega vazia ao coletor** (a lista `/concursos/` do
  Cebraspe) e anti-robô dá 403 (Fundatec; páginas de concurso da Selecon em `*.selecao.net.br`,
  Turnstile da Cloudflare). O coletor não executa JS. Antes de renderizar, procure a lista estática
  da banca: Cebraspe → `/noticias/`, Selecon → `selecon.org.br` (a raiz `selecao.net.br` nem é
  página dinâmica: só responde "Cliente não encontrado."). Último recurso para JS:
  `render_mode = 'firecrawl'` (piloto D15, roteiro em `docs/RADAR_CONCURSOS.md`).
- 🧾 **O coletor do Radar descarta JSON, RSS e Atom como binário** (`fetcher.ts`, filtro de
  content-type: só HTML, XHTML, `text/plain`, `text/xml` e `application/xml`). A API do Cebraspe
  (`application/json`) e o feed da Selecon (`application/rss+xml`) viram só hash. Sitemap passa como
  texto, mas sem `<a href>` não há links e o `link_oficial` não passa no portão de evidência.
- 🏛️ **Diários oficiais a partir da nuvem:** `www.in.gov.br` (DOU) responde 403 da Azion ou corta a
  conexão, também no navegador e sem aviso do proxy (é o site); o INLABS estava em manutenção. A
  API do Querido Diário agora é `api.queridodiario.org.br` (o host `api.queridodiario.ok.org.br`
  falha no TLS) e às vezes falha na primeira tentativa.
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
- 🧰 **Subagente sem `tools` no frontmatter herda tudo da sessão**, inclusive as ferramentas MCP e as
  skills de todos os plugins da conta (centenas), e paga por elas em tokens a cada chamada. Agente
  novo já nasce com `tools`, `model` e `effort` (D16).
- 🧩 **`disallowed-tools` de skill vale só no turno em que ela é acionada**; na mensagem seguinte
  voltam as permissões da sessão. Em teste com pasta temporária, o Claude Code só carrega skills de
  projeto se a pasta estiver marcada como confiável em `.claude.json`, com `HOME` fora dela
  (`ops/agentes/skills.test.mjs`).
- 🔁 **A migration `20261120130000` troca a assinatura de `create_payment_order` e
  `apply_mp_payment`**: publique as funções `mp-*` da mesma versão junto com ela.

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
  6. **Login em produção** (handoff de 2026-11-19): o DNS público respondia `NXDOMAIN` para
     `rxsovhyimflzvxggppal.supabase.co` e o Lovable Cloud acusava `database is possibly not accessible`.
     O responsável pelo projeto original no Lovable Cloud restaura o acesso à base dos alunos, sem
     trocar o app para o homônimo do Supabase pessoal. Depois, o `tester` confirma o DNS e faz login
     com uma conta de teste em produção até a página protegida.
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
      controlada ([como ligar](docs/MERCADO_PAGO.md)). No sandbox, conferir se `live_mode` vem em
      todo pagamento: sem ele, o pagamento é recusado de propósito.
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
  8h. **Radar publica sem revisão mudanças de fatos já conhecidos** (`vagas`, `salario_max`, `banca`,
      `cargos`...): só datas e regressão de fase vão a revisão, ao contrário do que diz
      `docs/RADAR_CONCURSOS.md`. Decidir a política e alinhar código e doc (`engenheiro-ia`). Achado do
      piloto elephant-goldfish ([relatório](docs/radar-repositorios/pilotos/2026-11-23-elephant-goldfish-drift.md)).
  8i. **Radar: `nome` e `esfera` de concurso novo sem portão nem Verificador**; mudança de PDF sem
      concurso ligado é descartada sem registro e o retrato avança mesmo se a gravação falhar (`engenheiro-ia`).
  8j. **Mercado Pago: a prévia mostra o preço cheio com código de indicação**, mas a cobrança sai com
      desconto; a trava do `create-checkout` libera assinar na Stripe nos últimos 30 dias do anual
      pré-pago; os lembretes de vencimento (15 e 3 dias) não existem (`pagamentos`).
  8k. **Docs desatualizados** frente ao código (variáveis `RADAR_*`, migration `20261117120100`,
      `radarDb` já tipável, §5.1/§5.4/§7 do Mercado Pago) — `documentation-writer`, a partir do relatório.
  8l. Campanha do simulado (D12): Pedagogia e Marketing conferem a trilha e preparam a aula aberta.
  8m. Skills dos cargos (D13): o dono testa `/ceo-direcao-executiva-estrategia` com a pauta semanal
      sintética e `/cfo-2-rebate-comissionamento` com o caso de comissão de teste; ajustes entram pelo
      catálogo ([guia](ops/agentes/README.md)).
  8n. Licença ORA 2.3 (app-store-compliance) com o jurídico quando a D5 andar (radar de repositórios).
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
  17. ✔ verificado (2026-11-24, `curador-conteudo`): o Querido Diário **não substitui** a página da
      banca (Selecon: 9 diários desde agosto, nenhum dos municípios com concurso aberto; Cuiabá parada
      desde 02/06/2026; trechos com nº de inscrição de candidato; resposta JSON) e o DOU não abriu
      daqui. Cebraspe e Selecon resolvidas com HTML estático (migration `20261124120000`). Falta: IBGE
      para municípios por UF; reavaliar o Querido Diário só com filtro de dados pessoais e o item 17a.
  17a. Coletor do Radar com JSON de fonte conhecida e RSS/Atom (`edge-functions` + `engenheiro-ia`):
      a API que a página do Cebraspe chama (`apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/<fase>`,
      sem token nem cabeçalho) dá fase, vagas, salário e sigla de cada concurso; o detalhe
      (`/cebraspe/eventos/<SIGLA>`) dá cargos, inscrições, editais e retificações. Converter em texto
      determinístico com links (`www.cebraspe.org.br/concursos/<SIGLA>`) para o portão de evidência.
      API não documentada: pode mudar sem aviso. Ganho: fase e retificação dos ~70 concursos em andamento.
  18. Eventos tipados (AG-UI) no streaming do Mentor quando ele ganhar ferramentas (P2.11).
  19. Auditoria de UI das telas de estudo com Impeccable (`critique`/`audit`) pelo `designer`.
  20. RPC que agregue o domínio por tópico no banco (hoje o front lê as 1.000 respostas mais
      recentes de cada matéria — teto `max_rows` do PostgREST; tópico sem resposta nesse recorte some).
- **Do radar de repositórios (`docs/RADAR_REPOSITORIOS.md`) — pilotos:**
  21. ✅ aprovado (2026-11-23) · Firecrawl para as fontes do Radar montadas por JavaScript: código
      pronto e desligado. **Sem fonte-alvo desde 2026-11-24:** Cebraspe e Selecon resolvidas sem
      renderização (item 17); a Selecon nem é JS (raiz vazia, concursos com anti-robô). O dono **não**
      precisa criar conta nem secret. Falta: dono aplicar `20261123120000` e `20261124120000` e decidir
      ligar a fonte `cebraspe.org.br/noticias/` (D4, guia do dono §5).
  22. ✅ aprovado (2026-11-23) · elephant-goldfish: piloto rodado com `ops/radar-repositorios/egm-drift.sh`
      (plugin fixado, só na execução); passou no critério e gerou os itens P1.8h–k. Uso sob demanda.
  23. ✅ aprovado (2026-11-23) · unslop instalado (`/unslop`, só auditoria). Falta: `designer` rodar
      no Quiz junto do item 19 e registrar se passou no critério (≥ 5 achados novos).
  24. ✅ aprovado e feito (2026-11-23) · ts-reset no front; falta validar `src/lib/quizSession.ts:48`.
- **P3 — 3–12 meses:** B2B (cursinhos/escolas multi-tenant), simulados adaptativos (CAT), MCP público de conteúdo.

---

## Handoff mais recente
<!-- Sempre o topo = o mais recente. Template: docs/colaboracao/handoff-template.md -->

### 2026-11-27 · Modelo por faixa e economia de tokens (`coordenador` + `gerente-contexto`)

- **Objetivo da sessão:** reduzir o consumo de tokens do ambiente e fazer cada agente usar o modelo
  Claude adequado à demanda.
- **O que mudou:** os 17 agentes saem de `model: inherit` (todos no modelo da sessão) para `model` e
  `effort` por faixa; os 9 sem `tools` ganham lista explícita, sem MCP nem `Agent`. `explore.md`
  substitui o Explore embutido em Haiku e `.claude/settings.json` define
  `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`. Gatilhos de escalonamento e regras de economia de tokens estão
  em `.claude/agents/README.md`, com ponteiros no `CLAUDE.md`, no `AGENTS.md` e no bootstrap. Este
  arquivo passou de 10 para 3 handoffs; as pendências dos 7 retirados foram para o P0.6, o P1.8b, os
  P1.8l–8n e as *Armadilhas*.
- **Testado:** `bun run test:unit` → 106 aprovados, 2 pulados, 0 falhas; fichas, skills, referências e
  radar validados. `model`, `effort` e `tools` dos 18 agentes conferidos por script.
- **Não testado:** a escolha real de modelo numa sessão nova (agentes e settings são lidos ao abrir a
  sessão) e se todo modelo aceita o mesmo nível de `effort`.
- **Decisões tomadas:** D16.
- **Armadilhas novas:** subagente sem `tools` herda tudo da sessão (ver *Armadilhas*).
- **Bloqueios / pendências:** a maior parte do custo fixo de cada sessão vem dos plugins e conectores
  sincronizados da conta, fora do repositório; só o dono pode desligar os que não usa, no claude.ai.
- **Próximo passo sugerido:** o dono desliga plugins e conectores sem uso; o `gerente-contexto`
  compacta *Decisões ativas*, *Armadilhas* e *Backlog* (o arquivo ainda passa da meta de 3 minutos de
  leitura), promovendo o que é estável para o `CLAUDE.md` e as `rules/`.

### 2026-11-24 · Radar: Cebraspe e Selecon sem Firecrawl (`curador-conteudo`)

- **Objetivo da sessão:** backlog 17 e 21 e §5.1 do guia do dono: achar alternativa gratuita e sem
  renderização para as duas fontes "página dinâmica" e preparar a troca.
- **O que mudou:** migration `20261124120000_radar_sources_urls_estaticas.sql`: troca URL e nome das
  duas fontes desligadas, zera o retrato e deixa `render_mode = 'direto'`, sem ligar nenhuma. Só
  troca fonte desligada e sem colisão de URL; `pending_retries` e `render_mode` só entram se a coluna
  existir. Também mudaram `docs/RADAR_CONCURSOS.md` (limites, tabela "Fontes conferidas", situação
  do piloto) e `docs/PASSO_A_PASSO_DONO.md` §5 (Firecrawl dispensado, aplicar a migration e ligar o
  Cebraspe, roteiro antigo recolhido).
- **Evidências** (curl pelo proxy, `fetchPage` real do coletor, robots.txt conferido):
  - **Cebraspe `/concursos/`:** 200 `text/html`, aplicação React (`<div id="root"></div>`), 0 caracteres
    e 0 links.
  - **Cebraspe `/noticias/`:** 200 `text/html`, 4.471 caracteres e 73 links. A notícia da SEAP/PE
    traz 700 vagas, inscrições de 12/11/2026 a 04/01/2027, R$ 5.667,92, prova em 21/03/2027 e o link
    `concursos/SEAP_PE_26`. No robots.txt, `Disallow:` está vazio.
  - **Cebraspe JSON** (achado no bundle e confirmado no Playwright):
    `apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/inscricoes-abertas` responde 200
    `application/json` (PC PE 26 com 1.315 vagas e SEAP PE 26 com 700). A lista completa tem 246 KB:
    1 novo, 2 com inscrições abertas, 70 em andamento e 428 encerrados. Não pede token, e o coletor
    trata como binário.
  - **Selecon `selecao.net.br/`:** 200, 30 bytes, "Cliente não encontrado.".
  - **Selecon `*.selecao.net.br/informacoes/<id>/`:** 403 com Turnstile da Cloudflare, também no Playwright.
  - **Selecon `selecon.org.br/concursos/`:** 200 `text/html`, 6.145 caracteres, 22 links e 12
    concursos, incluindo os 9 da aba "Inscrições Abertas" da home (fonte ativa).
  - **Selecon RSS:** `application/rss+xml`, tratado como binário.
  - **DOU:** `www.in.gov.br` respondeu 403 da Azion ou cortou a conexão. Não foi o proxy (nenhuma
    linha `[agent-proxy]`); o INLABS estava em manutenção.
  - **Querido Diário** (`api.queridodiario.org.br`): a busca "Selecon" desde 01/08 trouxe 9 diários,
    só de Niterói e Araçás/BA. Cuiabá tem nível 3, mas o último diário é de 02/06/2026; Várzea Grande
    tem nível 1; Barra do Garças e Campo Novo do Parecis, nível 0.
  - **Dados pessoais:** as fontes novas não trazem nomes de candidatos; a notícia de "primeira chamada"
    só cita a relação. Os trechos do Querido Diário trazem número de inscrição.
- **Testado:** PGlite com todas as migrations → `node supabase/tests/mercadopago.validate.mjs` e
  `node docs/proposta-plus/validate.mjs`: "Todos os testes passaram". Uma validação própria da
  migration (fora do repositório) passou nas 18 verificações: troca, idempotência, ausência de
  `render_mode`/`pending_retries`, fonte já ligada intocada, URL nova já existente e tabela ausente.
  `bun run test:unit` → 106 aprovados, 0 falhas, 2 pulados.
- **Não testado:** a primeira coleta real com Batedor e Verificador (sem modelo nesta sessão). O DOU
  e o INLABS ficaram bloqueados a partir desta sessão.
- **Decisões tomadas:** nenhuma D nova; ligar fontes continua com o dono (D4).
- **Armadilhas novas:** o coletor descarta JSON e RSS; `selecao.net.br` não é página dinâmica; DOU e
  Querido Diário a partir da nuvem.
- **Bloqueios / pendências:**
  - Dono: aplicar a `20261124120000` no Lovable e decidir ligar `cebraspe.org.br/noticias/` (guia §5.2–5.3).
  - `edge-functions` + `engenheiro-ia`: item 17a (JSON do Cebraspe, RSS/Atom).
  - Não re-rode a `20261117120000`: ela recria as duas URLs antigas, desligadas. É inofensivo.
- **Próximo passo sugerido:** o dono aplica a migration e liga a fonte do Cebraspe. Depois, o
  `curador-conteudo` confere em Admin → Radar a primeira coleta (PC/PE e SEAP/PE) e as atualizações pendentes.

### 2026-11-23 · Pilotos aprovados do radar: unslop, Firecrawl, elephant-goldfish e ts-reset (`designer` + `edge-functions` + `supabase-db` + `frontend` + `security-reviewer`)

- **Objetivo da sessão:** o dono deu "de acordo: 1, 3", depois "2 e 4", e pediu o merge do PR #33 (feito).
- **elephant-goldfish:** `ops/radar-repositorios/egm-drift.sh` roda o `egm-drift-report` com o plugin
  fixado em `94d948d`, só na execução e numa cópia descartável; relatório em
  `docs/radar-repositorios/pilotos/`, 3 achados graves conferidos no código → backlog P1.8h–k.
- **ts-reset (`frontend`):** dependência de dev + `src/reset.d.ts`; 13 erros de tipo corrigidos com
  checagem explícita; `parseErrorBody` em `src/lib/errorBody.ts`; typecheck, lint (0 erros), test:unit
  e build ok. Catálogo ganhou o campo `aprovacao` (aprovado pelo dono sem ser ativação de agente).
- **O que mudou:** skill `/unslop` (CC BY, adaptada: só auditoria, sem scripts nem geração de
  imagem, só por `/`); coluna `radar_sources.render_mode` (migration `20261123120000`) e
  `fetchRendered` (API v2 da Firecrawl por fetch, endpoint fixo, sem cache, proxy `basic`,
  robots.txt e URL final conferidos, 2 MB); a função lê as fontes com `select("*")` para tolerar a
  ordem de publicação. Correções da revisão do `security-reviewer`: tudo de fonte renderizada vira
  atualização pendente (`requireReviewForRendered`, nada publica nem avisa alunos sozinho), no
  máximo `RADAR_MAX_RENDERED` (2) por execução com prazo tirado do orçamento, robots.txt conferido
  também para o robô da Firecrawl, recusa de `proxyUsed` ≠ `basic` e de `provider`. Roteiro do dono
  em `docs/RADAR_CONCURSOS.md`, com chamada de teste antes de ligar.
- **Testado:** Deno 2.9.6 (npm) com import map local → 91 testes das funções ok, 6 novos
  (`fetchRendered` e revisão obrigatória); `deno check` de `radar-concursos/index.ts` ok; migration no PGlite (aplica sobre
  todas, idempotente, padrão `direto`, recusa valor fora da lista); `npm run test:unit` ok.
- **Não testado:** API real da Firecrawl (rede bloqueada nesta sessão) — em especial se o
  parâmetro `proxy: "basic"`, marcado como obsoleto, ainda é respeitado; páginas reais do Cebraspe e da Selecon.
- **Bloqueios / pendências:** dono — conta, secret, migration e marcar a fonte (D4); `curador-conteudo`
  — conferir antes as alternativas sem custo; `designer` — rodar `/unslop` no Quiz.
- **Passos manuais do dono** (merge, publicação no Lovable, teste rápido, plugin hawkscan,
  Firecrawl): [docs/PASSO_A_PASSO_DONO.md](docs/PASSO_A_PASSO_DONO.md). A tarefa semanal foi
  recriada no ambiente "Level Up" (rede liberada para os portais de ranking).
- **Próximo passo sugerido:** `curador-conteudo` testa URL estática, endpoint JSON e diário oficial
  para Cebraspe e Selecon (numa sessão no ambiente "Level Up"); se falharem, o dono segue o roteiro do piloto.
