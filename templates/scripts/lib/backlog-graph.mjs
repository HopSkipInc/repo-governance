#!/usr/bin/env node
// template: scripts/lib/backlog-graph.mjs v1.0.0 · updated 2026-11-04
/**
 * lib:backlog-graph  [governance template — copy to <project>/scripts/lib/]
 *
 * The shared GitHub issue-graph loader of the backlog-grooming regime
 * (templates/backlog-grooming.md). scripts/check-backlog-currency.mjs (Layer 1)
 * and scripts/generate-roadmap.mjs (Layer 3) both import it, so the lint and
 * the roadmap read ONE enumerator — PDR-008's two-enumerators hazard: two
 * loaders of the same graph drift apart, and each then reports a different
 * backlog with equal confidence.
 *
 * Extracted 2026-11-04 from ai-fleet, where it was split out of the currency
 * lint (2026-09-20) behavior-pure — the lint's fixture output was
 * byte-identical before and after. Issue numbers in this file are ai-fleet's:
 * the incidents that earned each rule.
 *
 * scripts/check-stale-blockers.mjs (its own template) does NOT import from
 * here. Unifying its loader is a revision of that template, owed and not taken
 * in this extraction: a behavior change to a shipped lint rides its own version
 * bump and its own fixture run, never a sibling's extraction.
 *
 * The graph is the injectable seam: live mode builds it from gh + the local
 * docs/adr/ tree; fixture mode reads it from JSON. Consumers never know which.
 *
 *   graph = {
 *     issues:     [ { number, title, body, labels, state, updated_at, ... } ],  // open
 *     subIssues:  Map<number, [ { number, state, state_reason, closed_at } ]>,  // parent → children
 *     refs:       Map<number, { state, state_reason, closed_at, title }>,       // cited, any state
 *     adrResolves: Set<number>,   // issues named by a merged ADR's Resolves: header
 *   }
 */

import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// ------------------------------------------------------------------ helpers

// v1.2: a ref is LOCAL only when `#` is not glued to an identifier. This
// excludes `owner/repo#N` and bare `repo#N`, which the naive /#(\d+)/g read
// as this repo's issue N. ai-fleet #2031 declared
// `blocked-by HopSkipInc/analytics-infrastructure#509` (open upstream); the
// old pattern matched `#509`, resolved it against ai-fleet's long-closed
// #509, and reported the issue as unblocked — a lint telling you to unblock
// something that is genuinely blocked. Erring toward not-firing is correct
// here: a qualified ref is never a bare local one.
//
// Two side effects of the pattern are deliberate, and named so the next reader
// need not re-derive them (both raised in review of ai-fleet PR #2558): the trailing
// `\b` also drops `#12a`-shaped refs — a version string, not issue 12 — and
// `_` sits in the lookbehind class, so an italicised `_#123_` goes unmatched.
// The second has a real cost and it is priced: no open issue in this repo
// writes a ref that way, while removing `_` would let `foo_#901` become a ref
// and reintroduce a false-positive class. Silence on a form nobody uses beats
// a wrong finding on a form they do.
export const REF = /(?<![A-Za-z0-9._/-])#(\d+)\b/g;

/** Normalize the label dialect: this estate carries both `status:blocked`
 *  and `status: blocked` (spaced) label names. */
export function normLabel(name) {
  return name.replace(/:\s+/, ':').toLowerCase();
}

export function hasLabel(issue, want) {
  return (issue.labels ?? []).some((l) => normLabel(typeof l === 'string' ? l : l.name) === want);
}

/** Line-scanned section extraction — the anti-\Z discipline: JavaScript has
 *  no \Z anchor, and `(?=^##\s|\Z)` silently degrades to "followed by a
 *  literal Z" — the bug that made the routing lint report every
 *  correctly-formatted issue in a live backlog as malformed. Never
 *  "simplify" this scan into a regex. */
export function sectionLines(body, name) {
  if (!body) return null;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^#{1,4}[ \\t]*${name}[ \\t]*$`, 'i').test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,4}[ \t]\S/.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

/** All #N refs on a line. */
export function refsOn(line) {
  return [...line.matchAll(REF)].map((m) => Number(m[1]));
}

/** A markdown table row: starts with |, is not the --- separator. */
export function isTableRow(line) {
  return /^\s*\|/.test(line) && !/^\s*\|[\s:|-]+\|?\s*$/.test(line);
}

// ------------------------------------------------------------------ gh calls

export function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** The REST API version every live read is pinned to. gh's `api` default is
 *  GitHub's oldest supported version (2022-11-28, which GitHub is deprecating).
 *  ai-fleet's scheduled roadmap regeneration ran on a GitHub App credential and
 *  returned a truncated graph under the default — 723 open issues and 10 of 11
 *  recent child closes (ai-fleet #4066) — so a later version is pinned here,
 *  explicitly rather than by gh default. Read-only: no write path uses this. */
export const API_VERSION = '2026-03-10';

export function ghV(args) {
  return gh([...args, '-H', `X-GitHub-Api-Version: ${API_VERSION}`]);
}

/** Paginated list fetch: one compact JSON object per line (NDJSON). The
 *  `--paginate --slurp` combination returns pages-in-arrays whose shape has
 *  changed across gh versions; `--jq '.[] | @json'` is stable. */
export function ghList(endpoint, call) {
  const argv = ['api', '--paginate', endpoint, '--jq', '.[] | @json'];
  const out = (call ?? ghV)(argv);
  return out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// --------------------------------------------------------------- graph load

export function loadGraphLive(repoSlug) {
  const issues = ghList(`repos/${repoSlug}/issues?state=open&per_page=100`)
    .filter((i) => !i.pull_request);

  const subIssues = new Map();
  const refs = new Map();

  const wantChildrenOf = new Set();
  for (const i of issues) {
    if ((i.sub_issues_summary?.total ?? 0) > 0) wantChildrenOf.add(i.number);
    // Child-side declarations: the parent must be fetched even when the
    // parent itself is closed or outside the open list.
    for (const line of (i.body ?? '').split(/\r?\n/)) {
      const m = line.match(/(?:child-of|parent epic)\s*:\s*#(\d+)/i) ?? line.match(/(?:child-of|parent epic)\s+#(\d+)/i);
      if (m) wantChildrenOf.add(Number(m[1]));
    }
  }

  const fetchSubIssues = (n) => {
    if (subIssues.has(n)) return;
    const kids = ghList(`repos/${repoSlug}/issues/${n}/sub_issues?per_page=100`);
    subIssues.set(n, kids.map((k) => ({
      number: k.number, state: k.state, state_reason: k.state_reason ?? null, closed_at: k.closed_at ?? null,
    })));
  };

  const fetchRef = (n) => {
    if (refs.has(n)) return;
    try {
      const r = JSON.parse(ghV(['api', `repos/${repoSlug}/issues/${n}`]));
      refs.set(n, { state: r.state, state_reason: r.state_reason ?? null, closed_at: r.closed_at ?? null, title: r.title ?? '' });
    } catch {
      refs.set(n, { state: 'unreachable', state_reason: null, closed_at: null, title: '' });
    }
  };

  // Which numbers get resolved: every ref cited in a `Blocked on` line, every
  // Dependencies ref of a status:blocked issue (C3), every declared child
  // (C4), every issue cited in a milestone row (C6). Over-resolving is cheap;
  // under-resolving is a missed finding.
  for (const i of issues) {
    const body = i.body ?? '';
    const dep = sectionLines(body, 'Dependencies');
    const depRefs = new Set((dep ?? []).flatMap(refsOn));
    for (const line of body.split(/\r?\n/)) {
      if (/\bblocked on\b/i.test(line) && !dep?.includes(line)) {
        for (const n of refsOn(line)) fetchRef(n);
      }
      if (isTableRow(line) || /(?:\*\*)?children(?:\*\*)?\s*:/i.test(line)) {
        for (const n of refsOn(line)) fetchRef(n);
      }
    }
    if (hasLabel(i, 'status:blocked')) {
      for (const n of depRefs) fetchRef(n);
    }
  }

  for (const n of wantChildrenOf) fetchSubIssues(n);

  return { issues, subIssues, refs, adrResolves: scanAdrResolves() };
}

/** docs/adr/*.md header `Resolves: …#N` lines. */
export function scanAdrResolves() {
  return new Set(scanAdrResolvesDetailed().keys());
}

/** The detailed form for consumers that need provenance (file + 1-based line)
 *  beside the issue number — the generator renders `file:line@ref` from it.
 *  One parse feeds both shapes; the Set form is the lint's contract. */
export function scanAdrResolvesDetailed() {
  const found = new Map(); // issue number → { file, line }
  const dir = join(process.cwd(), 'docs', 'adr');
  if (!existsSync(dir)) return found;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.md') || f === 'README.md' || !statSync(join(dir, f)).isFile()) continue;
    const lines = readFileSync(join(dir, f), 'utf8').split(/\r?\n/);
    const head = lines.slice(0, 40);
    for (const [idx, line] of head.entries()) {
      if (/^\*\*?Resolves:?\*\*?:/i.test(line) || /^Resolves:/i.test(line)) {
        for (const n of refsOn(line)) {
          // First writer wins: an issue is resolved by one ADR; a duplicate
          // header is a corpus defect, not two provenances.
          if (!found.has(n)) found.set(n, { file: `docs/adr/${f}`, line: idx + 1 });
        }
      }
    }
  }
  return found;
}

export function loadGraphFixtures(dir) {
  const issues = JSON.parse(readFileSync(join(dir, 'issues.json'), 'utf8'));
  const subRaw = JSON.parse(readFileSync(join(dir, 'sub-issues.json'), 'utf8'));
  const refRaw = JSON.parse(readFileSync(join(dir, 'refs.json'), 'utf8'));
  const adrResolves = new Set(JSON.parse(readFileSync(join(dir, 'adr-resolves.json'), 'utf8')));
  return {
    issues,
    subIssues: new Map(Object.entries(subRaw).map(([k, v]) => [Number(k), v])),
    refs: new Map(Object.entries(refRaw).map(([k, v]) => [Number(k), v])),
    adrResolves,
  };
}
