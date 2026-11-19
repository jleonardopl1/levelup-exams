import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('o gerador rejeita uma alçada inválida antes de escrever o organograma', async t => {
  const raiz = await mkdtemp(join(tmpdir(), 'levelup-organograma-'));
  t.after(() => rm(raiz, { recursive: true, force: true }));
  const agentes = join(raiz, 'ops', 'agentes');
  const documento = join(raiz, 'docs', 'ORGANOGRAMA_OPERACIONAL.md');
  await mkdir(agentes, { recursive: true });
  await mkdir(join(raiz, 'docs'));
  for (const arquivo of ['cli.mjs', 'documentar.mjs']) {
    await copyFile(new URL(arquivo, import.meta.url), join(agentes, arquivo));
  }
  const catalogo = JSON.parse(await readFile(new URL('./catalogo.json', import.meta.url), 'utf8'));
  catalogo.agentes.find(a => a.id === 'CFO.2').alcada = 'A2';
  await writeFile(join(agentes, 'catalogo.json'), JSON.stringify(catalogo));
  await writeFile(documento, 'versão anterior');
  const processo = spawnSync(process.execPath, [join(agentes, 'documentar.mjs')], { encoding: 'utf8' });
  assert.equal(processo.status, 1);
  assert.match(processo.stderr, /Alçada inválida em CFO\.2/);
  assert.equal(await readFile(documento, 'utf8'), 'versão anterior');
});
