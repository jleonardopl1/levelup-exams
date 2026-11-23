# IA de produto e sistemas multiagente — regras comuns

Base: "Building effective agents" e o sistema multiagente de pesquisa da Anthropic, o guia
prático de agentes da OpenAI, OWASP Top 10 para LLM, taxonomia de falhas MAST e os padrões do
TradingAgents/AgroDecision. Detalhes em `docs/ARQUITETURA_MULTIAGENTE.md`.

## Projeto
1. **Mais simples primeiro:** chamada única → cadeia → roteamento → paralelização →
   orquestrador–trabalhadores → avaliador–otimizador. Multiagente consome muito mais tokens;
   justifique com qualidade medida.
2. **Papéis exclusivos** com entrada e saída definidas; nada de dois agentes com a mesma responsabilidade.
3. **Verificação independente:** quem confere não é quem gera (outro modelo, outro contexto,
   em paralelo); verificação **cega** sempre que o problema permitir.
4. **Decisão final em código** testado quando possível; modelo mais forte só nas divergências.
5. **Limites explícitos:** número de rodadas, chamadas por papel, árbitros por execução, prazo global.
6. **Falha fechada para conteúdo** (na dúvida não publica) e **degradação explícita para
   disponibilidade** (registrada em telemetria, nunca silenciosa).

## Implementação
- Toda chamada por `_shared/ai/llm.ts` (`callTool` + `parse` + `deadline` + `promptVersion`).
- Saída estruturada por ferramenta obrigatória; valide e normalize; trate como dado não confiável.
- Conteúdo de aluno/terceiros cercado com `fenceUntrusted`; `UNTRUSTED_RULE` no prompt de sistema.
- Modelo por papel via secret (`*_MODEL`); nunca fixe nome de modelo espalhado pelo código.
- Novas tentativas só em erro temporário (429/5xx/timeout/saída inválida), com backoff e jitter.

## Memória e conteúdo vindo de alunos
- Memória que volta ao prompt (`ai_lessons`) é superfície de ataque (envenenamento de memória):
  só entra texto **normalizado, curto e cercado**, com origem registrada, contado por recorrência
  e desativável pela equipe. Reporte de aluno vira lição só depois de resolvido por humano.
- Nada de texto livre de aluno virar regra para outro aluno: o efeito de uma lição é sempre
  sobre a geração de conteúdo revisada pelo pipeline, nunca sobre dados de outra pessoa.

## Modelos, gateways e memória de terceiros
- Código do LevelUp e dado de aluno só vão a modelo por provedor com contrato ou conta do dono
  (no produto, o gateway da D2). Proibido, no produto e nas ferramentas de desenvolvimento:
  gateway "grátis e ilimitado" sem conta, pool de contas, proxy ou troca de IP para driblar cota.
- Memória automática de sessão (plugin que grava e reinjeta o que o agente fez) não entra: a
  memória entre agentes é o `AGENTS-COLLAB.md`, curta, versionada e revisada em PR.
- Plugin, skill ou agente de terceiros só entra pelo radar de repositórios
  (`docs/RADAR_REPOSITORIOS.md`): avaliação da faixa, revisão do `security-reviewer`, commit
  fixado e de acordo do dono. O `bun run test:unit` recusa o que estiver ativo sem registro.
- Plugin `mattpocock-skills` (ativo, D15): não rode `/setup-matt-pocock-skills` neste repositório
  (edita o `CLAUDE.md` e cria arquivos sem perguntar) nem a skill `wizard` (lê `.env` e grava
  segredos); `to-spec`, `to-tickets`, `triage` e `wayfinder` só publicam no GitHub com o OK do
  dono; a `research` grava em `docs/`; o handoff continua no `AGENTS-COLLAB.md`. `CLAUDE.md` e
  `rules/` valem acima de qualquer skill de plugin.

## Escrita das respostas
- Respostas ao aluno seguem `rules/common/writing.md` (texto simples, direto, sem "cara de IA").

## Operação
- Telemetria em `ai_runs`: agente, modelo, versão do prompt, tentativas, latência, tokens. **Nunca conteúdo.**
- Memória auditável (`ai_lessons`): curta, contada por recorrência, desativável pela equipe.
- Custo amortizado: gere uma vez o que serve a todos (por questão/cargo), não por aluno.
- Cotas por usuário em toda funcionalidade de IA (consumo ilimitado é risco do OWASP LLM Top 10).

## Avaliação
- Golden set por funcionalidade (questões com gabarito conhecido, redações corrigidas por humanos).
- Troca de modelo/prompt só com comparação lado a lado e nova `promptVersion`.
- Métricas de produto: taxa de reporte "gabarito errado" por mil respostas, taxa de disputa e de
  aprovação do pipeline, nota da discursiva vs. corretor humano, satisfação com o Mentor.
