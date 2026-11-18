/** Regras de pontuação da discursiva — puras, testadas em rubric.test.ts. */
import { stripControlChars } from "../_shared/utils.ts";

export const CHARS_PER_LINE = 75; // linha manuscrita da folha de resposta (estimativa)
export const CONTENT_CRITERIA = [
  { key: "adequacao", nome: "Adequação ao tema e ao comando", max: 30 },
  { key: "dominio", nome: "Domínio técnico do conteúdo", max: 30 },
  { key: "estrutura", nome: "Organização, coesão e coerência", max: 20 },
] as const;
export const FORMAL_MAX = 20;
export const FORMAL_PER_ERROR = 1;

/** Linhas que o texto ocuparia na folha: cada parágrafo começa numa linha nova. */
export function estimateLines(text: string): number {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => acc + Math.max(1, Math.ceil(p.length / CHARS_PER_LINE)), 0);
}

const clamp = (n: unknown, max: number) => Math.min(max, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0));
export const str = (v: unknown, max = 600) => (typeof v === "string" ? stripControlChars(v).trim().slice(0, max) : "");
export const strList = (v: unknown, maxItems: number, maxLen = 300) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);

/** Normaliza a saída do modelo e calcula a nota no servidor. */
export function buildFeedback(raw: Record<string, unknown>, texto: string) {
  const byKey = new Map(
    (Array.isArray(raw.criterios) ? raw.criterios : []).map((c: Record<string, unknown>) => [c?.key, c]),
  );
  const criterios = CONTENT_CRITERIA.map((c) => {
    const r = byKey.get(c.key) as Record<string, unknown> | undefined;
    return { key: c.key, nome: c.nome, max: c.max, nota: Math.round(clamp(r?.nota, c.max) * 2) / 2, comentario: str(r?.comentario) };
  });
  const lower = texto.toLowerCase();
  // Só conta erro cujo trecho existe no texto (evita desconto por erro inventado).
  const erros = (Array.isArray(raw.erros) ? raw.erros : [])
    .map((e: Record<string, unknown>) => ({ trecho: str(e?.trecho, 200), tipo: str(e?.tipo, 40) || "outro", correcao: str(e?.correcao, 200) }))
    .filter((e) => e.trecho && lower.includes(e.trecho.toLowerCase()))
    .slice(0, 40);
  const conteudo = criterios.reduce((a, c) => a + c.nota, 0);
  const formal = Math.max(0, FORMAL_MAX - FORMAL_PER_ERROR * erros.length);
  const reescrita = raw.reescrita as Record<string, unknown> | undefined;
  return {
    score: Math.round((conteudo + formal) * 100) / 100,
    feedback: {
      versao: 1,
      conteudo: { nota: conteudo, max: 80, criterios },
      formal: { nota: formal, max: FORMAL_MAX, desconto_por_erro: FORMAL_PER_ERROR, erros },
      aspectos_ausentes: strList(raw.aspectos_ausentes, 6),
      pontos_fortes: strList(raw.pontos_fortes, 4),
      melhorias: strList(raw.melhorias, 5),
      reescrita: reescrita ? { original: str(reescrita.original, 1500), sugerida: str(reescrita.sugerida, 1500) } : null,
    },
  };
}
