#!/usr/bin/env node
// template: scripts/check-routing-equivalence.mjs v1.0.0 · updated 2026-11-07
/**
 * check-routing-equivalence  [governance template — copy to <project>/scripts/]
 *
 * PDR-011 decision 8's gate. Before a repo stops writing `impl:`, the
 * records-held risk→class rule must reproduce the repo's current tiers. This
 * script applies the rule to every open issue and lists every difference. It
 * exits non-zero while any difference is unresolved.
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
 *   0  every open issue's derived class matches its `impl:` tier
 *   1  one or more differences, untiered issues, or unresolved inputs
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
const LIMIT = 500;

/** The policy's capability classes, ranked. `human` is a completion gate, not a class. */
const CLASS_RANK = { standard: 1, frontier: 2 };

const RULE_HEADING = /^##[ \t]*\d*\.?[ \t]*Risk.*class rule[ \t]*$/i;
const NONE_ROW = '(none)';

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
  issues = JSON.parse(
    gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--limit', String(LIMIT),
        '--json', 'number,title,body,labels'])
  );
} catch (err) {
  skipped(`could not list issues (${String(err.message).split('\n')[0]})`);
}

const differences = [];
const untiered = [];
const unresolved = [];
let labelled = 0;

for (const issue of issues) {
  const names = issue.labels.map((l) => l.name);
  const risks = names.filter((n) => n.startsWith('risk:'));
  if (risks.length) labelled += 1;

  const derived = derive(risks, rule);
  if (typeof derived === 'object' && derived.error) {
    unresolved.push({ number: issue.number, why: derived.error });
    continue;
  }

  const impls = names.filter((n) => n.startsWith('impl:'));
  const gates = names.filter((n) => n.startsWith('gate:'));
  if (impls.length === 0) {
    untiered.push({ number: issue.number, derived, risks });
    continue;
  }
  if (impls.length > 1) {
    unresolved.push({ number: issue.number, why: `multiple impl: labels (${impls.join(', ')})` });
    continue;
  }

  const tier = impls[0];
  const current = tier === 'impl:standard' ? 'standard' : tier === 'impl:frontier' ? 'frontier' : tier === 'impl:human' ? 'human' : null;
  if (!current) {
    unresolved.push({ number: issue.number, why: `unknown impl: label ${tier}` });
    continue;
  }
  if (current !== derived) {
    differences.push({ number: issue.number, tier, current, derived, risks, gates });
  }
}

console.log(`check-routing-equivalence: ${REPO} — swept ${issues.length} open issues, ${labelled} with risk labels.`);
console.log(`Rule: ${RECORDS.replace(ROOT + '/', '')} §8 — ${rule.size} row(s), highest signal wins.`);

if (!differences.length && !untiered.length && !unresolved.length) {
  console.log(`OK: every open issue's derived class matches its impl: tier (${issues.length} open, ${labelled} labelled).`);
  process.exit(0);
}

const riskList = (risks) => (risks.length ? risks.join(', ') : '(zero risk labels)');
const gateList = (gates) => (gates.length ? ` + ${gates.join(', ')}` : '');

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
if (unresolved.length) {
  console.log(`\nUNRESOLVED (${unresolved.length}) — the rule could not be applied:`);
  for (const u of unresolved.sort((a, b) => a.number - b.number)) {
    console.log(`  #${u.number}  ${u.why}`);
  }
}

console.log(
  `\n${differences.length + untiered.length + unresolved.length} item(s) unresolved. ` +
  'Resolve each on the record — re-tier the issue, or change the rule — before `impl:` is retired.'
);
process.exit(1);
