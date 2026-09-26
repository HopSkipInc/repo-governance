#!/usr/bin/env node
// template: scripts/check-epic-handoff.mjs v1.0.0 · updated 2026-09-26
/**
 * lint:epic-handoff  [governance template — copy to <project>/scripts/]
 *
 * The rolling epic handoff (`templates/epic-handoff.md`) is only worth having if the
 * next session can tell whether it is still true. A handoff that stopped being
 * refreshed looks exactly like one that was refreshed yesterday — both are a
 * `## ▶ Pick up here` section with a confident do-next list — and the next session
 * acts on the stale one at the cost of an hour and, occasionally, a wrong move on a
 * critical path. This probe is the freshness marker's reader.
 *
 * WHAT IT READS — the epic body alone. It does NOT enumerate children. The
 * body-versus-graph axis (a child closed but the epic body never moved) already has an
 * owner where the grooming regime runs: `check-backlog-currency.mjs` emits
 * `info … TRIGGER children-changed-since-body-update` when a child's `closed_at` is
 * newer than the epic's `updated_at`. Two detectors sharing one axis is the
 * two-enumerators hazard PDR-008 names; keeping this one to presence + date + age is
 * deliberate, and it is why the probe has no cross-repo scope and runs on
 * `github.token`.
 *
 * CLASSES (each with its own census count and its own fixture):
 *   undated   handoff section present, no parseable `Handoff updated: YYYY-MM-DD`
 *             (nor the legacy heading form `… (updated YYYY-MM-DD)`) — an assertion
 *             that can never age. GATE-ELIGIBLE.
 *   stale     dated handoff older than --max-age (default 21d) while the epic is open.
 *             GATE-ELIGIBLE. Not wrong — unverified; the next session should re-read
 *             the graph before trusting the do-next order.
 *   future    dated in the future (typo / wrong clock) — report-only.
 *   missing   an epic that shows recent activity (updated within --active-days,
 *             default 30d) and carries no handoff section at all — the practice has
 *             not started here, or a session skipped it. REPORT-ONLY: on first adoption
 *             every open epic is in this state, and a cold-start wall gets ignored
 *             (the lesson the 2026-08-21 grooming regime measured).
 *   fresh     dated within --max-age — the clean case, counted so the census reads.
 *   dormant   an epic with no handoff that has not moved within --active-days —
 *             counted, never reported.
 *
 * EXIT CONTRACT — this is a probe, never a gate (ADR-026; the 2026-08-18 erratum:
 * diff-scoped checks gate, state-scoped checks probe):
 *   probe (default)   exits 0 whether or not it finds anything
 *   --gate            undated + stale findings exit 1
 *   gh unavailable    prints SKIPPED and exits 0 in probe mode; with --gate exits 2 —
 *                     distinct from clean (0) and from findings (1), because a probe
 *                     that fails open reads as evidence (the R6 contract in
 *                     check-issue-routing.mjs).
 *
 * The section scan is a LINE SCAN. JavaScript has no \Z anchor — `(?=^##\s|\Z)`
 * silently degrades to "followed by a literal Z", and that bug already cost a live
 * lint every correctly-formatted issue in a backlog. Do not "simplify" the scan into a
 * regex.
 *
 * CONFIGURE BEFORE USE — REPO is auto-detected from git remote; override with
 * EPIC_HANDOFF_REPO when running outside a checkout. Epics are identified by the
 * `epic` label, a `## Work type` → `epic` line, or a handoff section already present;
 * a repo that marks epics some other way gets no `missing` findings (an accepted
 * fail-open — `issue-authoring.md` already requires a type label or the Work-type
 * line). Requires the `gh` CLI, authenticated.
 *
 * Wiring: schedule only (see templates/workflows/epic-handoff-probe.yml) — this is a
 * backlog-freshness sweep, not a diff check. Never wire it per-PR.
 */

import { execFileSync } from 'child_process';

// ---------------------------------------------------------------- configure

/** Max open issues fetched from the swept repo (epics are a subset). */
const LIMIT = 500;

/** The handoff heading. Glyph optional — `## Pick up here` parses too. */
const HEADING = /^##[ \t]*(?:▶[ \t]*)?pick up here\b/i;
/** Canonical marker line: `**Handoff updated:** YYYY-MM-DD`. */
const DATE_LINE = /^[ \t]*(?:\*\*|__)?[ \t]*handoff updated:?[ \t]*(?:\*\*|__)?[ \t]*(\d{4}-\d{2}-\d{2})/im;
/** Legacy marker: the date in the heading, `… (updated YYYY-MM-DD)`. */
const HEADING_DATE = /\(updated[ \t]+(\d{4}-\d{2}-\d{2})\)/i;
/** `## Work type` block naming `epic`, for repos that do not use the type label. */
const WORKTYPE_EPIC = /^##[ \t]*work type[ \t]*\r?\n+[ \t]*epic[ \t]*$/im;

// --------------------------------------------------------------------- args

const ARGS = process.argv.slice(2);
const GATE = ARGS.includes('--gate');
const DAY_MS = 86_400_000;

function intArg(flag, def) {
  const i = ARGS.indexOf(flag);
  if (i === -1) return def;
  const v = Number(ARGS[i + 1]);
  if (!Number.isInteger(v) || v < 1) {
    console.error(`check-epic-handoff: ${flag} needs a positive integer, got "${ARGS[i + 1]}"`);
    process.exit(2);
  }
  return v;
}

const MAX_AGE = intArg('--max-age', 21);
const ACTIVE_DAYS = intArg('--active-days', 30);

// ------------------------------------------------------------------ helpers

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function repoSlug() {
  if (process.env.EPIC_HANDOFF_REPO) return process.env.EPIC_HANDOFF_REPO;
  return JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
}

const REPO = repoSlug();

/**
 * The handoff section: `{ heading, block }` or null. Line-scanned — see the header.
 * The block ends at the next `## ` heading, so an `updated` date printed further down
 * the epic is never read as the handoff's.
 */
function handoffSection(body) {
  if (!body) return null;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => HEADING.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##[ \t]/.test(l));
  return {
    heading: lines[start],
    block: (end === -1 ? rest : rest.slice(0, end)).join('\n'),
  };
}

/** The section's declared date, canonical marker first then the legacy heading form. */
function handoffDate(section) {
  const m = section.block.match(DATE_LINE);
  if (m) return m[1];
  const h = section.heading.match(HEADING_DATE);
  return h ? h[1] : null;
}

function isEpic(issue, section) {
  if (section) return true;
  if (issue.labels.some((l) => l.name === 'epic')) return true;
  return WORKTYPE_EPIC.test(issue.body || '');
}

function daysBetween(later, earlier) {
  return Math.floor((later - earlier) / DAY_MS);
}

// -------------------------------------------------------------------- sweep

let issues;
try {
  issues = JSON.parse(
    gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--limit', String(LIMIT),
        '--json', 'number,title,body,labels,updatedAt'])
  );
} catch (err) {
  const msg = `${err.stderr ?? ''}${err.message ?? ''}`.split('\n')[0] || 'unknown error';
  console.log(`check-epic-handoff: ${REPO} — SKIPPED (${msg}).`);
  console.log('Not counted as clean: the epic set was never read, so a stale handoff is invisible this run.');
  process.exit(GATE ? 2 : 0);
}

const findings = [];
function report(cls, number, message) {
  findings.push({ cls, number, message });
}

const census = { fresh: 0, stale: 0, undated: 0, future: 0, missing: 0, dormant: 0 };
let epicCount = 0;
const now = Date.now();
const staleCutoff = now - MAX_AGE * DAY_MS;
const futureLimit = now + DAY_MS;

for (const issue of issues) {
  const section = handoffSection(issue.body);
  if (!isEpic(issue, section)) continue;
  epicCount += 1;

  if (!section) {
    const updated = Date.parse(issue.updatedAt);
    if (Number.isFinite(updated) && now - updated <= ACTIVE_DAYS * DAY_MS) {
      census.missing += 1;
      report('missing', issue.number,
        `active epic with no handoff section — add "## ▶ Pick up here — rolling handoff" ` +
        'with a dated **Handoff updated:** line before the next session needs it (epic-handoff.md)');
    } else {
      census.dormant += 1;
    }
    continue;
  }

  const date = handoffDate(section);
  const parsed = date ? Date.parse(date) : NaN;
  if (!date || !Number.isFinite(parsed)) {
    census.undated += 1;
    report('undated', issue.number,
      'handoff section carries no date — add a "**Handoff updated:** YYYY-MM-DD" line. ' +
      'An undated handoff can never age, which is how a stale do-next order stays "current"');
    continue;
  }
  if (parsed > futureLimit) {
    census.future += 1;
    report('future', issue.number,
      `handoff dated ${date} is in the future — fix the date, it cannot be trusted as a freshness marker`);
    continue;
  }
  if (parsed < staleCutoff) {
    census.stale += 1;
    const age = daysBetween(now, parsed);
    report('stale', issue.number,
      `handoff dated ${date} is ${age}d old (max ${MAX_AGE}d) — the do-next order is unverified: ` +
      're-read the children, the PRs, and the ledger, then re-date it (or refresh it)');
    continue;
  }
  census.fresh += 1;
}

// ------------------------------------------------------------------- output

console.log(
  `check-epic-handoff: ${REPO} — ${epicCount} open epic(s) of ${issues.length} open issues ` +
  `(max age ${MAX_AGE}d, active window ${ACTIVE_DAYS}d).`
);
console.log(
  `census: fresh ${census.fresh} · stale ${census.stale} · undated ${census.undated} · ` +
  `future ${census.future} · missing ${census.missing} · dormant ${census.dormant}`
);

if (findings.length) {
  console.log(`\nFINDINGS (${findings.length}, ${GATE ? 'gate' : 'probe — never blocks a merge'}):`);
  for (const f of findings.sort((a, b) => a.number - b.number)) {
    console.log(`  #${f.number} [${f.cls}] ${f.message}`);
  }
  if (!GATE) {
    console.log(
      '\nmissing and future are report-only; undated and stale would gate under --gate. ' +
      'Promotion to a gate is earned after a false-positive review, not assumed (ADR-026).'
    );
  }
}

if (!findings.length) {
  console.log('OK: every open epic with a handoff carries a fresh, dated marker.');
}

process.exit(GATE && census.undated + census.stale > 0 ? 1 : 0);
