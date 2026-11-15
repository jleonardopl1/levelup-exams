import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { buildFeedback, estimateLines } from "./rubric.ts";

const texto = "A administracao publica deve obedecer ao principio da publicidade.\n\nOs atos sao publicados no diario oficial e no portal.";

Deno.test("estimateLines: cada parágrafo começa numa linha nova, ~75 caracteres por linha", () => {
  assertEquals(estimateLines(""), 0);
  assertEquals(estimateLines("a".repeat(75)), 1);
  assertEquals(estimateLines("a".repeat(76)), 2);
  assertEquals(estimateLines("curto\n\ncurto"), 2);
});

Deno.test("buildFeedback: limita notas ao máximo de cada critério", () => {
  const { feedback } = buildFeedback({
    criterios: [
      { key: "adequacao", nota: 99, comentario: "ok" },
      { key: "dominio", nota: -5, comentario: "fraco" },
      { key: "estrutura", nota: 12.3, comentario: "boa" },
    ],
    erros: [],
  }, texto);
  assertEquals(feedback.conteudo.criterios.map((c) => c.nota), [30, 0, 12.5]);
  assertEquals(feedback.conteudo.nota, 42.5);
});

Deno.test("buildFeedback: formal = 20 menos 1 por erro cujo trecho existe no texto", () => {
  const { score, feedback } = buildFeedback({
    criterios: [
      { key: "adequacao", nota: 20, comentario: "" },
      { key: "dominio", nota: 20, comentario: "" },
      { key: "estrutura", nota: 10, comentario: "" },
    ],
    erros: [
      { trecho: "administracao publica", tipo: "acentuação", correcao: "administração pública" },
      { trecho: "sao publicados", tipo: "acentuação", correcao: "são publicados" },
      { trecho: "frase que não está no texto", tipo: "outro", correcao: "x" }, // inventado: não desconta
    ],
  }, texto);
  assertEquals(feedback.formal.erros.length, 2);
  assertEquals(feedback.formal.nota, 18);
  assertEquals(score, 68);
});

Deno.test("buildFeedback: saída sem critérios vira zero, sem quebrar", () => {
  const { score, feedback } = buildFeedback({}, texto);
  assertEquals(feedback.conteudo.nota, 0);
  assertEquals(feedback.formal.nota, 20);
  assertEquals(score, 20);
});
