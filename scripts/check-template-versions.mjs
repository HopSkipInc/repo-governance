#!/usr/bin/env node
/**
 * lint:template-versions  [repo-governance's own lint — NOT a downstream template]
 *
 * Every template is a synced artifact. A downstream repo running some unknown
 * vintage, with neither side able to tell which, is the failure this prevents.
 *
 * It surfaced on 2026-07-24: agent-routing.md changed twice while two repos
 * were mid-adoption. The template read at the start of a run and the copy that
 * landed during it differed — the later one added a whole kind and an entire
 * escalation response — and the triager had no way to detect that from the
 * inside. The run was not internally consistent and nothing said so.
 *
 * Rules:
 *   1. Every template carries a version stamp.
 *   2. The stamp's path matches the template's actual path (catches copy-paste).
 *   3. A template modified more recently than its stamp says is stale-stamped —
 *      someone edited it and did not bump. This is the rule that actually bites.
 *
 * Stamp formats, by file type:
 *   .md          <!-- template: <relpath> v<semver> · updated <YYYY-MM-DD> -->
 *   SKILL.md     frontmatter `version:` + `updated:`
 *   .mjs         // template: <relpath> v<semver> · updated <YYYY-MM-DD>
 *   .yml         # template: <relpath> v<semver> · updated <YYYY-MM-DD>
 *
 * Wiring:  node scripts/check-template-versions.mjs
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const TEMPLATES = join(ROOT, 'templates');
const EXTS = ['.md', '.mjs', '.yml'];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (EXTS.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

function lastCommitDate(file) {
  const out = execFileSync('git', ['log', '-1', '--format=%ad', '--date=short', '--', file], {
    encoding: 'utf8',
    cwd: ROOT,
  }).trim();
  return out || null;
}

const problems = [];
const files = walk(TEMPLATES).sort();

for (const file of files) {
  const rel = relative(TEMPLATES, file);
  const src = readFileSync(file, 'utf8');
  const head = src.slice(0, 1200);
  let version = null;
  let updated = null;
  let claimedPath = null;

  if (file.endsWith('SKILL.md')) {
    version = head.match(/^version:\s*(\S+)/m)?.[1] ?? null;
    updated = head.match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null;
    claimedPath = rel; // skills are identified by their directory, not a path stamp
  } else {
    const m = head.match(/template:\s*(\S+)\s+v(\d+\.\d+\.\d+)\s+·\s+updated\s+(\d{4}-\d{2}-\d{2})/);
    if (m) [, claimedPath, version, updated] = m;
  }

  if (!version || !updated) {
    problems.push(`${rel}: missing or malformed version stamp`);
    continue;
  }
  if (claimedPath !== rel) {
    problems.push(`${rel}: stamp claims path "${claimedPath}" — copied from another template without updating the stamp`);
  }

  const committed = lastCommitDate(file);
  if (committed && committed > updated) {
    problems.push(`${rel}: last committed ${committed} but stamped ${updated} — edited without bumping. Downstream copies cannot detect the drift.`);
  }
}

console.log(`check-template-versions: ${files.length} templates scanned.`);

if (!problems.length) {
  console.log('OK: every template carries a stamp that matches its path and its history.');
  process.exit(0);
}

console.error(`\nFAILED: ${problems.length} problem(s):`);
for (const p of problems) console.error(`  - ${p}`);
console.error('\nBump the stamp in the same commit that changes the template.');
console.error('A template that changes without a version bump is a template that changes silently under everyone running it.');
process.exit(1);
