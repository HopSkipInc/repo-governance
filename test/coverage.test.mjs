// Fixture tests for scripts/check-claim-coverage.mjs (repo-governance's own tool).
//
// The property that matters most is the fail-closed one (the routing sweep's
// binding constraint): a missing or unparseable source yields SKIPPED, never a
// partial score. The rest pin the derivation rule — what counts as a claim, and
// what counts as a gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LINT = resolve(REPO, 'scripts/check-claim-coverage.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-coverage-'));
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

const CONVENTIONS = `# Code Conventions

## 1. Enforced conventions

| # | Convention | ADR | Enforcement (rule or script) | Gate or report | Since |
|---|---|---|---|---|---|
| 1 | Every template carries a version stamp | — | \`scripts/check-versions.mjs\` | gate | 2026-01-01 |
| 2 | A changed template must bump its stamp | — | \`scripts/check-versions.mjs\` R3 | gate | 2026-01-01 |

## 2. Documented conventions

- Lint scripts always open with the incident that caused them
- Templates are kebab-case

## 3. Not codified
`;

const DOD = `# Definition of Done

## Migration
- A migration that drops a column must have zero remaining references
- Every migration runs in the CI harness

## Feature
- Write the test first
`;

const CLAUDE = `# Repo

## Working on templates
1. Every change must bump the version stamp
2. A new template is never shipped without a matrix row

## Gotchas
- Fun fact about regexes
`;

const GATE = { 'scripts/check-versions.mjs': '#!/usr/bin/env node\n// lint\n' };

test('coverage: a fully-populated tree scores and names the instruction-only claims', () => {
  const dir = fixture({
    ...GATE,
    'docs/definition-of-done.md': DOD,
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': CONVENTIONS,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /3 artifacts scanned/);
  // 7 claims: 2 §1 + 2 §2 + 1 DoD (only one bullet carries a normative keyword) + 2 CLAUDE.md;
  // 2 gate-backed (the §1 rows name a resolving .mjs path); instruction-only are named.
  assert.match(out, /Claim coverage: 2\/7 \(29%\)/);
  assert.match(out, /Told, not enforced/);
  assert.match(out, /kebab-case/); // a §2 instruction-only claim named in the output
  assert.match(out, /the neither class is the audit/);
});

test('coverage: §1 rows name their gate through the Enforcement cell', () => {
  const dir = fixture({
    ...GATE,
    'docs/definition-of-done.md': DOD,
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': CONVENTIONS,
  });
  const { out } = run(dir, ['--json']);
  const inv = JSON.parse(out);
  const both = inv.both;
  assert.equal(both, 2, `expected exactly the 2 §1 rows gate-backed: ${out}`);
});

test('coverage: a claim naming a gate path that does not exist is told-not-enforced', () => {
  const dir = fixture({
    // GATE intentionally absent — scripts/check-versions.mjs never written
    'docs/definition-of-done.md': DOD,
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': CONVENTIONS,
  });
  const { out } = run(dir, ['--json']);
  const inv = JSON.parse(out);
  assert.equal(inv.both, 0);
  assert.equal(inv.instructionOnly.length, 7);
});

test('coverage: a backticked doc is not a gate — enforcement-shaped paths only', () => {
  const dir = fixture({
    'docs/definition-of-done.md': '# DoD\n\n## Rules\n- Every ADR must be registered in `docs/adr/README.md`\n',
    'docs/adr/README.md': '# index\n',
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': CONVENTIONS,
    ...GATE,
  });
  const { out } = run(dir, ['--json']);
  const inv = JSON.parse(out);
  // the DoD claim names a .md — not enforcement-shaped → instruction-only
  const dodClaims = inv.instructionOnly.filter((c) => c.source === 'docs/definition-of-done.md');
  assert.equal(dodClaims.length, 1, out);
});

test('coverage: a missing source artifact reports SKIPPED — never a partial score', () => {
  const dir = fixture({
    // no docs/definition-of-done.md
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': CONVENTIONS,
    ...GATE,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED — docs\/definition-of-done\.md \(source artifact absent\)/);
  assert.doesNotMatch(out, /Claim coverage:/);
});

test('coverage: a source yielding zero claims is unparseable → SKIPPED', () => {
  const dir = fixture({
    'docs/definition-of-done.md': '# DoD\n\nAll prose, no bullets, nothing normative here.\n',
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': CONVENTIONS,
    ...GATE,
  });
  const { out } = run(dir);
  assert.match(out, /SKIPPED/);
  assert.match(out, /zero normative bullets/);
  assert.doesNotMatch(out, /Claim coverage:/);
});

test('coverage: code-conventions.md without §1/§2 headings is unparseable → SKIPPED', () => {
  const dir = fixture({
    'docs/definition-of-done.md': DOD,
    'CLAUDE.md': CLAUDE,
    'docs/code-conventions.md': '# Conventions\n\n## Rules\n- Everything must be great\n',
    ...GATE,
  });
  const { out } = run(dir);
  assert.match(out, /SKIPPED/);
  assert.match(out, /§1 or §2 heading absent/);
  assert.doesNotMatch(out, /Claim coverage:/);
});
