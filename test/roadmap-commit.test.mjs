// Fixture tests for templates/scripts/check-roadmap-commit.mjs — the weekly
// commitment gate of the backlog-grooming regime (templates/backlog-grooming.md
// §5). Ported with the template from ai-fleet (#3339, #3600 — ai-fleet's issue
// numbers). Hermetic: no gh, no network, no git (the CLI cases pass --file
// only, which skips the diff gate).
//
// Contracts:
//   1. valid list        — "Committed YYYY-MM-DD: #N, #N" is ok, refs captured.
//   2. capacity marker   — "none — at capacity" (all three dash spellings) is ok
//                          and machine-distinguishable from an empty section.
//   3. absent / empty    — a lapse; both fail, with distinct verdicts.
//   4. malformed         — bad date, "none" without the capacity phrase, no refs.
//   5. multiple          — more than one section is rejected.
//   6. stale date        — a commitment dated before the PR's creation fails on
//                          the commitment day (Monday); any other day's PR
//                          carries the block forward.
//   7. marker parity     — the gate, the policy's docs/roadmap.md skeleton, and
//                          the skeleton's placeholder (which must FAIL) agree.
//   8. skill scope       — roadmap-narrative's marked-section list is exactly the
//                          three narrative sections and forbids roadmap-commit.
//   9. CLI               — exit 0 on valid/capacity, 1 on absent/empty/stale.
//  10. commitment day    — weekdayInEstate() in the default UTC clock and in an
//                          explicit --tz zone (ai-fleet's America/New_York).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO, 'templates', 'scripts', 'check-roadmap-commit.mjs');
const SKILL = resolve(REPO, 'templates', 'skills', 'roadmap-narrative', 'SKILL.md');
const POLICY = resolve(REPO, 'templates', 'backlog-grooming.md');
const {
  SECTION_START,
  SECTION_END,
  COMMITMENT_DOW,
  DEFAULT_TZ,
  dateInEstate,
  findSections,
  evaluateCommitSection,
  weekdayInEstate,
} = await import(SCRIPT);

const wrap = (body) => `# Roadmap\n\n${SECTION_START}\n${body}\n${SECTION_END}\n`;

test('1. valid list — a dated reference list is ok', () => {
  const r = evaluateCommitSection(wrap('Committed 2026-10-06: #1426, #1471'));
  assert.equal(r.verdict, 'ok');
  assert.equal(r.date, '2026-10-06');
  assert.deepEqual(r.refs, [1426, 1471]);
  assert.equal(r.atCapacity, false);
});

test('2. capacity marker — all dash spellings are ok and machine-distinguishable', () => {
  for (const dash of ['—', '--', ' - ']) {
    const r = evaluateCommitSection(wrap(`Committed 2026-10-06: none ${dash} at capacity`));
    assert.equal(r.verdict, 'ok', `dash=${JSON.stringify(dash)}`);
    assert.equal(r.atCapacity, true);
    assert.equal(r.refs.length, 0);
  }
});

test('3. absent vs empty — both fail, with distinct verdicts', () => {
  assert.equal(evaluateCommitSection('# Roadmap\n\nNo markers here.').verdict, 'absent');
  assert.equal(evaluateCommitSection(wrap('')).verdict, 'empty');
  assert.equal(evaluateCommitSection(wrap('\n\n')).verdict, 'empty');
});

test('4. malformed — bad date, bare "none", and a ref-less non-capacity line', () => {
  assert.equal(evaluateCommitSection(wrap('Committed not-a-date: #1')).verdict, 'malformed');
  assert.equal(evaluateCommitSection(wrap('Committed 2026-10-06: none')).verdict, 'malformed');
  assert.equal(evaluateCommitSection(wrap('Committed 2026-10-06: ')).verdict, 'malformed');
});

test('5. multiple — more than one section is rejected', () => {
  const doc = `${wrap('Committed 2026-10-06: #1')}${wrap('Committed 2026-10-07: #2')}`;
  assert.equal(evaluateCommitSection(doc).verdict, 'multiple');
  assert.equal(findSections(doc).length, 2);
});

test('6. stale date — enforced on the commitment day, relaxed on regeneration days', () => {
  const doc = wrap('Committed 2026-10-05: #1426');
  // Monday 2026-10-12 is the weekly commitment day — a prior commitment is stale.
  assert.equal(evaluateCommitSection(doc, { prCreated: '2026-10-12' }).verdict, 'stale');
  // Tuesday 2026-10-13 is a regeneration day — the Monday block is carried forward.
  assert.equal(evaluateCommitSection(doc, { prCreated: '2026-10-13' }).verdict, 'ok');
  // The on-or-after boundary (same day on the commitment day) passes.
  assert.equal(evaluateCommitSection(doc, { prCreated: '2026-10-05' }).verdict, 'ok');
  // No prCreated supplied (merge queue / local) — the date check is off.
  assert.equal(evaluateCommitSection(doc).verdict, 'ok');
});

test('7. marker parity — the gate and the policy skeleton agree; the placeholder fails', () => {
  // docs/roadmap.md is created once from the skeleton in the policy's §8. If the
  // skeleton's markers drifted from the gate's, a fresh install would carry a
  // section the gate cannot see.
  const policy = readFileSync(POLICY, 'utf8');
  const skeleton = policy.split('The `docs/roadmap.md` skeleton:')[1];
  assert.ok(skeleton, 'policy §8 carries the docs/roadmap.md skeleton');
  assert.ok(skeleton.includes(SECTION_START) && skeleton.includes(SECTION_END));
  // The skeleton's YYYY-MM-DD placeholder is deliberately NOT valid grammar —
  // the policy promises a PR that leaves it in place fails.
  const block = skeleton.slice(0, skeleton.indexOf(SECTION_END) + SECTION_END.length);
  assert.equal(evaluateCommitSection(block).verdict, 'malformed');
  for (const kind of ['sequence', 'horizons', 'observations']) {
    assert.ok(skeleton.includes(`<!-- roadmap-narrative:${kind}:start -->`), `skeleton has ${kind}`);
  }
});

test('8. skill scope — roadmap-narrative writes the three narrative sections, not roadmap-commit', () => {
  const md = readFileSync(SKILL, 'utf8');
  const kinds = [...md.matchAll(/roadmap-narrative:([a-z_]+):start/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(kinds)].sort(), ['horizons', 'observations', 'sequence']);
  assert.ok(!kinds.includes('commit'), 'the skill must not list roadmap-commit as one it writes');
  // A machine-readable assertion, not a vibe: the skill must explicitly forbid
  // writing the human-owned section.
  assert.match(md, /never write[^\n]*roadmap-commit/i);
});

test('9. CLI — exit 0 on valid/capacity, 1 on absent/empty/stale/malformed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roadmap-commit-'));
  const file = (name, body) => {
    const p = join(dir, name);
    writeFileSync(p, body);
    return p;
  };
  const run = (path, extra = []) => {
    const r = spawnSync(process.execPath, [SCRIPT, '--file', path, ...extra], { encoding: 'utf8' });
    return r.status;
  };

  assert.equal(run(file('valid.md', wrap('Committed 2026-10-10: #3339'))), 0);
  assert.equal(run(file('capacity.md', wrap('Committed 2026-10-10: none — at capacity'))), 0);
  assert.equal(run(file('absent.md', '# Roadmap\n')), 1);
  assert.equal(run(file('empty.md', wrap(''))), 1);
  assert.equal(run(file('malformed.md', wrap('Committed 2026-10-10: none'))), 1);
  assert.equal(
    run(file('stale.md', wrap('Committed 2026-10-05: #3339')), ['--pr-created', '2026-10-12']),
    1,
  );
  // A regeneration day (Tuesday) carries the Monday block forward — exit 0 (#3600).
  assert.equal(
    run(file('carried.md', wrap('Committed 2026-10-05: #3339')), ['--pr-created', '2026-10-13']),
    0,
  );
});

test('10. commitment day — UTC by default, an explicit zone when given', () => {
  // The weekly commitment day is Monday (policy §3).
  assert.equal(COMMITMENT_DOW, 1);
  assert.equal(DEFAULT_TZ, 'UTC');
  assert.equal(weekdayInEstate('2026-10-12'), 1); // Monday (date-only: no shift)
  assert.equal(weekdayInEstate('2026-10-13'), 2); // Tuesday
  assert.equal(weekdayInEstate('2026-10-12T09:00:00Z'), 1); // the template's Monday 09:00 UTC run
  // 02:00 UTC Tuesday is still Monday evening in New York — the --tz case.
  assert.equal(weekdayInEstate('2026-10-13T02:00:00Z'), 2);
  assert.equal(weekdayInEstate('2026-10-13T02:00:00Z', 'America/New_York'), 1);
  assert.equal(weekdayInEstate('2026-10-13T09:00:00Z', 'America/New_York'), 2);

  // A Tuesday PR carrying Monday's block passes; the Monday PR carrying the
  // previous week's block is the lapse the stale rule exists to catch.
  const mondayBlock = wrap('Committed 2026-10-12: #3314, #3323');
  assert.equal(evaluateCommitSection(mondayBlock, { prCreated: '2026-10-13T09:00:31Z' }).verdict, 'ok');
  assert.equal(evaluateCommitSection(mondayBlock, { prCreated: '2026-10-12T09:00:31Z' }).verdict, 'ok');
  const lastWeek = wrap('Committed 2026-10-05: #1');
  assert.equal(evaluateCommitSection(lastWeek, { prCreated: '2026-10-12T09:00:31Z' }).verdict, 'stale');
  // The zone decides the day: 02:00 UTC Tuesday is Monday in New York.
  assert.equal(evaluateCommitSection(lastWeek, { prCreated: '2026-10-13T02:00:00Z' }).verdict, 'ok');
  assert.equal(
    evaluateCommitSection(lastWeek, { prCreated: '2026-10-13T02:00:00Z', tz: 'America/New_York' }).verdict,
    'stale',
  );
  // An unknown zone fails closed on the rule (treated as the commitment day).
  assert.equal(evaluateCommitSection(lastWeek, { prCreated: '2026-10-13T09:00:00Z', tz: 'Not/AZone' }).verdict, 'stale');
});

test('11. CLI --tz — the flag reaches the weekday rule', () => {
  const dir = mkdtempSync(join(tmpdir(), 'roadmap-commit-tz-'));
  const p = join(dir, 'r.md');
  writeFileSync(p, wrap('Committed 2026-10-05: #3339'));
  const run = (extra) => spawnSync(process.execPath, [SCRIPT, '--file', p, ...extra], { encoding: 'utf8' }).status;
  assert.equal(run(['--pr-created', '2026-10-13T02:00:00Z']), 0);
  assert.equal(run(['--pr-created', '2026-10-13T02:00:00Z', '--tz', 'America/New_York']), 1);
  assert.equal(run(['--pr-created', '2026-10-13T02:00:00Z', '--tz=America/New_York']), 1);
});

test('12. same clock for weekday and date — a Monday-evening PR carrying that Monday\'s block is ok', () => {
  // Review finding (2026-11-04): the weekday was read in --tz while the date was
  // compared in UTC, so a block dated Monday 2026-11-09 failed as stale on a PR
  // opened Monday 21:00 ET (02:00 UTC Tuesday) — the exact case --tz exists for.
  const ET = 'America/New_York';
  const thisMonday = wrap('Committed 2026-11-09: #1');
  assert.equal(evaluateCommitSection(thisMonday, { prCreated: '2026-11-10T02:00:00Z', tz: ET }).verdict, 'ok');
  assert.equal(evaluateCommitSection(thisMonday, { prCreated: '2026-11-10T02:00:00Z', tz: 'America/Los_Angeles' }).verdict, 'ok');
  // …while last Monday's block on that same PR is still the lapse.
  assert.equal(evaluateCommitSection(wrap('Committed 2026-11-02: #1'), { prCreated: '2026-11-10T02:00:00Z', tz: ET }).verdict, 'stale');
  assert.equal(dateInEstate('2026-11-10T02:00:00Z', ET), '2026-11-09');
  assert.equal(dateInEstate('2026-11-10T02:00:00Z'), '2026-11-10'); // UTC default
  assert.equal(dateInEstate('2026-11-10'), '2026-11-10'); // date-only: no shift
});

test('13. CLI --base that cannot be diffed — exit 2 with the fix named, never a guess', () => {
  // Review finding (2026-11-04): an undeterminable diff fell through to
  // evaluating the file, so a shallow checkout blocked unrelated PRs whenever
  // the block was stale. It is a configuration error and says so.
  const dir = mkdtempSync(join(tmpdir(), 'roadmap-commit-base-'));
  const p = join(dir, 'r.md');
  writeFileSync(p, wrap('Committed 2026-10-05: #3339'));
  const r = spawnSync(process.execPath, [SCRIPT, '--file', p, '--base', '0000000000000000000000000000000000000000', '--pr-created', '2026-10-12'], { encoding: 'utf8', cwd: REPO });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /fetch-depth: 0/);
});
