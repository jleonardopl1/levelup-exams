import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check, splitCommands } from './guardrails.mjs';

const ROOT = '/repo';
const bash = (command, branch = 'claude/feature') =>
  check({ tool_name: 'Bash', tool_input: { command } }, { currentBranch: branch, projectDir: ROOT });
const edit = (file_path, tool_name = 'Edit') => check({ tool_name, tool_input: { file_path } }, { projectDir: ROOT });

describe('splitCommands', () => {
  it('separa por operadores fora de aspas', () => {
    assert.deepEqual(splitCommands('git add . && git commit -m "a; b && c" | cat'), [
      ['git', 'add', '.'], ['git', 'commit', '-m', 'a; b && c'], ['cat'],
    ]);
  });

  it('ignora o corpo de heredoc', () => {
    const cmd = "cat > notes.md <<'EOF'\ngit push --force origin main\nEOF\necho fim";
    assert.deepEqual(splitCommands(cmd), [['cat', '>', 'notes.md'], ['echo', 'fim']]);
  });

  it('mensagem de commit com heredoc dentro de aspas', () => {
    const cmd = 'git commit -m "$(cat <<\'EOF\'\nfeat: x\n\ngit push --force\nEOF\n)"';
    assert.equal(splitCommands(cmd).length, 1);
  });
});

describe('git', () => {
  it('permite o fluxo normal', () => {
    for (const c of [
      'git status',
      'git add -A && git commit -m "feat: algo"',
      'git push -u origin claude/feature',
      'git fetch origin claude/feature && git merge --no-edit FETCH_HEAD',
      'git restore --staged .',
      'git checkout -b nova-branch',
      'git branch -d antiga',
      'git log --oneline -5',
    ]) assert.equal(bash(c), null, c);
  });

  it('bloqueia force-push em todas as formas', () => {
    for (const c of [
      'git push --force origin claude/feature',
      'git push -f',
      'git push -uf origin x',
      'git push --force-with-lease',
      'git push origin +claude/feature',
      'git -C /repo push --force',
      'timeout 60 git push --force',
    ]) assert.match(bash(c) ?? '', /Force-push/, c);
  });

  it('bloqueia push e commit na main', () => {
    assert.match(bash('git push origin main') ?? '', /main/);
    assert.match(bash('git push origin HEAD:refs/heads/main') ?? '', /main/);
    assert.match(bash('git push', 'main') ?? '', /main/);
    assert.match(bash('git push origin HEAD', 'master') ?? '', /main/);
    assert.match(bash('git commit -m x', 'main') ?? '', /main/);
    assert.equal(bash('git push origin HEAD'), null);
  });

  it('bloqueia operações destrutivas', () => {
    assert.ok(bash('git reset --hard origin/main'));
    assert.ok(bash('git clean -fd'));
    assert.ok(bash('git branch -D feature'));
    assert.ok(bash('git branch --delete --force feature'));
    assert.ok(bash('git checkout -- .'));
    assert.ok(bash('git restore .'));
    assert.ok(bash('git filter-branch --tree-filter x'));
    assert.ok(bash('git push origin --delete feature'));
    assert.ok(bash('git push origin :feature'));
    assert.ok(bash('git commit --no-verify -m x'));
  });

  it('texto em aspas e heredoc não dispara', () => {
    assert.equal(bash('echo "nunca use git push --force"'), null);
    assert.equal(bash("cat <<'EOF'\ngit reset --hard\nEOF"), null);
  });

  it('olha dentro de bash -c', () => {
    assert.ok(bash('bash -c "git push --force"'));
  });
});

describe('supabase', () => {
  it('bloqueia o que mexe em produção', () => {
    for (const c of [
      'supabase db push',
      'npx supabase db push --linked',
      'bunx supabase@latest functions deploy ai-mentor',
      'supabase secrets set FOO=bar',
      'supabase db reset --linked',
      'supabase migration repair --status applied 20261116120000',
    ]) assert.match(bash(c) ?? '', /dono|remoto|agente/, c);
  });

  it('permite o que é local', () => {
    assert.equal(bash('supabase db reset'), null);
    assert.equal(bash('supabase start'), null);
    assert.equal(bash('supabase functions serve'), null);
  });
});

describe('arquivos protegidos', () => {
  it('bloqueia edição', () => {
    assert.ok(edit('/repo/.env'));
    assert.ok(edit('.lovable/plan.md', 'Write'));
    assert.ok(edit('/repo/src/integrations/supabase/types.ts'));
    assert.ok(edit('/repo/supabase/functions/auth-email-hook/index.ts', 'MultiEdit'));
  });

  it('permite o resto', () => {
    assert.equal(edit('/repo/.env.example'), null);
    assert.equal(edit('/repo/src/pages/Quiz.tsx'), null);
    assert.equal(edit('/outro/.env'), null);
  });

  it('bloqueia escrita pelo shell', () => {
    assert.ok(bash('echo X=1 >> .env'));
    assert.ok(bash('echo X=1 >.env'));
    assert.ok(bash("sed -i 's/a/b/' src/integrations/supabase/types.ts"));
    assert.ok(bash('rm -rf .lovable'));
    assert.equal(bash('cat .env.example > /tmp/x'), null);
    assert.equal(bash('ls .lovable'), null);
  });
});

describe('executável (contrato do hook)', () => {
  const script = fileURLToPath(new URL('./guardrails.mjs', import.meta.url));
  const run = (input) => spawnSync(process.execPath, [script], { input: JSON.stringify(input), encoding: 'utf8' });

  it('bloqueia com código 2 e mensagem no stderr', () => {
    const r = run({ tool_name: 'Bash', tool_input: { command: 'git push --force' } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /BLOQUEADO/);
  });

  it('libera com código 0', () => {
    assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git status' } }).status, 0);
    assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '.env' } }).status, 0);
  });

  it('entrada inválida não trava o agente', () => {
    const r = spawnSync(process.execPath, [script], { input: 'não é json', encoding: 'utf8' });
    assert.equal(r.status, 0);
  });
});
