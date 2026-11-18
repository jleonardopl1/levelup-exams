#!/usr/bin/env node
/**
 * Guardrails do Claude Code (hook PreToolUse) — convenções inegociáveis do CLAUDE.md em
 * código, para nenhum agente executar por engano o que só o dono pode fazer.
 *
 * Inspirado no `git-guardrails-claude-code` (mattpocock/skills) e nos hooks do ECC
 * (affaan-m/ECC), adaptado às regras do LevelUp:
 *  - nunca force-push, nunca reescrever histórico, nunca commit/push direto na main;
 *  - banco remoto, deploy de função e secrets só com aprovação do dono (D4);
 *  - `.lovable/`, `.env`, `types.ts` (gerado) e `auth-email-hook` (Lovable) não se editam à mão.
 *
 * Bloquear = sair com código 2 e explicar no stderr (o Claude Code mostra a mensagem ao
 * agente). É uma rede de proteção, não um sandbox: `eval`, scripts e variáveis escapam dela.
 * Testes: .claude/hooks/guardrails.test.mjs (`bun run test:unit`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OWNER = 'Peça ao dono do projeto para rodar manualmente, se for o caso.';

/** Arquivos que nenhum agente edita (relativos à raiz do projeto). */
const PROTECTED_FILES = [
  { test: (p) => p === '.env', why: '`.env` é gerenciado pelo Lovable (CLAUDE.md).' },
  { test: (p) => p === '.lovable' || p.startsWith('.lovable/'), why: '`.lovable/` é gerenciado pelo Lovable (CLAUDE.md).' },
  { test: (p) => p === 'src/integrations/supabase/types.ts', why: '`types.ts` é gerado pelo Supabase; regere os tipos em vez de editar.' },
  { test: (p) => p.startsWith('supabase/functions/auth-email-hook/'), why: '`auth-email-hook` é gerenciado pelo Lovable.' },
  { test: (p) => p === 'bun.lockb', why: '`bun.lockb` só muda via `bun install`/`bun add`.' },
];

/**
 * Divide um comando de shell em comandos simples (listas de palavras), respeitando aspas,
 * escapes e heredocs. Separadores fora de aspas: `;` `&` `|` `&&` `||` e quebra de linha.
 */
export function splitCommands(input) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  const heredocs = [];
  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      else word += c;
      continue;
    }
    if (quote === '"') {
      if (c === '"') quote = null;
      else if (c === '\\' && i + 1 < input.length) word += input[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
      continue;
    }
    if (c === '\\' && i + 1 < input.length) {
      word += input[++i];
      inWord = true;
      continue;
    }
    if (c === '<' && input[i + 1] === '<' && input[i + 2] !== '<') {
      const m = /^<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(input.slice(i));
      if (m) {
        heredocs.push(m[2]);
        endWord();
        i += m[0].length - 1;
        continue;
      }
    }
    if (c === '\n') {
      endCommand();
      // Pula o corpo dos heredocs abertos nesta linha (é texto, não comando).
      while (heredocs.length) {
        const delim = heredocs.shift();
        let j = i + 1;
        for (;;) {
          const nl = input.indexOf('\n', j);
          const line = input.slice(j, nl === -1 ? input.length : nl);
          if (line.trim() === delim || nl === -1) {
            i = nl === -1 ? input.length : nl;
            break;
          }
          j = nl + 1;
        }
      }
      continue;
    }
    if (c === ';' || c === '&' || c === '|') {
      endCommand();
      continue;
    }
    if (c === '(' || c === ')' || c === '`') {
      endCommand();
      continue;
    }
    if (/\s/.test(c)) {
      endWord();
      continue;
    }
    word += c;
    inWord = true;
  }
  endCommand();
  return commands;
}

/** Tira prefixos que não mudam o comando: VAR=x, sudo, env, command, exec, time, nice. */
function program(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) { i++; continue; }
    if (['sudo', 'env', 'command', 'exec', 'time', 'nice', 'nohup', 'timeout'].includes(w)) {
      i++;
      // `timeout 60 git push`: pula a duração.
      if (w === 'timeout' && /^\d/.test(words[i] ?? '')) i++;
      continue;
    }
    break;
  }
  return words.slice(i);
}

/** Opções globais do git antes do subcomando (-C dir, -c k=v, --no-pager...). */
function gitArgs(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '-C' || args[i] === '-c' || args[i] === '--git-dir' || args[i] === '--work-tree') i += 2;
    else i += 1;
  }
  return { sub: args[i], rest: args.slice(i + 1) };
}

const isMainRef = (ref) => {
  const target = ref.includes(':') ? ref.split(':').pop() : ref;
  return /^(refs\/heads\/)?(main|master)$/.test(target.replace(/^\+/, ''));
};

function checkGit(args, currentBranch) {
  const { sub, rest } = gitArgs(args);
  const flags = rest.filter((a) => a.startsWith('-'));
  const positional = rest.filter((a) => !a.startsWith('-'));
  const has = (...names) => flags.some((f) => names.includes(f));
  const shortHas = (letter) => flags.some((f) => /^-[A-Za-z]+$/.test(f) && f.includes(letter));

  if (has('--no-verify') && (sub === 'commit' || sub === 'push')) {
    return '`--no-verify` pula os hooks de verificação. Corrija a causa em vez de pular.';
  }
  switch (sub) {
    case 'push': {
      if (has('--force', '--force-with-lease', '--force-if-includes') || shortHas('f') || positional.some((r) => r.startsWith('+'))) {
        return 'Force-push reescreve histórico e é proibido (CLAUDE.md: "Nunca force-push"). Se o push foi recusado, faça fetch + merge.';
      }
      if (has('--delete', '-d') || positional.slice(1).some((r) => r.startsWith(':'))) {
        return 'Apagar branch remota é decisão do dono. ' + OWNER;
      }
      if (has('--mirror', '--all')) return 'Push de todas as branches/espelho não é permitido para agentes.';
      // `HEAD` é a branch atual.
      const refs = positional.slice(1).map((r) => (r === 'HEAD' && currentBranch ? currentBranch : r));
      if (refs.some(isMainRef) || (refs.length === 0 && currentBranch && isMainRef(currentBranch))) {
        return 'Push direto na main é proibido: trabalhe numa branch e abra um PR (CLAUDE.md).';
      }
      return null;
    }
    case 'commit':
      if (currentBranch && isMainRef(currentBranch)) {
        return 'Commit direto na main é proibido: crie uma branch (git switch -c <nome>) e abra um PR.';
      }
      return null;
    case 'reset':
      return has('--hard', '--merge', '--keep') ? '`git reset --hard` descarta trabalho sem volta. Use `git stash` ou um commit.' : null;
    case 'clean':
      return has('--force') || shortHas('f') ? '`git clean -f` apaga arquivos não versionados sem volta.' : null;
    case 'branch': {
      const forceDelete = has('-D') || (has('-d', '--delete') && (has('--force') || shortHas('f')));
      return forceDelete ? 'Apagar branch à força (`-D`) pode perder commits. ' + OWNER : null;
    }
    case 'checkout':
      return positional.includes('.') || (rest.includes('--') && rest[rest.indexOf('--') + 1] === '.')
        ? '`git checkout .` descarta as mudanças não commitadas.'
        : null;
    case 'restore':
      return positional.includes('.') && !(has('--staged', '-S') && !has('--worktree', '-W'))
        ? '`git restore .` descarta as mudanças não commitadas.'
        : null;
    case 'filter-branch':
    case 'filter-repo':
      return 'Reescrever histórico é proibido (CLAUDE.md, "Fora de escopo").';
    case 'rebase':
      return currentBranch && isMainRef(currentBranch) ? 'Rebase na main reescreve histórico publicado.' : null;
    default:
      return null;
  }
}

function checkSupabase(args) {
  const [a, b] = args.filter((x) => !x.startsWith('-'));
  const flags = args.filter((x) => x.startsWith('-'));
  if (a === 'db' && b === 'push') return '`supabase db push` aplica migrations no banco remoto: exige aprovação do dono (D4). ' + OWNER;
  if (a === 'db' && b === 'reset' && flags.some((f) => f === '--linked' || f.startsWith('--db-url'))) {
    return '`supabase db reset` no banco remoto apaga dados. ' + OWNER;
  }
  if (a === 'functions' && (b === 'deploy' || b === 'delete')) return 'Publicar/apagar Edge Function exige aprovação do dono (D4). ' + OWNER;
  if (a === 'secrets' && (b === 'set' || b === 'unset')) return 'Secrets de produção só com o dono (D4). ' + OWNER;
  if (a === 'migration' && b === 'repair') return '`migration repair` altera o histórico de migrations do remoto. ' + OWNER;
  if (a === 'projects' && b === 'delete') return 'Apagar projeto Supabase não é tarefa de agente.';
  return null;
}

function protectedReason(file, projectDir) {
  if (!file) return null;
  const abs = path.resolve(projectDir, file);
  const rel = path.relative(projectDir, abs).split(path.sep).join('/');
  if (rel.startsWith('..')) return null;
  return PROTECTED_FILES.find((p) => p.test(rel))?.why ?? null;
}

const WRITERS = new Set(['rm', 'mv', 'cp', 'tee', 'truncate', 'shred', 'dd', 'chmod', 'chown', 'ln']);

function checkShellWrite(words, projectDir) {
  const [cmd, ...args] = words;
  const targets = [];
  if (WRITERS.has(cmd)) targets.push(...args.filter((a) => !a.startsWith('-')));
  if (cmd === 'sed' && args.some((a) => /^-[A-Za-z]*i/.test(a) || a.startsWith('--in-place'))) {
    targets.push(...args.filter((a) => !a.startsWith('-')).slice(1));
  }
  words.forEach((w, i) => {
    const m = /^\d?>>?(.*)$/.exec(w);
    if (m) targets.push(m[1] || words[i + 1]);
  });
  for (const t of targets) {
    const why = protectedReason(t, projectDir);
    if (why) return why;
  }
  return null;
}

/**
 * Decide se a chamada de ferramenta deve ser bloqueada.
 * @returns {string|null} motivo do bloqueio, ou null para seguir.
 */
export function check(input, { currentBranch = null, projectDir = process.cwd(), depth = 0 } = {}) {
  const tool = input?.tool_name;
  const ti = input?.tool_input ?? {};
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const why = protectedReason(ti.file_path ?? ti.notebook_path, projectDir);
    return why ? `Arquivo protegido: ${why}` : null;
  }
  if (tool !== 'Bash' || typeof ti.command !== 'string') return null;
  for (const raw of splitCommands(ti.command)) {
    const words = program(raw);
    if (!words.length) continue;
    const [cmd, ...args] = words;
    const name = path.basename(cmd);
    let why = null;
    if (name === 'git') why = checkGit(args, currentBranch);
    else if (name === 'supabase' || (['npx', 'bunx'].includes(name) && /^supabase(@|$)/.test(args[0] ?? ''))) {
      why = checkSupabase(name === 'supabase' ? args : args.slice(1));
    } else if (['bash', 'sh', 'zsh'].includes(name) && args[0] === '-c' && typeof args[1] === 'string' && depth < 3) {
      why = check({ tool_name: 'Bash', tool_input: { command: args[1] } }, { currentBranch, projectDir, depth: depth + 1 });
    } else why = checkShellWrite(words, projectDir);
    if (why) return why;
  }
  return null;
}

function currentBranchOf(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || null;
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    process.exit(0); // Entrada inesperada: não trava o agente.
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const why = check(input, { currentBranch: currentBranchOf(input.cwd || projectDir), projectDir });
  if (why) {
    process.stderr.write(`BLOQUEADO pelos guardrails do LevelUp (.claude/hooks/guardrails.mjs): ${why}\n`);
    process.exit(2);
  }
  process.exit(0);
}
