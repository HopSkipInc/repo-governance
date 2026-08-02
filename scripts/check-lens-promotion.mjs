#!/usr/bin/env node
/**
 * lens-promotion sweep  [repo-governance's own tool — NOT a downstream template]
 *
 * The Design Lenses policy (templates/design-lenses.md) keeps its claim-class
 * table identical across repos and pushes domain-specific extensions into each
 * repo's design-lenses-records.md. That answers "is the table domain-specific?"
 * empirically: this repo is the only place that sees every records file, so
 * which extensions generalize is a thing to COUNT, not to argue about.
 *
 * Three findings, none blocking — this is a sweep, not a gate:
 *
 *   PROMOTE    the same extension class appears in 2+ repos' records files,
 *              each with its own evidence — a candidate for the upstream §3
 *              table, justified by the evidence columns it carries
 *   RESIDUALS  a repo's lens log holds 3+ forced fits — its next audit owes a
 *              row proposal ("what class would make these stop being awkward?")
 *   NO-RECORDS the policy is installed but the records file is not — Lens lines
 *              citing extensions there have nothing to validate against, and
 *              forced fits have nowhere to accumulate
 *
 * Like check-downstream-drift.mjs, this reads local checkouts from the
 * downstream/ ledgers and cannot run in CI. Run it during governance sync.
 * If no governed repo is reachable it reports SKIPPED — never OK, because a
 * check that cannot see its subject has not passed.
 *
 * Wiring:  node scripts/check-lens-promotion.mjs
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const DOWNSTREAM = join(ROOT, 'downstream');

/** Governed repos: (repo, localPath) from every client ledger — same shape as check-downstream-drift. */
function governedRepos() {
  const out = [];
  if (!existsSync(DOWNSTREAM)) return out;
  for (const client of readdirSync(DOWNSTREAM)) {
    const ledger = join(DOWNSTREAM, client, '_client.md');
    if (!existsSync(ledger)) continue;
    for (const line of readFileSync(ledger, 'utf8').split('\n')) {
      const m = line.match(/^\|\s*([\w.-]+\/[\w.-]+)\s*\|\s*`([^`]+)`\s*\|/);
      if (m) out.push({ repo: m[1], path: m[2].replace(/^~/, homedir()) });
    }
  }
  return out;
}

/** Rows of the table under `## N. <heading>` — cells per row, header/separator skipped. */
function tableRows(src, sectionRe) {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => sectionRe.test(l));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    if (!lines[i].startsWith('|')) continue;
    const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
    if (!cells[0] || /^-+$/.test(cells[0]) || /^_?e\.g\._?/i.test(cells[0])) continue;
    if (/^(claim class|date)$/i.test(cells[0])) continue;
    rows.push(cells);
  }
  return rows;
}

const repos = governedRepos();
const reachable = repos.filter((r) => existsSync(r.path));

if (repos.length && !reachable.length) {
  console.log(`check-lens-promotion: SKIPPED — ${repos.length} governed repo(s) in the ledger, none reachable on this machine.`);
  console.log('This tool needs local checkouts. Run it during governance sync, not in CI.');
  process.exit(0);
}

const extensions = new Map(); // class (lowercased) -> [{repo, discipline, evidence}]
const findings = [];

for (const { repo, path } of reachable) {
  const policy = join(path, 'docs/design-lenses.md');
  const records = join(path, 'docs/design-lenses-records.md');

  if (!existsSync(policy)) continue; // policy not adopted — nothing to sweep

  if (!existsSync(records)) {
    findings.push(`NO-RECORDS ${repo}: docs/design-lenses.md is installed but docs/design-lenses-records.md is not — extensions and forced fits have nowhere to live.`);
    continue;
  }

  const src = readFileSync(records, 'utf8');

  for (const cells of tableRows(src, /^##\s*3\./)) {
    const cls = cells[0].toLowerCase();
    if (!extensions.has(cls)) extensions.set(cls, []);
    extensions.get(cls).push({ repo, discipline: cells[1] ?? '', evidence: cells.at(-1) ?? '' });
  }

  const forced = tableRows(src, /^##\s*2\./).filter((cells) => cells.some((c) => /^forced\b/i.test(c)));
  if (forced.length >= 3) {
    findings.push(`RESIDUALS ${repo}: ${forced.length} forced fits in the lens log — the next audit owes a claim-class proposal from this residue (policy §3.1).`);
  }
}

for (const [cls, hits] of extensions) {
  if (hits.length >= 2) {
    findings.push(`PROMOTE "${cls}": appears in ${hits.length} repos (${hits.map((h) => h.repo).join(', ')}) — candidate for the upstream §3 table, justified by each repo's evidence column.`);
  }
}

console.log(`check-lens-promotion: ${reachable.length} reachable governed repo(s), ${extensions.size} distinct extension class(es).`);

if (!findings.length) {
  console.log('OK: no promotion candidates, no residue thresholds crossed, every adopter has a records file.');
  process.exit(0);
}

for (const f of findings) console.log(f);
console.log('\nNothing here blocks — PROMOTE and RESIDUALS are work items for the next governance sync, not defects.');
process.exit(0);
