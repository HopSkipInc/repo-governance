#!/usr/bin/env node
// template: scripts/check-routing-equivalence.mjs v1.3.1 · updated 2026-11-09
/**
 * check-routing-equivalence  [governance template — copy to <project>/scripts/]
 *
 * PDR-011 decision 8's gate. Before a repo stops writing `impl:`, the
 * records-held risk→class rule must reproduce the repo's current tiers. This
 * script applies the rule to every open issue (paginated, not a fixed window)
 * and lists every difference. It
 * exits non-zero while any difference is unresolved.
 *
 * EPICS ARE EXEMPT, TIERED OR NOT. Policy §Mechanism 3 gives an epic a child
 * tier table instead of a single tier. The epic shape is detected exactly as
 * `check-issue-routing.mjs`'s `isEpicShape()` does — the `epic` label, or a
 * child/tier row in the `## Impl tier` block. Exempt epics are listed under
 * their own heading and do not count as unresolved. Before 1.2.0 every epic
 * without a label counted as untiered; 1.2.0 exempted those but still compared
 * an epic that carried an `impl:` label, which is itself the anomaly — so every
 * tiered epic on ai-fleet reported `frontier -> standard (zero risk labels)`.
 * 1.3.0 exempts the shape whether or not it is labelled; the lint reports the
 * stray label under its own rule (R13).
 *
 * ROLLING REPORTS ARE EXEMPT. Some open issues are a workflow's output surface,
 * rewritten on every run — the `rolling-report` label is the declared marker.
 * A tier line or label applied to one is removed by the next run, so it is not
 * a work item and is never compared. The exemption keys on the label, never on
 * body text the workflow rewrites.
 *
 * HUMAN IS A GATE, NOT A CLASS. PDR-011 decision 2 moves human completion to
 * the `gate:` family, so the rule never outputs `human`. An `impl:human` issue
 * is therefore equivalent when it carries any `gate:` label (the family is
 * `gate:decision`, `gate:human-review`, `gate:human-approval`, `gate:credentials`)
 * and the class comparison does not apply to it. An `impl:human` issue with no
 * `gate:` label is reported under its own heading as needing one, never as a
 * class difference.
 *
 * THE RULE
 *
 * `docs/agent-routing-records.md` §8 holds a table:
 *
 *   | Risk label | Minimum class |
 *   |---|---|
 *   | (none) | standard |
 *   | `risk:silent-failure` | frontier |
 *   | ...
 *
 * The rule names classes only, never models. Highest signal wins: the derived
 * class is the highest class among the rows for the labels the issue carries;
 * zero labels uses the `(none)` row. Gate labels are orthogonal and do not
 * change the class.
 *
 * EXIT CODES
 *
 *   0  every open issue's derived class matches its `impl:` tier (epics exempt)
 *   1  one or more differences, untiered issues, `impl:human` issues with no
 *      gate: label, or unresolved inputs
 *   2  SKIPPED — the check could not run (no rule table, malformed rule,
 *      unknown class, no gh auth, unreadable issue)
 *
 * A skipped check is never a pass. Exit 2 is deliberately distinct from both
 * success and a difference so CI can tell "not run" from "ran and found work".
 *
 * Wiring: node scripts/check-routing-equivalence.mjs
 * Env:    ROUTING_REPO=owner/repo overrides the git-remote detection.
 *         ROUTING_RECORDS=<path> overrides docs/agent-routing-records.md.
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const RECORDS = process.env.ROUTING_RECORDS || join(ROOT, 'docs/agent-routing-records.md');

/** The policy's capability classes, ranked. `human` is a completion gate, not a class. */
const CLASS_RANK = { standard: 1, frontier: 2 };

const RULE_HEADING = /^##[ \t]*\d*\.?[ \t]*Risk.*class rule[ \t]*$/i;
const NONE_ROW = '(none)';

/** The declared marker on a workflow's rolling output issue — exempt from the check. */
const ROLLING_REPORT_LABEL = 'rolling-report';

/**
 * The epic shape, copied verbatim from `check-issue-routing.mjs` (v1.7.0),
 * where R1 has exempted it since 1.3.0. An epic carries a tier table over its
 * children rather than a single tier (policy §Mechanism 3), so it has no
 * `impl:` label by design. Detected two ways, either sufficient: the repo's
 * `epic` label, or a row in the `## Impl tier` block pairing a child issue with
 * a tier.
 */
const EPIC_TIER_ROW = /^\s*\|[^\n]*#\d+[^\n]*\|\s*(standard|frontier|human)\s*\|/im;

function isEpicShape(names, block) {
  return names.some((n) => n.toLowerCase() === 'epic') || (block ? EPIC_TIER_ROW.test(block) : false);
}

/**
 * The `## Impl tier` block, copied verbatim from `check-issue-routing.mjs`.
 * Line-scanned rather than regex-matched because JavaScript has no `\Z` anchor:
 * `(?=^##\s|\Z)` degrades to "followed by a literal Z" and the block never ends.
 */
function tierBlock(body) {
  if (!body) return null;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##[ \t]*Impl tier[ \t]*$/i.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##[ \t]/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

function skipped(message) {
  console.log(`SKIPPED: ${message}`);
  console.error('Reporting an error, not a pass: a check that cannot run has not run.');
  process.exit(2);
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function repoSlug() {
  if (process.env.ROUTING_REPO) return process.env.ROUTING_REPO;
  const out = JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner']));
  return out.nameWithOwner;
}

/** Parse §8 into a Map<risk label | (none), class>. Returns {rows} or {error}. */
function readRule(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => RULE_HEADING.test(l));
  if (start === -1) return { error: 'no "Risk → class rule" section in docs/agent-routing-records.md' };

  const rows = new Map();
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##[ \t]/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim().replace(/[`*]/g, ''));
    if (!cells.length || cells.every((c) => /^-+$/.test(c))) continue;
    if (/^risk (label|set)$/i.test(cells[0]) || /^minimum class$/i.test(cells[1])) continue;
    if (cells.length < 2) return { error: `malformed rule row: "${line.trim()}"` };
    const label = cells[0].toLowerCase();
    const cls = cells[1].toLowerCase();
    if (label !== NONE_ROW && !label.startsWith('risk:')) {
      return { error: `rule row names "${label}" — expected a risk: label or ${NONE_ROW}` };
    }
    if (!(cls in CLASS_RANK)) {
      return { error: `rule row maps ${label} to "${cls}" — the rule may output standard or frontier only` };
    }
    if (rows.has(label)) return { error: `duplicate rule row for ${label}` };
    rows.set(label, cls);
  }
  if (!rows.size) return { error: 'the rule section contains no rows' };
  if (!rows.has(NONE_ROW)) return { error: `the rule has no ${NONE_ROW} row for issues with zero risk labels` };
  return { rows };
}

function derive(risks, rows) {
  if (!risks.length) return rows.get(NONE_ROW);
  let derived = null;
  for (const label of risks) {
    const cls = rows.get(label);
    if (!cls) return { error: `no rule row for ${label}` };
    if (!derived || CLASS_RANK[cls] > CLASS_RANK[derived]) derived = cls;
  }
  return derived;
}

// ---------------------------------------------------------------- run

if (!existsSync(RECORDS)) skipped(`rule file not found at ${RECORDS}`);

const parsed = readRule(readFileSync(RECORDS, 'utf8'));
if (parsed.error) skipped(parsed.error);
const rule = parsed.rows;

const REPO = repoSlug();
let issues;
try {
  // Every open issue, not a fixed window. `--paginate` follows the Link header
  // and `--slurp` wraps the pages, so a repo past any single-page ceiling is
  // still fully enumerated. Pull requests share the issues endpoint; drop them.
  const pages = JSON.parse(
    gh(['api', `repos/${REPO}/issues?state=open&per_page=100`, '--paginate', '--slurp'])
  );
  issues = pages
    .flat()
    .filter((i) => !i.pull_request)
    .map((i) => ({ number: i.number, title: i.title, labels: i.labels ?? [], body: i.body ?? '' }));
} catch (err) {
  skipped(`could not list issues (${String(err.message).split('\n')[0]})`);
}

const differences = [];
const untiered = [];
const epics = [];
const rollingReports = [];
const needsGate = [];
const unresolved = [];
let labelled = 0;

for (const issue of issues) {
  const names = issue.labels.map((l) => l.name);

  // A rolling report is a workflow's output surface, not a work item. Exempt it
  // before the rule is applied — the next run rewrites the body and drops any
  // label or tier line written here, so there is nothing to compare.
  if (names.some((n) => n.toLowerCase() === ROLLING_REPORT_LABEL)) {
    rollingReports.push({ number: issue.number });
    continue;
  }

  const risks = names.filter((n) => n.startsWith('risk:'));
  if (risks.length) labelled += 1;

  const impls = names.filter((n) => n.startsWith('impl:'));
  const gates = names.filter((n) => n.startsWith('gate:'));
  // Policy §Mechanism 3: an epic has no single tier, so it is exempt rather
  // than untiered or a difference — including when it carries an `impl:` label,
  // which is the anomaly check-issue-routing.mjs's R13 reports. This runs before
  // derive(): an epic is exempt from the rule entirely, so an unmapped risk
  // label on one is not an unresolved item either.
  if (isEpicShape(names, tierBlock(issue.body))) {
    const derived = derive(risks, rule);
    epics.push({ number: issue.number, derived: typeof derived === 'object' ? '(rule not applicable)' : derived, risks, impls });
    continue;
  }

  const derived = derive(risks, rule);
  if (typeof derived === 'object' && derived.error) {
    unresolved.push({ number: issue.number, why: derived.error });
    continue;
  }

  if (impls.length === 0) {
    untiered.push({ number: issue.number, derived, risks });
    continue;
  }
  if (impls.length > 1) {
    unresolved.push({ number: issue.number, why: `multiple impl: labels (${impls.join(', ')})` });
    continue;
  }

  const tier = impls[0];
  // PDR-011 decision 2: human completion lives in the gate: family, so an
  // impl:human issue is equivalent when it carries a gate: label. The rule
  // outputs classes only and the class comparison does not apply to it.
  if (tier === 'impl:human') {
    if (gates.length) {
      continue; // equivalent — the gate: label is the completion record
    }
    needsGate.push({ number: issue.number, risks });
    continue;
  }

  const current = tier === 'impl:standard' ? 'standard' : tier === 'impl:frontier' ? 'frontier' : null;
  if (!current) {
    unresolved.push({ number: issue.number, why: `unknown impl: label ${tier}` });
    continue;
  }
  if (current !== derived) {
    differences.push({ number: issue.number, tier, current, derived, risks, gates });
  }
}

console.log(`check-routing-equivalence: ${REPO} — swept ${issues.length} open issues, ${labelled} with risk labels; ${epics.length} epic(s) and ${rollingReports.length} rolling report(s) exempt.`);
console.log(`Rule: ${RECORDS.replace(ROOT + '/', '')} §8 — ${rule.size} row(s), highest signal wins.`);

const riskList = (risks) => (risks.length ? risks.join(', ') : '(zero risk labels)');
const gateList = (gates) => (gates.length ? ` + ${gates.join(', ')}` : '');

if (epics.length) {
  console.log(`\nEXEMPT EPICS (${epics.length}) — epic-shaped, no single tier by policy §Mechanism 3:`);
  for (const e of epics.sort((a, b) => a.number - b.number)) {
    // The impl: label is shown, not compared: on an epic it is the anomaly the
    // routing lint reports (R13), not a tier this check should hold it to.
    const impl = e.impls.length ? `, ${e.impls.join(', ')}` : '';
    console.log(`  #${e.number}  (epic${impl}) -> ${e.derived}  [${riskList(e.risks)}]`);
  }
}

if (rollingReports.length) {
  console.log(`\nEXEMPT ROLLING REPORTS (${rollingReports.length}) — declared \`${ROLLING_REPORT_LABEL}\`, rewritten by a workflow every run:`);
  for (const r of rollingReports.sort((a, b) => a.number - b.number)) {
    console.log(`  #${r.number}  (rolling report)`);
  }
}

if (!differences.length && !untiered.length && !needsGate.length && !unresolved.length) {
  console.log(`OK: every open issue's derived class matches its impl: tier (${issues.length} open, ${labelled} labelled, ${epics.length} epic(s) and ${rollingReports.length} rolling report(s) exempt).`);
  process.exit(0);
}

if (differences.length) {
  console.log(`\nDIFFERENCES (${differences.length}):`);
  for (const d of differences.sort((a, b) => a.number - b.number)) {
    console.log(`  #${d.number}  ${d.tier} (${d.current}) -> ${d.derived}${gateList(d.gates)}  [${riskList(d.risks)}]`);
  }
}
if (untiered.length) {
  console.log(`\nUNTIERED (${untiered.length}) — no impl: label, so no tier to compare:`);
  for (const u of untiered.sort((a, b) => a.number - b.number)) {
    console.log(`  #${u.number}  (none) -> ${u.derived}  [${riskList(u.risks)}]`);
  }
}
if (needsGate.length) {
  console.log(`\nIMPL:HUMAN WITHOUT A GATE LABEL (${needsGate.length}) — human completion is a gate: label, so the class comparison does not apply:`);
  for (const u of needsGate.sort((a, b) => a.number - b.number)) {
    console.log(`  #${u.number}  add a gate: label (${riskList(u.risks)})`);
  }
}
if (unresolved.length) {
  console.log(`\nUNRESOLVED (${unresolved.length}) — the rule could not be applied:`);
  for (const u of unresolved.sort((a, b) => a.number - b.number)) {
    console.log(`  #${u.number}  ${u.why}`);
  }
}

console.log(
  `\n${differences.length + untiered.length + needsGate.length + unresolved.length} item(s) unresolved. ` +
  'Resolve each on the record — re-tier the issue, or change the rule — before `impl:` is retired.'
);
process.exit(1);
