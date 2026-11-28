# Backlog detalhado (P1 em diante)

O P0 e os títulos do P1 ficam em `AGENTS-COLLAB.md`; o detalhe mora aqui. **Os números não mudam**
(outros textos citam "P1.8b", "backlog 17" etc.). Justificativa maior: `docs/ARQUITETURA_MULTIAGENTE.md` §10.

## P1 — próximas 2–4 semanas

- 4. Auditar questões `ia_diaria` publicadas: explicação com letras (o embaralhamento quebra explicação que
  cita letra; `shuffleAlternatives` já não embaralha nesse caso) e gabarito (Solucionador cego em lote).
- 5. Harness de testes do front (Vitest + Testing Library) para `lib/` e hooks críticos (`tester`).
- 6. Painel admin: custo/latência por agente (de `ai_runs`) e curadoria de `ai_lessons`.
- 7. Reportes de alunos resolvidos como "gabarito errado" viram lições (fonte `aluno`, cercadas).
- 8. Observabilidade: Sentry (front + funções) e **alerta** quando a geração ou o gateway falham
  (ex.: aviso ao admin em erro 402 ou em N falhas seguidas).
- 8a. `20261115140000_plus_internal_grants`: o arquivo já existe em `supabase/migrations/` (REVOKE de
  `authenticated` em funções internas). Falta comparar o schema de produção com o das migrations para
  provar que é o mesmo que o Lovable aplicou (o SQL não ficou guardado no banco).
- 8b. Mercado Pago (D14): código pronto e desligado. Falta: conta PJ com chave Pix, respostas da §2,
  revisão jurídica dos Termos, migration + funções publicadas, secrets, roteiro de sandbox e produção
  controlada ([como ligar](../MERCADO_PAGO.md)). No sandbox, conferir se `live_mode` vem em todo
  pagamento: sem ele, o pagamento é recusado de propósito.
- 8c. Levar os testes de banco em PGlite (`validate.mjs`, `mercadopago.validate.mjs`) para a CI.
- 8d. Mercado Pago, antes da abertura (fase 4): reconciliação periódica dos pedidos pagos (estorno com
  webhook perdido), lista dos pedidos para revisão no admin e estorno automático da comissão. Decisões do
  dono: retenção fiscal ao excluir conta (`payment_orders` em `ON DELETE CASCADE`) e verificação de idade
  antes do pagamento (D6).
- 8e. **Exclusão de conta dentro do app** (`mobile` + `supabase-db` + `pagamentos`): exigida pelas duas
  lojas qualquer que seja a D5 (App Store 5.1.1(v)) e pela LGPD; hoje só há o texto em
  `src/pages/Privacy.tsx`. Depende da decisão de retenção do 8d.
- 8f. **Movimento reduzido** (`designer` → `frontend`): nenhuma regra `prefers-reduced-motion` em `src/`
  (conferido em 2026-11-27); o timer do Quiz pulsa (`Quiz.tsx:372`), a alternativa errada sacode (`:430`)
  e o Result usa `bounce-in`/`sparkle`. Corrigir com a skill `guias-web-modernos`
  (`ui-behaviors/motion.md`); aceite no Playwright com `reducedMotion: 'reduce'`.
- 8g. **Consentimento antes de mandar texto do aluno a modelo** (Mentor, discursiva), nomeando o provedor
  — exigência da App Store 5.1.2(i) e transparência da LGPD (`security-reviewer` + D6).
- 8h. **Radar publica sem revisão mudanças de fatos já conhecidos** (`vagas`, `salario_max`, `banca`,
  `cargos`...): só datas e regressão de fase vão a revisão, ao contrário do que diz
  `docs/RADAR_CONCURSOS.md`. Decidir a política e alinhar código e doc (`engenheiro-ia`). Achado do piloto
  elephant-goldfish ([relatório](../radar-repositorios/pilotos/2026-11-23-elephant-goldfish-drift.md)).
- 8i. **Radar: `nome` e `esfera` de concurso novo sem portão nem Verificador**; mudança de PDF sem
  concurso ligado é descartada sem registro e o retrato avança mesmo se a gravação falhar (`engenheiro-ia`).
- 8j. **Mercado Pago: a prévia mostra o preço cheio com código de indicação**, mas a cobrança sai com
  desconto; a trava do `create-checkout` libera assinar na Stripe nos últimos 30 dias do anual pré-pago;
  os lembretes de vencimento (15 e 3 dias) não existem (`pagamentos`).
- 8k. **Docs desatualizados** frente ao código (variáveis `RADAR_*`, migration `20261117120100`, §5.1/§5.4/§7
  do Mercado Pago) — `documentation-writer`, a partir do relatório. Também: `types.ts` já traz as tabelas
  do Radar e do Mercado Pago e `get_my_payment_orders`, mas `src/hooks/useRadar.ts` (`radarDb`) e
  `useSubscription.ts` ainda usam cliente sem tipos: trocar por `supabase` (`frontend`).
- 8l. Campanha do simulado (D12): Pedagogia e Marketing conferem a trilha e preparam a aula aberta.
- 8m. Skills dos cargos (D13): o dono testa `/ceo-direcao-executiva-estrategia` com a pauta semanal
  sintética e `/cfo-2-rebate-comissionamento` com o caso de comissão de teste; ajustes entram pelo
  catálogo ([guia](../../ops/agentes/README.md)).
- 8n. Licença ORA 2.3 (app-store-compliance) com o jurídico quando a D5 andar (radar de repositórios).
- 8o. (vindo do handoff de 2026-11-23) Conferir se o parâmetro `proxy: "basic"` da Firecrawl, marcado
  como obsoleto, ainda é respeitado, antes de ligar qualquer fonte `render_mode = 'firecrawl'` (API real
  nunca testada, `edge-functions`).
- 8p. Stripe: confirmar em produção o endpoint do webhook registrado e o segredo de assinatura antes de
  planejar a ativação ([PR #18](https://github.com/jleonardopl1/levelup-exams/pull/18) registra as pendências).
  Confrontar também os relatos de implantação dos PRs [#20](https://github.com/jleonardopl1/levelup-exams/pull/20),
  [#22](https://github.com/jleonardopl1/levelup-exams/pull/22) e [#24](https://github.com/jleonardopl1/levelup-exams/pull/24)
  (Plus, IA, Radar; o #22 registra o 402 de 16/11) com o histórico de migrations e a saúde do serviço.
- 8q. Hook do plugin `stackhawk-hawkscan` (da conta do dono, fora do projeto): procura "git commit" na
  saída inteira do Bash e injeta "Fix all findings, commit fixes, then rescan" até em agentes só de leitura.
  Não é instrução do dono. Decisão do dono: manter o plugin ou corrigir o filtro (`tool_input.command`).

## P2 — próximos 1–3 meses

- 9. Revisão espaçada FSRS no lugar das caixas fixas (1/3/7/14/30) (`cientista-aprendizagem`).
- 10. Calibração TRI (3PL) das questões com as respostas reais → nota estimada estilo ENEM.
- 11. Mentor socrático com ferramentas (progresso, fila de revisão) e cache de explicações por questão. O
  piloto de leitura segue D11.
- 12. App nas lojas (D5): Capacitor + push nativo + offline das trilhas.

## Das referências (`docs/REFERENCIAS_REPOSITORIOS.md`)

- 13. Revisão por estabilidade/recuperabilidade (DeepTutor) — spec pronta no fim do relatório (refina o 9).
- 14. Edital verticalizado sincronizado entre aparelhos (tabela com RLS) e links de lei seca por item.
- 15. Questões com texto-base comum (freeCodeCamp `questionSets.context`) para Português.
- 16. Exportar caderno de erros para o Anki (RPC só com questões já respondidas).
- 17. ✔ verificado (2026-11-24, `curador-conteudo`): o Querido Diário **não substitui** a página da banca
  (Selecon: 9 diários desde agosto, nenhum dos municípios com concurso aberto; Cuiabá parada desde
  02/06/2026; trechos com nº de inscrição de candidato; resposta JSON) e o DOU não abriu daqui. Cebraspe e
  Selecon resolvidas com HTML estático (migration `20261124120000`). Falta: IBGE para municípios por UF;
  reavaliar o Querido Diário só com filtro de dados pessoais e o item 17a.
- 17a. Coletor do Radar com JSON de fonte conhecida e RSS/Atom (`edge-functions` + `engenheiro-ia`): a API
  que a página do Cebraspe chama (`apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/<fase>`, sem
  token nem cabeçalho) dá fase, vagas, salário e sigla de cada concurso; o detalhe
  (`/cebraspe/eventos/<SIGLA>`) dá cargos, inscrições, editais e retificações. Converter em texto
  determinístico com links (`www.cebraspe.org.br/concursos/<SIGLA>`) para o portão de evidência. API não
  documentada: pode mudar sem aviso. Ganho: fase e retificação dos ~70 concursos em andamento.
- 18. Eventos tipados (AG-UI) no streaming do Mentor quando ele ganhar ferramentas (11).
- 19. Auditoria de UI das telas de estudo com Impeccable (`critique`/`audit`) pelo `designer`.
- 20. RPC que agregue o domínio por tópico no banco (hoje o front lê as 1.000 respostas mais recentes de
  cada matéria — teto `max_rows` do PostgREST; tópico sem resposta nesse recorte some).

## Do radar de repositórios (`docs/RADAR_REPOSITORIOS.md`) — pilotos

- 21. ✅ aprovado (2026-11-23) · Firecrawl para as fontes do Radar montadas por JavaScript: código pronto e
  desligado. **Sem fonte-alvo desde 2026-11-24:** Cebraspe e Selecon resolvidas sem renderização (item 17);
  a Selecon nem é JS (raiz vazia, concursos com anti-robô). O dono **não** precisa criar conta nem secret.
  Falta: dono aplicar `20261123120000` e `20261124120000` e decidir ligar a fonte
  `cebraspe.org.br/noticias/` (D4, guia do dono §5).
- 22. ✅ aprovado (2026-11-23) · elephant-goldfish: piloto rodado com `ops/radar-repositorios/egm-drift.sh`
  (plugin fixado, só na execução); passou no critério e gerou os itens 8h–8k. Uso sob demanda.
- 23. ✅ aprovado (2026-11-23) · unslop instalado (`/unslop`, só auditoria). Falta: `designer` rodar no
  Quiz junto do item 19 e registrar se passou no critério (≥ 5 achados novos).
- 24. ✅ aprovado e feito (2026-11-23) · ts-reset no front; falta validar `src/lib/quizSession.ts:48`.

## P3 — 3–12 meses

B2B (cursinhos/escolas multi-tenant), simulados adaptativos (CAT), MCP público de conteúdo.
