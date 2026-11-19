import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const reportUrl = new URL('docs/ANALISE_DAS_REFERENCIAS.md', root);
const groups = [
  ['produto', 'Aprendizagem e material de estudo'],
  ['ferramentas', 'IA, conteúdo e automação'],
  ['governanca', 'Engenharia, governança e catálogos'],
];
const statuses = new Map([
  ['aplicativo', 'Aplicativo ou CLI instalado'],
  ['componente', 'Componente instalado'],
  ['conteudo', 'Conteúdo local'],
  ['nao_instalado', 'Somente análise'],
]);
const analysisOnly = new Set([
  'cloudflare/security-audit-skill', 'elementalsouls/claude-bughunter', 'morluto/rea',
]);
const canonicalName = item => (item.requestedRepo || item.repo).toLowerCase();
const clean = value => (Array.isArray(value) ? value.join(' ') : String(value)).trim();
const sentence = value => clean(value).replace(/[.]+$/, '') + '.';

function readGroups() {
  return groups.map(([name, title]) => ({
    name, title, items: JSON.parse(readFileSync(new URL(`./grupos/${name}.json`, import.meta.url), 'utf8')),
  }));
}

function check(groupsData) {
  const catalog = readFileSync(new URL('docs/REFERENCIAS_REPOSITORIOS.md', root), 'utf8');
  const expected = new Set([...catalog.matchAll(/\]\(https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\)/g)].map(m => m[1].toLowerCase()));
  const seen = new Set();
  for (const group of groupsData) {
    for (const item of group.items) {
      const name = canonicalName(item);
      if (!expected.has(name) || seen.has(name)) throw Error(`Referência inesperada ou repetida: ${name}`);
      seen.add(name);
      if (!statuses.has(item.status)) throw Error(`Estado inválido: ${name}`);
      if (analysisOnly.has(name) && item.status !== 'nao_instalado') throw Error(`Fora da seleção instalável: ${name}`);
      if (!/^[a-f0-9]{40}$/.test(item.sha)) throw Error(`Revisão Git inválida: ${name}`);
      if (!/^[\w.-]+\/[\w.-]+$/.test(item.repo)) throw Error(`Identificador GitHub inválido: ${name}`);
      for (const key of ['license','kind','component','analysis','installation','verification','decision']) {
        if (!item[key] || !clean(item[key])) throw Error(`${name}: falta ${key}`);
      }
      if (!Array.isArray(item.sourcePaths) || !item.sourcePaths.length) throw Error(`${name}: faltam evidências`);
      if (item.status !== 'nao_instalado' && (!item.localPath || !item.recipe)) throw Error(`${name}: falta o local ou a receita de instalação`);
      if (/^(pendente\.?|em verificação local\.?)$/i.test(clean(item.verification))) throw Error(`${name}: falta a verificação final`);
    }
  }
  const missing = [...expected].filter(n => !seen.has(n));
  if (missing.length) throw Error(`Faltam referências: ${missing.join(', ')}`);
}

function render(groupsData) {
  const items = groupsData.flatMap(g => g.items);
  const lines = [
    '# Análise e instalação das referências do LevelUp Exams', '',
    'Este inventário registra o que a equipe conseguiu instalar e verificar em ambiente local. A unidade de avaliação é o repositório de origem. Cada ficha identifica o componente usado, a revisão inspecionada, os limites do teste e a decisão para o LevelUp.', '',
    '| Resultado local | Repositórios |', '| --- | ---: |',
    ...[...statuses].map(([id, label]) => `| ${label} | ${items.filter(i => i.status === id).length} |`), '',
    'Os manifestos guardam as evidências e as receitas permitem repetir as instalações fora do aplicativo de estudo. Um teste de CLI, módulo ou material didático cobre apenas o componente indicado na ficha. A equipe deve conferir a licença de cada arquivo e as condições de serviços hospedados para a utilização pretendida. [Instruções de reprodução](../ops/referencias/README.md) · [Catálogo de origem](REFERENCIAS_REPOSITORIOS.md)', '',
    'O anexo de MCP cita outros sete repositórios. As fichas adicionais tratam de pagamentos, desenvolvimento, observabilidade, pesquisa e ferramentas de data e leitura. [Operação](../ops/referencias/grupos/mcp-operacao.md) · [Dados e pesquisa](../ops/referencias/grupos/mcp-dados.md)', '',
  ];
  for (const {title, items} of groupsData) {
    lines.push(`## ${title}`, '');
    for (const item of items) {
      const name = item.requestedRepo || item.repo;
      lines.push(`### ${name}`, '', clean(item.analysis), '',
        `**${statuses.get(item.status)}** · ${sentence(item.component)}`, '',
        `**Instalação** · ${clean(item.installation)}`, '',
        `**Verificação** · ${clean(item.verification)}`, '',
        `**Aplicação no LevelUp** · ${clean(item.decision)}`, '');
      if (analysisOnly.has(canonicalName(item))) {
        lines.push(`Metadados públicos · ${sentence(item.license)} Revisão \`${item.sha.slice(0,12)}\`.`, '');
      } else {
        const evidence = item.sourcePaths.map(p => `\`${p}\``).join(', ');
        lines.push(`**Licença** · ${sentence(item.license)} **Arquivos consultados** · ${evidence}. [Revisão ${item.sha.slice(0,12)}](https://github.com/${item.repo}/tree/${item.sha})`, '');
      }
    }
  }
  return lines.join('\n').replace(/[ \t]+$/gm,'').trimEnd() + '\n';
}

const command = process.argv[2] || 'validar';
try {
  const data = readGroups();
  check(data);
  const report = render(data);
  if (command === 'relatorio') process.stdout.write(report);
  else if (command === 'validar') {
    if (report !== readFileSync(reportUrl, 'utf8')) throw Error(`Relatório desatualizado. Gere ${fileURLToPath(reportUrl).split('/').pop()} com o comando relatorio.`);
    console.log(`${data.reduce((n,g) => n + g.items.length,0)} referências verificadas. O relatório corresponde aos manifestos.`);
  } else throw Error('Use validar ou relatorio.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
