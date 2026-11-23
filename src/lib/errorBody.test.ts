import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseErrorBody } from './errorBody.ts';

describe('parseErrorBody', () => {
  it('lê error e code quando são texto', () => {
    assert.deepEqual(parseErrorBody({ error: 'Cupom inválido', code: 'referral_invalid' }), {
      error: 'Cupom inválido',
      code: 'referral_invalid',
    });
  });

  it('ignora campos fora do formato', () => {
    assert.deepEqual(parseErrorBody({ error: { message: 'x' }, code: 42 }), { error: undefined, code: undefined });
    assert.deepEqual(parseErrorBody({ error: '' }), { error: undefined, code: undefined });
  });

  it('corpo que não é objeto vira vazio', () => {
    for (const body of [null, undefined, 'erro', 500, true]) assert.deepEqual(parseErrorBody(body), {});
  });
});
