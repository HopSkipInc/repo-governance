// Fixture tests for templates/scripts/roadmap-deadman.mjs — the decision logic
// behind templates/workflows/roadmap-deadman.yml, the watchdog of the
// backlog-grooming regime's weekly run (templates/backlog-grooming.md §7).
// Ported with the template from ai-fleet (#3093, #3728 — ai-fleet's numbers)
// and re-cut for the weekly cadence at extraction (2026-11-04).
//
// Why this matters: a deadman that never fires is indistinguishable from a
// healthy system. The stale/fresh boundary (age >= MAX_AGE_DAYS) is the whole
// contract, and getting it wrong is silent — ai-fleet #3728 was a
// strictly-greater boundary that reported the run fresh on exactly the day its
// outage first became observable. Hermetic: no gh, no network.
//
// Two parity tests pin the workflow files to this helper, because the fire
// boundary and the matched title each live in two places: MAX_AGE_DAYS in
// roadmap-deadman.yml, and the PR title in roadmap-groom.yml.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const HELPER = resolve(REPO, 'templates', 'scripts', 'roadmap-deadman.mjs');
const DEADMAN_YML = resolve(REPO, 'templates', 'workflows', 'roadmap-deadman.yml');
const GROOM_YML = resolve(REPO, 'templates', 'workflows', 'roadmap-groom.yml');
const {
  ageInDays, newestArtifact, classifyFreshness,
  weeklyPrSearch, selectArtifactPrs, newestArtifactPrDate,
  GENERATED_FILE, WEEKLY_PR_TITLE,
} = await import(HELPER);

const MAX = 8; // the weekly window — pinned to the workflow by the parity test below

// ── parity with the workflow files ───────────────────────────────────────────

test('parity — roadmap-deadman.yml fires at the MAX this suite tests', () => {
  const yml = readFileSync(DEADMAN_YML, 'utf8');
  const m = yml.match(/^\s*MAX_AGE_DAYS:\s*(\d+)\s*$/m);
  assert.ok(m, 'MAX_AGE_DAYS is declared in the deadman workflow');
  assert.equal(Number(m[1]), MAX);
});

test('parity — roadmap-groom.yml opens its PR under the title the deadman matches', () => {
  const yml = readFileSync(GROOM_YML, 'utf8');
  const m = yml.match(/--title "([^"]+)"/);
  assert.ok(m, 'roadmap-groom.yml passes an explicit --title');
  assert.ok(m[1].startsWith(WEEKLY_PR_TITLE), `"${m[1]}" must start with "${WEEKLY_PR_TITLE}"`);
});

test('parity — roadmap-deadman.yml takes its PR search from the helper, never a copy', () => {
  // Review finding (2026-11-04): the workflow hard-coded its own search string,
  // so the weeklyPrSearch() test below passed whatever the workflow searched.
  const yml = readFileSync(DEADMAN_YML, 'utf8');
  assert.match(yml, /weeklyPrSearch\(\)/);
  assert.doesNotMatch(yml, /--search '"roadmap-groom" in:title'/);
});

// ── newestArtifact ───────────────────────────────────────────────────────────

test('newestArtifact picks the later of the two sources', () => {
  assert.equal(newestArtifact('2026-09-01', '2026-09-15'), '2026-09-15');
  assert.equal(newestArtifact('2026-09-15', '2026-09-01'), '2026-09-15');
});

test('newestArtifact tolerates one source missing', () => {
  assert.equal(newestArtifact('2026-09-15', ''), '2026-09-15');
  assert.equal(newestArtifact('', '2026-09-15'), '2026-09-15');
});

test('a cold start (no artifact at all) reads as the epoch — maximally stale', () => {
  assert.equal(newestArtifact('', ''), '1970-01-01');
  assert.equal(newestArtifact(undefined, undefined), '1970-01-01');
});

test('newestArtifact ignores malformed dates rather than crashing on them', () => {
  assert.equal(newestArtifact('not-a-date', '2026-09-15'), '2026-09-15');
  assert.equal(newestArtifact('2026-9-1', ''), '1970-01-01'); // unpadded — not the CI format
});

// ── ageInDays ────────────────────────────────────────────────────────────────

test('ageInDays is a floor day count', () => {
  assert.equal(ageInDays('2026-11-02', '2026-11-02'), 0);
  assert.equal(ageInDays('2026-11-02', '2026-11-09'), 7);
  assert.equal(ageInDays('2026-11-02', '2026-11-10'), 8);
});

// ── the weekly fire/clear split — the contract ──────────────────────────────
// Monday 2026-11-02's run produced an artifact. The next run is Monday 11-09.

test('FRESH: the Monday artifact, read the same day', () => {
  const v = classifyFreshness({ commitDate: '', prDate: '2026-11-02', today: '2026-11-02', maxAgeDays: MAX });
  assert.equal(v.stale, false);
});

test('TOLERATED: last Monday\'s artifact on the next Monday (age 7) — the run may still be landing', () => {
  const v = classifyFreshness({ commitDate: '', prDate: '2026-11-02', today: '2026-11-09', maxAgeDays: MAX });
  assert.equal(v.ageDays, MAX - 1);
  assert.equal(v.stale, false);
});

test('FORCED: a missed Monday fires on Tuesday (age = MAX_AGE_DAYS)', () => {
  // The boundary is >=, not >: strictly-greater would stay silent on Tuesday
  // and report the outage a day late (ai-fleet #3728's defect, re-cut weekly).
  const v = classifyFreshness({ commitDate: '', prDate: '2026-11-02', today: '2026-11-10', maxAgeDays: MAX });
  assert.equal(v.ageDays, MAX);
  assert.equal(v.stale, true, 'a missed weekly run must fire the next day');
});

test('BOUNDARY+1: a day later still fires', () => {
  const v = classifyFreshness({ commitDate: '', prDate: '2026-11-02', today: '2026-11-11', maxAgeDays: MAX });
  assert.equal(v.stale, true);
});

test('a mid-week merge of the Monday PR moves the clock to the merge commit', () => {
  // Merged Wednesday: the commit date is newer than the PR date and governs.
  const v = classifyFreshness({ commitDate: '2026-11-04', prDate: '2026-11-02', today: '2026-11-11', maxAgeDays: MAX });
  assert.equal(v.newest, '2026-11-04');
  assert.equal(v.stale, false);
});

test('a fresh PR rescues a stale commit — the run is visible before the merge', () => {
  const v = classifyFreshness({ commitDate: '2026-10-01', prDate: '2026-11-09', today: '2026-11-10', maxAgeDays: MAX });
  assert.equal(v.newest, '2026-11-09');
  assert.equal(v.stale, false);
});

test('a cold start fires — nothing has ever run', () => {
  const v = classifyFreshness({ commitDate: '', prDate: '', today: '2026-11-10', maxAgeDays: MAX });
  assert.equal(v.stale, true);
});

// ── PR collection — the check a bare title-substring match misses ────────────
// A PR counts only when it is the weekly run's output: the EXACT title prefix
// AND the generated file in the diff.

const DESIGN_PR = {
  number: 3094, createdAt: '2026-11-09T10:00:00Z',
  title: 'docs: design — move the roadmap-groom run to weekly',
  files: [{ path: 'docs/backlog-grooming.md' }],
};
const WEEKLY_NO_FILE = {
  number: 3096, createdAt: '2026-11-09T09:05:00Z',
  title: 'chore(roadmap): roadmap-groom (data + narrative)',
  files: [{ path: '.github/workflows/roadmap-deadman.yml' }], // a draft whose run died
};
const WEEKLY_WITH_FILE = {
  number: 3097, createdAt: '2026-11-02T09:20:00Z',
  title: 'chore(roadmap): roadmap-groom (data + narrative)',
  files: [{ path: GENERATED_FILE }, { path: 'docs/roadmap.md' }],
};

test('the search expression is the bare substring; the exact-title + file guard is the evidence', () => {
  assert.equal(weeklyPrSearch(), '"roadmap-groom" in:title');
  assert.equal(selectArtifactPrs([DESIGN_PR]).some((p) => p.number === 3094), false);
});

test('selectArtifactPrs excludes a design PR that only mentions roadmap-groom', () => {
  assert.deepEqual(selectArtifactPrs([DESIGN_PR]), []);
});

test('selectArtifactPrs excludes a run-titled draft with no generated file', () => {
  assert.deepEqual(selectArtifactPrs([WEEKLY_NO_FILE]), []);
});

test('selectArtifactPrs keeps a run-titled PR carrying the generated file', () => {
  assert.deepEqual(selectArtifactPrs([WEEKLY_WITH_FILE]).map((p) => p.number), [3097]);
});

test('selectArtifactPrs tolerates plain-string file entries and junk input', () => {
  assert.equal(selectArtifactPrs([{ title: WEEKLY_WITH_FILE.title, createdAt: '2026-11-02T10:00:00Z', files: [GENERATED_FILE] }]).length, 1);
  assert.deepEqual(selectArtifactPrs(null), []);
  assert.deepEqual(selectArtifactPrs([{ title: 'x' }]), []);
});

test('newestArtifactPrDate ignores the design PR and the fileless draft', () => {
  assert.equal(newestArtifactPrDate([DESIGN_PR, WEEKLY_NO_FILE, WEEKLY_WITH_FILE]), '2026-11-02');
  assert.equal(newestArtifactPrDate([DESIGN_PR, WEEKLY_NO_FILE]), '');
});

test('collection feeds classification: a dead run\'s draft does not rescue a missed week', () => {
  // Monday 11-09's run died after opening its draft. On Tuesday the only real
  // artifact is the previous Monday's — the probe must fire.
  const prDate = newestArtifactPrDate([DESIGN_PR, WEEKLY_NO_FILE, WEEKLY_WITH_FILE]);
  const v = classifyFreshness({ commitDate: '', prDate, today: '2026-11-10', maxAgeDays: MAX });
  assert.equal(v.stale, true);
});
