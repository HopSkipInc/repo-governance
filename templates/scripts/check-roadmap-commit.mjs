#!/usr/bin/env node
// template: scripts/check-roadmap-commit.mjs v1.0.0 · updated 2026-11-04
/**
 * lint:roadmap-commit  [governance template — copy to <project>/scripts/]
 *
 * The gate behind the weekly commitment of the backlog-grooming regime
 * (templates/backlog-grooming.md §5). Extracted 2026-11-04 from ai-fleet, where
 * it gated the roadmap PR from 2026-10-06 (ai-fleet #3339). Issue numbers in
 * this header are ai-fleet's.
 *
 * The weekly roadmap-groom PR regenerates `docs/roadmap-data.md` and rewrites
 * the three `roadmap-narrative` marked sections of `docs/roadmap.md`. Before
 * this gate, the *commitment to work* was implied by that narrative, never
 * stated: the sequence section is the agent's RECOMMENDATION; commitment is the
 * human's DECISION, a separate record. This gate reads the one human-owned
 * marked section of `docs/roadmap.md`:
 *
 *   <!-- roadmap-commit:start -->
 *   Committed 2026-10-06: #1426, #1471
 *   <!-- roadmap-commit:end -->
 *
 * with exactly two valid outcomes:
 *   - ≥1 issue/epic reference  — `Committed YYYY-MM-DD: #1426, #1471`
 *   - the deliberate capacity marker — `Committed YYYY-MM-DD: none — at capacity`
 * An empty or absent body is a LAPSE and fails; `none — at capacity` is
 * machine-distinguishable from a forgotten one so the two never read alike.
 *
 * GRAMMAR PARITY. If anything else in the repo reads this section — ai-fleet's
 * roadmap board computes its Committed column from it — that reader and this
 * gate must agree on what a valid commitment is. A change to one without the
 * other is a defect in both.
 *
 * DIFF-SCOPED, FAIL-OPEN WHEN UNTOUCHED. A per-PR gate must be a function of the
 * PR's diff. Wire it into an always-on required job with `--base <sha>`: it
 * diffs `docs/roadmap.md` against the base and exits 0 immediately when the PR
 * does not touch it. Only a PR that edits the file is held to the commitment
 * grammar, so no unrelated PR is ever blocked by a lapsed commitment on the
 * default branch. Never path-filter the job instead: a path-triggered required
 * check leaves every unrelated PR pending forever. Run always; skip in-script.
 *
 * STALE DATE — ON THE COMMITMENT DAY ONLY. Carrying last week's commitment
 * forward unchanged must not read as a fresh decision *on the run that exists
 * to decide it*. With `--pr-created <ISO>` (CI passes the PR's creation
 * timestamp), the section's date must be on or after it **only when that
 * timestamp falls on the commitment weekday** (`COMMITMENT_DOW`, Monday, in the
 * `--tz` clock — default UTC). Any other day's PR touching `docs/roadmap.md`
 * — an on-demand narrative refresh, a hand fix — legitimately carries Monday's
 * block forward, and any well-formed block passes. ai-fleet learned this the
 * hard way: a file-scoped staleness rule failed every non-Monday roadmap PR
 * (#3600). Grammar (absent/empty/malformed) is enforced every day regardless,
 * because the section must always be parseable.
 *
 * The diff needs the base commit in the checkout (`actions/checkout` with
 * `fetch-depth: 0`). When git cannot compute it, the gate exits 2 and says so —
 * it neither guesses that the file was touched nor that it was not.
 *
 * Exit: 0 = valid (or the file is untouched by this diff) · 1 = invalid ·
 *       2 = the diff vs --base could not be computed.
 * Local use: `node scripts/check-roadmap-commit.mjs` validates the committed
 * section (no base, no fetch). `--file <path>` overrides the target.
 * CI: `node scripts/check-roadmap-commit.mjs --base <base-sha>
 *      --pr-created <pull_request.created_at> [--tz <IANA zone>]`
 */

import { readFileSync } from 'fs';
import { resolve, dirname, isAbsolute } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

export const SECTION_START = '<!-- roadmap-commit:start -->';
export const SECTION_END = '<!-- roadmap-commit:end -->';

/** `none — at capacity`, tolerant of the em-dash, `--`, and ` - ` spellings
 *  (the spellings ai-fleet's board reader accepts — keep any reader in step). */
const CAPACITY_RE = /(?:—|--|\s-\s)\s*at capacity/i;
const COMMIT_LINE_RE = /^Committed\s+(\d{4}-\d{2}-\d{2})\s*:/i;

/** The classes this gate can report. `ok` is the only passing one. */
export const VERDICTS = ['ok', 'absent', 'multiple', 'empty', 'malformed', 'stale'];

/** The weekly commitment day as a JS weekday index (0=Sun … 6=Sat) — Monday,
 *  the day the weekly roadmap-groom run lands its PR (templates/
 *  backlog-grooming.md §3). Staleness is enforced on this day only. */
export const COMMITMENT_DOW = 1;

/** The clock the commitment weekday is read in, unless `--tz` names another.
 *  UTC is right whenever the weekly run lands well inside the UTC day (the
 *  template schedule is Monday 09:00 UTC); a repo whose run or reviewers sit
 *  near midnight UTC passes its own IANA zone. */
export const DEFAULT_TZ = 'UTC';

/**
 * Weekday (0=Sun … 6=Sat) of an ISO date or timestamp in `tz`.
 * A date-only string (`YYYY-MM-DD`) is a calendar date with no timezone shift
 * (so `2026-10-12` reads Monday); a timestamp is converted to the `tz` clock.
 * An unknown zone throws — the caller fails closed on that.
 */
export function weekdayInEstate(iso, tz = DEFAULT_TZ) {
  const s = String(iso);
  if (!s.includes('T')) return new Date(`${s}T00:00:00Z`).getUTCDay();
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).format(new Date(s));
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd];
}

/**
 * The calendar date (YYYY-MM-DD) of an ISO date or timestamp in `tz`. A
 * date-only string is returned as-is. Both halves of the stale rule — the
 * weekday AND the date the block is compared against — must read the same
 * clock: comparing a New York weekday against a UTC date called a block dated
 * Monday stale on a PR opened Monday 21:00 ET (02:00 UTC Tuesday). An unknown
 * zone throws; the caller falls back to the UTC date.
 */
export function dateInEstate(iso, tz = DEFAULT_TZ) {
  const s = String(iso);
  if (!s.includes('T')) return s.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(s));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** dateInEstate, falling back to the UTC date on an unknown zone or value. */
function prDateIn(prCreated, tz) {
  try {
    return dateInEstate(prCreated, tz);
  } catch {
    return String(prCreated).slice(0, 10);
  }
}

/**
 * Every `roadmap-commit` block body in the document, in order. A block is the
 * text strictly between one `start` marker and the next `end` marker.
 */
export function findSections(doc) {
  const out = [];
  let cursor = 0;
  for (;;) {
    const start = doc.indexOf(SECTION_START, cursor);
    if (start < 0) break;
    const end = doc.indexOf(SECTION_END, start + SECTION_START.length);
    if (end < 0) break; // unterminated — treated as absent by the caller
    out.push(doc.slice(start + SECTION_START.length, end));
    cursor = end + SECTION_END.length;
  }
  return out;
}

/**
 * Pure: the document text → a verdict.
 * `prCreated` (YYYY-MM-DD or an ISO timestamp, optional) turns the date check
 * on; `tz` is the clock its weekday is read in.
 */
export function evaluateCommitSection(doc, { prCreated = null, tz = DEFAULT_TZ } = {}) {
  // Normalise a full ISO timestamp to its date IN THE SAME CLOCK as the
  // weekday rule: `date < pc` is a lexicographic compare, and a UTC date would
  // move a late-evening PR to the next day.
  const pc = prCreated ? prDateIn(prCreated, tz) : null;
  const starts = doc.split(SECTION_START).length - 1;
  const ends = doc.split(SECTION_END).length - 1;
  if (starts === 0 && ends === 0) return { verdict: 'absent', date: null, refs: [], atCapacity: false };
  if (starts !== 1 || ends !== 1 || starts !== ends) {
    return { verdict: 'multiple', date: null, refs: [], atCapacity: false };
  }

  const body = findSections(doc)[0] ?? '';
  const line = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^Committed\b/i.test(l));
  if (!line) return { verdict: 'empty', date: null, refs: [], atCapacity: false };

  const dm = line.match(COMMIT_LINE_RE);
  if (!dm) return { verdict: 'malformed', date: null, refs: [], atCapacity: false };
  const date = dm[1];
  const rest = line.slice(dm[0].length).trim();

  let refs = [];
  let atCapacity = false;
  if (/^none\b/i.test(rest)) {
    if (!CAPACITY_RE.test(rest)) return { verdict: 'malformed', date, refs: [], atCapacity: false };
    atCapacity = true;
  } else {
    refs = [...rest.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
    if (refs.length === 0) return { verdict: 'malformed', date, refs: [], atCapacity: false };
  }

  if (pc && date < pc && isCommitmentDay(prCreated, tz)) {
    return { verdict: 'stale', date, refs, atCapacity };
  }
  return { verdict: 'ok', date, refs, atCapacity };
}

/** Whether a PR-creation instant falls on the weekly commitment day. An
 *  unparseable value or zone keeps the gate's teeth (fail closed on the rule,
 *  not open). */
function isCommitmentDay(prCreated, tz) {
  try {
    return weekdayInEstate(prCreated, tz) === COMMITMENT_DOW;
  } catch {
    return true;
  }
}

/** Human-readable one-line reason for a non-ok verdict. */
export function reasonFor(result, { prCreated = null, tz = DEFAULT_TZ } = {}) {
  switch (result.verdict) {
    case 'absent':
      return `the ${SECTION_START} … ${SECTION_END} section is absent from docs/roadmap.md`;
    case 'multiple':
      return 'more than one roadmap-commit section (exactly one is allowed)';
    case 'empty':
      return 'the roadmap-commit section is empty — a lapse, not a commitment';
    case 'malformed':
      return 'the commit line is malformed — expected "Committed YYYY-MM-DD: #NNN, #NNN" or "Committed YYYY-MM-DD: none — at capacity"';
    case 'stale':
      return `stale commitment — dated ${result.date}, before this weekly commitment PR was created (${prCreated ? prDateIn(prCreated, tz) : 'unknown'}, ${tz}); the previous cycle's commitment was carried forward into the commitment run`;
    default:
      return 'valid';
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { file: null, base: null, prCreated: null, tz: DEFAULT_TZ };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a.startsWith('--file=')) out.file = a.slice('--file='.length);
    else if (a === '--base') out.base = argv[++i];
    else if (a.startsWith('--base=')) out.base = a.slice('--base='.length);
    else if (a === '--pr-created') out.prCreated = argv[++i];
    else if (a.startsWith('--pr-created=')) out.prCreated = a.slice('--pr-created='.length);
    else if (a === '--tz') out.tz = argv[++i];
    else if (a.startsWith('--tz=')) out.tz = a.slice('--tz='.length);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return resolve(dirname(fileURLToPath(import.meta.url)), '..');
  }
}

/** `git diff --name-only <base>...HEAD`, or null when git cannot answer. */
function changedFiles(base) {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

// Guard: run only when invoked as the main script.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('usage: check-roadmap-commit.mjs [--file <path>] [--base <ref>] [--pr-created <ISO>] [--tz <IANA zone>]');
    process.exit(0);
  }

  const root = repoRoot();
  const file = args.file ? (isAbsolute(args.file) ? args.file : resolve(root, args.file)) : resolve(root, 'docs/roadmap.md');
  const rel = file.startsWith(root + '/') ? file.slice(root.length + 1) : file;

  if (args.base) {
    const changed = changedFiles(args.base);
    // An undeterminable diff is a CONFIGURATION error, reported as one. Falling
    // through to evaluate the file would block unrelated PRs whenever the block
    // is stale (every Monday); passing would mean the gate never gates. Exit 2,
    // named, so the first CI run says exactly what to fix.
    if (changed === null) {
      console.error(`ERROR — cannot compute the diff vs ${args.base}: the base commit is not in this checkout. Check out with fetch-depth: 0 (or fetch the base) so the gate can tell whether ${rel} was touched.`);
      process.exit(2);
    }
    if (!changed.includes(rel)) {
      console.log(`SKIPPED — ${rel} is unchanged vs ${args.base}; no commitment to gate.`);
      process.exit(0);
    }
  }

  let doc;
  try {
    doc = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`FAIL — cannot read ${rel}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const result = evaluateCommitSection(doc, { prCreated: args.prCreated, tz: args.tz });
  if (result.verdict === 'ok') {
    const what = result.atCapacity ? 'none — at capacity' : result.refs.map((n) => `#${n}`).join(', ');
    const carried =
      args.prCreated && result.date < prDateIn(args.prCreated, args.tz)
        ? ' (carried forward — not the weekly commitment day)'
        : '';
    console.log(`OK — roadmap-commit ${result.date}: ${what}${carried}`);
    process.exit(0);
  }
  console.error(`FAIL — ${reasonFor(result, { prCreated: args.prCreated, tz: args.tz })}.`);
  process.exit(1);
}
