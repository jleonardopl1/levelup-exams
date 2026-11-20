import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { nomeSkill, validarCatalogo } from './cli.mjs';
import { conferirSkills, FERRAMENTAS_BLOQUEADAS, gerarSkills, MARCA, renderizarSkills } from './skills.mjs';

const catalogo = JSON.parse(await readFile(new URL('./catalogo.json', import.meta.url), 'utf8'));
const perfis = validarCatalogo(catalogo);
const areas = [...perfis.values()].filter(a => a.tipo === 'area');
const especialistas = [...perfis.values()].filter(a => a.tipo === 'especialista');

function frontmatter(conteudo) {
  const [abertura, cabecalho, ...resto] = conteudo.split(/^---$/m);
  assert.equal(abertura, '');
  const campos = {};
  for (const linha of cabecalho.trim().split('\n')) {
    const separador = linha.indexOf(': ');
    campos[linha.slice(0, separador)] = linha.slice(separador + 2);
  }
  return { campos, corpo: resto.join('---') };
}

async function pastaTemporaria(t, prefixo) {
  const pasta = await mkdtemp(join(tmpdir(), prefixo));
  t.after(() => rm(pasta, { recursive: true, force: true }));
  return pasta;
}

test('gera uma skill por cargo, com nome, descrição e restrições que o Claude Code lê', async t => {
  const destino = await pastaTemporaria(t, 'levelup-skills-');
  const { total, gravadas, removidas } = await gerarSkills(catalogo, destino);
  assert.deepEqual([total, gravadas, removidas], [79, 79, []]);
  const pastas = (await readdir(destino)).sort();
  assert.deepEqual(pastas, [...perfis.values()].map(nomeSkill).sort());
  for (const agente of perfis.values()) {
    const nome = nomeSkill(agente);
    assert.match(nome, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(nome.length <= 64 && nome.startsWith(agente.id.toLowerCase().replace('.', '-') + '-'), nome);
    const conteudo = await readFile(join(destino, nome, 'SKILL.md'), 'utf8');
    const { campos, corpo } = frontmatter(conteudo);
    assert.equal(campos.name, nome);
    const descricao = JSON.parse(campos.description);
    assert.ok(descricao.startsWith(`${agente.id} · ${agente.nome} (`) && descricao.includes(agente.missao), agente.id);
    assert.ok(descricao.length <= 1024, agente.id);
    assert.equal(typeof JSON.parse(campos['argument-hint']), 'string');
    // Só as áreas entram na lista que o modelo vê; especialistas são acionados por / ou pela área.
    assert.equal(campos['disable-model-invocation'], agente.tipo === 'area' ? undefined : 'true', agente.id);
    const bloqueadas = JSON.parse(campos['disallowed-tools']);
    assert.deepEqual(bloqueadas, FERRAMENTAS_BLOQUEADAS);
    for (const ferramenta of ['Bash', 'Edit', 'Write', 'WebFetch', 'Agent', 'mcp__*']) assert.ok(bloqueadas.includes(ferramenta));
    for (const ferramenta of ['Read', 'Grep', 'Glob', 'Skill']) assert.ok(!bloqueadas.includes(ferramenta));
    assert.equal(corpo.split('$ARGUMENTS').length, 2, agente.id + ': um único ponto recebe a tarefa');
    assert.ok(corpo.includes(`Alçada:** ${agente.alcada}.`) && corpo.includes(agente.missao), agente.id);
    for (const campo of ['cargosOrigem', 'responsabilidades', 'gatilhos', 'entradas', 'entregas', 'indicadores', 'escalonar']) {
      for (const item of agente[campo]) assert.ok(corpo.includes(item.replace(/\.$/, '')), `${agente.id} / ${campo}`);
    }
    assert.ok(!conteudo.includes('!`'));
    assert.ok(conteudo.trimEnd().endsWith(MARCA));
  }
});

test('as áreas encaminham aos especialistas e o CEO às demais áreas', () => {
  const skills = renderizarSkills(catalogo);
  for (const area of areas) {
    const { corpo } = frontmatter(skills.get(nomeSkill(area)));
    assert.ok(corpo.includes('`${CLAUDE_SKILL_DIR}/../<skill>/SKILL.md`'), area.id);
    for (const especialista of especialistas.filter(a => a.supervisor === area.id)) {
      assert.ok(corpo.includes(`| ${especialista.id} | ${especialista.nome} (${especialista.alcada}) |`), especialista.id);
      assert.ok(corpo.includes('`/' + nomeSkill(especialista) + '`'), especialista.id);
    }
    for (const outra of areas.filter(a => a.id !== area.id)) assert.ok(corpo.includes('`/' + nomeSkill(outra) + '`'), `${area.id} → ${outra.id}`);
  }
  for (const especialista of especialistas) {
    const { corpo } = frontmatter(skills.get(nomeSkill(especialista)));
    assert.ok(corpo.includes('`/' + nomeSkill(perfis.get(especialista.supervisor)) + '`'), especialista.id);
    assert.ok(!corpo.includes('Como encaminhar'), especialista.id);
  }
});

test('texto do catálogo não vira variável nem comando dentro da skill', () => {
  const comMissao = missao => {
    const copia = structuredClone(catalogo);
    copia.agentes.find(a => a.id === 'CFO.2').missao = missao;
    return copia;
  };
  assert.throws(() => renderizarSkills(comMissao('Conferir $ARGUMENTS do lote.')), /vira variável/);
  assert.throws(() => renderizarSkills(comMissao('Custo de R$1 por aluno.')), /vira variável/);
  assert.throws(() => renderizarSkills(comMissao('Ler ${CLAUDE_SKILL_DIR}.')), /vira variável/);
  assert.throws(() => renderizarSkills(comMissao('Rodar !`id` antes.')), /comando/);
  const aceita = renderizarSkills(comMissao('Conferir "aspas", R$ 100 e uma | barra.'));
  const { campos, corpo } = frontmatter(aceita.get('cfo-2-rebate-comissionamento'));
  assert.ok(JSON.parse(campos.description).includes('Conferir "aspas", R$ 100 e uma | barra.'));
  assert.ok(corpo.includes('R$ 100'));
  const area = aceita.get('cfo-financas-administracao-juridico-privacidade');
  assert.ok(area.includes('| CFO.2 | Rebate e comissionamento (A0) |'));
});

test('a geração remove só skills geradas e o --check aponta o que mudou', async t => {
  const destino = await pastaTemporaria(t, 'levelup-skills-');
  await gerarSkills(catalogo, destino);
  await mkdir(join(destino, 'manual'));
  await writeFile(join(destino, 'manual', 'SKILL.md'), '---\nname: manual\n---\nEscrita à mão.\n');
  await mkdir(join(destino, 'cargo-antigo'));
  await writeFile(join(destino, 'cargo-antigo', 'SKILL.md'), 'ficha antiga\n' + MARCA + '\n');
  await writeFile(join(destino, 'cfo-2-rebate-comissionamento', 'SKILL.md'), 'editada à mão\n' + MARCA + '\n');
  await rm(join(destino, 'ceo-1-estrategia-okrs'), { recursive: true });
  assert.deepEqual((await conferirSkills(catalogo, destino)).sort(), [
    'desatualizada cfo-2-rebate-comissionamento', 'falta ceo-1-estrategia-okrs', 'obsoleta cargo-antigo',
  ]);
  const resultado = await gerarSkills(catalogo, destino);
  assert.deepEqual([resultado.gravadas, resultado.removidas], [2, ['cargo-antigo']]);
  await assert.rejects(access(join(destino, 'cargo-antigo')));
  assert.equal(await readFile(join(destino, 'manual', 'SKILL.md'), 'utf8'), '---\nname: manual\n---\nEscrita à mão.\n');
  assert.deepEqual(await conferirSkills(catalogo, destino), []);
});

test('não sobrescreve uma skill escrita à mão que tenha o nome de um cargo', async t => {
  const destino = await pastaTemporaria(t, 'levelup-skills-');
  await mkdir(join(destino, 'cfo-2-rebate-comissionamento'));
  await writeFile(join(destino, 'cfo-2-rebate-comissionamento', 'SKILL.md'), 'minha skill\n');
  await assert.rejects(gerarSkills(catalogo, destino), /escrita à mão/);
  assert.deepEqual(await readdir(destino), ['cfo-2-rebate-comissionamento']);
  assert.equal(await readFile(join(destino, 'cfo-2-rebate-comissionamento', 'SKILL.md'), 'utf8'), 'minha skill\n');
});

test('o organograma indica a skill de cada cargo', async () => {
  const organograma = await readFile(new URL('../../docs/ORGANOGRAMA_OPERACIONAL.md', import.meta.url), 'utf8');
  for (const agente of perfis.values()) {
    assert.ok(organograma.includes('**Skill no Claude Code** · `/' + nomeSkill(agente) + '`'), agente.id);
  }
});

/** Servidor local no formato Messages: cada resposta chama uma ferramenta da lista e depois encerra com texto. */
async function modeloFalso(t, ferramentas) {
  const recebidas = [];
  const servidor = createServer(async (req, res) => {
    if (!req.url.startsWith('/v1/messages')) {
      res.writeHead(404).end();
      return;
    }
    const partes = [];
    for await (const parte of req) partes.push(parte);
    const mensagem = JSON.parse(Buffer.concat(partes).toString('utf8'));
    recebidas.push(mensagem);
    const chamada = ferramentas[recebidas.length - 1];
    const bloco = chamada
      ? [{ type: 'tool_use', id: 'toolu_teste_' + recebidas.length, name: chamada[0], input: {} }, JSON.stringify(chamada[1])]
      : [{ type: 'text', text: '' }, null];
    const eventos = [
      { type: 'message_start', message: { id: 'msg_teste', role: 'assistant', type: 'message', model: mensagem.model,
        content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: bloco[0] },
      { type: 'content_block_delta', index: 0, delta: chamada
        ? { type: 'input_json_delta', partial_json: bloco[1] }
        : { type: 'text_delta', text: 'resultado-sintetico' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: chamada ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: 'message_stop' },
    ];
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const evento of eventos) res.write('event: ' + evento.type + '\ndata: ' + JSON.stringify(evento) + '\n\n');
    res.end();
  });
  await new Promise((ok, erro) => servidor.once('error', erro).listen(0, '127.0.0.1', ok));
  t.after(() => servidor.close());
  return { recebidas, porta: servidor.address().port };
}

test('no Claude Code, a skill do cargo recebe a tarefa e bloqueia comandos no turno', {
  skip: !process.env.LEVELUP_CLAUDE_BIN && 'Defina LEVELUP_CLAUDE_BIN para verificar o executável do Claude Code.',
  timeout: 120_000,
}, async t => {
  for (const agente of [perfis.get('CFO'), perfis.get('CFO.2')]) {
    const pasta = await pastaTemporaria(t, 'levelup-host-skill-');
    const config = join(pasta, 'config');
    execFileSync('git', ['init', '-q', pasta]);
    await gerarSkills(catalogo, join(pasta, '.claude', 'skills'));
    await mkdir(config);
    // Pasta confiável e onboarding concluído, como numa sessão real; HOME fora do projeto.
    await writeFile(join(config, '.claude.json'), JSON.stringify({
      hasCompletedOnboarding: true, projects: { [pasta]: { hasTrustDialogAccepted: true } },
    }));
    const marcador = join(pasta, 'marcador-bash');
    const { recebidas, porta } = await modeloFalso(t, [['Bash', { command: 'touch ' + marcador, description: 'teste' }]]);
    const nome = nomeSkill(agente);
    const host = spawn(process.env.LEVELUP_CLAUDE_BIN, [
      '-p', `/${nome} lote-sintetico-381`, '--allowedTools', 'Bash(touch:*)',
      '--strict-mcp-config', '--no-session-persistence',
    ], {
      cwd: pasta,
      timeout: 60_000,
      env: { PATH: process.env.PATH, HOME: config, CLAUDE_CONFIG_DIR: config,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1',
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + porta, ANTHROPIC_API_KEY: 'teste-sintetico-em-localhost' },
    });
    t.after(() => host.kill());
    let erros = '';
    host.stderr.on('data', dados => { erros += dados; });
    host.stdin.end();
    const codigo = await new Promise((ok, erro) => host.once('error', erro).once('close', ok));
    assert.equal(codigo, 0, erros);
    assert.equal(recebidas.length, 2, agente.id);
    const primeira = JSON.stringify(recebidas[0].messages);
    assert.ok(primeira.includes(agente.missao) && primeira.includes('lote-sintetico-381'), agente.id);
    // As descrições dos especialistas não entram no contexto; as das áreas entram.
    assert.ok(primeira.includes(`${areas[0].id} · ${areas[0].nome} (área`));
    for (const especialista of especialistas) assert.ok(!primeira.includes(`${especialista.id} · ${especialista.nome} (${especialista.supervisor}, alçada`), especialista.id);
    if (agente.tipo === 'area') {
      assert.ok(primeira.includes(join(pasta, '.claude', 'skills', nome) + '/../<skill>/SKILL.md'), 'CLAUDE_SKILL_DIR substituído');
    }
    const resultado = recebidas[1].messages.at(-1).content.find(bloco => bloco.type === 'tool_result');
    assert.equal(resultado.is_error, true, agente.id);
    assert.match(JSON.stringify(resultado.content), /denied/);
    await assert.rejects(access(marcador));
  }
});
