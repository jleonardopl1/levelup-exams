/**
 * Domínio por tópico — lógica pura, testada em mastery.test.ts.
 *
 * Política adaptada do DeepTutor (HKUDS, `deeptutor/learning/mastery.py`): acerto ponderado
 * pela recência das últimas 5 respostas, com **teto de confiança** enquanto há pouca
 * evidência. Um acerto de sorte não "domina" um tópico: com 1 resposta o teto é 50%, com 2
 * é 80%. É a mesma regra do coding-interview-university ("acerte várias vezes antes de
 * marcar como sabido").
 *
 * Diferença para o original: repetir a MESMA questão pouco depois de ver a explicação mede
 * fluência, não memória de longo prazo. Essas repetições (menos de 6 h depois da última
 * resposta contada daquela questão) não entram na conta — mesmo limiar de "mesma sessão"
 * do agendador do DeepTutor (0,25 dia).
 *
 * Trocar a política (TRI, BKT, FSRS) é trocar `computeMastery` e nada mais.
 */

/** Peso das últimas respostas, da mais antiga para a mais recente. */
export const RECENCY_WEIGHTS = [0.5, 0.7, 0.85, 0.95, 1.0] as const;

/** Teto do domínio enquanto há poucas respostas contadas. */
export const CONFIDENCE_CAP: Readonly<Record<number, number>> = { 1: 0.5, 2: 0.8 };

/** Repetir a mesma questão antes disso não conta como nova evidência. */
export const SAME_SESSION_MS = 6 * 60 * 60 * 1000;

/** Rótulo do tópico sem `topico` na questão. */
export const GENERAL_TOPIC = 'Geral';

/** Acerto (true/false) ou crédito parcial entre 0 e 1, em ordem cronológica. */
export type Outcome = boolean | number;

/** Domínio entre 0 e 1 a partir das respostas de um tópico (ordem cronológica). */
export function computeMastery(outcomes: readonly Outcome[]): number {
  if (outcomes.length === 0) return 0;
  const recent = outcomes.slice(-RECENCY_WEIGHTS.length);
  const weights = RECENCY_WEIGHTS.slice(-recent.length);
  let weighted = 0;
  let total = 0;
  recent.forEach((o, i) => {
    const value = Math.max(0, Math.min(1, Number(o)));
    weighted += weights[i] * value;
    total += weights[i];
  });
  const score = weighted / total;
  return Math.min(score, CONFIDENCE_CAP[recent.length] ?? 1);
}

export type MasteryLevel = 'fragil' | 'construcao' | 'quase' | 'dominado';

export const MASTERY_LABEL: Readonly<Record<MasteryLevel, string>> = {
  fragil: 'Frágil',
  construcao: 'Em construção',
  quase: 'Quase lá',
  dominado: 'Dominado',
};

/**
 * Faixas de domínio. "Dominado" exige ≥ 0,85 — com o teto de confiança, isso só é possível
 * com pelo menos 3 respostas contadas.
 */
export function masteryLevel(mastery: number): MasteryLevel {
  if (mastery >= 0.85) return 'dominado';
  if (mastery >= 0.6) return 'quase';
  if (mastery >= 0.3) return 'construcao';
  return 'fragil';
}

export interface AttemptRecord {
  questionId: string;
  subjectId: string;
  topic: string | null;
  isCorrect: boolean;
  /** Momento da resposta (ISO ou epoch em ms). */
  at: string | number;
}

const toMs = (at: string | number) => (typeof at === 'number' ? at : Date.parse(at));

const topicKey = (topic: string | null) => {
  const t = (topic ?? '').replace(/\s+/g, ' ').trim();
  return t || GENERAL_TOPIC;
};

/**
 * Respostas que contam como evidência, em ordem cronológica: descarta repetições da mesma
 * questão feitas menos de `SAME_SESSION_MS` depois da última resposta contada dela.
 * Respostas com data inválida são ignoradas.
 */
export function countedAttempts(attempts: readonly AttemptRecord[]): AttemptRecord[] {
  const sorted = attempts
    .filter((a) => Number.isFinite(toMs(a.at)))
    .slice()
    .sort((a, b) => toMs(a.at) - toMs(b.at));
  const lastCounted = new Map<string, number>();
  const out: AttemptRecord[] = [];
  for (const a of sorted) {
    const t = toMs(a.at);
    const prev = lastCounted.get(a.questionId);
    if (prev !== undefined && t - prev < SAME_SESSION_MS) continue;
    lastCounted.set(a.questionId, t);
    out.push(a);
  }
  return out;
}

export interface TopicMastery {
  subjectId: string;
  topic: string;
  mastery: number;
  level: MasteryLevel;
  /** Respostas contadas no tópico (todas, não só as 5 últimas). */
  evidence: number;
  /** A última resposta contada foi um erro: vale revisar já. */
  lastWrong: boolean;
  lastAt: number;
}

/** Domínio de cada tópico (matéria + tópico da questão). */
export function masteryByTopic(attempts: readonly AttemptRecord[]): TopicMastery[] {
  const groups = new Map<string, AttemptRecord[]>();
  for (const a of countedAttempts(attempts)) {
    const key = `${a.subjectId}\u0000${topicKey(a.topic)}`;
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }
  const out: TopicMastery[] = [];
  for (const list of groups.values()) {
    const mastery = computeMastery(list.map((a) => a.isCorrect));
    const last = list[list.length - 1];
    out.push({
      subjectId: last.subjectId,
      topic: topicKey(last.topic),
      mastery,
      level: masteryLevel(mastery),
      evidence: list.length,
      lastWrong: !last.isCorrect,
      lastAt: toMs(last.at),
    });
  }
  return out;
}

export interface SubjectMastery {
  subjectId: string;
  /** Média do domínio dos tópicos já praticados (null = nenhum). */
  mastery: number | null;
  level: MasteryLevel | null;
  topics: TopicMastery[];
}

/**
 * Domínio de uma matéria: média dos tópicos já praticados. Tópicos ainda não praticados não
 * entram (a cobertura já aparece na barra de progresso da matéria). Os tópicos voltam do
 * mais frágil para o mais forte; empate: o que errou por último primeiro.
 */
export function subjectMastery(subjectId: string, topics: readonly TopicMastery[]): SubjectMastery {
  const mine = topics
    .filter((t) => t.subjectId === subjectId)
    .sort((a, b) => a.mastery - b.mastery || Number(b.lastWrong) - Number(a.lastWrong) || b.lastAt - a.lastAt);
  if (mine.length === 0) return { subjectId, mastery: null, level: null, topics: [] };
  const mastery = mine.reduce((s, t) => s + t.mastery, 0) / mine.length;
  return { subjectId, mastery, level: masteryLevel(mastery), topics: mine };
}
