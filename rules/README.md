# rules/ — regras "sempre-seguir"

O **quê** todo agente e toda pessoa seguem. Os agentes em `.claude/agents/` são o **quem/como**.

```
rules/
  common/                 vale para tudo
    coding-style.md
    git-workflow.md
    security.md           checklist pré-commit, defesa de prompt, incidente
    privacy.md            LGPD + ECA Digital (alunos menores)
    testing.md            pirâmide, portão de qualidade
    ai-agents.md          como construir e operar IA de produto
    writing.md            texto para o aluno (app e IA) sem "cara de IA"
  stack/                  por tecnologia/área
    typescript-react.md
    deno-edge-functions.md
    sql-rls.md
    content-questions.md  qualidade de itens e estilo das bancas
    mobile.md             PWA, Capacitor, lojas
```

**Aplicação automática:** as convenções que não podem falhar (force-push, main, banco remoto,
arquivos do Lovable) também estão em código no hook `.claude/hooks/guardrails.mjs`.

**Precedência:** `rules/stack/` > `rules/common/`; em conflito, o `CLAUDE.md` vence.
Regra nova nasce de uma armadilha repetida em `AGENTS-COLLAB.md` — documente o porquê.
