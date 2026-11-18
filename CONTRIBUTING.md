# Contribuindo com o LevelUp Exams

Obrigado por ajudar candidatos a passarem nos concursos.

## Ordem de leitura

`AGENTS-COLLAB.md` (o agora) → `CLAUDE.md` (convenções) → `rules/` → `docs/` → código.
Trabalhando com agentes de IA? O elenco e as faixas estão em `AGENTS.md` e `.claude/agents/`.

## Ambiente

```bash
bun install
bun run dev            # http://localhost:8080
```

Testes das Edge Functions exigem Deno 2 (`bun run test:edge`).

## Antes de abrir o PR

```bash
bun run typecheck && bun run lint && bun run build && bun run test:edge
```

- Branch a partir de `main`; PR para `main`; Conventional Commits (`rules/common/git-workflow.md`).
- Preencha o template de PR — inclusive **como testou** e a **ordem de implantação**.
- Mudança de banco: migration idempotente; aplicação no remoto só com o dono.
- Mudança de IA: camada `_shared/ai`, `promptVersion` nova, testes com LLM falso.
- Não edite `.lovable/`, `.env`, `auth-email-hook` nem `src/integrations/supabase/types.ts` à mão.

## Segurança

Vulnerabilidade **não** vai em issue pública: siga `SECURITY.md`.
