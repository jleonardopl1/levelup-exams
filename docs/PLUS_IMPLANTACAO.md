# Funcionalidades Plus v1 — implantação

O que entrou e o que precisa ser feito para ficar no ar. Contexto e motivos em `docs/PROPOSTA_PLUS.md`.

## O que muda para o aluno

| Funcionalidade | Onde | Free | Plus |
|---|---|---|---|
| Simulado Oficial (70 questões no formato do edital) | Trilha → Simulado Oficial (`/trilhas/:slug/simulado`) | 1 a cada 30 dias | ilimitado |
| Posição entre candidatos do cargo | resultado do Simulado Oficial | metade de cima/baixo | posição, percentil, % habilitados |
| Revisão espaçada dos erros | card "Revisão de hoje" (início e trilha), `/quiz?mode=srs` | 5 por dia | fila inteira |
| Correção da discursiva | Trilha → Treine a discursiva (`/trilhas/:slug/discursiva`) | — | 3 por semana |
| Mentor IA com contexto + "Explicar esta questão" | resultado do quiz e do simulado | — | 6 perguntas/dia + 20 explicações/dia |
| PDF do resultado com explicações | resultado do quiz e do simulado | — | sim (janela de impressão → Salvar como PDF) |
| Passe Concurso (pagamento único até a prova + 15 dias) | Planos | compra | — |

A lista de benefícios de Planos, FAQ e modais agora sai de `src/config/plans.ts`. Saíram as promessas que não existiam: "sem anúncios", "acesso prioritário", "Mentor IA ilimitado" e "estatísticas avançadas".

## Passos de implantação (nesta ordem)

1. **Migrations**
   - `20261115120000_plus_features_v1.sql` — Simulado Oficial, posição, revisão espaçada, Passe Concurso, `grant_kind` em `get_premium_access`, meta semanal das específicas = 42.
     **Redefine `validate_answer`** (RPC em produção) com uma única checagem nova: questão de Simulado Oficial aberto do próprio aluno não é corrigida (senão o gabarito vazaria durante a prova).
   - `20261115130000_essay_reviews.sql` — tabela `essay_submissions`, cota semanal atômica.
   - `20261115140000_plus_internal_grants.sql` — tira de `authenticated` o EXECUTE das funções internas (`grant_exam_pass`, `begin_essay_submission` e auxiliares), que o Supabase concede por padrão.
2. **Edge Functions** (no Lovable Cloud a publicação é automática): `essay-review` (nova), `ai-mentor`, `create-checkout`, `stripe-webhook`, `check-subscription`, `generate-track-questions`.
3. **Passe Concurso (opcional)** — sem isso a opção simplesmente não aparece em Planos:
   - no Stripe, criar um **preço avulso** (one-time) no valor escolhido;
   - secret `STRIPE_PRICE_EXAM_PASS` = id desse preço;
   - o webhook do Stripe precisa receber `checkout.session.completed` e `checkout.session.async_payment_succeeded` (já estão na lista tratada pela função).
4. **Opcional:** secret `ESSAY_MODEL` (padrão `google/gemini-2.5-pro`) para a correção da discursiva.
5. **Conferir no edital** a duração da prova objetiva e gravar em `study_tracks.rules.duracao_minutos` (hoje o padrão é 240 minutos). A nota mínima usa `rules.nota_minima` (padrão 40).

## Como foi verificado

- `npm run typecheck` e `npm run build` passam; `npm run lint` sem erros novos (os 9 erros e 48 avisos já existiam).
- `node docs/proposta-plus/validate.mjs` (Postgres em memória com todas as migrations e o seed da trilha): 51 verificações — formato 15/15/40, gabarito só ao entregar (inclusive via `validate_answer`), nota ponderada, regra de habilitação, idempotência, cota Free, revisão espaçada (intervalos, limite diário, compressão perto da prova), posição Free × Plus, Passe Concurso (idempotente, recusa cliente), cota da discursiva, consultas de negócio.
- `deno check` nas 6 Edge Functions alteradas e `deno test supabase/functions/essay-review/rubric.test.ts` (nota da discursiva calculada no servidor).
- Teste de navegador (build de produção, Supabase simulado na rede): fluxo completo do Simulado Oficial como Plus e como Free, revisão, Mentor por questão, discursiva, Planos com o Passe Concurso.

Não verificado: chamadas reais ao modelo (tema e correção da discursiva, contexto do Mentor) e um pagamento real do Passe no Stripe — precisam de teste no ambiente de staging/produção. A corrida entre "salvar resposta" e "entregar prova" é protegida pelo mesmo `FOR UPDATE` nas duas funções, mas só foi verificada pela presença da trava (o banco de teste tem uma conexão).

## Implantação em produção (15/11/2026)

| Passo | Como | Resultado |
|---|---|---|
| Código no `main` | PR #19 mesclado (`d1cc708`); a Lovable sincronizou | ok |
| Migrations 20261115120000, 130000 e 140000 | aplicadas no banco do Lovable Cloud, cada uma numa transação, e registradas em `supabase_migrations.schema_migrations` (mesmo padrão das anteriores) | ok |
| Teste real no banco de produção | fluxo completo com um aluno gratuito temporário, numa transação desfeita no fim (nada ficou gravado): 70 questões (40 específicas), gabarito bloqueado durante a prova, nota 85 com Básicos zerados = não habilitado, 2º simulado do mês bloqueado, 15 erros agendados para o dia seguinte, cota da discursiva 0/3, aluno sem acesso a `grant_exam_pass` | ok |
| Front-end | publicado pela Lovable; `levelupexams.com.br` serve a versão nova | ok |
| Edge Functions | publicadas pelo agente da Lovable (`essay-review` nova + 5 alteradas); `essay-review` responde 401 sem login | ok |
| API | as RPCs novas existem e recusam chamadas anônimas (42501) | ok |
| Teste de navegador no site publicado | 27/27 (login e dados simulados na rede) | ok |

Ao publicar as funções, o agente da Lovable fez 3 commits no `main`: `deno.lock`, `types.ts` regerado a partir do banco real (com um cast em `saveMockAnswer`) e o `AuthContext` como singleton para o hot-reload do editor. Os três foram revisados: não mudam o comportamento em produção.

Ainda pendente (depende de você): criar o preço avulso do Passe Concurso no Stripe e o secret `STRIPE_PRICE_EXAM_PASS`; até lá a opção não aparece em Planos. Também falta conferir a duração da prova no edital. Não foram testados com usuário real: as chamadas à IA (tema e correção da discursiva, contexto do Mentor) e um pagamento no Stripe.

## Ficou para depois

- **Plano até a prova** (proposta 7) e **estatísticas avançadas** (proposta 9, depende de gravar o tempo por questão).
- **Confira sua nota** pós-prova (proposta 8): depende do formato do gabarito oficial (caderno/tipo de prova), divulgado em 21/12.
