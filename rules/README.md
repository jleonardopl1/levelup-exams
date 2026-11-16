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
  stack/                  por tecnologia/área
    typescript-react.md
    deno-edge-functions.md
    sql-rls.md
    content-questions.md  qualidade de itens e estilo das bancas
    mobile.md             PWA, Capacitor, lojas
```

**Precedência:** `rules/stack/` > `rules/common/`; em conflito, o `CLAUDE.md` vence.
Regra nova nasce de uma armadilha repetida em `AGENTS-COLLAB.md` — documente o porquê.
