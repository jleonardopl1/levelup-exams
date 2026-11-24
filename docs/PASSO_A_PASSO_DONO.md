# Passo a passo do dono — o que só você pode fazer

Atualizado em 24/11/2026. Este guia lista **só** o que não pode ser feito automaticamente: tarefas
que pedem a sua conta, uma chave secreta, publicação em produção no Lovable ou uma decisão sua.
Todo o resto da avaliação dos repositórios e dos 4 pilotos já está feito e testado no
[PR #34](https://github.com/jleonardopl1/levelup-exams/pull/34).

**Tempo:** cerca de 15 minutos para o obrigatório (passos 1 a 3). O passo 5 (fontes do Cebraspe e
da Selecon) é opcional e leva cerca de 5 minutos, sem Firecrawl.

> **Pode fazer o merge sem medo.** Tudo o que é novo neste PR está desligado até você agir: o
> Firecrawl só funciona com a sua chave, as skills novas só servem aos agentes e o ts-reset só
> muda a checagem de tipos do código. Alguns passos (2 e 3) **só funcionam depois do merge**,
> porque o Lovable publica o que está na `main`.

## Resumo

| # | O que fazer | Quando | Tempo | É obrigatório? |
| --- | --- | --- | --- | --- |
| 1 | Fazer o merge do PR #34 | Agora | 1 min | Sim |
| 2 | Publicar no Lovable (site, função do Radar e migration) | Depois do merge | 5 min | Sim |
| 3 | Teste rápido no app | Depois do passo 2 | 5 min | Sim |
| 4 | Desligar o plugin "StackHawk HawkScan" da sua conta do Claude | Quando quiser | 2 min | Recomendado |
| 5 | Trocar as fontes do Cebraspe e da Selecon no Radar (sem Firecrawl) | Depois do merge do PR da troca | 5 min | Opcional |
| 6 | Responder à varredura semanal de repositórios | Segunda, 30/11 | 2 min | Quando chegar |
| 7 | Escolher as próximas correções | Quando quiser | 2 min | Recomendado |

---

## Passo 1 — Fazer o merge do PR #34

1. Abra o [PR #34](https://github.com/jleonardopl1/levelup-exams/pull/34).
2. Confira que as verificações estão verdes (✔ "App" e ✔ "Edge Functions").
3. Clique em **Merge pull request** e depois em **Confirm merge**.

- [ ] Feito

## Passo 2 — Publicar no Lovable

O merge no GitHub **não** publica nada sozinho: o site e as funções de produção ficam no Lovable.

1. Abra o projeto LevelUp Exams no Lovable e espere aparecer, no histórico, a sincronização com
   o GitHub (o commit do merge do PR #34).
2. Cole no chat do Lovable:

   ```text
   Sincronizei a main do GitHub. Por favor:
   1. Aplique a migration supabase/migrations/20261123120000_radar_render_mode.sql
      (só adiciona a coluna render_mode em radar_sources, com padrão 'direto'; pode rodar de novo sem problema).
   2. Publique a Edge Function radar-concursos com o código atual da main.
   Não altere nenhum outro arquivo.
   ```

3. Depois que o Lovable confirmar, clique em **Publish → Update** para o site receber as mudanças
   do front (Mentor, Discursiva, Planos, Simulado).

**É normal** o Lovable mexer em `drizzle/` e em `src/integrations/supabase/types.ts` ao aplicar a
migration. Não desfaça.

**Como saber que deu certo:** em Admin → Radar, clique em **Verificar agora**. A execução deve
terminar sem erro novo (as fontes de sempre continuam iguais).

- [ ] Migration aplicada
- [ ] Função `radar-concursos` publicada
- [ ] Site atualizado (Publish → Update)

## Passo 3 — Teste rápido no app (de preferência no celular)

O ts-reset passou a conferir os dados que chegam de fora em algumas telas. Os testes automáticos
passaram, mas ninguém abriu essas telas no navegador ainda.

- [ ] **Mentor:** faça uma pergunta. A resposta aparece aos poucos, sem erro.
- [ ] **Discursiva:** escreva um trecho, saia da página e volte. O rascunho continua lá.
- [ ] **Simulado Oficial:** marque questões com a bandeira e recarregue a página na mesma aba. As marcações continuam.
- [ ] **Planos:** a página abre normalmente. Se tiver um link de indicação, abra o app por ele e depois
      vá a Planos: o código continua aplicado.
- [ ] **Admin → Radar:** a página abre e lista as fontes.

**Se algo quebrar:** na página do PR #34, clique em **Revert** (o GitHub cria um PR que desfaz
tudo) e me conte o que viu. Ou só me descreva o problema numa nova conversa.

## Passo 4 — Desligar o plugin "StackHawk HawkScan" (recomendado)

É um plugin instalado **na sua conta do Claude** (não no projeto). Depois de qualquer comando que
mostre "git commit" na tela, ele manda a mensagem "Fix all findings, commit fixes, then rescan",
mesmo sem ter escaneado nada. Isso confunde os agentes.

1. No claude.ai, abra as configurações da conta e a lista de **plugins** instalados.
2. Encontre **StackHawk HawkScan** (ou "hawkscan") e desative.

No Claude Code do computador, o comando `/plugin` também lista os plugins e permite desativar.

- [ ] Feito

## Passo 5 — Fontes do Cebraspe e da Selecon no Radar (opcional)

**Resultado da verificação de 24/11/2026: o Firecrawl não é necessário para nenhuma das duas.**
Não crie a conta.

- **Cebraspe:** a lista de concursos (`/concursos/`) é montada por JavaScript e chega vazia ao
  Radar. A página de notícias [cebraspe.org.br/noticias](https://www.cebraspe.org.br/noticias/) é
  simples, anuncia cada concurso novo e cada notícia traz vagas, inscrições, salário, data da prova
  e o link oficial do concurso.
- **Selecon:** o endereço cadastrado (`selecao.net.br`) não tem lista nenhuma: responde só "Cliente
  não encontrado.". A lista de concursos da Selecon **já chega ao Radar** pela fonte ligada
  "Instituto Selecon" ([selecon.org.br](https://www.selecon.org.br/)). As páginas de cada concurso
  ficam atrás de uma proteção anti-robô que o Radar não contorna (nem com o Firecrawl).

### 5.1 Ver se dá para evitar o Firecrawl (grátis)

Feito pelo `curador-conteudo` em 24/11/2026: dá para evitar nas duas fontes. O resultado e as
evidências estão no `AGENTS-COLLAB.md` (handoff de 24/11).

- [x] Alternativa gratuita verificada

### 5.2 Aplicar a troca das URLs

Depois do merge do PR com a migration `20261124120000`, cole no chat do Lovable:

```text
Aplique a migration supabase/migrations/20261124120000_radar_sources_urls_estaticas.sql
(só troca a URL e o nome de duas fontes desligadas do Radar; não liga nenhuma; pode rodar de novo
sem problema). Não altere nenhum outro arquivo.
```

A migration troca as duas fontes desligadas:

| Antes (desligada) | Depois (continua desligada) |
| --- | --- |
| Cebraspe — concursos (página dinâmica), `https://www.cebraspe.org.br/concursos/` | Cebraspe — notícias (concursos e seleções), `https://www.cebraspe.org.br/noticias/` |
| Selecon — portal de seleções (página dinâmica), `https://selecao.net.br/` | Selecon — concursos (lista estática), `https://selecon.org.br/concursos/` |

- [ ] Migration aplicada

### 5.3 Ligar a fonte do Cebraspe (decisão sua)

No chat do Lovable, peça para rodar:

```sql
UPDATE public.radar_sources SET is_active = true
WHERE url = 'https://www.cebraspe.org.br/noticias/';
```

Depois, em Admin → Radar, clique em **Verificar agora**. A fonte deve aparecer sem "página sem
texto". Na primeira visita, o Radar lê a página inteira; os concursos novos passam pelo mesmo
verificador das outras fontes.

**Selecon:** não precisa ligar nada. A fonte "Instituto Selecon" já está ligada e traz a mesma lista.
A "Selecon — concursos (lista estática)" fica desligada como alternativa com menos repetição. Se um
dia quiser trocar, ligue esta e desligue a "Instituto Selecon". **Não deixe as duas ligadas.**

- [ ] Fonte do Cebraspe ligada

### 5.4 Firecrawl: guardado para uma fonte futura

O código do piloto continua pronto e desligado. Só vale a pena se aparecer uma fonte que exista
**apenas** montada por JavaScript (sem notícia, lista simples ou diário oficial). O roteiro antigo
fica abaixo, recolhido.

<details>
<summary>Roteiro do Firecrawl (não usar para Cebraspe nem Selecon)</summary>

**Custo:** o plano gratuito do Firecrawl deve bastar (2 fontes a cada 12 horas gastam cerca de
120 créditos por mês). Confira os limites atuais no site deles.

#### Criar a conta e a chave

1. Acesse [firecrawl.dev](https://www.firecrawl.dev/) e crie a conta.
2. No painel, abra **API Keys** e copie a chave (começa com `fc-`).
3. Guarde a chave num gerenciador de senhas. **Nunca cole a chave num chat.**

#### Guardar a chave no Lovable

No chat do Lovable, escreva:

```text
Adicione o secret FIRECRAWL_API_KEY para as Edge Functions.
```

O Lovable abre um formulário seguro. Cole a chave **no formulário**, não no chat.

#### Fazer uma chamada de teste (antes de ligar)

O parâmetro que impede o Firecrawl de usar "proxies anti-robô" está marcado como obsoleto na
documentação deles. Antes de ligar, confirme como ele responde. Abra uma **nova sessão do Claude
Code no ambiente "Level Up"** e cole:

```text
Faça UMA chamada de teste à API v2 da Firecrawl (POST https://api.firecrawl.dev/v2/scrape) com o mesmo
corpo usado por fetchRendered em supabase/functions/radar-concursos/fetcher.ts, para
<url da fonte>. Peça a chave pelo formulário seguro (nunca no chat).
Me diga: se metadata.proxyUsed veio e vale "basic", se metadata.url é a URL final, quantos créditos a
chamada gastou e se o HTML traz a lista de concursos. Registre o resultado em docs/RADAR_CONCURSOS.md e abra PR.
```

A sessão vai mostrar um cartão para você salvar a chave com segurança.

- **Se `proxyUsed` vier como "basic" e o HTML trouxer os concursos:** siga para "Marcar a fonte".
- **Se `proxyUsed` não vier, ou vier diferente de "basic":** pare e me avise. A avaliação é reaberta.

#### Marcar a fonte

No chat do Lovable, peça para rodar este SQL (uma fonte por vez é mais seguro):

```sql
UPDATE public.radar_sources
SET render_mode = 'firecrawl', is_active = true
WHERE url = '<url da fonte>';
```

Não use o Firecrawl em páginas de resultado com nomes de candidatos nem em sites com anti-robô.

#### Conferir

1. Em Admin → Radar, clique em **Verificar agora**.
2. A fonte deixa de aparecer como "página sem texto".
3. Os concursos encontrados aparecem como **pendentes**: aprove ou rejeite cada um na revisão
   do Radar. Nada dessas fontes chega aos alunos sem a sua aprovação.
4. No painel do Firecrawl, acompanhe os créditos gastos.

**Mensagens de erro que podem aparecer na fonte:** "renderização não configurada" (falta a chave),
"renderização sem crédito" (acabaram os créditos), "bloqueado pelo robots.txt" (o site não permite),
"renderização com proxy não permitido" (o Firecrawl tentou contornar anti-robô e o Radar recusou).

**Para desligar:** rode o mesmo SQL com `render_mode = 'direto'`, ou apague o secret no Lovable.

</details>

## Passo 6 — Varredura semanal de repositórios

Não precisa configurar nada. Toda **segunda-feira, às 6h33 (Brasília)**, uma sessão nova do Claude
roda no ambiente "Level Up". Ela pesquisa os repositórios em alta (GitHub, Trendshift, OSS Insight
e Hacker News), avalia com os agentes, abre um PR com o relatório e **manda uma notificação no seu
celular**.

1. Abra a notificação e leia as recomendações numeradas.
2. Responda na própria conversa: `de acordo: 1, 3` (ou `nenhum`).
3. Revise e faça o merge do PR com o relatório.

Nada é instalado sem o seu "de acordo". Para pausar ou mudar o horário, me peça numa conversa.

## Passo 7 — Escolher as próximas correções

A avaliação encontrou falhas reais no app. Diga quais eu devo atacar primeiro, por exemplo
"comece pelo 8f e pelo 8j":

| Item | O que é | Por que importa |
| --- | --- | --- |
| 8e | Não existe opção de **excluir a conta** dentro do app | As lojas (Apple e Google) recusam o app sem isso; a LGPD também exige |
| 8f | O app não respeita a preferência de **reduzir animações** (o timer pulsa, a alternativa errada "sacode") | Acessibilidade para quem tem sensibilidade a movimento |
| 8g | Falta pedir **consentimento** antes de mandar o texto do aluno ao Mentor e à Discursiva | Exigência da App Store e transparência da LGPD |
| 8h | O Radar publica sem revisão quando mudam vagas, salário ou banca de um concurso já conhecido | Informação errada chega aos alunos sem conferência humana |
| 8i | O nome e a esfera de um concurso novo entram sem passar pelo verificador | Mesma razão do 8h |
| 8j | No Mercado Pago, com código de indicação, a tela mostra o preço cheio, mas a cobrança sai com desconto | O aluno vê um preço e paga outro |
| 8k | Documentos desatualizados em relação ao código | Os agentes erram quando a documentação está errada |

---

## Para depois (não precisa agora)

- **Codex (opcional):** as revisões automáticas do Codex no GitHub pararam porque a cota da sua
  conta do ChatGPT acabou. Não bloqueia nada; o projeto tem os próprios revisores.
- **App nas lojas (decisão D5):** quando decidir, um advogado precisa ler a licença do
  `app-store-compliance` (OpenRoots Agent License 2.3, que cobra royalty acima de US$ 20 milhões de
  receita) antes de usarmos esse material.
- **Pendências de sessões anteriores** (migrations de IA, do Radar e do Mercado Pago, decisões
  D5, D6, D7 e D10): estão em `AGENTS-COLLAB.md`, nas seções "Decisões ativas" e "Backlog priorizado".

**Onde ver tudo o que foi avaliado:** [Radar de repositórios](RADAR_REPOSITORIOS.md).
