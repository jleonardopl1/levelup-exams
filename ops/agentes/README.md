# Agentes operacionais do LevelUp Exams

Use o ID do cargo para consultar a ficha ou preparar uma tarefa. O [catálogo](catalogo.json) reúne dez áreas e 69 especialistas. Cada ficha define missão, supervisor, cargos de origem, responsabilidades, gatilhos, entradas, entregas, indicadores, alçada e quando escalar uma decisão. As áreas respondem à direção executiva (CEO), o CEO responde ao fundador e cada especialista responde à sua área.

Na raiz do repositório, com Node.js 22 ou superior:

```sh
node ops/agentes/cli.mjs validar
node ops/agentes/cli.mjs listar
node ops/agentes/cli.mjs listar CFO
node ops/agentes/cli.mjs mostrar CFO.2
printf '%s\n' 'Caso fictício. Compare o extrato de teste de 100 com o registro de 98.' |
  node ops/agentes/cli.mjs preparar CFO.2
```

`preparar` devolve o destino nativo (`levelup-operacao:cfo-2`), o ID, o supervisor, a alçada e o texto recebido em `entrada`. Aceita até 16 KiB pela entrada padrão. O endereço do agente e suas permissões vêm do catálogo. Use material público ou sintético sem dados pessoais. O comando é local e não inicia uma sessão de IA.

## Skills dos cargos no Claude Code

Cada ficha do catálogo também é uma skill do Claude Code em [`.claude/skills/`](../../.claude/skills/). Elas aparecem em qualquer sessão aberta neste repositório, no terminal, no app ou na web. O nome de cada skill está na ficha do [organograma](../../docs/ORGANOGRAMA_OPERACIONAL.md).

- **Especialistas (69):** digite `/`, o nome da skill e a tarefa. Exemplo: `/cfo-2-rebate-comissionamento Caso fictício: compare o extrato de teste de 100 com o registro de 98.` Essas skills só rodam quando alguém as chama e por isso não ocupam o contexto das sessões de desenvolvimento.
- **Áreas (10):** também funcionam pelo `/` e podem ser escolhidas pelo próprio Claude quando o pedido é de negócio. A área lê a ficha do especialista certo e segue aquela ficha. O CEO encaminha às outras nove áreas.
- **Comando sem tarefa:** a skill usa o pedido mais recente da conversa, então dá para colar o material antes e chamar a skill depois.

Enquanto a skill está ativa, o Claude Code retira do turno comandos, gravação de arquivos, rede, conectores MCP, publicação, agendamento e subagentes (campo `disallowed-tools`). A leitura de arquivos continua disponível para consultar documentos do repositório. Na mensagem seguinte as ferramentas voltam, sob as permissões normais da sessão: é o momento de pedir para salvar o rascunho. Para uma execução isolada e sem nenhuma ferramenta, use o plugin descrito abaixo.

As skills são geradas a partir do catálogo. Não edite os arquivos à mão:

```sh
node ops/agentes/skills.mjs           # grava as 79 skills e remove as que saíram do catálogo
node ops/agentes/skills.mjs --check   # falha se alguma estiver desatualizada (roda em bun run test:unit)
node ops/agentes/documentar.mjs       # atualiza o organograma, que mostra o nome de cada skill
```

O gerador recusa texto do catálogo com `$` seguido de letra, número ou chave, porque o Claude Code trocaria esse trecho pelo argumento da skill. Também recusa `!` seguido de crase, que executaria um comando. Ele só altera ou apaga pastas que têm a marca de geração no fim do `SKILL.md`. Uma skill escrita à mão com o mesmo nome de um cargo interrompe a geração.

Os campos `argument-hint`, `disable-model-invocation` e `disallowed-tools` são do Claude Code. O envio de skills ao claude.ai aceita só `name`, `description`, `license`, `compatibility`, `metadata` e `allowed-tools`, então essas pastas não servem para upload direto.

`node --test ops/agentes/skills.test.mjs` confere nomes, frontmatter, encaminhamento, a proteção contra texto do catálogo e a limpeza. Com `LEVELUP_CLAUDE_BIN` definido, o teste também roda o Claude Code instalado contra um modelo simulado em localhost. Ele verifica que a skill recebe a tarefa, que só as descrições das áreas entram no contexto e que um comando pedido no turno é negado.

## Carregar os perfis no Claude Code

```sh
pasta_plugin="$(node ops/agentes/cli.mjs gerar)"
claude plugin validate --strict "$pasta_plugin"
claude --bare --plugin-dir "$pasta_plugin" plugin details levelup-operacao
```

O gerador monta o manifesto `.claude-plugin/plugin.json` e um Markdown nativo por perfil, em uma pasta nova de `ops/agentes/dist/` a cada execução. Esse diretório é ignorado pelo Git. Para atualizar o plugin após mudar o catálogo, execute `gerar` novamente e use o novo caminho. O inventário do host deve exibir 79 agentes. O plugin é carregado por sessão, sob o nome `levelup-operacao`. O [catálogo dos agentes de desenvolvimento](../../AGENTS.md) e o Mentor do aluno têm ciclos de execução separados.

A0 produz uma análise das informações fornecidas. A1 pode preparar um rascunho para revisão humana. As fichas usam `tools: []` e bloqueiam `mcp__*`. O plugin contém somente o manifesto e os perfis. Coordenação e escalonamento identificam o destinatário responsável, sem conceder poder de delegação, acesso ao banco, repasse, publicação ou contato com terceiros.

## Invocar um perfil em um host configurado

O exemplo usa o agente de rebate para analisar informações fictícias. A chamada ao modelo é opcional e segue as condições da conta configurada pelo operador. Geração do plugin, consulta das fichas e descoberta no host dispensam essa chamada.

```sh
pasta_plugin="$(node ops/agentes/cli.mjs gerar)"
pedido="$(printf '%s\n' 'Caso fictício. Indique as informações necessárias para conferir uma comissão.' |
  node ops/agentes/cli.mjs preparar CFO.2)"
pasta_sessao="$(mktemp -d)"
(
  cd "$pasta_sessao" || exit 1
  printf '%s\n' "$pedido" | claude --restricted --setting-sources '' \
    --plugin-dir "$pasta_plugin" --agent levelup-operacao:cfo-2 \
    --tools '' --disallowedTools 'mcp__*' --strict-mcp-config \
    --disable-slash-commands --no-session-persistence -p
)
```

A sessão começa em uma pasta vazia. A lista de ferramentas embutidas fica vazia e o host descarta os MCPs configurados por padrão. Para a invocação do perfil, use os parâmetros do exemplo. No Claude Code 2.1.327, o modo `--bare` funciona para consultar o inventário, mas o perfil de plugin não é resolvido como agente da sessão com `--agent` nesse modo.

A suíte verifica a árvore, a integridade das fichas e a separação entre o conteúdo da tarefa e a política do perfil. Execute `node --test ops/agentes/cli.test.mjs`. Para testar também a chamada pelo Claude Code instalado, informe o caminho absoluto do executável em `LEVELUP_CLAUDE_BIN`. Esse teste usa uma resposta sintética em localhost e não precisa de uma conta.

[Manifesto de plugins](https://code.claude.com/docs/en/plugins-reference) · [Subagentes e herança de ferramentas](https://code.claude.com/docs/en/sub-agents) · [Comportamento da lista vazia](https://code.claude.com/docs/en/errors#agent-would-be-spawned-with-zero-tools) · [Opções da CLI](https://code.claude.com/docs/en/cli-reference)
