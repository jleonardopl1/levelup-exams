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
