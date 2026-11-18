import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { editalProgress, hashText, parseEditalState, parseSyllabus, toggleEditalItem } from './edital.ts';

const PORTUGUES =
  '1. Leitura e interpretação de textos de variados gêneros discursivos. 2. Condições de produção de um texto. ' +
  '3. Linguagem e adequação social: registros formal e informal. 4. Aspectos linguísticos: sintaxe (concordâncias verbal e nominal). ' +
  '5. Textualidade: coesão, coerência. 6. Pontuação. 7. Tipos de discurso: direto e indireto.';

describe('parseSyllabus', () => {
  it('quebra a numeração do edital', () => {
    const items = parseSyllabus(PORTUGUES);
    assert.equal(items.length, 7);
    assert.equal(items[0].number, 1);
    assert.equal(items[0].text, 'Leitura e interpretação de textos de variados gêneros discursivos.');
    assert.equal(items[5].text, 'Pontuação.');
    assert.equal(items[6].number, 7);
  });

  it('não quebra em números fora da sequência (Windows 10, art. 5.)', () => {
    const items = parseSyllabus(
      '1. Windows 10 e 11 e distribuições Linux. 2. Constituição: art. 5. Direitos e garantias. 3. Lei 8.112/1990.',
    );
    assert.deepEqual(items.map((i) => i.number), [1, 2, 3]);
    assert.match(items[1].text, /art\. 5\. Direitos/);
  });

  it('não confunde subitens 1.1 com itens', () => {
    const items = parseSyllabus('1. Atos administrativos: 1.1 conceito; 1.2 requisitos. 2. Licitações.');
    assert.equal(items.length, 2);
    assert.match(items[0].text, /1\.1 conceito; 1\.2 requisitos/);
  });

  it('mantém o preâmbulo antes do item 1', () => {
    const items = parseSyllabus('Lei Orgânica do Município. 1. Organização. 2. Competências.');
    assert.equal(items.length, 3);
    assert.equal(items[0].number, null);
  });

  it('sem numeração: divide por linha ou por ponto e vírgula', () => {
    assert.equal(parseSyllabus('Crase\nRegência\n- Concordância').length, 3);
    assert.deepEqual(parseSyllabus('Conjuntos; Proposições; Contagem').map((i) => i.text), ['Conjuntos', 'Proposições', 'Contagem']);
  });

  it('texto corrido vira um item; vazio vira lista vazia', () => {
    assert.equal(parseSyllabus('Noções gerais de ética no serviço público.').length, 1);
    assert.deepEqual(parseSyllabus(''), []);
    assert.deepEqual(parseSyllabus(null), []);
  });

  it('ids estáveis e únicos', () => {
    const a = parseSyllabus(PORTUGUES);
    const b = parseSyllabus(`  ${PORTUGUES.replace(/ /g, '  ')}  `);
    assert.deepEqual(a.map((i) => i.id), b.map((i) => i.id));
    const dup = parseSyllabus('Crase; Crase; Regência');
    assert.equal(new Set(dup.map((i) => i.id)).size, 3);
  });
});

describe('estado do edital', () => {
  it('alterna campos e remove item vazio', () => {
    let s = toggleEditalItem({}, 'a', 'teoria');
    assert.deepEqual(s, { a: { teoria: true } });
    s = toggleEditalItem(s, 'a', 'revisao');
    assert.deepEqual(s, { a: { teoria: true, revisao: true } });
    s = toggleEditalItem(toggleEditalItem(s, 'a', 'teoria'), 'a', 'revisao');
    assert.deepEqual(s, {});
  });

  it('não muta o estado anterior', () => {
    const before = { a: { teoria: true } };
    toggleEditalItem(before, 'a', 'revisao');
    assert.deepEqual(before, { a: { teoria: true } });
  });

  it('progresso conta só itens do edital atual', () => {
    const items = parseSyllabus('Crase; Regência; Pontuação');
    const state = { [items[0].id]: { teoria: true, revisao: true }, [items[1].id]: { teoria: true }, antigo: { teoria: true } };
    assert.deepEqual(editalProgress(items, state), { total: 3, teoria: 2, revisao: 1 });
  });

  it('leitura tolerante do armazenamento', () => {
    assert.deepEqual(parseEditalState(null), {});
    assert.deepEqual(parseEditalState('{quebrado'), {});
    assert.deepEqual(parseEditalState('[1,2]'), {});
    assert.deepEqual(
      parseEditalState(JSON.stringify({ a: { teoria: true, revisao: 'sim', x: 1 }, b: 3, c: {} })),
      { a: { teoria: true } },
    );
  });

  it('hash determinístico', () => {
    assert.equal(hashText('crase'), hashText('crase'));
    assert.notEqual(hashText('crase'), hashText('regência'));
  });
});
