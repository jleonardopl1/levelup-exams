import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completeManagedSignIn, hasOAuthSessionParameters, oauthErrorMessage, oauthReturnError } from './oauth.ts';
import { AUTH_UNAVAILABLE_MESSAGE } from './authService.ts';
import { rememberAfterLogin, takeAfterLogin } from './afterLogin.ts';

describe('retorno do provedor gerenciado', () => {
  const tokens = { access_token: 'acesso-ficticio', refresh_token: 'renovacao-ficticia' };

  it('aguarda o redirecionamento e preserva o erro do provedor sem tentar criar sessão', async () => {
    const inesperado = async () => assert.fail('Não deveria instalar uma sessão');
    assert.deepEqual(await completeManagedSignIn({ redirected: true, error: null }, inesperado), { error: null });
    const error = new Error('Sign in was cancelled');
    assert.equal((await completeManagedSignIn({ error }, inesperado)).error, error);
  });

  it('só conclui o retorno por popup quando o Supabase confirma a sessão', async () => {
    const result = { error: null, tokens };
    const installed = await completeManagedSignIn(result, async received => {
      assert.deepEqual(received, tokens);
      return { data: { session: { user: { id: 'aluno-ficticio' } } }, error: null };
    });
    assert.equal(installed.error, null);
    const rejected = new Error('Failed to fetch');
    assert.equal((await completeManagedSignIn(result, async () =>
      ({ data: { session: null }, error: rejected }))).error, rejected);
    const empty = await completeManagedSignIn(result, async () => ({ data: { session: null }, error: null }));
    assert.match(oauthErrorMessage(empty.error), /sessão de login não foi confirmada/);
  });
});

describe('mensagens no retorno social', () => {
  it('lê erros em query e fragmento e mostra orientações fixas', () => {
    assert.match(oauthReturnError('?error_code=provider_disabled', '') ?? '', /método de login está indisponível/);
    assert.match(oauthReturnError('', '#error_description=This+flow+is+not+supported+in+Preview+mode') ?? '', /nova aba/);
    assert.match(oauthReturnError('?error=access_denied', '#error_description=example%40example.invalid') ?? '', /cancelado/);
    assert.equal(oauthReturnError('?error=temporarily_unavailable', ''), AUTH_UNAVAILABLE_MESSAGE);
    assert.equal(oauthErrorMessage({ name: 'AuthRetryableFetchError', status: 0 }), AUTH_UNAVAILABLE_MESSAGE);
  });

  it('mantém dados do provedor fora dos avisos e deixa callbacks bem-sucedidos para o SDK', () => {
    const generic = oauthErrorMessage(null);
    assert.equal(oauthReturnError('?error_description=VALOR_FICTICIO_PRIVADO', ''), generic);
    assert.equal(oauthReturnError('?code=ficticio&state=estado', ''), null);
    assert.equal(oauthReturnError('', '#access_token=ficticio&refresh_token=ficticio'), null);
  });

  it('reconhece a navegação de volta com código ou tokens para conferir o resultado do SDK', () => {
    assert.equal(hasOAuthSessionParameters('?code=ficticio', ''), true);
    assert.equal(hasOAuthSessionParameters('', '#access_token=ficticio&refresh_token=ficticio'), true);
    assert.equal(hasOAuthSessionParameters('?ref=TURMA', '#simulado'), false);
  });
});

it('guarda a rota de estudo uma vez e filtra dados de autenticação de destinos novos e antigos', t => {
  const values = new Map<string, string>();
  const key = 'levelup:after-login';
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
    removeItem: (name: string) => values.delete(name),
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  });
  rememberAfterLogin('/trilhas/demo/simulado?ref=TURMA&code=ficticio&state=ficticio#access_token=ficticio');
  assert.equal(values.get(key), '/trilhas/demo/simulado?ref=TURMA');
  assert.equal(takeAfterLogin(), '/trilhas/demo/simulado?ref=TURMA');
  assert.equal(takeAfterLogin(), '/');
  values.set(key, '/quiz?modo=revisao&refresh_token=ficticio');
  assert.equal(takeAfterLogin(), '/quiz?modo=revisao');
  rememberAfterLogin('https://example.invalid/destino');
  rememberAfterLogin('/auth');
  assert.equal(values.size, 0);
});
