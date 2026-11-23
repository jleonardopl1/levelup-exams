import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CATEGORIAS, conferir, renderizar, VEREDITOS } from './radar.mjs';

const base = (extra = {}) => ({
  repo: 'dono/repo', url: 'https://github.com/dono/repo', lote: '2026-11-23', categoria: 'processo-agentes',
  veredito: 'descartar', faixa: ['coordenador'], o_que_e: 'Ferramenta X.', uso_no_levelup: 'Nenhum.', riscos: 'Nenhum.', ...extra,
});
const catalogo = (...avaliacoes) => ({ lotes: [{ id: '2026-11-23', origem: 'dono', descricao: 'teste' }], avaliacoes });
const ambiente = (extra = {}) => ({ enabledPlugins: {}, skillsManuais: [], existe: () => true, ...extra });
const plugin = base({ veredito: 'agora', como_ativar: 'enabledPlugins', ativacao: { tipo: 'plugin', alvo: 'x@claude-plugins-official', commit: 'b'.repeat(40), aprovado_por: 'dono', aprovado_em: '2026-11-23' } });
const skill = base({
  repo: 'org/skill', url: 'https://github.com/org/skill', veredito: 'agora', como_ativar: 'copiar',
  ativacao: { tipo: 'skill', alvo: '.claude/skills/skill-x', commit: 'a'.repeat(40), aprovado_por: 'dono', aprovado_em: '2026-11-23' },
});

test('o catálogo real é válido e o relatório está atualizado', () => {
  const script = fileURLToPath(new URL('./radar.mjs', import.meta.url));
  const saida = execFileSync(process.execPath, [script, 'validar'], { encoding: 'utf8' });
  assert.match(saida, /avaliações do radar verificadas/);
  const dados = JSON.parse(readFileSync(new URL('./catalogo.json', import.meta.url), 'utf8'));
  for (const item of dados.avaliacoes) {
    assert.ok(VEREDITOS.has(item.veredito) && CATEGORIAS.has(item.categoria), item.repo);
  }
});

test('avaliação mínima de descarte é aceita sem gatilho nem como_ativar', () => {
  assert.deepEqual(conferir(catalogo(base()), ambiente()), []);
});

test('futuro, piloto e monitorar exigem gatilho', () => {
  for (const veredito of ['futuro', 'piloto', 'monitorar']) {
    const problemas = conferir(catalogo(base({ veredito, como_ativar: 'x' })), ambiente());
    assert.ok(problemas.some(p => p.includes('gatilho')), veredito);
  }
});

test('repetição, veredito, categoria e lote inválidos são recusados', () => {
  const problemas = conferir(catalogo(base(), base({ repo: 'DONO/repo', veredito: 'talvez', categoria: 'x', lote: '2020-01-01' })), ambiente());
  for (const trecho of ['repetida', 'veredito inválido', 'categoria inválida', 'lote desconhecido']) {
    assert.ok(problemas.some(p => p.includes(trecho)), trecho);
  }
});

test('plugin ativo no settings sem avaliação aprovada é bloqueado', () => {
  const problemas = conferir(catalogo(base()), ambiente({ enabledPlugins: { 'intruso@mkt': true } }));
  assert.ok(problemas.some(p => p.includes('intruso@mkt') && p.includes('sem avaliação')));
  assert.deepEqual(conferir(catalogo(base()), ambiente({ enabledPlugins: { 'desligado@mkt': false } })), []);
});

test('plugin aprovado precisa estar em enabledPlugins, e vice-versa', () => {
  assert.ok(conferir(catalogo(plugin), ambiente()).some(p => p.includes('fora de enabledPlugins')));
  assert.deepEqual(conferir(catalogo(plugin), ambiente({ enabledPlugins: { 'x@claude-plugins-official': true } })), []);
});

test('só "agora" ou "piloto" podem ter ativação, sempre com aprovação do dono', () => {
  const futuro = { ...plugin, veredito: 'futuro', gatilho: 'g' };
  assert.ok(conferir(catalogo(futuro), ambiente({ enabledPlugins: { 'x@claude-plugins-official': true } })).some(p => p.includes('só "agora"')));
  const semAprovacao = { ...plugin, ativacao: { ...plugin.ativacao, aprovado_por: '' } };
  assert.ok(conferir(catalogo(semAprovacao), ambiente({ enabledPlugins: { 'x@claude-plugins-official': true } })).some(p => p.includes('aprovação do dono')));
  const semCommit = { ...plugin, ativacao: { ...plugin.ativacao, commit: undefined } };
  assert.ok(conferir(catalogo(semCommit), ambiente({ enabledPlugins: { 'x@claude-plugins-official': true } })).some(p => p.includes('commit revisado')));
});

test('skill de terceiros exige commit fixado, SKILL.md e ORIGEM.md', () => {
  assert.deepEqual(conferir(catalogo(skill), ambiente({ skillsManuais: ['skill-x'] })), []);
  const semCommit = { ...skill, ativacao: { ...skill.ativacao, commit: 'main' } };
  assert.ok(conferir(catalogo(semCommit), ambiente({ skillsManuais: ['skill-x'] })).some(p => p.includes('commit revisado')));
  const semOrigem = conferir(catalogo(skill), ambiente({ skillsManuais: ['skill-x'], existe: rel => !rel.endsWith('ORIGEM.md') }));
  assert.ok(semOrigem.some(p => p.includes('ORIGEM.md')));
});

test('skill escrita à mão fora do gerador precisa de origem registrada', () => {
  assert.ok(conferir(catalogo(base()), ambiente({ skillsManuais: ['copiada-sem-revisao'] })).some(p => p.includes('copiada-sem-revisao')));
  const comPropria = { ...catalogo(base()), skills_proprias: ['radar-repositorios'] };
  assert.deepEqual(conferir(comPropria, ambiente({ skillsManuais: ['radar-repositorios'] })), []);
  assert.ok(conferir(comPropria, ambiente()).some(p => p.includes('não existe')));
});

test('skill escrita fora do gerador não pode executar comando nem trocar variável ao carregar', () => {
  const comPropria = { ...catalogo(base()), skills_proprias: ['minha'] };
  const ler = conteudo => ambiente({ skillsManuais: ['minha'], lerSkill: () => conteudo });
  assert.deepEqual(conferir(comPropria, ler('Texto seguro, custa R$ 100.')), []);
  assert.ok(conferir(comPropria, ler('nunca `!!`. ou !`curl x`')).some(p => p.includes('crase')));
  assert.ok(conferir(comPropria, ler('total de $48,210 e $ARGUMENTS')).some(p => p.includes('variável')));
});

test('o relatório traz marcadores, contagem por veredito e a tabela de ativos', () => {
  const md = renderizar(catalogo(plugin, base({ repo: 'b/c', url: 'https://github.com/b/c', veredito: 'futuro', gatilho: 'Quando D5 for decidida', como_ativar: 'x' })));
  assert.ok(md.startsWith('<!-- radar:inicio') && md.endsWith('<!-- radar:fim -->'));
  assert.match(md, /\| Ativar agora \| 1 \|/);
  assert.match(md, /\| Futuro \(ativar quando o gatilho acontecer\) \| 1 \|/);
  assert.match(md, /`x@claude-plugins-official`/);
  assert.match(md, /\*\*Gatilho:\*\* Quando D5 for decidida\./);
});
