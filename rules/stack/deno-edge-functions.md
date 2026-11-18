# Edge Functions (Deno) — regras de stack

## Estrutura
- `supabase/functions/<nome>/index.ts` só com o handler; lógica pura em módulos irmãos testáveis
  (`quality.ts`, `rubric.ts`…) com `*.test.ts` ao lado.
- Utilidades em `_shared/`: `cors.ts` (lista de origens), `utils.ts` (auth, rate limit, JSON,
  auditoria), `stripe.ts`, `ai/` (cliente LLM, telemetria, guardrails).
- `verify_jwt = false` no `config.toml` porque a autenticação é feita no código (`requireUser`…)
  — toda função nova precisa autenticar explicitamente.

## Handler
1. `serve(withCors(...))`; `OPTIONS` cedo; método errado → 405.
2. Env obrigatório ausente → 503 genérico.
3. Autenticar → rate limit → validar corpo (`readJson` com limite) → cota atômica → trabalho.
4. Respostas por `jsonResponse`; erro sem detalhe interno; auditoria só com metadados.
5. Respeite o limite de tempo da plataforma (150 s): prazo global, chamadas independentes em paralelo.

## IA dentro das funções
Use `_shared/ai/llm.ts`; ver `rules/common/ai-agents.md`.

## Verificação
```bash
bun run test:edge
DENO_NO_PACKAGE_JSON=1 deno check --no-lock supabase/functions/<nome>/index.ts
```
`auth-email-hook` (gerenciada pelo Lovable) é checada de dentro da própria pasta.
