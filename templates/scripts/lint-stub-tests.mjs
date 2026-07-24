#!/usr/bin/env node
// template: scripts/lint-stub-tests.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:stub-tests  [governance template — copy to <project>/scripts/ or tools/, npm repos only]
 *
 * Flags package.json `test`/`test:*` scripts that masquerade as a passing test
 * suite while running nothing — `echo "...not implemented" && exit 0` and
 * friends. A green stub is worse than no script: CI reports success for a
 * project that has zero coverage, which contradicts the core premise of this
 * governance practice ("CI is green" is not the same as "done" —
 * `templates/definition-of-done.md`'s Feature and Bug fix sections both
 * require real unit/regression tests; this lint catches the case where that
 * checklist item was checked off dishonestly).
 *
 * REPORT MODE: this prints findings and exits 0 — it never blocks. It is
 * meant to be consumed by a code-hygiene report job and/or your scheduled
 * audit's code-hygiene domain, not as a hard PR gate. Promote to a gate
 * (exit 1) once the baseline is clean, following a WARN→FAIL promotion
 * convention: ship it loud-but-non-blocking first, let one audit cycle
 * establish the baseline, then flip it to a gate once the count is zero.
 *
 * NON-NPM REPOS: this only recognizes npm's `test`/`test:*` script convention.
 * A .NET or Python repo needs a different detector for the equivalent smell —
 * e.g. a test method that's empty, or a `[Fact(Skip = ...)]` / `@pytest.mark.skip`
 * left in place with no tracking issue. The pattern ("a test surface reports
 * success without exercising anything") generalizes; this specific
 * implementation does not.
 *
 * Dependency-free. Usage: node scripts/lint-stub-tests.mjs
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORE_DIRS = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', 'coverage', '.vs']);
const STUB = /not\s*implemented|no\s*tests?\b|placeholder|todo|tbd|coming soon/i;

function findPackageJsons(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name) || name.startsWith('.git')) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) findPackageJsons(full, acc);
    else if (name === 'package.json') acc.push(full);
  }
  return acc;
}

const findings = [];
for (const pkgPath of findPackageJsons(ROOT)) {
  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { continue; }
  const scripts = pkg.scripts || {};
  for (const [name, cmd] of Object.entries(scripts)) {
    if (!/^test(:|$)/.test(name)) continue;
    const c = String(cmd);
    // Only false-GREEN stubs are the target: a script that runs no test runner
    // yet exits 0, so CI reports success. A script that explicitly exits
    // non-zero (e.g. npm's default `echo "Error: no test specified" && exit 1`)
    // fails honestly and is not flagged.
    const exitsNonZero = /\bexit\s+[1-9]\d*/.test(c);
    const onlyEchoExit = /^(\s*(echo[^&|;]*|exit\s+0|true)\s*(&&|;|\|\|)?\s*)+$/.test(c);
    if (!exitsNonZero && (STUB.test(c) || onlyEchoExit)) {
      findings.push({ pkg: relative(ROOT, pkgPath), name, cmd: c });
    }
  }
}

if (findings.length === 0) {
  console.log('OK: no stub test scripts found.');
  process.exit(0);
}

console.log(`[WARN] stub-test lint — ${findings.length} test script(s) run nothing but report success:`);
for (const f of findings) {
  console.log(`  ${f.pkg} → "${f.name}": ${f.cmd}`);
}
console.log('');
console.log('Replace with a real test invocation, or remove the script so CI does not report false-green.');
process.exit(0); // report-only
