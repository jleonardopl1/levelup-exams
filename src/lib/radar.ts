/**
 * Rótulos e formatação do Radar de Concursos (funções puras, sem dependências).
 * As fases espelham o CHECK de radar_concursos.status (migration 20261117120000).
 */
export type RadarStatus =
  | 'previsto'
  | 'autorizado'
  | 'banca_definida'
  | 'edital_publicado'
  | 'inscricoes_abertas'
  | 'inscricoes_encerradas'
  | 'prova_aplicada'
  | 'resultado_final'
  | 'homologado'
  | 'suspenso'
  | 'cancelado';

export type RadarEsfera = 'federal' | 'estadual' | 'distrital' | 'municipal';

export const STATUS_LABEL: Record<RadarStatus, string> = {
  previsto: 'Previsto',
  autorizado: 'Autorizado',
  banca_definida: 'Banca definida',
  edital_publicado: 'Edital publicado',
  inscricoes_abertas: 'Inscrições abertas',
  inscricoes_encerradas: 'Inscrições encerradas',
  prova_aplicada: 'Prova aplicada',
  resultado_final: 'Resultado final',
  homologado: 'Homologado',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
};

/** Classes de cor do selo da fase (tokens do design system). */
export function statusTone(status: RadarStatus): string {
  switch (status) {
    case 'edital_publicado':
    case 'inscricoes_abertas':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'autorizado':
    case 'banca_definida':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40';
    case 'suspenso':
    case 'cancelado':
      return 'bg-destructive/15 text-destructive border-destructive/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export const ESFERA_LABEL: Record<RadarEsfera, string> = {
  federal: 'Federal',
  estadual: 'Estadual',
  distrital: 'Distrital',
  municipal: 'Municipal',
};

export const FIELD_LABEL: Record<string, string> = {
  nome: 'Nome',
  banca: 'Banca',
  esfera: 'Esfera',
  uf: 'UF',
  municipio: 'Município',
  status: 'Fase',
  cargos: 'Cargos',
  vagas: 'Vagas',
  salario_max: 'Salário',
  escolaridade: 'Escolaridade',
  inscricoes_inicio: 'Início das inscrições',
  inscricoes_fim: 'Fim das inscrições',
  data_prova: 'Data da prova',
  link_oficial: 'Link oficial',
};

/** "2026-12-20" → "20/12/2026" (sem fuso: a data é civil). */
export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Dias de hoje até a data (negativo = já passou). */
export function daysFromToday(iso: string | null | undefined, today = new Date()): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86_400_000);
}

/** Valor de um campo alterado, formatado para a linha do tempo. */
export function formatChangeValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'status') return STATUS_LABEL[value as RadarStatus] ?? String(value);
  if (field === 'esfera') return ESFERA_LABEL[value as RadarEsfera] ?? String(value);
  if (field === 'salario_max') return formatMoney(value as number);
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (Array.isArray(value)) return value.slice(0, 6).join(', ') + (value.length > 6 ? '…' : '');
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateBr(value);
  return String(value);
}
