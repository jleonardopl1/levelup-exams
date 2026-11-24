import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { auditTrack, questionFlaws } from "./audit-questions.mjs";
import { altsMd5, contentHash, formatContentJson, publishedOrder } from "./lib/track-content.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tracks = readdirSync(join(root, "content", "trilhas"));

for (const slug of tracks) {
  test(`trilha ${slug}: nenhuma questão com pista de forma e nenhuma matéria acima do teto`, () => {
    const { problems } = auditTrack(slug);
    assert.deepEqual(problems, [], `${problems.length} problema(s):\n${problems.slice(0, 30).join("\n")}`);
  });
}

test("questionFlaws: correta muito mais longa reprova; equilibrada passa", () => {
  const base = { enunciado: "De acordo com a Lei Orgânica, a iniciativa do projeto cabe:", correta: 0 };
  assert.equal(
    questionFlaws({ ...base, alternativas: ["à Mesa Diretora da Câmara Municipal, por ato próprio publicado no diário oficial", "ao Prefeito", "ao Vereador", "à comissão"] }).length,
    1,
  );
  assert.deepEqual(
    questionFlaws({ ...base, alternativas: ["à Mesa Diretora da Câmara", "ao Prefeito Municipal", "a um terço dos Vereadores", "à Comissão de Justiça"] }),
    [],
  );
});

test("chave de ordem k: questão reescrita mantém a ordem publicada no banco", () => {
  const old = { q: "Pergunta de teste com tamanho suficiente:", a: ["alfa", "beta", "gama", "delta"], c: 2 };
  const oldHash = contentHash(old.q, old.a);
  const rewritten = { ...old, a: ["alfa nova", "beta nova", "gama nova", "delta nova"], k: oldHash.slice(0, 16) };
  assert.deepEqual(publishedOrder(rewritten), publishedOrder(old));
  assert.notEqual(contentHash(rewritten.q, rewritten.a), oldHash);
});

test("altsMd5 e formatContentJson: formatos estáveis", () => {
  assert.equal(altsMd5(["a", "b"]).length, 32);
  assert.equal(formatContentJson({ slug: "x", questions: [{ a: ["1", "2"] }] }), '{\n"slug": "x",\n"questions": [\n{\n"a": [\n"1",\n"2"\n]\n}\n]\n}');
});
