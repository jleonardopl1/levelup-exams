import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutRedirectUrl, installmentHint, orderOutcome, renewalOpen } from './checkout.ts';

const plain = (s: string | null) => s?.replace(/\s/g, ' ') ?? null;

describe('checkoutRedirectUrl', () => {
  it('aceita só HTTPS da Stripe e do Checkout Pro', () => {
    assert.equal(checkoutRedirectUrl('https://checkout.stripe.com/c/pay/cs_test'), 'https://checkout.stripe.com/c/pay/cs_test');
    assert.equal(checkoutRedirectUrl('https://billing.stripe.com/p/session/x'), 'https://billing.stripe.com/p/session/x');
    assert.equal(
      checkoutRedirectUrl('https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123'),
      'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123',
    );
  });
  it('recusa outros hosts, HTTP e valores estranhos', () => {
    assert.equal(checkoutRedirectUrl('http://www.mercadopago.com.br/checkout'), null);
    assert.equal(checkoutRedirectUrl('https://www.mercadopago.com.br.golpe.com/checkout'), null);
    assert.equal(checkoutRedirectUrl('https://mercadopago.com.br@golpe.com/'), null);
    assert.equal(checkoutRedirectUrl('javascript:alert(1)'), null);
    assert.equal(checkoutRedirectUrl(undefined), null);
  });
});

describe('installmentHint', () => {
  it('sem juros em todas as parcelas mostra o valor da parcela', () => {
    assert.equal(plain(installmentHint(15990, 12, 12)), 'em até 12x de R$ 13,33 sem juros');
  });
  it('parcelas com juros do comprador não prometem "sem juros"', () => {
    assert.equal(installmentHint(15990, 12, 1), 'em até 12x no cartão');
    assert.equal(installmentHint(15990, 12, 3), 'em até 12x no cartão (até 3x sem juros)');
  });
  it('sem parcelamento não mostra nada', () => {
    assert.equal(installmentHint(15990, 1, 1), null);
    assert.equal(installmentHint(0, 12, 12), null);
  });
});

describe('orderOutcome', () => {
  it('mapeia os status do pedido', () => {
    assert.equal(orderOutcome('paid'), 'approved');
    assert.equal(orderOutcome('in_dispute'), 'approved');
    assert.equal(orderOutcome('pending'), 'waiting');
    assert.equal(orderOutcome('created'), 'waiting');
    assert.equal(orderOutcome('expired'), 'expired');
    assert.equal(orderOutcome('refunded'), 'reversed');
    assert.equal(orderOutcome('failed'), 'failed');
    assert.equal(orderOutcome('qualquer'), 'failed');
  });
});

describe('renewalOpen', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  it('abre nos últimos 30 dias e fecha depois do fim', () => {
    assert.equal(renewalOpen('2026-12-10T12:00:00Z', now), true);
    assert.equal(renewalOpen('2027-01-30T12:00:00Z', now), false);
    assert.equal(renewalOpen('2026-11-19T12:00:00Z', now), false);
    assert.equal(renewalOpen(null, now), false);
  });
});
