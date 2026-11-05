// Fixture tests for templates/scripts/lib/instructions.mjs (issue #130).
//
// The helper is the seam every instruction-reading lint now shares. The cases
// pin the properties a partial port fails silently on: an import is followed,
// a fenced @path is not, an unresolved target is reported, a cycle terminates,
// and a CLAUDE.md-only repo still reads exactly as it did before the flip.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { resolveInstructions } from '../scripts/lib/instructions.mjs';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-instructions-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

const RECORDS = '## Records files — never `cp` over these\n\n`docs/code-conventions.md`\n';

test('instructions: a one-line @AGENTS.md CLAUDE.md resolves to AGENTS.md once', () => {
  const dir = fixture({
    'CLAUDE.md': '@AGENTS.md\n',
    'AGENTS.md': `# Repo\n\n${RECORDS}`,
  });
  const { text, files, unresolved } = resolveInstructions(dir);
  assert.match(text, /Records files/);
  assert.equal(text.split('Records files').length - 1, 1, 'AGENTS.md text must not be duplicated');
  assert.deepEqual(files.map((f) => f.relative), ['AGENTS.md', 'CLAUDE.md']);
  assert.deepEqual(unresolved, []);
});

test('instructions: a CLAUDE.md-only repo reads exactly as before', () => {
  const dir = fixture({ 'CLAUDE.md': `# Repo\n\n${RECORDS}` });
  const { text, files, unresolved } = resolveInstructions(dir);
  assert.match(text, /# Repo/);
  assert.match(text, /docs\/code-conventions\.md/);
  assert.deepEqual(files.map((f) => f.relative), ['CLAUDE.md']);
  assert.deepEqual(unresolved, []);
});

test('instructions: an unresolved import is reported, never silently dropped', () => {
  const dir = fixture({ 'CLAUDE.md': '@DOES-NOT-EXIST.md\n' });
  const { text, unresolved } = resolveInstructions(dir);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].target, 'DOES-NOT-EXIST.md');
  assert.equal(unresolved[0].reason, 'not-found');
  assert.match(text, /@DOES-NOT-EXIST\.md/, 'the unresolved line stays in the text');
});

test('instructions: a fenced @path is not an import', () => {
  const dir = fixture({
    'CLAUDE.md': '# Repo\n\n```\n@DOES-NOT-EXIST.md\n```\n\nAfter the fence.\n',
  });
  const { text, unresolved } = resolveInstructions(dir);
  assert.deepEqual(unresolved, []);
  assert.match(text, /@DOES-NOT-EXIST\.md/);
  assert.match(text, /After the fence\./);
});

test('instructions: an import cycle terminates and reads each file once', () => {
  const dir = fixture({
    'AGENTS.md': '# A\n@CLAUDE.md\n',
    'CLAUDE.md': '# C\n@AGENTS.md\n',
  });
  const { text, files, unresolved } = resolveInstructions(dir);
  assert.equal(files.length, 2);
  assert.deepEqual(unresolved, []);
  assert.equal(text.split('# A').length - 1, 1);
  assert.equal(text.split('# C').length - 1, 1);
});

test('instructions: a shorter fence of the same character inside a longer fence is content, not a close', () => {
  // The counterexample: with a boolean toggle, the ``` line closes the ````
  // block, the rest is treated as code, and the live @import below it is silently
  // dropped. That undercounts the budget and hides a missing target.
  const dir = fixture({
    'AGENTS.md': '# Repo\n\n````markdown\n```\nexample\n````\n\n@docs/large.md\n',
    'docs/large.md': 'b'.repeat(33000),
  });
  const { text, unresolved } = resolveInstructions(dir);
  assert.match(text, /b{100}/, 'the import after the fence must be followed');
  assert.deepEqual(unresolved, []);
});

test('instructions: a chain deeper than five hops reports the target as unresolved', () => {
  const files = { 'AGENTS.md': '@l1.md\n', 'l1.md': '@l2.md\n', 'l2.md': '@l3.md\n', 'l3.md': '@l4.md\n', 'l4.md': '@l5.md\n', 'l5.md': '@l6.md\n' };
  const dir = fixture(files);
  const { unresolved } = resolveInstructions(dir);
  // AGENTS(0) -> l1(1) -> l2(2) -> l3(3) -> l4(4) -> l5(5); l5's import is at the limit.
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].target, 'l6.md');
  assert.equal(unresolved[0].reason, 'depth-limit');
});

test('instructions: the installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/lib/instructions.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/lib/instructions.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/lib/ and templates/scripts/lib/ copies drifted — re-sync and re-stamp');
});


// ---------------------------------------- check-claim-coverage reads the resolved text
//
// The port moved this source onto the reader; a CLAUDE-only fixture would pass
// even if the import were ignored, so this one puts the normative bullets in
// AGENTS.md behind a one-line import.

function runCoverage(cwd) {
  try {
    const out = execFileSync('node', [resolve(REPO, 'scripts/check-claim-coverage.mjs'), '--json'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

test('claim-coverage: claims in AGENTS.md are read through the one-line CLAUDE.md import', () => {
  const dir = fixture({
    'AGENTS.md': '# Repo\n\n- Every change must bump the version stamp\n',
    'CLAUDE.md': '@AGENTS.md\n',
    'docs/definition-of-done.md': '# DoD\n\n- Every PR must update the changelog\n',
    'docs/code-conventions.md':
      '# Conventions\n\n## 1. Enforced conventions\n\n| # | Convention | ADR | Enforcement (rule or script) | Gate or report | Since |\n|---|---|---|---|---|---|\n| 1 | Never commit secrets | — | `scripts/check-secrets.mjs` | gate | 2026-01-01 |\n\n## 2. Documented conventions\n\n- Templates are always kebab-case\n',
    'scripts/check-secrets.mjs': '// fixture gate\n',
  });
  const { code, out } = runCoverage(dir);
  assert.equal(code, 0, out);
  const inv = JSON.parse(out);
  assert.equal(inv.artifacts.length, 3);
  assert.ok(inv.claims >= 4, `expected the AGENTS.md claim in the count: ${out}`);
});
