## O que muda

<!-- Uma ou duas frases: o problema e a solução. -->

## Faixa(s) e agentes envolvidos

<!-- Ex.: engenheiro-ia + supabase-db; revisado por code-reviewer e security-reviewer. Ver .claude/agents/README.md -->

## Como foi testado

- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:edge` (se tocou em `supabase/functions/`)
- [ ] Teste manual descrito abaixo (tela, fluxo, resultado)

## Checklist (rules/)

- [ ] PT-BR natural na interface e nos textos ao aluno
- [ ] Sem segredo no código; `.env` e `.lovable/` intactos; `types.ts` não editado à mão
- [ ] Toda tabela nova com RLS; RPC `SECURITY DEFINER` com `search_path` fixo e `EXECUTE` revogado de `PUBLIC`/`anon`
- [ ] Entrada validada na fronteira; erro não vaza detalhe interno
- [ ] IA: saída validada por esquema, conteúdo do usuário cercado (`fenceUntrusted`), prompt versionado, custo estimado
- [ ] Dados de aluno: base legal LGPD e regras do ECA Digital consideradas (menores de 18)
- [ ] Migration idempotente e tolerante à ordem de publicação (função antes/depois da migration)
- [ ] CHANGELOG e `AGENTS-COLLAB.md` (handoff) atualizados quando relevante

## Riscos e implantação

<!-- Precisa aplicar migration? Configurar secret? Ordem de publicação? Como desfazer? -->
