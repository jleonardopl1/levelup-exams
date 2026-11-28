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
`auth-email-hook` (gerenciada pelo Lovable) é checada de dentro da própria pasta (tem `deno.json` com JSX).

## Armadilhas de ambiente
- `deno check` precisa de `DENO_NO_PACKAGE_JSON=1` (o `package.json` da raiz é do front); já está na CI e no `test:edge`.
- Sessões na nuvem podem vir sem Deno: baixe o binário de `dl.deno.land`. Com `dl.deno.land`, `deno.land` e
  `esm.sh` bloqueados, pegue o Deno no npm (`npm pack @deno/linux-x64-glibc`) e rode `deno check`/`deno test`
  com `--import-map` que troca `esm.sh/<pacote>` por `npm:<pacote>` e o std por shims locais (fora do repositório).
  `bun run test:unit` precisa de Node 22.18+.
- O pg_cron espera 150 s pela `generate-track-questions`: o pipeline tem orçamento de 140 s
  (`QUESTION_RUN_BUDGET_MS`); o árbitro só entra se sobrar ≥ 20 s e disputa não arbitrada é reprovada.
- Telemetria (`ai_runs`) e lições são best effort: sem a migration, a função segue e só avisa no log.
  Falta de linhas em `ai_runs` não prova que a IA não roda.
- `gateway 402` = saldo de IA do workspace do Lovable esgotado (Mentor, discursiva e geração param;
  o cliente `_shared/ai` não repete em 402). Recarregue o saldo de Cloud & IA.
