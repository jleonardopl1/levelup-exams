# Metodologia de colaboração entre agentes (AGENTS-COLLAB)

Mesma metodologia adotada no AgroDecision (do mesmo dono), adaptada ao LevelUp Exams. Origem:
AGENTS-COLLAB.md (github.com/Rlealbarili/Agents-Collab.md) e organização no estilo do ECC
(github.com/affaan-m/ECC). O `AGENTS.md` segue o padrão aberto homônimo (hoje sob a Agentic AI
Foundation, Linux Foundation), lido por Claude Code, Codex, Cursor e outras ferramentas.

**Problema que resolve:** vários agentes de IA (e pessoas) trabalham no mesmo projeto em sessões
diferentes, às vezes em paralelo, e cada um chega sem saber das decisões recentes.

## Cinco princípios

1. **Vivo, não histórico.** `AGENTS-COLLAB.md` descreve o *agora*; o histórico está no Git e no CHANGELOG.
2. **Compacto.** Leitura em ≤ 3 minutos; o que cresce é promovido ou removido.
3. **Atribuído.** Toda decisão diz quem decidiu e quando.
4. **Handoff fail-closed.** Quem sai registra o que mudou, o que testou (com resultado), o que
   não testou, bloqueios e próximo passo.
5. **Promove para cima.** Decisão estável vira convenção no `CLAUDE.md` ou spec em `docs/`.

## Camadas

| Camada | Arquivo | Muda | Conteúdo |
| --- | --- | --- | --- |
| Estado vivo | `AGENTS-COLLAB.md` | a cada sessão | decisões, armadilhas, backlog, handoff |
| Convenções | `CLAUDE.md` | raramente | stack, regras, comandos, schema, IA |
| Catálogo | `AGENTS.md` | quase nunca | ponteiros + elenco + orquestração (padrão aberto) |
| Regras | `rules/` | quando um padrão se firma | o *quê* sempre seguir (comum + stack) |
| Agentes | `.claude/agents/` | quando uma faixa muda | o *quem/como* de cada especialista |
| Detalhe | `docs/` | por área | arquitetura, implantação, trilhas |

## Ciclo de uma sessão

1. **Chegada** — o hook `SessionStart` injeta `docs/colaboracao/bootstrap.md`; leia o estado vivo.
2. **Planejamento** — se cruzar áreas, `coordenador` quebra e roteia (objetivo, saída, fontes, limites).
3. **Execução** — cada faixa no seu agente; independentes em paralelo.
4. **Verificação** — `code-reviewer`, `security-reviewer` (se sensível) e `reviewer` (portão).
5. **Handoff** — `gerente-contexto` atualiza `AGENTS-COLLAB.md`; decisão estável sobe para `CLAUDE.md`.

## Por que funciona (e onde falha)

Sistemas multiagente falham mais por **desenho** — papéis mal definidos, coordenação fraca,
verificação ausente — do que por limitação do modelo (taxonomia MAST, Cemri et al., NeurIPS 2025).
As faixas exclusivas, o contrato de delegação, o portão de verificação independente e o estado
vivo atacam exatamente essas três famílias de falha.
