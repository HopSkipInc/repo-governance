// Fixture tests for templates/scripts/check-backlog-currency.mjs — Layer 1 of
// the backlog-grooming regime (templates/backlog-grooming.md). Ported with the
// template from ai-fleet, where they were the 2026-08-20 incident reconstruction
// the 2026-08-21 grooming-regime prompt's §6 self-test required: "a regime
// that cannot catch the incident that motivated it is not done". Each fixture
// issue reproduces one observed failure class (issue numbers are ai-fleet's);
// the known-good rows assert the lint stays silent — the paired case is what
// proves each detector branch is load-bearing (docs/testing-strategy.md §1).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO, 'templates', 'scripts', 'check-backlog-currency.mjs');
const FIXTURES = resolve(REPO, 'test', 'fixtures', 'backlog-currency');
const { analyze, loadGraphFixtures } = await import(SCRIPT);

const graph = { ...loadGraphFixtures(FIXTURES), __fixtures: true };
const { findings, census } = analyze(graph);

const hits = (issue, cls) => findings.filter((f) => f.issue === issue && f.cls === cls);

test('C1 — fully delivered epic still open (#1097), and the not_planned variant (#1112)', () => {
  assert.equal(hits(1097, 'C1').length, 1);
  assert.match(hits(1097, 'C1')[0].message, /all 3 children delivered/);
  assert.equal(hits(1112, 'C1').length, 1);
  assert.match(hits(1112, 'C1')[0].message, /closed without delivery/);
});

test('C2 — closed-blocker citations: plain (#1252, #1533) and disclosure-without-correction (#1922)', () => {
  assert.equal(hits(1252, 'C2').length, 1);
  assert.equal(hits(1533, 'C2').length, 1);
  assert.equal(hits(1922, 'C2').length, 1);
  assert.match(hits(1922, 'C2')[0].message, /status surface still asserts/);
});

test('C2 ownership — a `blocked-by` line inside ## Dependencies is check-stale-blockers\' grammar, not this lint\'s (#1426)', () => {
  assert.equal(hits(1426, 'C2').length, 0);
});

test('C2 silent when the blocker is genuinely open (#7001)', () => {
  assert.equal(hits(7001, 'C2').length, 0);
});

test('C3 — label half (#5001) and ADR half (#1426)', () => {
  assert.equal(hits(5001, 'C3').length, 1);
  assert.match(hits(5001, 'C3')[0].message, /all 1 declared blockers are closed/);
  assert.equal(hits(1426, 'C3').length, 1);
  assert.match(hits(1426, 'C3')[0].message, /Resolves:/);
});

test('C4 — unlinked declared child (#989) and unlinked declared parent (#2001) fire when the parent\'s graph is in use', () => {
  assert.equal(hits(989, 'C4').length, 1);
  assert.match(hits(989, 'C4')[0].message, /#1002/);
  assert.equal(hits(2001, 'C4').length, 1);
  assert.match(hits(2001, 'C4')[0].message, /#2002/);
});

test('C4 adoption guard — declarations on a parent with no linked sub-issues are silent (#6001, #1922)', () => {
  // v1.1 tuning (first-run false-positive review): the estate declares
  // hierarchy in prose in hundreds of places but links ~19 epics, so C4 fires
  // only where the graph is in use — otherwise it reports non-adoption as a
  // 325-finding wall instead of drift.
  assert.equal(hits(6001, 'C4').length, 0);
  assert.equal(hits(1922, 'C4').length, 0);
});

test('C4 silent under the closed-as-superseded convention (#3001)', () => {
  assert.equal(hits(3001, 'C4').length, 0);
});

test('C5 — unfiled-work markers (#1426, #1454)', () => {
  assert.equal(hits(1426, 'C5').length, 1);
  assert.equal(hits(1454, 'C5').length, 1);
});

test('C6 — milestone row claims blocked while every cited issue is closed (#6001)', () => {
  assert.equal(hits(6001, 'C6').length, 1);
});

test('TRIGGER — child closed after the epic body was last touched (#1097), silent when fresh (#1112)', () => {
  assert.equal(hits(1097, 'TRIGGER').length, 1);
  assert.equal(hits(1097, 'TRIGGER')[0].severity, 'info');
  assert.equal(hits(1112, 'TRIGGER').length, 0);
});

test('known-good rows stay silent (#4000 partially delivered, #3001, #7001, #8001 stays-open)', () => {
  for (const n of [4000, 3001, 7001, 8001]) {
    assert.deepEqual(findings.filter((f) => f.issue === n), [], `expected silence on #${n}`);
  }
});

test('census counts every class', () => {
  // C3 3 and C4 3 as of the v1.2 fixtures: #1927 adds the true-positive C3 that
  // guards against over-correcting the two false positives, and #1793 adds the
  // one-per-epic C4 non-adoption case. #2031 and #262 deliberately add none.
  assert.deepEqual(census, { C1: 2, C2: 3, C3: 4, C4: 3, C5: 2, C6: 1, TRIGGER: 1 });
});

// ── v1.2 corrections (2026-09-06) — the three defects the 2026-08-31 run's
// C3 findings exposed when reviewed by hand against the tree.

test('C3 — a cross-repo blocker never resolves against this repo (#2031)', () => {
  // `HopSkipInc/analytics-infrastructure#509` is open upstream; ai-fleet's own
  // #509 is closed. The naive /#(\d+)/g read the latter and called a blocked
  // P1 unblocked. Reverting REF to the bare pattern fails this test.
  assert.equal(hits(2031, 'C3').length, 0);
});

test('C3 — a coordination ref in Dependencies is not a declared blocker (#262)', () => {
  // "#146 … shares the McpClient implementation — coordinate" is context.
  // Dropping the BLOCKER_LINE filter fails this test.
  assert.equal(hits(262, 'C3').length, 0);
});

test('C3 — a genuinely cleared blocker still fires (#1927)', () => {
  // The guard against the two false positives must not silence the true one.
  assert.equal(hits(1927, 'C3').length, 1);
  assert.match(hits(1927, 'C3')[0].message, /all 1 declared blockers are closed/);
});

test('C4 — an epic that declares children and links none fires exactly once (#1793)', () => {
  // v1.1's in-use guard silenced zero-link epics entirely, which hid the three
  // largest trees on the board. One finding per epic, never one per child.
  const f = hits(1793, 'C4');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /declares 3 children in prose and links none/);
});

test('C3 — the `Blocker:` and `waiting on` grammars count as declared blockers (#4031)', () => {
  // Review finding on PR #2558: the first BLOCKER_LINE alternation covered
  // neither form, so C3 would have gone silent on an issue declaring its block
  // that way — a new false negative in the same direction as the fix. Dropping
  // `blocker` or `waiting on` from the alternation fails this test.
  assert.equal(hits(4031, 'C3').length, 1);
  assert.match(hits(4031, 'C3')[0].message, /all 2 declared blockers are closed/);
});

// ── template-level contracts (added at extraction, 2026-11-04) ──────────────

test('CLI fixture mode prints the census line and exits 0 in probe mode', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--fixtures', FIXTURES], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^census: C1=2 C2=3 C3=4 C4=3 C5=2 C6=1 TRIGGER=1 open-issues=\d+$/m);
});

test('--gate exits 1 on the fixture graph (C1/C3/C4 present) — the gate has teeth', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--fixtures', FIXTURES, '--gate'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});

test('gh absent — SKIPPED, never a clean census; exit 0 in probe mode, 2 with --gate', () => {
  const env = { ...process.env, PATH: '/nonexistent' };
  const probe = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env });
  assert.equal(probe.status, 0);
  assert.match(probe.stdout, /^SKIPPED check-backlog-currency/);
  assert.doesNotMatch(probe.stdout, /census:/);
  const gated = spawnSync(process.execPath, [SCRIPT, '--gate'], { encoding: 'utf8', env });
  assert.equal(gated.status, 2, 'a gated run that cannot read the backlog must not exit 0');
});

test('a probe\'s own rolling issue is never linted — the lint does not report its previous run', () => {
  // Review finding (2026-11-04): the rolling issue's header line names "C5
  // named-but-unfiled work" and its fenced output echoes every finding, so
  // linting it added a C5 per run and re-fired each echoed (unfiled) finding.
  const rolling = (number, label) => ({
    number, title: 'probe — rolling findings', state: 'open',
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-14T08:31:00Z',
    labels: [{ name: label }],
    body: 'Classes: C4 declared hierarchy unlinked · C5 named-but-unfiled work\n```\nprobe #9 C5 names work with no issue filed: "(unfiled) foo"\n```',
  });
  const withRolling = {
    ...graph,
    issues: [...graph.issues, rolling(9001, 'backlog-currency-probe'), rolling(9002, 'stale-blocker-probe')],
  };
  const out = analyze(withRolling);
  assert.deepEqual(out.findings.filter((f) => f.issue === 9001 || f.issue === 9002), []);
  assert.deepEqual(out.census, census, 'the census is unchanged by probe output');
  // The same body on an ordinary issue still fires — the skip is the label, not the text.
  const plain = analyze({ ...graph, issues: [...graph.issues, { ...rolling(9003, 'chore'), labels: [] }] });
  assert.ok(plain.findings.some((f) => f.issue === 9003 && f.cls === 'C5'));
});
