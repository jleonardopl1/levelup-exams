import { access, readFile, writeFile } from 'node:fs/promises';
import { nomeSkill, validarCatalogo } from './cli.mjs';

const fonte = new URL('./catalogo.json', import.meta.url);
const destino = new URL('../../docs/ORGANOGRAMA_OPERACIONAL.md', import.meta.url);

const campos = [
  ['cargosOrigem', 'Cargos de origem'],
  ['responsabilidades', 'Responsabilidades'],
  ['gatilhos', 'Quando acionar'],
  ['entradas', 'Entradas'],
  ['entregas', 'Entregas'],
  ['indicadores', 'Indicadores'],
  ['escalonar', 'Quando encaminhar a uma pessoa'],
];

function html(texto) {
  return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function markdown(texto) {
  return html(texto).replace(/([\\`*_\[\]])/g, '\\$1');
}

function ancora(id) {
  return 'perfil-' + id.toLowerCase().replaceAll('.', '-');
}

function linkPerfil(agente) {
  return `[${agente.id} · ${markdown(agente.nome)}](#${ancora(agente.id)})`;
}

function ficha(agente) {
  const supervisor = agente.supervisor === 'fundador'
    ? 'fundador'
    : `[${agente.supervisor}](#${ancora(agente.supervisor)})`;
  const linhas = [
    `**Missão** · ${markdown(agente.missao)}`,
    '',
    `**Supervisão** · ${supervisor}　 **Alçada** · ${agente.alcada}`,
    '',
    `**Skill no Claude Code** · \`/${nomeSkill(agente)}\``,
  ];
  for (const [chave, titulo] of campos) {
    linhas.push('', `**${titulo}**`, '', ...agente[chave].map(item => '- ' + markdown(item)));
  }
  return linhas;
}

function renderizar({ agentes }) {
  const areas = agentes.filter(a => a.tipo === 'area');
  const especialistas = agentes.filter(a => a.tipo === 'especialista');
  const linhas = [
    '# Organograma operacional do LevelUp Exams',
    '',
    `Consulte as ${agentes.length} fichas de cargo, distribuídas entre ${areas.length} responsáveis de área e ${especialistas.length} especialistas. Escolha uma área e abra a ficha pelo ID.`,
    '',
    'A0 permite analisar o contexto expressamente fornecido. A1 permite preparar rascunhos para revisão humana. Em ambos os níveis, cada perfil trabalha com material sintético ou público e apresenta o que precisa de decisão da pessoa responsável.',
    '',
    'No Claude Code, cada ficha é uma skill: digite `/` e o nome indicado na ficha, seguido da tarefa, como em `/cfo-2-rebate-comissionamento`. As skills das áreas também podem ser escolhidas pelo próprio Claude e encaminham ao especialista. [Guia das skills e dos perfis](../ops/agentes/README.md)',
    '',
    'No terminal, consulte uma ficha com `node ops/agentes/cli.mjs mostrar CFO.2`. [Guia do projeto](../README.md) · [Plano de integração](INTEGRACAO_OPERACIONAL.md) · [Catálogo em JSON](../ops/agentes/catalogo.json)',
    '',
    '<a name="indice-areas"></a>',
    '',
    '## Áreas',
    '',
  ];
  for (const area of areas) {
    const quantidade = especialistas.filter(a => a.supervisor === area.id).length;
    linhas.push(`- ${linkPerfil(area)} · ${quantidade} especialistas`);
  }
  for (const area of areas) {
    const equipe = especialistas.filter(a => a.supervisor === area.id);
    linhas.push(
      '', `<a name="${ancora(area.id)}"></a>`, '',
      `## ${area.id} · ${markdown(area.nome)}`, '',
      '<details>', '<summary>Ficha da direção de área</summary>', '',
      ...ficha(area), '', '</details>', '', '**Especialistas da área**', '',
      ...equipe.map(a => '- ' + linkPerfil(a)),
    );
    for (const a of equipe) {
      linhas.push(
        '', `<a name="${ancora(a.id)}"></a>`, '',
        '<details>', `<summary><strong>${a.id}</strong> · ${html(a.nome)}</summary>`, '',
        ...ficha(a), '', '</details>',
      );
    }
    linhas.push('', '[Voltar ao índice de áreas](#indice-areas)');
  }
  linhas.push('', '<!-- Gerado a partir de ops/agentes/catalogo.json por node ops/agentes/documentar.mjs -->', '');
  return linhas.join('\n');
}

async function conferirNavegacao(documento, agentes) {
  const alvos = [...documento.matchAll(/^<a name="([^"]+)"><\/a>$/gm)].map(m => m[1]);
  const unicos = new Set(alvos);
  if (unicos.size !== agentes.length + 1 || alvos.length !== unicos.size) {
    throw new Error('Cada ficha e o índice precisam de uma âncora exclusiva.');
  }
  const links = new Set([...documento.matchAll(/\]\(([^ )]+)\)/g)].map(m => m[1]));
  for (const agente of agentes) {
    const id = ancora(agente.id);
    if (!unicos.has(id) || !links.has('#' + id)) throw new Error(`Ficha sem entrada no índice: ${agente.id}.`);
  }
  for (const link of links) {
    if (link.startsWith('#')) {
      if (!unicos.has(link.slice(1))) throw new Error(`Âncora inexistente: ${link}`);
    } else {
      await access(new URL(link, destino));
    }
  }
}

async function main(argumentos) {
  const verificar = argumentos.length === 1 && argumentos[0] === '--check';
  if (argumentos.length && !verificar) throw new Error('Uso: node ops/agentes/documentar.mjs [--check]');
  const catalogo = JSON.parse(await readFile(fonte, 'utf8'));
  validarCatalogo(catalogo);
  const documento = renderizar(catalogo);
  await conferirNavegacao(documento, catalogo.agentes);
  if (verificar) {
    if ((await readFile(destino, 'utf8')) !== documento) {
      throw new Error('Organograma desatualizado. Execute node ops/agentes/documentar.mjs.');
    }
    console.log(`${catalogo.agentes.length} fichas atualizadas e links válidos.`);
  } else {
    await writeFile(destino, documento);
    console.log(`${catalogo.agentes.length} fichas geradas em docs/ORGANOGRAMA_OPERACIONAL.md.`);
  }
}

main(process.argv.slice(2)).catch(erro => {
  console.error(erro.message);
  process.exitCode = 1;
});
