# Roadmap

## Stripe (decisão 19/11/2026: manter a conexão atual, não trocar para o Stripe integrado da Lovable)

- [x] Confirmar estado: conta "LevelUp Exams" conectada, preços ativo, webhook criado (9 eventos), função `stripe-webhook` publicada.
- [ ] Testar checkout de assinatura ponta a ponta em modo de teste (sessão de checkout criada? assinatura concedida?).
- [ ] Conferir se o segredo do aviso de pagamento colado no app corresponde ao endpoint `we_1UaaKEFQ1QkvCgEAIcFVQl2n` (só o dono pode copiar o valor do painel do Stripe).
- [ ] Preparar a mudança para o modo live: preços com `lookup_key` na conta live, `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` ou lookup_key, novo endpoint de webhook live e novo segredo.
- [ ] Definir tratamento de imposto: Stripe calcula e cobra no checkout (`automatic_tax`); registro, declaração e recolhimento ficam com o vendedor (Brasil não tem tratamento de conformidade completo).
