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
 *   3. A template whose content changed in this diff must have changed its
 *      version in the same diff. Runs only in diff mode (--base <ref>).
 *
 * Rule 3 was first written as a date comparison — "committed more recently than
 * the stamp claims" — and was blind in exactly the case that matters. Dates here
 * are day-granular, so a template edited the same day it was last stamped
 * compares equal and an unbumped content change passed clean; template edits
 * mostly happen on the day the template was last touched. It also compared only
 * the date and never the version, so bumping `updated` while leaving `v1.0.0`
 * alone satisfied it while every downstream copy keyed on version saw nothing.
 * Comparing the actual version string across the actual diff closes both holes.
 *
 * Stamp formats, by file type:
 *   .md          <!-- template: <relpath> v<semver> · updated <YYYY-MM-DD> -->
 *   SKILL.md     frontmatter `version:` + `updated:`
 *   .mjs         // template: <relpath> v<semver> · updated <YYYY-MM-DD>
 *   .yml         # template: <relpath> v<semver> · updated <YYYY-MM-DD>
 *
 * Wiring:
 *   node scripts/check-template-versions.mjs                # rules 1-2, whole repo
 *   node scripts/check-template-versions.mjs --base <ref>   # + rule 3 across the diff
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const TEMPLATES = join(ROOT, 'templates');
const EXTS = ['.md', '.mjs', '.yml'];

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx !== -1 ? process.argv[baseIdx + 1] : null;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (EXTS.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

/** Extract {version, updated, claimedPath} from a file's stamp. */
function stampOf(src, isSkill, relForSkill = null) {
  const head = src.slice(0, 1200);
  if (isSkill) {
    return {
      version: head.match(/^version:\s*(\S+)/m)?.[1] ?? null,
      updated: head.match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? null,
      claimedPath: relForSkill, // skills are identified by directory, not a path stamp
    };
  }
  const m = head.match(/template:\s*(\S+)\s+v(\d+\.\d+\.\d+)\s+·\s+updated\s+(\d{4}-\d{2}-\d{2})/);
  return m
    ? { claimedPath: m[1], version: m[2], updated: m[3] }
    : { version: null, updated: null, claimedPath: null };
}

const problems = [];
const files = walk(TEMPLATES).sort();

// ------------------------------------------------ rules 1-2: every template, always

for (const file of files) {
  const rel = relative(TEMPLATES, file);
  const src = readFileSync(file, 'utf8');
  const { version, updated, claimedPath } = stampOf(src, file.endsWith('SKILL.md'), rel);

  if (!version || !updated) {
    problems.push(`${rel}: missing or malformed version stamp`);
    continue;
  }
  if (claimedPath !== rel) {
    problems.push(`${rel}: stamp claims path "${claimedPath}" — copied from another template without updating the stamp`);
  }
}

// ------------------------------------------- rule 3: version bumped across the diff

if (BASE) {
  let changed = [];
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${BASE}...HEAD`, '--', 'templates/'], {
      encoding: 'utf8',
      cwd: ROOT,
    })
      .split('\n')
      .filter(Boolean)
      .filter((f) => EXTS.some((x) => f.endsWith(x)));
  } catch (err) {
    problems.push(`could not diff against base "${BASE}" (${err.message.split('\n')[0]}) — rule 3 did not run`);
  }

  for (const pathFromRoot of changed) {
    let before;
    try {
      before = execFileSync('git', ['show', `${BASE}:${pathFromRoot}`], { encoding: 'utf8', cwd: ROOT });
    } catch {
      continue; // new file at this ref — rules 1-2 cover it
    }
    const after = readFileSync(join(ROOT, pathFromRoot), 'utf8');
    const rel = relative('templates', pathFromRoot);
    const isSkill = pathFromRoot.endsWith('SKILL.md');
    const vBefore = stampOf(before, isSkill).version;
    const vAfter = stampOf(after, isSkill).version;
    if (!vBefore || !vAfter) continue; // rule 1 territory
    if (vBefore === vAfter) {
      problems.push(`${rel}: content changed but version stayed at v${vAfter} — bump it in the same commit, or downstream copies cannot tell they are behind`);
    }
  }
}

// -------------------------------------------------------------------------- output

console.log(`check-template-versions: ${files.length} templates scanned.`);

if (!problems.length) {
  console.log(
    BASE
      ? 'OK: every template is stamped, paths match, and everything changed in this diff was bumped.'
      : 'OK: every template is stamped and paths match. (Rule 3 needs --base <ref>.)'
  );
  process.exit(0);
}

console.error(`\nFAILED: ${problems.length} problem(s):`);
for (const p of problems) console.error(`  - ${p}`);
console.error('\nBump the version in the same commit that changes the template.');
console.error('A template that changes without a version bump is a template that changes silently under everyone running it.');
process.exit(1);
