#!/usr/bin/env node
/**
 * lint:claim-coverage  [repo-governance's own tool — NOT a downstream template]
 *
 * Closes issue #13 under PDR-008 (the compute-location decision, 2026-08-02):
 * the claim-coverage metric computes in the health report, backed by this one
 * fail-closed enumerator. The taxonomy (claim, instruction-backed, gate-backed,
 * both, neither, imitation surface) is defined in templates/governance-health.md
 * v1.1.0; the derivation contract below is what its Claim coverage section cites.
 *
 * THE DERIVATION RULE
 *
 *   Sources (all three required, or SKIPPED):
 *     docs/definition-of-done.md, CLAUDE.md, docs/code-conventions.md (§1 + §2)
 *   Claim:      a code-conventions.md §1 table row or §2 bullet, or — in the
 *               other two sources — a bullet/numbered item carrying a normative
 *               keyword (must / never / always / required / shall)
 *   Instruction-backed: every claim, by construction (it is stated in an
 *               agent-readable instruction)
 *   Gate-backed: the claim's text names a backticked path that both resolves
 *               to an existing file and is enforcement-shaped (a script,
 *               workflow, or test — .mjs, .yml, or under scripts/ or test/)
 *   Coverage:   the fraction of claims backed by both
 *
 * WHAT THIS NUMBER CANNOT SEE. A claim stated in an instruction artifact is
 * instruction-backed by construction, so the true "neither" class — the
 * imitation surface that floats in prose, lore, or a README reading as
 * governed with nothing behind it — never enters the denominator. This tool
 * names the instruction-only claims (told, not enforced); the neither class
 * is the audit's job, not this metric's. PDR-008 draws the same boundary:
 * the enumerator verifies the named gate EXISTS; whether it is WIRED is
 * domain 8's question.
 *
 * FAILS CLOSED — the binding constraint from the routing sweep. Any source
 * absent, or any source yielding zero claims (unparseable by the rule above),
 * reports SKIPPED naming the source — never a partial score. An enumerator
 * that under-counts silently reports high coverage, and the metric becomes an
 * imitation surface. (Expected on this very repo: no docs/definition-of-done.md
 * exists here, so the mothership reports SKIPPED and means it.)
 *
 * Wiring:  node scripts/check-claim-coverage.mjs
 *          node scripts/check-claim-coverage.mjs --json   (machine-readable inventory)
 */

import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const JSON_OUT = process.argv.includes('--json');

const NORMATIVE = /\b(must|never|always|required|shall)\b/i;
const ENFORCEMENT_SHAPE = /(\.mjs|\.ya?ml)$|^(scripts|test)\//;

const skipped = [];
function skip(source, why) {
  skipped.push({ source, why });
}

/** A path-like backticked span that resolves and is enforcement-shaped. */
function gatePaths(text) {
  const spans = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  return spans.filter((s) => ENFORCEMENT_SHAPE.test(s) && existsSync(join(ROOT, s)));
}

/** code-conventions.md: §1 rows (claim + named enforcement) and §2 bullets. */
function fromConventions(text) {
  const sec1 = text.match(/##\s*1\.\s*Enforced conventions([\s\S]*?)(?=\n##\s|\n$)/i);
  const sec2 = text.match(/##\s*2\.\s*Documented conventions([\s\S]*?)(?=\n##\s|\n$)/i);
  if (!sec1 || !sec2) {
    skip('docs/code-conventions.md', '§1 or §2 heading absent — unparseable by the derivation rule');
    return [];
  }
  const claims = [];
  for (const line of sec1[1].split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4 || /^-+$/.test(cells[0]) || cells[0] === '#') continue;
    const text = `${cells[1]} ${cells[3]}`; // Convention + Enforcement cells
    claims.push({ source: 'code-conventions.md §1', text: cells[1], gates: gatePaths(text) });
  }
  for (const line of sec2[1].split('\n')) {
    const m = line.match(/^\s*[-*]\s+(.+)/);
    if (m) claims.push({ source: 'code-conventions.md §2', text: m[1], gates: gatePaths(m[1]) });
  }
  if (!claims.length) skip('docs/code-conventions.md', 'zero claims extracted — unparseable by the derivation rule');
  return claims;
}

/** Prose sources: bullet/numbered items carrying a normative keyword. */
function fromProse(source, text) {
  const claims = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/);
    if (m && NORMATIVE.test(m[1])) claims.push({ source, text: m[1], gates: gatePaths(m[1]) });
  }
  if (!claims.length) skip(source, 'zero normative bullets extracted — unparseable by the derivation rule');
  return claims;
}

const SOURCES = [
  { path: 'docs/definition-of-done.md', read: (t) => fromProse('docs/definition-of-done.md', t) },
  { path: 'CLAUDE.md', read: (t) => fromProse('CLAUDE.md', t) },
  { path: 'docs/code-conventions.md', read: fromConventions },
];

const claims = [];
for (const { path, read } of SOURCES) {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) {
    skip(path, 'source artifact absent');
    continue;
  }
  claims.push(...read(readFileSync(abs, 'utf8')));
}

if (skipped.length) {
  console.log(`check-claim-coverage: SKIPPED — ${skipped.map((s) => `${s.source} (${s.why})`).join('; ')}`);
  console.log('Reporting SKIPPED, never a partial score: an enumerator that under-counts silently reports high coverage.');
  process.exit(0);
}

const both = claims.filter((c) => c.gates.length);
const toldOnly = claims.filter((c) => !c.gates.length);

if (JSON_OUT) {
  console.log(JSON.stringify({ artifacts: SOURCES.map((s) => s.path), claims: claims.length, both: both.length, instructionOnly: toldOnly }, null, 2));
  process.exit(0);
}

console.log(`check-claim-coverage: ${SOURCES.length} artifacts scanned (${SOURCES.map((s) => s.path).join(', ')}).`);
console.log(`Claim coverage: ${both.length}/${claims.length} (${Math.round((both.length / claims.length) * 100)}%) backed by both instruction and gate.`);
if (toldOnly.length) {
  console.log(`\nTold, not enforced (${toldOnly.length}) — visible instruction-only claims:`);
  for (const c of toldOnly) console.log(`  [${c.source}] ${c.text.slice(0, 120)}`);
}
console.log('\nNot visible to this number: claims stated nowhere in the three sources — the neither class is the audit’s job, not this metric’s.');
process.exit(0);
