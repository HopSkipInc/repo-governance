// Fixture tests for repo-governance's own lints.
//
// The coverage floor for this repo is not a percentage — it is a rule: every
// script in scripts/ fires on a known-bad input and clears on a known-good one.
// That rule exists because two lint bugs have already shipped here, and both
// were of the only kind that matters in a lint: a check that quietly stops
// checking. `check-template-versions` rule 3 compared dates instead of versions,
// so a same-day edit compared equal and the rule "was blind to the case it
// existed for". `check-issue-routing` used a `\Z` anchor, which JavaScript does
// not have, and reported every correctly-formatted issue as malformed.
//
// A passing lint and a broken lint produce identical CI output. These tests are
// the only thing that tells them apart.
//
// Run:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const script = (name) => resolve(REPO, 'scripts', name);

/** A throwaway git repo containing exactly the files a case needs. */
function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-fixture-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

/** Run a lint inside a fixture. Returns { code, out } — never throws on failure. */
function run(name, cwd, { env = {}, args = [] } = {}) {
  try {
    const out = execFileSync('node', [script(name), ...args], {
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

// --------------------------------------------------------- blank-form-naming

const STAMP = '<!-- template: x.md v1.0.0 · updated 2026-07-27 -->\n';

test('blank-form-naming: clean corpus passes', () => {
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n',
    'docs/adr/README.md': '# Index\n',
    'docs/adr/_template.md': '# Form\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('blank-form-naming: R1 fires on an unprefixed non-record file in a corpus', () => {
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n',
    'docs/adr/notes.md': '# Loose notes\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
  assert.match(out, /notes\.md/);
});

test('blank-form-naming: R1 structurally cannot see a form numbered like a record', () => {
  // The original incident. `000-template.md` matches the record pattern, so R1
  // classifies it as a record and skips it. R2 catches this one by name, and R3
  // catches the case where the name gives nothing away.
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n',
    'docs/adr/000-template.md': '# Form\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
  assert.doesNotMatch(out, /R1/);
});

test('blank-form-naming: R3 catches a form whose name gives nothing away', () => {
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n\nA real decision with no placeholders.\n',
    'docs/adr/000-blank.md': '# [TITLE]\n\n**Status:** [STATUS]\n**Date:** [YYYY-MM-DD]\n**Confirmed by:** [NAME]\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
  assert.match(out, /000-blank\.md/);
});

test('blank-form-naming: a date-prefixed directory is not a records corpus', () => {
  // `2026-07-07-thing.md` once read as record number 2026, which made every
  // watch-item and downstream-prompt directory look like a corpus. R3 then fired
  // on a real watch item that documented `<path>` placeholders in prose.
  const dir = fixture({
    'docs/watch-items/2026-07-07-thing.md': 'Run `cp <path> <dest>` for each <client> and <repo>.\n',
    'docs/watch-items/notes.md': '# Loose notes\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
});

test('blank-form-naming: R3 does not apply under templates/, where everything is a form', () => {
  const dir = fixture({
    'templates/adr/022-real-record.md': '# [TITLE]\n**Status:** [STATUS]\n**Date:** [YYYY-MM-DD]\n**By:** [NAME]\n',
    'templates/adr/_template.md': '# [TITLE]\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
});

test('blank-form-naming: R2 fires on a template-named file outside any corpus', () => {
  const dir = fixture({ 'docs/audit-template.md': '# Form\n' });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
});

test("blank-form-naming: GitHub's magic filenames are exempt", () => {
  const dir = fixture({
    '.github/pull_request_template.md': '# PR\n',
    'templates/pull_request_template.md': '# PR\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
});

// --------------------------------------- 2026-09-24: classifier pin drift
//
// ai-fleet #3097. §3's "every pin resolves to a frontier model" was a human
// re-sync step — the check that stops happening. This lint mechanizes it and
// fails closed, so a drifted pin cannot read as green. The fixtures prove both
// directions: fire on drift, clear on agreement.

const RECORDS_MAP = [
  '# Records',
  '',
  '## 1. Model → class',
  '',
  '| Class | Models | As of |',
  '|---|---|---|',
  '| standard | Sonnet | 2026-01-01 |',
  '| frontier | Opus | 2026-01-01 |',
  '',
  '## 2. Model → harness route',
  '',
  '| Model | Claude Code | opencode |',
  '|---|---|---|',
  '| Opus | `opus` | `oc/opus` |',
  '| Sonnet | `sonnet` | `oc/sonnet` |',
  '',
].join('\n');

const pinFile = (frontmatter) =>
  `---\nname: routing-classifier\n${frontmatter}\n---\n\n# Routing Classifier\n`;

test('classifier-pin-drift: a pin whose slug resolves into its declared class passes', () => {
  const dir = fixture({
    'docs/agent-routing-records.md': RECORDS_MAP,
    '.claude/agents/routing-classifier.md': pinFile('# routing-class: frontier\nmodel: opus'),
  });
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('classifier-pin-drift: a drifted pin (slug resolves outside its class) fails', () => {
  const dir = fixture({
    'docs/agent-routing-records.md': RECORDS_MAP,
    '.claude/agents/routing-classifier.md': pinFile('# routing-class: frontier\nmodel: sonnet'),
  });
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /DRIFT/);
});

test('classifier-pin-drift: a pin with no class marker fails closed', () => {
  const dir = fixture({
    'docs/agent-routing-records.md': RECORDS_MAP,
    '.claude/agents/routing-classifier.md': pinFile('model: opus'),
  });
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /routing-class/);
});

test('classifier-pin-drift: a declared class absent from §1 fails', () => {
  const dir = fixture({
    'docs/agent-routing-records.md': RECORDS_MAP,
    '.claude/agents/routing-classifier.md': pinFile('# routing-class: elite\nmodel: opus'),
  });
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /elite/);
});

test('classifier-pin-drift: a slug absent from §2 fails', () => {
  const dir = fixture({
    'docs/agent-routing-records.md': RECORDS_MAP,
    '.claude/agents/routing-classifier.md': pinFile('# routing-class: frontier\nmodel: gemini'),
  });
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /gemini/);
});

test('classifier-pin-drift: no pin prints SKIPPED, never OK', () => {
  const dir = fixture({});
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /OK:/);
});

test('classifier-pin-drift: a missing records map is an error, not a pass', () => {
  const dir = fixture({
    '.claude/agents/routing-classifier.md': pinFile('# routing-class: frontier\nmodel: opus'),
  });
  const { code, out } = run('check-classifier-pin-drift.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /not found|has not run/);
});

test('classifier-pin-drift: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/check-classifier-pin-drift.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/check-classifier-pin-drift.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});

// ------------------------------------------------------------ template-versions

test('template-versions: a stamped template with a matching path passes', () => {
  const dir = fixture({
    'templates/thing.md': '<!-- template: thing.md v1.0.0 · updated 2026-07-27 -->\n# Thing\n',
  });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 0, out);
});

test('template-versions: an unstamped template fails', () => {
  const dir = fixture({ 'templates/thing.md': '# Thing, no stamp\n' });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 1, out);
});

test("template-versions: a stamp naming another template's path fails", () => {
  const dir = fixture({
    'templates/copied.md': '<!-- template: original.md v1.0.0 · updated 2026-07-27 -->\n',
  });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /copied\.md|original\.md/);
});

test('template-versions: rule 3 survives a template deleted across the diff', () => {
  // 2026-08-09: the estate's first-ever template deletion crashed the lint with
  // ENOENT — `git show BASE:path` succeeds (the file existed at base) while the
  // working-tree read has nothing to read. A deletion needs no version bump;
  // rule 3 skips it and the /analyze-repo matrix accounts for the removal.
  const dir = fixture({
    'templates/keep.md': '<!-- template: keep.md v1.0.0 · updated 2026-08-07 -->\n# Keep\n',
    'templates/gone.md': '<!-- template: gone.md v1.0.0 · updated 2026-08-07 -->\n# Gone\n',
  });
  const git = (args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  git(['rm', '-q', 'templates/gone.md']);
  git(['commit', '-q', '-m', 'delete gone.md']);
  const { code, out } = run('check-template-versions.mjs', dir, { args: ['--base', base] });
  assert.equal(code, 0, out);
  // Prove rule 3 actually engaged — a pass in no-base mode would be a false green.
  assert.match(out, /changed in this diff was bumped/);
});

// ------------------------------------------------------- analyze-repo-coverage

/**
 * The lint's EXCLUSIONS list names three real templates by path, so a fixture
 * must contain them or they read as stale exclusions. That coupling is
 * deliberate — it is repo-governance's own lint, not a portable template — but
 * it has to be reproduced here or every case fails for the wrong reason.
 */
const EXCLUDED_TEMPLATES = {
  'templates/adr/022-definition-of-done.md': STAMP,
  'templates/routing-calibration-protocol.md': STAMP,
  'templates/agents/routing-classifier.md': STAMP,
};

test('analyze-repo-coverage: a template named in the matrix passes', () => {
  const dir = fixture({
    ...EXCLUDED_TEMPLATES,
    'templates/thing.md': STAMP,
    '.claude/commands/analyze-repo.md': '| `thing.md` | Always | P1 | because |\n',
  });
  const { code, out } = run('check-analyze-repo-coverage.mjs', dir);
  assert.equal(code, 0, out);
});

test('analyze-repo-coverage: a template missing from the matrix fails', () => {
  const dir = fixture({
    ...EXCLUDED_TEMPLATES,
    'templates/thing.md': STAMP,
    'templates/forgotten.md': STAMP,
    '.claude/commands/analyze-repo.md': '| `thing.md` | Always | P1 | because |\n',
  });
  const { code, out } = run('check-analyze-repo-coverage.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /forgotten\.md/);
});

// ------------------------------------------------------------- issue-routing

/**
 * `gh` is stubbed on PATH. It answers the paginated issue-list endpoint with
 * the case's pages and every other `api` call with `[]`, which short-circuits
 * R6 without needing GraphQL.
 *
 * The list stub *requires* `--paginate --slurp` and exits non-zero without
 * them. That is deliberate: returning every page regardless of flags would let
 * a regression that drops pagination pass this fixture, which is the exact
 * silent-partial-sweep defect the fixture exists to catch. Any other `api`
 * call (timeline, GraphQL) still gets `[]`.
 */
function ghPagesStub(dir, pages) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const payload = JSON.stringify(pages).replace(/'/g, `'\\''`);
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh\ncase "$1" in\n  api)\n    case "$2" in\n      *"/issues?state="*)\n        case " $* " in\n          *" --paginate "*) ;;\n          *) echo "stub: issue-list fetch is missing --paginate" >&2; exit 1 ;;\n        esac\n        case " $* " in\n          *" --slurp "*) printf '%s' '${payload}' ;;\n          *) echo "stub: issue-list fetch is missing --slurp" >&2; exit 1 ;;\n        esac ;;\n      *) printf '[]' ;;\n    esac ;;\n  *) printf '[]' ;;\nesac\n`
  );
  chmodSync(join(bin, 'gh'), 0o755);
  return { PATH: `${bin}:${process.env.PATH}`, ROUTING_REPO: 'fixture/repo' };
}

/** The common case: one page holding every issue. */
function ghStub(dir, issues) {
  return ghPagesStub(dir, [issues]);
}

const tierBody = (line) => `Some description.\n\n## Impl tier\n${line}\n`;

/**
 * `gh` stub for the R6 read path: paginated issue list, per-issue timeline, and
 * the GraphQL userContentEdits query. Every invocation is appended to
 * `gh-calls.log`, so a fixture can assert that an issue which cannot contain a
 * downgrade never spends a GraphQL call. `failures` maps an issue number to
 * 'timeline' or 'graphql' to exercise the SKIPPED path.
 */
function ghR6Stub(dir, issues, { timelines = {}, edits = {}, failures = {}, delayMs = 0 } = {}) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const log = join(dir, 'gh-calls.log');
  const state = JSON.stringify({ issues, timelines, edits, failures, delayMs, log });
  writeFileSync(
    join(bin, 'gh'),
    String.raw`#!/usr/bin/env node
const fs = require('fs');
const state = ${state};
const args = process.argv.slice(2);
fs.appendFileSync(state.log, args.join(' ') + '\n');
const fail = (m) => { process.stderr.write(m + '\n'); process.exit(1); };
if (args[0] === 'api' && args[1] === 'graphql') {
  let n = null;
  for (let i = 0; i < args.length - 1; i++) if (args[i] === '-F' && args[i + 1].indexOf('i=') === 0) n = args[i + 1].slice(2);
  if (n === null) fail('stub: graphql call without an issue number');
  if (state.failures[n] === 'graphql') fail('stub: forced graphql failure');
  const nodes = (state.edits[n] || []).map((editedAt) => ({ editedAt }));
  process.stdout.write(JSON.stringify({ data: { repository: { issue: { userContentEdits: { nodes } } } } }));
  process.exit(0);
}
if (args[0] === 'api') {
  const url = args[1] || '';
  if (url.indexOf('/issues?state=') !== -1) {
    if (args.indexOf('--paginate') === -1) fail('stub: issue-list fetch is missing --paginate');
    if (args.indexOf('--slurp') === -1) fail('stub: issue-list fetch is missing --slurp');
    process.stdout.write(JSON.stringify([state.issues]));
    process.exit(0);
  }
  const m = url.match(/\/issues\/(\d+)\/timeline$/);
  if (m) {
    const n = m[1];
    if (state.failures[n] === 'timeline') fail('stub: forced timeline failure');
    if (state.delayMs) {
      fs.appendFileSync(state.log, 'BEGIN ' + Date.now() + '\n');
      const until = Date.now() + state.delayMs;
      while (Date.now() < until) {}
      fs.appendFileSync(state.log, 'END ' + Date.now() + '\n');
    }
    process.stdout.write(JSON.stringify(state.timelines[n] || []));
    process.exit(0);
  }
  process.stdout.write('[]');
  process.exit(0);
}
process.stdout.write('[]');
`
  );
  chmodSync(join(bin, 'gh'), 0o755);
  return { env: { PATH: `${bin}:${process.env.PATH}`, ROUTING_REPO: 'fixture/repo' }, log };
}

const R6_T0 = '2026-11-10T12:00:00Z';
const atMin = (m) => new Date(Date.parse(R6_T0) + m * 60000).toISOString();
const labelEvent = (event, name, minute) => ({ event, label: { name }, created_at: atMin(minute) });
const tieredIssue = (number) => ({ number, title: `tier ${number}`, labels: [{ name: 'impl:standard' }], body: tierBody('standard') });
const downgradeEvents = [labelEvent('unlabeled', 'impl:frontier', 0), labelEvent('labeled', 'impl:standard', 5)];
const upgradeEvents = [labelEvent('unlabeled', 'impl:standard', 0), labelEvent('labeled', 'impl:frontier', 5)];

test('issue-routing R6: a downgrade with no body edit nearby fires', () => {
  const dir = fixture({});
  const { env } = ghR6Stub(dir, [tieredIssue(100)], { timelines: { 100: downgradeEvents }, edits: { 100: [] } });
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /#100 \[R6\]/);
});

test('issue-routing R6: an edit inside the grounding window clears, one outside it does not', () => {
  const dir = fixture({});
  const near = ghR6Stub(dir, [tieredIssue(101)], { timelines: { 101: downgradeEvents }, edits: { 101: [atMin(2)] } });
  const grounded = run('check-issue-routing.mjs', dir, { env: near.env });
  assert.equal(grounded.code, 0, grounded.out);
  assert.doesNotMatch(grounded.out, /\[R6\]/);
  assert.doesNotMatch(grounded.out, /R6 SKIPPED/);

  const dir2 = fixture({});
  const far = ghR6Stub(dir2, [tieredIssue(101)], { timelines: { 101: downgradeEvents }, edits: { 101: [atMin(120)] } });
  const ungrounded = run('check-issue-routing.mjs', dir2, { env: far.env });
  assert.match(ungrounded.out, /#101 \[R6\]/);
});

test('issue-routing R6: a lone labeled event spends no GraphQL call', () => {
  const dir = fixture({});
  const stub = ghR6Stub(dir, [tieredIssue(102)], { timelines: { 102: [labelEvent('labeled', 'impl:standard', 0)] } });
  const { code, out } = run('check-issue-routing.mjs', dir, { env: stub.env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /\[R6\]/);
  assert.doesNotMatch(out, /R6 SKIPPED/);
  assert.doesNotMatch(readFileSync(stub.log, 'utf8'), /graphql/);
});

test('issue-routing R6: an upgrade pair spends no GraphQL call', () => {
  const dir = fixture({});
  const stub = ghR6Stub(dir, [tieredIssue(103)], { timelines: { 103: upgradeEvents } });
  const { code, out } = run('check-issue-routing.mjs', dir, { env: stub.env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /\[R6\]/);
  assert.doesNotMatch(out, /R6 SKIPPED/);
  assert.doesNotMatch(readFileSync(stub.log, 'utf8'), /graphql/);
});

test('issue-routing R6: a failed timeline read reports SKIPPED, never OK', () => {
  const dir = fixture({});
  const stub = ghR6Stub(dir, [tieredIssue(105)], { failures: { 105: 'timeline' } });
  const { out } = run('check-issue-routing.mjs', dir, { env: stub.env });
  assert.match(out, /R6 SKIPPED/);
  assert.match(out, /Not counted as passing/);
  assert.doesNotMatch(out, /OK:/);
});

test('issue-routing R6: a failed edit-history read on a candidate reports SKIPPED, never OK', () => {
  const dir = fixture({});
  const stub = ghR6Stub(dir, [tieredIssue(106)], { timelines: { 106: downgradeEvents }, failures: { 106: 'graphql' } });
  const { out } = run('check-issue-routing.mjs', dir, { env: stub.env });
  assert.match(out, /R6 SKIPPED/);
  assert.match(out, /Not counted as passing/);
  assert.doesNotMatch(out, /OK:/);
});

test('issue-routing R6: concurrent findings are reported in issue order', () => {
  const dir = fixture({});
  const { env } = ghR6Stub(dir, [tieredIssue(108), tieredIssue(107)], {
    timelines: { 107: downgradeEvents, 108: downgradeEvents },
    edits: { 107: [], 108: [] },
  });
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#107 \[R6\][\s\S]*#108 \[R6\]/);
});

test('issue-routing R6: the read pool overlaps reads and never exceeds 8', () => {
  const dir = fixture({});
  const issues = Array.from({ length: 12 }, (_, i) => tieredIssue(200 + i));
  const stub = ghR6Stub(dir, issues, { delayMs: 500 });
  const { code, out } = run('check-issue-routing.mjs', dir, { env: stub.env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R6 SKIPPED/);

  const lines = readFileSync(stub.log, 'utf8').trim().split('\n');
  const begins = lines.filter((l) => l.startsWith('BEGIN ')).map((l) => Number(l.slice(6)));
  const ends = lines.filter((l) => l.startsWith('END ')).map((l) => Number(l.slice(4)));
  assert.equal(begins.length, 12, 'every tiered issue was read exactly once');
  assert.equal(ends.length, 12);

  // A BEGIN opens an interval and an END closes it. At equal milliseconds, sort
  // the close first so the measured maximum cannot overcount.
  const events = [...begins.map((ms) => [ms, 1]), ...ends.map((ms) => [ms, -1])]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0;
  let max = 0;
  for (const [, delta] of events) {
    active += delta;
    max = Math.max(max, active);
  }
  assert.ok(max <= 8, `max concurrency ${max} exceeded the pool of 8`);
  assert.ok(max >= 2, `expected overlapping reads, saw max ${max}`);
});

test('issue-routing R6: the first failed read stops dispatch of queued issues', () => {
  const dir = fixture({});
  // Issue 200 fails immediately; 201–207 are held in flight by the stub's delay;
  // 208–211 are still queued when the failure lands and must never be read.
  const issues = Array.from({ length: 12 }, (_, i) => tieredIssue(200 + i));
  const stub = ghR6Stub(dir, issues, { failures: { 200: 'timeline' }, delayMs: 800 });
  const { out } = run('check-issue-routing.mjs', dir, { env: stub.env });
  assert.match(out, /R6 SKIPPED/);
  assert.match(out, /Not counted as passing/);
  assert.doesNotMatch(out, /OK:/);

  const readNumbers = readFileSync(stub.log, 'utf8')
    .trim()
    .split('\n')
    .filter((l) => l.includes('/timeline'))
    .map((l) => Number(l.match(/\/issues\/(\d+)\/timeline/)[1]))
    .sort((a, b) => a - b);
  assert.deepEqual(readNumbers, [200, 201, 202, 203, 204, 205, 206, 207]);
});

test('issue-routing R14: ready private design links require same-line repo mirrors, even before triage', () => {
  const dir = fixture({});
  const links = ['https://claude.ai/artifact/private', 'https://claude.ai/code/artifact/private', 'https://www.figma.com/design/private'];
  const env = ghStub(dir, links.map((url, i) => ({ number: 70 + i, title: 'UI', labels: [{ name: 'status:ready' }], body: `Read first: ${url}\n` })));
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  for (const number of [70, 71, 72]) assert.match(out, new RegExp(`#${number} \\[R14\\]`));
});

test('issue-routing R14: real repo paths clear, unrelated URLs and next-line mirrors do not', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 73, labels: [], body: 'Read first: https://claude.ai/artifact/private — `docs/design/board.html` + `docs/design/board.png`\n\n## Status\nready — 2026-11-10' },
    { number: 74, labels: [{ name: 'status:ready' }], body: 'Read first: https://claude.ai/artifact/private https://example.com/docs/design/board.png' },
    { number: 75, labels: [{ name: 'status:ready' }], body: 'Read first: https://figma.com/file/private\nMirror: docs/design/board.png' },
    { number: 76, labels: [], body: 'Read first: https://figma.com/file/private\n\n## Status\nblocked — 2026-11-10' },
    { number: 77, labels: [{ name: 'status:ready' }], body: '```\nRead first: https://figma.com/design/private\n```' },
    { number: 78, labels: [{ name: 'status:ready' }], body: 'Read first: https://claude.ai/artifact/private — before/after screenshots required' },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /#(?:73|76|77) \[R14\]/);
  assert.match(out, /#74 \[R14\]/);
  assert.match(out, /#75 \[R14\]/);
  assert.match(out, /#78 \[R14\]/);
});

test('issue-routing R15: Design reference or visual outcomes need a concrete standalone Render line', () => {
  const dir = fixture({});
  const bodies = [
    '## Design reference\nReference: none — component table decides',
    '## Verifiable outcomes (binary, observable)\n- [ ] Before/after screenshots attached',
    '## Acceptance Criteria\n- [ ] Visual comparison matches board',
    '## Design reference\nRender: <command>',
    '## Design reference\nRender: ``',
    '## Design reference\n\n```\nRender: node fake.mjs\n```',
  ];
  const env = ghStub(dir, bodies.map((body, i) => ({ number: 80 + i, labels: [], body })));
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  for (const number of [80, 81, 82, 83, 84, 85]) assert.match(out, new RegExp(`#${number} \\[R15\\]`));
});

test('issue-routing R15: runnable command clears, schema fences and nonvisual outcomes are ignored', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 86, labels: [], body: '## Design reference\nReference: none — component table decides\nRender: `node scripts/render.mjs --fixtures`' },
    { number: 87, labels: [], body: '## Verifiable outcomes\n- [ ] screenshots attached\n\n## Verification\nRender: npm run render:fixtures' },
    { number: 88, labels: [], body: '```\n## Design reference\nRender: <command>\n```\n\n## Verifiable outcomes\n- [ ] tests pass' },
    { number: 89, labels: [], body: 'Context: screenshots explain the incident.\n\n## Verifiable outcomes\n- [ ] lint warns' },
    { number: 91, labels: [], body: '## Design reference\nRender: node scripts/render.mjs --fixtures > render.log' },
    { number: 92, labels: [], body: '## Design reference\nRender: node scripts/render.mjs --fixtures 2>&1' },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R15\]/);
});

test('issue-routing R17: a gate with no ## Human step section fires and counts the debt', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 100, labels: [{ name: 'gate:human-approval' }], body: 'Some description.\n' },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /#100 \[R17\]/);
  assert.match(out, /no "## Human step" section/);
  assert.match(out, /Human-step census: 1 gate\(s\) — 0 Automation, 0 Not automatable, 1 without a valid record/);
});

test('issue-routing R17: impl:human with no gate fires', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 101, labels: [{ name: 'impl:human' }], body: tierBody('human (inherent) — an external commitment.') },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /#101 \[R17\]/);
  assert.match(out, /impl:human with no gate: label/);
});

test('issue-routing R17: a gate line with no form, an empty Not automatable, and a non-numeric Automation all fire', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 102, labels: [{ name: 'gate:decision' }], body: '## Human step\n- gate:decision — the owner decides.\n' },
    { number: 103, labels: [{ name: 'gate:credentials' }], body: '## Human step\n- gate:credentials — the operator holds it.\n  Not automatable —\n' },
    { number: 104, labels: [{ name: 'gate:human-approval' }], body: '## Human step\n- gate:human-approval — the owner approves.\n  Automation: existing — deploy.yml\n' },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /#102 \[R17\]/);
  assert.match(out, /carries no "Automation: #N" or "Not automatable — <mechanism>" form/);
  assert.match(out, /#103 \[R17\]/);
  assert.match(out, /"Not automatable" names no mechanism/);
  assert.match(out, /#104 \[R17\]/);
});

test('issue-routing R17: well-formed records clear and split the census', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 105, labels: [{ name: 'gate:human-approval' }], body: '## Human step\n- gate:human-approval — the owner authorizes it.\n  Automation: #1250 — the script sets it.\n' },
    { number: 106, labels: [{ name: 'gate:credentials' }], body: '## Human step\n- gate:credentials — the operator holds the identity.\n  Not automatable — the identity is bound to a natural person.\n' },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /\[R17\]/);
  assert.match(out, /Human-step census: 2 gate\(s\) — 1 Automation, 1 Not automatable, 0 without a valid record/);
});

test('issue-routing R17: both forms on one gate fire', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 107, labels: [{ name: 'gate:decision' }], body: '## Human step\n- gate:decision — the owner decides.\n  Automation: #12 — x\n  Not automatable — a value judgment.\n' },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /#107 \[R17\]/);
  assert.match(out, /carries both "Automation:" and "Not automatable"/);
});

test('issue-routing R17: a fenced schema example is not a record', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 108, labels: [{ name: 'gate:decision' }], body: '```\n## Human step\n- gate:decision — example\n  Not automatable — example\n```\n' },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#108 \[R17\]/);
  assert.match(out, /no "## Human step" section/);
});

test('issue-routing R17: closed history is not rechecked', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 109, labels: [{ name: 'gate:decision' }], body: '## Impl tier\nfrontier (inherent) — x\n', closed_at: new Date().toISOString() },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed'] });
  assert.doesNotMatch(out, /\[R17\]/);
});

test('issue-routing R14/R15: closed history is not rechecked for design readiness', () => {
  const dir = fixture({});
  const env = ghStub(dir, [{ number: 90, labels: [{ name: 'status:ready' }], closed_at: new Date().toISOString(), body: 'Read first: https://claude.ai/artifact/private\n\n## Design reference\nReference: none — table decides' }]);
  const { out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed'] });
  assert.doesNotMatch(out, /\[R1[45]\]/);
});

test('issue-routing: a well-formed escalation passes', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 1,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — composes the entitlement predicate; a union where an intersection was required silently grants paid features.\nNot splittable: one function, every branch reads it.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('issue-routing: R8 fires when a tier line blames coverage with no record', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 7,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — a wrong scope leaks cross-workspace data silently, and no test covers cross-tenant reads.\nNot splittable: one predicate function.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#7/);
});

test('issue-routing: R8 clears on a linked coverage gap', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 7,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — no test covers cross-tenant reads.\nNot splittable: one predicate function.\nCoverage gap: #99 — cross-tenant read scoping is unverified at any level.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /R8/, out);
});

test('issue-routing: "Coverage: not testable" with no mechanism does not clear R8', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 7,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — the surface is untested.\nNot splittable: one predicate function.\nCoverage: not testable'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
});

test('issue-routing: the tier block ends at the next heading, not at a literal Z', () => {
  // Regression for the `\Z` anchor bug: a body whose tier block is followed by
  // another section must still parse, and the kind must be found inside the
  // block rather than anywhere in the body.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 3,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: `## Impl tier\nfrontier (inherent) — silent failure on the tenancy boundary.\nNot splittable: single transaction.\n\n## Verifiable outcomes\n- [ ] something\n`,
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R3/);
});

test('issue-routing: R3 fires on an escalation with no kind', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 4,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — it is complicated.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
});

// --------------------------- 2026-08-17: ai-fleet upstream-feedback fixes (v1.3.0)

test('issue-routing: R8 fires on "has no test file" (U1 — used 3x in one ai-fleet run, matched nothing)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 11,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — the scoping module has no test file; a wrong scope leaks silently.\nNot splittable: one predicate function.'
      ),
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#11/);
});

test('issue-routing: R8 fires on the file-named form "no get.test.ts" (U1)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — the tenant scoping path has no get.test.ts at all.\nNot splittable: one predicate function.'
      ),
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#12/);
});

test('issue-routing: R8 fires on "asserts nothing about" (U1 — the #762 phrasing)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 13,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        "frontier (inherent) — the tenancy filter's suite asserts nothing about tenant scoping.\nNot splittable: one predicate function."
      ),
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#13/);
});

test('issue-routing: R1 stands down on an epic carrying the child tier table (U2)', () => {
  // Policy §Mechanism 3 prescribes exactly this shape: no impl: label, the
  // "## Impl tier" block holds the per-child table. R1 demanded a label on it.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 20,
      title: 'Epic: tenancy hardening',
      labels: [],
      body: 'Body of work.\n\n## Impl tier\n\n| Child | Tier | Kind | Why |\n|---|---|---|---|\n| #21 | standard | — | loud failure, covered by config tests |\n| #22 | frontier | inherent | silent failure on the scope boundary |\n',
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R1/);
});

test('issue-routing: R1 stands down on the `epic` label even without the table (U2)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 23,
      title: 'Epic: quota work',
      labels: [{ name: 'epic' }],
      body: 'Body of work.\n\n## Impl tier\n\nTiered by child; see the linked issues.\n',
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R1/);
});

test('issue-routing: R1 still fires on a bare tier block that is not an epic (guarding the U2 guard)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 24,
      title: 'x',
      labels: [],
      body: tierBody('frontier (inherent) — silent failure on the scope path.\nNot splittable: one function.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
  assert.match(out, /child tier table/);
});

test('issue-routing: R13 warns on a tiered epic and clears on an untiered one (issue #155)', () => {
  // Policy §Mechanism 3: an epic carries a child tier table, not one tier. A
  // single impl: label on it is the anomaly the equivalence check now exempts.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 40,
      title: 'Epic: tiered',
      labels: [{ name: 'epic' }, { name: 'impl:frontier' }],
      body: 'Body of work.\n\n## Impl tier\nfrontier (inherent) — a single tier is the anomaly; the child table is the real routing.\n',
    },
    {
      number: 42,
      title: 'Epic: untiered',
      labels: [{ name: 'epic' }],
      body: 'Body of work.\n\n## Impl tier\n\n| Child | Tier | Kind | Why |\n|---|---|---|---|\n| #43 | standard | — | loud failure |\n',
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out); // WARN, never a build failure
  assert.match(out, /#40 \[R13\] epic carries a single impl:frontier label/, out);
  assert.doesNotMatch(out, /#42 \[R13\]/, out);
});

test('issue-routing: a rolling report is skipped before any rule reads it (issue #155)', () => {
  // This shape would fire R2 (impl: label with no ## Impl tier) and R10 (risk
  // label with no reason) if the label did not exempt it. The body is rewritten
  // every run, so a finding here could never be made to stay fixed.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 44,
      title: 'mcp auth probe — rolling output',
      labels: [{ name: 'rolling-report' }, { name: 'impl:frontier' }, { name: 'risk:silent-failure' }],
      body: 'Rewritten each run.\n',
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /1 rolling report\(s\) skipped/, out);
  assert.doesNotMatch(out, /\[R(2|10|13)\]/, out);
});

test('issue-routing: kind is not read from prose — "both decision points" declares nothing (U3)', () => {
  // Pre-1.3.0 the whole-block `\b(spec|inherent|both)\b` read "both" here and
  // reported kind=both, silencing R3 on an escalation that declared no kind.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 30,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — the change fails closed at both decision points.\nNot splittable: one transaction.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
});

test('issue-routing: a real declaration still parses when prose says "both" later (U3)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 31,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — fails closed at **both** decision points; a wrong scope leaks silently.\nNot splittable: one transaction.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R3/);
});

test('issue-routing: the ai-fleet declaration dialects parse (U3 — live-corpus shapes)', () => {
  // All six R3s a strict `^tier (kind)` parse produced on ai-fleet's real
  // backlog were declared kinds in emphatic dress. These are those shapes.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 32,
      title: 'backtick-paren form',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('`frontier` (`inherent`) — the spec is complete; no rewrite drops the tier.\nNot splittable: one transaction.'),
    },
    {
      number: 33,
      title: 'slash form',
      labels: [{ name: 'impl:human' }],
      body: tierBody('`human` / `inherent` — commercial judgement; the ordering failure is silent.\nNot splittable: milestone ordering is one decision.'),
    },
    {
      number: 34,
      title: 'comma-kind form',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('**`impl: frontier`, kind `both`.**\n`inherent`: silent and financial failure modes.\nNot splittable: one surface.'),
    },
    {
      number: 35,
      title: 'standalone kind form',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('**Kind: `inherent`.** Two load-bearing boundaries.\nNot splittable: one dispatch path.'),
    },
    {
      number: 36,
      title: 'em-dash kind form (ai-fleet #1485)',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('`frontier` — kind `both`. **Under-specified:** the answers are the deliverable.\nNot splittable: the judgment is the work.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R3/);
});

// --------------------------- 2026-10-08: R9 ready-with-questions (v1.5.0) ----
// The done-condition of a spec interview, as a schema rule: an issue that says
// it is ready while `## Open questions` still lists something is ready to be
// decided, not worked. Shapes come from the 2026-10-08 census of this repo's 40
// issues: nobody ticks boxes (so every item is open unless ticked), the one real
// section was a numbered list, and "ready" was said in `## Status` more often
// than by label. Each fire case is pinned by deleting the R9 report; each clear
// case by deleting the one guard it exists for.

test('issue-routing R9: status:ready + an unchecked item fires, and only that section is counted', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 30,
      title: 'x',
      labels: [{ name: 'impl:standard' }, { name: 'status:ready' }],
      body: `Context.\n\n## Open questions\n- [ ] Which state store?\n\n## Verifiable outcomes\n- [ ] a\n- [ ] b\n\n## Impl tier\nstandard — loud.\n`,
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out); // WARN, never a build failure
  assert.match(out, /#30 \[R9\] says ready \(status:ready\) with 1 open item\(s\)/, out);
});

test('issue-routing R9: a ready ## Status line + a numbered list fires on an untiered issue (#51 shape)', () => {
  // No impl: label and no tier block — the main loop skips such issues for
  // R1–R8. R9 must run before that skip: readiness is claimed by the status.
  // The indented sub-point is context for item 2, not a third question.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 31,
      title: 'x',
      labels: [],
      body: `## Open questions\n\n1. Which state store?\n2. Which scope?\n   - hub-side only, or templates too\n\n## Status\nready — 2026-10-08.\n`,
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#31 \[R9\] says ready \(## Status: ready\) with 2 open item\(s\)/, out);
});

test('issue-routing R9: the section is found when it is the last thing in the body', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 32,
      title: 'x',
      labels: [{ name: 'impl:standard' }, { name: 'status:ready' }],
      body: `## Impl tier\nstandard — loud.\n\n## Open questions\n- Which state store?`,
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#32 \[R9\]/, out);
});

test('issue-routing R9: a heading carrying the house parenthetical still counts', () => {
  // 8 of 33 real issues write `## Verifiable outcomes (binary, observable)`; an
  // `## Open Questions (2)` the rule could not see would be a silent pass.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 39,
      title: 'x',
      labels: [],
      body: `## Open Questions (2)\n- Which state store?\n\n## Status (re-dated)\nready — 2026-10-08.\n`,
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#39 \[R9\] says ready \(## Status: ready\)/, out);
});

test('issue-routing R9: ticked items are resolved — ready + only [x]/[X] clears', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 33,
      title: 'x',
      labels: [{ name: 'impl:standard' }, { name: 'status:ready' }],
      body: `## Open questions\n- [x] Which state store? — Postgres.\n- [X] Which scope? — hub only.\n\n## Impl tier\nstandard — loud.\n`,
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R9\]/, out);
  assert.match(out, /Open-questions census: 1 issue\(s\) carry an ## Open questions section — 0 with open items, 0 of them saying ready\./);
});

test('issue-routing R9: "none" is the explicit empty answer, bare or as a list item', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    { number: 34, title: 'x', labels: [{ name: 'status:ready' }], body: `## Open questions\nnone\n\n## Status\nready — 2026-10-08.\n` },
    { number: 35, title: 'x', labels: [{ name: 'status:ready' }], body: `## Open questions\n- None.\n\n## Status\nready — 2026-10-08.\n` },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R9\]/, out);
  assert.match(out, /2 issue\(s\) carry an ## Open questions section — 0 with open items/);
});

test('issue-routing R9: open items with no ready claim are census, not findings', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 36,
      title: 'x',
      labels: [{ name: 'impl:human' }],
      body: `## Open questions\n1. Which state store?\n\n## Status\nneeds-decision — 2026-10-08.\n\n## Impl tier\nhuman (inherent) — a methodology decision.\nNot splittable: one decision.\n`,
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R9\]/, out);
  assert.match(out, /Open-questions census: 1 issue\(s\) carry an ## Open questions section — 1 with open items \(#36\), 0 of them saying ready\./);
});

test('issue-routing R9: [ ] boxes under Verifiable outcomes and Definition of Done are not questions', () => {
  // 28 real issues carry exactly this shape — the likeliest false positive.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 37,
      title: 'x',
      labels: [{ name: 'impl:standard' }, { name: 'status:ready' }],
      body: `## Verifiable outcomes\n- [ ] a\n\n## Definition of Done\n- [ ] b\n\n## Impl tier\nstandard — loud.\n`,
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R9\]/, out);
  assert.doesNotMatch(out, /Open-questions census/); // no section, nothing read
});

test('issue-routing R9: a schema quoted in a code fence is not a section', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 38,
      title: 'x',
      labels: [{ name: 'impl:standard' }, { name: 'status:ready' }],
      body: "The schema gains:\n\n```\n## Open questions\n- <one per undecided question>\n```\n\n## Impl tier\nstandard — loud.\n",
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R9\]/, out);
  assert.doesNotMatch(out, /Open-questions census/);
});

// --------------------------- 2026-11-07: PDR-011 risk vocabulary (v1.6.0) ----
// R10–R12 gate the `risk:` facts. The fixtures prove the fire and the clear for
// each rule: a label with no reason, an unknown label, and risk:uncovered with
// no coverage record. R4/R5 are restated against the under-structure marker.

const riskIssue = (labels, riskBlock) => ({
  number: 40,
  title: 'x',
  labels: [{ name: 'impl:standard' }, ...labels.map((name) => ({ name }))],
  body: `Context.\n\n## Impl tier\nstandard — loud.\n\n## Risk\n${riskBlock}\n`,
});

test('issue-routing R10: a risk label with no reason line fires', () => {
  const dir = fixture({});
  const env = ghStub(dir, [riskIssue(['risk:silent-failure'], '- risk:boundary — a cross-tenant read.')]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out); // WARN, never a build failure
  assert.match(out, /#40 \[R10\] carries risk:silent-failure/, out);
});

test('issue-routing R10: a label present with no reason text fires', () => {
  const dir = fixture({});
  const env = ghStub(dir, [riskIssue(['risk:silent-failure'], '- risk:silent-failure')]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#40 \[R10\]/, out);
});

test('issue-routing R10 clears when each label has a reason line', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    riskIssue(
      ['risk:silent-failure', 'risk:boundary'],
      '- `risk:silent-failure` — a wrong answer renders as a valid result.\n- risk:boundary — the predicate decides which tenant\'s rows come back.'
    ),
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R10\]/, out);
  assert.match(out, /Risk census: 1 issue\(s\) carry 2 risk label\(s\)/, out);
});

test('issue-routing R11: an unknown risk label fires', () => {
  const dir = fixture({});
  const env = ghStub(dir, [riskIssue(['risk:flaky'], '- risk:flaky — it might fail.')]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#40 \[R11\] carries unknown risk label\(s\) risk:flaky/, out);
});

test('issue-routing R12: risk:uncovered with no coverage record fires', () => {
  const dir = fixture({});
  const env = ghStub(dir, [riskIssue(['risk:uncovered'], '- risk:uncovered — no test exercises the path.')]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#40 \[R12\] carries risk:uncovered/, out);
});

test('issue-routing R12 clears on a linked coverage gap', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    riskIssue(['risk:uncovered'], '- risk:uncovered — no test exercises the path.\n  Coverage gap: #99 — the path is unverified.'),
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /\[R12\]/, out);
});

test('issue-routing R12 clears on a not-testable mechanism but not on the bare phrase', () => {
  const dir = fixture({});
  const withMechanism = riskIssue(
    ['risk:uncovered'],
    '- risk:uncovered — no test exercises the path.\n  Coverage: not testable — the provider cannot be fault-injected.'
  );
  const bare = riskIssue(['risk:uncovered'], '- risk:uncovered — no test exercises the path.\n  Coverage: not testable');
  const envA = ghStub(fixture({}), [withMechanism]);
  const outA = run('check-issue-routing.mjs', fixture({}), { env: envA }).out;
  assert.doesNotMatch(outA, /\[R12\]/, outA);
  const envB = ghStub(fixture({}), [bare]);
  const outB = run('check-issue-routing.mjs', fixture({}), { env: envB }).out;
  assert.match(outB, /\[R12\]/, outB);
});

test('issue-routing R4: status:ready + a spec marker fires without a spec kind', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 41,
      title: 'x',
      labels: [{ name: 'impl:standard' }, { name: 'status:ready' }, { name: 'needs-structure' }],
      body: '## Impl tier\nstandard — loud.\n',
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /#41 \[R4\] status:ready \+ needs-structure/, out);
});

test('issue-routing R5: needs-spec + a non-spec tier fires, and a spec kind clears it', () => {
  const dir = fixture({});
  const firing = {
    number: 42,
    title: 'x',
    labels: [{ name: 'impl:frontier' }, { name: 'needs-spec' }],
    body: '## Impl tier\nfrontier (inherent) — silent.\nNot splittable: one predicate.\n',
  };
  const clearing = {
    number: 43,
    title: 'x',
    labels: [{ name: 'impl:frontier' }, { name: 'needs-spec' }],
    body: '## Impl tier\nfrontier (spec) — the retry policy is missing.\nNot splittable: one predicate.\n',
  };
  const dirA = fixture({});
  const outA = run('check-issue-routing.mjs', dirA, { env: ghStub(dirA, [firing]) }).out;
  assert.match(outA, /#42 \[R5\] carries needs-spec/, outA);
  const dirB = fixture({});
  const outB = run('check-issue-routing.mjs', dirB, { env: ghStub(dirB, [clearing]) }).out;
  assert.doesNotMatch(outB, /\[R5\]/, outB);
});

test('issue-routing: the whole backlog is enumerated across pages, not capped at one', () => {
  // PDR-011 #152 defect 3: the sweep fetched `--limit 500` and never read the
  // oldest issues. The finding here lives on the second page.
  const page1 = [
    { number: 1, title: 'x', labels: [{ name: 'impl:standard' }], body: tierBody('standard — loud.') },
    { number: 2, title: 'x', labels: [{ name: 'impl:standard' }], body: tierBody('standard — loud.') },
  ];
  const page2 = [
    { number: 3, title: 'x', labels: [{ name: 'impl:frontier' }], body: tierBody('frontier — it is complicated.') },
  ];
  const dir = fixture({});
  const { code, out } = run('check-issue-routing.mjs', dir, { env: ghPagesStub(dir, [page1, page2]) });
  assert.equal(code, 1, out);
  assert.match(out, /swept 3 open issues/);
  assert.match(out, /#3 \[R3\]/);
});

test('issue-routing: an unreadable issue fetch is SKIPPED (exit 2), never a silent pass', () => {
  const dir = fixture({});
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(bin, 'gh'), 0o755);
  const { code, out } = run('check-issue-routing.mjs', dir, {
    env: { PATH: `${bin}:${process.env.PATH}`, ROUTING_REPO: 'fixture/repo' },
  });
  assert.equal(code, 2, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /OK:/);
});

test('issue-routing: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/check-issue-routing.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/check-issue-routing.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});

// --------------------------- 2026-08-17: closed pass (v1.4.0) ----------------
// The closed pass answers "is this repo's history estimable?" — R1–R3 only over
// recently closed issues, probe posture by default, kind-coverage census. The gh
// stub answers the single fetch with the case's issues; closed fixtures carry
// closed_at, and the window filters client-side off it.

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

test('issue-routing closed pass: a kind-less closed escalation is flagged R3, probe exits 0', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — the entitlement predicate is one union; every branch reads it.'),
      closed_at: daysAgo(2),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed'] });
  assert.equal(code, 0, out);
  assert.match(out, /closed pass, R1–R3, last 30d/);
  assert.match(out, /CLOSED PASS \(1, probe/);
  assert.match(out, /#12 \[R3\]/);
  assert.match(out, /Kind coverage: 1 closed escalation\(s\) in window — 0 spec, 0 inherent, 0 both, 1 undeclared \(0% declared\)/);
});

test('issue-routing closed pass: a fully declared closed escalation is clean and counts its kind', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 13,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier (inherent) — a wrong scope leaks cross-workspace data silently.\nNot splittable: one predicate.'),
      closed_at: daysAgo(1),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed'] });
  assert.equal(code, 0, out);
  assert.match(out, /OK: every closed escalation in the window/);
  assert.match(out, /0 spec, 1 inherent, 0 both, 0 undeclared \(100% declared\)/);
});

test('issue-routing closed pass: R4–R9 cannot fire on finished work', () => {
  // The fixture is a walking contradiction — status:ready + spec kind (R4), a
  // hedge with no decomposition record (R7), a coverage signal with no record
  // (R8), an open question under a ready label (R9). The open pass flags all
  // four; the closed pass must stay silent on all of them and check
  // declarations only.
  const issue = {
    number: 21,
    title: 'x',
    labels: [{ name: 'impl:frontier' }, { name: 'status:ready' }],
    body: `## Open questions\n- Which retry policy?\n\n` + tierBody('frontier (both) — mostly mechanical, and no test coverage of the retry path.'),
    closed_at: daysAgo(3),
  };
  const openRun = run('check-issue-routing.mjs', fixture({}), { env: ghStub(fixture({}), [issue]) });
  assert.match(openRun.out, /\[R4\]/);
  assert.match(openRun.out, /\[R7\]/);
  assert.match(openRun.out, /\[R8\]/);
  assert.match(openRun.out, /\[R9\]/);

  const dir = fixture({});
  const { code, out } = run('check-issue-routing.mjs', dir, { env: ghStub(dir, [issue]), args: ['--closed'] });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /\[R[4-9]\]/);
  assert.doesNotMatch(out, /Open-questions census/);
  assert.match(out, /OK: every closed escalation/);
});

test('issue-routing closed pass: --closed-gate promotes findings to blocking', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — one predicate; every branch reads it.'),
      closed_at: daysAgo(2),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed', '--closed-gate'] });
  assert.equal(code, 1, out);
  assert.match(out, /CLOSED PASS \(1, gate\)/);
});

test('issue-routing closed pass: the window excludes issues closed before it', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — one predicate; every branch reads it.'),
      closed_at: daysAgo(60),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed', '--days', '30'] });
  assert.equal(code, 0, out);
  assert.match(out, /swept 0 closed issues/);
  assert.doesNotMatch(out, /#12/);
});

test('issue-routing closed pass: --days rejects a non-integer loudly', () => {
  const dir = fixture({});
  const { code, out } = run('check-issue-routing.mjs', dir, { env: ghStub(dir, []), args: ['--closed', '--days', 'soon'] });
  assert.equal(code, 2, out);
  assert.match(out, /--days needs a positive integer/);
});

const ACCEPTED = (falsifier) =>
  `# PDR-001: A bet\n\n**Status:** Accepted\n**Confirmed by:** Someone\n\n## Falsifier\n\n${falsifier}\n`;

// ------------------------------------------------------------- pdr-falsifiers

test('pdr-falsifiers: a corpus with observable falsifiers passes', () => {
  const dir = fixture({
    'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit by 2099-01-01 when the pilot cohort renews or churns'),
    'docs/pdr/002-b.md': ACCEPTED('- [ ] Revisit when three or more inbound conversations open with a compliance driver'),
  });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('pdr-falsifiers: R1 fires on an Accepted record with no falsifier', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': '**Status:** Accepted\n\n## Falsifier\n\nNothing here.\n' });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
});

test('pdr-falsifiers: a Proposed record without a falsifier is fine', () => {
  // Proposed is exactly the status for "no falsifier yet" — gating it would make
  // the status meaningless and push people to skip straight to Accepted.
  const dir = fixture({ 'docs/pdr/001-a.md': '**Status:** Proposed\n\n## Falsifier\n\nTBD.\n' });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
});

test('pdr-falsifiers: R2 gates on a phrasing the form rules out', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit later when we have time') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
});

test('pdr-falsifiers: R3 warns and does not gate', () => {
  // The heuristic half. It failed 5 of this repo's 7 real falsifiers as a gate,
  // which is why it reports instead — proving observability is a judgment call.
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit when the thing settles down') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /WARN/);
  assert.match(out, /R3/);
});

test('pdr-falsifiers: R4 reports a revisit date that has passed', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit by 2020-01-01 when the pilot renews') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /DUE/);
  assert.match(out, /2020-01-01/);
});

test('pdr-falsifiers: a checked-off falsifier is resolved, not due', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [x] Revisit by 2020-01-01 when the pilot renews') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /DUE/);
});

test('pdr-falsifiers: the blank form is not a record', () => {
  const dir = fixture({
    'docs/pdr/_template.md': '**Status:** Proposed | Accepted | Superseded\n\n- [ ] Revisit by YYYY-MM-DD when <condition>\n',
    'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit by 2099-01-01 when the pilot renews'),
  });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /1 record/);
});

test('pdr-falsifiers: a repo with no docs/pdr/ passes silently', () => {
  const { code, out } = run('check-pdr-falsifiers.mjs', fixture({ 'README.md': '# x\n' }));
  assert.equal(code, 0, out);
});

// ---------------------------------------------------------- adr-readme-sync

test('adr-readme-sync: an unregistered PDR fails', () => {
  const dir = fixture({
    'docs/pdr/001-a.md': '# A\n',
    'docs/pdr/README.md': '# Index\n\nNo rows.\n',
  });
  const { code, out } = run('check-adr-readme-sync.mjs', dir);
  assert.equal(code, 1, out);
});

test('adr-readme-sync: a registered PDR passes', () => {
  const dir = fixture({
    'docs/pdr/001-a.md': '# A\n',
    'docs/pdr/README.md': '# Index\n\n| [001](001-a.md) | A | Accepted |\n',
  });
  const { code, out } = run('check-adr-readme-sync.mjs', dir);
  assert.equal(code, 0, out);
});

// ------------------------------------------ routing equivalence (PDR-011)
// The retirement gate: the records-held risk→class rule must reproduce the
// current tiers. A difference, an untiered issue, or an unapplicable rule is
// non-zero; an unreadable rule or gh is SKIPPED (exit 2), never a pass.

const EQUIV_RULE = [
  '# Records',
  '',
  '## 8. Risk → class rule',
  '',
  '| Risk label | Minimum class |',
  '|---|---|',
  '| (none) | standard |',
  '| `risk:silent-failure` | frontier |',
  '| `risk:boundary` | frontier |',
  '| `risk:uncovered` | frontier |',
  '',
].join('\n');

const equivFixture = () => fixture({ 'docs/agent-routing-records.md': EQUIV_RULE });

/** gh stub for the paginated `api` fetch. `--slurp` expects an array of pages. */
function ghApiStub(dir, issues) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const page = JSON.stringify([issues]).replace(/'/g, `'\''`);
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh\ncase "$1" in\n  api) printf '%s' '${page}' ;;\n  *) printf '[]' ;;\nesac\n`
  );
  chmodSync(join(bin, 'gh'), 0o755);
  return { PATH: `${bin}:${process.env.PATH}`, ROUTING_REPO: 'fixture/repo' };
}

test('routing-equivalence: a matching backlog passes', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 1, title: 'x', labels: [{ name: 'impl:standard' }], body: '' },
    { number: 2, title: 'x', labels: [{ name: 'impl:frontier' }, { name: 'risk:silent-failure' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /OK: every open issue's derived class matches/);
});

test('routing-equivalence: a standard issue carrying a risk label is a difference (exit 1)', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 5, title: 'x', labels: [{ name: 'impl:standard' }, { name: 'risk:silent-failure' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /#5\s+impl:standard \(standard\) -> frontier/);
});

test('routing-equivalence: highest signal wins across several risk labels', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 3, title: 'x', labels: [{ name: 'impl:frontier' }, { name: 'risk:silent-failure' }, { name: 'risk:boundary' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
});

test('routing-equivalence: an untiered issue is listed, not silently skipped', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 6, title: 'x', labels: [{ name: 'risk:boundary' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /UNTIERED \(1\)/);
  assert.match(out, /#6\s+\(none\) -> frontier/);
});

test('routing-equivalence: an impl:human issue with a gate: label is equivalent, class comparison does not apply', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 7, title: 'x', labels: [{ name: 'impl:human' }, { name: 'risk:boundary' }, { name: 'gate:human-approval' }], body: '' },
    { number: 9, title: 'x', labels: [{ name: 'impl:human' }, { name: 'gate:credentials' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /DIFFERENCES/, out);
  assert.doesNotMatch(out, /IMPL:HUMAN WITHOUT A GATE LABEL/, out);
});

test('routing-equivalence: an impl:human issue with no gate: label is reported under its own heading', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 8, title: 'x', labels: [{ name: 'impl:human' }, { name: 'risk:boundary' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /IMPL:HUMAN WITHOUT A GATE LABEL \(1\)/);
  assert.match(out, /#8\s+add a gate: label/);
  assert.doesNotMatch(out, /DIFFERENCES/, out);
});

test('routing-equivalence: an untiered epic is exempt by its label, not counted as UNTIERED', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 10, title: 'Epic', labels: [{ name: 'epic' }], body: 'Body of work.\n' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /EXEMPT EPICS \(1\)/);
  assert.match(out, /#10\s+\(epic\)/);
  assert.doesNotMatch(out, /UNTIERED/, out);
});

test('routing-equivalence: an untiered epic is exempt by its child tier table', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    {
      number: 11,
      title: 'Epic',
      labels: [],
      body: 'Body of work.\n\n## Impl tier\n\n| Child | Tier | Kind | Why |\n|---|---|---|---|\n| #21 | standard | — | loud failure |\n',
    },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /EXEMPT EPICS \(1\)/);
  assert.match(out, /#11\s+\(epic\)/);
  assert.doesNotMatch(out, /UNTIERED/, out);
});

test('routing-equivalence: a TIERED epic is exempt, not a difference (issue #155)', () => {
  // 1.2.0 only routed an epic into EXEMPT when it had no impl: label, so every
  // tiered epic on ai-fleet reported `frontier -> standard (zero risk labels)`.
  // Policy §Mechanism 3 says an epic has a child table, not a single tier; the
  // label is the anomaly (check-issue-routing R13), never a class difference.
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 12, title: 'Epic', labels: [{ name: 'epic' }, { name: 'impl:frontier' }], body: 'Body of work.\n' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /EXEMPT EPICS \(1\)/);
  assert.match(out, /#12\s+\(epic, impl:frontier\)/);
  assert.doesNotMatch(out, /DIFFERENCES/, out);
});

test('routing-equivalence: an epic with an unmapped risk label is exempt, not unresolved (issue #155)', () => {
  // "Exempt every epic-shaped issue" has to mean before the rule is applied:
  // an epic carrying a risk label the rule does not map is still an epic, and
  // the check has nothing to compare on it. Only ordinary issues are unresolved.
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 14, title: 'Epic', labels: [{ name: 'epic' }, { name: 'impl:frontier' }, { name: 'risk:irreversible' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /EXEMPT EPICS \(1\)/);
  assert.match(out, /#14\s+\(epic, impl:frontier\) -> \(rule not applicable\)/);
  assert.doesNotMatch(out, /UNRESOLVED/, out);
});

test('routing-equivalence: a rolling report is exempt by its label, not counted as a difference (issue #155)', () => {
  // A rolling report is a workflow's output surface, rewritten every run. This
  // shape would be a standard -> frontier difference if it were treated as work.
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 13, title: 'probe — rolling output', labels: [{ name: 'rolling-report' }, { name: 'impl:standard' }, { name: 'risk:silent-failure' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /EXEMPT ROLLING REPORTS \(1\)/);
  assert.match(out, /#13\s+\(rolling report\)/);
  assert.doesNotMatch(out, /DIFFERENCES/, out);
  assert.doesNotMatch(out, /UNTIERED/, out);
});

test('routing-equivalence: a risk label with no rule row is unresolved', () => {
  const dir = equivFixture();
  const env = ghApiStub(dir, [
    { number: 8, title: 'x', labels: [{ name: 'impl:frontier' }, { name: 'risk:irreversible' }], body: '' },
  ]);
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /no rule row for risk:irreversible/);
});

test('routing-equivalence: a missing rule section is SKIPPED (exit 2), never a pass', () => {
  const dir = equivFixture();
  const rule = '# Records\n\n## 1. Model → class\n\nNo rule here.\n';
  const withRule = fixture({ 'docs/agent-routing-records.md': rule });
  const env = ghApiStub(withRule, []);
  const { code, out } = run('check-routing-equivalence.mjs', withRule, { env });
  assert.equal(code, 2, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /OK:/);
});

test('routing-equivalence: a rule naming a non-class is SKIPPED (exit 2)', () => {
  const dir = equivFixture();
  const rule = EQUIV_RULE.replace('| `risk:boundary` | frontier |', '| `risk:boundary` | human |');
  const withRule = fixture({ 'docs/agent-routing-records.md': rule });
  const env = ghApiStub(withRule, []);
  const { code, out } = run('check-routing-equivalence.mjs', withRule, { env });
  assert.equal(code, 2, out);
  assert.match(out, /SKIPPED/);
  assert.match(out, /standard or frontier only/);
});

test('routing-equivalence: no gh auth is SKIPPED (exit 2), never a pass', () => {
  const dir = equivFixture();
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(bin, 'gh'), 0o755);
  const { code, out } = run('check-routing-equivalence.mjs', dir, {
    env: { PATH: `${bin}:${process.env.PATH}`, ROUTING_REPO: 'fixture/repo' },
  });
  assert.equal(code, 2, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /OK:/);
});

test('routing-equivalence: the whole backlog is enumerated past the old 500 ceiling', () => {
  const issues = Array.from({ length: 501 }, (_, i) => ({
    number: i + 1,
    title: 'x',
    labels: i === 500 ? [{ name: 'risk:silent-failure' }] : [{ name: 'impl:standard' }],
  }));
  const dir = equivFixture();
  const { code, out } = run('check-routing-equivalence.mjs', dir, { env: ghApiStub(dir, issues) });
  assert.equal(code, 1, out);
  assert.match(out, /swept 501 open issues/);
  assert.match(out, /#501/, out);
});

test('routing-equivalence: pull requests are not counted as issues', () => {
  const dir = equivFixture();
  const { code, out } = run('check-routing-equivalence.mjs', dir, {
    env: ghApiStub(dir, [{ number: 1, title: 'a PR', labels: [], pull_request: {} }]),
  });
  assert.equal(code, 0, out);
  assert.match(out, /swept 0 open issues/);
});

test('routing-equivalence: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/check-routing-equivalence.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/check-routing-equivalence.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});

// 2026-11-07: the opencode classifier pin must resolve through the v2 route table.
// The Claude Code pin is covered by check-classifier-pin-drift.mjs; the global
// opencode pin has no repo lint, so this test holds it to the same agreement.
test('opencode classifier pin binds a v2 route the records class table lists', () => {
  const src = readFileSync(resolve(REPO, 'templates/agents/routing-classifier.opencode.md'), 'utf8');
  const cls = src.match(/# routing-class:\s*(\w+)/)?.[1];
  const model = src.match(/^model:\s*(\S+)/m)?.[1];
  assert.equal(cls, 'frontier', 'the opencode classifier must declare its triage class');
  assert.match(model, /^hopskip-gateway\//, 'the opencode pin must use the v2 provider/model form');

  const records = readFileSync(resolve(REPO, 'docs/agent-routing-records.md'), 'utf8');
  const classRow = records.split('\n').find((l) => l.startsWith(`| ${cls} |`));
  assert.ok(classRow, `records §1 has no ${cls} row`);
  const names = classRow.split('|')[2].split(',').map((s) => s.trim());

  const routeRows = records.split('\n').filter((l) => /^\|.*\|.*\|.*\|$/.test(l));
  const match = routeRows.find((l) => {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, ''));
    return cells[2] === model && names.includes(cells[0]);
  });
  assert.ok(match, `opencode pin ${model} does not resolve to a ${cls} model in records §2`);
});

// 2026-11-07: the first .js template (the opencode v2 hook) must be in both
// all-template gates. Before this, the version and coverage lints skipped .js
// entirely and a future unbumped or uncovered plugin would pass unchecked.
test('template-versions: a .js template is stamped and checked', () => {
  const dir = fixture({
    'templates/hook.js': '// template: hook.js v1.0.0 · updated 2026-11-07\n',
  });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 0, out);
});

test('template-versions: an unstamped .js template fails', () => {
  const dir = fixture({ 'templates/hook.js': '// no stamp\n' });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 1, out);
});

test('analyze-repo-coverage: a .js template in the matrix passes, a missing one fails', () => {
  const dir = fixture({
    ...EXCLUDED_TEMPLATES,
    'templates/hook.js': '// template: hook.js v1.0.0 · updated 2026-11-07\n',
    '.claude/commands/analyze-repo.md': '| `hook.js` | Always | P1 | because |\n',
  });
  const ok = run('check-analyze-repo-coverage.mjs', dir);
  assert.equal(ok.code, 0, ok.out);

  const dir2 = fixture({
    ...EXCLUDED_TEMPLATES,
    'templates/hook.js': '// template: hook.js v1.0.0 · updated 2026-11-07\n',
    'templates/forgotten.js': '// template: forgotten.js v1.0.0 · updated 2026-11-07\n',
    '.claude/commands/analyze-repo.md': '| `hook.js` | Always | P1 | because |\n',
  });
  const bad = run('check-analyze-repo-coverage.mjs', dir2);
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /forgotten\.js/);
});
