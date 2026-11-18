# TypeScript + React (src/) — regras de stack

- **Dados do servidor só via TanStack Query** (`src/hooks/use*.ts`): chave inclui o `user.id`;
  invalide após mutação; `staleTime` coerente com a frequência real de mudança.
- **Supabase no cliente** só com a chave publicável; o que é sensível vai por RPC (`supabase.rpc`)
  ou Edge Function (`supabase.functions.invoke`). Nunca confie em dado calculado no cliente.
- **Rotas em `React.lazy`**; dependências pesadas (recharts, geração de PDF) só nas telas que usam.
- **Erros:** `try/catch` com `unknown` e leitura defensiva de `message` (erros do Supabase podem
  ser objetos simples); toast em PT-BR; `ErrorBoundary` cobre falhas de render.
- **Formulários:** react-hook-form + zod; mesma validação replicada no servidor.
- **Planos e benefícios** só de `src/config/plans.ts`; URLs e marca de `src/config/site.ts`.
- **Acessibilidade:** componentes Radix/shadcn com rótulos; foco visível; atalhos de teclado no simulado.
- **Desempenho:** evite re-render em listas grandes (memo/virtualização no ranking e no admin);
  imagens com tamanho declarado; nada de polling agressivo (assinatura a cada 5 min).
- `src/integrations/supabase/types.ts` é gerado — não editar.
