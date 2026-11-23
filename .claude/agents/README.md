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
