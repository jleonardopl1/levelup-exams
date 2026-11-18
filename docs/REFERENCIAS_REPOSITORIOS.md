# Repositórios de referência — o que o LevelUp aproveitou

Investigação de 32 repositórios públicos indicados pelo dono em 2026-11-17. Cada um foi clonado e
lido (README, código e documentação relevantes); o critério de escolha foi a estrela-guia:
**ajuda o candidato a ser aprovado, protege quem estuda, ou torna o trabalho dos agentes mais
seguro?** Quando a resposta foi sim e coube no stack (Vite + React + Supabase), virou código
com teste nesta entrega. O resto ficou no backlog ou foi descartado com o motivo.

Legenda: ✅ incorporado nesta entrega · 🗂️ backlog (`AGENTS-COLLAB.md`) · ➖ descartado (motivo).

## 1. Aprendizagem e produto

| Repositório | O que é | O que o LevelUp fez |
| --- | --- | --- |
| [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) | Tutor com IA: trilhas de domínio, revisão espaçada, memória auditável, leitura em voz | ✅ **Domínio por tópico** com a política do DeepTutor (`learning/mastery.py`: peso por recência nas 5 últimas respostas + teto de confiança 50%/80% com 1/2 respostas) em `src/lib/mastery.ts`, mais o limiar de "mesma sessão" (6 h) do agendador deles para não contar a mesma questão repetida logo após a explicação. Painel "Domínio por tópico" na trilha. 🗂️ Agendador de revisão por estabilidade/recuperabilidade (`learning/scheduler.py`, curva exponencial com dificuldade por item e predefinição "Exam Cramming") como evolução do Leitner atual — especificação em §4. |
| [mattpocock/skills](https://github.com/mattpocock/skills) | Skills de engenharia e de ensino (`teach`, `grilling`, `diagnosing-bugs`, `git-guardrails`) | ✅ **Modo socrático do Mentor** (prática de recuperação, dica em degraus, uma pergunta por vez — `teach` e `grilling`) em `supabase/functions/ai-mentor/prompt.ts`. ✅ **Guardrails** a partir do `git-guardrails-claude-code` (§3). ✅ Laço de feedback do `diagnosing-bugs` na definição do agente `tester`. A regra do `teach` para quiz ("alternativas do mesmo tamanho, sem pista de formato") reforçou o portão de qualidade (§2). |
| [debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | Estúdio de voz local (TTS, clonagem, transcrição) | ✅ **Ouvir questão e explicação** (`src/lib/speech.ts`, `useSpeech`, botão no quiz) com a síntese de voz do próprio navegador: zero custo de servidor, funciona no app instalado, ajuda baixa visão e dislexia. Expande "art.", "§", "nº", "LC", "8.112/1990" antes de ler. ➖ Modelos de voz próprios (custo e peso; o navegador resolve o caso de uso). |
| [nilbuild/developer-roadmap](https://github.com/nilbuild/developer-roadmap) (roadmap.sh) | Roteiros por tópico com status de progresso | ✅ **Edital verticalizado**: o conteúdo programático vira itens com "Teoria" e "Revisão" marcáveis (`src/lib/edital.ts`), a técnica clássica do concurseiro. Salvo no aparelho. 🗂️ Sincronizar entre aparelhos (tabela com RLS) e links de "lei seca" por item. |
| [jwasham/coding-interview-university](https://github.com/jwasham/coding-interview-university) | Plano de estudos autodidata | ✅ Princípio "acerte várias vezes antes de marcar como sabido" — é o teto de confiança do domínio. ➖ Conteúdo (é de computação). |
| [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) | Guia de arquitetura + baralhos Anki | 🗂️ Exportar o caderno de erros para o Anki (precisa de RPC que devolva só questões já respondidas, com gabarito). Arquitetura: o Supabase já cobre a escala atual. |
| [freeCodeCamp/freeCodeCamp](https://github.com/freeCodeCamp/freeCodeCamp) | Currículo, desafios e ambiente de prova | Comparado com o Simulado Oficial: eles também geram a prova no servidor, escondem `isCorrect`, embaralham e têm prazo de nova tentativa — o LevelUp já faz o mesmo. 🗂️ "Conjunto de questões com texto-base comum" (`questionSets` com `context`), muito usado em Português de concurso. |
| [practical-tutorials/project-based-learning](https://github.com/practical-tutorials/project-based-learning) · [codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x) | Aprender fazendo (projetos guiados) | ➖ Público e formato diferentes (programação). O princípio "prática ativa > leitura" já está no produto (questões, discursiva). |
| [EbookFoundation/free-programming-books](https://github.com/EbookFoundation/free-programming-books) | Livros gratuitos | ➖ Só programação; para concursos, a fonte confiável é a lei seca e o edital. |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | HTML → vídeo para agentes | 🗂️ Vídeo curto de resultado/conquista para compartilhar (marketing). Fora do núcleo de estudo. |
| [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui) | Protocolo de eventos agente ↔ interface | 🗂️ Quando o Mentor ganhar ferramentas (P2.11), trocar o repasse cru do SSE da OpenAI por eventos tipados (`RUN_STARTED`, `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `RUN_ERROR`, `RUN_FINISHED`): hoje um erro no meio da resposta só corta o texto. Cliente precisa aceitar os dois formatos durante a transição (ordem de publicação). |
| [openclaw/openclaw](https://github.com/openclaw/openclaw) | Assistente pessoal em WhatsApp/Telegram etc. | 🗂️ "Questão do dia" por Telegram/WhatsApp (P3), só com consentimento e sem menores sem supervisão (ECA Digital, D6). |

## 2. IA de produto e qualidade de conteúdo

| Repositório | O que é | O que o LevelUp fez |
| --- | --- | --- |
| [blader/humanizer](https://github.com/blader/humanizer) | Skill que tira os 26 padrões de "texto com cara de IA" | ✅ `rules/common/writing.md` (os padrões em português, com exemplos do app). ✅ Regras de escrita no prompt do Mentor, incluindo **texto simples sem Markdown** — o app mostra a resposta como texto puro e `**`/`#` apareciam crus. |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) · [pbakaus/impeccable](https://github.com/pbakaus/impeccable) · [nateherkai/scroll-craft](https://github.com/nateherkai/scroll-craft) | Skills de design "anti-slop" (portões em níveis, 62 regras determinísticas, revisão em navegador) | 🗂️ Rodar `critique`/`audit` do Impeccable nas telas de estudo (quiz, resultado, trilha) com o `designer`. ➖ Páginas de rolagem cinematográfica (scroll-craft): o LevelUp é app de estudo, não landing. |
| Literatura de elaboração de itens (Haladyna) + `teach` | Falhas clássicas de questões | ✅ Portão determinístico (`generate-track-questions/quality.ts`): **termos absolutos só nos distratores** reprovam (no banco autoral só 8 de 1.091 questões têm o padrão — baixo falso positivo) e o **comando negativo** é normalizado em caixa alta ("INCORRETA", "EXCETO", "que NÃO"). Prompt do Elaborador atualizado (`elaborador@2026-11-17`). |
| [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Plugins por função (suporte, produto, dados, design...) | Instaláveis como plugins do Claude Code. 🗂️ `customer-support` para a fila de reportes; `data` para o painel de `ai_runs` (P1.6). |
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | Harness de agentes "tudo é plugin" | ➖ Prévia de desenvolvedor, sem auditoria de segurança (o próprio `SAFETY.md` avisa). Ideia registrada: pipeline de ferramentas com etapas explícitas — o LevelUp já faz isso em `_shared/ai/llm.ts`. |
| [n8n-io/n8n](https://github.com/n8n-io/n8n) | Automação de fluxos com IA | ➖ Ferramenta a mais para operar (licença "fair-code"). Os fluxos do LevelUp são código testado em Edge Functions. 🗂️ "Fluxo de erro" (alerta quando uma execução falha) entra na observabilidade (P1.8). |

## 3. Processo, segurança e governança dos agentes

| Repositório | O que é | O que o LevelUp fez |
| --- | --- | --- |
| [mattpocock/skills](https://github.com/mattpocock/skills) `git-guardrails` · [affaan-m/ECC](https://github.com/affaan-m/ECC) hooks | Hooks que bloqueiam comandos perigosos antes de rodar | ✅ `.claude/hooks/guardrails.mjs` (PreToolUse, Node, sem dependência): bloqueia force-push, push/commit na main, `reset --hard`, `clean -f`, `branch -D`, `--no-verify`, reescrita de histórico, `supabase db push`/`functions deploy`/`secrets set` e edição de `.env`, `.lovable/`, `types.ts`, `auth-email-hook`. Entende aspas, heredoc e `bash -c`. 17 testes. |
| [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | Auditoria em 6 fases com validação adversarial | ✅ Método no agente `security-reviewer`: reconhecimento → caça por cobertura → refutação independente → veredicto `confirmado`/`precisa_validar`/`rejeitado`; classes de ataque de IA (envenenamento de memória em `ai_lessons`, injeção indireta pelo Radar, saída do modelo em sink, ação sem vínculo de intenção). Regra nova em `rules/common/ai-agents.md`. |
| [elementalsouls/Claude-BugHunter](https://github.com/elementalsouls/Claude-BugHunter) | Skills de bug bounty e red team | ✅ Só a disciplina do "portão de 7 perguntas" (matar achado fraco antes de reportar), somada à validação da Cloudflare. ➖ Técnicas ofensivas contra alvos externos: fora do escopo. |
| [obra/superpowers](https://github.com/obra/superpowers) | Skills de TDD, depuração e "verificar antes de concluir" | ✅ "Verifique o verificador": descobrimos que `bun run typecheck` rodava `tsc` no tsconfig raiz (`"files": []`) e **não checava nada** — escondia 5 erros em `useRadar.ts`. Script corrigido e erros resolvidos. |
| [backnotprop/plannotator](https://github.com/backnotprop/plannotator) | Revisão visual de planos e diffs dos agentes | 🗂️ Útil ao dono para anotar planos do `coordenador`; é ferramenta local do dono, não muda o repositório. |
| [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | Navegador para agentes (árvore de acessibilidade) | 🗂️ Testes ponta a ponta dos fluxos que pagam as contas (login, simulado, checkout) — o ambiente de nuvem já tem Playwright. |
| [morluto/rea](https://github.com/morluto/rea) | Engenharia reversa de apps por MCP | ➖ Analisar binários de concorrentes não ajuda o candidato e tem risco jurídico. |
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | Auditoria de SEO e busca por IA | ✅ `src/lib/seo.ts` + `useSeo`: título, descrição, canônica, Open Graph e **JSON-LD** (FAQPage, Organization, WebApplication) nas páginas públicas (`/sobre`, `/faq`, `/upgrade`, `/instalar`); sitemap com as páginas que faltavam; `robots.txt` corrigido (os grupos por robô ignoravam o `*`) e telas internas fora do rastreio. 🗂️ Decisão do dono: abrir o Radar (`/radar/:slug`) sem login como página de entrada por concurso. |

## 4. Catálogos e listas

| Repositório | Uso |
| --- | --- |
| [public-apis/public-apis](https://github.com/public-apis/public-apis) | Fontes brasileiras úteis: **IBGE** (municípios por UF, para as áreas do Radar), **BrasilAPI** (feriados, para o plano de estudo), **Dados Abertos da Câmara** (legislação). 🗂️ Fora da lista mas do mesmo tipo: **Querido Diário** (Open Knowledge Brasil), busca em diários oficiais municipais — candidata a fonte do Radar para órgãos cujo site é montado por JavaScript (armadilha registrada). Não testado aqui: o proxy desta sessão recusou o host. |
| [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) | Seção "Learning and Courses" (Moodle, Canvas, Open edX, QST): referência para o B2B (P3, cursinhos). ➖ Nenhum substitui o produto. |
| [sindresorhus/awesome](https://github.com/sindresorhus/awesome) · [vinta/awesome-python](https://github.com/vinta/awesome-python) | Índices; nada específico para o stack TypeScript/Deno. ➖ |

## Especificação pendente: revisão por estabilidade (para o `cientista-aprendizagem`)

O Leitner atual (1/3/7/14/30 dias, comprimido até a prova) funciona. A evolução proposta, do
DeepTutor (`learning/scheduler.py`), guarda por usuário×questão `stability` (dias), `difficulty`
(0,05–0,95) e `last_review_at`:

- recuperabilidade `R = exp(-dias_desde_a_revisão / stability)`; próxima revisão quando `R` cai
  ao alvo (0,9; 0,95 no modo "reta final");
- acerto: `stability *= 1 + força × (1,35 − 0,6·dificuldade) × (1 + 1,5·(1 − R)) × (1 + 0,15·espaçamento)`;
- erro: `stability *= (0,55 − 0,25·R) × (1 − 0,25·dificuldade)`; dificuldade sobe mais quando o
  erro surpreende (`R` alto);
- repetição na mesma sessão (< 6 h) não multiplica a estabilidade;
- fila ordenada por **risco de esquecer** (1 − R, + atraso, + lapsos), não só pela data.

Implementação: `supabase-db` (colunas novas com padrão, `_schedule_review` reescrita de forma
idempotente, Leitner como fallback), testada no PGlite; aplicar no remoto só com o dono (D4).
