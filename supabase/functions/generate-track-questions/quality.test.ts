import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  arbiterKeeps,
  citesOptionLetters,
  decide,
  emphasizeNegativeCommand,
  itemFlaws,
  numericKey,
  orderNumericAlternatives,
  shuffleAlternatives,
  validateQuestion,
} from "./quality.ts";
import { groupLessons, normalizeLesson } from "./lessons.ts";
import type { GeneratedQuestion, ReviewVerdict, SolverVote } from "./types.ts";

const Q: GeneratedQuestion = {
  topico: "Princípios",
  dificuldade: "Médio",
  nivel: "ambos",
  enunciado: "Segundo a Constituição Federal, qual princípio exige a divulgação oficial dos atos administrativos?",
  alternativas: ["Publicidade", "Impessoalidade", "Moralidade", "Eficiência"],
  correta: 0,
  explicacao: "O art. 37 da CF prevê a publicidade como dever de divulgação oficial; os demais princípios tratam de outros deveres.",
};

const approved: ReviewVerdict = { indice: 0, aprovada: true, motivo: "" };
const vote = (escolha: number | null, ambigua = false): SolverVote => ({ indice: 0, escolha, ambigua, confianca: 0.9, justificativa: "art. 37" });

Deno.test("validateQuestion: aceita a questão boa e recusa fora do esquema", () => {
  assertEquals(validateQuestion(Q)?.correta, 0);
  assertEquals(validateQuestion({ ...Q, alternativas: ["a", "b", "c"] }), null);
  assertEquals(validateQuestion({ ...Q, alternativas: ["Igual", "igual ", "C", "D"] }), null);
  assertEquals(validateQuestion({ ...Q, correta: 4 }), null);
  assertEquals(validateQuestion({ ...Q, explicacao: "curta" }), null);
  assertEquals(validateQuestion({ ...Q, dificuldade: "Impossível" })?.dificuldade, "Médio");
});

Deno.test("itemFlaws: pista de tamanho, todas/nenhuma e gabarito copiado no enunciado", () => {
  assertEquals(itemFlaws(Q), []);
  const longest = {
    ...Q,
    alternativas: ["Publicidade, que impõe a divulgação oficial dos atos para conhecimento e controle de todos os interessados", "Impessoalidade", "Moralidade", "Eficiência"],
  };
  assertEquals(itemFlaws(longest).length, 1);
  assertEquals(itemFlaws({ ...Q, alternativas: ["Publicidade", "Impessoalidade", "Todas as alternativas", "Eficiência"] }).length, 1);
  const leaked = {
    ...Q,
    enunciado: "O dever de divulgação oficial dos atos administrativos é chamado de princípio da publicidade dos atos. Qual é?",
    alternativas: ["princípio da publicidade dos atos", "Impessoalidade", "Moralidade", "Eficiência"],
  };
  assert(itemFlaws(leaked).some((f) => f.includes("enunciado")));
});

Deno.test("citesOptionLetters: detecta explicações que citam letras", () => {
  assert(citesOptionLetters("A alternativa B está incorreta porque..."));
  assert(citesOptionLetters("Por isso a letra C é a correta."));
  assert(citesOptionLetters("As opções A e D tratam de outro princípio."));
  assert(citesOptionLetters("Errada: (B) confunde os conceitos."));
  assert(!citesOptionLetters(Q.explicacao));
  assert(!citesOptionLetters("A publicidade é a regra; a Administração deve divulgar."));
});

Deno.test("shuffleAlternatives: mantém o gabarito e respeita explicação com letras", () => {
  const fixed = (n: number) => new Uint32Array(n).fill(1);
  const s = shuffleAlternatives(Q, fixed);
  assertEquals(s.alternativas[s.correta], "Publicidade");
  assertEquals(new Set(s.alternativas).size, 4);
  const withLetters = { ...Q, explicacao: "A alternativa A está correta pelo art. 37; as demais tratam de outros deveres." };
  assertEquals(shuffleAlternatives(withLetters, fixed), withLetters);
  const roman = { ...Q, alternativas: ["Apenas I", "Apenas II", "I e II", "Nenhuma"] };
  assertEquals(shuffleAlternatives(roman, fixed), roman);
});

Deno.test("decide: revisor reprova => reprova com o motivo (vira lição)", () => {
  const d = decide(Q, { indice: 0, aprovada: false, motivo: "Gabarito errado: o art. 37 não trata disso." }, [vote(0)]);
  assertEquals(d, { kind: "reject", source: "revisor", reasons: ["Gabarito errado: o art. 37 não trata disso."] });
  assertEquals(decide(Q, undefined, [vote(0)]).kind, "reject");
});

Deno.test("decide: revisor aprova e todos os solucionadores concordam => aceita", () => {
  assertEquals(decide(Q, approved, [vote(0), vote(0)]), { kind: "accept", degraded: false });
});

Deno.test("decide: divergência, ambiguidade ou omissão do solucionador => árbitro", () => {
  assertEquals(decide(Q, approved, [vote(2)]).kind, "arbitrate");
  assertEquals(decide(Q, approved, [vote(0, true)]).kind, "arbitrate");
  assertEquals(decide(Q, approved, [vote(0), undefined]).kind, "arbitrate");
  assertEquals(decide(Q, approved, [vote(null, true)]).kind, "arbitrate");
});

Deno.test("decide: sem nenhum solucionador disponível => aceita em modo degradado", () => {
  assertEquals(decide(Q, approved, []), { kind: "accept", degraded: true });
});

Deno.test("arbiterKeeps: só mantém com o MESMO gabarito e única correta", () => {
  assert(arbiterKeeps(Q, { manter: true, gabaritoCorreto: 0, unicaCorreta: true }));
  assert(!arbiterKeeps(Q, { manter: true, gabaritoCorreto: 1, unicaCorreta: true }));
  assert(!arbiterKeeps(Q, { manter: true, gabaritoCorreto: 0, unicaCorreta: false }));
  assert(!arbiterKeeps(Q, { manter: false, gabaritoCorreto: 0, unicaCorreta: true }));
  assert(!arbiterKeeps(Q, undefined));
});

Deno.test("lições: normaliza, descarta genéricas/letras e agrupa sem repetir", () => {
  assertEquals(normalizeLesson("  Reprovada. "), null);
  assertEquals(normalizeLesson("Solucionador cego marcou B e o gabarito é C."), null);
  assertEquals(normalizeLesson("Prazo\n de recurso é de 10 dias, não 15."), "Prazo de recurso é de 10 dias, não 15.");
  assertEquals(normalizeLesson("x".repeat(300))?.length, 240);
  const g = groupLessons([
    { source: "revisor", lesson: "Prazo de recurso é de 10 dias, não 15." },
    { source: "revisor", lesson: "prazo de recurso é de 10 dias, não 15." },
    { source: "arbitro", lesson: "Mais de uma alternativa defensável no item." },
    { source: "validador", lesson: "ok" },
  ]);
  assertEquals(g.get("revisor")?.length, 1);
  assertEquals(g.get("arbitro")?.length, 1);
  assertEquals(g.has("validador"), false);
});

Deno.test("emphasizeNegativeCommand: destaca só o comando negativo", () => {
  assertEquals(
    emphasizeNegativeCommand("Assinale a alternativa incorreta sobre o processo legislativo."),
    "Assinale a alternativa INCORRETA sobre o processo legislativo.",
  );
  assertEquals(emphasizeNegativeCommand("São afirmações falsas:"), "São afirmações FALSAS:");
  assertEquals(emphasizeNegativeCommand("Todas são competências do Prefeito, exceto:"), "Todas são competências do Prefeito, EXCETO:");
  assertEquals(emphasizeNegativeCommand("Indique a opção que não apresenta erro de regência."), "Indique a opção que NÃO apresenta erro de regência.");
  // Fora do comando, nada muda.
  const plain = "O servidor não poderá acumular cargos; a conduta incorreta gera processo. Falsamente acusado, recorreu.";
  assertEquals(emphasizeNegativeCommand(plain), plain);
});

Deno.test("validateQuestion aplica o destaque do comando negativo", () => {
  const q = validateQuestion({ ...Q, enunciado: "Sobre a Constituição, assinale a alternativa incorreta quanto aos princípios." });
  assertEquals(q?.enunciado, "Sobre a Constituição, assinale a alternativa INCORRETA quanto aos princípios.");
});

Deno.test("itemFlaws: termos absolutos só nos distratores", () => {
  const cue: GeneratedQuestion = {
    ...Q,
    alternativas: [
      "é permitido, atendendo à finalidade pública",
      "é proibido em qualquer hipótese",
      "depende sempre de consentimento escrito",
      "só pode ocorrer com autorização judicial",
    ],
    correta: 0,
  };
  assert(itemFlaws(cue).some((f) => f.includes("Termos absolutos")));
  // Um distrator absoluto só não é pista; e a correta também absoluta desfaz o padrão.
  assertEquals(itemFlaws({ ...cue, alternativas: [cue.alternativas[0], "é proibido", cue.alternativas[2], "exige lei"] }).filter((f) => f.includes("absolutos")), []);
  assertEquals(itemFlaws({ ...cue, alternativas: ["é sempre permitido", ...cue.alternativas.slice(1)] }).filter((f) => f.includes("absolutos")), []);
});

Deno.test("itemFlaws: pista de tamanho moderada (correta 30% acima da maior errada) agora reprova", () => {
  const moderate = {
    ...Q,
    alternativas: ["publicidade dos atos oficiais na imprensa", "impessoalidade do agente", "moralidade administrativa", "eficiência do serviço"],
  };
  assert(itemFlaws(moderate).some((f) => f.includes("Pista de tamanho")));
});

Deno.test("numericKey: números, moeda, fração e percentual com a mesma unidade", () => {
  assertEquals(numericKey("12 anos de idade"), { value: 12, unit: "|ano de idade" });
  assertEquals(numericKey("1 ano de idade")?.unit, numericKey("8 anos de idade")?.unit);
  assertEquals(numericKey("R$ 1.250,50")?.value, 1250.5);
  assertEquals(numericKey("15/64")?.value, 15 / 64);
  assertEquals(numericKey("30%")?.unit, "|%");
  assertEquals(numericKey("dois dígrafos"), null);
});

Deno.test("orderNumericAlternatives: ordem crescente como a Selecon, gabarito preservado", () => {
  const ages = { ...Q, alternativas: ["14 anos de idade", "8 anos de idade", "12 anos de idade", "10 anos de idade"], correta: 2 };
  const o = orderNumericAlternatives(ages)!;
  assertEquals(o.alternativas, ["8 anos de idade", "10 anos de idade", "12 anos de idade", "14 anos de idade"]);
  assertEquals(o.alternativas[o.correta], "12 anos de idade");
  // Unidades diferentes ou valores repetidos: não ordena.
  assertEquals(orderNumericAlternatives({ ...Q, alternativas: ["8 anos", "10 meses", "12 anos", "14 anos"] }), null);
  assertEquals(orderNumericAlternatives({ ...Q, alternativas: ["8", "8,0", "12", "14"] }), null);
  // shuffleAlternatives usa a ordem crescente em vez de sortear.
  const s = shuffleAlternatives({ ...Q, alternativas: ["R$ 900,00", "R$ 1.200,00", "R$ 300,00", "R$ 600,00"], correta: 1 });
  assertEquals(s.alternativas, ["R$ 300,00", "R$ 600,00", "R$ 900,00", "R$ 1.200,00"]);
  assertEquals(s.alternativas[s.correta], "R$ 1.200,00");
});

Deno.test("itemFlaws: alternativa que julga as outras ('Nenhum: os três...') reprova; menção de conteúdo passa", () => {
  assertEquals(itemFlaws({ ...Q, alternativas: ["Publicidade", "Impessoalidade", "Moralidade", "Nenhum: os três estão na CF"] }).length, 1);
  assertEquals(itemFlaws({ ...Q, alternativas: ["Publicidade", "Impessoalidade", "Moralidade", "nenhuma das linhas de defesa"] }), []);
});
