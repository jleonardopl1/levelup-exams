// Testes de banco do Mercado Pago (migrations 20261120120000_mercadopago_payment_orders.sql e
// 20261120130000_mercadopago_hardening.sql).
// Sobe o Postgres em memória com todas as migrations e confere pedidos, máquina de estados,
// acesso pago como fonte do plano efetivo, comissão, permissões e a visão do admin.
//
// Uso (na raiz do repo):
//   npm i --no-save @electric-sql/pglite@0.5.16
//   node supabase/tests/mercadopago.validate.mjs
import { bootSupabaseDb, sqlHelpers } from './pglite-supabase.mjs';

let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const DAY = 24 * 3600 * 1000;
const near = (a, b, tolMs = 60_000) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= tolMs;
const addMonths = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };

const { db, failures: migrationFailures } = await bootSupabaseDb();
for (const m of migrationFailures) { failures++; console.log(`FAIL  migration ${m}`); }
check(migrationFailures.length === 0, 'todas as migrations aplicadas (inclui Mercado Pago)');
const { as, one, rpc } = sqlHelpers(db);

const mkUser = async (email) => (await one(`INSERT INTO auth.users(email, email_confirmed_at) VALUES ($1, now()) RETURNING id`, [email])).id;
const tier = async (uid) => (await one(`SELECT tier FROM profiles WHERE user_id=$1`, [uid])).tier;
const order = async (id) => one(`SELECT * FROM payment_orders WHERE id=$1`, [id]);
const access = async (uid) => { await as(uid); const a = await rpc(`SELECT get_premium_access()`); await as(null, 'service_role'); return a; };

const CREATE = `SELECT create_payment_order($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
const create = (uid, product, { track = null, list = 15990, discount = 0, ref = null, until = null, ttl = 60, live = true } = {}) =>
  rpc(CREATE, [uid, product, track, list, discount, ref, until, ttl, live]);
const attach = (id, n = 1) => db.query(`UPDATE payment_orders SET provider_preference_id=$2, checkout_url=$3 WHERE id=$1`,
  [id, `pref-${id.slice(0, 8)}-${n}`, `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${id}`]);
const APPLY = `SELECT apply_mp_payment($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;
const apply = (orderId, paymentId, status, { amount = 15990, refunded = 0, currency = 'BRL', method = 'bank_transfer', installments = 1, approvedAt = null, detail = 'accredited', live = true } = {}) =>
  rpc(APPLY, [orderId, paymentId, status, detail, amount, refunded, currency, method, installments, approvedAt, live]);

const buyer = await mkUser('buyer@test.local');
const other = await mkUser('other@test.local');
const affiliate = await mkUser('affiliate@test.local');
const refCode = (await one(`INSERT INTO referral_codes(user_id, code, discount_percent, commission_percent) VALUES ($1, 'PROF10', 10, 20) RETURNING id`, [affiliate])).id;
const track = (await one(`SELECT id FROM study_tracks ORDER BY created_at LIMIT 1`)).id;

// ---------- Permissões ----------
const priv = async (sql) => Object.values(await one(sql))[0];
check(await priv(`SELECT NOT has_table_privilege('authenticated', 'public.payment_orders', 'SELECT')`), 'aluno não lê payment_orders direto');
check(await priv(`SELECT NOT has_table_privilege('anon', 'public.payment_provider_events', 'SELECT')`), 'anônimo não lê payment_provider_events');
for (const fn of [
  'public.create_payment_order(uuid, text, uuid, integer, integer, uuid, timestamptz, integer, boolean)',
  'public.apply_mp_payment(uuid, text, text, text, integer, integer, text, text, integer, timestamptz, boolean)',
  'public._paid_access_until(uuid)',
  'public._has_paid_access(uuid)',
  'public._mp_order_status(text, integer, integer)',
  'public.expire_premium_grants()',
]) {
  check(await priv(`SELECT NOT has_function_privilege('authenticated', '${fn}', 'EXECUTE') AND NOT has_function_privilege('anon', '${fn}', 'EXECUTE')`),
    `${fn.split('(')[0]} fechada para cliente`);
}
check(await priv(`SELECT has_function_privilege('authenticated', 'public.get_my_payment_orders(integer)', 'EXECUTE')`), 'get_my_payment_orders liberada para o aluno logado');
check(await priv(`SELECT NOT has_function_privilege('anon', 'public.get_my_payment_orders(integer)', 'EXECUTE')`), 'get_my_payment_orders fechada para anônimo');
check(await priv(`SELECT count(*) = 0 FROM pg_proc WHERE proname IN ('create_payment_order', 'apply_mp_payment') AND pronamespace = 'public'::regnamespace AND pronargs IN (8, 10)`),
  'assinaturas antigas de create_payment_order e apply_mp_payment removidas');
await as(buyer);
check((await create(buyer, 'plus_annual')).error === 'forbidden', 'create_payment_order recusa chamada de cliente');
check((await rpc(APPLY, ['00000000-0000-0000-0000-000000000000', '1', 'approved', '', 1, 0, 'BRL', 'x', 1, null, true])).error === 'forbidden',
  'apply_mp_payment recusa chamada de cliente');

// ---------- Mapeamento de status ----------
await as(null, 'service_role');
const map = async (s, r = 0, a = 1000) => rpc(`SELECT _mp_order_status($1, $2, $3)`, [s, r, a]);
check(await map('approved') === 'paid' && await map('approved', 300) === 'partially_refunded' && await map('approved', 1000) === 'refunded',
  'approved vira paid / partially_refunded / refunded conforme o valor estornado');
check(await map('pending') === 'pending' && await map('in_process') === 'pending' && await map('authorized') === 'pending', 'pendentes viram pending');
check(await map('in_mediation') === 'in_dispute' && await map('charged_back') === 'charged_back' && await map('rejected') === 'failed'
  && await map('cancelled') === 'canceled' && await map('qualquer') === null, 'disputa, chargeback, recusa, cancelamento e desconhecido');

// ---------- Criação e reaproveitamento do pedido ----------
check((await create(buyer, 'plus_annual', { discount: 15990 })).error === 'invalid_amount', 'desconto não pode zerar o valor');
check((await create(buyer, 'exam_pass')).error === 'invalid_track', 'Passe exige trilha e data de fim');
const o1 = await create(buyer, 'plus_annual');
check(!!o1.order_id && o1.reused === false && o1.amount_cents === 15990, 'cria pedido do anual');
check((await create(buyer, 'plus_annual')).error === 'busy', 'segundo pedido enquanto a preferência é criada responde busy');
await attach(o1.order_id);
const o1b = await create(buyer, 'plus_annual');
check(o1b.reused === true && o1b.order_id === o1.order_id && !!o1b.checkout_url, 'mesmo produto e valor reaproveita o pedido aberto');
const o1c = await create(buyer, 'plus_annual', { discount: 1599, ref: refCode });
check(o1c.order_id !== o1.order_id && (await order(o1.order_id)).status === 'expired', 'indicação nova encerra o pedido anterior e cria outro');
check((await order(o1c.order_id)).amount_cents === 14391, 'valor com desconto gravado no pedido');
await attach(o1c.order_id);
const A = o1c.order_id;

// ---------- Pagamento: pendente, aprovado, reentrega, ordem trocada ----------
let r = await apply(A, 'pay-1', 'pending', { amount: 14391, detail: 'pending_waiting_transfer' });
check(r.status === 'pending' && await tier(buyer) === 'free', 'Pix pendente não libera o Plus');
r = await apply(A, 'pay-1', 'approved', { amount: 14391, approvedAt: new Date(Date.now() - 340 * DAY).toISOString() });
check(r.status === 'paid', 'aprovação vira paid');
check(await tier(buyer) === 'plus', 'perfil vira Plus');
const acc = await access(buyer);
const paidAtA = (await order(A)).paid_at;
check(acc.source === 'mercadopago' && acc.paid_product === 'plus_annual' && near(acc.access_until, addMonths(paidAtA, 12)),
  'get_premium_access: fonte mercadopago, 12 meses a partir do pagamento');
check((await one(`SELECT count(*)::int n FROM referral_uses WHERE referred_user_id=$1`, [buyer])).n === 1, 'comissão registrada na aprovação');
const conv = await one(`SELECT subscription_amount, commission_earned, stripe_checkout_session_id FROM referral_uses WHERE referred_user_id=$1`, [buyer]);
check(Number(conv.subscription_amount) === 143.91 && Number(conv.commission_earned) === 28.78 && conv.stripe_checkout_session_id === `mp:${A}`,
  'comissão sobre o valor do produto com desconto, chave mp:<pedido>');
await apply(A, 'pay-1', 'approved', { amount: 14391 });
check((await one(`SELECT count(*)::int n FROM referral_uses WHERE referred_user_id=$1`, [buyer])).n === 1, 'reentrega não duplica a comissão');
check((await create(buyer, 'exam_pass', { track, list: 4990, discount: 499, ref: refCode, until: new Date(Date.now() + 30 * DAY).toISOString() })).error === 'referral_in_use',
  'o mesmo código não dá desconto num segundo pedido enquanto o primeiro está pago');
const auditCount = async () => (await one(`SELECT count(*)::int n FROM audit_logs WHERE event_type='PAYMENT_ORDER_UPDATED' AND metadata->>'order_id'=$1`, [A])).n;
const audits = await auditCount();
await apply(A, 'pay-1', 'approved', { amount: 14391 });
check(await auditCount() === audits, 'reentrega sem mudança de status não gera auditoria nova');
r = await apply(A, 'pay-1', 'pending', { amount: 14391 });
check(r.unchanged === true && (await order(A)).status === 'paid', 'evento pendente fora de ordem não rebaixa pedido pago');
r = await apply(A, 'pay-1', 'approved', { amount: 9900 });
check(r.error === 'amount_mismatch' && (await one(`SELECT count(*)::int n FROM audit_logs WHERE event_type='PAYMENT_AMOUNT_MISMATCH'`)).n === 1,
  'valor diferente do pedido é recusado e auditado');
r = await apply(A, 'pay-1', 'approved', { amount: 14391, currency: 'USD' });
check(r.error === 'amount_mismatch', 'moeda diferente é recusada');

// ---------- Stripe não apaga o acesso do Mercado Pago ----------
await db.query(`UPDATE profiles SET billing_tier='free', updated_at=now() WHERE user_id=$1`, [buyer]);
check(await tier(buyer) === 'plus', 'check-subscription gravando billing_tier=free mantém o Plus pago no Mercado Pago');
await as(buyer);
check(await rpc(`SELECT get_user_tier($1)`, [buyer]) === 'plus', 'get_user_tier conta o acesso pago');
await as(null, 'service_role');

// ---------- Renovação soma 12 meses; estorno do primeiro não abre buraco ----------
const B = (await create(buyer, 'plus_annual')).order_id;
await attach(B);
r = await apply(B, 'pay-2', 'approved', { method: 'credit_card', installments: 12 });
check(r.status === 'paid' && r.possible_duplicate === false, 'renovação paga (não é duplicidade: primeiro pagamento há 340 dias)');
check(near(r.paid_until, addMonths(addMonths(paidAtA, 12), 12)), 'renovação soma 12 meses ao fim do período atual');
check((await order(B)).installments === 12 && (await order(B)).payment_method_type === 'credit_card', 'grava meio e parcelas');
r = await apply(A, 'pay-1', 'refunded', { amount: 14391, refunded: 14391 });
const oA = await order(A);
check(r.status === 'refunded' && !!oA.access_revoked_at && oA.commission_review === true, 'estorno revoga o pedido e marca a comissão para revisão');
check(near(r.paid_until, addMonths((await order(B)).paid_at, 12)), 'sem o primeiro anual, o segundo vale 12 meses a partir do próprio pagamento');
r = await apply(A, 'pay-1', 'approved', { amount: 14391 });
check(r.unchanged === true && (await order(A)).status === 'refunded', 'estado final não volta a pago');
check(await tier(buyer) === 'plus', 'Plus continua pelo segundo pedido');

// ---------- Outro pagamento para pedido já pago ----------
r = await apply(B, 'pay-3', 'approved');
check(r.duplicate_payment === true && (await order(B)).possible_duplicate === true && (await order(B)).provider_payment_id === 'pay-2',
  'segundo pagamento aprovado no mesmo pedido vira alerta, sem trocar o pagamento');
r = await apply(B, 'pay-4', 'rejected');
check(r.ignored === 'other_payment', 'recusa de outro pagamento é ignorada');

// ---------- Estorno parcial, disputa e chargeback ----------
r = await apply(B, 'pay-2', 'approved', { refunded: 5000 });
check(r.status === 'partially_refunded' && await tier(buyer) === 'plus', 'estorno parcial mantém o acesso');
r = await apply(B, 'pay-2', 'in_mediation', { refunded: 5000 });
check(r.status === 'in_dispute' && await tier(buyer) === 'plus', 'disputa mantém o acesso');
r = await apply(B, 'pay-2', 'charged_back', { refunded: 5000 });
check(r.status === 'charged_back' && await tier(buyer) === 'free', 'chargeback revoga e o aluno volta ao Free');

// ---------- Duplicidade entre pedidos em 24 h ----------
const D1 = (await create(other, 'plus_annual')).order_id; await attach(D1);
await apply(D1, 'pay-d1', 'approved');
const D2 = (await create(other, 'plus_annual')).order_id; await attach(D2);
r = await apply(D2, 'pay-d2', 'approved');
check(r.possible_duplicate === true && (await one(`SELECT count(*)::int n FROM audit_logs WHERE event_type='PAYMENT_ORDER_UPDATED' AND (metadata->>'possible_duplicate')::boolean`)).n >= 1,
  'dois anuais pagos em 24 h ficam marcados como possível duplicidade');

// ---------- Passe Concurso ----------
const passUser = await mkUser('pass@test.local');
const until = new Date(Date.now() + 30 * DAY).toISOString();
const P = await create(passUser, 'exam_pass', { track, list: 4990, until });
check(!!P.order_id, 'cria pedido do Passe');
await attach(P.order_id);
r = await apply(P.order_id, 'pay-p', 'approved', { amount: 4990 });
const pAcc = await access(passUser);
check(r.status === 'paid' && pAcc.source === 'mercadopago' && pAcc.paid_product === 'exam_pass' && near(pAcc.access_until, until),
  'Passe pago vale até a data fixa');

// ---------- Pedido vencido pago depois; expiração do acesso ----------
const lateUser = await mkUser('late@test.local');
const L = (await create(lateUser, 'plus_annual')).order_id; await attach(L);
await db.query(`UPDATE payment_orders SET expires_at = now() - interval '1 minute' WHERE id=$1`, [L]);
await rpc(`SELECT expire_premium_grants()`);
check((await order(L)).status === 'expired', 'job horário encerra pedido aberto vencido');
r = await apply(L, 'pay-late', 'approved');
check(r.status === 'paid' && await tier(lateUser) === 'plus', 'Pix pago depois do prazo é honrado');
await db.query(`UPDATE payment_orders SET paid_at = now() - interval '13 months' WHERE id=$1`, [L]);
const downgraded = await rpc(`SELECT expire_premium_grants()`);
check(downgraded >= 1 && await tier(lateUser) === 'free', 'fim dos 12 meses rebaixa o aluno no job horário');
await as(lateUser);
check(await rpc(`SELECT get_user_tier($1)`, [lateUser]) === 'free', 'get_user_tier deixa de contar o acesso vencido');

// ---------- Pedidos do próprio aluno ----------
const mine = await rpc(`SELECT get_my_payment_orders(10)`);
check(Array.isArray(mine) && mine.length === 1 && mine[0].id === L && mine[0].checkout_url === null && !('provider_payment_id' in mine[0]),
  'aluno vê só os próprios pedidos, sem ids do provedor');
await as(passUser);
const openP = await create(passUser, 'plus_annual');
check(openP.error === 'forbidden', 'aluno não cria pedido');
await as(null, 'service_role');
const open2 = (await create(passUser, 'plus_annual')).order_id; await attach(open2);
await as(passUser);
const passOrders = await rpc(`SELECT get_my_payment_orders(10)`);
check(passOrders.find((o) => o.id === open2)?.checkout_url?.startsWith('https://www.mercadopago.com.br/') === true,
  'pedido aberto devolve o link para retomar o pagamento');
await as(null, 'anon');
let denied = false;
try { await rpc(`SELECT get_my_payment_orders(10)`); } catch { denied = true; }
check(denied, 'sem login, get_my_payment_orders recusa');

// ---------- Ambiente: teste x produção ----------
await as(null, 'service_role');
const tester = await mkUser('tester@test.local');
const T = (await create(tester, 'plus_annual', { live: false })).order_id; await attach(T);
check((await order(T)).live_mode === false, 'pedido criado com credencial de teste fica marcado');
r = await apply(T, 'pay-t', 'approved', { live: true });
check(r.error === 'environment_mismatch' && await tier(tester) === 'free', 'pagamento real não vale para pedido de teste');
r = await apply(T, 'pay-t', 'approved', { live: false });
const tAcc = await access(tester);
check(r.status === 'paid' && near(tAcc.access_until, new Date((await order(T)).paid_at).getTime() + DAY),
  'pagamento de teste dá no máximo 24 h de acesso');
const R = (await create(other, 'exam_pass', { track, list: 4990, until: new Date(Date.now() + 30 * DAY).toISOString() })).order_id; await attach(R);
r = await apply(R, 'pay-r', 'approved', { amount: 4990, live: false });
check(r.error === 'environment_mismatch', 'pagamento de teste não vale para pedido real');

// ---------- Comissão: estorno lido primeiro e desconto sem comissão nova ----------
const affiliate2 = await mkUser('affiliate2@test.local');
const ref2 = (await one(`INSERT INTO referral_codes(user_id, code, discount_percent, commission_percent) VALUES ($1, 'PROF20', 10, 20) RETURNING id`, [affiliate2])).id;
const late2 = await mkUser('late2@test.local');
const E = (await create(late2, 'plus_annual', { discount: 1599, ref: ref2 })).order_id; await attach(E);
r = await apply(E, 'pay-e', 'refunded', { amount: 14391, refunded: 14391 });
check(r.status === 'refunded' && (await one(`SELECT count(*)::int n FROM referral_uses WHERE referred_user_id=$1`, [late2])).n === 0
  && (await order(E)).commission_review === false, 'estorno lido antes da aprovação não gera comissão nem revisão');
const C = (await create(buyer, 'plus_annual', { discount: 1599, ref: refCode })).order_id; await attach(C);
r = await apply(C, 'pay-c', 'approved', { amount: 14391 });
check(r.status === 'paid' && (await order(C)).commission_review === true,
  'desconto sem comissão nova (indicado já registrado) fica para o Financeiro revisar');

// ---------- Retenção das notificações ----------
await db.query(`INSERT INTO payment_provider_events(provider, event_id, topic, received_at) VALUES ('mercadopago', 'old', 'payment', now() - interval '200 days'), ('mercadopago', 'new', 'payment', now())`);
await rpc(`SELECT expire_premium_grants()`);
check((await one(`SELECT count(*)::int n FROM payment_provider_events WHERE event_id IN ('old', 'new')`)).n === 1, 'notificações com mais de 180 dias são apagadas');

// ---------- Visão do admin ----------
const admin = await mkUser('admin@test.local');
await db.query(`INSERT INTO user_roles(user_id, role) VALUES ($1, 'admin')`, [admin]);
await as(admin);
const ov = await rpc(`SELECT admin_platform_overview()`);
const mp = ov.payments?.mercadopago;
// Pagos reais nos últimos 30 dias: renovação (depois chargeback), dois anuais em duplicidade, o Passe,
// o anual estornado antes de aprovar (E) e o anual com desconto sem comissão nova (C). O de teste fica fora.
// Abertos: o do aluno do Passe e o pedido real que recusou o pagamento de teste (R).
check(!!mp && mp.paid_30d === 6 && mp.received_30d_cents === 3 * 15990 + 4990 + 2 * 14391
  && mp.refunded_30d_cents === 15990 + 14391 && mp.needs_review === 4 && mp.open_orders === 2 && mp.test_paid_30d === 1,
  `visão do admin traz vendas do Mercado Pago (${JSON.stringify(mp)})`);
check(ov.users.plus_mercadopago >= 2 && typeof ov.users.plus_granted === 'number', 'Plus pago no Mercado Pago separado da cortesia');

console.log(failures ? `\n${failures} FALHA(S)` : '\nTodos os testes passaram');
process.exit(failures ? 1 : 0);
