#!/usr/bin/env node
// template: scripts/generate-roadmap.mjs v1.0.0 · updated 2026-11-04
// generate:roadmap-data  [governance template — copy to <project>/scripts/]
//
// Layer 3's deterministic data pass of the backlog-grooming regime
// (templates/backlog-grooming.md). Requires scripts/lib/backlog-graph.mjs and
// scripts/check-backlog-currency.mjs beside it — the census line in the trust
// header is the currency lint's own analyze(), not a second count. Extracted
// 2026-11-04 from ai-fleet, where it regenerated docs/roadmap-data.md on a
// schedule from 2026-09-20. Issue numbers in this header are ai-fleet's.
//
// WHAT THIS IS: a deterministic, gh-only projection of the live backlog into
// docs/roadmap-data.md — the trust header, the v2 roadmap table (now with the
// per-epic `impl tier` column, #3328), and the age-bucketed debt table. No
// model, no host DB, no MCP. The
// narrative half (sequence, horizons, cross-cutting observations) is the
// roadmap-narrative skill writing docs/roadmap.md — never this file.
//
// DETERMINISM CONTRACT (the point of the artifact): a re-run over an
// unchanged substrate is byte-identical, so the committed diff IS the backlog
// delta. Two disciplines make that true:
//   - No wall-clock self-timestamp. The commit is the timestamp. Every header
//     field is a substrate fact that changes only when the substrate changes.
//   - Ages are measured against the SUBSTRATE CLOCK: `substrate as-of` is the
//     newest activity timestamp observed in the graph (issue updated_at —
//     comments bump it — plus child/ref closed_at), never Date.now(). A
//     consequence to know, priced and accepted: if the entire backlog sits
//     untouched for a week, the artifact is byte-identical anyway (nothing
//     new to read), and the moment any issue moves the clock advances and
//     age-gated state (groom lapse, debt bands) catches up in that diff.
// ADR provenance is `file:line@ref` with ref = the full sha of the last
// commit to touch that ADR (`git log -1 --format=%H -- <file>`) — %h would
// re-abbreviate as the repo grows and manufacture diffs; %H is stable.
//
// FAIL-CLOSED: gh absent/unauthenticated, or any substrate fetch failing,
// prints SKIPPED with the reason and exits 0 WITHOUT writing the artifact —
// a projection that degrades silently reads as evidence (same contract as
// the currency lint). There is no --gate mode and never will be: this is a
// probe-class artifact (diff-scoped checks gate, state-scoped checks probe).
// Passing --gate is refused loudly.
//
// DEBT TABLE DEFINITIONS (named here so the numbers are re-derivable):
//   unparented  = open, no `epic` label, no linked children of its own, and
//                 in no fetched parent's sub-issue list (a closed parent's
//                 children read as unparented — for planning, they are)
//   age (d)     = floor((substrate-as-of − created_at) / 86400s)
//   bands       = <30d fresh · 30–90d watch (30 ≤ a < 90) · ≥90d sweep
//                 (90–180d, >180d) — the sweep consumes ≥90d first
//   deferred    = status:deferred rows render separately with their date —
//                 deferred-on-the-record is a decision, aging-by-neglect is
//                 drift. The "deferred since" date is the issue's updated_at
//                 (the label event is not exposed over REST; documented
//                 proxy).
//   >90d count  = actionable (non-deferred) rows with age ≥ 90d
// Probe-output rolling issues are NOT excluded: no silent filters — they
// are young weekly-touched rows and the sweep can disposition them like
// anything else.
//
// LINT LAST GREEN: the newest successful run of the currency probe workflow
// (workflows/backlog-currency-probe.yml), and its findings surface is the
// open issue carrying the probe's rolling label — found in the graph already
// loaded, never by a hard-coded number (the source repo's copy hard-coded
// its own issue number, which is meaningless in any other repo).
//
// WHAT IT DELIBERATELY DOES NOT COMPUTE: `expires` (expected density
// near-zero — nothing in the graph derives it; the narrative pass may assert
// one with provenance), the `credential` block type (not graph-derivable;
// narrative asserts it), PR state (no deterministic epic↔PR join exists in
// the graph — named in the application report upstream).
//
// Fixture mode (--fixtures <dir>) reads a canned substrate for hermetic tests
// (repo-governance: test/roadmap-generator.test.mjs): the loader's four files
// plus probe-runs.json, groom-comments.json, dod-cadence.txt, adr-refs.json.

import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import {
  gh, ghList, loadGraphLive, loadGraphFixtures,
  hasLabel, scanAdrResolvesDetailed,
} from './lib/backlog-graph.mjs';
import { analyze } from './check-backlog-currency.mjs';

const CURRENCY_PROBE_WORKFLOW = 'backlog-currency-probe.yml';
const CURRENCY_ROLLING_LABEL = 'backlog-currency-probe'; // the probe's findings surface
const GROOM_MARKER = /^backlog-groom:\s*pass complete\b/im;
const CADENCE_DAYS = { daily: 1, weekly: 7, biweekly: 14, monthly: 31 };
const INTENT_MAX = 140;
const DAY_MS = 86_400_000;

// ------------------------------------------------------------------ helpers

/** Markdown-table cell safety: escape backslashes FIRST (a literal `\` before
 *  a `|` would otherwise defeat the pipe escape — CodeQL js/incomplete-
 *  sanitization), then pipes, then flatten newlines. */
function cell(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ').trim();
}

/** ISO → date part. */
function day(iso) {
  return iso ? iso.slice(0, 10) : 'unknown';
}

/** First body line that is prose (not a heading, comment, table row, quote,
 *  or blank) — the deterministic extraction behind the intent column, the
 *  only body-sourced column in the schema. */
function intentOf(issue) {
  for (const line of (issue.body ?? '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /^#{1,4}\s/.test(t) || /^<!--/.test(t) || /^\|/.test(t) || /^>/.test(t)) continue;
    if (/^<[^>]*>$/.test(t)) continue; // pure HTML tag line — import cruft, not intent
    const flat = t.replace(/\s+/g, ' ');
    return flat.length > INTENT_MAX ? `${flat.slice(0, INTENT_MAX - 1)}…` : flat;
  }
  return '';
}

/** The currency probe's rolling findings issue: the lowest-numbered open issue
 *  carrying the probe's label (the probe upserts exactly one; lowest wins if a
 *  duplicate ever exists, so the render stays deterministic). Null when none. */
export function rollingIssueOf(graph) {
  const hits = graph.issues
    .filter((i) => hasLabel(i, CURRENCY_ROLLING_LABEL))
    .map((i) => i.number)
    .sort((a, b) => a - b);
  return hits[0] ?? null;
}

/** The substrate clock: newest activity timestamp anywhere in the graph. */
function substrateAsOf(graph) {
  let max = '';
  const consider = (iso) => { if (iso && iso > max) max = iso; };
  for (const i of graph.issues) { consider(i.updated_at); consider(i.created_at); }
  for (const kids of graph.subIssues.values()) for (const k of kids) consider(k.closed_at);
  for (const r of graph.refs.values()) consider(r.closed_at);
  return max;
}

// ------------------------------------------------------------------- inputs
// One shape, two sources. renderArtifact() below never knows which.

/** Newest marker per epic from a { epicNumber → comments } map. Exported so
 *  tests can overlay a variant comment set (the lapsed-cadence fixture)
 *  without duplicating the filter. */
export function groomMarkersFrom(commentsByIssue) {
  const groomMarkers = new Map(); // epic → { created_at, login }
  for (const [epic, comments] of Object.entries(commentsByIssue)) {
    for (const c of comments) {
      if (!GROOM_MARKER.test(c.body ?? '')) continue;
      const prev = groomMarkers.get(Number(epic));
      if (!prev || c.created_at > prev.created_at) {
        groomMarkers.set(Number(epic), { created_at: c.created_at, login: c.user?.login ?? 'unknown' });
      }
    }
  }
  return groomMarkers;
}

function loadLive(repoSlug) {
  const graph = loadGraphLive(repoSlug);

  // The currency probe's last green run — the header's "lint last green".
  const runs = JSON.parse(gh(['api',
    `repos/${repoSlug}/actions/workflows/${CURRENCY_PROBE_WORKFLOW}/runs?status=success&per_page=1`]));
  const probeRun = runs.workflow_runs?.[0]
    ? { created_at: runs.workflow_runs[0].created_at, html_url: runs.workflow_runs[0].html_url }
    : null;

  // Groom markers: the backlog-groom closing step posts a dated comment with
  // the fixed marker line on each groomed epic; the newest marker across
  // epics is "last groom pass". A pass with no comment is invisible — the
  // correct failure direction (it untrusts the header).
  const commentsByIssue = {};
  for (const epic of graph.issues.filter((i) => hasLabel(i, 'epic'))) {
    commentsByIssue[epic.number] = ghList(`repos/${repoSlug}/issues/${epic.number}/comments?per_page=100`);
  }
  const groomMarkers = groomMarkersFrom(commentsByIssue);

  const cadenceRaw = readCadenceFrom('docs/definition-of-done.md');

  const adrDetailed = scanAdrResolvesDetailed();
  const adrRefs = new Map();
  for (const [n, { file, line }] of adrDetailed) {
    let ref = 'unknown';
    try {
      ref = execFileSync('git', ['log', '-1', '--format=%H', '--', file], { encoding: 'utf8' }).trim() || 'unknown';
    } catch { /* shallow or missing history — the header still names file:line */ }
    adrRefs.set(n, { file, line, ref });
  }

  return { graph, probeRun, groomMarkers, cadenceRaw, adrRefs, repoSlug };
}

function readCadenceFrom(dodPath) {
  try {
    const m = readFileSync(dodPath, 'utf8').match(/backlog grooming cadence:\s*(\w+)/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Fixture substrate → the same inputs shape as loadLive. Exported for the
 *  hermetic test suite; makes no gh/git/network calls. */
export function loadFixture(dir) {
  const graph = { ...loadGraphFixtures(dir), __fixtures: true };
  const probeRun = JSON.parse(readFileSync(`${dir}/probe-runs.json`, 'utf8'))[0] ?? null;
  const groomMarkers = groomMarkersFrom(JSON.parse(readFileSync(`${dir}/groom-comments.json`, 'utf8')));
  const cadenceRaw = readFileSync(`${dir}/dod-cadence.txt`, 'utf8').trim().toLowerCase();
  const adrRefs = new Map(Object.entries(JSON.parse(readFileSync(`${dir}/adr-refs.json`, 'utf8')))
    .map(([k, v]) => [Number(k), v]));
  return { graph, probeRun, groomMarkers, cadenceRaw, adrRefs, repoSlug: 'fixture/repo' };
}

// ------------------------------------------------------------------ render

/**
 * Pure: inputs → the artifact's bytes. Everything deterministic lives here;
 * no Date.now(), no wall clock, no environment reads.
 */
export function renderArtifact(inputs) {
  const { graph, probeRun, groomMarkers, cadenceRaw, adrRefs, repoSlug } = inputs;
  const asOf = substrateAsOf(graph);
  const asOfMs = Date.parse(asOf);
  const { census } = analyze(graph);
  const classes = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'TRIGGER'];
  const censusLine = `${classes.map((c) => `${c}=${census[c] ?? 0}`).join(' ')} · open-issues=${graph.issues.length}`;

  // ── trust header ──────────────────────────────────────────────────────
  const cadenceDays = cadenceRaw ? (CADENCE_DAYS[cadenceRaw] ?? null) : null;
  const lastGroom = [...groomMarkers.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
  const groomState = lastGroom && cadenceDays !== null
    && (asOfMs - Date.parse(lastGroom.created_at)) <= cadenceDays * DAY_MS
    ? 'current' : 'lapsed';
  const trust = groomState === 'current' ? 'TRUSTED' : 'UNTRUSTED';
  const groomText = lastGroom
    ? `${day(lastGroom.created_at)} by @${lastGroom.login} — cadence: ${cadenceRaw ?? 'undeclared'} → ${groomState}`
    : `never recorded — cadence: ${cadenceRaw ?? 'undeclared'} → lapsed`;
  const rolling = rollingIssueOf(graph);
  const findingsText = rolling !== null
    ? `findings: rolling issue #${rolling}`
    : `findings: no open \`${CURRENCY_ROLLING_LABEL}\` issue`;
  const lintText = probeRun
    ? `${day(probeRun.created_at)} ([run](${probeRun.html_url})) — ${findingsText}`
    : `no successful run recorded — ${findingsText}`;

  // ── roadmap rows (open epics, issue-number order) ─────────────────────
  const epics = graph.issues.filter((i) => hasLabel(i, 'epic')).sort((a, b) => a.number - b.number);
  const roadmapRows = epics.map((epic) => {
    const kids = graph.subIssues.get(epic.number) ?? [];
    const closed = kids.filter((k) => k.state === 'closed');
    const completed = closed.filter((k) => (k.state_reason ?? 'completed') === 'completed');

    const statusParts = [];
    if (kids.length > 0) {
      statusParts.push(`${closed.length}/${kids.length} children closed`);
      if (closed.length === kids.length) {
        statusParts.push(completed.length === kids.length
          ? 'delivered, epic open'
          : 'all children closed, some not_planned — verify disposition');
      }
    } else {
      statusParts.push('no linked children');
    }
    const statusLabels = (epic.labels ?? [])
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((n) => n.toLowerCase().replace(/:\s+/, ':').startsWith('status:'))
      .sort();
    if (statusLabels.length > 0) statusParts.push(`labels: ${statusLabels.join(', ')}`);
    const adr = adrRefs.get(epic.number);
    if (adr) statusParts.push('resolved by ADR');

    // Provenance: graph claims carry the command + the row's own substrate
    // date (per-row clock: the later of the epic's updated_at and its newest
    // child closure); ADR claims carry file:line@ref with the ref mandatory.
    let rowClock = epic.updated_at ?? '';
    for (const k of kids) if (k.closed_at && k.closed_at > rowClock) rowClock = k.closed_at;
    const provParts = [`gh api repos/${repoSlug}/issues/${epic.number}/sub_issues @ ${day(rowClock)}`];
    if (adr) provParts.push(`${adr.file}:${adr.line}@${adr.ref}`);

    const blockType = hasLabel(epic, 'status:needs-decision') ? 'decision'
      : hasLabel(epic, 'status:blocked') ? 'dependency'
      : hasLabel(epic, 'status:deferred') ? 'deliberate-wait'
      : '';

    // impl tier — the epic's `impl:` label value (the tier, not the full label:
    // `impl:standard` → `standard`), blank when the epic carries no impl: label.
    // Single-select by convention; the lowest-sorted label wins if a row
    // somehow carries more than one, so the render stays deterministic.
    const implLabels = (epic.labels ?? [])
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((n) => n.toLowerCase().replace(/:\s+/, ':').startsWith('impl:'))
      .sort();
    const implTier = implLabels.length ? implLabels[0].replace(/^impl:\s*/i, '') : '';

    return {
      issue: `Issue: #${epic.number} — ${epic.title ?? ''}`,
      status: statusParts.join(' · '),
      implTier,
      provenance: provParts.join(' · '),
      blockType,
      expires: '', // expected density near-zero; nothing graph-derivable
      intent: intentOf(epic),
      estimate: 'thin', // PDR-010 seam — keyed, not computed (regime §4)
    };
  });
  const tiered = epics.filter((e) => (e.labels ?? [])
    .some((l) => (typeof l === 'string' ? l : l.name).toLowerCase().replace(/:\s+/, ':').startsWith('impl:'))).length;

  // ── debt table (the unparented population) ────────────────────────────
  const childOfAny = new Set();
  for (const kids of graph.subIssues.values()) for (const k of kids) childOfAny.add(k.number);
  const unparented = graph.issues.filter((i) =>
    !hasLabel(i, 'epic')
    && (graph.subIssues.get(i.number) ?? []).length === 0
    && !childOfAny.has(i.number));

  const withAge = unparented.map((i) => ({
    issue: i,
    ageDays: Math.max(0, Math.floor((asOfMs - Date.parse(i.created_at ?? i.updated_at ?? asOf)) / DAY_MS)),
  }));
  const bandOf = (a) => (a < 30 ? 'fresh' : a < 90 ? 'watch' : 'sweep'); // ≥90d is the sweep's queue
  const bandLong = (a) => (a < 30 ? '<30d' : a < 90 ? '30–90d' : a < 180 ? '90–180d' : '>180d');

  const deferred = withAge.filter((r) => hasLabel(r.issue, 'status:deferred'));
  const actionable = withAge.filter((r) => !hasLabel(r.issue, 'status:deferred'));
  actionable.sort((a, b) => (a.issue.created_at < b.issue.created_at ? -1 : 1) || a.issue.number - b.issue.number);
  deferred.sort((a, b) => (a.issue.updated_at < b.issue.updated_at ? -1 : 1) || a.issue.number - b.issue.number);

  const labelNames = (i) => (i.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name)).sort().join(', ');
  const mix = (rows, want) => rows.filter((r) => hasLabel(r.issue, want)).length;
  const bugN = mix(withAge, 'bug');
  const choreN = mix(withAge, 'chore');
  const over90 = actionable.filter((r) => r.ageDays >= 90).length;

  // ── emit ──────────────────────────────────────────────────────────────
  const out = [];
  out.push('# Roadmap — data artifact (generated)');
  out.push('');
  out.push('<!--');
  out.push('  GENERATED by scripts/generate-roadmap.mjs — deterministic: a re-run over an');
  out.push('  unchanged substrate is byte-identical, so the committed diff IS the backlog');
  out.push('  delta. Do not hand-edit. The commit is the timestamp. Narrative prose');
  out.push('  (sequence, horizons, cross-cutting observations) lives in docs/roadmap.md,');
  out.push('  written by the roadmap-narrative skill — never here.');
  out.push('-->');
  out.push('');
  out.push('## Trust header');
  out.push('');
  out.push(`- trust: **${trust}**${trust === 'UNTRUSTED' ? ' (last groom pass lapsed or never recorded)' : ''}`);
  out.push(`- lint last green: ${lintText}`);
  out.push(`- last groom pass: ${groomText}`);
  out.push(`- census (lint): ${censusLine}`);
  out.push(`- substrate as-of: ${asOf || 'unknown'}`);
  out.push(`- rows: roadmap=${roadmapRows.length} debt=${actionable.length} deferred=${deferred.length}`);
  out.push(`- debt >90d (actionable): ${over90}`);
  out.push('');
  out.push('## Roadmap');
  out.push('');
  out.push('Epic rows, issue-number order. `status` is derived (child graph, ADR header,');
  out.push('label read) — never from a body; `impl tier` is the epic\'s `impl:` label value');
  out.push('(`standard`/`frontier`/`human`), blank when untiered; `intent` is the only');
  out.push('body-sourced column (first prose line, truncated); `estimate` renders `thin`');
  out.push('(PDR-010 seam — keyed, not computed). `expires` is empty: expected density is');
  out.push('near-zero, and nothing in the graph derives it — the narrative pass asserts it');
  out.push('with provenance when a genuinely perishable row exists.');
  out.push('');
  out.push('| issue | status | impl tier | provenance | block type | expires | intent | estimate |');
  out.push('|---|---|---|---|---|---|---|---|');
  for (const r of roadmapRows) {
    out.push(`| ${cell(r.issue)} | ${cell(r.status)} | ${cell(r.implTier)} | ${cell(r.provenance)} | ${cell(r.blockType)} | ${cell(r.expires)} | ${cell(r.intent)} | ${r.estimate} |`);
  }
  out.push('');
  out.push(`impl: tier coverage: ${tiered}/${roadmapRows.length} epics carry an impl: tier`);
  out.push('');
  // ── child graph (open children per epic) ──────────────────────────────
  // A consumer joining epics to work in flight (ai-fleet's roadmap board,
  // #3329) reads this instead of fanning out one sub-issues call per epic:
  // open children only (a closed child cannot be "in progress"), issue-number
  // order, blank when an epic has none.
  out.push('## Child graph');
  out.push('');
  out.push('Open child issue numbers per epic, issue-number order. Deterministic; an epic');
  out.push('with no open children is blank.');
  out.push('');
  out.push('| epic | open children |');
  out.push('|---|---|');
  for (const epic of epics) {
    const openKids = (graph.subIssues.get(epic.number) ?? [])
      .filter((k) => k.state !== 'closed')
      .sort((a, b) => a.number - b.number);
    out.push(`| #${epic.number} | ${openKids.map((k) => `#${k.number}`).join(', ')} |`);
  }
  out.push('');
  out.push('## Debt — the unparented population');
  out.push('');
  out.push(`Open issues with no epic label, no linked children, and no parent in the`);
  out.push(`sub-issue graph. Age is measured against the substrate clock, not the wall`);
  out.push(`clock — that is what keeps re-runs byte-identical. Escalation band:`);
  out.push(`\`fresh\` <30d · \`watch\` 30–90d · \`sweep\` ≥90d (the debt-sweep skill's`);
  out.push(`queue, oldest first). Deferred-on-the-record rows render in their own table`);
  out.push(`below — a decision, distinguishable from aging-by-neglect.`);
  out.push('');
  out.push(`unparented: ${withAge.length} of ${graph.issues.length} open · bug=${bugN} chore=${choreN} other=${withAge.length - bugN - choreN} · >90d (actionable): ${over90} · deferred: ${deferred.length}`);
  out.push('');
  out.push('| issue | age (d) | last activity | labels | escalation band |');
  out.push('|---|---|---|---|---|');
  for (const r of actionable) {
    out.push(`| ${cell(`Issue: #${r.issue.number} — ${r.issue.title ?? ''}`)} | ${r.ageDays} | ${day(r.issue.updated_at)} | ${cell(labelNames(r.issue))} | ${bandOf(r.ageDays)} (${bandLong(r.ageDays)}) |`);
  }
  out.push('');
  out.push('### Deferred on the record');
  out.push('');
  out.push('`status:deferred` with its date (updated_at — the label event is not exposed');
  out.push('over REST; documented proxy). A deferred row without a date on the issue is a');
  out.push('debt-sweep finding.');
  out.push('');
  out.push('| issue | deferred since | labels |');
  out.push('|---|---|---|');
  for (const r of deferred) {
    out.push(`| ${cell(`Issue: #${r.issue.number} — ${r.issue.title ?? ''}`)} | ${day(r.issue.updated_at)} | ${cell(labelNames(r.issue))} |`);
  }
  out.push('');
  return `${out.join('\n')}`;
}

// ---------------------------------------------------------------------- cli

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--gate')) {
    console.error('generate-roadmap: refused — this artifact is probe-class (state-scoped checks probe; a projection never gates a merge)');
    process.exit(2);
  }
  const fixIdx = args.indexOf('--fixtures');
  const fixturesDir = fixIdx !== -1 ? args[fixIdx + 1] : null;
  const repoIdx = args.indexOf('--repo');
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : 'docs/roadmap-data.md';

  let inputs;
  if (fixturesDir) {
    inputs = loadFixture(fixturesDir);
  } else {
    try {
      gh(['--version']);
      gh(['auth', 'status']);
    } catch (e) {
      console.log(`SKIPPED generate-roadmap: gh absent or unauthenticated (${(e.message ?? '').split('\n')[0]}) — a projection that cannot read its substrate proves nothing`);
      process.exit(0);
    }
    let repo = repoIdx !== -1 ? args[repoIdx + 1] : null;
    try {
      repo ??= JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner;
      inputs = loadLive(repo);
    } catch (e) {
      console.log(`SKIPPED generate-roadmap: substrate fetch failed (${(e.message ?? '').split('\n')[0]}) — a degraded run is not a fresh projection`);
      process.exit(0);
    }
  }

  writeFileSync(outPath, renderArtifact(inputs), 'utf8');
  console.log(`wrote ${outPath}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
