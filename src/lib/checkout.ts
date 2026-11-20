/**
 * Regras puras do checkout no app (testadas com node --test).
 * O servidor decide preço, parcelas e acesso; aqui ficam só o redirecionamento seguro e os
 * textos derivados do que o servidor devolveu.
 */

/** Únicos destinos de pagamento: Stripe (checkout e portal) e Checkout Pro do Mercado Pago. */
export const CHECKOUT_HOSTS: ReadonlySet<string> = new Set([
  'checkout.stripe.com',
  'billing.stripe.com',
  'www.mercadopago.com.br',
]);

/** URL de pagamento normalizada, ou null se não for HTTPS num host permitido. */
export function checkoutRedirectUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && CHECKOUT_HOSTS.has(parsed.hostname) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Linha de parcelamento do Mercado Pago. "Sem juros" só quando a conta absorve os juros em
 * todas as parcelas oferecidas (configuração informada pelo servidor).
 */
export function installmentHint(amountCents: number, maxInstallments: number, interestFree: number): string | null {
  if (!Number.isInteger(maxInstallments) || maxInstallments <= 1 || amountCents <= 0) return null;
  if (interestFree >= maxInstallments) {
    return `em até ${maxInstallments}x de ${formatBRL(Math.ceil(amountCents / maxInstallments))} sem juros`;
  }
  if (interestFree > 1) return `em até ${maxInstallments}x no cartão (até ${interestFree}x sem juros)`;
  return `em até ${maxInstallments}x no cartão`;
}

export type OrderOutcome = 'approved' | 'waiting' | 'failed' | 'expired' | 'reversed';

/** Status do pedido (servidor) → o que a tela de volta do pagamento mostra. */
export function orderOutcome(status: string): OrderOutcome {
  switch (status) {
    case 'paid':
    case 'partially_refunded':
    case 'in_dispute':
      return 'approved';
    case 'created':
    case 'pending':
      return 'waiting';
    case 'expired':
      return 'expired';
    case 'refunded':
    case 'charged_back':
      return 'reversed';
    default:
      return 'failed';
  }
}

const DAY_MS = 24 * 3600 * 1000;

/** A renovação do anual pré-pago abre nos últimos `windowDays` dias do acesso. */
export function renewalOpen(paidUntil: string | null | undefined, now = Date.now(), windowDays = 30): boolean {
  if (!paidUntil) return false;
  const end = new Date(paidUntil).getTime();
  return Number.isFinite(end) && end > now && end - now <= windowDays * DAY_MS;
}
