#!/usr/bin/env node
/**
 * lint:analyze-repo-coverage  [repo-governance's own lint — NOT a downstream template]
 *
 * /analyze-repo bootstraps a new governed repo by walking a hand-maintained
 * template-applicability matrix. Every template added since that matrix was
 * written is therefore invisible to it — and the bootstrap still prints a score
 * and an action plan and reads as a complete success.
 *
 * On 2026-07-24 the matrix named 18 of 36 templates. A repo bootstrapped that day
 * silently received roughly the session-8 practice: the entire five-layer sweep,
 * all eight lint scripts, and every artifact from that day were unreachable. The
 * omission does not surface at bootstrap time. It surfaces months later as "why
 * doesn't this client have X".
 *
 * A bootstrap that omits half the templates looks exactly like one that succeeded.
 * This lint is what makes that difference visible.
 *
 * Rule: every file under templates/ is either referenced in the matrix or listed
 * in EXCLUSIONS below with a reason. Adding a template and not deciding which of
 * the two it is fails the build.
 *
 * Wiring:  node scripts/check-analyze-repo-coverage.mjs
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const TEMPLATES = join(ROOT, 'templates');
const MATRIX_FILE = join(ROOT, '.claude/commands/analyze-repo.md');
const EXTS = ['.md', '.mjs', '.yml'];

/**
 * Templates deliberately NOT offered by /analyze-repo, with the reason.
 * An entry here is a decision on record, which is the point — the alternative is
 * a template that is silently unreachable and nobody remembers why.
 */
const EXCLUSIONS = new Map([
  ['adr/022-definition-of-done.md', 'referenced via the DoD row, not offered standalone'],
  ['routing-calibration-protocol.md', 'run once per repo after routing is adopted, not a bootstrap artifact'],
  ['agents/routing-classifier.md', 'installed as a dependency of skills/routing-triage/, never on its own'],
]);

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (EXTS.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

const matrix = readFileSync(MATRIX_FILE, 'utf8');

/** Every backtick-quoted token in the matrix file — the references we honour. */
const referenced = new Set([...matrix.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()));

/**
 * A template is covered if the matrix names its path relative to templates/, or
 * names a directory prefix of it (e.g. `skills/adr-interview/` covers that
 * skill's SKILL.md).
 */
function isCovered(rel) {
  for (const ref of referenced) {
    if (ref === rel) return true;
    if (ref.endsWith('/') && rel.startsWith(ref)) return true;
    if (rel.startsWith(ref + '/')) return true;
  }
  return false;
}

const files = walk(TEMPLATES).sort();
const uncovered = [];
const staleExclusions = [];

for (const file of files) {
  const rel = relative(TEMPLATES, file);
  if (EXCLUSIONS.has(rel)) continue;
  if (!isCovered(rel)) uncovered.push(rel);
}

// An exclusion for a template that no longer exists is itself drift.
for (const rel of EXCLUSIONS.keys()) {
  if (!files.some((f) => relative(TEMPLATES, f) === rel)) staleExclusions.push(rel);
}

const covered = files.length - uncovered.length - EXCLUSIONS.size;
console.log(
  `check-analyze-repo-coverage: ${files.length} templates — ${covered} in the matrix, ` +
    `${EXCLUSIONS.size} excluded, ${uncovered.length} unaccounted for.`
);

if (!uncovered.length && !staleExclusions.length) {
  console.log('OK: every template is either offered by /analyze-repo or excluded on the record.');
  process.exit(0);
}

console.error('');
if (uncovered.length) {
  console.error(`FAILED: ${uncovered.length} template(s) not referenced in the matrix:`);
  for (const r of uncovered) console.error(`  - ${r}`);
  console.error('');
  console.error('A repo bootstrapped now would silently never receive these.');
  console.error(`Add a row to the template-applicability matrix in ${relative(ROOT, MATRIX_FILE)},`);
  console.error('or add the template to EXCLUSIONS in this script with a one-line reason.');
}
if (staleExclusions.length) {
  console.error(`\nFAILED: ${staleExclusions.length} exclusion(s) name a template that no longer exists:`);
  for (const r of staleExclusions) console.error(`  - ${r}`);
  console.error('\nRemove the stale entry from EXCLUSIONS.');
}
process.exit(1);
