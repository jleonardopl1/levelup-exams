# Elenco de agentes — LevelUp Exams

Subagentes especializados (metodologia **AGENTS-COLLAB**, `docs/colaboracao/metodologia.md`).
Cada um tem uma **faixa** clara para evitar sobreposição — a principal causa de falha em sistemas
multiagente é de desenho (papéis ambíguos, verificação fraca), não do modelo (Cemri et al.,
"Why Do Multi-Agent LLM Systems Fail?", NeurIPS 2025).

## Mapa de faixas

| Agente | Aciona quando... | Edita? |
| --- | --- | --- |
| `coordenador` | a tarefa cruza várias áreas, é ambígua ou precisa ser sequenciada | ❌ planeja |
| `gerente-contexto` | encerrar sessão, escrever handoff, compactar/promover o estado vivo | ✍️ docs de estado |
| `arquiteto-dados` | desenhar schema, RLS, índices, consultas pesadas | ❌ spec |
| `supabase-db` | implementar migration/RPC/política/pg_cron e gerar tipos | ✅ |
| `edge-functions` | Edge Functions Deno: auth, CORS, rate limit, webhooks, deploy | ✅ |
| `engenheiro-ia` | camada `_shared/ai`, pipelines multiagente, prompts, avaliações, custo | ✅ |
| `curador-conteudo` | questões, trilhas, ementas, qualidade de itens, reportes | ✅ `content/` |
| `cientista-aprendizagem` | revisão espaçada, domínio, TRI, metas, gamificação ética | ❌ spec |
| `frontend` | páginas, hooks, React Query, rotas, desempenho do app | ✅ |
| `mobile` | PWA, Capacitor, lojas, push, offline, deep links | ✅ |
| `designer` | design system, acessibilidade, microcopy, fluxos | ✅ visual |
| `pagamentos` | Stripe, planos, Passe Concurso, afiliados, compras nas lojas | ✅ |
| `tester` | estratégia e escrita de testes, harness | ✅ testes |
| `reviewer` | portão de qualidade antes do PR | ❌ reporta |
| `code-reviewer` | revisão de um diff/PR | ❌ reporta |
| `security-reviewer` | segurança (web, LLM, mobile) e privacidade (LGPD, ECA Digital) | ❌ reporta |
| `documentation-writer` | README, docs/, CHANGELOG, CLAUDE.md | ✍️ só docs |

Utilitário fora das faixas: `Explore` (`explore.md`) substitui o Explore embutido para buscas
amplas só de leitura em Haiku.

## Modelo e esforço por faixa

Cada agente fixa `model`, `effort` e `tools` no frontmatter. O critério é quanto custa um erro que
passe despercebido, não a importância da faixa.

| Modelo | Quando | Agentes |
| --- | --- | --- |
| `haiku` | execução mecânica e busca ampla, com resultado conferível por comando | `reviewer`, `Explore` |
| `sonnet` | implementar ou revisar dentro de uma faixa com spec clara (a maioria) | os demais |
| `opus` | julgamento caro de errar e difícil de conferir depois | `arquiteto-dados`, `security-reviewer` |

O `effort` controla o raciocínio e, com ele, os tokens de pensamento:
- `high`: auth, dinheiro, banco, pipeline de IA e planos entre faixas (`coordenador`, `code-reviewer`,
  `engenheiro-ia`, `pagamentos`, `supabase-db`, `edge-functions` e os dois em Opus).
- `medium`: faixas de produto (`frontend`, `mobile`, `designer`, `tester`, `curador-conteudo`,
  `cientista-aprendizagem`).
- `low`: estado vivo e documentação (`gerente-contexto`, `documentation-writer`).
- Os agentes em Haiku usam o padrão do modelo.

Gerar em Sonnet e auditar em Opus (`security-reviewer`) também atende a verificação independente de
`rules/common/ai-agents.md`: quem confere não é quem gera.

**Subir ou descer numa chamada:** o parâmetro `model` da ferramenta Agent vence o frontmatter.
- Suba para `opus` quando um bug resistiu a duas tentativas, quando RLS, auth ou cobrança mudam sem
  spec, quando um gabarito é contestado, ao desenhar um pipeline novo e quando os revisores divergem.
- Desça para `haiku` em trabalho mecânico já especificado: aplicar o mesmo padrão em vários
  arquivos, gerar seed a partir de JSON, rodar a suíte e resumir só as falhas.

**Padrão de segurança:** `.claude/settings.json` define `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`. Subagente
sem `model` (o `general-purpose`, o `Plan` e agentes de plugin) roda em Sonnet, não no modelo da sessão.

**Ferramentas:** todo agente lista `tools`. Sem a lista, o subagente herda todas as ferramentas da
sessão, inclusive as centenas de ferramentas MCP e de skills da conta, e paga por elas em tokens a
cada chamada. Nenhum agente tem `Agent`, para que um subagente não abra outro. Se uma faixa precisar
de um MCP, acrescente só o dela (ex.: `mcp__Figma__*` no `designer`).

## Economia de tokens na delegação

1. Não delegue o que 1 a 3 buscas diretas resolvem. Cada subagente começa do zero, relê o
   `CLAUDE.md` e redescobre o código.
2. Mande no pedido o que você já levantou: arquivos, trechos, decisões e a seção do
   `AGENTS-COLLAB.md` que importa. O subagente lê o resto só se precisar.
3. Peça saída curta: conclusão, `arquivo:linha` e o que foi verificado, sem colar arquivos inteiros.
4. Para continuar um trabalho, mande `SendMessage` ao mesmo agente em vez de criar outro.
5. Paralelize só o que é independente e evite cadeias de agente chamando agente.
6. Em suítes de teste, traga só as falhas e o placar final (`| tail -n 40`).
7. Plugins da conta fora do domínio do LevelUp ficam desligados em `.claude/settings.json` (D17).
   Só religue um (apagando a linha `false`) se a tarefa precisar dele.

## Como acionar

- **Manual:** "use o agente `curador-conteudo` para ..." ou a ferramenta Agent/Task com
  `subagent_type` igual ao `name` do agente.
- **Automático:** o orquestrador lê o `description` de cada agente; por isso todos começam com
  "Use este agente quando/para ...".

## Contrato de delegação (padrão orquestrador–trabalhadores)

Toda delegação diz: **objetivo**, **formato de saída**, **fontes/ferramentas** permitidas,
**limites** (o que não fazer, quando parar) e o **critério de pronto** verificável (o comando ou
teste que prova). Toda entrega termina com o que foi verificado e o que não foi, com o risco
(`rules/common/coding-style.md`, "Mudança mínima e cirúrgica"). Trabalhos independentes rodam em paralelo; o
`coordenador` junta os resultados. Sem isso, subagentes duplicam trabalho ou deixam lacunas.

## Revisão em três faixas (de propósito)

- `reviewer` = saúde do projeto (passa typecheck/lint/build/testes? respeita convenções?).
- `code-reviewer` = qualidade do diff (bug, duplicação, complexidade desnecessária).
- `security-reviewer` = risco de segurança e privacidade — obrigatório em auth, pagamentos, RLS e IA.
