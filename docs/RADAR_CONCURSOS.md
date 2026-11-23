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

- **Páginas montadas por JavaScript** (Cebraspe, portal da Selecon) e com anti-robô (Fundatec)
  chegam sem texto ao coletor: ficam cadastradas e desligadas. Use a página do órgão, o diário
  oficial ou outra URL estática da banca. Se nada disso resolver, use o piloto de renderização
  abaixo (só para JavaScript; anti-robô continua desligado de propósito).

## Piloto: fontes montadas por JavaScript (Firecrawl, D15)

Aprovado pelo dono em 2026-11-23. O código está pronto e **desligado**: só vale para a fonte
marcada com `render_mode = 'firecrawl'` e com o secret `FIRECRAWL_API_KEY` configurado.

**Como funciona.** Para a fonte marcada, a função `radar-concursos` confere a URL (`safeUrl`) e o
`robots.txt` da fonte, e só então pede à API da Firecrawl (`POST https://api.firecrawl.dev/v2/scrape`,
endpoint fixo) o HTML já renderizado. O pedido vai sem cache (`maxAge: 0`, `storeInCache: false`)
e com proxy `basic`, para não contornar anti-robô. A resposta é limitada a 2 MB, a URL final passa
de novo por `safeUrl` e o HTML segue o caminho normal: texto, links, hash, diff, portão de
evidência e verificador. Só a URL pública da fonte vai ao serviço; nenhum dado de aluno.
As páginas de detalhe e o `link_oficial` continuam no coletor direto.

**Para ligar (dono):**
1. `curador-conteudo` confirma que a URL estática da banca, o endpoint JSON que a página consome
   ou o diário oficial (backlog 17) não resolvem a fonte.
2. Criar a conta na Firecrawl e gravar o secret `FIRECRAWL_API_KEY` nas Edge Functions (Lovable
   Cloud). O plano gratuito cobre o piloto: 2 fontes a cada 12 h dão cerca de 120 créditos por mês.
3. Aplicar a migration `20261123120000_radar_render_mode.sql` e publicar `radar-concursos`, em
   qualquer ordem: a função trata a coluna ausente como `direto`.
4. Marcar e ligar a fonte (SQL do Lovable):
   `UPDATE public.radar_sources SET render_mode = 'firecrawl', is_active = true WHERE url = '<url da fonte>';`
5. Admin → Radar → **Verificar agora** e conferir no painel que a fonte deixou de ter "página sem
   texto". Acompanhar os créditos no painel da Firecrawl.

**Erros que aparecem na fonte:** "renderização não configurada" (falta o secret), "renderização sem
crédito" (402), "renderização limitada (429)", "bloqueado pelo robots.txt", "HTTP <código>" (a página
respondeu com erro). **Desligar:** `render_mode = 'direto'` na fonte ou remover o secret.
- **PDF**: o coletor só detecta que o arquivo mudou (vira revisão humana); a leitura do edital em
  PDF para o rascunho de trilha é por texto colado.
- O Radar não inventa concursos que não estejam nas fontes cadastradas: a cobertura depende da
  lista de fontes (Admin → Radar → Fontes).
- Todos os textos de páginas são tratados como **dados não confiáveis** (cercados e com
  `UNTRUSTED_RULE`); nenhuma instrução vinda de uma página muda o papel de um agente.
