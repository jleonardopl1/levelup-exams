# MCP de pagamentos, repositório e observabilidade

O primeiro uso proposto é ler a situação dos PRs e da CI pelo GitHub. Para a conciliação de Plus e Passe, o Stripe MCP pode ajudar a investigar divergências em homologação. Sentry e Langfuse respondem a perguntas diferentes sobre o Mentor. O primeiro ajuda a localizar falhas de execução. O segundo permite comparar qualidade, latência e custo de chamadas de IA. A sequência de produto e seus critérios de aceite estão no [plano de integração operacional](../../../docs/INTEGRACAO_OPERACIONAL.md).

| Fonte | Resultado no laboratório | O que falta para usar no LevelUp |
| --- | --- | --- |
| Stripe | Documentação e licença verificadas. O fornecedor aposentou o servidor npm. | Conta de teste, OAuth e acesso de leitura aos recursos de teste. |
| GitHub | Binário oficial 2.2.0 instalado. Versão, ajuda e opções de leitura descobertas localmente. | Cliente MCP e autorização restrita ao repositório e aos recursos escolhidos. |
| Sentry | CLI atual e distribuição legada 0.50.0 instaladas. Versão e ajuda do MCP verificadas. | Projeto de homologação e credencial compatível com as consultas selecionadas. |
| Langfuse | Rota HTTP, autenticação e licenças inspecionadas no código. | Instância ativa e par de chaves do projeto escolhido. |

As verificações dos executáveis usaram Linux x86-64, Node 24.22.1, ambiente sem credenciais e criação de sockets bloqueada. Só a obtenção de documentos e distribuições públicas usou rede. Cada procedimento abaixo usa `laboratorio` como caminho absoluto de uma pasta de testes fora do checkout.

## Stripe

O repositório `stripe/ai` reúne plugins, instruções e benchmarks sob licença MIT. Na revisão `72e7e79e08e245063e87d61f60340e55e54c68f4`, a Stripe declara encerradas as atualizações de `@stripe/mcp`, `@stripe/agent-toolkit` e `stripe-agent-toolkit`, inclusive as correções de segurança. A opção mantida é o endpoint `https://mcp.stripe.com`, com OAuth. O laboratório verificou o README e a licença, sem instalar os pacotes descontinuados. [README fixado](https://github.com/stripe/ai/blob/72e7e79e08e245063e87d61f60340e55e54c68f4/README.md) · [Licença MIT](https://github.com/stripe/ai/blob/72e7e79e08e245063e87d61f60340e55e54c68f4/LICENSE) · [Conexão oficial](https://docs.stripe.com/mcp)

Para Plus e Passe, Financeiro e Engenharia podem confrontar uma cobrança de teste com o pedido e o registro de acesso. A decisão de liberar acesso continua no fluxo de confirmação e conciliação do produto. Antes de autorizar o cliente, conferir no consentimento o ambiente de teste e o alcance da leitura. A operação de uma conta permanece pendente de homologação.

```bash
mkdir -p "$laboratorio/mcp-stripe"
curl -fsSL https://raw.githubusercontent.com/stripe/ai/72e7e79e08e245063e87d61f60340e55e54c68f4/README.md -o "$laboratorio/mcp-stripe/README.md"
rg -n 'deprecated|mcp\.stripe\.com' "$laboratorio/mcp-stripe/README.md"
```

## GitHub

O projeto oficial oferece um servidor hospedado em `https://api.githubcopilot.com/mcp/` e um executável local com transporte `stdio`. A distribuição Linux x86-64 2.2.0 informou o commit `67d4dc489700ec955ad255d098396dd86c729523`. A ajuda listou `--read-only`, `--toolsets` e os grupos `repos`, `pull_requests` e `actions`. A licença é MIT. [README da versão](https://github.com/github/github-mcp-server/blob/67d4dc489700ec955ad255d098396dd86c729523/README.md) · [Licença](https://github.com/github/github-mcp-server/blob/67d4dc489700ec955ad255d098396dd86c729523/LICENSE) · [Distribuição e hashes](https://github.com/github/github-mcp-server/releases/tag/v2.2.0)

Para o gerente de contexto, o caso inicial é localizar o PR que descreveu uma implantação, ler o resultado da CI e registrar qual evidência de produção ainda falta. O modo de leitura limita as ações expostas. O acesso ao repositório depende da autorização no GitHub. Para um piloto com token de acesso pessoal, selecionar apenas o repositório LevelUp Exams e permissões de leitura necessárias. A documentação também prevê OAuth. A descoberta local de escopos confirmou o modo de leitura e listou, entre outras, as ferramentas `get_job_logs`, `pull_request_read` e `get_commit`, sem login.

```bash
mkdir -p "$laboratorio/mcp-github/bin"
cd "$laboratorio/mcp-github"
curl -fLsS https://github.com/github/github-mcp-server/releases/download/v2.2.0/github-mcp-server_Linux_x86_64.tar.gz -o servidor.tar.gz
printf '%s  %s\n' 157c5664b273e5070126d414f88cbab765630acde588f75dafdf9998c2235c51 servidor.tar.gz | sha256sum -c -
tar -xzf servidor.tar.gz -C bin github-mcp-server
bin/github-mcp-server --version
bin/github-mcp-server stdio --help
bin/github-mcp-server list-scopes --read-only --toolsets repos,pull_requests,actions
```

## Sentry

A execução local recomendada é `sentry mcp` via `stdio`. O pacote separado `@sentry/mcp-server` continua distribuído como alternativa legada. Os dois pacotes testados são 0.50.0 e correspondem à revisão `b410e679d61d42b9ced461be199631eaf48dc7cf`. A instalação usou dois pacotes npm, em prefixo isolado e com scripts de instalação desativados. `sentry --version` informou `0.50.0` e `sentry mcp --help` listou o filtro de projeto e as capacidades `inspect`, `seer`, `docs`, `triage` e `project-management`. O executável legado informou a mesma versão e sua ajuda confirmou o transporte local. O repositório adota FSL-1.1-Apache-2.0, com conversão futura prevista nos termos da licença. [Guia fixado](https://github.com/getsentry/toolkit/blob/b410e679d61d42b9ced461be199631eaf48dc7cf/README.md) · [Pacote CLI](https://github.com/getsentry/toolkit/blob/b410e679d61d42b9ced461be199631eaf48dc7cf/packages/cli/package.json) · [Pacote MCP](https://github.com/getsentry/toolkit/blob/b410e679d61d42b9ced461be199631eaf48dc7cf/packages/mcp-server/package.json) · [Licença](https://github.com/getsentry/toolkit/blob/b410e679d61d42b9ced461be199631eaf48dc7cf/LICENSE.md)

Para Suporte e Engenharia, a primeira pergunta é qual versão introduziu um erro recorrente do Mentor ou do checkout. No piloto, restringir ao projeto de homologação e à capacidade `inspect`. O servidor local usa login do CLI ou `SENTRY_AUTH_TOKEN`. O serviço hospedado em `https://mcp.sentry.dev/mcp` oferece OAuth. Nenhum evento foi enviado e o teste de ajuda dispensa login. [Conexão e opções de escopo](https://github.com/getsentry/toolkit/blob/b410e679d61d42b9ced461be199631eaf48dc7cf/README.md)

```bash
npm install --prefix "$laboratorio/mcp-sentry" --ignore-scripts --no-audit --no-fund --save-exact sentry@0.50.0 @sentry/mcp-server@0.50.0
"$laboratorio/mcp-sentry/node_modules/.bin/sentry" --version
"$laboratorio/mcp-sentry/node_modules/.bin/sentry" mcp --help
"$laboratorio/mcp-sentry/node_modules/.bin/sentry-mcp" --version
"$laboratorio/mcp-sentry/node_modules/.bin/sentry-mcp" --help
```

## Langfuse

Na revisão `6dfeb6049b8fa2795af7bfce1cce9bbe60aca4c0`, o servidor faz parte da aplicação web. O cliente aponta para `/api/public/mcp` na região do projeto, por exemplo `https://cloud.langfuse.com/api/public/mcp` na UE, ou na instância auto-hospedada. A rota exige autenticação HTTP Basic com o par de chaves pública e secreta **do projeto**. Chaves de organização são incompatíveis. No laboratório, a leitura do guia confirmou essa rota, a descoberta dinâmica de ferramentas e a existência de operações de escrita. A distribuição principal é MIT nas partes especificadas pela licença da raiz, e as pastas de recursos empresariais seguem a licença Enterprise. [Implementação e autenticação](https://github.com/langfuse/langfuse/blob/6dfeb6049b8fa2795af7bfce1cce9bbe60aca4c0/web/src/features/mcp/README.md) · [Instalação auto-hospedada](https://github.com/langfuse/langfuse/blob/6dfeb6049b8fa2795af7bfce1cce9bbe60aca4c0/docker-compose.yml) · [Licença da raiz](https://github.com/langfuse/langfuse/blob/6dfeb6049b8fa2795af7bfce1cce9bbe60aca4c0/LICENSE) · [Licença Enterprise](https://github.com/langfuse/langfuse/blob/6dfeb6049b8fa2795af7bfce1cce9bbe60aca4c0/ee/LICENSE)

Para avaliar o Mentor, Produto e Dados podem começar com perguntas sintéticas, versões de prompt e medidas agregadas de custo e latência. Comparar o que a ferramenta acrescenta às medições existentes antes de instrumentar alunos. Uma listagem real requer instância e chaves do projeto. O cliente deve descobrir as ferramentas a cada mudança de versão e restringir quais pode chamar. O laboratório dispensou subir a pilha de banco, armazenamento, web e worker.

```bash
mkdir -p "$laboratorio/mcp-langfuse"
curl -fsSL https://raw.githubusercontent.com/langfuse/langfuse/6dfeb6049b8fa2795af7bfce1cce9bbe60aca4c0/web/src/features/mcp/README.md -o "$laboratorio/mcp-langfuse/README.md"
rg -n 'Project-scoped|Organization-level|api/public/mcp|dynamically inspect' "$laboratorio/mcp-langfuse/README.md"
```
