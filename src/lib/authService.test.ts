import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  AUTH_UNAVAILABLE_MESSAGE,
  authAvailabilityMessage,
  emailAuthErrorMessage,
  readAuthProviders,
} from './authService.ts';

const url = 'https://projeto.example.invalid/';
const key = 'chave-publica-ficticia';

it('consulta novamente depois de uma falha de rede e usa os provedores confirmados pelo serviço', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (request: string, options: RequestInit) => {
    calls++;
    assert.equal(request, new URL('/auth/v1/settings', url).href);
    assert.equal(new Headers(options.headers).get('apikey'), key);
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    if (calls === 1) throw new TypeError('Failed to fetch');
    return Response.json({ external: { google: false, azure: true, apple: 'true' } });
  });
  await assert.rejects(readAuthProviders(url, key), /Failed to fetch/);
  assert.deepEqual(await readAuthProviders(url, key), new Set(['azure']));
  assert.equal(calls, 2);
});

it('distingue serviço indisponível, resposta inválida e catálogo vazio confirmado', async t => {
  const responses = [
    new Response(null, { status: 503 }),
    Response.json({}),
    Response.json({ external: [] }),
    Response.json({ external: {} }),
  ];
  t.mock.method(globalThis, 'fetch', async () => responses.shift());
  for (let i = 0; i < 3; i++) {
    await assert.rejects(readAuthProviders(url, key), { message: AUTH_UNAVAILABLE_MESSAGE });
  }
  assert.deepEqual(await readAuthProviders(url, key), new Set());
});

it('distingue senha incorreta e indisponibilidade sem exibir mensagens devolvidas pelo servidor', () => {
  for (const error of [new TypeError('Failed to fetch'), { status: 503 }, { name: 'AuthRetryableFetchError' }]) {
    assert.equal(emailAuthErrorMessage(error), AUTH_UNAVAILABLE_MESSAGE);
  }
  assert.equal(emailAuthErrorMessage({ code: 'invalid_credentials', status: 400 }), 'Email ou senha incorretos.');
  assert.equal(emailAuthErrorMessage({ code: 'invalid_credentials', status: 401 }), 'Email ou senha incorretos.');
  assert.equal(emailAuthErrorMessage(new Error('detalhe-interno-ficticio')), 'Não foi possível concluir. Tente novamente.');
});

it('na recuperação, informa falhas de transporte e limites sem distinguir endereços cadastrados', () => {
  assert.equal(authAvailabilityMessage({ status: 0 }), AUTH_UNAVAILABLE_MESSAGE);
  assert.equal(authAvailabilityMessage({ status: 401 }), AUTH_UNAVAILABLE_MESSAGE);
  assert.equal(authAvailabilityMessage({ status: 403, code: 'email_provider_disabled' }), AUTH_UNAVAILABLE_MESSAGE);
  assert.match(authAvailabilityMessage({ status: 429 }) ?? '', /Muitas tentativas/);
  assert.match(authAvailabilityMessage({ code: 'over_email_send_rate_limit' }) ?? '', /Muitas tentativas/);
  assert.equal(authAvailabilityMessage({ code: 'user_not_found' }), null);
  assert.equal(authAvailabilityMessage(null), null);
});
