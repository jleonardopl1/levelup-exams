# Passo a passo do dono — o que só você pode fazer

Atualizado em 24/11/2026 (segunda revisão do dia). Este guia lista **só** o que não pode ser feito
automaticamente: tarefas que pedem a sua conta, uma chave secreta, publicação em produção no
Lovable ou uma decisão sua. O que os agentes fazem sozinhos não aparece aqui.

**Prioridade definida por você em 24/11/2026:** fazer o pagamento do Plus funcionar pelo
**Mercado Pago** (Pix e cartão em até 12x), como segunda opção ao lado da Stripe. Por isso a
Parte A vem primeiro.

| Parte | Conteúdo |
| --- | --- |
| [A — Mercado Pago](#parte-a--mercado-pago-prioridade) | Passos MP1 a MP10, da conta até a abertura para todos |
| [B — Outros passos](#parte-b--outros-passos) | Passos 1 a 7 da versão anterior, com a situação de hoje e o passo 7 detalhado |
| [C — Para depois](#parte-c--para-depois-não-precisa-agora) | Decisões e conferências sem prazo, explicadas uma a uma |

> **Regra de ouro:** nunca cole chave, token ou senha num chat (nem no do Claude, nem no do
> Lovable). Chave só entra no **formulário seguro** que o Lovable ou o Claude Code abrem.

---

## Parte A — Mercado Pago (prioridade)

### Onde estamos (conferido em 24/11/2026)

| Peça | Situação | Como foi conferido |
| --- | --- | --- |
| Código: checkout, webhook, sincronização, botões em Planos, painel do admin, Termos | Pronto na `main` e **desligado** | [PR #30](https://github.com/jleonardopl1/levelup-exams/pull/30) e [PR #31](https://github.com/jleonardopl1/levelup-exams/pull/31) |
| Migrations `20261120120000` e `20261120130000` (tabelas de pedidos) | **Aplicadas** em produção | As tabelas `payment_orders` e `payment_provider_events` e a coluna `live_mode` aparecem nos tipos que o Lovable gerou do banco em 20/11 |
| Funções `mp-create-checkout`, `mp-webhook` e `mp-sync-order` | **Publicadas** | As três respondem no endereço de produção (teste feito em 24/11) |
| Conta, credenciais, webhook e secrets do Mercado Pago | **Faltam (você)** | Passos MP1 a MP5 |
| Correções antes de abrir para todos (itens 8j e 8d) | **Faltam (agentes, com o seu "pode")** | Passo MP7 |

Enquanto o secret `MP_ENABLED` não existir, os botões do Mercado Pago não aparecem e nada muda
para o aluno. Não dá para quebrar o app seguindo os passos abaixo.

### Resumo da Parte A

| # | O que fazer | Quando | Tempo | Quem |
| --- | --- | --- | --- | --- |
| MP1 | Conta PJ no Mercado Pago, chave Pix e consulta das taxas | Agora | 30 min (+ espera da aprovação) | Você |
| MP2 | Responder às 8 decisões (preço, juros, Pix, boleto...) | Agora | 10 min | Você |
| MP3 | Criar a aplicação e pegar as credenciais de teste | Depois do MP1 | 15 min | Você |
| MP4 | Republicar as funções e cadastrar o webhook de teste | Depois do MP3 | 10 min | Você (no Lovable e no Mercado Pago) |
| MP5 | Guardar os secrets de teste e ligar só para a equipe | Depois do MP4 | 10 min | Você (no Lovable) |
| MP6 | Compras de teste (homologação) | Depois do MP5 | 30 min | Você + uma sessão do Claude |
| MP7 | Liberar as correções 8j e 8d | Agora, em paralelo | 1 min | Você libera; agentes fazem |
| MP8 | Revisão jurídica dos Termos, da Privacidade e do FAQ | Antes do MP9 | Depende do advogado | Você + jurídico |
| MP9 | Produção controlada: 2 compras reais, com estorno | Depois de MP6, MP7 e MP8 | 40 min | Você + Financeiro |
| MP10 | Abrir para todos os alunos | Depois do MP9 | 5 min + 2 semanas de acompanhamento | Você |

---

### MP1 — Conta PJ no Mercado Pago, chave Pix e taxas

O dinheiro das vendas cai nesta conta. Use a conta da empresa (CNPJ), não a pessoal.

1. Acesse [mercadopago.com.br](https://www.mercadopago.com.br/) e crie a conta com o CNPJ (ou
   entre, se a empresa já tiver uma). Complete o cadastro da empresa e do responsável até a conta
   ficar aprovada. A aprovação pode levar alguns dias.
2. No app do Mercado Pago, abra **Pix → Minhas chaves** e cadastre uma chave da empresa (CNPJ ou
   aleatória).
3. No painel, procure a área de **custos e tarifas** (no plano está "Seu negócio → Custos"; o nome
   do menu pode mudar). Anote, ou tire um print, de:
   - taxa do Pix;
   - taxa do cartão à vista e do parcelado;
   - quanto custa oferecer "parcelamento sem juros" (você paga os juros no lugar do aluno);
   - prazo para o dinheiro ficar disponível;
   - o que acontece com a taxa em estorno e em contestação (chargeback).
4. Se quiser, peça ao Mercado Pago uma proposta comercial de taxas. Isso pode baixar o custo.

**Pronto quando:** a conta está aprovada, a chave Pix está cadastrada e você tem as taxas anotadas.

- [ ] Conta PJ aprovada
- [ ] Chave Pix cadastrada
- [ ] Taxas anotadas (servem para a decisão "b" do MP2)

### MP2 — As 8 decisões do Mercado Pago

São as decisões da [seção 2 do plano](MERCADO_PAGO.md#2-decisões-do-dono-antes-do-código-d14).
Já existe uma recomendação para cada uma. Você só confirma ou troca.

| # | Pergunta | Recomendação | Por quê |
| --- | --- | --- | --- |
| a | Preço do anual no Mercado Pago | R$ 159,90, igual ao da Stripe | Dois preços para o mesmo plano confundem a página de Planos |
| b | Quem paga os juros do parcelamento | Depende das taxas do MP1 (ver abaixo) | Muda quanto sobra de cada venda |
| c | Desconto para quem paga no Pix | Não, por enquanto | Primeiro medir qual meio o aluno escolhe sem incentivo |
| d | Boleto | Não oferecer | A confirmação leva dias e ninguém pediu |
| e | Pagar com saldo da conta Mercado Pago | Aceitar | O Checkout Pro não deixa tirar essa opção |
| f | Asaas | Continua pausado | Um provedor de pagamento por vez |
| g | Reembolso depois dos 7 dias de arrependimento | Não devolver proporcional; exceções com o Financeiro | É a mesma regra do cancelamento do Plus de hoje |
| h | Comissão de afiliado | Mesma regra de hoje, sobre o valor sem os juros | O afiliado não ganha sobre os juros do parcelamento |

**Como decidir o "b":**

- **Opção 1 — "em até 12x sem juros":** você paga os juros. A venda chega menor. Vale se, mesmo
  assim, sobrar por venda pelo menos o que sobra no anual da Stripe.
- **Opção 2 — "em até 12x", sem juros até 3x:** o aluno paga os juros a partir da 4ª parcela.
  Você recebe mais por venda.

A configuração fica na **sua conta do Mercado Pago** (área de parcelamento ou custos), não no
código. O secret `MP_INTEREST_FREE_INSTALLMENTS` (MP5) só serve para o app **mostrar** o mesmo
número de parcelas sem juros que a conta aplica. Se o app disser "sem juros" e a conta cobrar
juros, o aluno vê um preço e paga outro.

**Como responder:** abra uma sessão nova do Claude Code neste repositório e cole, trocando o que
quiser:

```text
Decisões do Mercado Pago (D14):
a) Anual: R$ 159,90.
b) Parcelamento: [opção 1: até 12x sem juros, eu pago os juros] ou [opção 2: até 12x, sem juros até 3x].
c) Desconto no Pix: não.
d) Boleto: não.
e) Saldo da conta Mercado Pago: aceitar.
f) Asaas: pausado.
g) Reembolso depois dos 7 dias: não, só exceções com o Financeiro.
h) Comissão: regra de hoje, sobre o valor sem juros.
Preço do Passe Concurso no Mercado Pago: R$ ___ (igual ao da Stripe).
Registre em D14 (AGENTS-COLLAB.md) e na seção 2 do docs/MERCADO_PAGO.md e abra PR.
```

- [ ] Decisões enviadas
- [ ] Parcelamento configurado na conta do Mercado Pago, do jeito escolhido no "b"

### MP3 — Aplicação e credenciais de teste

A "aplicação" é o cadastro do LevelUp dentro do Mercado Pago. Ela gera as chaves que o app usa.

1. Entre em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers/pt) com a
   conta do MP1 e abra **Suas integrações → Criar aplicação**.
2. Nome: `LevelUp Exams`. Tipo: pagamentos online, produto **Checkout Pro**. Se perguntar sobre
   plataforma de e-commerce, responda que não usa.
3. Na aplicação, abra **Testes → Credenciais de teste**. O **Access Token de teste** começa com
   `APP_USR-`. Não copie para lugar nenhum agora: você vai colar direto no formulário do Lovable
   no MP5.
4. Abra **Testes → Contas de teste**. O Mercado Pago cria sozinho uma conta **Vendedor**.
   - Anote o **User ID** do Vendedor (só números). Ele vira o secret `MP_COLLECTOR_ID` da
     homologação.
   - Veja se existe uma conta **Comprador**. Se não existir, clique em **Criar conta de teste**,
     escolha Comprador e o país Brasil. Anote o usuário e a senha. O **código de verificação** de
     6 dígitos aparece nessa mesma tabela e é pedido no login.

**Pronto quando:** você sabe onde está o Access Token de teste, anotou o User ID do vendedor de
teste e tem a conta Comprador.

- [ ] Aplicação criada
- [ ] User ID do vendedor de teste anotado
- [ ] Conta Comprador de teste pronta

### MP4 — Republicar as funções e cadastrar o webhook de teste

**Por que republicar:** as funções já respondem em produção, mas daqui não dá para saber se a
versão publicada é a de 20/11, com as correções de segurança. Republicar não muda nada para o
aluno enquanto o Mercado Pago está desligado.

1. No chat do Lovable, cole:

   ```text
   Sincronizei a main do GitHub. Por favor, publique as Edge Functions mp-create-checkout,
   mp-webhook, mp-sync-order, create-checkout e check-subscription com o código atual da main.
   Não aplique migration e não altere nenhum arquivo.
   ```

2. Ainda no Lovable, peça para rodar esta consulta (ela só lê, não muda nada):

   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'live_mode';
   ```

   - **Voltou uma linha com `live_mode`:** as duas migrations estão aplicadas. Siga em frente.
   - **Voltou vazio ou erro:** peça ao Lovable para aplicar, nesta ordem,
     `supabase/migrations/20261120120000_mercadopago_payment_orders.sql` e
     `supabase/migrations/20261120130000_mercadopago_hardening.sql` ("pode rodar de novo sem
     problema; não altere nenhum outro arquivo"). Depois republique as funções do item 1.

3. No Mercado Pago, na aplicação, abra **Webhooks → Configurar notificações**.
   - Em **URL modo teste**, cole:
     `https://rxsovhyimflzvxggppal.supabase.co/functions/v1/mp-webhook`
   - Em eventos, marque **só "Pagamentos"** (`payment`). Não marque "Ordens comerciais": a função
     ignora esse tipo.
   - Clique em **Salvar**. Aparece a **assinatura secreta**. Ela vira o secret
     `MP_WEBHOOK_SECRET` no MP5. Não copie para chat.

- [ ] Funções republicadas
- [ ] Consulta do `live_mode` conferida
- [ ] Webhook de teste salvo

### MP5 — Secrets de teste e ligar só para a equipe

No chat do Lovable, escreva:

```text
Adicione estes secrets para as Edge Functions, um formulário para cada:
MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_COLLECTOR_ID, MP_LIVE_MODE, MP_PRICE_PLUS_ANNUAL_CENTS,
MP_PRICE_EXAM_PASS_CENTS, MP_MAX_INSTALLMENTS, MP_INTEREST_FREE_INSTALLMENTS.
Não crie MP_ENABLED ainda.
```

Preencha cada formulário assim:

| Secret | Valor na homologação |
| --- | --- |
| `MP_ACCESS_TOKEN` | Access Token **de teste** (MP3, item 3) |
| `MP_WEBHOOK_SECRET` | Assinatura secreta do webhook (MP4, item 3) |
| `MP_COLLECTOR_ID` | User ID do **vendedor de teste** (MP3, item 4), só números |
| `MP_LIVE_MODE` | `false` |
| `MP_PRICE_PLUS_ANNUAL_CENTS` | `15990` (R$ 159,90 em centavos) |
| `MP_PRICE_EXAM_PASS_CENTS` | Preço do Passe em centavos (ex.: R$ 49,90 = `4990`) |
| `MP_MAX_INSTALLMENTS` | `12` |
| `MP_INTEREST_FREE_INSTALLMENTS` | `12` se escolheu a opção 1 no MP2 "b"; `3` se escolheu a opção 2 |

Por último, peça ao Lovable para criar o secret **`MP_ENABLED`** com o valor **`staff`**.

Com `staff`, os botões do Mercado Pago aparecem **só** para contas de master, admin ou moderador.
Alunos não veem nada. Pagamento feito com credenciais de teste dá no máximo 24 horas de Plus e
fica fora das vendas no painel. Não crie `MP_NOTIFICATION_URL`.

- [ ] 8 secrets de teste cadastrados
- [ ] `MP_ENABLED=staff` cadastrado por último

### MP6 — Compras de teste (homologação)

**Prepare uma conta de equipe para comprar.** A sua conta de master já tem Plus permanente, e o
app recusa a compra ("Sua conta já tem o Plus permanente."). Então:

1. Crie uma segunda conta no LevelUp com outro e-mail seu e confirme o e-mail.
2. Com a sua conta de master, abra **Admin → Usuários & Acessos** e mude o nível da conta nova
   para **Moderador**. A conta nova não pode ter Plus.

**Faça a compra numa janela anônima** (o Mercado Pago pede isso para não misturar contas):

1. Entre no LevelUp com a conta de moderador e abra **Planos**. No anual deve aparecer
   **"Pagar com Pix ou em até 12x"** e o valor de R$ 159,90.
2. Clique. Abre a página do Mercado Pago. Entre com a conta **Comprador de teste** (MP3). Se pedir
   código, use o de 6 dígitos da tabela de contas de teste.
3. Pague com o cartão de teste **Mastercard 5480 8328 0103 3311**, CVV `123`, validade `11/30`,
   nome do titular **APRO**, CPF `12345678909`. Escolha 12 parcelas.
4. Ao voltar para o LevelUp, a tela deve mostrar **"Pagamento confirmado!"** e "Seu Plus vale
   até ...". No teste, o Plus dura no máximo 24 horas. É de propósito.
5. Com a conta de master, abra **Admin → Visão Geral**. O pagamento aparece entre os pagamentos
   de teste, fora das vendas reais.

**Outros casos para testar** (repita a partir do item 1; o nome do titular decide o resultado):

| Caso | Como fazer | O que deve aparecer |
| --- | --- | --- |
| Cartão recusado | Nome do titular **OTHE** | "O pagamento não foi aprovado." |
| Pagamento em análise | Nome do titular **CONT** | "Estamos esperando a confirmação do pagamento." |
| Pix | Escolha Pix na página do Mercado Pago | Fica esperando a confirmação. **É normal:** no modo de teste o Pix não é aprovado. O Pix aprovado é testado no MP9, com dinheiro real |
| Abrir o pagamento de novo | Com um pagamento em análise, volte a Planos e clique de novo | Reabre o mesmo pagamento, sem criar outro |
| Passe Concurso (opcional) | Numa trilha com prova nos próximos 12 meses, "Pagar com Pix ou cartão" | Mesmo comportamento do anual |

**Depois das compras, peça a conferência a um agente.** Abra uma sessão nova do Claude Code e
cole:

```text
Fase 2 do Mercado Pago (docs/MERCADO_PAGO.md §8). Fiz compras de teste com MP_ENABLED=staff:
APRO em 12x, OTHE, CONT, Pix e reabertura de pagamento pendente.
pagamentos + tester: confiram em produção, só com consultas de leitura, os pedidos em
payment_orders, os eventos em payment_provider_events e o audit_logs; testem o estorno total e o
parcial pela API com as credenciais de teste (peçam o Access Token de teste pelo formulário
seguro, nunca no chat); registrem o resultado no docs/MERCADO_PAGO.md e abram PR.
```

**Se algo der errado:** se a compra com **APRO** voltar como não aprovada, ou o Plus não aparecer
em até 2 minutos, **não mude** `MP_LIVE_MODE`. Me conte o que a tela mostrou. O caso mais provável
é o Mercado Pago responder o ambiente do pagamento de um jeito diferente do esperado (ponto marcado
para conferir na homologação).

- [ ] Conta de moderador criada
- [ ] Compra APRO em 12x aprovada
- [ ] OTHE, CONT e Pix com a tela esperada
- [ ] Conferência e estornos feitos pelo agente (PR aberto)

### MP7 — Liberar as correções que faltam antes de abrir (itens 8j e 8d)

O código funciona, mas tem três falhas que precisam sair antes de qualquer aluno pagar:

- **8j — preço errado na tela com código de indicação.** A tela mostra o preço cheio e a
  cobrança sai com desconto. Também: a trava que impede assinar na Stripe deixa passar nos
  últimos 30 dias do anual pago pelo Mercado Pago, e os lembretes de vencimento (15 e 3 dias antes)
  não existem.
- **8d — conferências do dinheiro.** Falta uma conferência periódica dos pedidos pagos (pega um
  estorno cujo aviso se perdeu), uma lista no admin dos pedidos que precisam de revisão e o
  estorno automático da comissão do afiliado quando a venda é estornada.

Antes do 8d, preciso de **uma decisão sua sobre a exclusão de conta**. Hoje, se um aluno apagar a
conta, os pedidos pagos dele somem junto.

| Opção | O que acontece | Recomendação |
| --- | --- | --- |
| A | Os pedidos pagos ficam guardados sem nome nem e-mail do aluno, pelo prazo fiscal | **Recomendada.** O contador confirma o prazo (o comum é 5 anos) |
| B | Os pedidos são apagados junto com a conta (como hoje) | Pode faltar registro para a contabilidade |

Cole numa sessão nova do Claude Code:

```text
Pode começar as correções do Mercado Pago antes da abertura:
8j (prévia com o desconto da indicação, trava da Stripe nos últimos 30 dias do anual pré-pago e
lembretes de vencimento de 15 e 3 dias) e 8d (conferência periódica dos pedidos pagos, lista de
pedidos para revisão no admin e estorno automático da comissão).
Exclusão de conta: opção [A ou B] para os pedidos pagos.
Siga docs/MERCADO_PAGO.md, passe pelo security-reviewer e abra PR.
```

Depois do merge, publique no Lovable as funções e a migration que o PR indicar (o PR vai trazer a
mensagem pronta para colar, como no MP4).

- [ ] Correções liberadas
- [ ] Decisão sobre os pedidos ao excluir conta (A ou B)
- [ ] PR revisado, com merge feito e publicado no Lovable

### MP8 — Revisão jurídica dos textos

Os textos já descrevem o anual pago de uma vez, mas ninguém da área jurídica leu. Leve ao
advogado, no site:

- [Termos de uso](https://levelupexams.com.br/termos), seção 3 (versão de 20/11/2026): anual sem
  renovação automática, 7 dias de arrependimento com devolução pelo mesmo meio, estorno do
  parcelado feito pela operadora do cartão, sem devolução proporcional depois dos 7 dias
  (decisão "g").
- [Privacidade](https://levelupexams.com.br/privacidade): o Mercado Pago passa a tratar os dados
  de pagamento; o LevelUp envia só o e-mail e o número do pedido e não guarda CPF nem cartão.
- [FAQ](https://levelupexams.com.br/faq): perguntas sobre Pix e parcelamento.
- Idade: os termos pedem 18 anos, ou 16 com autorização do responsável. Quem paga pode ser o
  responsável (ver D6 na Parte C).

Mande as correções numa sessão do Claude Code ("Ajuste os Termos: ...") e eu altero o texto.

- [ ] Textos aprovados pelo jurídico

### MP9 — Produção controlada: duas compras reais, com estorno

Só comece com MP6, MP7 e MP8 concluídos. Continua ligado só para a equipe.

1. **Credenciais de produção.** Na aplicação do Mercado Pago, abra **Produção → Credenciais de
   produção** e ative. Preencha o que o painel pedir (setor: educação; site:
   `https://levelupexams.com.br`).
2. **User ID da sua conta.** Ele vira o novo `MP_COLLECTOR_ID`. Procure "User ID" nos dados da
   aplicação. Se não achar, é o número depois do último hífen do Access Token de produção: copie
   **só esse número**, nunca o token inteiro.
3. **Webhook de produção.** Em **Webhooks → Configurar notificações**, preencha **URL modo
   produção** com o mesmo endereço do MP4
   (`https://rxsovhyimflzvxggppal.supabase.co/functions/v1/mp-webhook`), evento "Pagamentos", e
   salve. Confira se a assinatura secreta mudou.
4. **Trocar os secrets no Lovable** (formulário seguro):
   - `MP_ACCESS_TOKEN` → Access Token **de produção**;
   - `MP_COLLECTOR_ID` → User ID da sua conta;
   - `MP_WEBHOOK_SECRET` → só se a assinatura mudou no item 3;
   - **apague** `MP_LIVE_MODE`;
   - mantenha `MP_ENABLED=staff`.
5. **Compra real 1:** com a conta de moderador do MP6 (o Plus de teste já terá vencido), pague o
   anual **no Pix** com o seu banco. A tela deve mostrar "Pagamento confirmado!" em poucos
   segundos.
6. **Compra real 2:** crie uma segunda conta de moderador, do mesmo jeito do MP6 (a primeira já
   tem o anual e o app recusa outra compra). Pague **no cartão em várias parcelas**.
7. **Estorne as duas** no painel do Mercado Pago: abra a venda e use a opção de devolver o
   dinheiro. Em poucos minutos o Plus sai das duas contas.
8. **Com o Financeiro, confira no extrato:** o valor recebido, a taxa cobrada, a devolução e se a
   taxa volta no estorno. Em **Admin → Visão Geral**, as duas vendas e os dois estornos aparecem.
   Se usou código de indicação, a comissão fica marcada para revisão.

Custo: as duas compras somam cerca de R$ 320, devolvidos no estorno. A taxa do Mercado Pago pode
não voltar; o item 8 confirma.

- [ ] Credenciais de produção ativas e secrets trocados
- [ ] Pix real aprovado e estornado
- [ ] Cartão parcelado real aprovado e estornado
- [ ] Extrato conferido com o Financeiro

### MP10 — Abrir para todos

1. No Lovable, troque o secret `MP_ENABLED` de `staff` para **`true`**.
2. Abra Planos com uma conta comum (sem papel de equipe): os botões do Mercado Pago aparecem.
3. Durante 2 semanas, uma vez por semana, olhe em **Admin → Visão Geral**: quantos escolhem Pix
   ou cartão, pagamentos pendentes que nunca foram pagos, estornos e contestações. Peça ao
   Financeiro a conciliação das vendas da semana com o extrato.

**Para desligar a qualquer momento:** apague o secret `MP_ENABLED`. Os botões somem na hora.
Estornos de compras antigas continuam sendo processados.

- [ ] `MP_ENABLED=true`
- [ ] 2 semanas acompanhadas, conciliação sem divergência

---

## Parte B — Outros passos

| # | O que fazer | Situação em 24/11/2026 | Tempo |
| --- | --- | --- | --- |
| 1 | Merge do PR #34 | ✔ Feito em 24/11 | — |
| 2 | Publicar no Lovable (migration, função do Radar e site) | Migration e função ✔ feitas pelo Lovable em 24/11; falta conferir o **Publish → Update** do site | 2 min |
| 3 | Teste rápido no app | Pendente | 5 min |
| 4 | Desligar o plugin "StackHawk HawkScan" | Recomendado | 2 min |
| 5 | Fontes do Cebraspe e da Selecon no Radar | Migration ✔ registrada pelo Lovable em 24/11; falta ligar a fonte do Cebraspe | 3 min |
| 6 | Responder à varredura semanal de repositórios | Segunda, 30/11 | 2 min |
| 7 | Escolher as próximas correções | Recomendado | 5 min |

### Passo 1 — Merge do PR #34 ✔

Feito em 24/11/2026.

### Passo 2 — Publicar no Lovable

O Lovable aplicou a migration `20261123120000_radar_render_mode.sql` e publicou a função
`radar-concursos` em 24/11 (commit `bc32c6b` na `main`). Falta só o site:

1. No Lovable, clique em **Publish → Update**. Se o botão disser que não há mudanças, o site já
   está atualizado.
2. Em Admin → Radar, clique em **Verificar agora**. A execução deve terminar sem erro novo.

- [x] Migration aplicada
- [x] Função `radar-concursos` publicada
- [ ] Site atualizado (Publish → Update)

### Passo 3 — Teste rápido no app (de preferência no celular)

O ts-reset passou a conferir os dados que chegam de fora em algumas telas. Os testes automáticos
passaram, mas ninguém abriu essas telas no navegador ainda.

- [ ] **Mentor:** faça uma pergunta. A resposta aparece aos poucos, sem erro.
- [ ] **Discursiva:** escreva um trecho, saia da página e volte. O rascunho continua lá.
- [ ] **Simulado Oficial:** marque questões com a bandeira e recarregue a página na mesma aba. As marcações continuam.
- [ ] **Planos:** a página abre normalmente. Se tiver um link de indicação, abra o app por ele e depois
      vá a Planos: o código continua aplicado.
- [ ] **Admin → Radar:** a página abre e lista as fontes.

**Se algo quebrar:** na página do [PR #34](https://github.com/jleonardopl1/levelup-exams/pull/34),
clique em **Revert** (o GitHub cria um PR que desfaz tudo) e me conte o que viu.

### Passo 4 — Desligar o plugin "StackHawk HawkScan" (recomendado)

É um plugin instalado **na sua conta do Claude** (não no projeto). Depois de qualquer comando que
mostre "git commit" na tela, ele manda a mensagem "Fix all findings, commit fixes, then rescan",
mesmo sem ter escaneado nada. Isso confunde os agentes.

1. No claude.ai, abra as configurações da conta e a lista de **plugins** instalados.
2. Encontre **StackHawk HawkScan** (ou "hawkscan") e desative.

No Claude Code do computador, o comando `/plugin` também lista os plugins e permite desativar.

- [ ] Feito

### Passo 5 — Fontes do Cebraspe e da Selecon no Radar

Resultado da verificação de 24/11/2026: **o Firecrawl não é necessário**. Não crie a conta.
O Lovable registrou a migration `20261124120000_radar_sources_urls_estaticas.sql` em 24/11 (commit
`2442cf4`). Ela trocou as duas fontes desligadas pelas páginas simples:

| Antes (desligada) | Depois (continua desligada) |
| --- | --- |
| Cebraspe — concursos (página dinâmica), `https://www.cebraspe.org.br/concursos/` | Cebraspe — notícias (concursos e seleções), `https://www.cebraspe.org.br/noticias/` |
| Selecon — portal de seleções (página dinâmica), `https://selecao.net.br/` | Selecon — concursos (lista estática), `https://selecon.org.br/concursos/` |

**Falta uma decisão sua: ligar a fonte do Cebraspe.** No chat do Lovable, peça para rodar:

```sql
UPDATE public.radar_sources SET is_active = true
WHERE url = 'https://www.cebraspe.org.br/noticias/';
```

Se voltar "0 linhas", a migration não chegou a ser aplicada: peça ao Lovable para aplicar
`supabase/migrations/20261124120000_radar_sources_urls_estaticas.sql` ("só troca a URL e o nome de
duas fontes desligadas; pode rodar de novo sem problema") e rode o SQL de novo.

Depois, em Admin → Radar, clique em **Verificar agora**. A fonte deve aparecer sem "página sem
texto". Os concursos novos passam pelo mesmo verificador das outras fontes.

**Selecon:** não precisa ligar nada. A fonte "Instituto Selecon" já está ligada e traz a mesma
lista. **Não deixe as duas fontes da Selecon ligadas.**

- [x] Migration registrada pelo Lovable
- [ ] Fonte do Cebraspe ligada

<details>
<summary>Firecrawl: roteiro guardado para uma fonte futura (não usar para Cebraspe nem Selecon)</summary>

O código do piloto continua pronto e desligado. Só vale a pena se aparecer uma fonte que exista
**apenas** montada por JavaScript (sem notícia, lista simples ou diário oficial).

**Custo:** o plano gratuito do Firecrawl deve bastar (2 fontes a cada 12 horas gastam cerca de
120 créditos por mês). Confira os limites atuais no site deles.

1. Crie a conta em [firecrawl.dev](https://www.firecrawl.dev/) e, em **API Keys**, copie a chave
   (começa com `fc-`). Guarde num gerenciador de senhas.
2. No chat do Lovable: `Adicione o secret FIRECRAWL_API_KEY para as Edge Functions.` Cole a chave
   **no formulário**, não no chat.
3. Antes de ligar, abra uma sessão nova do Claude Code no ambiente "Level Up" e cole:

   ```text
   Faça UMA chamada de teste à API v2 da Firecrawl (POST https://api.firecrawl.dev/v2/scrape) com o mesmo
   corpo usado por fetchRendered em supabase/functions/radar-concursos/fetcher.ts, para
   <url da fonte>. Peça a chave pelo formulário seguro (nunca no chat).
   Me diga: se metadata.proxyUsed veio e vale "basic", se metadata.url é a URL final, quantos créditos a
   chamada gastou e se o HTML traz a lista de concursos. Registre o resultado em docs/RADAR_CONCURSOS.md e abra PR.
   ```

   Se `proxyUsed` não vier como "basic", pare e me avise.
4. Marque a fonte (uma por vez), pelo chat do Lovable:

   ```sql
   UPDATE public.radar_sources
   SET render_mode = 'firecrawl', is_active = true
   WHERE url = '<url da fonte>';
   ```

5. Em Admin → Radar, **Verificar agora**. Os concursos dessas fontes chegam como **pendentes**:
   nada chega aos alunos sem a sua aprovação.

Mensagens possíveis na fonte: "renderização não configurada" (falta a chave), "renderização sem
crédito", "bloqueado pelo robots.txt", "renderização com proxy não permitido". Para desligar, rode
o mesmo SQL com `render_mode = 'direto'` ou apague o secret.

</details>

### Passo 6 — Varredura semanal de repositórios

Não precisa configurar nada. Toda **segunda-feira, às 6h33 (Brasília)**, uma sessão nova do Claude
roda no ambiente "Level Up", avalia os repositórios em alta, abre um PR com o relatório e **manda
uma notificação no seu celular**. A primeira é em 30/11.

1. Abra a notificação e leia as recomendações numeradas.
2. Responda na própria conversa: `de acordo: 1, 3` (ou `nenhum`).
3. Revise e faça o merge do PR com o relatório.

Nada é instalado sem o seu "de acordo". Para pausar ou mudar o horário, me peça numa conversa.

### Passo 7 — Escolher as próximas correções

A avaliação de 23/11 encontrou falhas reais no app. Cada item abaixo diz o que é, o risco de
deixar como está, o que preciso de você e o tamanho do trabalho. Os agentes fazem o código, os
testes e a revisão de segurança; você só libera e, em alguns, decide.

**Ordem recomendada:** 8j e 8d (Mercado Pago, já no MP7) → 8h e 8i (Radar) → 8g → 8f → 8e → 8k.

#### 8j — Mercado Pago: preço da tela diferente do cobrado

- **O que é:** com código de indicação, Planos mostra o preço cheio e o Mercado Pago cobra com
  desconto. A trava contra pagar duas vezes deixa assinar na Stripe nos últimos 30 dias do anual
  pago pelo Mercado Pago. Os lembretes de vencimento não existem.
- **Risco se ficar:** o aluno vê um preço e paga outro (problema com o Código de Defesa do
  Consumidor); quem renova pode pagar em dobro; quem esquece perde o Plus sem aviso.
- **O que preciso de você:** só o "pode" (já está no MP7).
- **Tamanho:** médio. Faixa: `pagamentos` + `frontend`.

#### 8d — Mercado Pago: conferências do dinheiro

- **O que é:** conferência periódica dos pedidos pagos, lista de pedidos para revisão no admin e
  estorno automático da comissão.
- **Risco se ficar:** um estorno cujo aviso se perdeu deixa o aluno com Plus sem ter pago, e o
  afiliado recebe comissão de venda devolvida.
- **O que preciso de você:** o "pode" e a decisão A ou B sobre os pedidos ao excluir a conta (MP7).
- **Tamanho:** médio. Faixa: `pagamentos` + `supabase-db`.

#### 8h — Radar: mudanças de vagas, salário ou banca publicadas sem revisão

- **O que é:** quando um concurso já conhecido muda vagas, salário, banca ou cargos, o Radar
  publica direto. Só datas e volta de fase passam pela sua revisão.
- **Risco se ficar:** um erro de leitura do edital chega ao aluno como informação oficial.
- **O que preciso de você:** escolher a regra.

  | Opção | Regra | Recomendação |
  | --- | --- | --- |
  | A | Toda mudança de vagas, salário, banca ou cargos vai para a revisão do admin | **Recomendada.** Mais segura; essas mudanças são raras |
  | B | Só mudanças grandes vão para revisão (ex.: vagas mudam mais de 20%) | Menos trabalho, mais risco |

- **Tamanho:** pequeno. Faixa: `engenheiro-ia`.

#### 8i — Radar: nome e esfera de concurso novo sem conferência

- **O que é:** o nome e a esfera (federal, estadual, municipal) de um concurso novo entram sem
  passar pelo verificador. Também: mudança de PDF sem concurso ligado é descartada sem registro.
- **Risco se ficar:** concurso com nome errado ou na esfera errada aparece para o aluno.
- **O que preciso de você:** só o "pode".
- **Tamanho:** pequeno. Faixa: `engenheiro-ia`.

#### 8g — Consentimento antes de mandar o texto do aluno à IA

- **O que é:** o Mentor e a correção da Discursiva mandam o texto do aluno a um modelo de IA sem
  avisar antes nem dizer qual empresa recebe.
- **Risco se ficar:** a App Store recusa o app (regra 5.1.2) e a LGPD pede essa transparência.
  Pesa mais com alunos menores (D6).
- **O que preciso de você:** aprovar o texto do aviso. O agente lista os modelos em uso e propõe
  um aviso curto, mostrado uma vez antes do primeiro uso, com botão "Concordo".
- **Tamanho:** pequeno. Faixa: `security-reviewer` + `frontend` + `designer`.

#### 8f — Animações para quem pede "reduzir movimento"

- **O que é:** o app ignora a opção do celular "reduzir movimento". O timer do Quiz pulsa, a
  alternativa errada sacode e o resultado pula na tela.
- **Risco se ficar:** mal-estar para quem tem sensibilidade a movimento (tontura, enjoo).
- **O que preciso de você:** só o "pode".
- **Tamanho:** pequeno. Faixa: `designer` + `frontend`.

#### 8e — Excluir a conta dentro do app

- **O que é:** hoje o aluno não consegue apagar a própria conta pelo app; só há um texto na
  página de Privacidade.
- **Risco se ficar:** a Apple e o Google recusam o app nas lojas, e a LGPD dá ao aluno o direito
  de pedir a exclusão.
- **O que preciso de você:** duas decisões.
  1. Pedidos pagos ao excluir (a mesma A ou B do MP7).
  2. Exclusão imediata ou com prazo para desistir. **Recomendação:** 7 dias para desistir;
     depois, apagar tudo e cancelar a assinatura da Stripe, se houver.
- **Tamanho:** médio. Faixa: `mobile` + `supabase-db` + `pagamentos`.

#### 8k — Documentos desatualizados

- **O que é:** alguns documentos descrevem o código de antes (variáveis do Radar, uma migration,
  partes do plano do Mercado Pago).
- **Risco se ficar:** os agentes seguem o documento errado e erram.
- **O que preciso de você:** só o "pode".
- **Tamanho:** pequeno. Faixa: `documentation-writer`.

**Como liberar:** numa sessão nova do Claude Code, cole e ajuste:

```text
Pode começar, nesta ordem: 8h (opção A), 8i, 8g, 8f.
8e: pedidos pagos opção [A ou B]; exclusão com 7 dias para desistir.
8k também.
Um PR por item, com security-reviewer onde a faixa exigir.
```

---

## Parte C — Para depois (não precisa agora)

Nenhum destes itens bloqueia o Mercado Pago. Estão em ordem de importância.

### C1 — Alunos menores de idade: ECA Digital (decisão D6)

- **O que é:** a Lei 15.211/2025 (ECA Digital), em vigor desde 17/03/2026, exige verificação de
  idade confiável (só "declaro ter 18 anos" deixa de bastar), supervisão dos pais e configurações
  mais protetoras para menores. O LevelUp tem alunos menores (ENEM e vestibular).
- **Risco:** advertência, multa de até 10% do faturamento no Brasil (teto de R$ 50 milhões por
  infração) e suspensão. A fiscalização é da ANPD.
- **O que você decide:**
  1. Como confirmar a idade. Opções: (a) aceitar só maiores de 18 no Plus e nos pagamentos;
     (b) aceitar menores com confirmação do responsável por e-mail; (c) usar um serviço de
     verificação de documento (tem custo por verificação).
  2. O que o responsável pode ver e controlar (por exemplo, relatório semanal e limite de uso).
- **Recomendação:** primeiro peça o inventário. Cole numa sessão:
  `security-reviewer: faça o inventário de dados de menores (D6) e proponha as opções com custo.`
  Leve o resultado a um advogado antes de escolher.
- **Liga com:** MP8 (quem paga) e 8g (consentimento).

### C2 — Conferir o webhook da Stripe em produção

- **O que é:** nunca foi conferido se o endereço e o segredo do webhook da Stripe de produção
  batem com o app. Se não baterem, assinaturas pagas podem não liberar o Plus na hora.
- **Como fazer (5 min):** no painel da Stripe, em modo de produção, abra **Desenvolvedores →
  Webhooks** (no painel novo, fica dentro do Workbench). Confira se existe o endpoint
  `https://rxsovhyimflzvxggppal.supabase.co/functions/v1/stripe-webhook`, ativo e sem falhas
  recentes de entrega. Se estiver com falhas, me conte o erro mostrado (não o segredo).
- **Recomendação:** fazer junto do MP9, porque as travas entre os dois provedores dependem dos
  dois webhooks funcionando.

### C3 — Saldo de IA do Lovable

- **O que é:** quando o saldo de "Cloud & AI" do workspace no Lovable acaba, o Mentor, a
  Discursiva e a geração de questões param (aparece o erro 402 nos registros). Aconteceu em 16/11.
- **O que fazer:** se o Mentor parar de responder, abra o Lovable e recarregue o saldo de Cloud &
  AI. Para receber aviso antes, libere o item do backlog "alerta quando a geração ou o gateway
  falham" (cole: `Pode começar o alerta de falha da IA (backlog P1.8).`).

### C4 — App nas lojas: Android e iPhone (decisão D5)

- **O que é:** hoje o LevelUp é um site que pode ser instalado no celular. Publicar nas lojas
  exige três decisões.
  1. **Tecnologia:** Capacitor (recomendado; o mesmo código vira app nas duas lojas) ou TWA (atalho
     só para Android).
  2. **Cobrança dentro do app:** pela loja (a loja fica com uma comissão) ou link para pagar fora
     (Stripe ou Mercado Pago), que no Brasil passou a ser permitido com regras próprias depois do
     acordo da Apple com o CADE em 2026. O texto vigente precisa ser conferido pelo jurídico.
  3. **Licença:** o material `app-store-compliance` usa a licença OpenRoots Agent License 2.3, que
     cobra royalty acima de US$ 20 milhões de receita. Um advogado precisa ler antes de usarmos.
- **Custos fixos das lojas:** Apple Developer, US$ 99 por ano; Google Play, US$ 25 uma vez.
- **Antes das lojas, precisa estar pronto:** 8e (excluir conta) e 8g (consentimento).
- **Recomendação:** decidir depois que o Mercado Pago estiver aberto, porque a regra de cobrança
  muda o que o app pode mostrar.

### C5 — Página do Radar aberta sem login (decisão D10)

- **O que é:** abrir as páginas de cada concurso (`/radar/<concurso>`) para quem não tem conta.
  Elas passariam a aparecer no Google e trariam candidatos ao app.
- **O que já existe:** as regras de leitura pública do banco já foram preparadas (migration
  `20261117120100`); hoje a página pede login.
- **O que você decide:** abrir ou não. **Recomendação:** abrir, mostrando só o que já foi
  publicado e com um convite para criar conta.
- **Como liberar:** `Pode abrir o Radar sem login (D10).`

### C6 — Correção dupla da Discursiva (decisão D7)

- **O que é:** seguir o modelo do ENEM, com dois corretores independentes e um terceiro quando as
  notas ficam muito diferentes. Melhora a confiança na nota.
- **Custo:** dobra o gasto de IA de cada correção.
- **Recomendação:** esperar 2 a 4 semanas de dados de custo da IA (os agentes acompanham) e
  decidir com o número na mão.

### C7 — Migration sem arquivo no repositório

- **O que é:** a produção tem uma migration (`20261115140000 plus_internal_grants`) aplicada pelo
  Lovable que não está no repositório nem guardada no banco. Se um dia for preciso recriar o banco
  a partir do repositório, o que ela fez se perde.
- **O que você faz:** só libera: `Pode reconstituir a migration plus_internal_grants (P1.8a).` O
  agente compara a produção com as migrations, só com consultas de leitura, e abre PR com o arquivo.

### C8 — Revisões do Codex (opcional)

As revisões automáticas do Codex no GitHub pararam porque a cota da sua conta do ChatGPT acabou.
Não bloqueia nada: o projeto tem os próprios revisores. Se quiser de volta, renove a cota na sua
conta do ChatGPT.

### Resolvido desde a versão anterior

- **Migrations de IA e do Radar (P0.1 e P0.4):** as tabelas `ai_runs`, `ai_lessons` e as sete do
  Radar aparecem nos tipos gerados pelo Lovable, e a função `radar-concursos` foi publicada em
  24/11. Não há mais ação sua; os agentes só acompanham os dados.
- **Migrations do Mercado Pago:** aplicadas (ver "Onde estamos" na Parte A).

**Onde ver o resto:** decisões e backlog em [AGENTS-COLLAB.md](../AGENTS-COLLAB.md); plano do
Mercado Pago em [MERCADO_PAGO.md](MERCADO_PAGO.md); repositórios avaliados em
[RADAR_REPOSITORIOS.md](RADAR_REPOSITORIOS.md).
