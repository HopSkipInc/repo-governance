// Fixture tests for templates/scripts/check-instructions-budget.mjs (issue #130).
//
// Every failure class fires on a known-bad tree and clears on a known-good one;
// the import case is the one a partial port fails silently on, because a reader
// that stops at CLAUDE.md measures the pointer instead of the text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LINT = resolve(REPO, 'templates/scripts/check-instructions-budget.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-budget-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd, args = []) {
  try {
    const out = execFileSync('node', [LINT, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

test('budget: a within-budget repo clears and prints per-file and total bytes', () => {
  const dir = fixture({ 'AGENTS.md': 'a'.repeat(1000) });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /1000 bytes  AGENTS\.md/);
  assert.match(out, /total \(budget 32000\)/);
  assert.match(out, /OK:/);
});

test('budget: an over-budget AGENTS.md fails', () => {
  const dir = fixture({ 'AGENTS.md': 'a'.repeat(32001) });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /OVER-BUDGET/);
  assert.match(out, /exceeds the 32000-byte budget/);
});

test('budget: a small CLAUDE.md importing an over-budget AGENTS.md fails', () => {
  const dir = fixture({
    'AGENTS.md': 'a'.repeat(32001),
    'CLAUDE.md': '@AGENTS.md\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /OVER-BUDGET/);
});

test('budget: an import of a third file is followed into the total', () => {
  // This is the partial-port case: a reader that stops at the top-level files
  // measures 10 bytes and reports OK while the harness loads 33 KB.
  const dir = fixture({
    'AGENTS.md': 'a'.repeat(10),
    'CLAUDE.md': '@docs/large.md\n',
    'docs/large.md': 'b'.repeat(33000),
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /33000 bytes  docs\/large\.md/);
  assert.match(out, /3\d{4} bytes  total/);
  assert.match(out, /OVER-BUDGET/);
});

test('budget: an unresolved import fails, never silently undercounts', () => {
  const dir = fixture({ 'AGENTS.md': '# Repo\n\n@docs/missing.md\n' });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /UNRESOLVED/);
  assert.match(out, /docs\/missing\.md/);
});

test('budget: a CLAUDE.md with no AGENTS.md beside it fails', () => {
  const dir = fixture({ 'CLAUDE.md': '# Repo\n' });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NO-CANONICAL/);
  assert.match(out, /AGENTS\.md does not/);
});

test('budget: neither file reports SKIPPED, never a pass', () => {
  const dir = fixture({ 'README.md': '# Repo\n' });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /^OK:/m);
});

test('budget: --budget overrides the default', () => {
  const dir = fixture({ 'AGENTS.md': 'a'.repeat(2000) });
  const failing = run(dir, ['--budget', '1000']);
  assert.equal(failing.code, 1, failing.out);
  assert.match(failing.out, /1000-byte budget/);

  const passing = run(dir, ['--budget', '5000']);
  assert.equal(passing.code, 0, passing.out);
  assert.match(passing.out, /within the 5000-byte budget/);
});

test('budget: a malformed --budget fails closed', () => {
  const dir = fixture({ 'AGENTS.md': '# Repo\n' });
  const { code, out } = run(dir, ['--budget', 'lots']);
  assert.equal(code, 1, out);
  assert.match(out, /ERROR/);
});
