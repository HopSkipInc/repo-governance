#!/usr/bin/env node
// template: scripts/check-instructions-budget.mjs v1.0.0 · updated 2026-11-05
/**
 * lint:instructions-budget  [governance template — copy to <project>/scripts/]
 *
 * The always-loaded instruction file is re-sent on every request of every agent
 * session. It has no natural bound: in HopSkipInc/ai-fleet the governance-sync
 * logs grew `CLAUDE.md` from 38,643 to 94,737 bytes in 48 days, because nothing
 * measured it. This is the measurement (issue #130).
 *
 * The always-loaded text is AGENTS.md plus CLAUDE.md, with `@path` imports
 * followed by lib/instructions.mjs. The default budget is 32,000 bytes (owner
 * decision, 2026-11-05); a repo may declare its own with `--budget <bytes>`.
 *
 * Fails when:
 *   OVER-BUDGET   the resolved instruction text exceeds the budget
 *   UNRESOLVED    an `@path` import cannot be read — a silent drop undercounts
 *   NO-CANONICAL  CLAUDE.md exists with no AGENTS.md beside it; the canonical
 *                 file is missing, the state this repo sat in unnoticed
 *
 * Prints SKIPPED — never a pass — when neither file exists. A check that cannot
 * see its subject has not passed.
 *
 * It is a function of the diff, so it belongs on the per-PR gate (ADR-026), not
 * a scheduled probe.
 *
 * Wiring:  node scripts/check-instructions-budget.mjs
 *          node scripts/check-instructions-budget.mjs --budget 40000
 */

import { existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { resolveInstructions } from './lib/instructions.mjs';

const DEFAULT_BUDGET = 32000;

const argv = process.argv.slice(2);
const budgetIdx = argv.indexOf('--budget');
let budget = DEFAULT_BUDGET;
if (budgetIdx !== -1) {
  const raw = argv[budgetIdx + 1];
  if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) {
    console.error('check-instructions-budget: ERROR — --budget needs a positive integer number of bytes.');
    process.exit(1);
  }
  budget = Number(raw);
}

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const AGENTS = join(ROOT, 'AGENTS.md');
const CLAUDE = join(ROOT, 'CLAUDE.md');

if (!existsSync(AGENTS) && !existsSync(CLAUDE)) {
  console.log('check-instructions-budget: SKIPPED — neither AGENTS.md nor CLAUDE.md exists.');
  console.log('Reporting SKIPPED, never a pass: a check that cannot see its subject has not passed.');
  process.exit(0);
}

const failures = [];

// The canonical file must exist. A one-line CLAUDE.md that imports a missing
// AGENTS.md is exactly the state this lint exists to name.
if (existsSync(CLAUDE) && !existsSync(AGENTS)) {
  failures.push({
    kind: 'NO-CANONICAL',
    msg: 'CLAUDE.md exists but AGENTS.md does not — the canonical instruction file is missing. Move the content to AGENTS.md and leave CLAUDE.md as the one-line `@AGENTS.md` import.',
  });
}

const { text, files, unresolved } = resolveInstructions(ROOT);
const total = Buffer.byteLength(text, 'utf8');

console.log('check-instructions-budget: always-loaded instruction text');
for (const f of files) {
  console.log(`  ${String(f.bytes).padStart(7)} bytes  ${f.relative}`);
}
console.log(`  ${String(total).padStart(7)} bytes  total (budget ${budget})`);

for (const u of unresolved) {
  failures.push({
    kind: 'UNRESOLVED',
    msg: `${u.target} cannot be read${u.from ? ` (imported from ${u.from.replace(`${ROOT}/`, '')})` : ''} — an unresolved import would undercount the text`,
  });
}

if (total > budget) {
  failures.push({
    kind: 'OVER-BUDGET',
    msg: `total ${total} bytes exceeds the ${budget}-byte budget by ${total - budget} bytes — trim the always-loaded file, or declare a per-repo --budget with a reason`,
  });
}

if (failures.length) {
  for (const f of failures) console.error(`\nFAIL ${f.kind}: ${f.msg}`);
  console.error(`\n${failures.length} blocking finding(s).`);
  process.exit(1);
}

console.log(`\nOK: ${total} bytes, within the ${budget}-byte budget, and every import resolved.`);
