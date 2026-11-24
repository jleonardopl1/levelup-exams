# Radar de Concursos — grupo de agentes de pesquisa, monitoramento e novas trilhas

O Radar mantém o aluno atualizado sobre os concursos que ele estuda e sobre a carreira que
ele quer: acompanha as páginas oficiais de bancas e órgãos, detecta concursos previstos,
autorizados e com edital publicado, registra cada mudança (fase, datas, vagas, retificações)
com a evidência da fonte e avisa quem acompanha. Para os concursos mais procurados, monta o
rascunho da trilha de estudos a partir do edital.

## Hierarquia dos agentes

```
Gerente master (código: orçamento, fila, consolidação, avisos)
 └─ Coordenador de cada área (1 por linha de radar_areas — 11 áreas na semente)
     ├─ Batedor ............. lê só o trecho NOVO de cada fonte e lista os concursos citados
     ├─ Analista de edital .. extrai campo a campo, cada valor com trecho literal da fonte
     ├─ Verificador ......... outro modelo; confere cada afirmação contra a fonte
     ├─ Analista de banca ... perfil da banca (formato, penalidade, estilo) para a trilha
     └─ Arquiteto de trilha . módulos, quadro de provas, matérias e ementas do edital
```

| Papel | Onde | Modelo (secret) | Decide |
| --- | --- | --- | --- |
| Gerente master | `radar-concursos/index.ts` + `pipeline.ts` | — (código) | quais fontes, quanto orçamento, ordem da fila, o que publica e quem avisa |
| Coordenador da área | `agents.ts` (`coordenador:<área>`) | `RADAR_MODEL` | para cada candidato: atualizar (qual concurso), novo ou ignorar; prioridade 1–5 pela demanda |
| Batedor | `agents.ts` | `RADAR_MODEL` | quais concursos o trecho novo menciona e de que área são |
| Analista de edital | `agents.ts` | `RADAR_MODEL` | afirmações `{campo, valor, evidência}` |
| Verificador | `agents.ts` | `RADAR_VERIFIER_MODEL` | se a fonte sustenta cada afirmação |
| Analista de banca | `agents.ts` | `RADAR_TRACK_MODEL` | perfil da banca para as dicas de estudo |
| Arquiteto de trilha | `agents.ts` | `RADAR_TRACK_MODEL` | estrutura da trilha a partir do edital |

As áreas e o foco de cada coordenador ficam em `radar_areas` (Segurança Pública, Tribunais e
Carreiras Jurídicas, Fiscal e Controle, Bancária, Administração Pública, Legislativo, Educação,
Saúde, TI, Militares, ENEM e Vestibulares). Nova área = nova linha; o coordenador nasce com ela.

## Fluxo do monitoramento (a cada 3 horas, `pg_cron`)

1. **Coleta (sem IA, `fetcher.ts`)** — fontes vencidas (intervalo por fonte, recuo exponencial
   após falhas), no máximo `RADAR_MAX_SOURCES` por execução. Só `https` público, sem IP literal,
   sem host interno, redirecionamentos conferidos, 2 MB e 15 s por página, **respeita o
   robots.txt**. O HTML vira texto; o hash é do texto (não do HTML). Página sem texto (montada
   por JavaScript ou anti-robô) é sinalizada no painel.
2. **Diff** — só as linhas novas desde a última visita vão para o Batedor (barato e focado).
3. **Batedor** por fonte que mudou → candidatos. Portão: o trecho citado precisa existir na página.
4. **Coordenador** de cada área com candidatos (em paralelo). A deduplicação final é em código:
   "novo" com o mesmo órgão/UF **e a mesma edição** de um concurso acompanhado vira atualização.
   Anos que não batem, ou concurso antigo já encerrado, indicam edição nova (não herda
   seguidores nem trilha).
5. **Fila do master** — prioridade do coordenador × peso da área; corta em `RADAR_MAX_EXTRACTIONS`.
6. Por concurso: baixa a página de detalhe (se o link estiver na fonte; até
   `RADAR_MAX_DETAIL_FETCHES`), **Analista de edital** → **portão determinístico**
   (`evidence.ts`: evidência literal na fonte, data e número presentes na evidência, link
   presente na página, datas coerentes) → **Verificador** independente (outro modelo).
7. **Consolidação em código** — compara com o que já se sabe e decide:
   - publica sozinho: concurso novo verificado com fase confirmada; avanço de fase; data nova;
   - **revisão humana**: verificador indisponível, fase que volta atrás, suspensão/cancelamento,
     data já conhecida que muda (retificação), PDF oficial alterado.
8. **Avisos** — `radar_fanout_update` grava em `notifications` (tipo `radar`, link para
   `/radar/<slug>`) para quem acompanha o concurso e, se for concurso novo, para quem acompanha
   a área. Idempotente.
9. **Relevância** (`scoring.ts`, 0–100): abrangência + vagas + salário + fase + alunos que
   acompanham. Edital na rua + relevância ≥ 40 + sem trilha = **sugerido para trilha**.

Telemetria de cada chamada em `ai_runs` (só metadados) e resumo de cada execução em `radar_runs`.

O retrato da página (`last_hash`/`last_text`) só avança quando todo o trecho novo foi processado
(triagem, análise de cada concurso e gravação). Se algo ficou para trás (orçamento, prazo,
falha), a fonte é reprocessada na execução seguinte, até 3 vezes (`pending_retries`); depois
avança e o descarte fica em `radar_runs.details.sources_given_up`. Concurso novo que vai para
revisão nasce só com a identificação: os fatos ficam no patch da atualização pendente e só
entram no registro na aprovação. Data da prova aprovada atualiza também a trilha ligada.

## Nova trilha a partir do edital

Admin → **Radar** → *Novas trilhas* → **Gerar rascunho** (cole o texto do edital; se o link
oficial for uma página HTML com o edital, pode deixar em branco). Analista de banca ∥ Arquiteto
de trilha; o portão (`tracks.ts`) descarta matéria cuja ementa não confere com o edital e data de
cronograma sem evidência. Legislação local entra com `ai_grounded_only` e **sem geração
automática** (`weekly_target = 0`) até a equipe cadastrar questões autorais — e a
`generate-track-questions` agora recusa matéria de legislação local sem fatos verificados.

O admin revisa e clica **Publicar trilha** (`radar_publish_track_draft`): cria categoria, matérias,
trilha, módulos e liga o concurso à trilha. A fábrica de questões passa a gerar questões novas
para as matérias na janela seguinte. Para um banco inicial autoral (recomendado antes de abrir a
trilha aos alunos), o `curador-conteudo` exporta o rascunho para `content/trilhas/<slug>/` e
segue o fluxo de `docs/TRILHAS.md`.

## O que o aluno vê

- **`/radar`** — concursos por relevância, filtros por área, abrangência, busca, "só o que eu
  acompanho"; chips "Avise-me de concursos novos em…" (acompanhar a área/carreira).
- **`/radar/:slug`** — resumo (vagas, salário, datas, cargos), botão Acompanhar, link oficial,
  trilha (se houver) e a linha do tempo de atualizações com "antes → depois" e link da fonte.
- **Trilha** — cartão "Radar do edital" com a fase, a última novidade e o botão Acompanhar.
- **Notificações** — clicar leva direto ao concurso.

## Implantação (dono)

1. `supabase db push` — aplica `20261117120000_radar_concursos.sql` (tabelas, RLS, RPCs, áreas,
   fontes, o concurso da Câmara de Cuiabá ligado à trilha e o agendamento).
2. `supabase functions deploy radar-concursos` e `generate-track-questions`.
3. Opcional: `RADAR_MODEL`, `RADAR_VERIFIER_MODEL`, `RADAR_TRACK_MODEL`, `RADAR_MAX_*`.
   Reaproveita `LOVABLE_API_KEY` e o segredo do agendador no Vault (`question_cron_secret`).
4. Regerar `src/integrations/supabase/types.ts` (o front usa acesso sem tipos às tabelas do
   Radar até lá — `radarDb` em `src/hooks/useRadar.ts`).
5. Admin → Radar → **Verificar agora** para a primeira coleta.

## Limites conhecidos

- **Páginas montadas por JavaScript** (a lista `/concursos/` do Cebraspe) e com anti-robô
  (Fundatec, páginas de concurso da Selecon em `*.selecao.net.br`) chegam sem texto ao coletor.
  Antes de pensar em renderizar, procure a lista de notícias ou de concursos da própria banca, a
  página do órgão ou o diário oficial (ver "Fontes conferidas" abaixo). Se nada disso resolver, use o
  piloto de renderização (só para JavaScript; anti-robô continua desligado de propósito).
- **JSON, RSS e Atom** (`application/json`, `application/rss+xml`, `application/atom+xml`) são
  tratados como binários pelo coletor: só o hash é guardado, sem texto nem links. "XML funciona"
  vale só para `text/xml` e `application/xml` (ex.: sitemap), e sitemap não tem `<a href>`: sem
  links, o `link_oficial` não passa no portão de evidência.
- **PDF**: o coletor só detecta que o arquivo mudou (vira revisão humana); a leitura do edital em
  PDF para o rascunho de trilha é por texto colado.
- O Radar não inventa concursos que não estejam nas fontes cadastradas: a cobertura depende da
  lista de fontes (Admin → Radar → Fontes).
- Todos os textos de páginas são tratados como **dados não confiáveis** (cercados e com
  `UNTRUSTED_RULE`); nenhuma instrução vinda de uma página muda o papel de um agente.

## Fontes conferidas (Cebraspe e Selecon, 2026-11-24)

Conferidas pelo `curador-conteudo` com o `fetchPage` do próprio coletor. A migration
`20261124120000_radar_sources_urls_estaticas.sql` troca as duas fontes desligadas; ligar continua
sendo decisão do dono.

| Banca | URL | O que o coletor recebe | Uso |
| --- | --- | --- | --- |
| Cebraspe | `https://www.cebraspe.org.br/concursos/` | 200, HTML de aplicação React: 0 caracteres, 0 links | substituída |
| Cebraspe | `https://www.cebraspe.org.br/noticias/` | 200, HTML estático (WordPress): ~4,5 mil caracteres, 73 links; cada notícia de concurso traz vagas, inscrições, remuneração, data da prova e o link `www.cebraspe.org.br/concursos/<SIGLA>` | **fonte nova (desligada)** |
| Cebraspe | `https://apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/{novos,inscricoes-abertas,em-andamento}` | 200, `application/json` (binário para o coletor). É o que a própria página chama; sem token nem cabeçalho. Detalhe em `/cebraspe/eventos/<SIGLA>` (cargos, período de inscrição, editais e retificações) | melhor fonte de fase; exige mudança no `fetcher.ts` |
| Selecon | `https://selecao.net.br/` | 200, só "Cliente não encontrado." (raiz da plataforma de inscrições, não é página dinâmica) | substituída |
| Selecon | `https://www.selecon.org.br/` | 200, HTML estático: abas "Em andamento" e "Inscrições Abertas" renderizadas no servidor, com edital, órgão, vagas, remuneração, cidade, UF e link do concurso | **fonte ativa** ("Instituto Selecon") |
| Selecon | `https://selecon.org.br/concursos/` | 200, HTML estático: os 12 concursos mais recentes (cobre todos os de inscrição aberta), sem contadores nem abas repetidas | **alternativa (desligada)**; ligar só no lugar da fonte ativa |
| Selecon | `https://<cliente>.selecao.net.br/informacoes/<id>/` | 403, desafio Turnstile da Cloudflare (também num navegador real) | anti-robô: não usar; a página de detalhe falha e o Radar segue com o texto da lista |
| Selecon | `https://selecon.org.br/concursos/feed/` | 200, `application/rss+xml` (binário para o coletor); só número do edital e link | não usar |

**Diários oficiais.** O DOU (`www.in.gov.br`) respondeu 403 da Azion ou derrubou a conexão a partir
da sessão na nuvem, até num navegador; o INLABS estava "em manutenção". Não deu para conferir. A API
do Querido Diário mudou para `api.queridodiario.org.br` (o host antigo falha no TLS). Ela só
complementa: a busca por "Selecon" desde agosto trouxe 9 diários (Niterói e Araçás), nenhum dos
municípios com concurso aberto (Cuiabá, Várzea Grande, Barra do Garças, São Gonçalo); Cuiabá está
parada desde 02/06/2026. Os trechos trazem número de inscrição de candidatos (dado pessoal) e a
resposta é JSON. Por isso não vira fonte.

## Piloto: fontes montadas por JavaScript (Firecrawl, D15)

Aprovado pelo dono em 2026-11-23. O código está pronto e **desligado**: só vale para a fonte
marcada com `render_mode = 'firecrawl'` e com o secret `FIRECRAWL_API_KEY` configurado.

**Como funciona.** Para a fonte marcada, a função `radar-concursos` confere a URL (`safeUrl`) e o
`robots.txt` da fonte, e só então pede à API da Firecrawl (`POST https://api.firecrawl.dev/v2/scrape`,
endpoint fixo) o HTML já renderizado. O pedido vai sem cache (`maxAge: 0`, `storeInCache: false`)
e com proxy `basic`, para não contornar anti-robô: resposta que indique outro proxy
(`metadata.proxyUsed`) ou dado servido por provedor terceiro (`metadata.provider`) é recusada. O
`robots.txt` precisa liberar o nosso agente e o da Firecrawl. A resposta é limitada a 2 MB, a URL
final passa de novo por `safeUrl` e o HTML segue o caminho normal: texto, links, hash, diff, portão
de evidência e verificador. Só a URL pública da fonte vai ao serviço; nenhum dado de aluno. As
páginas de detalhe e o `link_oficial` continuam no coletor direto.

**Nada publica sozinho durante o piloto.** A evidência literal de uma página renderizada é conferida
contra o que o serviço devolveu, não contra o site oficial. Por isso todo resultado dessas fontes vira
atualização **pendente** (motivo "fonte renderizada por serviço externo") e só chega aos alunos
depois da aprovação do admin. Cada execução renderiza no máximo `RADAR_MAX_RENDERED` fontes
(padrão 2), com prazo tirado do orçamento da execução; sem folga, a fonte fica para a próxima.

**Situação em 2026-11-24:** sem fonte-alvo. Cebraspe e Selecon foram resolvidas sem renderização
(ver "Fontes conferidas"); o código fica pronto e desligado para uma fonte futura.

**Para ligar (dono):**
1. `curador-conteudo` confirma que a URL estática da banca, o endpoint JSON que a página consome
   ou o diário oficial (backlog 17) não resolvem a fonte, e que ela não tem anti-robô.
2. Criar a conta na Firecrawl e gravar o secret `FIRECRAWL_API_KEY` nas Edge Functions (Lovable
   Cloud). O plano gratuito cobre o piloto: 2 fontes a cada 12 h dão cerca de 120 créditos por mês.
3. Aplicar a migration `20261123120000_radar_render_mode.sql` e publicar `radar-concursos`, em
   qualquer ordem: a função trata a coluna ausente como `direto`.
4. **Antes de marcar a primeira fonte**, uma chamada de teste com a chave (fora do Radar) para
   confirmar o que a v2 devolve: se `metadata.proxyUsed` vem e vale `basic`, se `metadata.url` é a
   URL final e quantos créditos a chamada gastou. O parâmetro `proxy` está marcado como obsoleto na
   documentação da Firecrawl (padrão `auto`, que tenta proxies "enhanced"); se a resposta não
   permitir conferir o proxy, não ligar e reabrir a avaliação. Use uma chave só para o Radar, com
   teto de créditos, e confirme a política de retenção de dados da Firecrawl (LGPD).
5. Marcar e ligar a fonte (SQL do Lovable). Só páginas de edital e listagem de concursos; páginas
   de resultado com nomes de candidatos ficam fora do piloto:
   `UPDATE public.radar_sources SET render_mode = 'firecrawl', is_active = true WHERE url = '<url da fonte>';`
6. Admin → Radar → **Verificar agora** e conferir no painel que a fonte deixou de ter "página sem
   texto". Acompanhar os créditos no painel da Firecrawl.

**Erros que aparecem na fonte:** "renderização não configurada" (falta o secret), "renderização sem
crédito" (402), "renderização limitada (429)", "bloqueado pelo robots.txt", "renderização com proxy
não permitido", "renderização por provedor terceiro não permitida", "HTTP <código>" (a página
respondeu com erro). **Desligar:** `render_mode = 'direto'` na fonte ou remover o secret.
