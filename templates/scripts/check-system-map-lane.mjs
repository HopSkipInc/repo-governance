#!/usr/bin/env node
// template: scripts/check-system-map-lane.mjs v1.0.0 · updated 2026-08-12
/**
 * lint:system-map-lane  [governance template — copy to <project>/scripts/, run on every PR]
 *
 * graphify-out/ is a whole-tree derived artifact: graph.json, manifest.json, and
 * GRAPH_REPORT.md are each a function of the entire repo state. Under system-map policy
 * v2 ("regenerate and commit with every code change"), any two code-touching PRs
 * regenerated different bytes into the same files, so every pair of concurrent PRs
 * conflicted in graphify-out/** — and with fleet workers plus interactive sessions,
 * every merge window serialized into rebase → regen → push → CI-rerun cycles.
 *
 * Policy v3 gives the committed map a single writer: PRs from chore/graphify-refresh*
 * branches (one-time bootstrap: chore/graphify-install). Everywhere else the artifact
 * is read-only — working sessions regenerate locally for the delta read and restore
 * before committing. This lint is what makes that a gate instead of a convention:
 * CLAUDE.md does not bind humans pushing from web UIs or interactive sessions, and a
 * committed map edited outside the lane is exactly the conflict source v3 removes.
 *
 * Rules:
 *   R1  off-lane write   diff touches graphify-out/** on any branch that is not
 *                        chore/graphify-refresh* or chore/graphify-install   → FAIL
 *   R2  lane purity      a chore/graphify-refresh* branch touches anything
 *                        outside graphify-out/**                              → FAIL
 *
 * Fails closed: if the branch name or the change set cannot be determined, the check
 * reports SKIPPED and exits non-zero. A gate that cannot see its input must not report
 * pass — a passing lint and a broken lint produce identical CI output otherwise.
 *
 * Inputs (in precedence order):
 *   branch:  --branch <name> · SYSTEM_MAP_LANE_BRANCH · GITHUB_HEAD_REF · current branch
 *   base:    --base <ref>    · GITHUB_BASE_REF (resolved as origin/<ref>) ·
 *            origin/master or origin/main if present
 * The change set is `git diff --name-only <base>...HEAD` — committed changes only.
 * Uncommitted graphify-out/ edits in a working tree are the normal in-session state
 * (regenerate, read the delta, restore) and are deliberately not inspected.
 *
 * Wiring (GitHub Actions, pull_request; checkout with fetch-depth: 0):
 *   - name: System map lane
 *     run: node scripts/check-system-map-lane.mjs --base "${{ github.event.pull_request.base.sha }}"
 *   (GITHUB_HEAD_REF supplies the branch automatically; no env wiring needed.)
 *
 * Local use: node scripts/check-system-map-lane.mjs --base origin/master
 */

import { execFileSync } from 'child_process';

const GRAPH_DIR = 'graphify-out/';
const REFRESH_PREFIX = 'chore/graphify-refresh';
const INSTALL_PREFIX = 'chore/graphify-install';

// ── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitOk(...gitArgs) {
  try {
    git(...gitArgs);
    return true;
  } catch {
    return false;
  }
}

let skipped = [];
let failures = [];

// ── branch ──────────────────────────────────────────────────────────────────
let branch = argValue('--branch') || process.env.SYSTEM_MAP_LANE_BRANCH || process.env.GITHUB_HEAD_REF || '';
if (!branch) {
  const current = gitOk('rev-parse', '--abbrev-ref', 'HEAD') ? git('rev-parse', '--abbrev-ref', 'HEAD') : '';
  branch = current && current !== 'HEAD' ? current : '';
}

// ── base ────────────────────────────────────────────────────────────────────
let base = argValue('--base') || '';
if (!base && process.env.GITHUB_BASE_REF) {
  const candidate = `origin/${process.env.GITHUB_BASE_REF}`;
  if (gitOk('rev-parse', '--verify', '--quiet', `${candidate}^{commit}`)) base = candidate;
}
if (!base) {
  for (const candidate of ['origin/master', 'origin/main']) {
    if (gitOk('rev-parse', '--verify', '--quiet', `${candidate}^{commit}`)) {
      base = candidate;
      break;
    }
  }
}

// ── change set ──────────────────────────────────────────────────────────────
let changed = null;
if (base) {
  try {
    const out = git('diff', '--name-only', `${base}...HEAD`);
    changed = out ? out.split('\n').filter(Boolean) : [];
  } catch {
    changed = null;
  }
}

console.log(`check-system-map-lane: branch=${branch || '(unknown)'} base=${base || '(none)'}`);

if (changed === null) {
  skipped.push(
    `could not determine the change set (no usable base ref — pass --base, or fetch the PR base with fetch-depth: 0)`
  );
} else if (changed.length === 0) {
  console.log('OK: no committed changes against the base — nothing to check.');
  process.exit(0);
}

const inGraph = (p) => p === 'graphify-out' || p.startsWith(GRAPH_DIR);

if (changed !== null) {
  if (!branch) {
    skipped.push(
      'could not determine the branch name (pass --branch, or set SYSTEM_MAP_LANE_BRANCH / GITHUB_HEAD_REF)'
    );
  } else {
    const isRefresh = branch.startsWith(REFRESH_PREFIX);
    const isInstall = branch.startsWith(INSTALL_PREFIX);
    const graphTouched = changed.filter(inGraph);
    const outside = changed.filter((p) => !inGraph(p));

    if (isInstall) {
      console.log(
        `OK: ${branch} is the bootstrap lane — first committed map rides with the install.`
      );
    } else if (isRefresh) {
      // R2: lane purity
      if (outside.length) {
        failures.push(
          `R2: ${branch} is the system-map refresh lane and may touch only graphify-out/**, ` +
            `but this diff also touches:\n  - ${outside.join('\n  - ')}\n` +
            `Move those changes to their own PR — the lane never becomes a way to carry code past review.`
        );
      }
    } else {
      // R1: off-lane write
      if (graphTouched.length) {
        failures.push(
          `R1: this PR touches graphify-out/** on branch ${branch}:\n  - ${graphTouched.join('\n  - ')}\n` +
            `The committed system map has a single writer: chore/graphify-refresh PRs (policy: docs/system-map.md).\n` +
            `Unstage the generated files and commit only your change:\n` +
            `  git restore --staged --worktree graphify-out/\n` +
            `To refresh the map on purpose, do it from a chore/graphify-refresh branch.`
        );
      }
    }
  }
}

// ── verdict ─────────────────────────────────────────────────────────────────
for (const f of failures) console.error(`FAILED: ${f}`);
for (const s of skipped) console.error(`SKIPPED: ${s}`);

if (failures.length || skipped.length) {
  if (skipped.length) {
    console.error(
      'A gate that cannot see its input reports SKIPPED, never pass — failing closed.'
    );
  }
  process.exit(1);
}
console.log(`OK: system-map lane intact (${changed.length} file(s) checked against ${base}).`);
