import type { LucideIcon } from 'lucide-react';
import {
  Bot, BookOpen, ClipboardCheck, FileText, Infinity as InfinityIcon, Map, PenLine, Repeat, Sparkles, Trophy,
} from 'lucide-react';

/**
 * Fonte única dos limites e benefícios dos planos.
 *
 * Tudo o que aparece em Planos, FAQ e nos modais de upgrade sai daqui. Antes eram
 * cinco listas diferentes, e algumas prometiam recursos que não existiam (PDF,
 * estatísticas avançadas, "sem anúncios", "acesso prioritário", Mentor "ilimitado").
 * Regra: só entra aqui o que tem tela funcionando. Os limites que o servidor aplica
 * estão citados ao lado; se mudar um, mude o outro.
 */
export const LIMITS = {
  /** useDailyUsage / increment_daily_usage */
  freeQuestionsPerDay: 30,
  /** ai-mentor DAILY_LIMIT */
  mentorQuestionsPerDay: 6,
  /** start_mock_exam: Free 1 a cada 30 dias */
  freeMockExamsPerMonth: 1,
  /** get_review_queue v_free_daily */
  freeReviewsPerDay: 5,
  /** essay-review WEEKLY_LIMIT */
  essayReviewsPerWeek: 3,
} as const;

export const PRICES = {
  monthly: 'R$ 19,90',
  annual: 'R$ 159,90',
  annualPerMonth: 'R$ 13,32',
} as const;

export interface Benefit {
  icon: LucideIcon;
  text: string;
  /** Destaque visual nos modais (o benefício que mais pesa na decisão). */
  highlight?: boolean;
}

export const FREE_BENEFITS: Benefit[] = [
  { icon: BookOpen, text: `${LIMITS.freeQuestionsPerDay} questões por dia` },
  { icon: Map, text: 'Trilhas por concurso com projeção de nota' },
  { icon: ClipboardCheck, text: `${LIMITS.freeMockExamsPerMonth} Simulado Oficial por mês` },
  { icon: Repeat, text: `Revisão dos erros: ${LIMITS.freeReviewsPerDay} por dia` },
  { icon: Trophy, text: 'Ranking global' },
];

export const PLUS_BENEFITS: Benefit[] = [
  { icon: InfinityIcon, text: 'Questões ilimitadas', highlight: true },
  { icon: ClipboardCheck, text: 'Simulados Oficiais ilimitados, com sua posição entre os candidatos do cargo', highlight: true },
  { icon: PenLine, text: `Correção da discursiva com os critérios da banca (${LIMITS.essayReviewsPerWeek} por semana)` },
  { icon: Repeat, text: 'Revisão espaçada de todos os seus erros' },
  { icon: Bot, text: `Mentor IA que conhece seu desempenho (${LIMITS.mentorQuestionsPerDay} perguntas/dia + explicações de questões)` },
  { icon: FileText, text: 'Resultado com explicações em PDF' },
  { icon: Sparkles, text: 'Questões exclusivas Plus no banco geral' },
];

/** Texto corrido para o FAQ. */
export const PLUS_BENEFITS_SENTENCE =
  'O plano Plus oferece: ' +
  PLUS_BENEFITS.map((b) => b.text.charAt(0).toLowerCase() + b.text.slice(1)).join('; ') +
  '.';
