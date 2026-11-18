# Estilo de código — regras comuns

- **Legível > esperto.** Funções pequenas com um propósito; nomes que dizem o que fazem.
- **Lógica pura separada de efeitos** (rede, banco, relógio, aleatório): a parte pura é testável
  sem mocks (ex.: `quality.ts` vs. `pipeline.ts` vs. `index.ts` na fábrica de questões).
- **Dependências injetáveis** onde houver efeito (fetch, now, sleep) para testar sem rede.
- **Validação na fronteira:** todo dado externo (corpo HTTP, saída de modelo, JSON de conteúdo)
  passa por um validador antes de virar tipo do domínio. Nada de `as Tipo` em dado não validado.
- **Imutabilidade por padrão:** crie objetos novos em vez de mutar parâmetros.
- **Erros:** falhe fechado; nunca engula erro sem registrar; mensagem ao usuário em PT-BR e sem detalhe interno.
- **Comentários** explicam o *porquê* (regra de negócio, armadilha), não o *quê*.
- **TypeScript estrito;** `any` só com `eslint-disable` justificado na linha (clientes Supabase sem tipos no Deno).
- **Sem abstração especulativa:** extraia quando houver o segundo uso real.
- Textos ao aluno em **PT-BR** com acentuação correta.
