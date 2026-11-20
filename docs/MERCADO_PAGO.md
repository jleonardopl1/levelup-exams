# Mercado Pago · Pix e Plus anual parcelado

Plano para incluir o Mercado Pago como segundo meio de pagamento, ao lado da Stripe. Com ele, o
aluno passa a pagar o **Plus anual** e o **Passe Concurso** por **Pix** ou no **cartão em até 12
parcelas**. As assinaturas atuais na Stripe continuam como estão.

Responsável pela faixa: `pagamentos`. Revisão obrigatória: `security-reviewer`. Nada vai a
produção (secrets, migration, publicação de função, modo live) sem aprovação do dono (D4).
Base de código: `699c5fe`. Contexto anterior: [crescimento e pagamentos](CRESCIMENTO_E_PAGAMENTOS.md),
[implantação do Plus](PLUS_IMPLANTACAO.md), [afiliados](ADMIN_E_AFILIADOS.md).

## Estado da implementação (2026-11-20)

O código da fase 1 está na `main` ([PR #30](https://github.com/jleonardopl1/levelup-exams/pull/30)
e correções da revisão de segurança) e **desligado** (`MP_ENABLED` ausente): sem os secrets, os
botões do Mercado Pago não aparecem e nada muda para o aluno. As fases 0, 2, 3 e 4 (§8) dependem
do dono e do Financeiro.

| Peça | Onde | Verificação local |
| --- | --- | --- |
| Pedidos, eventos, máquina de estados, acesso pago como fonte do plano, visão do admin | migrations `20261120120000_mercadopago_payment_orders.sql` e `20261120130000_mercadopago_hardening.sql` | `node supabase/tests/mercadopago.validate.mjs`: 70 verificações; `docs/proposta-plus/validate.mjs` continua passando |
| Assinatura, validação do pagamento, preferência, cliente HTTP | `supabase/functions/_shared/mercadopago.ts` | `mercadopago.test.ts`: 9 testes (entra no `bun run test:edge`) |
| Checkout, webhook e sincronização | `mp-create-checkout`, `mp-webhook`, `mp-sync-order` | `deno check` com os imports remotos trocados pelos do npm (a sessão não alcança `deno.land`/`esm.sh`; a CI confere com os originais) |
| Travas na Stripe e fonte `mercadopago` | `create-checkout`, `check-subscription`, `_shared/referral.ts`, `_shared/exam-pass.ts` | idem; os 76 testes anteriores das funções passam |
| Planos, volta do checkout, renovação, pagamento em aberto | `src/pages/Upgrade.tsx`, `src/hooks/useSubscription.ts`, `src/lib/checkout.ts` | `checkout.test.ts` (7 testes) + 16 verificações no navegador com o Supabase simulado na rede |
| Admin | `AdminPlatformOverview.tsx` (vendas reais, estornos, Pix/parcelado, revisão, pagamentos de teste à parte), selo "pago no Mercado Pago" | typecheck e build |
| Textos | Termos (seção 3), Privacidade, FAQ | revisar com o jurídico antes de ligar (§2, decisão g) |

Diferenças em relação ao plano abaixo: as cinco entregas da fase 1 entraram como commits do mesmo
PR (a sessão só pode publicar num branch), e a receita do Mercado Pago aparece em
`admin_platform_overview` (lida do banco), não no `admin-metrics`, que continua só com a Stripe.

### Revisão de segurança (2026-11-20)

O `security-reviewer` não achou nada crítico nem alto. O acesso só vem do pagamento relido na API
e conferido contra o pedido. Correções feitas a partir dos achados:

| Achado | Correção |
| --- | --- |
| Médio: pagamento feito com credenciais de teste viraria acesso Plus real e receita | `MP_LIVE_MODE` (padrão: produção) e `MP_COLLECTOR_ID` obrigatórios; o pedido guarda `live_mode` e recusa pagamento de outro ambiente; pagamento de teste dá no máximo 24 h de acesso e fica fora das vendas; `MP_ENABLED=staff` mostra a oferta só para a equipe |
| Baixo: reentrega do webhook com corpo trocado gerava novas consultas | chave de reentrega só com campos assinados (`data.id` + `x-request-id` + `ts`); pagamento inexistente (404) não é repetido |
| Baixo: corpo do webhook lido antes de checar o tamanho | recusa pelo `Content-Length` antes de ler |
| Baixo: mesmo código de indicação com desconto em dois pedidos abertos | `create_payment_order` recusa (`referral_in_use`); desconto concedido sem comissão nova fica marcado para o Financeiro |
| Baixo: comissão registrada quando o primeiro estado lido já era estorno | comissão só com aprovação (`paid`, `partially_refunded`, `in_dispute`) |
| Baixo: nome do concurso ia ao Mercado Pago, ao contrário do aviso de privacidade; eventos sem retenção | título genérico do Passe; notificações apagadas depois de 180 dias |
| Observação: sincronização não reconsultava pedido recusado; Passe sem teto de duração | `mp-sync-order` reconsulta `failed`/`canceled`; Passe só para prova nos próximos 12 meses (vale também na Stripe) |
| Teste de permissões não simulava as concessões padrão do Supabase | o PGlite agora concede `EXECUTE` a `anon`/`authenticated` como o Supabase, e os testes conferem os `REVOKE` |

Ficaram para decisão ou backlog (sem impacto enquanto desligado): reconciliação periódica de
pedidos pagos (estorno com webhook perdido), lista dos pedidos para revisão no admin, estorno
automático da comissão, retenção fiscal ao excluir a conta (`ON DELETE CASCADE`) e verificação de
idade antes do pagamento (ECA Digital, D6).

### Como ligar (com o dono)

1. Aplicar, nesta ordem, as migrations `20261120120000_mercadopago_payment_orders.sql` e
   `20261120130000_mercadopago_hardening.sql` pelo Lovable (não leem o Vault nem agendam cron; o
   job horário `expire-premium-grants` já existe e passa a encerrar pedidos vencidos e apagar
   notificações antigas). Depois, regerar `types.ts`.
2. Publicar `mp-create-checkout`, `mp-webhook`, `mp-sync-order`, `create-checkout` e
   `check-subscription` (a segunda migration muda a assinatura das RPCs: publicar as funções desta
   versão).
3. No painel do Mercado Pago (Suas integrações → Webhooks), cadastrar
   `https://<projeto>.supabase.co/functions/v1/mp-webhook` no tópico **Pagamentos** e copiar a
   assinatura secreta.
4. **Fase 2, homologação só com a equipe:** secrets com as credenciais de **teste** —
   `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_COLLECTOR_ID` (id da conta vendedora de teste),
   `MP_LIVE_MODE=false`, `MP_PRICE_PLUS_ANNUAL_CENTS` (ex.: `15990`), `MP_PRICE_EXAM_PASS_CENTS`,
   `MP_MAX_INSTALLMENTS` (padrão 12), `MP_INTEREST_FREE_INSTALLMENTS` (igual à configuração da
   conta; padrão 1 = sem promessa de "sem juros") e, por último, `MP_ENABLED=staff`. Rodar o
   roteiro da fase 2 com contas da equipe; o acesso de teste dura no máximo 24 h.
5. **Fase 3, produção controlada:** trocar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e
   `MP_COLLECTOR_ID` pelos de produção e remover `MP_LIVE_MODE` (ou `true`). Manter
   `MP_ENABLED=staff` para as compras reais da equipe com estorno.
6. **Fase 4, abertura:** `MP_ENABLED=true`. `MP_NOTIFICATION_URL` é opcional: só se a homologação
   mostrar que as notificações da preferência chegam assinadas (§5.3).

Para desligar a qualquer momento, remover `MP_ENABLED`: o checkout some; webhook e sincronização
continuam tratando estornos.
---

## 1. O que muda para o aluno

| Oferta | Provedor | Meios | Renovação | Acesso |
| --- | --- | --- | --- | --- |
| Plus mensal | Stripe (sem mudança) | cartão | automática | enquanto a assinatura estiver ativa |
| Plus anual com renovação | Stripe (sem mudança) | cartão | automática | enquanto a assinatura estiver ativa |
| **Plus anual pré-pago** (novo) | Mercado Pago | Pix à vista ou cartão em até 12x | **nenhuma**: o aluno renova quando quiser | 12 meses a partir da confirmação; uma renovação antecipada soma 12 meses ao fim do período atual |
| Passe Concurso | Stripe (sem mudança) **e** Mercado Pago (novo) | cartão (Stripe); Pix ou cartão parcelado (MP) | nenhuma | até a prova + 15 dias (regra atual) |

"Anual parcelado" aqui é **um pagamento único dividido no cartão**, e não uma assinatura de 12
cobranças. O limite do cartão é comprometido pelo total; o LevelUp recebe conforme o contrato com
o Mercado Pago. Por isso o anual pré-pago não tem renovação automática nem portal de cancelamento.
O aluno recebe lembrete antes do vencimento e renova por escolha própria.

---

## 2. Decisões do dono antes do código (D14)

| # | Pergunta | Recomendação |
| --- | --- | --- |
| a | Preço do anual no Mercado Pago | Igual ao da Stripe (R$ 159,90). Preço diferente por meio de pagamento confunde a página de Planos. |
| b | Quem paga os juros do parcelamento | Decidir com a cotação do Financeiro. Se o custo do "12x sem juros" (parcelado vendedor) deixar a contribuição por venda **≥** a do anual na Stripe, anunciar "em até 12x sem juros". Se não, anunciar "em até 12x" com juros do comprador e sem juros até 3x. A configuração fica na conta do Mercado Pago (Seu negócio → Custos), não no código. |
| c | Desconto para Pix | Não no lançamento. Primeiro medir qual meio o aluno escolhe sem incentivo. |
| d | Boleto | Excluir. A confirmação leva dias e ninguém pediu. |
| e | Saldo da conta Mercado Pago | Aceitar. O Checkout Pro não permite excluir "dinheiro em conta". |
| f | Asaas | Pausar. O relatório de crescimento recomenda homologar **um provedor por vez**; o Mercado Pago passa a ser o primeiro. |
| g | Reembolso fora dos 7 dias de arrependimento | Sem reembolso proporcional no anual pré-pago, como já ocorre no cancelamento do Plus (acesso até o fim do período pago). Exceções ficam com o Financeiro. Confirmar com o jurídico antes de publicar os termos. |
| h | Comissão de afiliado | Mesma regra de hoje: primeira compra do indicado, percentual vigente, sobre o valor do produto já com desconto (sem os juros do parcelamento). Reembolso e chargeback deixam a comissão marcada para revisão do Financeiro antes do repasse. |

---

## 3. Produto do Mercado Pago escolhido: Checkout Pro

O **Checkout Pro** é a página de pagamento hospedada pelo Mercado Pago. O servidor cria uma
*preferência* (`POST /checkout/preferences`), o app redireciona para o `init_point` e o aluno
volta por `back_urls`. É o mesmo modelo que o app já usa com o Stripe Checkout.

- **Por quê:** o QR Code do Pix, a escolha de parcelas e os dados do cartão ficam na página do
  Mercado Pago. O LevelUp não toca em dado de cartão nem coleta CPF. É a integração mais curta.
- **Por que não assinatura (`/preapproval`) agora:** assinatura cobra todo mês. O pedido é pagar o
  ano parcelado, que é um pagamento único. Pix recorrente (Pix Automático) para o mensal fica para
  uma fase posterior (§11).
- **Por que não Checkout Bricks / Transparente agora:** mantêm o aluno na página, mas exigem o SDK
  do Mercado Pago no front, mudanças de CSP e tratamento do Pix na tela. Reavaliar se o abandono
  entre o redirecionamento e o pagamento ficar alto.

Campos da preferência que o servidor preenche (confirmar cada um na
[referência da API](https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro-preferences/create-preference/post)
durante a homologação):

| Campo | Valor |
| --- | --- |
| `items` | 1 item, `currency_id: "BRL"`, `unit_price` calculado **no servidor** (preço da oferta − desconto de indicação) |
| `external_reference` | id do pedido interno (`payment_orders.id`) |
| `payment_methods.installments` | máximo de parcelas (secret, padrão 12) |
| `payment_methods.excluded_payment_types` | `ticket` (boleto) |
| `back_urls` + `auto_return: "approved"` | `${SITE_URL}/upgrade?pedido=<id>`; nunca o header `Origin` (mesma regra do Stripe) |
| `expires`, `expiration_date_to` | validade curta da preferência (ex.: 60 min); conferir também a validade do QR do Pix |
| `statement_descriptor` | `LEVELUP` (nome na fatura do cartão) |
| `payer.email` | e-mail confirmado da conta |
| `notification_url` | ver §5.3 sobre a assinatura do webhook |

Use sempre o `init_point`. O `sandbox_init_point` está descontinuado.
[Meios de pagamento no Checkout Pro](https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-settings/payment-methods)
· [Parcelamento sem juros no Checkout Pro](https://www.mercadopago.com.br/blog/checkout-pro-parcelamento-sem-juros)

---

## 4. Como encaixa no que existe

```
Planos ──► mp-create-checkout ──► payment_orders (created) ──► preferência (external_reference = pedido)
   ▲                                                                  │
   │                                                                  ▼
/upgrade?pedido=<id> ◄── back_url ◄──────────────── página do Mercado Pago (Pix / cartão 12x)
   │                                                                  │
   └─► mp-sync-order (consulta o pedido)                              ▼ notificação "payment"
                          │                                   mp-webhook (confere x-signature)
                          ▼                                           │
                GET /v1/payments  ─────────────►  apply_mp_payment (RPC atômica e idempotente)
                                                     ├─ pedido: paid / refunded / …
                                                     ├─ acesso Plus (fonte "mercadopago")
                                                     └─ comissão do afiliado (uma vez)
```

**Regra central: `profiles.billing_tier` continua sendo só da Stripe.** O `check-subscription`
grava nesse campo o que a Stripe responde. Se o acesso pago pelo Mercado Pago fosse gravado ali,
a próxima sincronização o apagaria. O acesso do Mercado Pago entra como **mais uma fonte** no
cálculo do plano efetivo (`profiles.tier`), ao lado da Stripe, da cortesia e do admin master.

O Passe comprado pela Stripe continua em `exam_pass_purchases` + `premium_grants`, sem migração.
O Passe comprado pelo Mercado Pago entra em `payment_orders`, como o anual.

---

## 5. Implementação

### 5.1 Banco (`arquiteto-dados` especifica, `supabase-db` implementa)

Migration nova, idempotente e tolerante à ordem de publicação (§8). Agendamento do pg_cron em
arquivo separado (armadilha do Vault no Lovable).

**`payment_orders`** — um pedido por tentativa de compra.

| Coluna | Observação |
| --- | --- |
| `id uuid` PK | vai como `external_reference` |
| `user_id` | dono do pedido (sessão, nunca o corpo da requisição) |
| `provider` | `'mercadopago'` (preparado para outros) |
| `product` | `'plus_annual'` \| `'exam_pass'` |
| `track_id` | só no Passe |
| `list_amount_cents`, `discount_cents`, `amount_cents`, `currency` | preço, desconto e valor cobrado, em centavos |
| `referral_code_id` | indicação validada no servidor |
| `status` | `created` → `pending` → `paid` → `partially_refunded` \| `refunded` \| `charged_back` \| `in_dispute`; ou `failed`, `canceled`, `expired` |
| `provider_preference_id`, `provider_payment_id` (único), `checkout_url` | ids do Mercado Pago; `checkout_url` permite reaproveitar o pedido pendente |
| `payment_method_type`, `installments` | ex.: `bank_transfer` (Pix), `credit_card` + 12 |
| `access_kind`, `access_months`, `access_until_fixed` | anual = 12 meses; Passe = data fixa (prova + 15 dias) |
| `paid_at`, `access_revoked_at`, `commission_review` | datas e marcação para o Financeiro |
| `created_at`, `updated_at`, `expires_at` | |

RLS ligada; `anon` e `authenticated` sem acesso direto. O aluno lê os próprios pedidos por RPC
com colunas limitadas.

**`payment_provider_events`** — registro durável de cada notificação recebida (provedor, id da
notificação, tipo, id do pagamento, recebido/processado em). Só metadados. Serve para auditoria e
para descartar reentregas.

**RPCs (todas `SECURITY DEFINER`, `search_path` fixo, `EXECUTE` revogado de `PUBLIC`/`anon`):**

- `create_payment_order(...)` — `service_role`. Reaproveita o pedido `created`/`pending` do mesmo
  aluno, produto e trilha ainda dentro da validade, para não gerar dois QR Codes.
- `apply_mp_payment(order_id, payment_id, status, status_detail, amount_cents, refunded_cents, method, installments, paid_at)`
  — `service_role`. Trava o pedido (`FOR UPDATE`), aplica a máquina de estados (tabela abaixo),
  recalcula o plano e registra a comissão na primeira aprovação, chamando
  `record_referral_conversion` com a chave `mp:<order_id>` (cabe no índice único atual).
- `get_my_payment_orders()` — `authenticated`, só os pedidos do próprio aluno.
- `_paid_access_until(user_id)` — fim do acesso pago pelo Mercado Pago, calculado dos pedidos
  `paid`/`partially_refunded`/`in_dispute` não revogados, em ordem de pagamento: cada anual soma 12
  meses a partir do maior entre a data do pagamento e o fim anterior; o Passe vale até a data
  fixa. Calcular na leitura faz um estorno do primeiro anual não abrir buraco no segundo.

**Funções existentes que mudam (`CREATE OR REPLACE` com o corpo completo):**
`_premium_source` (nova fonte `'mercadopago'`, depois de `master` e `stripe`, antes de `grant`),
`sync_profile_effective_tier`, `get_user_tier`, `get_premium_access` (devolve também `paid_until` e
mantém `grant_kind`), `expire_premium_grants` (passa a rebaixar quem perdeu o acesso pago) e as
métricas de admin que hoje contam só `billing_tier`.

**Máquina de estados (status do pagamento → efeito):**

| Status no Mercado Pago | Pedido | Acesso | Comissão |
| --- | --- | --- | --- |
| `pending`, `in_process`, `authorized` | `pending` | nenhum | nenhuma |
| `approved` | `paid` | concede | registra uma vez |
| `approved` com valor estornado parcial | `partially_refunded` | mantém | marca para revisão |
| `refunded` | `refunded` | revoga este pedido | marca para revisão |
| `charged_back` | `charged_back` | revoga este pedido | marca para revisão |
| `in_mediation` | `in_dispute` | mantém; alerta ao admin | marca para revisão |
| `rejected`, `cancelled` | `failed` / `canceled` | nenhum | nenhuma |

Estados finais (`refunded`, `charged_back`) nunca voltam a `paid`. Um pagamento aprovado depois de
o pedido expirar é honrado (`expired` → `paid`). Dois pedidos do mesmo produto pagos em 24 h ficam
marcados como possível duplicidade para o Financeiro devolver um.

### 5.2 Edge Functions (`edge-functions`)

Funções novas separadas da Stripe: o caminho atual não muda, e cada uma pode ser publicada ou
desligada sozinha. `verify_jwt = false` em `supabase/config.toml`, como as demais (a autenticação
é feita no código).

- **`_shared/mercadopago.ts`** — cliente HTTP com `MP_ACCESS_TOKEN`, prazo, `X-Idempotency-Key`,
  sem repetir erro 4xx; `verifyMpSignature` (HMAC-SHA256, comparação em tempo constante);
  `fetchPayment`, `searchPaymentsByExternalReference`; funções puras de mapeamento de status e de
  montagem da preferência, para teste.
- **`_shared/referral.ts`** — mover `resolveReferral` do `create-checkout` para cá e usar nos dois
  provedores (mesmas regras: código ativo, não é o próprio, primeiro uso).
- **`mp-create-checkout`** (POST, autenticado) — entrada `{ product, trackId?, referralCode?, preview? }`.
  Confere: interruptor ligado, e-mail confirmado, limite de requisições, oferta válida, aluno sem
  assinatura ativa na Stripe e sem acesso que já cubra o período (Passe). Cria ou reaproveita o
  pedido, cria a preferência com `X-Idempotency-Key = order.id`, devolve `{ url, orderId }`.
  Com `preview: true`, devolve preço, máximo de parcelas e parcelas sem juros, para a tela mostrar
  o mesmo valor que será cobrado.
- **`mp-webhook`** (POST, sem CORS) — limite de tamanho; confere `x-signature` antes de qualquer
  coisa; ignora tipos diferentes de `payment`; grava o evento; **relê o pagamento na API** (o corpo
  da notificação é só um aviso); confere `collector_id`, `live_mode`, `currency_id`, valor e
  `external_reference` contra o pedido; chama `apply_mp_payment`; responde 200. Em falha
  temporária, libera o evento e responde 500 para o Mercado Pago tentar de novo (mesmo padrão do
  `stripe-webhook`; o processamento é curto e cabe no prazo da notificação).
- **`mp-sync-order`** (POST, autenticado) — consulta o pedido do próprio aluno no Mercado Pago
  pelo `external_reference` e aplica o resultado. Usado na volta do checkout e pelo suporte. Cobre
  webhook atrasado ou perdido.
- **`check-subscription`** — inclui o acesso do Mercado Pago na resposta (`source: 'mercadopago'`,
  `access_until`). Hoje, com a Stripe fora do ar, a função só responde se a fonte for cortesia ou
  master; passa a responder também para `mercadopago`.
- **`create-checkout` (Stripe)** — recusa nova assinatura de quem tem anual pré-pago ativo
  ("Seu Plus vale até DD/MM/AAAA") e trata o Passe da mesma forma que hoje trata a cortesia.
- **Painel do admin** — vendas, estornos, Pix/parcelado, pedidos em aberto e itens para o
  Financeiro revisar saem de `admin_platform_overview` (lidos de `payment_orders`). O
  `admin-metrics` continua só com a Stripe; o anual pré-pago não entra no MRR.

**Secrets (o dono cadastra; nunca no código):** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`,
`MP_COLLECTOR_ID` (id da conta recebedora, obrigatório), `MP_LIVE_MODE` (`false` só com credenciais
de teste), `MP_PRICE_PLUS_ANNUAL_CENTS`, `MP_PRICE_EXAM_PASS_CENTS`, `MP_MAX_INSTALLMENTS`,
`MP_INTEREST_FREE_INSTALLMENTS` (só para exibir) e `MP_ENABLED` (`staff` = só a equipe; `true` =
todos). Sem `MP_ENABLED` a prévia responde `available: false` e o botão não aparece.
Atualizar a lista de segredos em `rules/common/security.md`.

### 5.3 Webhook: assinatura e duplicidade

Registrar o webhook no painel do Mercado Pago (Suas integrações → Webhooks, tópico `payment`)
para obter o segredo de assinatura. O Checkout Pro também envia `merchant_order`; a função ignora
esse tópico. Se a preferência tiver `notification_url`, o Mercado Pago avisa por ela também. Na
homologação, confirmar que **toda** notificação recebida traz `x-signature` válido. Se uma das
rotas vier sem assinatura, deixar só a do painel. Notificação sem assinatura válida é recusada.
Como o estado sempre é relido na API, uma notificação forjada não concede acesso.

### 5.4 Front (`frontend` + `designer`)

- **Planos (`src/pages/Upgrade.tsx`)** — no card do anual, dois botões:
  "Assinar no cartão · renova todo ano" (Stripe) e "Pagar com Pix ou em até 12x" (Mercado Pago),
  com a linha "12 meses de Plus. Sem renovação automática." No Passe, "Pagar com Pix ou cartão".
  Valores e parcelas vêm da prévia do servidor; `PRICES` de `src/config/plans.ts` continua para a
  Stripe.
- **Redirecionamento** — `openStripeUrl` vira `openCheckoutUrl` com lista de hosts exatos:
  os dois da Stripe e o host do `init_point` do Mercado Pago confirmado na homologação. A regra
  sai para `src/lib/` com teste `node --test`.
- **Volta do checkout** — `/upgrade?pedido=<id>` nunca confia nos parâmetros da URL. Consulta
  `mp-sync-order` e mostra:
  aprovado ("Pronto! Seu Plus vale até 20/11/2027."), Pix pendente ("Estamos esperando a
  confirmação do Pix. Costuma levar poucos segundos." + nova consulta a cada 5 s por até 2 min e
  botão "Já paguei"), recusado ("O pagamento não foi aprovado. Tente outro cartão ou o Pix.") e
  expirado.
- **Configurações** — "Plus anual pago pelo Mercado Pago, válido até DD/MM/AAAA". Nos últimos 30
  dias, botão "Renovar por mais 12 meses". Pix pendente aparece com o link para retomar.
- **Lembretes de vencimento** — e-mail transacional 15 e 3 dias antes do fim do anual pré-pago
  (cron diário + modelo de e-mail existente).
- **FAQ, Termos e Privacidade** — FAQ com Pix e parcelamento. Termos, seção 3: hoje dizem "assinatura
  … cobrada no cartão pelo Stripe"; passam a descrever o anual pré-pago (sem renovação, 7 dias de
  arrependimento com devolução pelo mesmo meio, estorno no cartão parcelado feito pela operadora).
  Privacidade: o Mercado Pago passa a tratar dados de pagamento; o LevelUp envia só e-mail e o id
  do pedido, e não guarda CPF nem dados de cartão.
- Textos seguem `rules/common/writing.md`, revisados pelo `designer`.

---

## 6. Segurança e privacidade (checklist do `security-reviewer`)

- [ ] O cliente envia só a intenção (`product`, `trackId`, `referralCode`). Preço, desconto,
      parcelas e validade são definidos no servidor.
- [ ] `x-signature` conferido com HMAC-SHA256 e comparação em tempo constante, antes de ler o corpo.
- [ ] Estado sempre relido em `GET /v1/payments/{id}`; conferidos conta recebedora, ambiente,
      moeda, valor e `external_reference`.
- [ ] Idempotência em três níveis: notificação (`payment_provider_events`), pagamento
      (`provider_payment_id` único) e efeito de negócio (máquina de estados com `FOR UPDATE`).
- [ ] `back_urls` fixas a partir de `SITE_URL`; redirecionamento do front só para hosts exatos.
- [ ] RLS nas tabelas novas; RPCs com `search_path` fixo e chamador conferido.
- [ ] Limite de requisições em `mp-create-checkout` e `mp-sync-order`; limite de tamanho no webhook.
- [ ] Erro ao aluno sem mensagem do provedor; log sem token, e-mail ou corpo da notificação.
- [ ] Minimização (LGPD): sem CPF, sem dado de cartão, sem nome do pagador no banco.
- [ ] Payload de webhook tratado como dado não confiável (`rules/common/security.md`).

---

## 7. Testes (`tester`)

| Camada | O que cobre | Como |
| --- | --- | --- |
| Lógica pura das funções | assinatura (casos válido, alterado, `ts` ausente), mapeamento de status, montagem da preferência, desconto em centavos | `deno test` em `_shared/mercadopago.test.ts` (entra no `bun run test:edge`) |
| Banco | pedido reaproveitado; aprovação idempotente; reentrega; ordem trocada (estorno antes da reentrega da aprovação); renovação somando 12 meses; estorno do primeiro anual sem buraco no segundo; Passe sem encurtar acesso maior; expiração pelo cron; `billing_tier = 'free'` da Stripe não derruba o acesso do Mercado Pago; comissão uma única vez | estender `docs/proposta-plus/validate.mjs` (Postgres em memória com as migrations) |
| Front | lista de hosts de redirecionamento; formatação de parcelas | `node --test` em `src/lib/` |
| Sandbox do Mercado Pago | roteiro da §8, fase 2 | usuários de teste comprador/vendedor e cartões de teste (`APRO`, `OTHE`, `CONT`) |

---

## 8. Homologação e lançamento

| Fase | Quem | Entrega | Avança quando |
| --- | --- | --- | --- |
| **0. Conta** (em paralelo ao código) | Dono e Financeiro | Conta PJ do Mercado Pago aprovada, chave Pix cadastrada, proposta de taxas (Pix, crédito à vista e parcelado, parcelado vendedor, prazo de liberação, estorno, chargeback), credenciais de teste e produção, segredo do webhook. Respostas às decisões da §2. | Conta habilitada para Pix e cartão; decisões a–h registradas em D14. |
| **1. Código** | faixas da §9 | 5 PRs pequenos (abaixo), tudo com `MP_ENABLED` desligado. CI verde. | `security-reviewer` e `reviewer` aprovam. |
| **2. Sandbox** | `pagamentos` + `tester` | Casos: anual no Pix; anual em 12x; Passe no Pix; cartão recusado; pagamento pendente (`CONT`); Pix pendente que expira; pagamento após expirar; mesma notificação 3 vezes; webhook desligado (só `mp-sync-order`); estorno total e parcial; aluno com assinatura Stripe tentando o anual; renovação antecipada; comissão de indicação. Conferir se o sandbox permite aprovar um Pix; se não, esse caso vai para a fase 3. | Todos os casos com o resultado esperado e registro no `audit_logs`. |
| **3. Produção controlada** | Dono + Financeiro | Publicar migration e funções (via Lovable), cadastrar secrets, ligar só para contas da equipe. Uma compra real no Pix e uma no cartão parcelado, com estorno. | Recebimento, estorno e liquidação conferidos no extrato; acesso e comissão corretos. |
| **4. Abertura** | Dono | Ligar para todos. Acompanhar 2 semanas: escolha do meio, abandono no checkout, Pix pendente sem pagamento, estornos, contribuição por venda. | Conciliação de todas as vendas do período sem divergência. |

**Ordem dos PRs da fase 1:**
1. Migration + testes de banco (sem efeito visível).
2. `_shared/mercadopago.ts`, `_shared/referral.ts`, `mp-webhook`, `mp-sync-order` + testes Deno.
3. `mp-create-checkout`, travas no `create-checkout` e ajuste do `check-subscription`.
4. Front: Planos, volta do checkout, Configurações, FAQ, Termos, Privacidade.
5. `admin-metrics`, lembretes de vencimento e roteiro de conciliação do Financeiro.

---

## 9. Quem faz o quê

| Faixa | Responsabilidade |
| --- | --- |
| `coordenador` | Sequência dos PRs e dependências entre faixas |
| `pagamentos` | Dono da especificação; ofertas, máquina de estados, regras de comissão e homologação |
| `arquiteto-dados` | Especificação de `payment_orders`, eventos, RPCs e índices |
| `supabase-db` | Migration, RPCs e testes em Postgres descartável |
| `edge-functions` | `_shared/mercadopago.ts`, as três funções novas e os ajustes nas existentes |
| `frontend` + `designer` | Planos, volta do checkout, Configurações, textos |
| `security-reviewer` | Checklist da §6 em todos os PRs (obrigatório nesta faixa) |
| `tester` | Testes da §7 e roteiro de sandbox |
| `reviewer` | Portão de qualidade antes de cada merge |
| `documentation-writer` + `gerente-contexto` | Termos, FAQ, este documento, CHANGELOG e handoff |
| Dono + Financeiro (CFO) | Conta, taxas, decisões da §2, secrets e ativação |

---

## 10. Riscos e armadilhas

- **Sincronização da Stripe apagando o acesso:** evitado ao manter `billing_tier` só da Stripe (§4).
  Um teste de banco cobre o caso.
- **Pagar duas vezes:** o pedido pendente é reaproveitado; o checkout recusa quem já tem acesso
  que cobre o período; duplicidade paga vira alerta para o Financeiro.
- **Pix pago depois do prazo:** honrado. O pedido expirado vira pago.
- **Juros do parcelamento na comissão:** a comissão usa o valor do produto, não o total pago com
  juros.
- **Taxa do parcelado vendedor:** reduz a margem do anual. A decisão b depende da cotação.
- **Preço exibido diferente do cobrado:** a tela lê a prévia do servidor.
- **Publicação no Lovable Cloud:** o merge não publica as funções; migrations e funções passam pelo
  agente do Lovable com aprovação do dono (armadilha já registrada).
- **Apps nas lojas (D5):** compra de conteúdo digital por link externo dentro de app de loja tem
  regras próprias. Este plano vale para web e PWA.
- **Aluno menor de idade:** os termos exigem 18 anos, ou 16 com autorização. O pagador pode ser o
  responsável; o Checkout Pro coleta os dados dele, e o LevelUp não os guarda. Revisar junto da D6.

---

## 11. Fora desta fase

- Plus mensal por Pix recorrente (Pix Automático). O Mercado Pago divulga o recurso, mas a
  [API de assinaturas](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post)
  documenta exemplos só com cartão. Pedir ao Mercado Pago a confirmação para a conta antes de planejar.
- Migrar assinantes da Stripe para o Mercado Pago (exige nova escolha e autorização do aluno).
- Checkout Bricks (pagamento dentro da página do LevelUp).
- Boleto.
- Unificar o Passe da Stripe em `payment_orders`.
