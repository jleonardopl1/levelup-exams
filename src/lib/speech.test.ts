import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickVoice, questionSpeechText, speakable, splitForSpeech } from './speech.ts';

describe('speakable', () => {
  it('expande abreviações jurídicas', () => {
    assert.equal(speakable('Conforme o art. 37, § 1º, inc. II da CF/88'),
      'Conforme o artigo 37, parágrafo 1º, inciso II da Constituição Federal de 1988');
    assert.equal(speakable('arts. 5º e 6º; §§ 2º e 3º'), 'artigos 5º e 6º; parágrafos 2º e 3º');
  });

  it('nº e "no" de norma viram "número"; ano da norma vira "de"', () => {
    assert.equal(speakable('Lei nº 8.112/1990'), 'Lei número 8.112 de 1990');
    assert.equal(speakable('Lei no 13.709/2018 (LGPD)'), 'Lei número 13.709 de 2018 (LGPD)');
    assert.equal(speakable('LC no 93/2003'), 'Lei Complementar número 93 de 2003');
  });

  it('não mexe em "no" comum nem em frações', () => {
    assert.equal(speakable('Estava no 5º andar e comeu 1/2 pizza'), 'Estava no 5º andar e comeu 1/2 pizza');
  });
});

describe('questionSpeechText', () => {
  it('lê enunciado e alternativas com a letra', () => {
    assert.equal(
      questionSpeechText('Qual é a capital de MT?', ['Cuiabá', 'Várzea Grande.']),
      'Qual é a capital de MT? Alternativa A: Cuiabá. Alternativa B: Várzea Grande.',
    );
  });
});

describe('splitForSpeech', () => {
  it('mantém texto curto inteiro e vazio vira lista vazia', () => {
    assert.deepEqual(splitForSpeech('Olá. Tudo bem?'), ['Olá. Tudo bem?']);
    assert.deepEqual(splitForSpeech('   '), []);
  });

  it('quebra nas frases sem passar do limite', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Frase número ${i} com algumas palavras.`).join(' ');
    const chunks = splitForSpeech(text, 80);
    assert.ok(chunks.length > 1);
    for (const c of chunks) assert.ok(c.length <= 80, c);
    assert.equal(chunks.join(' '), text);
  });

  it('frase enorme quebra nas palavras', () => {
    const long = 'palavra '.repeat(100).trim();
    const chunks = splitForSpeech(long, 50);
    for (const c of chunks) assert.ok(c.length <= 50);
    assert.equal(chunks.join(' '), long);
  });
});

describe('pickVoice', () => {
  const v = (lang: string, name: string, def = false) => ({ lang, name, default: def });

  it('prefere pt-BR, e a padrão entre elas', () => {
    assert.equal(pickVoice([v('en-US', 'a'), v('pt-BR', 'b'), v('pt-BR', 'c', true)])?.name, 'c');
    assert.equal(pickVoice([v('pt_BR', 'b')])?.name, 'b');
  });

  it('cai para outro português e depois para nenhuma', () => {
    assert.equal(pickVoice([v('en-US', 'a'), v('pt-PT', 'p')])?.name, 'p');
    assert.equal(pickVoice([v('en-US', 'a')]), null);
  });
});
