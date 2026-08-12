#!/usr/bin/env node
// template: scripts/check-weakened-verification.mjs v1.0.0 · updated 2026-08-12
/**
 * lint:weakened-verification  [governance template — copy to <project>/scripts/]
 *
 * Catches the one workaround that has no positive diff to grep for: getting to
 * green by weakening the check instead of fixing the code.
 *
 * THE INCIDENT. `agent-routing.md` anti-pattern 7 records the failure observed
 * on the first agent-completed issue in this practice. The code was correct —
 * including a subtle detail a careless human would have missed. What got
 * botched was the *proof*: the issue demanded a specific check be shown to
 * fail, and an easier failure was substituted. CI green, PR merged, issue
 * closed, and the criterion that mattered unproven. The policy named it
 * **weakened verification** and routed the mitigation to issue authoring,
 * because the tier had been assigned on the blast radius of the *code* while
 * the silence lived in the *test*. Nothing mechanical looked at it.
 *
 * WHY A DELTA LINT AND NOT A PATTERN LINT. Every other workaround an agent
 * writes — a fallback, a default, a cast, a broad catch — lands as added
 * lines, so a reviewer or a grep has something to see. Weakening a test is a
 * workaround with a *negative* diff: a deleted assertion, a loosened matcher,
 * a `.skip` where a failure used to be. There is no string to search for. The
 * only observable is the direction the numbers moved, which means this lint
 * needs two revisions of the tree and cannot be a single-snapshot check.
 *
 * WHAT IT MEASURES, AND WHAT THAT PROXY IS WORTH. It counts assertion-shaped
 * and skip-shaped tokens in changed test files at `--base` and at HEAD, and
 * reads the **net** movement across the whole diff. The count is a proxy and
 * is not exact; it is calibrated by *symmetry* — both revisions are counted by
 * the same patterns, so a pattern this lint cannot see is invisible on both
 * sides and contributes zero to the delta. Netting across the diff rather than
 * per-file is deliberate: it is what makes a test-file split, rename, or move
 * come out at zero instead of firing, which is the largest false-positive
 * class and the one that would kill the lint inside a week.
 *
 * WHAT CLEARS A FINDING. Two records, either of which is enough:
 *   1. A row added to the "what tests do not verify at all" table in the repo's
 *      testing-strategy records file (`docs/testing-strategy.md` §6 by default;
 *      override with VERIFICATION_REGISTER). A removed assertion means a
 *      property stopped being verified, and that section is exactly the
 *      register for properties nothing verifies. It is also a *records* file,
 *      normally deny-listed for agent edits by `harness-enforcement.md` — so on
 *      a governed repo this record costs a human's keystroke. That is the
 *      intended shape, not a side effect: an agent that weakens verification
 *      has to stop and ask, which is the whole point.
 *   2. A `VERIFICATION-DELTA: <reason>` line added anywhere in the diff, for
 *      the legitimate cases — three weak assertions replaced by one strong one,
 *      a genuinely obsolete test deleted. One line of justification is the
 *      right price for those; silence is not.
 *
 * REPORT MODE BY DEFAULT. Prints findings and exits 0. Pass `--gate` to exit 1.
 * Promotion condition, following this estate's WARN→FAIL convention: run it in
 * report mode for one audit cycle, read the false positives it actually
 * produces on the repo's real merge history, and flip to `--gate` once the
 * uncleared count is zero. A rule gated before it has met the real corpus is
 * how two lints in this practice shipped correct-in-the-abstract and wrong in
 * fact.
 *
 * FAIL-CLOSED. With no resolvable `--base`, this reports SKIPPED and never
 * prints OK — a check that cannot run must not read as evidence. In `--gate`
 * mode a SKIPPED exits 1, because a load-bearing gate that silently could not
 * run is worse than no gate. CI always passes `--base`, so this only fires
 * where it should.
 *
 * Dependency-free. Requires git.
 * Usage: node scripts/check-weakened-verification.mjs --base origin/main [--gate]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const argv = process.argv.slice(2);
const GATE = argv.includes('--gate');
const baseFlag = argv.indexOf('--base');
const BASE = baseFlag >= 0 ? argv[baseFlag + 1] : process.env.GOVERNANCE_BASE_REF || '';
const REGISTER = process.env.VERIFICATION_REGISTER || 'docs/testing-strategy.md';

function skipped(reason) {
  console.log(`SKIPPED: weakened-verification did not run — ${reason}.`);
  console.log('This is not a pass. Re-run with --base <ref> against a resolvable revision.');
  process.exit(GATE ? 1 : 0);
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

if (!BASE) skipped('no --base ref given and GOVERNANCE_BASE_REF is unset');

let baseSha;
try {
  baseSha = git(['rev-parse', '--verify', `${BASE}^{commit}`]).trim();
} catch {
  skipped(`base ref "${BASE}" does not resolve to a commit`);
}

/**
 * Assertion-shaped tokens across the ecosystems this estate governs. Counted,
 * not parsed — see the proxy note in the header. Overlaps are harmless because
 * both revisions are counted identically.
 */
const ASSERTIONS = [
  /\bexpect\s*\(/g, // jest, vitest, jasmine, chai-expect, python assertpy
  /\bassert(?:\.\w+)?\s*\(/g, // node:assert, chai assert, go testify assert(
  /\bassert\s+\w/g, // python bare `assert x == 1`
  /\bself\.assert\w*\s*\(/g, // python unittest
  /\bAssert\.\w+\s*\(/g, // xunit, nunit, mstest
  /\.Should\s*\(\s*\)/g, // FluentAssertions
  /\bshould\.\w+/g, // chai should
  /\brequire\.\w+\s*\(/g, // go testify require
  /\bt\.(?:Error|Errorf|Fatal|Fatalf)\s*\(/g, // go stdlib testing
  /\bt\.(?:is|not|deepEqual|truthy|falsy|throws)\s*\(/g, // ava
  /\bpytest\.(?:raises|warns)\s*\(/g,
  /\bassert_\w+\s*\(/g, // minitest, rails
];

/**
 * Skip-shaped tokens. `.only` belongs here and is not a stylistic nit: it
 * silently disables every other test in the file, which is the largest
 * single-token reduction in verification available anywhere in a suite.
 */
const SKIPS = [
  /\b(?:it|test|describe|context|suite)\.(?:skip|todo)\s*\(/g,
  /\bx(?:it|describe|test)\s*\(/g,
  /@pytest\.mark\.(?:skip|skipif|xfail)/g,
  /@unittest\.skip/g,
  /\[(?:Fact|Theory)\s*\(\s*Skip\s*=/g,
  /\[Ignore\b/g,
  /\bt\.Skip(?:Now|f)?\s*\(/g,
  /\b(?:it|test|describe|context)\.only\s*\(/g,
];

/**
 * Convention-based, because there is no portable definition of "test file".
 * A repo whose tests live somewhere unusual extends this list in its own copy —
 * and records that it did, so the next sync does not silently revert it.
 */
function isTestFile(p) {
  if (/(?:^|\/)(?:tests?|spec|specs|__tests__)\//.test(p)) return true;
  return /(?:[._-](?:test|spec)s?\.[cm]?[jt]sx?|_test\.go|(?:^|\/)test_[^/]*\.py|_test\.py|Tests?\.cs)$/.test(p);
}

const count = (text, patterns) =>
  patterns.reduce((n, re) => n + (text.match(re) || []).length, 0);

function atBase(path) {
  try {
    return git(['show', `${baseSha}:${path}`]);
  } catch {
    return ''; // added in this diff, or absent at base
  }
}

function atHead(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''; // '' covers a deletion
}

// ---------------------------------------------------------------- the diff

let changed;
try {
  changed = git(['diff', '--name-status', '--find-renames', baseSha, '--'])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      // A rename is "R100\told\tnew" — the new path is what exists at HEAD, and
      // the old path is what must be read at base or the whole file counts as
      // deleted and the delta is a false positive.
      return parts.length >= 3
        ? { status: parts[0], base: parts[1], head: parts[2] }
        : { status: parts[0], base: parts[1], head: parts[1] };
    });
} catch (err) {
  skipped(`git diff against ${BASE} failed (${String(err.message).split('\n')[0]})`);
}

const rows = [];
let netAssertions = 0;
let netSkips = 0;

for (const f of changed) {
  if (!isTestFile(f.head) && !isTestFile(f.base)) continue;
  const before = atBase(f.base);
  const after = atHead(f.head);
  const dA = count(after, ASSERTIONS) - count(before, ASSERTIONS);
  const dS = count(after, SKIPS) - count(before, SKIPS);
  netAssertions += dA;
  netSkips += dS;
  if (dA !== 0 || dS !== 0) {
    rows.push({ path: f.head === f.base ? f.head : `${f.base} → ${f.head}`, dA, dS, status: f.status });
  }
}

// ------------------------------------------------------------- the records

function registerRowCount(text) {
  // Line-scan, never a regex with a section terminator: JavaScript has no \Z
  // anchor, and `(?=^##\s|\Z)` degrades silently to "followed by a literal Z".
  // That bug cost this estate a live lint against a whole real backlog.
  let inSection = false;
  let n = 0;
  for (const line of text.split('\n')) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+6\.|^##\s+.*do not verify/i.test(line);
      continue;
    }
    if (!inSection) continue;
    if (/^\s*\|/.test(line) && !/^\s*\|[\s|:-]*\|?\s*$/.test(line)) n++;
  }
  return n;
}

const registerTouched = changed.some((f) => f.head === REGISTER || f.base === REGISTER);
const registerGrew =
  registerTouched && registerRowCount(atHead(REGISTER)) > registerRowCount(atBase(REGISTER));

let markerPresent = false;
try {
  markerPresent = git(['diff', '--unified=0', baseSha, '--'])
    .split('\n')
    .some((line) => line.startsWith('+') && line.includes('VERIFICATION-DELTA:'));
} catch {
  markerPresent = false; // fail closed: an unreadable patch does not clear a finding
}

// ----------------------------------------------------------------- verdict

const weakened = netAssertions < 0 || netSkips > 0;

if (rows.length) {
  console.log(`weakened-verification — ${rows.length} test file(s) moved:`);
  for (const r of rows) {
    const a = r.dA > 0 ? `+${r.dA}` : String(r.dA);
    const s = r.dS > 0 ? `+${r.dS}` : String(r.dS);
    console.log(`  [${r.status}] ${r.path}  assertions ${a}  skips ${s}`);
  }
  console.log(`  net: assertions ${netAssertions >= 0 ? '+' : ''}${netAssertions}, skips ${netSkips >= 0 ? '+' : ''}${netSkips}`);
  console.log('');
}

if (!weakened) {
  console.log('OK: no net loss of verification across the changed test files.');
  process.exit(0);
}

if (registerGrew) {
  console.log(`OK: verification decreased and ${REGISTER} gained a row recording the property that stopped being verified.`);
  process.exit(0);
}

if (markerPresent) {
  console.log('OK: verification decreased and the diff carries a VERIFICATION-DELTA: justification.');
  process.exit(0);
}

console.log('[FINDING] verification decreased with no record.');
console.log('');
console.log('A removed assertion or an added skip means a property stopped being verified.');
console.log('This is the weakened-verification failure mode: green CI, unproven criterion.');
console.log('');
console.log('Do one of these — not a fourth thing:');
console.log(`  1. Restore the verification. If the test now fails, the code is what needs fixing.`);
console.log(`  2. Add the row to ${REGISTER} §6 naming the property, the surface, and what a`);
console.log(`     silent failure looks like. On a governed repo that file is deny-listed for`);
console.log(`     agent edits: stop and ask a human. Do not route around the deny.`);
console.log(`  3. Add "VERIFICATION-DELTA: <reason>" in the diff if the loss is genuine and`);
console.log(`     justified — a stronger assertion replacing weaker ones, an obsolete test removed.`);
console.log('');
process.exit(GATE ? 1 : 0);
