/**
 * Resultado do último simulado, guardado na sessão do navegador para que a tela
 * de resultado sobreviva a um recarregamento (antes mostrava 0% ao atualizar).
 */
export interface QuizReviewItem {
  questionId: string;
  enunciado: string;
  alternativas: string[];
  categoria: string;
  topico?: string | null;
  /** null = não respondida (tempo esgotado). */
  selected: number | null;
  correctIndex: number | null;
  correct: boolean;
  explicacao: string | null;
}

export interface QuizResultState {
  score: number;
  correct: number;
  total: number;
  timeSpent: number;
  backPath: string;
  retry: string;
  pointsEarned?: number;
  timedOut?: boolean;
  saved?: boolean;
  review?: QuizReviewItem[];
  /** Conta dona do resultado: outra conta no mesmo navegador nunca o vê. */
  userId?: string;
}

const KEY = 'levelup:last-quiz-result';

export function saveQuizResult(state: QuizResultState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* modo privado / armazenamento cheio: a tela usa o state da navegação */
  }
}

export function loadQuizResult(userId: string | null | undefined): QuizResultState | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuizResultState;
    if (typeof parsed?.score !== 'number' || parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Apaga o último resultado (chamado ao sair ou trocar de conta). */
export function clearQuizResult() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Monta a pergunta para o Mentor IA explicar uma questão. */
export function buildMentorPrompt(item: QuizReviewItem): string {
  const letter = (i: number | null) => (i === null || i < 0 ? '—' : String.fromCharCode(65 + i));
  const alts = item.alternativas.map((a, i) => `${letter(i)}) ${a}`).join('\n');
  const marked = item.selected === null ? 'Não respondi' : `Marquei ${letter(item.selected)}`;
  const text =
    `Me explique esta questão de ${item.categoria}:\n\n${item.enunciado}\n\n${alts}\n\n` +
    `${marked} e o gabarito é ${letter(item.correctIndex)}. Por que essa é a correta e onde errei?`;
  return text.slice(0, 1800);
}
