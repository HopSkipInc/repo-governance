#!/usr/bin/env node
// template: scripts/check-root-clutter.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:root-clutter  [governance template — copy to <project>/scripts/]
 *
 * The repo root is for project-defining files only. Working files — analysis
 * notes, throwaway scripts, generated output, one-off cleanup scripts — must
 * live under their proper directory. This lint fails when an entry appears in
 * the root that is not on the allowlist, so root clutter is caught in CI
 * instead of accreting until someone sweeps it by hand.
 *
 * Add a genuinely new top-level file/dir to ALLOWED below in the same PR that
 * introduces it — that edit is the reviewable record that it belongs in root.
 *
 * This lint independently converged in three unrelated HopSkip repos before
 * it was ever templated here (ai-fleet, analytics-infrastructure,
 * enrichment-pipeline all wrote their own copy) — a strong signal the pattern
 * is universal even though each repo's ALLOWED set differs. It is also
 * language-agnostic: this is a directory listing, not a source-code parser,
 * so it needs no per-language rewrite the way the TypeScript-source lints do.
 *
 * CONFIGURE BEFORE USE — replace ALLOWED with your repo's actual top-level
 * entries. The set below is a minimal starting point (VCS/tooling files
 * every repo has); everything project-specific (source directories, a
 * README, a Dockerfile) must be added by you.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:root-clutter": "node scripts/check-root-clutter.mjs"
 */

import { readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

function repoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    // scripts/ -> repo root; adjust the '..' count if this file lives deeper
    return join(process.cwd(), '..');
  }
}

const ROOT = repoRoot();

// ── CONFIGURE FOR YOUR REPO ──────────────────────────────────────────────────
// Project-defining root entries. Everything else belongs in a subdirectory.
const ALLOWED = new Set([
  // tooling / VCS / editor
  '.git', '.github', '.gitignore', '.dockerignore', '.claude', '.vscode', '.editorconfig',
  // top-level docs + build
  'README.md', 'LICENSE', 'CLAUDE.md', 'Dockerfile', 'docker-compose.yml',
  // add your repo's source directories, e.g.:
  // 'src', 'docs', 'scripts', 'tests',
]);
// ──────────────────────────────────────────────────────────────────────────

const entries = readdirSync(ROOT).filter((e) => e !== '.git');
const offenders = entries.filter((e) => !ALLOWED.has(e)).sort();

if (offenders.length === 0) {
  console.log(`OK: root is clean — ${entries.length} entries, all on the allowlist.`);
  process.exit(0);
}

console.error(`check-root-clutter FAILED: ${offenders.length} unexpected entry(ies) in the repo root:`);
for (const o of offenders) console.error(`  - ${o}`);
console.error('');
console.error('Move working files into a proper directory (docs/, tools/, tests/, …).');
console.error('If this entry genuinely belongs in root, add it to ALLOWED in scripts/check-root-clutter.mjs in this PR.');
process.exit(1);
