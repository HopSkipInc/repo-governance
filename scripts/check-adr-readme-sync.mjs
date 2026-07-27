// template: scripts/check-adr-readme-sync.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:adr-readme-sync  [governance template — copy to host/scripts/ in the target repo]
 *
 * Every decision record must be registered in its directory's README index.
 * Covers both record types:
 *   docs/adr/NNN-*.md  must have a row in docs/adr/README.md   (architecture decisions)
 *   docs/pdr/NNN-*.md  must have a row in docs/pdr/README.md   (product decisions)
 *
 * An unregistered record allows the next contributor to reuse the same number —
 * a numbering collision that causes confusion and audit gaps.
 *
 * Check: the README contains "(NNN-filename.md)" for every NNN-*.md file in the same
 * directory. The parenthesised filename is the markdown link target, which is unique
 * and unambiguous regardless of what text appears elsewhere in the README.
 *
 * Each directory is checked independently and is optional — a repo with no docs/pdr/
 * is silently fine. This is what makes the lint safe to ship everywhere, and why a
 * repo that later adopts PDRs gets the gate with no wiring change.
 *
 * GATE: exits non-zero on any unregistered record.
 *
 * NOTE ON THE NAME: this file is still called check-adr-readme-sync.mjs and is still
 * wired as `lint:adr-readme-sync` even though it now covers PDRs too. Renaming it
 * would break the wiring in every repo that already runs it, for cosmetics. If you
 * are adopting this fresh and want a record-neutral name, rename both the file and
 * the npm script together.
 *
 * Wiring (ai-fleet pattern):
 *   package.json:  "lint:adr-readme-sync": "node scripts/check-adr-readme-sync.mjs"
 *   check script:  && npm run lint:adr-readme-sync --prefix $ROOT/host
 *   CI (run-tests.yml):
 *     - name: ADR README sync check
 *       run: node scripts/check-adr-readme-sync.mjs
 *       working-directory: host
 *
 * For repos without an npm check script (e.g. analytics-infrastructure):
 *   Name this file lint-adr-readme-sync.mjs and add a job to ci.yml.
 *   See analytics-infrastructure/scripts/lint-adr-readme-sync.mjs for the
 *   standalone variant.
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function repoRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { return process.cwd(); }
}

const ROOT = repoRoot();

// Each record type: where it lives, what to call it in output, and the row to suggest
// when one is missing. Add a directory here to bring a new record type under the gate.
const RECORD_DIRS = [
  { dir: 'docs/adr', label: 'ADR', lint: 'lint:adr-readme-sync' },
  { dir: 'docs/pdr', label: 'PDR', lint: 'lint:adr-readme-sync' },
];

let failed = false;
const summary = [];

for (const { dir, label, lint } of RECORD_DIRS) {
  const recordDir = join(ROOT, dir);
  const readme = join(recordDir, 'README.md');

  // A repo need not have every record type. Absent is fine; absent-but-populated is not.
  if (!existsSync(recordDir)) continue;

  if (!existsSync(readme)) {
    const orphans = readdirSync(recordDir).filter(f => /^\d{3}-.*\.md$/.test(f));
    if (orphans.length === 0) continue;   // empty dir, nothing to index yet
    console.error(`${label}-README-SYNC VIOLATION: ${dir}/ contains ${orphans.length} record(s) but has no README.md index`);
    console.error(`  Create ${dir}/README.md with a table registering each record.`);
    console.error(`  Ref: governance ${lint}`);
    failed = true;
    continue;
  }

  const readmeContent = readFileSync(readme, 'utf8');
  let count = 0;

  for (const file of readdirSync(recordDir).sort()) {
    if (!/^\d{3}-.*\.md$/.test(file)) continue;
    count++;

    if (!readmeContent.includes(`(${file})`)) {
      const prefix = file.match(/^(\d{3})/)[1];
      console.error(`${label}-README-SYNC VIOLATION: ${dir}/${file} is not registered in ${dir}/README.md`);
      console.error(`  The file exists but no markdown link "(${file})" was found in the README table.`);
      console.error(`  Add a row before merging:`);
      console.error(`    | [${prefix}](${file}) | <Title> | Proposed |`);
      console.error(`  Ref: governance ${lint}`);
      failed = true;
    }
  }

  summary.push(`${count} ${label} file(s) in ${dir}`);
}

if (failed) process.exit(1);

if (summary.length === 0) {
  console.log('OK — no record directories present; nothing to check.');
} else {
  console.log(`OK — all records registered in their README index (${summary.join(', ')}).`);
}
