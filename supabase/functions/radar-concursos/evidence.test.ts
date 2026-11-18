import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { checkClaims, consolidate, dateInEvidence, norm, numbersIn, slugify, statusTransition } from "./evidence.ts";
import type { Claim, ConcursoRecord } from "./types.ts";

const SOURCE = `Polícia Federal — Concurso 2026
Edital nº 1/2026 publicado. Banca: Cebraspe.
Cargos: Agente de Polícia Federal; Escrivão de Polícia Federal.
Total de 1.000 vagas imediatas. Remuneração inicial de R$ 14.164,81.
Inscrições de 10/11/2026 a 30 de novembro de 2026. Provas objetivas em 22/02/2027.
Escolaridade: nível superior.`;

const ctx = {
  normalizedSource: norm(SOURCE),
  links: new Set(["https://www.cebraspe.org.br/concursos/pf_26"]),
  today: "2026-11-17",
};

const claim = (campo: Claim["campo"], valor: string, evidencia: string): Claim => ({ campo, valor, evidencia });

Deno.test("norm/slugify: sem acentos e pontuação", () => {
  assertEquals(norm("Inscrições: 30/11!"), "inscricoes 30 11");
  assertEquals(slugify("Polícia Federal 2026 — Agente"), "policia-federal-2026-agente");
});

Deno.test("dateInEvidence e numbersIn entendem o formato brasileiro", () => {
  assert(dateInEvidence("2026-11-30", "Inscrições até 30 de novembro de 2026"));
  assert(dateInEvidence("2027-02-22", "provas em 22/02/2027"));
  assert(dateInEvidence("2026-11-10", "de 10/11 a 30/11"));
  assert(!dateInEvidence("2026-11-03", "de 30/11"));
  assertEquals(numbersIn("1.000 vagas e R$ 14.164,81"), [1000, 14164.81]);
});

Deno.test("checkClaims aceita só o que tem evidência literal e valor coerente", () => {
  const { accepted, rejected } = checkClaims([
    claim("banca", "Cebraspe", "Banca: Cebraspe."),
    claim("status", "edital_publicado", "Edital nº 1/2026 publicado."),
    claim("vagas", "1000", "Total de 1.000 vagas imediatas."),
    claim("salario_max", "14164.81", "Remuneração inicial de R$ 14.164,81."),
    claim("inscricoes_inicio", "2026-11-10", "Inscrições de 10/11/2026 a 30 de novembro de 2026."),
    claim("inscricoes_fim", "2026-11-30", "Inscrições de 10/11/2026 a 30 de novembro de 2026."),
    claim("data_prova", "2027-02-22", "Provas objetivas em 22/02/2027."),
    claim("cargos", "Agente de Polícia Federal; Escrivão de Polícia Federal", "Cargos: Agente de Polícia Federal; Escrivão de Polícia Federal."),
    claim("escolaridade", "superior", "Escolaridade: nível superior."),
    claim("link_oficial", "https://www.cebraspe.org.br/concursos/pf_26", "link"),
  ], ctx);
  assertEquals(rejected, []);
  assertEquals(accepted.length, 10);
  assertEquals(accepted.find((a) => a.campo === "vagas")?.valor, 1000);
  assertEquals(accepted.find((a) => a.campo === "salario_max")?.valor, 14164.81);
  assertEquals(accepted.find((a) => a.campo === "cargos")?.valor, ["Agente de Polícia Federal", "Escrivão de Polícia Federal"]);
});

Deno.test("checkClaims rejeita alucinações: evidência inexistente, número/data/link que não batem", () => {
  const { accepted, rejected } = checkClaims([
    claim("vagas", "1500", "Total de 1.000 vagas imediatas."),
    claim("data_prova", "2027-03-15", "Provas objetivas em 22/02/2027."),
    claim("banca", "FGV", "Banca: Cebraspe."),
    claim("status", "inscricoes_abertas", "Edital nº 1/2026 publicado."),
    claim("salario_max", "20000", "Remuneração de R$ 20.000,00 conforme a lei"),
    claim("link_oficial", "https://site-falso.com/pf", "link"),
    claim("uf", "XX", "Polícia Federal"),
  ], ctx);
  assertEquals(accepted, []);
  assertEquals(rejected.map((r) => r.reason), [
    "número não aparece na evidência",
    "data não aparece na evidência",
    "valor não aparece na evidência",
    "evidência não indica esse status",
    "evidência não encontrada na fonte",
    "link não está na fonte",
    "valor inválido",
  ]);
});

Deno.test("checkClaims derruba datas incoerentes (fim antes do início)", () => {
  const src = "Inscrições de 20/11/2026 até 10/11/2026.";
  const { accepted, rejected } = checkClaims([
    claim("inscricoes_inicio", "2026-11-20", "Inscrições de 20/11/2026 até 10/11/2026."),
    claim("inscricoes_fim", "2026-11-10", "Inscrições de 20/11/2026 até 10/11/2026."),
  ], { ...ctx, normalizedSource: norm(src) });
  assertEquals(accepted.map((a) => a.campo), ["inscricoes_inicio"]);
  assertEquals(rejected[0].reason, "fim das inscrições antes do início");
});

Deno.test("statusTransition: avança, regressão e exceção", () => {
  assertEquals(statusTransition("previsto", "edital_publicado"), "ok");
  assertEquals(statusTransition("inscricoes_abertas", "edital_publicado"), "regressao");
  assertEquals(statusTransition("inscricoes_abertas", "suspenso"), "excecao");
  assertEquals(statusTransition("suspenso", "inscricoes_abertas"), "excecao");
  assertEquals(statusTransition(undefined, "previsto"), "ok");
});

const EXISTING: ConcursoRecord = {
  id: "c1", slug: "pf-2026", orgao: "Polícia Federal", nome: "Polícia Federal 2026", status: "autorizado",
  area_id: "a1", is_published: true, track_id: null, banca: "Cebraspe", data_prova: undefined,
};

Deno.test("consolidate: concurso novo verificado publica sozinho, com resumo", () => {
  const c = consolidate({
    existing: null, orgao: "Polícia Federal", verified: true,
    claims: [
      { campo: "nome", valor: "PF 2026", evidencia: "x" },
      { campo: "status", valor: "edital_publicado", evidencia: "x" },
      { campo: "vagas", valor: 1000, evidencia: "x" },
      { campo: "data_prova", valor: "2027-02-22", evidencia: "x" },
    ],
  })!;
  assertEquals(c.kind, "novo");
  assertEquals(c.severity, "critica");
  assertEquals(c.needsReview, false);
  assertEquals(c.summary, "Polícia Federal — edital publicado, 1000 vagas; prova em 22/02/2027.");
});

Deno.test("consolidate: sem verificador ou sem fase confirmada vai para revisão", () => {
  const c = consolidate({ existing: null, orgao: "TJ-SP", verified: false, claims: [{ campo: "nome", valor: "TJ-SP", evidencia: "x" }] })!;
  assert(c.needsReview);
  assertEquals(c.patch.status, "previsto");
  assertEquals(c.reasons.length, 2);
});

Deno.test("consolidate: avanço de fase publica; nada novo não gera atualização", () => {
  const c = consolidate({ existing: EXISTING, orgao: "Polícia Federal", verified: true, claims: [
    { campo: "status", valor: "edital_publicado", evidencia: "x" },
    { campo: "banca", valor: "Cebraspe", evidencia: "x" },
  ] })!;
  assertEquals(c.kind, "status");
  assertEquals(c.severity, "critica");
  assertEquals(c.needsReview, false);
  assertEquals(c.changes.map((x) => x.campo), ["status"]);
  assertEquals(c.title, "Polícia Federal 2026: edital publicado");
  assertEquals(consolidate({ existing: EXISTING, orgao: "PF", verified: true, claims: [{ campo: "banca", valor: "CEBRASPE", evidencia: "x" }] }), null);
});

Deno.test("consolidate: data de prova alterada é retificação crítica e revisada", () => {
  const c = consolidate({
    existing: { ...EXISTING, data_prova: "2027-02-22" }, orgao: "PF", verified: true,
    claims: [{ campo: "data_prova", valor: "2027-03-08", evidencia: "x" }],
  })!;
  assertEquals(c.kind, "retificacao");
  assertEquals(c.severity, "critica");
  assert(c.needsReview);
  assertEquals(c.summary, "data da prova: 22/02/2027 → 08/03/2027");
});

Deno.test("consolidate: regressão de fase não publica sozinha", () => {
  const c = consolidate({
    existing: { ...EXISTING, status: "inscricoes_abertas" }, orgao: "PF", verified: true,
    claims: [{ campo: "status", valor: "edital_publicado", evidencia: "x" }],
  })!;
  assert(c.needsReview);
});
