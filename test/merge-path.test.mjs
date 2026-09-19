// Fixture tests for templates/scripts/check-merge-path.mjs.
//
// Same rule as every script here (docs/testing-strategy.md §1): each class fires
// on a known-bad fixture and clears on a known-good one. The paired case is what
// proves the branch is load-bearing — a class whose detector was deleted would
// pass its good case and fail its bad one.
//
// Two contracts get tested in both directions beyond the class pairs:
//   - SKIPPED never reads as clean, and makes a gated run exit 2 rather than 0.
//     A check that fails open reads as evidence (the R6 contract in
//     check-issue-routing.mjs).
//   - `ungated` is the ONLY blocking class. The history classes are
//     threshold-based and report-only until calibrated, so a repository with a
//     decorative approval gate must still exit 0 under --gate.
//
// `gh` is stubbed on PATH by a data-driven node stub: GH_STUB (path to a JSON
// spec) holds the repository settings, the effective branch rules, the closed
// pull request list, and per-number review arrays. Any of them may be the string
// "unreachable" to simulate an API failure.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO_ROOT, 'templates', 'scripts', 'check-merge-path.mjs');

const STUB_SOURCE = `#!/usr/bin/env node
// Data-driven gh stub. Spec (JSON at $GH_STUB):
//   { "repo": {...}|"unreachable",
//     "rules": [...]|"unreachable",
//     "pulls": [...]|"unreachable",
//     "reviews": { "7": [...]|"unreachable" } }
const spec = JSON.parse(require('fs').readFileSync(process.env.GH_STUB, 'utf8'));
const args = process.argv.slice(2);
if (args[0] !== 'api') { process.stderr.write('gh stub: unhandled ' + args.join(' ') + '\\n'); process.exit(1); }
const path = args[1];
function emit(v, what) {
  if (v === undefined || v === 'unreachable') {
    process.stderr.write('gh: ' + what + ' could not be read (HTTP 404)\\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(v));
}
const review = path.match(/\\/pulls\\/(\\d+)\\/reviews$/);
if (review) emit((spec.reviews || {})[review[1]], 'reviews');
else if (path.includes('/rules/branches/')) emit(spec.rules, 'rules');
else if (path.includes('/pulls?')) emit(spec.pulls, 'pulls');
else emit(spec.repo, 'repo');
`;

function stub(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-merge-path-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), STUB_SOURCE);
  chmodSync(join(bin, 'gh'), 0o755);
  const specPath = join(dir, 'spec.json');
  writeFileSync(specPath, JSON.stringify(spec));
  return { PATH: `${bin}:${process.env.PATH}`, GH_STUB: specPath, MERGE_PATH_REPO: 'fixture/repo' };
}

function run(spec, args = []) {
  const env = stub(spec);
  let status = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [SCRIPT, '--json', ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    status = err.status ?? 1;
    stdout = (err.stdout ?? '').toString();
  }
  return { status, stdout, json: JSON.parse(stdout) };
}

const classes = (r) => r.json.findings.map((f) => f.class);

// ---------------------------------------------------------------- fixtures

/** A repository configured the way merge-path.md §3 prescribes. */
const GOOD_REPO = {
  default_branch: 'main',
  allow_auto_merge: true,
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  delete_branch_on_merge: true,
};

const GOOD_RULES = [
  { type: 'pull_request', parameters: { required_approving_review_count: 0 } },
  { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }] } },
];

/** n merged pull requests; `self` merges each by its own author. */
function pulls(n, { self = false } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    number: i + 1,
    merged_at: '2026-09-01T00:00:00Z',
    user: { login: 'author' },
    merged_by: { login: self ? 'author' : 'someone-else' },
  }));
}

function reviews(n, { approved = false } = {}) {
  const out = {};
  for (let i = 1; i <= n; i += 1) out[String(i)] = approved ? [{ state: 'APPROVED' }] : [{ state: 'COMMENTED' }];
  return out;
}

const APPROVALS_REQUIRED = [
  { type: 'pull_request', parameters: { required_approving_review_count: 1 } },
  { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }] } },
];

// ------------------------------------------------------------------ ungated

test('ungated fires: a pull request is required and no status check is', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0 } }],
    pulls: [],
  });
  assert.ok(classes(r).includes('ungated'));
});

test('ungated clears: a required status check is present', () => {
  const r = run({ repo: GOOD_REPO, rules: GOOD_RULES, pulls: [] });
  assert.ok(!classes(r).includes('ungated'));
});

test('ungated is the only blocking class: --gate exits 1', () => {
  const r = run(
    {
      repo: GOOD_REPO,
      rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0 } }],
      pulls: [],
    },
    ['--gate'],
  );
  assert.equal(r.status, 1);
});

// ---------------------------------------------------------------- click-tax

test('click-tax fires: required checks exist but auto-merge is off', () => {
  const r = run({ repo: { ...GOOD_REPO, allow_auto_merge: false }, rules: GOOD_RULES, pulls: [] });
  assert.ok(classes(r).includes('click-tax'));
});

test('click-tax clears: auto-merge is on', () => {
  const r = run({ repo: GOOD_REPO, rules: GOOD_RULES, pulls: [] });
  assert.ok(!classes(r).includes('click-tax'));
});

// ----------------------------------------------------------- merge-friction

test('merge-friction fires: more than one merge method enabled', () => {
  const r = run({ repo: { ...GOOD_REPO, allow_merge_commit: true }, rules: GOOD_RULES, pulls: [] });
  assert.ok(classes(r).includes('merge-friction'));
});

test('merge-friction fires: head branches are not deleted on merge', () => {
  const r = run({ repo: { ...GOOD_REPO, delete_branch_on_merge: false }, rules: GOOD_RULES, pulls: [] });
  assert.ok(classes(r).includes('merge-friction'));
});

test('merge-friction clears: one method, heads deleted', () => {
  const r = run({ repo: GOOD_REPO, rules: GOOD_RULES, pulls: [] });
  assert.ok(!classes(r).includes('merge-friction'));
});

// ------------------------------------------------------ self-authored-block

test('self-authored-block fires: approvals required and merges are self-merged', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: APPROVALS_REQUIRED,
    pulls: pulls(4, { self: true }),
    reviews: reviews(4, { approved: true }),
  });
  assert.ok(classes(r).includes('self-authored-block'));
});

test('self-authored-block clears: a different account merged', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: APPROVALS_REQUIRED,
    pulls: pulls(4, { self: false }),
    reviews: reviews(4, { approved: true }),
  });
  assert.ok(!classes(r).includes('self-authored-block'));
});

// ------------------------------------------------------ decorative-approval

test('decorative-approval fires: approvals required, merges land unapproved', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: APPROVALS_REQUIRED,
    pulls: pulls(4),
    reviews: reviews(4, { approved: false }),
  });
  assert.ok(classes(r).includes('decorative-approval'));
});

test('decorative-approval clears: every sampled merge carried an approval', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: APPROVALS_REQUIRED,
    pulls: pulls(4),
    reviews: reviews(4, { approved: true }),
  });
  assert.ok(!classes(r).includes('decorative-approval'));
});

test('decorative-approval does not fire when no approval is required', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: GOOD_RULES, // required_approving_review_count: 0
    pulls: pulls(4),
    reviews: reviews(4, { approved: false }),
  });
  assert.ok(!classes(r).includes('decorative-approval'));
});

test('a decorative approval gate does NOT block: report-only until calibrated', () => {
  const r = run(
    {
      repo: GOOD_REPO,
      rules: APPROVALS_REQUIRED,
      pulls: pulls(4),
      reviews: reviews(4, { approved: false }),
    },
    ['--gate'],
  );
  assert.ok(classes(r).includes('decorative-approval'));
  assert.equal(r.status, 0);
});

// -------------------------------------------------------------- unreachable

test('unreachable is reported SKIPPED and never reads as clean', () => {
  const r = run({ repo: 'unreachable', rules: 'unreachable', pulls: 'unreachable' });
  assert.ok(r.json.unreachable.length > 0);
  assert.ok(!r.stdout.includes('"findings": []') || r.json.unreachable.length > 0);
});

test('unreachable makes a gated run exit 2, not 0', () => {
  const r = run({ repo: 'unreachable', rules: 'unreachable', pulls: 'unreachable' }, ['--gate']);
  assert.equal(r.status, 2);
});

test('unreachable takes precedence over a blocking finding: exit 2, not 1', () => {
  const r = run(
    {
      repo: GOOD_REPO,
      rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0 } }],
      pulls: 'unreachable',
    },
    ['--gate'],
  );
  assert.ok(classes(r).includes('ungated'));
  assert.equal(r.status, 2);
});

test('an unreadable review array never counts toward a clean history sample', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: APPROVALS_REQUIRED,
    pulls: pulls(2),
    reviews: { 1: 'unreachable', 2: 'unreachable' },
  });
  assert.equal(r.json.census.sampled_merges, 0);
  assert.ok(r.json.unreachable.length > 0);
});

// --------------------------------------------------------------- probe mode

test('probe mode exits 0 even with a blocking finding', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0 } }],
    pulls: [],
  });
  assert.ok(classes(r).includes('ungated'));
  assert.equal(r.status, 0);
});

test('a fully conformant repository reports clean', () => {
  const r = run({
    repo: GOOD_REPO,
    rules: GOOD_RULES,
    pulls: pulls(3),
    reviews: reviews(3, { approved: true }),
  });
  assert.deepEqual(r.json.findings, []);
  assert.deepEqual(r.json.unreachable, []);
});
