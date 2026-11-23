#!/usr/bin/env node
/**
 * Radar de repositórios — catálogo das avaliações de repositórios externos (skills, plugins,
 * agentes, bibliotecas) e governança do que fica ativo no ambiente de agentes do LevelUp.
 *
 * Regras que este script garante (e o `bun run test:unit` confere):
 *  - toda avaliação tem veredito, faixa dona, uso concreto e riscos; piloto/futuro/monitorar têm gatilho;
 *  - nada fica ativo sem avaliação aprovada pelo dono: cada plugin em `enabledPlugins` do
 *    `.claude/settings.json` e cada skill escrita fora do gerador em `.claude/skills/` precisa
 *    de uma ativação registrada aqui (skill de terceiros com `ORIGEM.md` e commit fixado);
 *  - o bloco gerado em `docs/RADAR_REPOSITORIOS.md` corresponde ao catálogo.
 *
 * Uso: node ops/radar-repositorios/radar.mjs validar | relatorio
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARCA } from '../agentes/skills.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const CATALOGO = join(RAIZ, 'ops/radar-repositorios/catalogo.json');
const SETTINGS = join(RAIZ, '.claude/settings.json');
const SKILLS = join(RAIZ, '.claude/skills');
const DOC = join(RAIZ, 'docs/RADAR_REPOSITORIOS.md');
const INICIO = '<!-- radar:inicio (gerado por ops/radar-repositorios/radar.mjs; não edite à mão) -->';
const FIM = '<!-- radar:fim -->';

export const VEREDITOS = new Map([
  ['agora', 'Ativar agora'],
  ['piloto', 'Piloto (precisa do de acordo do dono)'],
  ['futuro', 'Futuro (ativar quando o gatilho acontecer)'],
  ['monitorar', 'Monitorar'],
  ['descartar', 'Descartado'],
]);
export const CATEGORIAS = new Map([
  ['processo-agentes', 'Processo e ambiente dos agentes'],
  ['ia-produto', 'IA de produto e conhecimento'],
  ['dados-coleta', 'Coleta de dados e busca'],
  ['design', 'Design e front-end'],
  ['mobile', 'Mobile e lojas'],
  ['seguranca', 'Segurança'],
  ['marketing', 'Marketing e conteúdo'],
  ['fora-do-escopo', 'Fora do escopo'],
]);
const TIPOS_ATIVACAO = new Set(['plugin', 'skill', 'regra']);
const PRECISA_GATILHO = new Set(['piloto', 'futuro', 'monitorar']);
const TEXTOS = ['o_que_e', 'uso_no_levelup', 'riscos'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SHA = /^[a-f0-9]{40}$/;

const texto = valor => typeof valor === 'string' && valor.trim().length > 0;

/**
 * O Claude Code executa `` !`comando` `` e substitui `$ARGUMENTS`, `$0`, `$nome` e `${VAR}` no corpo
 * da SKILL.md ao carregá-la (mesma regra de ops/agentes/skills.mjs). Em skill escrita fora do
 * gerador — nossa ou de terceiros — isso é execução escondida ou texto trocado.
 */
export function padroesPerigosos(conteudo) {
  const achados = [];
  if (conteudo.includes('!`')) achados.push('"!" seguido de crase executaria um comando ao carregar a skill');
  if (/\$[\w{[]/.test(conteudo)) achados.push('"$" seguido de letra, número ou chave vira variável na skill (escreva "R$ 100", com espaço)');
  return achados;
}

/**
 * Confere o catálogo contra o estado do repositório. `ambiente` é injetável para teste:
 * { enabledPlugins: {id: bool}, skillsManuais: string[] (pastas de .claude/skills sem a marca do gerador),
 *   existe: (caminhoRelativo) => bool }. Devolve a lista de problemas (vazia = ok).
 */
export function conferir(catalogo, ambiente) {
  const problemas = [];
  const erro = (onde, msg) => problemas.push(`${onde}: ${msg}`);
  const lotes = new Set();
  for (const lote of catalogo.lotes ?? []) {
    if (!DATA.test(lote.id ?? '') || !texto(lote.origem) || !texto(lote.descricao)) erro('lotes', `lote inválido ${JSON.stringify(lote)}`);
    lotes.add(lote.id);
  }
  const vistos = new Set();
  const plugins = new Map();
  const skills = new Map();
  for (const item of catalogo.avaliacoes ?? []) {
    const nome = String(item.repo ?? '?');
    const chave = nome.toLowerCase();
    if (!/^[\w.-]+\/[\w.-]+$/.test(nome)) erro(nome, 'repo deve ser "dono/nome"');
    if (vistos.has(chave)) erro(nome, 'avaliação repetida (atualize a existente)');
    vistos.add(chave);
    if (!/^https:\/\/(github\.com|gist\.github\.com)\//.test(item.url ?? '')) erro(nome, 'url deve apontar para github.com ou gist.github.com');
    if (!lotes.has(item.lote)) erro(nome, `lote desconhecido ${item.lote}`);
    if (!VEREDITOS.has(item.veredito)) erro(nome, `veredito inválido ${item.veredito}`);
    if (!CATEGORIAS.has(item.categoria)) erro(nome, `categoria inválida ${item.categoria}`);
    if (!Array.isArray(item.faixa) || !item.faixa.length || !item.faixa.every(texto)) erro(nome, 'faixa deve listar ao menos um agente ou cargo dono');
    for (const campo of TEXTOS) if (!texto(item[campo])) erro(nome, `falta ${campo}`);
    if (PRECISA_GATILHO.has(item.veredito) && !texto(item.gatilho)) erro(nome, 'falta gatilho (quando reavaliar ou ativar)');
    if (item.veredito !== 'descartar' && item.veredito !== 'monitorar' && !texto(item.como_ativar)) erro(nome, 'falta como_ativar');
    const ativ = item.ativacao;
    if (!ativ) continue;
    if (!['agora', 'piloto'].includes(item.veredito)) erro(nome, 'só "agora" ou "piloto" podem ficar ativos');
    if (!TIPOS_ATIVACAO.has(ativ.tipo)) erro(nome, `tipo de ativação inválido ${ativ.tipo}`);
    if (!texto(ativ.alvo)) erro(nome, 'ativação sem alvo');
    if (!texto(ativ.aprovado_por) || !DATA.test(ativ.aprovado_em ?? '')) erro(nome, 'ativação sem aprovação do dono (aprovado_por, aprovado_em)');
    if (!SHA.test(ativ.commit ?? '')) erro(nome, 'ativação exige o commit revisado (40 hex); para plugin, o que o marketplace fixa');
    if (ativ.tipo === 'plugin') {
      if (!/^[\w.-]+@[\w.-]+$/.test(ativ.alvo ?? '')) erro(nome, 'plugin deve ser "nome@marketplace"');
      plugins.set(ativ.alvo, nome);
    } else {
      if (!ambiente.existe(ativ.alvo)) erro(nome, `alvo ${ativ.alvo} não existe`);
      if (ativ.tipo === 'skill') {
        const pasta = String(ativ.alvo).replace(/\/$/, '');
        if (!/^\.claude\/skills\/[\w.-]+$/.test(pasta)) erro(nome, 'skill deve ficar em .claude/skills/<nome>');
        for (const arq of ['SKILL.md', 'ORIGEM.md']) if (!ambiente.existe(`${pasta}/${arq}`)) erro(nome, `falta ${pasta}/${arq}`);
        skills.set(pasta.split('/').pop(), nome);
      }
    }
  }
  for (const [id, ligado] of Object.entries(ambiente.enabledPlugins ?? {})) {
    if (ligado && !plugins.has(id)) erro('.claude/settings.json', `plugin ${id} ativo sem avaliação aprovada no catálogo`);
  }
  for (const [id, repo] of plugins) {
    if (ambiente.enabledPlugins?.[id] !== true) erro(repo, `plugin ${id} aprovado mas fora de enabledPlugins`);
  }
  const proprias = new Set(catalogo.skills_proprias ?? []);
  for (const pasta of ambiente.skillsManuais ?? []) {
    if (!skills.has(pasta) && !proprias.has(pasta)) erro('.claude/skills', `skill ${pasta} sem origem registrada (gerada, própria ou avaliada aqui)`);
    for (const motivo of padroesPerigosos(ambiente.lerSkill?.(pasta) ?? '')) erro(`.claude/skills/${pasta}/SKILL.md`, motivo);
  }
  for (const pasta of proprias) {
    if (!(ambiente.skillsManuais ?? []).includes(pasta)) erro('skills_proprias', `${pasta} não existe em .claude/skills`);
  }
  return problemas;
}

const linha = valor => String(valor).replace(/\s+/g, ' ').trim();
const frase = valor => linha(valor).replace(/[.;]+$/, '') + '.';

/** Gera o bloco Markdown do relatório a partir do catálogo. */
export function renderizar(catalogo) {
  const itens = [...catalogo.avaliacoes].sort((a, b) =>
    [...CATEGORIAS.keys()].indexOf(a.categoria) - [...CATEGORIAS.keys()].indexOf(b.categoria) || a.repo.localeCompare(b.repo));
  const link = i => `[${i.repo}](${i.url})`;
  const meta = i => [i.estrelas != null ? `★ ${Number(i.estrelas).toLocaleString('pt-BR')}` : null, i.licenca, `avaliado em ${i.lote}`].filter(Boolean).join(' · ');
  const out = [INICIO, '', '| Veredito | Repositórios |', '| --- | ---: |'];
  for (const [id, rotulo] of VEREDITOS) out.push(`| ${rotulo} | ${itens.filter(i => i.veredito === id).length} |`);
  out.push(`| **Total** | **${itens.length}** |`, '');

  const ativos = itens.filter(i => i.ativacao);
  out.push('### Ativos no projeto', '');
  if (!ativos.length) out.push('Nenhum.', '');
  else {
    out.push('| Repositório | Tipo | Onde | Faixa | Aprovado |', '| --- | --- | --- | --- | --- |');
    for (const i of ativos) out.push(`| ${link(i)} | ${i.ativacao.tipo} | \`${i.ativacao.alvo}\`${i.ativacao.commit ? ` @ \`${i.ativacao.commit.slice(0, 12)}\`` : ''} | ${i.faixa.join(', ')} | ${i.ativacao.aprovado_por}, ${i.ativacao.aprovado_em} |`);
    out.push('');
  }

  const secao = (titulo, lista, campos) => {
    out.push(`### ${titulo}`, '');
    if (!lista.length) { out.push('Nenhum.', ''); return; }
    let categoria = null;
    for (const i of lista) {
      if (i.categoria !== categoria) {
        if (categoria !== null) out.push('');
        categoria = i.categoria;
        out.push(`#### ${CATEGORIAS.get(categoria)}`, '');
      }
      out.push(`- **${link(i)}** — ${frase(i.o_que_e)} _${meta(i)}; faixa: ${i.faixa.join(', ')}._`);
      for (const [campo, rotulo] of campos) if (texto(i[campo])) out.push(`  - **${rotulo}:** ${frase(i[campo])}`);
    }
    out.push('');
  };
  const completo = [['uso_no_levelup', 'Uso no LevelUp'], ['gatilho', 'Gatilho'], ['como_ativar', 'Como ativar'], ['riscos', 'Riscos'], ['relacao_backlog', 'Backlog']];
  secao('Aguardando o de acordo do dono', itens.filter(i => !i.ativacao && (i.veredito === 'agora' || i.veredito === 'piloto')), completo);
  secao('Futuro — ativar quando o gatilho acontecer', itens.filter(i => i.veredito === 'futuro'), completo);
  secao('Monitorar', itens.filter(i => i.veredito === 'monitorar'), [['uso_no_levelup', 'Por que acompanhar'], ['gatilho', 'Reavaliar quando'], ['riscos', 'Riscos']]);
  secao('Descartados', itens.filter(i => i.veredito === 'descartar'), [['uso_no_levelup', 'Motivo'], ['riscos', 'Riscos']]);
  secao('Detalhe dos ativos', ativos, completo);
  out.push(FIM);
  return out.join('\n').replace(/[ \t]+$/gm, '');
}

function ambienteReal() {
  const settings = JSON.parse(readFileSync(SETTINGS, 'utf8'));
  const skillsManuais = existsSync(SKILLS)
    ? readdirSync(SKILLS, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).filter(nome => {
      const arquivo = join(SKILLS, nome, 'SKILL.md');
      return existsSync(arquivo) && !readFileSync(arquivo, 'utf8').includes(MARCA);
    })
    : [];
  return {
    enabledPlugins: settings.enabledPlugins ?? {},
    skillsManuais,
    existe: rel => existsSync(join(RAIZ, rel)),
    lerSkill: pasta => readFileSync(join(SKILLS, pasta, 'SKILL.md'), 'utf8'),
  };
}

function blocoAtual(doc) {
  const a = doc.indexOf(INICIO);
  const b = doc.indexOf(FIM);
  if (a < 0 || b < a) throw Error('docs/RADAR_REPOSITORIOS.md sem os marcadores radar:inicio/radar:fim.');
  return [a, b + FIM.length];
}

function main(comando = 'validar') {
  const catalogo = JSON.parse(readFileSync(CATALOGO, 'utf8'));
  const problemas = conferir(catalogo, ambienteReal());
  if (problemas.length) throw Error(`Catálogo do radar com problemas:\n- ${problemas.join('\n- ')}`);
  const doc = readFileSync(DOC, 'utf8');
  const [a, b] = blocoAtual(doc);
  const bloco = renderizar(catalogo);
  if (comando === 'relatorio') {
    writeFileSync(DOC, doc.slice(0, a) + bloco + doc.slice(b));
    console.log(`docs/RADAR_REPOSITORIOS.md atualizado (${catalogo.avaliacoes.length} avaliações).`);
  } else if (comando === 'validar') {
    if (doc.slice(a, b) !== bloco) throw Error('docs/RADAR_REPOSITORIOS.md desatualizado: rode `node ops/radar-repositorios/radar.mjs relatorio`.');
    console.log(`${catalogo.avaliacoes.length} avaliações do radar verificadas; ambiente de agentes coerente com o catálogo.`);
  } else throw Error('Use validar ou relatorio.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv[2]);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
