// Fixture tests for scripts/check-downstream-drift.mjs (repo-governance's own lint).
//
// Same rule as lints.test.mjs and lens.test.mjs: fire on a known-bad input, clear
// on a known-good one. The fixtures are a throwaway repo tree per case — the
// script resolves everything from `git rev-parse --show-toplevel`, so a git-init'd
// tmpdir with templates/, downstream/<client>/_client.md, and fake client
// checkouts at absolute paths exercises the real resolution paths, including both
// declared-path dialects live in the field (repo-relative and template-relative).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const DRIFT = resolve(REPO, 'scripts/check-downstream-drift.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-drift-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd, env = {}) {
  try {
    const out = execFileSync('node', [DRIFT], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// ------------------------------------------------------------- fixture pieces

const mdStamp = (name, v) => `<!-- template: ${name} v${v} · updated 2026-08-02 -->\n# ${name}\n`;
const fm = (v) => `---\nname: fixture\nversion: ${v}\nupdated: 2026-08-02\n---\n`;

/** A minimal templates/ tree: everything the fixture declarations resolve against. */
const templateTree = {
  'templates/agent-routing.md': mdStamp('agent-routing.md', '2.0.0'),
  'templates/skills/routing-triage/SKILL.md': fm('2.0.0'),
  'templates/agents/routing-classifier.opencode.md': fm('2.0.0'),
  'templates/governance-sync-claude-section.md': mdStamp('governance-sync-claude-section.md', '2.0.0'),
};

/** The ledger needs the fixture's absolute path, so it is written after fixture(). */
function addLedger(dir, rows) {
  mkdirSync(join(dir, 'downstream/acme'), { recursive: true });
  writeFileSync(
    join(dir, 'downstream/acme/_client.md'),
    '# Client\n\n| Repo | Local path | Notes |\n|---|---|---|\n' +
      rows.map(([repo, path]) => `| ${repo} | \`${path}\` | — |`).join('\n') + '\n'
  );
}

/** A client CLAUDE.md whose Synced templates table carries the given rows. */
const claudeMd = (rows) =>
  '# Client repo\n\n### Synced templates\n\n| Template | Installed version | Synced on |\n|---|---|---|\n' +
  rows.map(([p, v]) => `| ${p} | ${v} | 2026-08-02 |`).join('\n') + '\n';

/** Fixture with one governed repo whose CLAUDE.md declares `rows`; `extra` adds files. */
function repoFixture(rows, extra = {}) {
  const dir = fixture({
    ...templateTree,
    'clones/repo-a/CLAUDE.md': claudeMd(rows),
    ...extra,
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  return dir;
}

// ------------------------------------------------------------------- dialects

test('drift: repo-relative dialect resolves and a fully synced repo clears', () => {
  const dir = repoFixture(
    [['`docs/agent-routing.md`', 'v2.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '2.0.0') }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: template-relative dialects resolve to their install locations', () => {
  const dir = repoFixture(
    [
      ['agent-routing.md', '2.0.0'], // bare name -> docs/
      ['routing-triage/SKILL.md', '2.0.0'], // bare subpath -> .claude/skills/
    ],
    {
      'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '2.0.0'),
      'clones/repo-a/.claude/skills/routing-triage/SKILL.md': fm('2.0.0'),
    }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: parenthetical annotations and the opencode global install resolve', () => {
  const dir = repoFixture([['routing-classifier.opencode.md (opencode)', '2.0.0']]);
  // Mirrors the real install (~/.config/opencode/agents/) — the path must carry
  // '/agents/' because the script's frontmatter heuristic keys on it.
  const agentsDir = join(dir, 'opencode/agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, 'routing-classifier.md'), fm('2.0.0'));
  const { code, out } = run(dir, { OPENCODE_AGENTS_DIR: agentsDir });
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

// ------------------------------------------------------------------ findings

test('drift: true MISMATCH fires when the installed stamp disagrees with the declaration', () => {
  const dir = repoFixture(
    [['agent-routing.md', '2.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '1.0.0') }
  );
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /stamps v1\.0\.0/);
});

test('drift: MISMATCH fires when nothing resolves under either dialect', () => {
  const dir = repoFixture([['agent-routing.md', '2.0.0']]);
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /no file resolves under either declaration dialect/);
});

test('drift: NOSTAMP fires on an unstamped declared file and blocks', () => {
  const dir = repoFixture(
    [['agent-routing.md', '2.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': '# Agent Routing\n\nNo stamp anywhere.\n' }
  );
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOSTAMP/);
  assert.match(out, /carries no readable version stamp/);
});

test('drift: a section-installed template can only report NOSTAMP — a section carries no stamp', () => {
  const dir = repoFixture([['governance-sync-claude-section.md', '2.0.0']]);
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOSTAMP/);
  assert.match(out, /installed as a CLAUDE\.md section/);
  assert.doesNotMatch(out, /^MISMATCH \(/m);
});

test('drift: BEHIND reports but does not block', () => {
  const dir = repoFixture(
    [['agent-routing.md', '1.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '1.0.0') }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /BEHIND/);
  assert.match(out, /template is v2\.0\.0/);
});

test('drift: UNDECLARED fires on governance artifacts with no Synced templates table', () => {
  const dir = fixture({
    ...templateTree,
    'clones/repo-a/CLAUDE.md': '# Client repo with no declaration section\n',
    'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '2.0.0'),
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /UNDECLARED/);
});

test('drift: SKIPPED — never OK — when no governed repo is reachable', () => {
  const dir = fixture({
    ...templateTree,
    'downstream/acme/_client.md':
      '# Client\n\n| Repo | Local path | Notes |\n|---|---|---|\n| acme/repo-a | `/nonexistent/path/repo-a` | — |\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /^OK:/m);
});
