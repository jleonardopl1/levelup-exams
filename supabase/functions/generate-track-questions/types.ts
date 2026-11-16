/** Tipos compartilhados da fábrica de questões (generate-track-questions). */

export type Nivel = "medio" | "superior";

export interface SubjectContext {
  subjectId: string;
  name: string;
  slug: string;
  banca: string;
  trackName: string;
  /** Matéria de legislação local: só pode usar os fatos verificados. */
  grounded: boolean;
  /** Questões por dia: maior entre QUESTIONS_PER_SUBJECT_DAY e weekly_target/7 da matéria. */
  dailyTarget: number;
  modules: { nivel: Nivel; name: string; syllabus: string; cargo: string | null; area: string }[];
}

export interface GeneratedQuestion {
  topico: string;
  dificuldade: "Fácil" | "Médio" | "Difícil";
  nivel: "ambos" | Nivel;
  enunciado: string;
  alternativas: string[];
  correta: number;
  explicacao: string;
}

/** Voto do solucionador cego para uma questão (não viu o gabarito). */
export interface SolverVote {
  indice: number;
  /** 0–3, ou null quando nenhuma alternativa é correta. */
  escolha: number | null;
  /** Mais de uma alternativa defensável, ou nenhuma correta. */
  ambigua: boolean;
  confianca: number;
  justificativa: string;
}

/** Veredito do revisor técnico (viu o gabarito). */
export interface ReviewVerdict {
  indice: number;
  aprovada: boolean;
  motivo: string;
}

/** Decisão do árbitro sobre uma questão em disputa. */
export interface ArbiterVerdict {
  indice: number;
  manter: boolean;
  /** Índice que o árbitro considera correto (null = nenhum). */
  gabaritoCorreto: number | null;
  unicaCorreta: boolean;
  motivo: string;
}

/** Quem originou uma lição para a memória da matéria (tabela ai_lessons). */
export type LessonSource = "revisor" | "solucionador" | "arbitro" | "validador";

export type Decision =
  | { kind: "accept"; degraded: boolean }
  | { kind: "reject"; source: LessonSource; reasons: string[] }
  | { kind: "arbitrate"; reasons: string[] };
