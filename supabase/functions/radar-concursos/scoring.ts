/**
 * Relevância de um concurso (0–100), decidida em código — é ela que ordena o radar e
 * diz quais concursos merecem trilha primeiro ("mais importantes e com maior demanda").
 *
 *   abrangência (até 30) + vagas (até 25) + salário (até 20) + fase (até 15)
 *   + interesse dos alunos que já acompanham (até 10)
 */
import type { ConcursoFacts, ConcursoStatus, Esfera } from "./types.ts";

const CAPITAIS = new Set([
  "rio branco", "maceio", "macapa", "manaus", "salvador", "fortaleza", "brasilia", "vitoria", "goiania", "sao luis", "cuiaba",
  "campo grande", "belo horizonte", "belem", "joao pessoa", "curitiba", "recife", "teresina", "rio de janeiro", "natal",
  "porto alegre", "porto velho", "boa vista", "florianopolis", "sao paulo", "aracaju", "palmas",
]);

const ESFERA_POINTS: Record<Esfera, number> = { federal: 30, estadual: 20, distrital: 20, municipal: 10 };

const PHASE_POINTS: Partial<Record<ConcursoStatus, number>> = {
  previsto: 5,
  autorizado: 10,
  banca_definida: 12,
  edital_publicado: 15,
  inscricoes_abertas: 15,
  inscricoes_encerradas: 8,
  prova_aplicada: 2,
};

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function relevanceScore(c: ConcursoFacts & { status?: ConcursoStatus }, followers = 0): number {
  let score = 0;
  if (c.esfera) score += ESFERA_POINTS[c.esfera];
  if (c.esfera === "municipal" && c.municipio && CAPITAIS.has(plain(c.municipio))) score += 5;
  if (c.vagas && c.vagas > 0) score += Math.min(25, 6 * Math.log10(c.vagas + 1));
  if (c.salario_max && c.salario_max > 0) score += Math.min(20, c.salario_max / 1000);
  if (c.status) score += PHASE_POINTS[c.status] ?? 0;
  if (followers > 0) score += Math.min(10, 2 * Math.log2(followers + 1));
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Concurso que merece rascunho de trilha: edital na rua, relevante e ainda sem trilha. */
export function shouldSuggestTrack(c: { status: ConcursoStatus; relevance: number; track_id: string | null }, threshold = 40): boolean {
  return !c.track_id && (c.status === "edital_publicado" || c.status === "inscricoes_abertas") && c.relevance >= threshold;
}
