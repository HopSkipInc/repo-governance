// Fixture tests for scripts/check-mothership-drift.mjs (repo-governance's own lint).
//
// Same rule as the other lint fixtures: fire on a known-bad input, clear on a
// known-good one. The cases pin the register rule the issue's tier rests on — a
// collision absent from the register is REPORTED, never silently skipped, and an
// exemption without a reason fails closed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LINT = resolve(REPO, 'scripts/check-mothership-drift.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-mothership-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd) {
  try {
    const out = execFileSync('node', [LINT], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** A register file with the given pair rows and exemption rows. */
const register = (pairRows = [], exemptionRows = []) =>
  '# Mothership drift register\n\n## Registered pairs (byte-identical required)\n\n' +
  '| docs/ path | templates/ path | Since | Note |\n|---|---|---|---|\n' +
  pairRows.map((r) => `| ${r.join(' | ')} |`).join('\n') +
  '\n\n## Exemptions (never compared, reason required)\n\n' +
  '| docs/ path or prefix | Reason |\n|---|---|\n' +
  exemptionRows.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n';

const PAIR = ['`docs/agent-routing.md`', '`templates/agent-routing.md`', '2026-08-02', 'synced pair'];
const EXEMPT = ['`docs/code-conventions.md`', 'records file — never cp over these'];

test('mothership: a synced registered pair clears', () => {
  const dir = fixture({
    'docs/mothership-drift-register.md': register([PAIR], [EXEMPT]),
    'docs/agent-routing.md': '# Agent Routing\n\nidentical bytes\n',
    'templates/agent-routing.md': '# Agent Routing\n\nidentical bytes\n',
    'docs/code-conventions.md': '# Records — deliberately different from the form\n',
    'templates/code-conventions.md': '# Blank form\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
  assert.match(out, /1 registered pair/);
});

test('mothership: STALE fires on a drifted registered pair, naming both paths and the authoritative side', () => {
  const dir = fixture({
    'docs/mothership-drift-register.md': register([PAIR], [EXEMPT]),
    'docs/agent-routing.md': '# Agent Routing v1.9.0 — stale\n',
    'templates/agent-routing.md': '# Agent Routing v1.10.0\n',
    'docs/code-conventions.md': '# Records\n',
    'templates/code-conventions.md': '# Blank form\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /STALE/);
  assert.match(out, /docs\/agent-routing\.md/);
  assert.match(out, /templates\/agent-routing\.md/);
  assert.match(out, /templates\/ side is authoritative/);
  assert.doesNotMatch(out, /\bcp\b/); // the remedy is never "cp"
});

test('mothership: STALE fires when a registered docs copy is missing', () => {
  const dir = fixture({
    'docs/mothership-drift-register.md': register([PAIR], [EXEMPT]),
    'templates/agent-routing.md': '# Agent Routing\n',
    'docs/code-conventions.md': '# Records\n',
    'templates/code-conventions.md': '# Blank form\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /STALE/);
  assert.match(out, /does not exist/);
});

test('mothership: an unregistered collision is REPORTED, never silently skipped', () => {
  const dir = fixture({
    'docs/mothership-drift-register.md': register([PAIR], [EXEMPT]),
    'docs/agent-routing.md': '# synced\n',
    'templates/agent-routing.md': '# synced\n',
    'docs/code-conventions.md': '# Records\n',
    'templates/code-conventions.md': '# Blank form\n',
    'docs/issue-authoring.md': '# local copy\n',
    'templates/issue-authoring.md': '# template\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /UNREGISTERED/);
  assert.match(out, /issue-authoring\.md/);
  assert.match(out, /register it as a synced pair or exempt it with a reason/);
});

test('mothership: a registered exemption stays silent even when the files differ wildly', () => {
  const dir = fixture({
    'docs/mothership-drift-register.md': register([PAIR], [EXEMPT, ['`docs/pdr/`', 'the corpus is records — the shape syncs, the records never do']]),
    'docs/agent-routing.md': '# synced\n',
    'templates/agent-routing.md': '# synced\n',
    'docs/code-conventions.md': '# Records — totally different content\n'.repeat(50),
    'templates/code-conventions.md': '# Blank form\n',
    'docs/pdr/001-some-decision.md': '# PDR-001 — a real record\n',
    'templates/pdr/001-some-decision.md': '# should never collide, but the prefix exempts it\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
  assert.doesNotMatch(out, /code-conventions\.md exists under both/);
});

test('mothership: an exemption without a reason fails closed — a reasonless exemption is a suppression', () => {
  const dir = fixture({
    'docs/mothership-drift-register.md': register([PAIR], [['`docs/code-conventions.md`', '']]),
    'docs/agent-routing.md': '# synced\n',
    'templates/agent-routing.md': '# synced\n',
    'docs/code-conventions.md': '# Records\n',
    'templates/code-conventions.md': '# Blank form\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /ERROR/);
  assert.match(out, /no reason/);
});

test('mothership: a missing register fails closed, never passes', () => {
  const dir = fixture({
    'docs/agent-routing.md': '# anything\n',
    'templates/agent-routing.md': '# anything\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /ERROR/);
  assert.match(out, /register not found/);
  assert.doesNotMatch(out, /^OK:/m);
});
