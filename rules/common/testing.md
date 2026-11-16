# Testes — regras comuns

## Portão de qualidade (CI e antes de todo PR)

```bash
bun run typecheck    # tsc
bun run lint         # eslint — 0 erros
bun run build        # vite
bun run test:edge    # Deno: Edge Functions (camada de IA, pipeline, rubrica)
```

A CI (`.github/workflows/ci.yml`) roda tudo isso e ainda `deno check` em todas as funções.

## O que testar
- **Lógica pura com regra de negócio:** pontuação, notas, cotas, consenso entre agentes,
  validadores, normalização — sempre.
- **Pipelines de IA:** com cliente LLM falso que passa pelo `parse` real; cubra sucesso,
  divergência, agente fora do ar, saída fora do esquema, prazo esgotado e modo degradado.
- **Migrations:** rodar 2× em Postgres descartável; conferir privilégios e políticas.
- **Bug corrigido = teste que falharia antes.**

## Como
- Determinístico: injete relógio, aleatório e fetch. Sem rede, sem modelos reais, sem segredos.
- Nomes de teste em PT-BR descrevendo o comportamento.
- Front: Vitest + Testing Library (harness a montar — backlog P1).
