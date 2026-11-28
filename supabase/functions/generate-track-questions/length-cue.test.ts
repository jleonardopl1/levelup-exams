import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { bankLengthFlaws, bankLengthStats, LENGTH_CUE, lengthCueFlaws, lengthProfile, longestBudget, visibleLength } from "./length-cue.ts";

// Caso real do banco autoral (Língua Portuguesa #1, antes da revisão de 2026-11-24).
const REAL_CUE = [
  "exige mais do que a simples publicação formal dos atos, alcançando a compreensão das decisões pelo cidadão",
  "se restringe à publicação dos atos no diário oficial, como determina a lei",
  "deve priorizar os dados abertos em detrimento da linguagem acessível",
  "é responsabilidade exclusiva do cidadão, que deve buscar as informações",
];

Deno.test("visibleLength: conta o que o aluno vê (espaços colapsados, sem pontas)", () => {
  assertEquals(visibleLength("  a   b \n c "), 5);
});

Deno.test("regra A: correta mais longa e > 20% acima da maior errada reprova", () => {
  const flaws = lengthCueFlaws(REAL_CUE, 0);
  assertEquals(flaws.length, 1);
  assert(flaws[0].includes("mais longa"));
  // A mesma questão com outra alternativa como correta não tem pista de tamanho.
  assertEquals(lengthCueFlaws(REAL_CUE, 1), []);
});

Deno.test("regra A: correta mais longa só por pouco (até 20%) passa", () => {
  const alts = ["a".repeat(60), "b".repeat(55), "c".repeat(52), "d".repeat(50)];
  assert(lengthProfile(alts, 0).correctIsLongest);
  assertEquals(lengthCueFlaws(alts, 0), []);
  // 30% acima da maior errada reprova.
  assertEquals(lengthCueFlaws(["a".repeat(72), "b".repeat(55), "c".repeat(52), "d".repeat(50)], 0).length, 1);
});

Deno.test("regra A: diferença pequena em caracteres não conta (alternativas de uma palavra)", () => {
  assertEquals(lengthCueFlaws(["Impessoalidade", "Moralidade", "Eficiência", "Legalidade"], 0), []);
});

Deno.test("regra B: correta bem acima da média das erradas reprova mesmo empatada com uma errada", () => {
  const alts = ["a".repeat(98), "b".repeat(100), "c".repeat(40), "d".repeat(40)];
  assert(!lengthProfile(alts, 0).correctIsLongest);
  assertEquals(lengthCueFlaws(alts, 0).length, 1);
});

Deno.test("regra C: pista invertida (correta muito mais curta) reprova", () => {
  const alts = ["a".repeat(30), "b".repeat(70), "c".repeat(72), "d".repeat(75)];
  const flaws = lengthCueFlaws(alts, 0);
  assertEquals(flaws.length, 1);
  assert(flaws[0].includes("invertida"));
  // Números curtos não disparam (diferença absoluta pequena).
  assertEquals(lengthCueFlaws(["5", "18", "21", "84"], 0), []);
});

Deno.test("banco: teto de correta mais longa e de mais curta por matéria", () => {
  const longest = { alternativas: ["a".repeat(55), "b".repeat(50), "c".repeat(50), "d".repeat(50)], correta: 0 };
  const middle = { alternativas: ["a".repeat(50), "b".repeat(55), "c".repeat(45), "d".repeat(50)], correta: 0 };
  const ok = bankLengthStats([...Array(7).fill(longest), ...Array(13).fill(middle)]);
  assertEquals(ok.longest, 7);
  assertEquals(bankLengthFlaws(ok), []); // 35% = no teto
  const over = bankLengthStats([...Array(8).fill(longest), ...Array(12).fill(middle)]);
  assertEquals(bankLengthFlaws(over).length, 1); // 40% > 35%
  // Amostra pequena não é avaliada.
  assertEquals(bankLengthFlaws(bankLengthStats(Array(5).fill(longest))), []);
});

Deno.test("longestBudget: quantas novas com a correta mais longa ainda cabem no teto", () => {
  const recent = { n: 40, longest: 10, shortest: 8, flagged: 0, shareLongest: 0.25, shareShortest: 0.2 };
  assertEquals(longestBudget(recent, 3), Math.floor(LENGTH_CUE.maxShareLongest * 43) - 10); // 15 - 10 = 5
  assertEquals(longestBudget({ ...recent, longest: 20, shareLongest: 0.5 }, 3), 0);
});
