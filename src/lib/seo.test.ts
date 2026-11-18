import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clip, DESCRIPTION_MAX, faqPageJsonLd, organizationJsonLd, pageTitle, serializeJsonLd, TITLE_MAX,
  webApplicationJsonLd,
} from './seo.ts';

const SITE = {
  name: 'LevelUp Exams',
  url: 'https://levelupexams.com.br/',
  logo: 'https://levelupexams.com.br/icon-512.png',
  description: 'Estudos gamificados para concursos.',
};

describe('clip', () => {
  it('não mexe em texto curto e junta espaços', () => {
    assert.equal(clip('  Olá   mundo ', 20), 'Olá mundo');
  });

  it('corta sem quebrar palavra', () => {
    const out = clip('Prepare-se para concursos públicos com trilhas, simulados e revisão espaçada', 40);
    assert.ok(out.length <= 40, out);
    assert.ok(out.endsWith('…'));
    assert.ok(!/\s…$/.test(out));
  });

  it('descrição longa cabe no limite', () => {
    assert.ok(clip('palavra '.repeat(60), DESCRIPTION_MAX).length <= DESCRIPTION_MAX);
  });
});

describe('pageTitle', () => {
  it('acrescenta a marca e respeita o limite', () => {
    assert.equal(pageTitle('Perguntas frequentes', 'LevelUp Exams'), 'Perguntas frequentes | LevelUp Exams');
    assert.ok(pageTitle('x'.repeat(200), 'LevelUp Exams').length <= TITLE_MAX);
  });

  it('não repete a marca', () => {
    assert.equal(pageTitle('LevelUp Exams', 'LevelUp Exams'), 'LevelUp Exams');
    assert.equal(pageTitle('LevelUp Exams — Estudos', 'LevelUp Exams'), 'LevelUp Exams — Estudos');
  });
});

describe('JSON-LD', () => {
  it('FAQPage com perguntas e respostas visíveis', () => {
    const ld = faqPageJsonLd([{ question: ' O que é?  ', answer: 'Um app.' }]);
    assert.equal(ld['@type'], 'FAQPage');
    assert.deepEqual(ld.mainEntity, [{ '@type': 'Question', name: 'O que é?', acceptedAnswer: { '@type': 'Answer', text: 'Um app.' } }]);
  });

  it('Organization e WebApplication', () => {
    assert.equal(organizationJsonLd({ ...SITE, email: 'a@b.c' }).email, 'a@b.c');
    assert.equal('email' in organizationJsonLd(SITE), false);
    const app = webApplicationJsonLd(SITE);
    assert.equal(app.applicationCategory, 'EducationalApplication');
    assert.equal(app.inLanguage, 'pt-BR');
  });

  it('serialização não deixa fechar a tag <script>', () => {
    const out = serializeJsonLd(faqPageJsonLd([{ question: '</script><img src=x onerror=alert(1)>', answer: 'ok' }]));
    assert.ok(!out.includes('</script>'));
    assert.ok(!out.includes('<'));
    assert.equal(JSON.parse(out)['@type'], 'FAQPage');
  });
});
