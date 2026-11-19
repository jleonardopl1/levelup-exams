# Reproduzir as instalações de referência

O [inventário técnico](../../docs/ANALISE_DAS_REFERENCIAS.md) cobre os 32 repositórios do catálogo do projeto. Cada ficha registra o componente escolhido, a revisão de origem, a licença observada, o teste realizado e a melhoria que o componente permitiria avaliar. Os manifestos estão em [grupos](grupos/).

## Preparar o laboratório

Execute os comandos na raiz de um checkout do LevelUp. Use um diretório novo e dedicado ao lado do checkout, com espaço para os CLIs e suas dependências. As receitas foram ensaiadas em Linux x86-64. O conjunto usa Git, Python 3.11 ou superior com `venv`, SQLite com `deserialize`, Node.js 24.16 ou superior e npm. O primeiro download consulta os repositórios e registros públicos. A versão de Node usada aqui atende às ferramentas externas e pode ser diferente daquela usada na CI do aplicativo.

```sh
python3 ops/referencias/grupos/instalar_produto.py --dest ../levelup-referencias
python3 ops/referencias/grupos/instalar-ferramentas.py --dest ../levelup-referencias
python3 ops/referencias/grupos/instalar_governanca.py --dest ../levelup-referencias
```

Para experimentar só o que uma equipe precisa, por exemplo o agendador de revisões ou o CLI de vídeo, selecione uma referência.

```sh
python3 ops/referencias/grupos/instalar_produto.py --dest ../levelup-referencias --repo HKUDS/DeepTutor
python3 ops/referencias/grupos/instalar-ferramentas.py --dest ../levelup-referencias --only hyperframes
```

Para conferir as ferramentas já instaladas, use os dois comandos abaixo. O segundo verifica os perfis, coleções e binários desse grupo. O teste opcional de navegação recebe o caminho de um Chromium local com `--chromium` e usa uma página sintética em loopback. A ficha de `agent-browser` especifica as condições do ensaio.

```sh
python3 ops/referencias/grupos/instalar-ferramentas.py --dest ../levelup-referencias --verify-only
python3 ops/referencias/grupos/instalar_governanca.py --dest ../levelup-referencias --verify-only
```

Os comandos executam os testes descritos nas fichas. O resultado de um CLI confirma as funções exercitadas. As coleções ficam disponíveis para consulta com os termos de suas fontes. A licença do `developer-roadmap` prevê uso pessoal e compartilhamento por link. Para os três projetos de exploração e engenharia reversa, a avaliação se restringiu aos metadados públicos e à revisão defensiva aplicável ao LevelUp.

## Atualizar o inventário

Depois de alterar uma revisão ou um teste, atualize a ficha de seu grupo com a evidência obtida na nova execução. Para regenerar o relatório e conferir se ele corresponde ao catálogo, use os comandos abaixo.

```sh
node ops/referencias/catalogo.mjs relatorio > docs/ANALISE_DAS_REFERENCIAS.md
node ops/referencias/catalogo.mjs validar
python3 -B -m unittest discover -s ops/referencias/grupos -p 'test_*.py'
```

## Fontes citadas no catálogo MCP anexo

O anexo descreve 16 opções de integração. Sete repositórios externos ali citados têm fichas adicionais por serviço. Cada ficha registra o artefato disponível, como repetir a verificação e o que exige uma conta de homologação. [Stripe, GitHub, Sentry e Langfuse](grupos/mcp-operacao.md) · [PostHog, OpenAlex e os servidores de referência Time e Fetch](grupos/mcp-dados.md)

| Demais opções do anexo | Uso previsto no LevelUp | Próxima verificação |
| --- | --- | --- |
| LevelUp Aluno e LevelUp Conteúdo e Radar | Propostas de servidores próprios para o Mentor. O primeiro piloto consulta revisões pendentes e desempenho do aluno. | Comparar com a consulta direta já usada no backend, medir latência e conferir identidade da sessão e separação entre alunos. [Roteiro de integração](../../docs/INTEGRACAO_OPERACIONAL.md) |
| Supabase e Resend | Serviços gerenciados para diagnóstico interno e preparação do atendimento. | Testar o projeto isolado com escopo de leitura e dados sintéticos. Um eventual teste de email requer destinatário autorizado. [Supabase](https://supabase.com/docs/guides/ai-tools/mcp) · [Resend](https://resend.com/mcp) |
| Google Drive e Docs, Calendar, Sheets e Classroom | Material didático com direitos verificados, agenda de estudo por adesão e piloto com professores. | Confirmar elegibilidade da organização e escopos do OAuth. Testar com uma turma fictícia antes de conectar dados escolares. [Servidores do Google Workspace](https://developers.google.com/workspace/guides/configure-mcp-servers) |
| Cloudflare Browser Run | Leitura de fontes oficiais do Radar que exigem JavaScript. | Medir cobertura, custo e datas de atualização com fontes permitidas. [Serviços MCP da Cloudflare](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/) |
