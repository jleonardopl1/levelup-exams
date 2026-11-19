# Roadmap

## Stripe (decisão 19/11/2026: manter a conexão atual, não trocar para o Stripe integrado da Lovable)

- [x] Confirmar estado: conta "LevelUp Exams" conectada, preços ativo, webhook criado (9 eventos), função `stripe-webhook` publicada.
- [x] Testar checkout de assinatura ponta a ponta em modo de teste: sessão criada, pagamento de teste concluído, assinatura ativa no Stripe.
- [x] Segredo do aviso de pagamento atualizado e verificado: entrega real de `customer.subscription.updated` passou na assinatura e o app registrou `Tier synced ... tier=plus`.
- [ ] Preparar a mudança para o modo live: recriar os dois preços em live (R$ 19,90/mês e R$ 159,90/ano), criar o endpoint de webhook live com os mesmos 9 eventos e colar o novo segredo; ativar a conta Stripe (dados da empresa + conta bancária).
- [ ] Conferir a moeda apresentada no checkout: o preço é em BRL, mas a tela mostrou valor em euro quando o país de cobrança padrão era Bélgica.
- [ ] Definir tratamento de imposto: Stripe calcula e cobra no checkout (`automatic_tax`); registro, declaração e recolhimento ficam com o vendedor (Brasil não tem tratamento de conformidade completo).

### Artefatos do teste (modo de teste)
- Assinatura de teste `sub_1UdaTkFQ1QkvCgEA8aEMfJgx` cancelada; cliente `cus_VeuGJzRuapxVjR` permanece na conta de teste.
