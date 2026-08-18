// Fixture tests for templates/scripts/check-stale-blockers.mjs (issue #89).
//
// Same rule as every script here (docs/testing-strategy.md §1): each of the
// five classes fires on a known-bad fixture and clears on a known-good one,
// and the paired case is what proves the detector branch is load-bearing —
// a class whose branch was deleted would pass its good case and fail its bad
// one. The SKIPPED contract gets the same treatment in both directions: an
// unreachable scope must print SKIPPED, must NOT read as clean in probe mode,
// and must make a gated run exit 2 rather than 0 — a gate that fails open
// reads as evidence (the R6 contract in check-issue-routing.mjs).
//
// `gh` is stubbed on PATH by a data-driven node stub: GH_STUB (path to a JSON
// spec) holds the open-issue list per repo and the per-ref view outcomes —
// a state/body/labels object, "missing" (repo readable, no such issue), or
// "unreachable" (the repo itself could not be read).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO, 'templates', 'scripts', 'check-stale-blockers.mjs');

const STUB_SOURCE = `#!/usr/bin/env node
// Data-driven gh stub. Spec (JSON at $GH_STUB):
//   { "issues": [ ...open issues of the swept repo... ],
//     "views": { "owner/repo#7": {"state":"OPEN"|"CLOSED","body":"...","labels":[{"name":"..."}]}
//                                 | "missing" | "unreachable" } }
const spec = JSON.parse(require('fs').readFileSync(process.env.GH_STUB, 'utf8'));
const args = process.argv.slice(2);
if (args[0] === 'issue' && args[1] === 'list') {
  process.stdout.write(JSON.stringify(spec.issues ?? []));
} else if (args[0] === 'issue' && args[1] === 'view') {
  const n = args[2];
  const repo = args[args.indexOf('--repo') + 1];
  const v = (spec.views ?? {})[repo + '#' + n];
  if (v === undefined || v === 'unreachable') {
    process.stderr.write("gh: Could not resolve to a Repository with the name '" + repo + "'. (HTTP 404)\\n");
    process.exit(1);
  }
  if (v === 'missing') {
    process.stderr.write('GraphQL: Could not resolve to an Issue with the number of ' + n + '.\\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify({ number: Number(n), ...v }));
} else {
  process.stderr.write('gh stub: unhandled ' + args.join(' ') + '\\n');
  process.exit(1);
}
`;

/** A fixture dir carrying the gh stub + spec. Returns env for run(). */
function ghStub(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-blockers-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), STUB_SOURCE);
  chmodSync(join(bin, 'gh'), 0o755);
  const specPath = join(dir, 'spec.json');
  writeFileSync(specPath, JSON.stringify(spec));
  return {
    PATH: `${bin}:${process.env.PATH}`,
    GH_STUB: specPath,
    STALE_BLOCKERS_REPO: 'fixture/repo',
  };
}

function run(env, args = []) {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const issue = (number, body, labels = []) => ({ number, title: 'x', body, labels: labels.map((name) => ({ name })) });
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// ------------------------------------------------------------------ phantom

test('stale-blockers: phantom fires when the blocker is closed (probe exits 0)', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by #9\n')],
    views: { 'fixture/repo#9': { state: 'CLOSED', body: '', labels: [] } },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out); // probe never blocks, even with findings
  assert.match(out, /#12 \[phantom\]/);
  assert.match(out, /census: phantom 1/);
});

test('stale-blockers: an open blocker is clean', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by #9\n')],
    views: { 'fixture/repo#9': { state: 'OPEN', body: '', labels: [] } },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
  assert.match(out, /census: phantom 0/);
});

test('stale-blockers: --gate promotes phantom to exit 1', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by #9\n')],
    views: { 'fixture/repo#9': { state: 'CLOSED', body: '', labels: [] } },
  });
  const { code, out } = run(env, ['--gate']);
  assert.equal(code, 1, out);
});

test('stale-blockers: a phantom on a P1 dependent is marked for the workflow escalation', () => {
  // The workflow greps this exact marker across two consecutive runs.
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by #9\n', ['P1', 'status:blocked'])],
    views: { 'fixture/repo#9': { state: 'CLOSED', body: '', labels: [] } },
  });
  const { out } = run(env);
  assert.match(out, /^  #12 \[phantom\].*\[P1 dependent\]/m);
});

// ------------------------------------------------------------ unresolved-ref

test('stale-blockers: unresolved-ref fires when the repo is readable but the issue is not there', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by other/thing#77\n')],
    views: { 'other/thing#77': 'missing' },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /#12 \[unresolved-ref\] blocked-by other\/thing#77/);
  assert.match(out, /census: phantom 0 · unresolved-ref 1/);
});

// -------------------------------------------------------------- unreachable

test('stale-blockers: an unreachable scope is SKIPPED, probe exits 0, never reads as clean', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by private/repo#5\n')],
    views: { 'private/repo#5': 'unreachable' },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED: scope private\/repo unreachable/);
  assert.match(out, /scopes skipped 1/);
  assert.doesNotMatch(out, /OK:/); // a hole is not a green run
  assert.doesNotMatch(out, /\[unresolved-ref\]/); // and never an authoring defect
});

test('stale-blockers: --gate with a skipped scope exits 2, not 0 and not 1', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by private/repo#5\n')],
    views: { 'private/repo#5': 'unreachable' },
  });
  const { code, out } = run(env, ['--gate']);
  assert.equal(code, 2, out);
  assert.match(out, /SKIPPED/);
});

test('stale-blockers: --gate with BOTH a skip and findings still exits 2 — degraded beats findings', () => {
  const env = ghStub({
    issues: [
      issue(12, '## Dependencies\nblocked-by #9 · blocked-by private/repo#5\n'),
    ],
    views: {
      'fixture/repo#9': { state: 'CLOSED', body: '', labels: [] },
      'private/repo#5': 'unreachable',
    },
  });
  const { code, out } = run(env, ['--gate']);
  assert.equal(code, 2, out);
  assert.match(out, /\[phantom\]/);
  assert.match(out, /SKIPPED/);
});

// ------------------------------------------------------------ mutual-deferral

test('stale-blockers: mutual-deferral fires once on a cross-repo cycle with both sides deferred', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by other/repo#34\n', ['status:deferred'])],
    views: {
      'other/repo#34': {
        state: 'OPEN',
        body: '## Dependencies\nblocked-by fixture/repo#12\n',
        labels: [{ name: 'status:blocked' }],
      },
    },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /#12 \[mutual-deferral\] #12 and other\/repo#34 cite each other/);
  assert.match(out, /mutual-deferral 1/); // the pair counts once, not per side
});

test('stale-blockers: a mutual citation without both deferred labels is not a finding', () => {
  // One side is actively being worked — the cycle is real but the deferral
  // pattern is not; only the dual-stalled shape is the class.
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by other/repo#34\n', ['status:deferred'])],
    views: {
      'other/repo#34': {
        state: 'OPEN',
        body: '## Dependencies\nblocked-by fixture/repo#12\n',
        labels: [{ name: 'status:ready' }],
      },
    },
  });
  const { out } = run(env);
  assert.match(out, /mutual-deferral 0/, out);
});

// --------------------------------------------------------------- stale-status

test('stale-blockers: stale-status fires on an undated status line', () => {
  const env = ghStub({
    issues: [issue(12, '## Status\nblocked on the vendor, waiting\n', ['status:blocked'])],
    views: {},
  });
  const { out } = run(env);
  assert.match(out, /#12 \[stale-status\] status line carries no date/, out);
});

test('stale-blockers: stale-status fires on a status line older than the max age', () => {
  const env = ghStub({
    issues: [issue(12, `## Status\nblocked — ${daysAgo(45)}\n`, ['status:needs-decision'])],
    views: {},
  });
  const { out } = run(env, ['--max-status-age', '30']);
  assert.match(out, /#12 \[stale-status\].*45d old/, out);
});

test('stale-blockers: a fresh dated status line is clean', () => {
  const env = ghStub({
    issues: [issue(12, `## Status\nblocked — ${daysAgo(3)}\n`, ['status:blocked'])],
    views: {},
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /stale-status 0/);
  assert.match(out, /OK:/);
});

test('stale-blockers: stale-status does not fire on status:ready however old the date', () => {
  // The class exists for parked work. A ready issue with an old date is just
  // a queue, not a phantom risk.
  const env = ghStub({
    issues: [issue(12, `## Status\nready — ${daysAgo(90)}\n`, ['status:ready'])],
    views: {},
  });
  const { out } = run(env);
  assert.match(out, /stale-status 0/, out);
});

test('stale-blockers: --max-status-age rejects a non-integer loudly', () => {
  const env = ghStub({ issues: [], views: {} });
  const { code, out } = run(env, ['--max-status-age', 'soon']);
  assert.equal(code, 2, out);
  assert.match(out, /--max-status-age needs a positive integer/);
});

// ------------------------------------------------------------------- parser
// The live-dialect cases. The parser is the part that has to know the house
// convention (CLAUDE.md gotcha: a detector has to know the house convention);
// these shapes come from the real corpus, and the issue's verifiable outcomes
// require a run over that corpus before the detector is called done.

test('stale-blockers: parser tolerates the ·-joined form with blocks/child-of on the line', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by #9 · blocks #21 · child-of #3\n')],
    views: { 'fixture/repo#9': { state: 'CLOSED', body: '', labels: [] } },
  });
  const { out } = run(env);
  // #21 and #3 are NOT blockers: one phantom, not three.
  assert.match(out, /census: phantom 1/, out);
  assert.match(out, /unparsed 0/, out);
});

test('stale-blockers: parser handles comma lists and the bare-repo cross-repo form', () => {
  // The ai-fleet#1426 shape: "blocked-by analytics#237, #241, #335" — bare
  // repo names infer the swept repo's owner.
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by analytics#237, #241, #335\n')],
    views: {
      'fixture/analytics#237': { state: 'CLOSED', body: '', labels: [] },
      'fixture/analytics#241': { state: 'CLOSED', body: '', labels: [] },
      'fixture/analytics#335': { state: 'OPEN', body: '', labels: [] },
    },
  });
  const { out } = run(env);
  assert.match(out, /census: phantom 2/, out); // 237 + 241 closed, 335 open
  assert.match(out, /unparsed 0/, out);
});

test('stale-blockers: blocked-by external: is unresolvable by design — never a finding', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by external: waiting on the vendor contract\n')],
    views: {},
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
  assert.match(out, /swept 1 open issues, 0 blocked-by refs/);
});

test('stale-blockers: blocked-by none and an absent Dependencies section are clean', () => {
  const env = ghStub({
    issues: [
      issue(12, '## Dependencies\nblocked-by none · blocks #21\n'),
      issue(13, 'No dependencies section at all.\n'),
    ],
    views: {},
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('stale-blockers: unparseable tokens count in the census without becoming findings', () => {
  // Policy forbids prose blocker claims; the detector surfaces the FORMAT
  // drift (so the normalization issue can see it) without inventing a sixth
  // class or failing anyone.
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by the-vendor-portal · blocked-by #9\n')],
    views: { 'fixture/repo#9': { state: 'OPEN', body: '', labels: [] } },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /unparsed 1/, out);
  assert.match(out, /OK:/);
});

test('stale-blockers: the Dependencies block ends at the next heading (line scan, no \\Z)', () => {
  // Regression guard for the bug class named in the script header: a regex
  // `(?=^##\s|\Z)` never terminates, so the parser would read blocked-by
  // tokens out of LATER sections. This body asserts a blocker only after
  // Dependencies has ended — a correct parser sees zero refs.
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nnone\n\n## Status\nready — 2026-08-18. Was blocked-by #9 until it shipped.\n')],
    views: {},
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /swept 1 open issues, 0 blocked-by refs/, out);
});

test('stale-blockers: backticked cross-repo refs parse (live corpus: ai-fleet #1428–#1430)', () => {
  // The credential-revocation children carry `` `HopSkipInc/analytics-infrastructure#237` `` —
  // the backtick made the token unparseable and the run reported the estate's
  // highest-risk class as absent. This shape is the one the probe exists for.
  const env = ghStub({
    issues: [issue(1430, '## Dependencies\nchild-of #1426 · blocked-by #1429 `HopSkipInc/analytics-infrastructure#237`\n', ['P1', 'status:blocked'])],
    views: {
      'fixture/repo#1429': { state: 'OPEN', body: '', labels: [] },
      'HopSkipInc/analytics-infrastructure#237': { state: 'CLOSED', body: '', labels: [] },
    },
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /#1430 \[phantom\] blocked-by HopSkipInc\/analytics-infrastructure#237.*\[P1 dependent\]/, out);
});

test('stale-blockers: a ref inside parens is not stripped with annotation (live corpus: ai-fleet #957)', () => {
  // "#961 (web CI gates, blocked-by #960)" — stripping parentheticals before
  // parsing removes this issue's only blocker and the phantom goes invisible.
  const env = ghStub({
    issues: [issue(957, '## Dependencies\nChildren: #961 (web CI gates, blocked-by #960)\n', ['P1'])],
    views: { 'fixture/repo#960': { state: 'CLOSED', body: '', labels: [] } },
  });
  const { out } = run(env);
  assert.match(out, /#957 \[phantom\] blocked-by #960/, out);
});

test('stale-blockers: annotation re-naming the blocker does not double-count (live corpus: ai-fleet #1465)', () => {
  // "blocked-by #1460 (… the predicate #1460 establishes)" — one claim, one
  // ref; the annotation's second mention must not produce two findings.
  const env = ghStub({
    issues: [issue(1465, '## Dependencies\nblocked-by #1460 (subject binding — this widens the predicate #1460 establishes)\n')],
    views: { 'fixture/repo#1460': { state: 'CLOSED', body: '', labels: [] } },
  });
  const { out } = run(env);
  assert.equal((out.match(/#1465 \[phantom\]/g) ?? []).length, 1, out);
  assert.match(out, /census: phantom 1/);
});

test('stale-blockers: "blocked-by nothing" is the corpus\'s other spelling of none', () => {
  // Three live uses in ai-fleet on the 2026-08-18 run. Counting them as
  // unparsed would bury the normalization signal in house dialect.
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nblocked-by nothing — the spike gate is retired\n')],
    views: {},
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
  assert.match(out, /unparsed 0/);
});

test('stale-blockers: a backlog with no blocked-by refs at all is clean and says so', () => {
  const env = ghStub({
    issues: [issue(12, '## Dependencies\nnone\n', ['status:ready'])],
    views: {},
  });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /OK: every blocked-by ref resolves/);
});
