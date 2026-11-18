import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { relevanceScore, shouldSuggestTrack } from "./scoring.ts";
import { isSourceDue } from "./pipeline.ts";

Deno.test("relevância: federal com muitas vagas e bom salário fica no topo", () => {
  const pf = relevanceScore({ esfera: "federal", vagas: 1000, salario_max: 14164.81, status: "edital_publicado" }, 50);
  const camara = relevanceScore({ esfera: "municipal", municipio: "Cuiabá", vagas: 40, salario_max: 6000, status: "inscricoes_abertas" });
  const pequena = relevanceScore({ esfera: "municipal", municipio: "Cidade Pequena", vagas: 3, status: "previsto" });
  assert(pf > camara && camara > pequena, `${pf} > ${camara} > ${pequena}`);
  assert(pf <= 100 && pequena >= 0);
  assertEquals(relevanceScore({}), 0);
});

Deno.test("sugestão de trilha: edital na rua, relevante e sem trilha", () => {
  assert(shouldSuggestTrack({ status: "edital_publicado", relevance: 60, track_id: null }));
  assert(!shouldSuggestTrack({ status: "edital_publicado", relevance: 60, track_id: "t" }));
  assert(!shouldSuggestTrack({ status: "previsto", relevance: 90, track_id: null }));
  assert(!shouldSuggestTrack({ status: "inscricoes_abertas", relevance: 20, track_id: null }));
});

Deno.test("fonte vencida respeita intervalo e recua após falhas", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const base = { check_interval_hours: 12, consecutive_failures: 0 };
  assert(isSourceDue({ ...base, last_checked_at: null }, now));
  assert(isSourceDue({ ...base, last_checked_at: "2026-11-16T23:00:00Z" }, now));
  assert(!isSourceDue({ ...base, last_checked_at: "2026-11-17T06:00:00Z" }, now));
  // 2 falhas: 12h × 4 = 48h de espera.
  assert(!isSourceDue({ ...base, consecutive_failures: 2, last_checked_at: "2026-11-16T00:00:00Z" }, now));
});
