# Radar de repositórios — o que instalar, o que guardar, o que descartar

Avaliação contínua de repositórios externos (skills, plugins, agentes, bibliotecas) para o
LevelUp Exams. O primeiro lote (2026-11-23) cobre os 61 repositórios indicados pelo dono; a partir
daí, uma **varredura semanal** dos portais de ranking traz novidades com pedido de de acordo.

- **Catálogo (fonte da verdade):** [`ops/radar-repositorios/catalogo.json`](../ops/radar-repositorios/catalogo.json)
- **Como avaliar, ativar e desativar:** skill [`radar-repositorios`](../.claude/skills/radar-repositorios/SKILL.md) (`/radar-repositorios`)
- **Relatórios semanais:** [`docs/radar-repositorios/semanal/`](radar-repositorios/semanal/)
- **Avaliações anteriores** (32 repositórios, 2026-11-17 e 2026-11-18): [REFERENCIAS_REPOSITORIOS.md](REFERENCIAS_REPOSITORIOS.md) e [ANALISE_DAS_REFERENCIAS.md](ANALISE_DAS_REFERENCIAS.md)

## Como o radar decide

O filtro é o mesmo da decisão D9: o item ajuda o candidato a ser aprovado, protege quem estuda
ou torna o trabalho dos agentes mais seguro, e cabe no stack (Vite + React + Supabase/Deno +
Lovable). Cada repositório foi avaliado pelo agente dono da faixa (`engenheiro-ia`,
`coordenador`, `designer`, `mobile`, `security-reviewer`) a partir do README e, para os
candidatos a instalação, dos arquivos reais numa revisão fixada.

| Veredito | Significa | Quem decide |
| --- | --- | --- |
| Ativar agora | Ferramenta de desenvolvimento, regra ou skill sem custo, sem secret e sem dependência nova em produção | Dono aprova; entra no projeto |
| Piloto | Vale testar logo, mas envolve custo, conta, secret ou dependência de produção | Dono dá o de acordo item a item |
| Futuro | Potencial claro; ativar quando o gatilho registrado acontecer | Faixa dona propõe no gatilho |
| Monitorar | Interessante, mas imaturo, redundante ou arriscado hoje | Reavaliado na varredura semanal |
| Descartado | Fora do escopo ou risco jurídico, de segurança ou de privacidade | — |

## Regras de cadeia de suprimentos (valem para toda instalação)

1. Nada fica ativo sem avaliação aprovada: o validador (`bun run test:unit`) falha se houver
   plugin em `enabledPlugins` ou skill escrita fora do gerador em `.claude/skills/` sem registro
   no catálogo.
2. Código de terceiros copiado para o repositório fica preso a um **commit** e acompanha um
   `ORIGEM.md` (repositório, commit, licença, arquivos, adaptações, aprovação). Sem atualização
   automática.
3. O `security-reviewer` lê os arquivos reais antes do pedido de de acordo: o que executa, rede,
   segredos, injeção de prompt em `SKILL.md`/`CLAUDE.md` e licença.
4. Hooks, instaladores e scripts de terceiros não entram sem revisão específica; os nossos
   guardrails (`.claude/hooks/guardrails.mjs`) continuam valendo.
5. Serviço pago, conta nova, secret ou dado de aluno indo a terceiro = **piloto**, nunca "agora"
   (D4, LGPD, ECA Digital).

## Resultado

<!-- radar:inicio (gerado por ops/radar-repositorios/radar.mjs; não edite à mão) -->

| Veredito | Repositórios |
| --- | ---: |
| Ativar agora | 6 |
| Piloto (precisa do de acordo do dono) | 4 |
| Futuro (ativar quando o gatilho acontecer) | 7 |
| Monitorar | 7 |
| Descartado | 38 |
| **Total** | **62** |

### Ativos no projeto

| Repositório | Tipo | Onde | Faixa | Aprovado |
| --- | --- | --- | --- | --- |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | regra | `rules/common/coding-style.md` @ `ebd8654c2c62` | code-reviewer, frontend, edge-functions, supabase-db, engenheiro-ia, pagamentos, mobile | dono, 2026-11-23 |
| [mattpocock/skills](https://github.com/mattpocock/skills) | plugin | `mattpocock-skills@claude-plugins-official` @ `49dd158d1076` | coordenador, tester, code-reviewer, documentation-writer | dono (pedido explícito: claude plugin install), 2026-11-23 |
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | regra | `rules/common/coding-style.md` @ `2c606141936f` | code-reviewer, documentation-writer | dono, 2026-11-23 |
| [karpathy/llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | regra | `.claude/agents/gerente-contexto.md` @ `ac46de1ad27f` | gerente-contexto, engenheiro-ia | dono, 2026-11-23 |
| [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | skill | `.claude/skills/guias-web-modernos` @ `2b4aa13a72dd` | designer, frontend, mobile | dono, 2026-11-23 |
| [heydamir/unslop](https://github.com/heydamir/unslop) | skill | `.claude/skills/unslop` @ `620163eedb35` | designer | dono (de acordo: 3), 2026-11-23 |
| [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | skill | `.claude/skills/security-audit` @ `c1c8a8c14710` | security-reviewer | dono, 2026-11-23 |

### Aguardando o de acordo do dono

#### Processo e ambiente dos agentes

- **[google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model)** — Plugin de Claude Code e Codex em que um agente com contexto redige a especificação e revisores 'goldfish', em subagentes sem a conversa anterior, a revisam; também compara documentos com o código (drift). _★ 22.365 · Apache-2.0 · avaliado em 2026-11-23; faixa: coordenador, engenheiro-ia, documentation-writer._
  - **Uso no LevelUp:** Revisão independente das specs de IA antes de codar: Mentor com ferramentas (P2.11), discursiva dupla (D7) e cache de explicações. O drift-report confere docs/RADAR_CONCURSOS.md, docs/MERCADO_PAGO.md e a ARQUITETURA contra o código.
  - **Gatilho:** De acordo do dono para um piloto na sessão dele; promover ao projeto só se a revisão da spec do P2.11 ou o drift-report de docs/ trouxerem achados que o code-reviewer e o documentation-writer não trouxeram.
  - **Como ativar:** Piloto fora do projeto: carregar só na sessão do dono com claude --plugin-dir apontando para uma cópia do commit 94d948d7d2a1d48e981997c20963e39d9e9ee67c (ou instalação no escopo do usuário). Usar /egm:egm-review e egm-lite só em documentos de docs/, com 'EGM artifact directory:' apontando para pasta ignorada pelo git, e avisar no prompt que a saída é em PT-BR e que CLAUDE.md e rules/ prevalecem. Não rodar /egm:egm-bootstrap (Bash, Write e Edit em todas as pastas).
  - **Riscos:** Apache-2.0, marketplace próprio fora do diretório oficial, projeto de 2026-09. Revisão de segurança: aprovado com condições (sem hooks, MCP nem rede; todas as skills só por /). Traz 10 agentes com descrições genéricas que disputariam o roteamento com reviewer, code-reviewer, documentation-writer e coordenador, e os revisores rodam sem o CLAUDE.md do projeto (omitClaudeMd).
  - **Backlog:** P2.11; D7; D9.
- **[mattpocock/ts-reset](https://github.com/mattpocock/ts-reset)** — Declarações de tipo que corrigem APIs do JavaScript: JSON.parse e .json() passam a devolver unknown, e .filter(Boolean) restringe o tipo do resultado. _★ 8.652 · MIT · avaliado em 2026-11-23; faixa: frontend, code-reviewer._
  - **Uso no LevelUp:** Faz o compilador cobrar a 'validação na fronteira' de rules/common/coding-style.md nos pontos onde o JSON chega hoje como any: src/pages/Mentor.tsx:117 e :171 (streaming), src/pages/Discursiva.tsx:26 e src/lib/authService.ts:14. Vale só para o front; as Edge Functions não mudam.
  - **Gatilho:** Levar para a main se as correções couberem num PR pequeno com typecheck verde; desistir se exigir mexer no types.ts gerado.
  - **Como ativar:** Num branch: `bun add -d @total-typescript/ts-reset`, criar src/reset.d.ts com `import "@total-typescript/ts-reset";` e rodar `bun run typecheck`, corrigindo com zod ou checagem explícita, nunca com `as`. Depois, ressincronizar o package-lock.json (`npm install --package-lock-only`).
  - **Riscos:** Não pega cast explícito: `JSON.parse(raw) as Tipo` em src/hooks/useAffiliates.ts:340, src/lib/quizSession.ts:48 e src/pages/SimuladoOficial.tsx:257 já viola a regra hoje e precisa de correção à parte. Acrescenta uma dependência de desenvolvimento ao bun.lockb do Lovable.
  - **Backlog:** Anda junto com o P1.5 (harness de testes do front).

#### Coleta de dados e busca

- **[firecrawl/firecrawl](https://github.com/firecrawl/firecrawl)** — API, CLI e servidor MCP que transformam páginas (inclusive as montadas por JavaScript) e PDFs em markdown, com versão local em Rust, nuvem paga e auto-hospedagem. _★ 207.661 · AGPL-3.0 · avaliado em 2026-11-23; faixa: edge-functions, curador-conteudo, engenheiro-ia._
  - **Uso no LevelUp:** Radar: as fontes que chegam vazias ao fetcher.ts (Cebraspe e portal da Selecon, semeadas desligadas) passariam a ser renderizadas pela API da Firecrawl Cloud, só nas fontes marcadas, mantendo diff, portão de evidência e verificador. A Fundatec (anti-robô) continua desligada.
  - **Gatilho:** Produção só depois do P0.4 (Radar publicado e rodando) e se a URL estática, o endpoint JSON que a página consome ou o diário oficial (P17) não resolverem a fonte.
  - **Como ativar:** Aprovado pelo dono em 2026-11-23 (de acordo: 1). Código pronto e desligado: coluna radar_sources.render_mode ('direto' | 'firecrawl', migration 20261123120000) e fetchRendered (API v2 por fetch, sem SDK, sem cache, proxy basic, robots.txt e URL final conferidos, 2 MB). Para ligar: (1) curador confirma que URL estática, endpoint JSON ou diário oficial não resolvem a fonte; (2) dono cria a conta e grava o secret FIRECRAWL_API_KEY; (3) dono aplica a migration; (4) marcar a fonte com render_mode = 'firecrawl' e rodar Admin → Radar → Verificar agora. Roteiro em docs/RADAR_CONCURSOS.md.
  - **Riscos:** AGPL-3.0 só pesa se hospedarmos versão modificada; consumir a API não gera obrigação. Custo baixo (2 fontes a cada 12 h dá cerca de 120 créditos/mês, contra 1.000 grátis segundo o README), mas é dependência externa em produção, pode não respeitar robots.txt (o fetcher confere antes) e a resposta é dado não confiável (fenceUntrusted).
  - **Backlog:** Armadilha do Radar (páginas por JavaScript); P0.4; P17; D8.

### Futuro — ativar quando o gatilho acontecer

#### Processo e ambiente dos agentes

- **[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)** — CLI e skill que transformam código (AST com tree-sitter, local e sem LLM, segundo o README), docs e PDFs num grafo consultável, com arestas marcadas como extraídas ou inferidas. _★ 152.411 · Apache-2.0 · avaliado em 2026-11-23; faixa: coordenador, code-reviewer._
  - **Uso no LevelUp:** Rastrear impacto entre RPCs SECURITY DEFINER, políticas RLS, Edge Functions e telas antes de mudanças sensíveis (code-reviewer, security-reviewer). No tamanho atual do repositório, grep e as regras dão conta.
  - **Gatilho:** Início do B2B multi-tenant (P3, RLS por tenant) ou uma regressão causada por dependência entre arquivos que a revisão não viu.
  - **Como ativar:** No laboratório (ops/referencias), só o passe de código, com saída fora do repositório e `graphify install` em nível de usuário; o security-reviewer lê a skill antes.
  - **Riscos:** Apache-2.0; o passe semântico de docs e PDFs chama modelo ou chave configurada e a instalação altera a configuração do assistente. O README empurra o Graphify Cloud, e 152 mil estrelas em 7 meses pedem cautela.
  - **Backlog:** P3 (B2B multi-tenant).
- **[mattpocock/dictionary-of-ai-coding](https://github.com/mattpocock/dictionary-of-ai-coding)** — Glossário em inglês simples dos termos de programação com IA (contexto, compactação, handoff, subagente, skill). _★ 5.640 · não declarada · avaliado em 2026-11-23; faixa: documentation-writer._
  - **Uso no LevelUp:** Leitura para quem chega à equipe entender o vocabulário do AGENTS-COLLAB. Não instala nada e não muda os agentes.
  - **Gatilho:** Quando entrar a primeira pessoa técnica na equipe ou for escrito o guia de integração dos perfis da D12.
  - **Como ativar:** Citar como link externo no guia, sem copiar trechos.
  - **Riscos:** O repositório não declara licença, então o texto não pode ser copiado; está em inglês.
  - **Backlog:** D12 (equipe operacional e perfis).
- **[mattpocock/sandcastle](https://github.com/mattpocock/sandcastle)** — Biblioteca TypeScript que roda agentes de código em sandboxes isoladas (Bubblewrap, Docker ou nuvem), cada um num branch, e traz os commits de volta. _★ 9.245 · MIT · avaliado em 2026-11-23; faixa: coordenador, tester._
  - **Uso no LevelUp:** Paralelizar trabalho de implementação do coordenador em tarefas independentes, com isolamento de arquivos e ambiente. Hoje as sessões remotas e os worktrees do Claude Code bastam.
  - **Gatilho:** O coordenador rodar 3 ou mais agentes de implementação em paralelo por semana e surgirem conflitos ou vazamento de ambiente entre eles.
  - **Como ativar:** No laboratório, provedor local (Bubblewrap) e estratégia de branch que termina em PR, nunca merge na main. Confirmar que .claude/hooks/guardrails.mjs roda dentro do sandbox e passar pelo security-reviewer.
  - **Riscos:** MIT; o merge automático de commits pode furar a convenção de PR, e os provedores de nuvem (E2B, Modal, Vercel) pedem chave e levam o código para fora. Os guardrails podem não valer dentro do sandbox.
  - **Backlog:** Convenção de PR para main; ARQUITETURA §9 (governança).

#### IA de produto e conhecimento

- **[mattpocock/chat](https://github.com/mattpocock/chat)** — SDK TypeScript para bots em Telegram, WhatsApp, Slack, Discord, Teams e outros, com streaming de IA e estado em Postgres ou Redis. _não declarada · avaliado em 2026-11-23; faixa: edge-functions, engenheiro-ia, cmo._
  - **Uso no LevelUp:** Veículo da 'Questão do dia' (P3) mais simples que o OpenClaw: biblioteca numa Edge Function, resposta conferida por validate_answer e cota por aluno. Para o alerta do P1.8 não precisa: um fetch para o Telegram ou um e-mail basta.
  - **Gatilho:** D6 decidido (idade e supervisão parental) e o dono aprovar a 'Questão do dia' com consentimento explícito.
  - **Como ativar:** Usar o repositório de origem (o README aponta vercel/chat) com licença e versão conferidas e testar no Deno via npm:. Começar pelo Telegram (API gratuita), com opt-in e sem menores sem supervisão.
  - **Riscos:** Dossiê sem metadados (o README diz MIT; confirmar a procedência); WhatsApp Business cobra por conversa e exige conta Meta. Tokens dos canais viram secrets e a mensagem do aluno é dado não confiável.
  - **Backlog:** P3 'Questão do dia' (decisão do OpenClaw); D6; P1.8.

#### Design e front-end

- **[nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)** — Plugin com sete skills; a principal é uma busca local em Python sobre CSVs (diretrizes de UX, paletas, pares de fontes, regras por stack, inclusive shadcn) com gerador de design system. _★ 153.194 · MIT · avaliado em 2026-11-23; faixa: designer, mobile._
  - **Uso no LevelUp:** Na auditoria atual agrega pouco (o gerador propõe paleta e fontes novas, fora de escopo). O valor real são as regras de UI nativa de references/pro-rules.md (área segura, 44 pt/48 dp, retorno de toque, contraste nos dois temas) para o app nas lojas.
  - **Gatilho:** Início do P2.12 (Capacitor nas lojas) ou uma tela nova do zero, como a página pública do Radar por concurso.
  - **Como ativar:** Preferir incorporar as linhas aplicáveis de .claude/skills/ui-ux-pro-max/references/pro-rules.md (commit f823ab5fb970de820e5a0626a0786aba9aee0543, MIT) em rules/stack, com atribuição. Se a busca for necessária: copiar só a pasta ui-ux-pro-max (SKILL.md, references/, data/, scripts/core.py, search.py, design_system.py, reasoning_contract.py), trocar a variável de raiz do plugin pelo caminho local e nunca instalar como plugin nem copiar stack/ ou as skills design, brand, banner-design, slides e ui-styling.
  - **Riscos:** O plugin inteiro traz geradores de logo e ícone que leem ~/.claude/.env e chamam APIs pagas, um script que roda npx shadcn add (pode sobrescrever src/components/ui/), gravação de design-system/ na raiz e uma pasta stack/ com settings que liberam todos os MCP do projeto e leitura de /home. Revisão de segurança: aprovado só o subconjunto acima.
  - **Backlog:** Checklist de UI nativa para o P2.12.

#### Mobile e lojas

- **[mjmirza/app-store-compliance](https://github.com/mjmirza/app-store-compliance)** — Playbook com 124 padrões de recusa da App Store e do Google Play e 112 prazos regulatórios, mais um guard em bash (v2.5.1) que bloqueia comandos de build e envio quando acha risco crítico. _★ 4.716 · NOASSERTION · avaliado em 2026-11-23; faixa: mobile, pagamentos, security-reviewer._
  - **Uso no LevelUp:** Hoje só como leitura de apoio para D5 e D6 (conferir na fonte oficial); o guard não tem o que checar sem ios/ e android/. Com o Capacitor, varredura manual antes de cada envio para 3.1.1/Play Billing, 4.2, consentimento de IA (5.1.2(i)) e exclusão de conta (5.1.1(v)).
  - **Gatilho:** Branch do P2.12 com capacitor.config e as pastas ios/ ou android/ criadas, depois de D5 decidido, e licença ORA 2.3 aprovada pelo jurídico.
  - **Como ativar:** Clonar fora do repositório num commit revisado (ad76746 ou posterior) e rodar só o modo manual (bash agent-os/hooks/app-store-compliance-guard.sh <projeto>), sem scripts/install.sh (que edita ~/.claude). Triar achados com security-reviewer e pagamentos; hook próprio só versionado em .claude/hooks com teste.
  - **Riscos:** Reprovado para instalação agora pelo security-reviewer: o scripts/install.sh grava um hook PreToolUse global em ~/.claude/settings.json para todo comando Bash, e a skill manda rodar monitores com rede e pull-metadata.sh com credenciais das lojas. Licença OpenRoots Agent License 2.3 (não OSI; royalty acima de US$ 20 mi de receita; restrição para treino de IA) exige leitura jurídica. Como hook, bloquearia todo cap sync até D5 (Stripe citado no código).
  - **Backlog:** D5, P2.12, D6/P0.3 e P1.8d; revelou a falta de exclusão de conta dentro do app.
- **[pierridotite/mobile-agent-testers](https://github.com/pierridotite/mobile-agent-testers)** — Template de GitHub Actions que sobe até 20 agentes Claude Code em simuladores iOS e emuladores Android, cada um com uma persona (aparelho, idioma, fonte grande), e entrega relatórios criptografados com capturas; aceita Capacitor. _★ 1.341 · MIT · avaliado em 2026-11-23; faixa: tester, mobile, security-reviewer._
  - **Uso no LevelUp:** Com o build Capacitor pronto, rodar personas pt-BR (iPhone SE com fonte máxima, Android de entrada com fonte 200%, leitor de tela) nos fluxos da estrela-guia: cadastro, simulado completo, revisão offline e checkout. Complementa os testes determinísticos do tester.
  - **Gatilho:** Build instalável (APK de debug e build de simulador iOS) gerado na CI pelo P2.12 e homologação com contas sintéticas de adultos; reavaliar a maturidade (o projeto tem uma semana).
  - **Como ativar:** Clonar, ler workflow, setup.sh, scripts/collect.sh e LICENSE e fixar commit; criar repositório separado a partir do template, configurar só token do Claude e conta de homologação, e começar com 2 personas Android.
  - **Riscos:** Agentes leem telas com conteúdo de terceiros num runner com segredos (injeção de prompt e vazamento): só homologação, token mínimo, nunca produção (D4) nem dado de menor. Runner grátis só em repositório público; custo de cerca de US$ 0,15 a 0,55 por aparelho e resultados não reproduzíveis.
  - **Backlog:** P2.12, P1.5 (harness do tester) e item 19 (auditoria de UI e acessibilidade).

### Monitorar

#### Processo e ambiente dos agentes

- **[affaan-m/ECC](https://github.com/affaan-m/ECC)** — Harness com 72 agentes, 328 skills, hooks, memória contínua e o scanner AgentShield, instalado por npx ou pelo plugin ecc@ecc, de marketplace próprio. _★ 309.416 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Por que acompanhar:** A organização de rules/ e parte dos guardrails já vieram dele; instalar o pacote criaria um segundo elenco e uma segunda memória ao lado dos 17 agentes e do AGENTS-COLLAB. A única peça nova é o AgentShield, que segundo o README varre prompts, hooks, configuração de MCP, permissões, segredos e arquivos de agentes.
  - **Reavaliar quando:** Quando o .claude/ ganhar um plugin com hooks ou um servidor MCP de terceiros: rodar o AgentShield uma vez sobre ele.
  - **Riscos:** Pacote npm de terceiros rodando sobre o repositório (risco de cadeia de suprimentos). Os hooks de aprendizado contínuo gravariam memória fora do AGENTS-COLLAB.
- **[google-gemini/gemini-api-cli](https://github.com/google-gemini/gemini-api-cli)** — CLI experimental em Go que dá a qualquer agente com shell acesso à API do Gemini: texto, análise de arquivos, imagem, áudio, vídeo e agentes gerenciados. _★ 956 · Apache-2.0 · avaliado em 2026-11-23; faixa: engenheiro-ia, cmo._
  - **Por que acompanhar:** Hoje nenhum: os modelos Gemini de texto já chegam pelo Lovable AI Gateway com uma chave e telemetria. Ler edital em PDF com modelo não serve de evidência literal do Radar (use extração determinística de texto); sobra gerar mídia para o cmo.
  - **Reavaliar quando:** Sair de experimental e o cmo precisar de imagem ou voz geradas em volume, com chave paga do dono.
  - **Riscos:** Apache-2.0, experimental e sem aceitar PRs; GEMINI_API_KEY é secret do dono e é preciso conferir nos termos se o nível gratuito usa os dados para melhorar produtos. Só material público, nunca dado de aluno.
- **[mattpocock/cookout](https://github.com/mattpocock/cookout)** — Quadro no estilo Slack, hospedado pelo próprio usuário, onde pessoas e agentes conversam em canais (servidor Node, SQLite e token de admin). _★ 5 · não declarada · avaliado em 2026-11-23; faixa: gerente-contexto._
  - **Por que acompanhar:** Seria uma alternativa ao handoff por arquivo do AGENTS-COLLAB, que hoje fica versionado e passa por revisão em PR. Nenhum problema atual justifica a troca.
  - **Reavaliar quando:** Se sessões paralelas passarem a gerar conflitos frequentes em AGENTS-COLLAB.md e o projeto tiver licença e versão estável.
  - **Riscos:** Criado em 22/11/2026, com 5 estrelas e sem licença; exige servidor e token de admin (mais um segredo) e tiraria o estado vivo do Git.

#### Coleta de dados e busca

- **[xerj-org/xerj](https://github.com/xerj-org/xerj)** — Motor de busca em um binário Rust (BM25, vetor e híbrido) com servidor MCP e API compatível com Elasticsearch; o modelo Query-1 responde sobre fatos gravados e devolve UNKNOWN ou CONFLICT quando não há base. _★ 20.211 · Apache-2.0 · avaliado em 2026-11-23; faixa: engenheiro-ia._
  - **Por que acompanhar:** Nenhum hoje: busca no produto cabe no Postgres e busca de código no grep dos agentes. O 'recusar quando falta fato' lembra o portão de evidência do Radar (evidence.ts), que já existe em código.
  - **Reavaliar quando:** Versão estável (fora de rc) e Query-1 com código ou dados de avaliação públicos e benchmark independente.
  - **Riscos:** O motor é Apache-2.0, mas o Query-1 é binário proprietário fora do código público (segundo o README), o formato de dados não volta de versão e a instalação é `curl | sh`. Projeto de 2026-06 com benchmarks do próprio autor.

#### Segurança

- **[erkamyaman/safe-anything](https://github.com/erkamyaman/safe-anything)** — Scanner em Rust (CLI, MCP e GitHub Action) de XSS, SQLi, segredos, CVEs via OSV.dev e configuração insegura de agentes. _★ 393 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Por que acompanhar:** As regras de 'agent setups' (bypassPermissions, npx sem versão em MCP, curl|sh em hooks, Unicode invisível) servem de checklist para revisar skills. Útil em tese, mas imaturo demais para rodar no repositório. Reavaliar quando tiver histórico e o código for lido, rodando com --offline.
  - **Reavaliar quando:** Projeto com ao menos 3 meses de histórico e mais de um mantenedor; antes de qualquer piloto, clonar, ler o código e rodar só com --offline numa cópia sem .env.
  - **Riscos:** Criado em 2026-11-22 por um autor só. É um binário novo que lê o repositório inteiro (inclusive o .env do Lovable) e consulta a rede por padrão; não foi clonado nem lido aqui.

#### Marketing e conteúdo

- **[JuneYaooo/rea-video](https://github.com/JuneYaooo/rea-video)** — Skill e CLI que desmontam um vídeo plano a plano (filmado, IA ou código), com legendas, cortes e áudio, e sugerem como refazê-lo. _★ 12.583 · Apache-2.0 · avaliado em 2026-11-23; faixa: cmo._
  - **Por que acompanhar:** Estudar vídeos curtos de referência para as peças da campanha do simulado; complementa o HyperFrames já testado no laboratório.
  - **Reavaliar quando:** Projeto com pelo menos 3 meses e campanha de vídeo do simulado (D12) aprovada com produção semanal.
  - **Riscos:** Apache-2.0, criado em 2026-10-29; direitos autorais do vídeo analisado e do 'remake'. A chave opcional de modelo de vídeo (Gemini ou Doubao) envia o vídeo a terceiros: só material público, nunca de aluno.
- **[ScrapeCreators/social-media-research-skills](https://github.com/ScrapeCreators/social-media-research-skills)** — Skills de agente para pesquisa em redes sociais (posts fora da curva, mineração de comentários, concorrentes, anúncios), apoiadas na API paga ScrapeCreators. _★ 7.386 · MIT · avaliado em 2026-11-23; faixa: cmo._
  - **Por que acompanhar:** Pesquisa de voz do concurseiro (dúvidas, objeções) em conteúdo de cursinhos para a campanha do simulado (D12); não toca o produto.
  - **Reavaliar quando:** Jurídico aprovar a base legal para tratar comentários públicos (LGPD, possíveis menores) e o cmo precisar dessa pesquisa em escala; até lá, pesquisa manual.
  - **Riscos:** Skills MIT, mas os dados vêm de API paga (chave do dono) que raspa redes cujos termos podem proibir. Comentários são dado pessoal: só agregados, sem guardar perfis.

### Descartados

#### Processo e ambiente dos agentes

- **[anomalyco/opencode](https://github.com/anomalyco/opencode)** — Agente de programação de código aberto (CLI e app desktop), alternativa ao Claude Code. _★ 228.769 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum no projeto; o AGENTS.md já segue o padrão aberto que ele lê. Usar outro harness é decisão pessoal do dono.
  - **Riscos:** Nele o .claude/hooks/guardrails.mjs não roda: force-push, supabase db push e edição de .lovable/ deixam de ser bloqueados.
- **[ccch1mneyyy/dsh-Go](https://github.com/ccch1mneyyy/dsh-Go)** — App Android (APK por sideload) do DeepSeek Harness, com ambiente Linux, controle do celular e acesso remoto ao PC. _★ 30.694 · AGPL-3.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Fora do escopo.
  - **Riscos:** Controle de tela e toque por IA, telemetria anônima ligada por padrão e instalação fora da Play Store, sob AGPL-3.0.
- **[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)** — Harness de agentes da DeepSeek em que tudo é plugin, com interface web e TUI, em prévia de desenvolvedor. _★ 285.997 · MIT · avaliado em 2026-11-23; faixa: engenheiro-ia._
  - **Motivo:** Mantém a decisão de 2026-11-17 (➖ em docs/REFERENCIAS_REPOSITORIOS.md §2; do laboratório ficou só o padrão de prazo do dsh-timeout, já coberto pelo deadline do llm.ts). Nada mudou: segue prévia com quebras de compatibilidade, e o ecossistema de plugins agora inclui gateways 'grátis' arriscados (ver dsh-our-free-model).
  - **Riscos:** MIT; o próprio SAFETY.md avisa que não há auditoria de segurança. Plugins de terceiros rodam com acesso ao host.
- **[deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)** — Protótipo de pesquisa de agente proativo para um repositório GitHub: ouve issues e Feishu, trabalha em sessão própria e responde com PR. _★ 24.347 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum: duplica as sessões do Claude Code com o coordenador, e um agente que escreve no repositório por conta própria colide com D4 e com os guardrails. O princípio de gastar o mínimo de atenção humana já está nos handoffs e nos portões da CI.
  - **Riscos:** MIT, 'não é produto oficial' e 'pode ter bugs' (segundo o README), sobre um harness em prévia. Exige app do GitHub com escrita e instalação conduzida por agente.
- **[earendil-works/pi](https://github.com/earendil-works/pi)** — Harness mínimo de agente com CLI de código, API unificada de vários provedores (pi-ai), runtime de agente com ferramentas e contratos de telemetria. _★ 123.502 · MIT · avaliado em 2026-11-23; faixa: engenheiro-ia._
  - **Motivo:** Nenhum: pi-ai e pi-agent-core duplicariam a camada _shared/ai (D2) no laço de ferramentas do Mentor (P2.11), que cabe em llm.ts com limite de turnos e prazo. Como CLI de desenvolvimento, não tem sistema de permissões (segundo o README) e ficaria fora dos guardrails.
  - **Riscos:** MIT; roda com todas as permissões do usuário. Seria mais uma dependência de produção sem ganho de qualidade medido.
- **[Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)** — Plugin do dsh que oferece modelos de ponta 'grátis e sem limite', sem conta nem chave, via gateways públicos de terceiros, pools de contas e uma porta local compatível com OpenAI. _★ 84.935 · NOASSERTION · avaliado em 2026-11-23; faixa: engenheiro-ia, security-reviewer._
  - **Motivo:** Nenhum, nem em desenvolvimento: código do LevelUp e qualquer dado de aluno iriam para gateways sem contrato. Toda chamada de produto passa pelo gateway contratado (D2).
  - **Riscos:** Licença NOASSERTION; troca de IP de saída para driblar cota e pools de contas violam termos de uso, e o próprio README avisa que o upstream pode registrar os prompts. Atualização a quente e avisos em tela cheia enviados pelo mantenedor abrem a cadeia de suprimentos.
- **[EL4CTEO/fast-anything](https://github.com/EL4CTEO/fast-anything)** — Ferramenta que mede o app, porta para Rust só as funções lentas e prova a equivalência com chamadas reais gravadas. _★ 2.975 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Não há gargalo de CPU: o tempo vai para o modelo e o banco, e o front roda no navegador, onde binding nativo não carrega.
  - **Riscos:** Criado em 21/11/2026. A ferramenta MCP fast_enable altera o código-fonte sem passar pelo hook de guardrails.
- **[farion1231/cc-switch](https://github.com/farion1231/cc-switch)** — App desktop que troca o provedor de API do Claude Code e de outros agentes e centraliza MCP, skills e prompts. _★ 156.627 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum no projeto; é decisão pessoal do dono. A sincronização central de skills disputaria espaço com as 79 geradas por ops/agentes/skills.mjs.
  - **Riscos:** O modo de roteamento passa as requisições por um proxy local e permite mandar o código do repositório para provedores de terceiros. As configurações prontas vêm com links de afiliado.
- **[garrytan/gstack](https://github.com/garrytan/gstack)** — Conjunto de 23 comandos que fazem papéis (CEO, designer, QA com navegador, segurança, release), clonado em ~/.claude/skills por um setup que registra hooks. _★ 142.458 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Os papéis repetem os 17 agentes e os 79 cargos (o organograma já tem CEO e CTO), e /review, /cso e /ship repetem code-reviewer, security-reviewer e reviewer. Segundo o próprio README, não melhorou a correção de bugs (58 tarefas com gstack contra 61 de 99 sem).
  - **Riscos:** A instalação manda escrever no CLAUDE.md uma regra de navegação ('/browse para toda navegação'), registra hooks, e o modo equipe faz commit no repositório com atualização automática. Exige Bun 1.4.2+ e compila um navegador próprio.
- **[libracoder/kiri](https://github.com/libracoder/kiri)** — Runtime de contêineres em Rust compatível com Docker, com Kubernetes, CA própria para HTTPS local e um `kiri share` que publica uma porta local na internet. _★ 12.595 · Apache-2.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** No máximo rodaria o Supabase local, que o Docker já atende. Não traz ganho para o aluno e cria risco alto na máquina de desenvolvimento.
  - **Riscos:** Projeto de 3 semanas que se autoatualiza e instala uma autoridade certificadora. Também pode expor à internet o Supabase local, com service_role.
- **[mattpocock/ai-hero-cli](https://github.com/mattpocock/ai-hero-cli)** — CLI que navega e roda os exercícios do curso AI Hero. _★ 155 · MIT · avaliado em 2026-11-23; faixa: engenheiro-ia._
  - **Motivo:** Nenhum; o próprio README diz que não serve fora do contexto do curso.
  - **Riscos:** MIT e sem risco relevante; só não tem uso.
- **[milind-soni/OpenMausBot](https://github.com/milind-soni/OpenMausBot)** — App de chat com vários bots (Claude, Codex e Grok locais) que usam VM na nuvem, VM local ou o próprio computador, mais de 500 apps via Composio. _★ 27.123 · Apache-2.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Não ajuda o candidato e aumenta a superfície de ataque da máquina do dono.
  - **Riscos:** Dá a agentes o controle do computador onde ficam os segredos do projeto, com OAuth amplo em apps de terceiros.
- **[msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)** — Catálogo grande de agentes com persona (engenharia, marketing, comunidade), instalado por script ou app desktop em ~/.claude/agents. _★ 169.914 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum: o LevelUp já tem 17 faixas exclusivas e 79 cargos gerados de catálogo próprio. Personas 'com personalidade' contrariam o desenho de faixas sem sobreposição.
  - **Riscos:** Mais de cem descrições de agente disputariam o roteamento automático, que escolhe pelo campo description.
- **[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)** — Agente pessoal que cria e reescreve as próprias skills com a experiência, roda em VPS ou nuvem e conversa por Telegram, com qualquer provedor de modelo. _★ 265.615 · MIT · avaliado em 2026-11-23; faixa: engenheiro-ia._
  - **Motivo:** Nenhum: o Mentor é agente único com poucas ferramentas nas Edge Functions (P2.11) e prompt só muda com nova versão e golden set; um agente que se reescreve sozinho contraria isso. A versão governada da ideia já existe em ai_lessons (curta, contada, desativável).
  - **Riscos:** MIT, mas instalação `curl | bash`, ferramentas no host, gateway de mensagens e assinatura Nous Portal. Aprendizado sem revisão humana traz deriva e envenenamento.
- **[obra/superpowers](https://github.com/obra/superpowers)** — Metodologia completa em skills que disparam sozinhas (brainstorm, spec, plano e desenvolvimento por subagentes), hoje no marketplace oficial. _★ 324.842 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nada novo a ativar: o TDD e o verification-before-completion já estão em rules/common/testing.md e no 'verifique o verificador' do tester.md. Só ficou mais fácil instalar, e o pacote inteiro disputa o processo com o AGENTS-COLLAB e o coordenador.
  - **Riscos:** Segundo o README, o agente segue o plano sozinho por horas, o que pula a regra 'mudança estrutural → aprovação do dono'. Continua disponível na conta do dono para uso pessoal; não ativar no projeto.
- **[pingdotgg/t3code](https://github.com/pingdotgg/t3code)** — Painel aberto para controlar Claude Code, Codex e outros agentes pelo desktop, pela web ou pelo celular. _★ 74.262 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum no projeto; é decisão pessoal do dono sobre como operar as sessões.
  - **Riscos:** Acesso remoto e aprovação pelo celular numa máquina com MCP de produção (Supabase, Lovable) aumentam a superfície de ataque.
- **[stablyai/orca](https://github.com/stablyai/orca)** — IDE de agentes com bots agendados ou disparados por PR, CI e webhook, memória em Markdown e app para celular. _★ 134.219 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum no projeto; o que seria agendado (acompanhar ai_runs, alertas) já tem pg_cron e Edge Functions.
  - **Riscos:** Os bots agem sozinhos em PR e webhook, com memória própria (SOUL.md, MEMORY.md) fora do AGENTS-COLLAB. O README informa telemetria anônima, que pode ser desligada.
- **[storytold/craft-anything](https://github.com/storytold/craft-anything)** — Motor de engenharia reversa que estuda um site, app ou jogo e faz um agente construir uma versão própria. _★ 41.961 · Apache-2.0 · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum: clonar plataformas concorrentes não ajuda o candidato e repete o risco jurídico que já levou ao descarte do morluto/rea.
  - **Riscos:** No modo Deep lê código e arquivos do alvo; o README avisa que o modo clean room não é sandbox e que o agente age com as permissões do usuário.
- **[thedotmack/claude-mem](https://github.com/thedotmack/claude-mem)** — Plugin que grava o que o agente de código faz em cada sessão, resume com IA e injeta esse contexto nas sessões seguintes. _★ 119.273 · Apache-2.0 · avaliado em 2026-11-23; faixa: gerente-contexto, security-reviewer._
  - **Motivo:** Nenhum: a memória entre agentes do LevelUp é explícita, curta, versionada e revisável (AGENTS-COLLAB e handoffs, D1). Memória capturada e reinjetada sem revisão repete o risco que as regras já apontam para ai_lessons.
  - **Riscos:** Captura tudo da sessão (inclusive resultados de consultas à produção e possíveis segredos) e manda resumir por observador pago, OpenRouter ou Gemini; analytics anônimo vem ligado (segundo o README). Memória injetada é superfície de envenenamento, e o instalador pede conta e cartão para o teste grátis.
- **[ultraworkers/claw-code](https://github.com/ultraworkers/claw-code)** — Harness em Rust que o próprio README chama de peça de museu mantida por agentes, sem uso em produção. _★ 194.730 · MIT · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** Nenhum.
  - **Riscos:** Só compila a partir do código-fonte e pede chave de API da Anthropic; segundo o README, o crate de mesmo nome no crates.io instala outra coisa.
- **[vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop)** — CLI e servidor MCP para agentes operarem aplicativos de desktop pela árvore de acessibilidade do sistema. _★ 26.317 · Apache-2.0 · avaliado em 2026-11-23; faixa: coordenador._
  - **Motivo:** O LevelUp é web/PWA, e para o navegador o tester já tem o agent-browser (mesma equipe) e o Playwright registrados. Foi feito para apps de desktop e não acrescenta nada ao app web nem às lojas.
  - **Riscos:** Snapshots e área de transferência podem conter dados pessoais da tela, segundo o README. Ações feitas por MCP não passam pelo hook de guardrails, cujo matcher só cobre Bash, Edit e Write.

#### IA de produto e conhecimento

- **[NVIDIA/auto-ontology](https://github.com/NVIDIA/auto-ontology)** — Biblioteca que gera uma ontologia a partir dos metadados do banco e a expõe por MCP, CLI e API para agentes responderem perguntas de negócio com SQL rastreável. _★ 14.599 · Apache-2.0 · avaliado em 2026-11-23; faixa: engenheiro-ia, arquiteto-dados._
  - **Motivo:** Perguntas do admin em linguagem natural sobre o banco. O LevelUp tem uma fonte (Postgres) e métricas fixas (simulados/semana, custo por agente em ai_runs no P1.6), caso em que o próprio README admite que SQL direto basta.
  - **Riscos:** Apache-2.0, mas exige Docker, chave NVIDIA e conexão ao banco, mandando schema e valores com dados de alunos (há menores) a modelos externos. Operar mais um serviço não se paga para meia dúzia de consultas.
- **[openclaw/openclaw](https://github.com/openclaw/openclaw)** — Assistente pessoal de código aberto que roda no próprio computador e atende por WhatsApp, Telegram, Slack e outros canais, com modelos e ferramentas como plugins. _★ 395.093 · MIT · avaliado em 2026-11-23; faixa: engenheiro-ia, edge-functions._
  - **Motivo:** A decisão de 2026-11-17 ligava a ele a 'Questão do dia' por mensageiro (🗂️ P3). Muda: é gateway de assistente pessoal com ferramentas no host, e para um bot de muitos alunos uma biblioteca de chat numa Edge Function é o mais simples (ver mattpocock/chat); o retry testado no laboratório já existe no llm.ts.
  - **Riscos:** MIT, sem plano pago; ferramentas rodam no host sem sandbox por padrão (segundo o README). Qualquer canal com alunos exige consentimento e a decisão D6.

#### Coleta de dados e busca

- **[D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling)** — Framework Python de raspagem com requisições HTTP, navegador furtivo, spiders e servidor MCP. _★ 105.248 · BSD-3-Clause · avaliado em 2026-11-23; faixa: engenheiro-ia, edge-functions._
  - **Motivo:** Nenhum: o diferencial é o modo furtivo que contorna anti-robô e o Cloudflare Turnstile (segundo o README), e o Radar respeita robots.txt e deixou a Fundatec desligada de propósito. Além disso é Python, fora do stack Deno das Edge Functions.
  - **Riscos:** BSD-3-Clause sem problema, mas contornar anti-robô fere termos de uso dos sites e a convenção de boa vizinhança do coletor. A ideia útil dispensa instalação: o curador pode achar o endpoint JSON que a página dinâmica consome e cadastrá-lo como fonte.

#### Design e front-end

- **[meta/astryx](https://github.com/meta/astryx)** — Design system da Meta em beta: mais de 150 componentes React com StyleX, temas e uma CLI com documentação para agentes. _★ 32.489 · MIT · avaliado em 2026-11-23; faixa: designer, frontend._
  - **Motivo:** Adotá-lo seria trocar shadcn/Radix + Tailwind (fora de escopo) e exige React 19 (o app usa 18.3.1). A ideia de documentação legível por agentes já está coberta por rules/ e pelo agente designer.
  - **Riscos:** A CLI init grava o guia do Astryx em AGENTS.md e CLAUDE.md (fonte da verdade do projeto) e pede StyleX e React 19.

#### Segurança

- **[BaaRai/ARTEX](https://github.com/BaaRai/ARTEX)** — Plataforma autônoma de pentest com LLM (tradução do upstream Autumn-27/ARTEX), com proxy MITM, extensão de navegador e trabalhadores que rodam ferramentas reais. _★ 17.343 · AGPL-3.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. O método do projeto proíbe sondar ambientes vivos que guardam dados de alunos. Se um dia houver teste dinâmico, ele é contratado com escopo e feito em staging, não por agente autônomo.
  - **Riscos:** Agente ofensivo autônomo, captura de tráfego com dados pessoais, procedência de fork e AGPL-3.0.
- **[elementalsouls/Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter)** — Pacote de 83 skills e 15 comandos de bug bounty e red team, com MCP do Burp e do HackerOne e instaladores que copiam para o ~/.claude de vários agentes. _★ 19.299 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum além do 'portão de 7 perguntas', já incorporado em 2026-11-17. É ofensivo e fora do escopo. Mantém a decisão anterior.
  - **Riscos:** As skills ofensivas carregam sozinhas por tema, o instalador pede token do HackerOne e liga o MCP do Burp. Reconhecimento contra alvos externos traz risco jurídico.
- **[havenicec/google-qr-sms-helper](https://github.com/havenicec/google-qr-sms-helper)** — Extensão do Chrome que contorna a verificação por QR do Google falsificando o navegador (iPad Mini), injetando RPCs e usando números de serviços de recebimento de SMS. _★ 4.240 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. É ferramenta de contorno de verificação. Não instalar em nenhuma máquina com acesso ao projeto.
  - **Riscos:** Contorna controle de segurança e os termos do Google. Uma extensão com acesso à sessão de accounts.google.com pode tomar as contas que administram o projeto.
- **[morluto/rea](https://github.com/morluto/rea)** — MCP e CLI de engenharia reversa de binários, apps Electron, .NET, Android e sites, com um setup que altera a configuração do agente. _★ 475.283 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Já foi descartado em 2026-11-17. Mantém a decisão anterior.
  - **Riscos:** Analisar apps de concorrentes traz risco jurídico. O `npx rea-agents@latest setup` muda a config do agente e pode instalar ferramentas nativas, e as 475 mil estrelas não são plausíveis.
- **[sherlock-project/sherlock](https://github.com/sherlock-project/sherlock)** — Ferramenta de OSINT que procura um nome de usuário em mais de 400 redes sociais. _★ 116.209 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum uso legítimo. Rodar sobre alunos ou candidatos seria perfilamento. Não protege quem estuda nem ajuda a passar. É coleta sem base legal.
  - **Riscos:** Viola finalidade e minimização da LGPD e o ECA Digital (há menores), com exposição jurídica.

#### Marketing e conteúdo

- **[mattpocock/course-video-manager](https://github.com/mattpocock/course-video-manager)** — Ferramenta pessoal do autor para publicar vídeos de curso (metadados, descrições, miniaturas e postagem), com Drizzle e Remotion. _★ 937 · não declarada · avaliado em 2026-11-23; faixa: engenheiro-ia._
  - **Motivo:** Nenhum. A disciplina de migrations só aditivas com portão de versão já está nas convenções (idempotentes e tolerantes à ordem de publicação).
  - **Riscos:** Sem licença no repositório (todos os direitos reservados): não copiar código.

#### Fora do escopo

- **[anefzaoui/misterdownloadmanager](https://github.com/anefzaoui/misterdownloadmanager)** — Clone do IDM em Rust, com yt-dlp, torrent e debrid, e instalador para Windows ainda sem assinatura. _★ 17.212 · GPL-3.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Fora do escopo.
  - **Riscos:** Binário sem assinatura (o próprio README manda clicar em 'Run anyway'), extensão de navegador com acesso aos downloads e uso para pirataria.
- **[ItsNotRexed/Leonida](https://github.com/ItsNotRexed/Leonida)** — Recompilação estática do GTA VI de Xbox para PC a partir de uma cópia do jogo. _★ 25.433 · GPL-3.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Fora do escopo.
  - **Riscos:** Envolve propriedade intelectual de terceiro, com risco de DMCA.
- **[kunkundi/crossdesk](https://github.com/kunkundi/crossdesk)** — Área de trabalho remota multiplataforma com cliente web e um MCP para um agente observar e operar computadores remotos. _★ 6.610 · NOASSERTION · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Suporte remoto a alunos menores não é desejável. A superfície de ataque é alta e não há ganho para o estudo.
  - **Riscos:** Agente com controle remoto, sinalização em servidor de terceiro e licença sem declaração (NOASSERTION).
- **[os6/nospeaker](https://github.com/os6/nospeaker)** — Programa de macOS que faz o motor háptico do trackpad falar. _★ 1.172 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Fora do escopo.
  - **Riscos:** Instala por `curl ... | sh`, usa framework privado da Apple e o repositório tem 1 dia.
- **[thtbee/nectarlink](https://github.com/thtbee/nectarlink)** — Integração entre Android e PC (notificações, SMS, chamadas, área de transferência, arquivos, espelhamento), instalada por curl|sh e por APK fora da Play Store. _★ 6.082 · NOASSERTION · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. Risco de vazar credenciais da máquina de desenvolvimento.
  - **Riscos:** Sincroniza com o celular a área de transferência e as notificações, onde passam segredos e códigos de uso único. Pede para pausar o Play Protect, o instalador não tem assinatura e a licença é NOASSERTION.
- **[XiaoYouChR/Ghost-Downloader-3](https://github.com/XiaoYouChR/Ghost-Downloader-3)** — Gerenciador de downloads (HTTP, BT, magnet, M3U8, YouTube) que promete impressão TLS de navegador real 'invisível a anti-bot', patrocinado por um proxy residencial. _★ 16.115 · GPL-3.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum. O Radar busca editais em fontes oficiais pelas Edge Functions. Na prática serve para raspagem e pirataria.
  - **Riscos:** Contornar anti-bot e baixar conteúdo protegido (aulas de concorrentes) traz risco jurídico. Licença GPL-3.0.
- **[XinaTian/MROffice](https://github.com/XinaTian/MROffice)** — Suíte de escritório com IA, MCP (hospedado em mcp.mroffice.ai ou via `npx -y mroffice-mcp`) e SDK de embed. _★ 2.729 · AGPL-3.0 · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Motivo:** Nenhum necessário. Exportar PDF cabe no stack atual. Cria dependência e um fluxo de dados desnecessários.
  - **Riscos:** Os documentos passam pelo serviço deles, o MCP não tem versão fixa e o `npx mroffice-embed init` grava chaves no .env, que é gerenciado pelo Lovable. Licença AGPL-3.0.

### Detalhe dos ativos

#### Processo e ambiente dos agentes

- **[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)** — Prompt de 'dev sênior preguiçoso' (a menor mudança que resolve tudo) distribuído como plugin com hooks, skills de revisão e auditoria e uma barra de custo por tarefa. _★ 197.393 · MIT · avaliado em 2026-11-23; faixa: code-reviewer, frontend, edge-functions, supabase-db, engenheiro-ia, pagamentos, mobile._
  - **Uso no LevelUp:** Incorporar três regras: a escada (já existe no repositório → recurso da plataforma → dependência já instalada → código mínimo, e nunca dependência nova por poucas linhas), o comentário `atalho: <limite>, <quando trocar>` e 'código movido ou fundido mantém validação e tratamento de erro'. O teto de 1.000 respostas no domínio por tópico (backlog 20) é o tipo de atalho que essa marcação teria deixado à vista.
  - **Gatilho:** Não se aplica (entra agora, só o texto).
  - **Como ativar:** Feito: a escada (repositório → plataforma → dependência instalada → mínimo), o comentário 'atalho: <limite>, <quando trocar>' e 'código movido mantém validação' reescritos em rules/common/coding-style.md. Não instalar o plugin.
  - **Riscos:** Plugin reprovado pelo security-reviewer: 3 hooks (SessionStart, SubagentStart, UserPromptSubmit) injetam a persona em toda sessão e em todo subagente, por cima das 17 faixas; grava estado em ~/.claude e ~/.config/ponytail, oferece editar ~/.claude/settings.json e tem webhook opcional com o primeiro prompt.
  - **Backlog:** Backlog 20 (RPC de domínio por tópico); nenhum item novo.
- **[mattpocock/skills](https://github.com/mattpocock/skills)** — Pacote de skills curtas de engenharia e produtividade (grill-me, grill-with-docs, triage, teach, diagnosing-bugs, git-guardrails), hoje disponível como plugin oficial que se atualiza sozinho. _★ 331.217 · MIT · avaliado em 2026-11-23; faixa: coordenador, tester, code-reviewer, documentation-writer._
  - **Uso no LevelUp:** Desde a avaliação anterior só mudou o canal de instalação: teach/grilling já viraram o modo socrático do Mentor, git-guardrails virou o hook e diagnosing-bugs está no tester.md. O ganho novo é o /grill-with-docs, para o dono fechar D5/D6 e montar um glossário do domínio (tier × billing_tier, plano efetivo, Passe, trilha, Radar), termos que já geraram armadilhas reais.
  - **Gatilho:** Reavaliar em 2 semanas (até 2026-12-07): se alguma skill do pacote disparar fora de hora ou repetir o que os agentes do projeto já fazem, voltar para settings.local.json só na máquina do dono.
  - **Como ativar:** Feito: "mattpocock-skills@claude-plugins-official": true em enabledPlugins do .claude/settings.json (diretório oficial, fixado no commit 49dd158, v1.3.1, 27 skills). Regras de uso em rules/common/ai-agents.md: não rodar /setup-matt-pocock-skills neste repositório, não usar a wizard (segredos e .env), to-spec, to-tickets, triage e wayfinder só publicam no GitHub com o OK do dono; research grava em docs/; o handoff continua no AGENTS-COLLAB.md.
  - **Riscos:** Instalado a pedido explícito do dono. Repete diagnosing-bugs e git-guardrails, já absorvidos, e soma descrições de skill às 79 dos cargos (coordenador). Revisão de segurança: aprovado com condições; sem hooks nem MCP. A setup edita o CLAUDE.md e cria GLOSSARY.md e docs/adr sem perguntar, e a wizard lê .env e grava segredos no .env e nos GitHub Secrets (conflita com o .env do Lovable). O diretório oficial atualiza o commit fixado sem revisão nossa: a varredura semanal compara o commit e pede novo de acordo quando mudar.
  - **Backlog:** Apoia as decisões pendentes D5 (lojas) e D6 (ECA Digital); nenhum item de P0 a P2 depende dele.
- **[multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)** — Um CLAUDE.md com quatro princípios contra erros comuns de LLM: pensar antes de codar, simplicidade, mudança cirúrgica e execução guiada por critério verificável. _★ 235.278 · não declarada · avaliado em 2026-11-23; faixa: code-reviewer, documentation-writer._
  - **Uso no LevelUp:** Incorporar só o que falta: mudança cirúrgica (toda linha alterada responde ao pedido, nada de refatorar ou reformatar o código vizinho, código morto alheio é apontado e não apagado) e 'declarar as suposições e as leituras possíveis do pedido antes de codar'. Isso reduz o diff fora de escopo nos PRs que o code-reviewer revisa.
  - **Gatilho:** Não se aplica (entra agora, só o texto).
  - **Como ativar:** Feito: princípios reescritos em PT-BR, com palavras próprias, no bloco 'Mudança mínima e cirúrgica' de rules/common/coding-style.md, no contrato de delegação (.claude/agents/README.md) e no code-reviewer. Não instalar o plugin nem usar o curl do README.
  - **Riscos:** Sem arquivo LICENSE (MIT só no plugin.json), por isso adotada a ideia e não o texto; o marketplace do README aponta para outro dono (forrestchang). 'Sem tratamento de erro para cenário impossível' não foi importado: conflita com 'falhe fechado'.
  - **Backlog:** Nenhum item; reforça os princípios 6 e 7 do CLAUDE.md e o portão de revisão.

#### IA de produto e conhecimento

- **[karpathy/llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)** — Padrão (gist, sem código) de base de conhecimento mantida por LLM: fontes imutáveis, wiki compilado e atualizado a cada fonte nova e esquema; operações ingest, query e lint, com index.md e log.md só de acréscimo. _não declarada (adotada só a ideia) · avaliado em 2026-11-23; faixa: gerente-contexto, engenheiro-ia._
  - **Uso no LevelUp:** Já é o desenho do AGENTS-COLLAB e do Radar (fonte oficial imutável, fato com evidência, conflito vai para revisão). Falta o 'lint': o gerente-contexto procurar contradições entre AGENTS-COLLAB, CLAUDE.md e docs, afirmações obsoletas e docs órfãos; o 'compilado uma vez' reforça o cache de explicações por questão (P2.11).
  - **Como ativar:** Feito: checklist de manutenção (lint) da documentação na definição do gerente-contexto (.claude/agents/gerente-contexto.md), citando o gist na revisão ac46de1.
  - **Riscos:** Gist sem licença declarada: adotar a ideia sem copiar o texto; custo zero. Wiki compilado por modelo para o aluno (ex.: resumo de lei seca) só com revisão do curador, como as questões.
  - **Backlog:** D1; P2.11 (cache amortizado).

#### Design e front-end

- **[GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)** — Plugin mantido por Chrome, Edge, Firefox e MDN com cerca de 240 guias curtos de HTML, CSS e JS modernos (acessibilidade, movimento, formulários, diálogos, PWA), consultados sob demanda. _★ 25.438 · Apache-2.0 · avaliado em 2026-11-23; faixa: designer, frontend, mobile._
  - **Uso no LevelUp:** Dá a correção com recurso nativo para a auditoria das telas de estudo: movimento reduzido (hoje não há nenhuma regra prefers-reduced-motion em src/; o timer do Quiz pulsa e a alternativa errada sacode), anúncio acessível de erro e progresso no Quiz e no Simulado, diálogo de entrega do simulado, campos obrigatórios na Discursiva e no Auth, e a instalação do PWA em /instalar.
  - **Gatilho:** Reavaliar se a CLI passar a pedir chave, coletar telemetria ou mudar de licença.
  - **Como ativar:** Feito: copiados só os guias (14 categorias, 202 arquivos) do commit 2b4aa13 para .claude/skills/guias-web-modernos/guides/, com LICENSE, ORIGEM.md e SKILL.md própria que consulta os guias com Grep e Read. Não instalar o plugin nem liberar npx.
  - **Riscos:** Revisão de segurança: o plugin foi reprovado como está (a SKILL.md original roda npx -y modern-web-guidance@latest a cada consulta, sem versão fixa, se declara obrigatória em toda tarefa, pede pré-autorização de rede e sugere editar CLAUDE.md); a cópia dos guias foi aprovada. Guias em inglês e para HTML puro (adaptar a React/shadcn).
  - **Backlog:** Complementa o item 19 (auditoria de UI) e prepara o P2.12 pela instalação do PWA.
- **[heydamir/unslop](https://github.com/heydamir/unslop)** — Skill de redesenho anti-slop: audita a tela contra sinais de interface com cara de IA (gradientes, brilhos, emoji, pulsos, copy exclamativa), propõe uma direção e espera o de acordo antes de editar. _★ 20.708 · CC-BY-4.0 · avaliado em 2026-11-23; faixa: designer._
  - **Uso no LevelUp:** Rodar só a auditoria e o modo polimento em Quiz, Result e SimuladoOficial, que têm os sinais que ela procura (Card glass, shadow-glow-accent, gradient-accent, animate-sparkle, animate-pulse no timer; 29 arquivos com bg-gradient). As regras de copy batem com rules/common/writing.md.
  - **Gatilho:** Promover para agora se o piloto no Quiz render ao menos 5 achados acionáveis que o Impeccable (item 19) não apontou, sem propostas que baixem o alvo de toque de 44 px ou troquem fonte e paleta; senão, descartar.
  - **Como ativar:** Feito (piloto aprovado pelo dono em 2026-11-23): SKILL.md e references/*.md do commit 620163e copiados para .claude/skills/unslop/, com LICENSE e ORIGEM.md (crédito a Damir Sokolovsky). Adaptações: só por /unslop, só auditoria e polimento, sem scripts e sem geração de imagem, linhas 105 e 122 corrigidas. Próximo passo: designer roda /unslop no Quiz e registra os achados contra o critério do gatilho.
  - **Riscos:** CC-BY-4.0 exige atribuição em cópias e adaptações. Pensada para desktop (alvos de 32 a 36 px), não trata movimento reduzido e tende a propor fonte e paleta novas ou cortar celebrações da gamificação. Os scripts usam Playwright, ffmpeg e rede; a etapa de visuais envia a descrição do produto a geradores de imagem pagos. Revisão de segurança: aprovado com essas condições.
  - **Backlog:** Alternativa ao Impeccable do item 19: pilotar os dois no Quiz e ficar com o que der achados mais acionáveis.

#### Segurança

- **[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)** — Skill de auditoria de segurança em 6 fases, com subagentes isolados, refutação independente e achados validados por esquema. _★ 77.445 · MIT · avaliado em 2026-11-23; faixa: security-reviewer._
  - **Uso no LevelUp:** Já é o método do security-reviewer. Instalar a skill fixada (parte B) para auditorias completas de RLS, Edge Functions, IA e pagamentos. Origem oficial, MIT, só texto e validadores que apenas leem. Reforça a proteção de quem estuda.
  - **Como ativar:** Feito: skills/security-audit/ do commit c1c8a8c copiado à mão para .claude/skills/security-audit/ (sem os testes .cjs), com LICENSE e ORIGEM.md; sem npx skills add. Uso: /security-audit; auditoria completa só a pedido do dono, com saída fora do repositório.
  - **Riscos:** O modo completo custa caro (muitos subagentes) e grava a saída em ~/ por padrão; o instalador sugerido no README (npx skills add) não fixa revisão. Revisão de segurança: aprovado com condições (sem hooks, MCP nem scripts de instalação; validadores só leem).

<!-- radar:fim -->
