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

## Mudança mínima e cirúrgica

<!-- Origem: princípios de multica-ai/andrej-karpathy-skills@2c60614 e DietrichGebert/ponytail@ebd8654,
reescritos para o LevelUp (radar de repositórios, docs/RADAR_REPOSITORIOS.md). -->

- **Diga o que entendeu antes de codar:** suposições, leituras possíveis do pedido e o critério de
  pronto (o comando ou teste que prova). Se a dúvida muda o resultado, pergunte antes.
- **Escada antes de escrever código:** precisa existir? → já existe no repositório (`_shared/`,
  `src/lib`, hooks)? → a plataforma resolve (Web API, Postgres, Supabase, Deno std)? → uma
  dependência já instalada resolve? → só então o mínimo que funciona, com teste se tiver lógica.
  Nada de dependência nova por poucas linhas.
- **Só o que foi pedido:** nenhuma funcionalidade, opção ou configuração a mais.
- **Cirúrgico:** toda linha alterada se liga ao pedido. Não reformate, renomeie nem refatore o
  código vizinho; código morto alheio é apontado, não apagado. Remova só o que a sua mudança deixou órfão.
- **Atalho declarado:** limite conhecido vira comentário `atalho: <limite>, <quando trocar>`
  (ex.: o teto de 1.000 respostas lidas no domínio por tópico).
- **Nunca cortar:** validação na fronteira, tratamento de erro que evita perda de dados,
  segurança, privacidade e acessibilidade. Código movido ou fundido mantém a validação e o
  tratamento de erro que tinha. "Falhe fechado" continua valendo, inclusive no caso "impossível".
- **Entrega:** termine com o que foi verificado (comando → resultado) e o que não foi, com o risco.
