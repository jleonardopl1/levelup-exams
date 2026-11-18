import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMastery, countedAttempts, masteryByTopic, masteryLevel, subjectMastery,
  GENERAL_TOPIC, SAME_SESSION_MS, type AttemptRecord,
} from './mastery.ts';

const H = 60 * 60 * 1000;
const DAY = 24 * H;
const t0 = Date.UTC(2026, 10, 1, 12);

const att = (q: string, ok: boolean, at: number, topic: string | null = 'Crase', subject = 's1'): AttemptRecord =>
  ({ questionId: q, subjectId: subject, topic, isCorrect: ok, at });

describe('computeMastery', () => {
  it('sem respostas = 0', () => {
    assert.equal(computeMastery([]), 0);
  });

  it('um acerto de sorte fica no teto de 50%', () => {
    assert.equal(computeMastery([true]), 0.5);
  });

  it('dois acertos ficam no teto de 80%', () => {
    assert.equal(computeMastery([true, true]), 0.8);
  });

  it('três acertos chegam a 100%', () => {
    assert.equal(computeMastery([true, true, true]), 1);
  });

  it('respostas recentes pesam mais (recuperação depois de errar é premiada)', () => {
    const recovering = computeMastery([false, false, true, true, true]);
    const declining = computeMastery([true, true, true, false, false]);
    assert.ok(recovering > declining, `${recovering} > ${declining}`);
  });

  it('usa só as 5 últimas respostas', () => {
    assert.equal(computeMastery([false, false, false, true, true, true, true, true]), 1);
  });

  it('aceita crédito parcial e limita a [0, 1]', () => {
    assert.equal(computeMastery([0.5, 0.5, 0.5]), 0.5);
    assert.equal(computeMastery([2, -1, 1]), computeMastery([1, 0, 1]));
  });
});

describe('masteryLevel', () => {
  it('faixas', () => {
    assert.equal(masteryLevel(0), 'fragil');
    assert.equal(masteryLevel(0.3), 'construcao');
    assert.equal(masteryLevel(0.6), 'quase');
    assert.equal(masteryLevel(0.8), 'quase'); // 2 acertos ainda não "dominam"
    assert.equal(masteryLevel(0.85), 'dominado');
  });
});

describe('countedAttempts', () => {
  it('ignora repetir a mesma questão na mesma sessão (fluência, não memória)', () => {
    const out = countedAttempts([
      att('q1', false, t0),
      att('q1', true, t0 + 10 * 60 * 1000), // revisou 10 min depois de ver a explicação
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].isCorrect, false);
  });

  it('conta a mesma questão de novo depois do intervalo', () => {
    const out = countedAttempts([att('q1', false, t0), att('q1', true, t0 + SAME_SESSION_MS)]);
    assert.equal(out.length, 2);
  });

  it('questões diferentes na mesma sessão contam', () => {
    assert.equal(countedAttempts([att('q1', true, t0), att('q2', true, t0 + 1000)]).length, 2);
  });

  it('ordena por data e descarta datas inválidas', () => {
    const out = countedAttempts([
      att('q2', true, t0 + DAY),
      att('q1', false, t0),
      { ...att('q3', true, 0), at: 'não é data' },
    ]);
    assert.deepEqual(out.map((a) => a.questionId), ['q1', 'q2']);
  });

  it('aceita datas ISO', () => {
    const out = countedAttempts([
      { ...att('q1', true, 0), at: '2026-11-02T10:00:00Z' },
      { ...att('q2', true, 0), at: '2026-11-01T10:00:00Z' },
    ]);
    assert.deepEqual(out.map((a) => a.questionId), ['q2', 'q1']);
  });
});

describe('masteryByTopic e subjectMastery', () => {
  const attempts = [
    att('q1', true, t0, 'Crase'),
    att('q2', true, t0 + DAY, 'Crase'),
    att('q3', true, t0 + 2 * DAY, 'Crase'),
    att('q4', false, t0, 'Regência'),
    att('q5', true, t0 + DAY, ' Regência  '),
    att('q6', false, t0 + 2 * DAY, 'Regência'),
    att('q7', true, t0, null),
    att('q8', false, t0, 'Porcentagem', 's2'),
  ];

  it('agrupa por matéria + tópico normalizado, com "Geral" para tópico vazio', () => {
    const topics = masteryByTopic(attempts);
    const names = topics.filter((t) => t.subjectId === 's1').map((t) => t.topic).sort();
    assert.deepEqual(names, ['Crase', GENERAL_TOPIC, 'Regência'].sort());
    const regencia = topics.find((t) => t.topic === 'Regência')!;
    assert.equal(regencia.evidence, 3);
    assert.equal(regencia.lastWrong, true);
    assert.equal(topics.find((t) => t.topic === 'Crase')!.level, 'dominado');
  });

  it('matéria: média dos tópicos praticados, do mais frágil ao mais forte', () => {
    const topics = masteryByTopic(attempts);
    const s1 = subjectMastery('s1', topics);
    assert.equal(s1.topics[0].topic, 'Regência');
    assert.equal(s1.topics.at(-1)!.topic, 'Crase');
    const expected = (1 + 0.5 + computeMastery([false, true, false])) / 3;
    assert.ok(Math.abs(s1.mastery! - expected) < 1e-9);
  });

  it('matéria sem respostas', () => {
    const none = subjectMastery('s9', masteryByTopic(attempts));
    assert.equal(none.mastery, null);
    assert.equal(none.level, null);
    assert.deepEqual(none.topics, []);
  });
});
