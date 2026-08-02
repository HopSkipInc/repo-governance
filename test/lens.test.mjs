// Fixture tests for the Design Lenses pair:
//   templates/scripts/check-design-lens.mjs  (ships to governed repos)
//   scripts/check-lens-promotion.mjs         (repo-governance's own sweep)
//
// Same rule as lints.test.mjs: fire on a known-bad input, clear on a known-good
// one. The design-lens cases deliberately include the real ADR-062 line shape
// (bare basename in `checked:`, wrapped across lines) — the falsifier lint
// taught this repo that a rule never run against the real corpus gates on the
// wrong thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LENS_LINT = resolve(REPO, 'templates/scripts/check-design-lens.mjs');
const PROMOTION = resolve(REPO, 'scripts/check-lens-promotion.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-lens-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(script, cwd, env = {}) {
  try {
    const out = execFileSync('node', [script], {
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

const adr = (lens) => `# ADR-001: A decision\n\n**Status:** Proposed\n${lens}\n\n## Context\n\nWords.\n`;

// ------------------------------------------------------------ check-design-lens

test('design-lens: a valid line with a real checked path passes', () => {
  const dir = fixture({
    'src/thing.ts': 'export const x = 1;\n',
    'docs/adr/001-a.md': adr(
      '**Lens:** measurement trustworthiness → sampling theory · predicted: production behaviour exists the harness cannot represent · checked: src/thing.ts · result: not found'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('design-lens: the real ADR-062 shape passes — wrapped line, bare basename, confirmed with issue ref', () => {
  const dir = fixture({
    'host/src/evals/fixture-tool-invoker.ts': 'export const invoke = () => ({ ok: true });\n',
    'docs/adr/062-a.md': adr(
      '**Lens:** measurement trustworthiness → sampling theory · predicted: production behaviour exists\nthat the eval harness cannot represent · checked: fixture-tool-invoker.ts, eval case schema ·\nresult: confirmed — tool failures inexpressible, filed #1486'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /WARN/);
});

test('design-lens: R1 fires on an ADR with no Lens line', () => {
  const dir = fixture({ 'docs/adr/001-a.md': adr('') });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
  assert.match(out, /001-a\.md/);
});

test('design-lens: R1 respects the grandfather list', () => {
  const dir = fixture({ 'docs/adr/001-a.md': adr('') });
  const { code, out } = run(LENS_LINT, dir, { DESIGN_LENS_GRANDFATHER: '001-a.md' });
  assert.equal(code, 0, out);
});

test('design-lens: R2 fires on a claim class the table does not know', () => {
  const dir = fixture({
    'docs/adr/001-a.md': adr(
      '**Lens:** vibes → astrology · predicted: mercury is in retrograde · checked: the sky · result: not found'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
});

test('design-lens: R2 clears when the records file declares the extension', () => {
  const dir = fixture({
    'src/queue.ts': 'export const q = [];\n',
    'docs/design-lenses-records.md':
      '# Records\n\n## 3. Local extensions\n\n| Claim class | Discipline | Core questions | Origin | Evidence |\n|---|---|---|---|---|\n| queueing pressure | queueing theory | Little\'s law? | residuals | three forced fits, 2026-08 |\n\n## 4. Notes\n',
    'docs/adr/001-a.md': adr(
      '**Lens:** queueing pressure → queueing theory · predicted: the worker pool saturates before the queue alarm fires · checked: src/queue.ts · result: not found'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 0, out);
  assert.match(out, /1 local extension/);
});

test('design-lens: R3 fires on a checked path that does not exist', () => {
  const dir = fixture({
    'docs/adr/001-a.md': adr(
      '**Lens:** measurement trustworthiness → sampling theory · predicted: something checkable · checked: src/missing.ts · result: not found'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
  assert.match(out, /src\/missing\.ts/);
});

test('design-lens: `none` needs a reason; with one it passes', () => {
  const bad = fixture({ 'docs/adr/001-a.md': adr('**Lens:** none') });
  const badRes = run(LENS_LINT, bad);
  assert.equal(badRes.code, 1, badRes.out);
  assert.match(badRes.out, /R2/);

  const good = fixture({
    'docs/adr/001-a.md': adr('**Lens:** none — internal naming convention, no external claim'),
  });
  const goodRes = run(LENS_LINT, good);
  assert.equal(goodRes.code, 0, goodRes.out);
});

test('design-lens: R4 fires when the result segment is missing', () => {
  const dir = fixture({
    'src/thing.ts': 'x\n',
    'docs/adr/001-a.md': adr(
      '**Lens:** measurement trustworthiness → sampling theory · predicted: something checkable · checked: src/thing.ts'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 1, out);
  assert.match(out, /R4/);
});

test('design-lens: R5 warns but does not gate on a consequence-free confirmation', () => {
  const dir = fixture({
    'src/thing.ts': 'x\n',
    'docs/adr/001-a.md': adr(
      '**Lens:** measurement trustworthiness → sampling theory · predicted: something checkable · checked: src/thing.ts · result: confirmed'
    ),
  });
  const { code, out } = run(LENS_LINT, dir);
  assert.equal(code, 0, out);
  assert.match(out, /WARN/);
  assert.match(out, /R5/);
});

test('design-lens: a repo with no docs/adr/ passes silently', () => {
  const { code, out } = run(LENS_LINT, fixture({ 'README.md': '# x\n' }));
  assert.equal(code, 0, out);
});

// --------------------------------------------------------- check-lens-promotion

/** Ledger row pointing a governed "repo" at an absolute path inside the fixture. */
const ledger = (rows) =>
  '# Client\n\n| Repo | Local path | Notes |\n|---|---|---|\n' +
  rows.map(([repo, path]) => `| ${repo} | \`${path}\` | — |`).join('\n') + '\n';

/** The ledger needs the fixture's absolute path, so it is written after fixture(). */
function addLedger(dir, rows) {
  mkdirSync(join(dir, 'downstream/acme'), { recursive: true });
  writeFileSync(join(dir, 'downstream/acme/_client.md'), ledger(rows));
}

const recordsWith = ({ extensions = [], logRows = [] } = {}) =>
  '# Records\n\n## 2. Lens log\n\n| Date | Artifact | Claim class | Fit | Lens | Prediction | Checked | Result | Outcome |\n|---|---|---|---|---|---|---|---|---|\n' +
  logRows.map((r) => `| ${r.join(' | ')} |`).join('\n') +
  '\n\n## 3. Local extensions\n\n| Claim class | Discipline | Core questions | Origin | Evidence |\n|---|---|---|---|---|\n' +
  extensions.map((r) => `| ${r.join(' | ')} |`).join('\n') + '\n';

test('lens-promotion: reports SKIPPED when no governed repo is reachable', () => {
  const dir = fixture({
    'downstream/acme/_client.md': ledger([['acme/repo-a', '/nonexistent/path/repo-a']]),
  });
  const { code, out } = run(PROMOTION, dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /OK:/);
});

test('lens-promotion: NO-RECORDS fires when the policy is installed without its records file', () => {
  const dir = fixture({ 'clones/repo-a/docs/design-lenses.md': '# policy\n' });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  const { code, out } = run(PROMOTION, dir);
  assert.equal(code, 0, out);
  assert.match(out, /NO-RECORDS/);
});

test('lens-promotion: PROMOTE fires when the same extension appears in two repos', () => {
  const dir = fixture({
    'clones/repo-a/docs/design-lenses.md': '# policy\n',
    'clones/repo-a/docs/design-lenses-records.md': recordsWith({
      extensions: [['queueing pressure', 'queueing theory', 'saturation?', 'residuals', 'three forced fits']],
    }),
    'clones/repo-b/docs/design-lenses.md': '# policy\n',
    'clones/repo-b/docs/design-lenses-records.md': recordsWith({
      extensions: [['Queueing pressure', 'queueing theory', 'backlog growth?', 'incident', 'outage 2026-07']],
    }),
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')], ['acme/repo-b', join(dir, 'clones/repo-b')]]);
  const { code, out } = run(PROMOTION, dir);
  assert.equal(code, 0, out);
  assert.match(out, /PROMOTE "queueing pressure"/);
  assert.match(out, /2 repos/);
});

test('lens-promotion: RESIDUALS fires at three forced fits, not before', () => {
  const forcedRow = (n) => [`2026-08-0${n}`, `ADR-00${n}`, 'nearest-ish', 'forced — spans two rows', 'x', 'y', 'z', 'Not found', '—'];
  const two = fixture({
    'clones/repo-a/docs/design-lenses.md': '# policy\n',
    'clones/repo-a/docs/design-lenses-records.md': recordsWith({ logRows: [forcedRow(1), forcedRow(2)] }),
  });
  addLedger(two, [['acme/repo-a', join(two, 'clones/repo-a')]]);
  assert.doesNotMatch(run(PROMOTION, two).out, /RESIDUALS/);

  const three = fixture({
    'clones/repo-a/docs/design-lenses.md': '# policy\n',
    'clones/repo-a/docs/design-lenses-records.md': recordsWith({ logRows: [forcedRow(1), forcedRow(2), forcedRow(3)] }),
  });
  addLedger(three, [['acme/repo-a', join(three, 'clones/repo-a')]]);
  const { code, out } = run(PROMOTION, three);
  assert.equal(code, 0, out);
  assert.match(out, /RESIDUALS/);
  assert.match(out, /3 forced fits/);
});

test('lens-promotion: a clean adopter reports OK', () => {
  const dir = fixture({
    'clones/repo-a/docs/design-lenses.md': '# policy\n',
    'clones/repo-a/docs/design-lenses-records.md': recordsWith(),
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  const { code, out } = run(PROMOTION, dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});
