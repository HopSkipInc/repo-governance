#!/usr/bin/env node
// template: scripts/check-backlog-currency.mjs v1.0.0 · updated 2026-11-04
// lint:backlog-currency  [governance template — copy to <project>/scripts/]
//
// Layer 1 of the backlog-grooming regime (templates/backlog-grooming.md).
// Requires scripts/lib/backlog-graph.mjs beside it. Extracted 2026-11-04 from
// ai-fleet, where it ran weekly from 2026-08-28 and was tuned twice against
// its live backlog (v1.1 and v1.2 below) — the template inherits the tuned
// rules, not the naive ones. Issue numbers in this header are ai-fleet's.
//
// The failure this catches (ai-fleet's 2026-08-20 roadmap incident, measured
// in repo-governance's 2026-08-21 grooming-regime prompt): an epic body is
// authored once and read for months. Closing a child updates the child;
// nothing propagates upward. Of fourteen queued blockers,
// five were already resolved; two epics sat fully-merged-and-open; one body
// asserted a code fact (#1252's "RLS flag defaults off") that had been deleted
// a month earlier. Every mechanism in the repo at the time read citation
// prose or a single issue — nothing compared an epic to its children. This
// lint owns that sub-issue-graph axis.
//
// CLASSES (v1 — detection semantics per the 2026-08-21 prompt's §3):
//   C1  Epic fully delivered, still open — every sub-issue closed completed;
//       the variant "any not_planned/duplicate" reports separately (children
//       closed without delivery — verify disposition). Clears on close, or a
//       body line `Stays open: <reason>`.
//   C2  Body cites a closed blocker — this lint owns exactly one prose form:
//       `Blocked on #N` OUTSIDE a ## Dependencies section. (`blocked-by` refs
//       inside ## Dependencies belong to check-stale-blockers.mjs — two
//       detectors sharing one citation grammar is the two-enumerators hazard
//       PDR-008 names.) A citation line that discloses its own staleness
//       ("…which has landed") clears ONLY if no status surface still asserts
//       the block (status:blocked label, a ## Status line, a milestone-table
//       row citing #N) — disclosure without correction is the finding.
//       Reverse-direction `X gates #Y` prose is a documented v1 exclusion
//       (candidate for 1.1): it asserts facts about other issues' blocker
//       lists, and parsing it double-maintains the graph in prose.
//   C3  Label contradicts the graph — status:blocked with zero open blockers
//       (Dependencies refs all closed); status:needs-decision where a merged
//       ADR carries `Resolves: …#N` naming the issue.
//   C4  Declared hierarchy not linked — `children: #a, #b` inline lists,
//       `Child issues` bullet lists, milestone-table rows, and child-side
//       `child-of #N` / `Parent epic: #N` declarations diffed against the
//       sub-issue graph. The house clear-condition is the observed convention:
//       a `closed as superseded: #N` annotation clears #N.
//   C5  Named-but-unfiled work — markers `(unfiled)`, `not yet filed`,
//       `to file`, `no issue exists`, bare `unfiled` in open-issue bodies and
//       ADR Known-Gaps sections.
//   C6  Milestone-table row disagrees with child states — every cited issue in
//       the row is closed while the row still claims pending/blocked/
//       in-progress. Partial rows stay silent in v1 (a chatty lint gets
//       ignored).
//   TRIGGER (info, not a finding): a child's closed_at is newer than the
//       epic's updated_at — the Layer-2 groom scheduler consumes this line.
//
// v1.1 tunings from the first live run's false-positive review:
//   - C4 fires only where the parent's sub-issue graph is IN USE (≥1 linked
//     child). The estate declares hierarchy in prose in hundreds of bodies
//     but links ~19 epics; without the guard C4 reports estate-wide
//     non-adoption as a ~325-finding wall, and a wall gets ignored.
//   - Table-row declarations require a bare-ref cell (`| #2135 |`) — refs
//     inside prose cells ("stranded behind #2, #5") are row ordinals or
//     dependency mentions, not child declarations (#2286).
//   - C2 dedups per cited ref; C5's bare-phrase forms (to file / unfiled)
//     skip quoted or backticked spans, which cite the convention rather than
//     instance it (#2145).
//
// v1.2 corrections from the 2026-08-31 run's C3 findings, all six of which
// were reviewed by hand against the tree (4 true, 2 false):
//   - REF no longer matches a `#N` glued to an identifier, so `owner/repo#N`
//     and `repo#N` stop resolving against THIS repo. The old pattern read
//     #2031's `HopSkipInc/analytics-infrastructure#509` as local #509 and
//     called a genuinely-blocked P1 unblocked.
//   - C3 counts only refs on lines that assert a block (BLOCKER_LINE), not
//     every ref in ## Dependencies. "#146 … — coordinate" is not a blocker.
//   - C4 gains the non-adoption case the v1.1 guard created: an EPIC that
//     declares children and links none fires exactly one finding. The guard
//     was right that per-child reporting is a wall; it was wrong that
//     zero-link epics should be silent.
//
// INPUT — the GitHub issue graph via `gh` (REST) plus a local scan of
// docs/adr/ headers for `Resolves:` lines. No host DB, no MCP (PDR-010's
// contract rule). All section parsing is LINE-SCANNED, never a \Z regex —
// JavaScript has no \Z anchor and that bug already cost the routing lint
// every correctly-formatted issue in a live backlog.
//
// EXIT CONTRACT — a backlog sweep is a function of backlog state, not of any
// PR's diff, so it runs as a scheduled probe and never as a per-PR gate:
//   probe (default)   exits 0 whether or not it finds anything
//   --gate            C1/C3/C4 findings exit 1 — for a scheduled job that
//                     should go red, never for a per-PR check
//   SKIPPED           gh absent/unauthenticated, or the issue fetch failed:
//                     prints SKIPPED and the reason, exits 0 in probe / 2 with
//                     --gate. A check that fails open reads as evidence, so a
//                     degraded run never prints a clean census.
//
// Wiring: workflows/backlog-currency-probe.yml (weekly + dispatch) — a
// backlog sweep, never a per-PR gate. Fixture mode (`--fixtures <dir>`) reads
// a canned graph for hermetic tests; repo-governance's suite
// (test/backlog-currency.test.mjs) reproduces the 2026-08-20 incident's issues
// — a regime that cannot catch the incident that motivated it is not done.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
// The graph loader and the parse primitives it uses live in the shared lib
// (2026-09-20, roadmap-layer3-v2 §1) so this lint and the roadmap generator
// share ONE enumerator — PDR-008's two-enumerators hazard. Detection
// semantics (BLOCKER_LINE, analyze, the exit contract) stayed here.
// loadGraphFixtures is re-exported so the fixture test suite imports it from
// this module exactly as before the extraction.
import {
  gh, loadGraphLive, loadGraphFixtures,
  refsOn, sectionLines, hasLabel, isTableRow,
} from './lib/backlog-graph.mjs';

export { loadGraphFixtures } from './lib/backlog-graph.mjs';

/** Lines that actually assert a block, for C3. Every other ref in a
 *  ## Dependencies section — `relates-to`, `child-of`, "coordinate with #N" —
 *  is context, not a blocker. Counting them all is how #262 ("#146 shares the
 *  McpClient implementation — coordinate") was reported as a cleared blocker.
 *  The alternation covers `blocker:` and `waiting on` alongside the hyphenated
 *  and unhyphenated `blocked by` forms. `needs #N first` is deliberately OUT —
 *  "needs" reads as sequencing as often as blocking, and a filter that
 *  swallowed it would put the false positives back. */
const BLOCKER_LINE = /\b(blocked[-\s]by|blocked on|blocking on|blocker|awaiting|waiting on|depends on|gated by)\b/i;

// ------------------------------------------------------------------ analyze

/**
 * Pure analysis over a graph snapshot. Returns
 *   { findings: [{severity, issue, cls, message}], census: {...} }
 * severity: 'probe' (finding) or 'info' (TRIGGER).
 */
export function analyze(graph) {
  const findings = [];
  const { issues, subIssues, refs } = graph;
  const byNumber = new Map(issues.map((i) => [i.number, i]));

  const refState = (n) => byNumber.get(n)?.state ?? refs.get(n)?.state ?? null;
  const isClosed = (n) => refState(n) === 'closed';

  for (const issue of issues) {
    const body = issue.body ?? '';
    const lines = body.split(/\r?\n/);
    const kids = subIssues.get(issue.number) ?? [];

    // ── C1 ─────────────────────────────────────────────────────────────
    if (kids.length > 0) {
      const closed = kids.filter((k) => k.state === 'closed');
      const completed = closed.filter((k) => (k.state_reason ?? 'completed') === 'completed');
      const notPlanned = closed.filter((k) => k.state_reason && k.state_reason !== 'completed');
      const staysOpen = lines.some((l) => /^\s*(?:[-*]\s*)?(?:\*\*)?stays open\s*:/i.test(l));
      if (closed.length === kids.length && !staysOpen) {
        if (notPlanned.length > 0) {
          findings.push({ severity: 'probe', issue: issue.number, cls: 'C1', message: `all ${kids.length} children closed but ${notPlanned.length} not_planned — children closed without delivery, verify disposition` });
        } else if (completed.length === kids.length) {
          findings.push({ severity: 'probe', issue: issue.number, cls: 'C1', message: `all ${kids.length} children delivered, epic still open` });
        }
      }
    }

    // ── C2 ── `Blocked on #N` outside ## Dependencies ──────────────────
    const dep = sectionLines(body, 'Dependencies');
    const depSet = new Set((dep ?? []).map((l) => l.trim()));
    const statusLine = (sectionLines(body, 'Status') ?? []).some((l) => /\bblocked\b/i.test(l));
    const blockedLabel = hasLabel(issue, 'status:blocked');
    const c2Seen = new Set();
    for (const line of lines) {
      if (!/\bblocked on\b/i.test(line)) continue;
      if (depSet.has(line.trim())) continue; // Dependencies grammar belongs to check-stale-blockers
      for (const n of refsOn(line)) {
        if (!isClosed(n) || c2Seen.has(n)) continue;
        c2Seen.add(n);
        const selfDiscloses = /has landed|is stale|stale|closed|shipped|merged|landed/i.test(line);
        // A status surface = the blocked label, a ## Status line, or ANY
        // milestone row still reading blocked/pending — the #1922 incident
        // shape had the disclosure beside a row about a different issue; the
        // surface asserts the epic's state, not the cited blocker's.
        const rowAsserts = lines.some((l) => isTableRow(l) && /blocked|pending|in.?progress/i.test(l));
        if (!selfDiscloses || blockedLabel || statusLine || rowAsserts) {
          findings.push({ severity: 'probe', issue: issue.number, cls: 'C2', message: `body cites blocker #${n}, which is closed${blockedLabel || statusLine || rowAsserts ? ' — and a status surface still asserts the block' : ''}` });
        }
      }
    }

    // ── C3 ── label contradicts the graph ──────────────────────────────
    if (blockedLabel) {
      const depRefs = [...new Set(
        (sectionLines(body, 'Dependencies') ?? []).filter((l) => BLOCKER_LINE.test(l)).flatMap(refsOn),
      )];
      const openBlockers = depRefs.filter((n) => refState(n) === 'open');
      if (depRefs.length > 0 && openBlockers.length === 0) {
        findings.push({ severity: 'probe', issue: issue.number, cls: 'C3', message: `status:blocked but all ${depRefs.length} declared blockers are closed` });
      }
    }
    if (hasLabel(issue, 'status:needs-decision') && graph.adrResolves.has(issue.number)) {
      findings.push({ severity: 'probe', issue: issue.number, cls: 'C3', message: `status:needs-decision but a merged ADR carries a Resolves: header naming this issue` });
    }

    // ── C4 ── declared hierarchy not linked ────────────────────────────
    // v1.1 tuning (first-run false-positive review, prompt §8): fire only
    // when the relevant parent's sub-issue graph is IN USE (≥1 linked
    // child). The estate declares hierarchy in prose in hundreds of places
    // but links ~19 epics — without the guard, C4 reports non-adoption as
    // ~325 findings (a wall gets ignored) instead of the drift it exists
    // for: a parent that links SOME children but not this one. Non-adoption
    // is a single estate-wide observation, not 325 findings.
    const clearedSuperseded = new Set();
    for (const line of lines) {
      if (/closed as superseded/i.test(line)) for (const n of refsOn(line)) clearedSuperseded.add(n);
    }
    const declared = new Set();
    let inChildList = false;
    for (const line of lines) {
      if (/child issues/i.test(line) && /^\s*(#{1,4}\s|\*\*)/.test(line)) { inChildList = true; continue; }
      if (inChildList && /^\s*[-*]\s/.test(line)) { for (const n of refsOn(line)) declared.add(n); continue; }
      if (inChildList && line.trim() === '') { inChildList = false; continue; }
      if (inChildList) { inChildList = false; }
      if (/^\s*(?:[-*]\s*)?(?:\*\*)?children(?:\*\*)?\s*:/i.test(line)) for (const n of refsOn(line)) declared.add(n);
      // In a table row, only a cell that IS a bare issue ref declares the
      // row's subject — refs inside prose cells ("stranded behind #2, #5")
      // are row-ordinal or dependency mentions, not declarations (#2286).
      if (isTableRow(line)) {
        for (const cell of line.split('|').slice(1, -1)) {
          const m = cell.trim().match(/^[*`]*#(\d+)[.*`]*$/);
          if (m) declared.add(Number(m[1]));
        }
      }
    }
    const ownKids = new Set((subIssues.get(issue.number) ?? []).map((k) => k.number));
    const declaredReal = [...declared].filter((n) => n !== issue.number && !clearedSuperseded.has(n));
    if (ownKids.size > 0) {
      for (const n of declaredReal) {
        if (!ownKids.has(n)) {
          findings.push({ severity: 'probe', issue: issue.number, cls: 'C4', message: `declares child #${n}, which is not linked in the sub-issue graph` });
        }
      }
    } else if (declaredReal.length > 0 && hasLabel(issue, 'epic')) {
      // v1.2: v1.1's in-use guard (fire only where the graph has ≥1 linked
      // child) avoided a 325-finding wall, and in doing so silenced the
      // epics with NO links at all — exactly the largest ones. #1793 declares
      // sixteen children and links none; #1533 ten; #2129 six. Three of the
      // four biggest trees on the board were invisible to every graph reader,
      // which is how #1970 reached 9-of-9 unnoticed. One line per epic
      // restores the signal at ≤1 finding per unlinked epic — signal, not wall.
      findings.push({ severity: 'probe', issue: issue.number, cls: 'C4', message: `epic declares ${declaredReal.length} children in prose and links none — its sub-issue graph is unused, so every rollup reads this epic as empty` });
    }
    // Child-side: `child-of #N` / `Parent epic: #N` — the parent's graph must contain this issue.
    for (const line of lines) {
      const m = line.match(/(?:child-of|parent epic)\s*:?\s*#(\d+)/i);
      if (!m) continue;
      const parent = Number(m[1]);
      const parentKids = subIssues.get(parent);
      if (parentKids && parentKids.length > 0 && !parentKids.some((k) => k.number === issue.number)) {
        findings.push({ severity: 'probe', issue: issue.number, cls: 'C4', message: `declares parent #${parent}, which does not list this issue as a sub-issue` });
      }
    }

    // ── C5 ── named-but-unfiled work ───────────────────────────────────
    // The bare phrase forms (`to file`, `unfiled`) also match prose that
    // QUOTES the convention ("discharges ADR-068's "to file" Known Gap" —
    // #2145). Scan those against the line with quoted/backticked spans
    // removed; the explicit marker forms ((unfiled), not yet filed, no issue
    // exists) are unambiguous and fire as-is.
    for (const line of lines) {
      const unquoted = line.replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '');
      if (/\(unfiled\)/i.test(line) || /not yet filed/i.test(line) || /no issue exists/i.test(line)
        || /\bto file\b/i.test(unquoted) || /\bunfiled\b/i.test(unquoted)) {
        findings.push({ severity: 'probe', issue: issue.number, cls: 'C5', message: `names work with no issue filed: "${line.trim().slice(0, 100)}"` });
      }
    }

    // ── C6 ── milestone row disagrees with child states ────────────────
    for (const line of lines) {
      if (!isTableRow(line)) continue;
      const rowRefs = refsOn(line).filter((n) => refState(n) !== null);
      if (rowRefs.length === 0) continue;
      if (rowRefs.every(isClosed) && /pending|blocked|in.?progress|not started|open/i.test(line)) {
        findings.push({ severity: 'probe', issue: issue.number, cls: 'C6', message: `milestone row claims pending/blocked but every cited issue is closed: "${line.trim().slice(0, 100)}"` });
      }
    }

    // ── TRIGGER (info) ─────────────────────────────────────────────────
    if (kids.length > 0) {
      const latestChildClose = kids.map((k) => k.closed_at).filter(Boolean).sort().pop();
      if (latestChildClose && new Date(latestChildClose) > new Date(issue.updated_at)) {
        findings.push({ severity: 'info', issue: issue.number, cls: 'TRIGGER', message: 'children-changed-since-body-update — schedule a backlog-groom pass' });
      }
    }
  }

  // C5's ADR half: Known-Gaps sections of the local corpus (live mode scans
  // the tree; fixture mode supplies its own issues only).
  if (!graph.__fixtures) {
    for (const f of adrKnownGapsMarkers()) {
      findings.push({ severity: 'probe', issue: 0, cls: 'C5', message: `ADR ${f.file} Known-Gaps names unfiled work: "${f.line.slice(0, 100)}"` });
    }
  }

  const census = {};
  for (const f of findings) census[f.cls] = (census[f.cls] ?? 0) + 1;
  return { findings, census };
}

function adrKnownGapsMarkers() {
  const out = [];
  const dir = join(process.cwd(), 'docs', 'adr');
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const section = sectionLines(readFileSync(join(dir, file), 'utf8'), 'Known[- ]Gaps');
    if (!section) continue;
    for (const line of section) {
      if (/\(unfiled\)|not yet filed|\bto file\b|no issue exists|\bunfiled\b/i.test(line)) {
        out.push({ file, line: line.trim() });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------- cli

function main() {
  const args = process.argv.slice(2);
  const GATE = args.includes('--gate');
  const fixIdx = args.indexOf('--fixtures');
  const fixturesDir = fixIdx !== -1 ? args[fixIdx + 1] : null;
  const repoIdx = args.indexOf('--repo');
  const repoOverride = repoIdx !== -1 ? args[repoIdx + 1] : null;

  let graph;
  if (fixturesDir) {
    graph = { ...loadGraphFixtures(fixturesDir), __fixtures: true };
  } else {
    try {
      gh(['--version']);
      gh(['auth', 'status']);
    } catch (e) {
      console.log(`SKIPPED check-backlog-currency: gh absent or unauthenticated (${(e.message ?? '').split('\n')[0]}) — a backlog check that cannot read the backlog proves nothing`);
      process.exit(GATE ? 2 : 0);
    }
    const repo = repoOverride ?? JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
    try {
      graph = loadGraphLive(repo);
    } catch (e) {
      console.log(`SKIPPED check-backlog-currency: issue-graph fetch failed (${(e.message ?? '').split('\n')[0]}) — a degraded run is not a clean sweep`);
      process.exit(GATE ? 2 : 0);
    }
  }

  const { findings, census } = analyze(graph);
  for (const f of findings.sort((a, b) => a.issue - b.issue || a.cls.localeCompare(b.cls))) {
    console.log(`${f.severity} #${f.issue} ${f.cls} ${f.message}`);
  }
  const classes = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'TRIGGER'];
  console.log(`census: ${classes.map((c) => `${c}=${census[c] ?? 0}`).join(' ')} open-issues=${graph.issues.length}`);

  if (GATE) {
    const blocking = findings.filter((f) => ['C1', 'C3', 'C4'].includes(f.cls));
    if (blocking.length > 0) process.exit(1);
  }
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
