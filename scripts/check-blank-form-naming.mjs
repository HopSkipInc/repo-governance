#!/usr/bin/env node
/**
 * lint:blank-form-naming  [repo-governance's own lint — NOT a downstream template]
 *
 * A blank form living in a records directory gets treated as a record. It has
 * happened twice here, from the same root cause and with two different readers:
 *
 *   - `000-template.md` matched the ADR index lint's `NNN-*.md` pattern, so CI
 *     went red on day one for a repo that had followed GETTING_STARTED exactly.
 *   - The same form's placeholder falsifier ("Revisit by YYYY-MM-DD when
 *     <condition>") was swept by the audit and reported as a real Future item on
 *     every run — a finding against a document nobody wrote.
 *
 * The fix both times was the leading underscore, matching the `_client.md`
 * convention this repo already had. This lint is what makes the convention hold
 * without someone remembering the incident.
 *
 * RULES
 *   R1 corpus-purity   in a directory holding NNN-*.md records, every other .md
 *                      is README.md or starts with `_`
 *   R2 form-naming     any .md whose basename contains "template" starts with `_`
 *   R3 form-in-record  a numbered record whose body is placeholders is a form
 *                      wearing a record's number
 *
 * R2's exceptions are GitHub's magic filenames (`pull_request_template.md`,
 * `issue_template.md`) and anything under `.github/`, where the platform owns the
 * name and the convention does not get a vote.
 *
 * R3 exists because R1 cannot see the original bug. `000-template.md` matches the
 * record pattern, so R1 classifies it as a record and skips it — the form is
 * invisible to the rule written to catch it, and only R2's filename check saved
 * the case. Name a form `000-blank.md` and both rules miss it. R3 reads content
 * instead: a numbered file that is mostly placeholders is a form. It does not
 * apply under templates/, where every file is a form by definition.
 *
 * (R3 was found by writing the fixture test for R1, which is the entire argument
 * for the fixture tests.)
 *
 * Wiring:  node scripts/check-blank-form-naming.mjs
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative, basename, dirname } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/** Directories never walked. */
const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** R2 exceptions: the platform owns these names. */
const MAGIC_NAMES = new Set(['pull_request_template.md', 'issue_template.md']);

/**
 * A record: the numbered-file shape both the ADR lint and the audit sweep read.
 *
 * The lookahead excludes date-prefixed files. Without it `2026-07-07-thing.md`
 * reads as record number 2026, which makes every watch-item and downstream-prompt
 * directory look like a records corpus — found when R3 fired on a real watch item.
 */
const RECORD = /^\d{3,4}-(?!\d{2}-\d{2})[^/]+\.md$/;

/**
 * R3: unfilled placeholders. `[DATE]`, `[YYYY-MM-DD]`, `[repo]` — the shapes a
 * blank form leaves behind. Markdown links (`[text](url)`) are excluded by the
 * negative lookahead, or every record with a citation trips.
 *
 * Angle-bracket placeholders (`<path>`, `<client>`) are deliberately NOT matched.
 * They were, and they fired on a real watch-item record that documented a command
 * shape in prose — a record *about* templates is not a template.
 */
const PLACEHOLDER = /\[(?:[A-Z][A-Z0-9 ._-]{1,}|YYYY-MM-DD|N|X\.Y\.Z|repo|name|date|path|tier|kind|owner)\](?!\()/g;
const PLACEHOLDER_THRESHOLD = 3;

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP_DIRS.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const findings = [];

// R1: a directory with numbered records is a corpus. Anything else in it is an
// index or a form, and a form must be marked as one.
const byDir = new Map();
for (const f of files) {
  const d = dirname(f);
  if (!byDir.has(d)) byDir.set(d, []);
  byDir.get(d).push(basename(f));
}
for (const [dir, names] of byDir) {
  if (!names.some((n) => RECORD.test(n))) continue;
  for (const n of names) {
    if (RECORD.test(n) || n === 'README.md' || n.startsWith('_')) continue;
    findings.push({
      rule: 'R1',
      path: relative(ROOT, join(dir, n)),
      message: `sits in a records corpus (${relative(ROOT, dir)}/ holds NNN-*.md records) but is neither a record, the index, nor an underscore-prefixed form — every reader that globs this directory will treat it as a record`,
    });
  }
}

// R3: content, not filename. A numbered file that is mostly placeholders is a
// form, whatever it is called — the case R1 structurally cannot see.
for (const [dir, names] of byDir) {
  const rel = relative(ROOT, dir);
  // Under templates/ every file is a form; the whole directory is the blank set.
  if (rel === 'templates' || rel.startsWith('templates/')) continue;
  if (!names.some((n) => RECORD.test(n))) continue;
  for (const n of names) {
    if (!RECORD.test(n)) continue;
    const hits = (readFileSync(join(dir, n), 'utf8').match(PLACEHOLDER) ?? []).length;
    if (hits < PLACEHOLDER_THRESHOLD) continue;
    findings.push({
      rule: 'R3',
      path: relative(ROOT, join(dir, n)),
      message: `carries a record's number but ${hits} unfilled placeholders — it is a blank form, and every index lint and audit sweep in this practice will read it as a real record. Rename it \`_template.md\``,
    });
  }
}

// R2: name the form as a form wherever it lives.
for (const f of files) {
  const name = basename(f);
  const rel = relative(ROOT, f);
  if (!name.toLowerCase().includes('template')) continue;
  if (name.startsWith('_')) continue;
  if (MAGIC_NAMES.has(name.toLowerCase())) continue;
  if (rel.startsWith('.github/')) continue;
  findings.push({
    rule: 'R2',
    path: rel,
    message: 'is named as a template but does not start with `_` — the prefix is what keeps index lints and audit sweeps from reading a blank form as a record',
  });
}

console.log(`check-blank-form-naming: ${files.length} markdown files, ${byDir.size} directories scanned.`);

if (!findings.length) {
  console.log('OK: every blank form is underscore-prefixed and every records corpus holds only records, an index, and forms.');
  process.exit(0);
}

console.error(`\nFAILED: ${findings.length} finding(s):`);
for (const f of findings.sort((a, b) => a.path.localeCompare(b.path))) {
  console.error(`  ${f.path} [${f.rule}] ${f.message}`);
}
console.error('\nRename the file with a leading underscore (`_template.md`), matching the `_client.md` convention.');
process.exit(1);
