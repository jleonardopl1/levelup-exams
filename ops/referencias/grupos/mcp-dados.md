# MCP para métricas, bibliografia, fusos e leitura de editais

O laboratório instalou a ponte recomendada pelo PostHog, o código do servidor do OpenAlex e os servidores de referência Time e Fetch. Os testes usaram o processo local, a interface de loopback ou respostas simuladas. Os endpoints hospedados do PostHog e do OpenAlex constam na documentação oficial. A disponibilidade, os dados e as permissões de uma conta do LevelUp continuam sem verificação.

| Componente | Uso proposto no LevelUp | Evidência local |
| --- | --- | --- |
| PostHog MCP | Produto consulta um painel agregado de simulados concluídos por semana, depois de validar o evento, a contagem e a autorização do projeto. | Pela ponte local, o cliente descobriu as três ferramentas do servidor Time e solicitou uma conversão de horário em loopback. Também verificamos os esquemas oficiais do PostHog. |
| OpenAlex MCP | Curadoria pedagógica confere DOI, título, autoria, retratação e correspondência de uma referência sugerida para uma explicação. A banca ou o órgão continua sendo a fonte para edital e prazo. | 104 testes de origem passaram em cinco arquivos, incluindo chamadas bibliográficas reais entre cliente e servidor MCP em memória, com API de dados simulada. |
| Time | A curadoria do Radar confere o horário de uma prova no fuso que o edital declara. Uma data publicada sem hora deve continuar só com a data. | O servidor retornou o deslocamento UTC−04:00 para `America/Cuiaba` e converteu 09:00 locais em 13:00 UTC. |
| Fetch | O Radar pode comparar o texto extraído de uma página oficial com o trecho de evidência que já mantém. Preservar URL, data da coleta e citação literal para a revisão. | O servidor recusou a URL de loopback pela proteção padrão de rede. A função local de extração converteu HTML sintético em texto com título e corpo. |

## Revisões, licenças e operação

**PostHog.** O servidor no monorepositório declara versão interna `1.0.0` e licença MIT. A licença raiz preserva condições separadas para `ee/` e componentes de terceiros. A revisão contém um serviço Node/Hono, estado de sessão em Redis e um Worker Cloudflare que recebe OAuth e encaminha pedidos ao serviço regional. O fluxo manual documentado aceita uma chave pessoal com escopos do projeto em `https://mcp.posthog.com/mcp`. A ponte `mcp-remote@0.16.6` tem licença MIT. O pacote npm `@posthog/mcp@1.4.0` publicado a partir de `posthog-js` é o SDK de telemetria para autores de servidores. Para o piloto, restringir os escopos e os nomes de ferramentas à leitura de um painel específico. O esquema da revisão inclui tanto `insight-get` quanto alterações de flags. Filtrar grupos de ferramentas por `features` afeta a descoberta e a autorização ainda depende das permissões do projeto. Nenhuma medição real de uso foi feita. [Servidor e instalação](https://github.com/PostHog/posthog/tree/61df643c8bb3f8196daf437f510893ef6fa36c5a/services/mcp) · [Arquitetura](https://github.com/PostHog/posthog/blob/61df643c8bb3f8196daf437f510893ef6fa36c5a/services/mcp/ARCHITECTURE.md) · [Licença](https://github.com/PostHog/posthog/blob/61df643c8bb3f8196daf437f510893ef6fa36c5a/LICENSE) · [Ponte](https://github.com/punkpeye/mcp-remote/tree/e4dc3713b0d6a727cbeb21f38324d20a6692dc5f) · [SDK homônimo](https://www.npmjs.com/package/@posthog/mcp/v/1.4.0)

**OpenAlex.** O manifesto do registro identifica `org.openalex/openalex` versão `0.5.0` em `https://mcp.openalex.org/mcp` por Streamable HTTP. O pacote privado de desenvolvimento nessa revisão usa `0.1.0`. Cada consulta ao serviço hospedado requer o consentimento OAuth 2.1 do titular e usa a chave e os créditos de sua conta ou organização. A instalação própria completa requer Worker, armazenamento KV, serviço de identidade e configuração da API OpenAlex. O código é MIT. O OpenAlex declara CC0 para seus dados bibliográficos. A redistribuição de artigos completos depende dos direitos de cada obra. Para a curadoria, os três nomes a avaliar são `search_works`, `get_work` e `resolve_references`. A conferência humana deve comparar o artigo com a afirmação que será publicada. [Registro](https://github.com/ourresearch/openalex-mcp-server/blob/6d9139aa89a0b400f1988e905080bb2a6edf281e/server.json) · [Autenticação, ferramentas e licenças](https://github.com/ourresearch/openalex-mcp-server/blob/6d9139aa89a0b400f1988e905080bb2a6edf281e/README.md) · [Configuração do Worker](https://github.com/ourresearch/openalex-mcp-server/blob/6d9139aa89a0b400f1988e905080bb2a6edf281e/wrangler.jsonc)

**Time e Fetch.** As duas distribuições Python estão na versão `2026.11.18` e declaram MIT nos respectivos manifestos. O repositório registra a transição de MIT para Apache-2.0 por contribuição e CC BY 4.0 para documentação fora da especificação. Time requer Python 3.10 ou superior e usa os fusos IANA. Fetch requer Python 3.11.5 ou superior. Para testar Fetch escolhemos o extrator Python (`--no-readability-js`), que dispensa a instalação do extrator JavaScript. O candidato a piloto fica restrito às fontes oficiais que o Radar já aceita, com a validação de destinos e redirecionamentos do produto e revisão da evidência antes da publicação. Os testes não consultaram editais nem avaliaram fidelidade em PDF ou páginas dependentes de JavaScript. [Time](https://github.com/modelcontextprotocol/servers/tree/c799c8552b0f27b7a33a7b9233773da144dddcf5/src/time) · [Fetch](https://github.com/modelcontextprotocol/servers/tree/c799c8552b0f27b7a33a7b9233773da144dddcf5/src/fetch) · [Licença da revisão](https://github.com/modelcontextprotocol/servers/blob/c799c8552b0f27b7a33a7b9233773da144dddcf5/LICENSE) · [Fluxo atual do Radar](../../../docs/RADAR_CONCURSOS.md)

## Reproduzir em diretório de laboratório

Execute em um diretório novo, fora do aplicativo. O preparo usa Git, npm, Node.js 24 e Python 3.12 com `uv`. O primeiro download usa os registros públicos. Os testes seguintes precisam apenas dos arquivos instalados e de loopback.

```sh
mkdir -p mcp-posthog/services/mcp/schema mcp-openalex/runner mcp-referencia
uv --no-cache venv --python 3.12 mcp-referencia/.venv
uv --no-cache pip install --python mcp-referencia/.venv/bin/python \
  'mcp-server-time==2026.11.18' 'mcp-server-fetch==2026.11.18' 'mcp==2.3.0'
npm --prefix mcp-posthog install --ignore-scripts --no-audit --no-fund --save-exact mcp-remote@0.16.6

posthog_src=https://raw.githubusercontent.com/PostHog/posthog/61df643c8bb3f8196daf437f510893ef6fa36c5a/services/mcp/schema
for schema in tool-definitions.json generated-tool-definitions.json; do
  curl -fsSL "$posthog_src/$schema" -o "mcp-posthog/services/mcp/schema/$schema"
done
python3 - <<'PY'
import json
from pathlib import Path
schemas = Path("mcp-posthog/services/mcp/schema")
base = json.loads((schemas / "tool-definitions.json").read_text())
generated = json.loads((schemas / "generated-tool-definitions.json").read_text())
assert (len(base), len(generated)) == (57, 1252)
assert generated["insight-get"]["annotations"]["readOnlyHint"] is True
assert "feature-flag-enable" in generated
PY

git init -q mcp-openalex/upstream
git -C mcp-openalex/upstream fetch -q --depth=1 https://github.com/ourresearch/openalex-mcp-server.git 6d9139aa89a0b400f1988e905080bb2a6edf281e
git -C mcp-openalex/upstream checkout -q --detach FETCH_HEAD
npm --prefix mcp-openalex/upstream ci --omit=dev --ignore-scripts --no-audit --no-fund
npm --prefix mcp-openalex/runner install --save-exact --ignore-scripts --no-audit --no-fund vitest@3.2.7
ln -s ../../runner/node_modules/vitest mcp-openalex/upstream/node_modules/vitest
(cd mcp-openalex/upstream && ../runner/node_modules/.bin/vitest run --maxWorkers=1 \
  test/openalex.test.ts test/oql.test.ts test/shape.test.ts test/references.test.ts test/isTraditional.test.ts)
```

Para verificar o transporte da ponte, em um terminal do laboratório inicie Time na interface local. Encerre com Ctrl+C depois do teste.

```sh
HOST=127.0.0.1 PORT=43871 mcp-referencia/.venv/bin/mcp-server-time \
  --local-timezone America/Cuiaba --transport streamable-http
```

Em outro terminal, no mesmo diretório, o cliente abaixo descobre ferramentas, converte a hora por dois transportes e verifica a recusa do Fetch e a conversão local de HTML.

```sh
mcp-referencia/.venv/bin/python - <<'PY'
import asyncio, json, tempfile
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp_server_fetch.server import extract_content_from_html

async def check(binary, args, fetch=False, env=None):
    params = StdioServerParameters(command=str(Path(binary).resolve()), args=args, env=env)
    async with stdio_client(params) as streams, ClientSession(*streams) as client:
        await client.initialize()
        names = {item.name for item in (await client.list_tools()).tools}
        if fetch:
            assert names == {"fetch"}
            result = await client.call_tool("fetch", {"url": "http://127.0.0.1/edital-sintetico"})
            assert result.is_error and "not a public address" in result.content[0].text
        else:
            assert names == {"get_current_time", "convert_time", "get_time_ago"}
            now = await client.call_tool("get_current_time", {"timezone": "America/Cuiaba"})
            assert "-04:00" in now.content[0].text
            converted = await client.call_tool("convert_time", {
                "source_timezone": "America/Cuiaba", "target_timezone": "UTC", "time": "09:00"
            })
            assert "13:00" in json.loads(converted.content[0].text)["target"]["datetime"]

async def main():
    root = Path("mcp-referencia/.venv/bin")
    await check(root / "mcp-server-time", ["--local-timezone", "America/Cuiaba"])
    await check(root / "mcp-server-fetch", ["--no-readability-js"], fetch=True)
    with tempfile.TemporaryDirectory() as cache:
        await check("mcp-posthog/node_modules/.bin/mcp-remote",
                    ["http://127.0.0.1:43871/mcp", "--transport", "http-only"],
                    env={"MCP_REMOTE_CONFIG_DIR": cache, "NO_PROXY": "127.0.0.1,localhost"})
    html = "<article><h1>Boletim fictício</h1><p>Calendário sintético de avaliação.</p></article>"
    out = extract_content_from_html(html, use_readability_js=False)
    assert "Boletim fictício" in out and "Calendário sintético" in out
    print("Time, Fetch e ponte local verificados")

asyncio.run(asyncio.wait_for(main(), timeout=30))
PY
```
