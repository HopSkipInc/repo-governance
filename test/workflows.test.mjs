/**
 * Workflow template structure tests.
 *
 * WHY THIS EXISTS. On 2026-09-16, `templates/workflows/scheduled-audit.yml` v1.1.0 was
 * found not to parse as YAML, and had not since it shipped. Two lines of a `gh pr create
 * --body "..."` string sat at column 0 inside a `run: |` block scalar. An under-indented
 * line silently TERMINATES a block scalar — the text after it is re-read as YAML, and in
 * this case parsed as a mapping key ("To remediate: check out this branch"), producing
 * "mapping values are not allowed here".
 *
 * The defect survived because nothing ever parsed the file. The repo has no YAML
 * dependency by design (docs/code-conventions.md §3 — no package.json), so this is a
 * structural check rather than a parse: in a GitHub workflow the set of legal top-level
 * keys is fixed and small, so any other content at column 0 is a block scalar that has
 * been broken open. That is the exact failure class above, and it is the one that is
 * invisible on inspection.
 *
 * Per docs/code-conventions.md §1 row 5, the check fires on a known-bad fixture and
 * clears on a known-good one before it is run against the real corpus.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

/** The complete set of top-level keys GitHub Actions accepts in a workflow file. */
const TOP_LEVEL_KEYS = new Set([
  'name', 'run-name', 'on', 'permissions', 'env', 'defaults', 'concurrency', 'jobs',
]);

/**
 * Returns every column-0 line that is not a legal top-level key, a comment, or a document
 * marker. In a workflow file each such line is content that has escaped its block scalar.
 */
function danglingLines(source) {
  const hits = [];
  source.split('\n').forEach((text, i) => {
    if (text.trim() === '') return;
    if (/^\s/.test(text)) return;              // indented — inside some structure
    if (text.startsWith('#')) return;          // comment
    if (text === '---' || text === '...') return;
    const key = text.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:/);
    if (key && TOP_LEVEL_KEYS.has(key[1])) return;
    hits.push({ line: i + 1, text });
  });
  return hits;
}

const GOOD_FIXTURE = `name: Example
on:
  workflow_dispatch:
jobs:
  go:
    runs-on: ubuntu-latest
    steps:
      - name: Post
        run: |
          gh pr create \\
            --body "First line.

          Second line, indented to the block so the scalar survives."
`;

const BAD_FIXTURE = `name: Example
on:
  workflow_dispatch:
jobs:
  go:
    runs-on: ubuntu-latest
    steps:
      - name: Post
        run: |
          gh pr create \\
            --body "First line.

Second line at column 0. To remediate: this ends the block scalar."
`;

test('known-bad: an under-indented line inside a block scalar is caught', () => {
  const hits = danglingLines(BAD_FIXTURE);
  assert.equal(hits.length, 1, 'expected exactly one dangling line');
  assert.match(hits[0].text, /^Second line at column 0/);
});

test('known-good: a correctly indented block scalar is clean', () => {
  assert.deepEqual(danglingLines(GOOD_FIXTURE), []);
});

test('known-good: top-level keys and comments are not flagged', () => {
  assert.deepEqual(danglingLines('# a comment\nname: X\non: push\njobs:\n  a:\n    b: c\n'), []);
});

test('every workflow in templates/ and .github/ keeps its block scalars closed', () => {
  const dirs = [join(ROOT, 'templates/workflows'), join(ROOT, '.github/workflows')];
  let checked = 0;

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
      const path = join(dir, file);
      const hits = danglingLines(readFileSync(path, 'utf8'));
      assert.deepEqual(
        hits,
        [],
        `${path}: ${hits.length} line(s) at column 0 that are not top-level keys — a block `
          + `scalar is broken open here:\n`
          + hits.map((h) => `  line ${h.line}: ${h.text.slice(0, 80)}`).join('\n'),
      );
      checked += 1;
    }
  }

  // Fails closed: an empty sweep is indistinguishable from a passing one.
  assert.ok(checked >= 6, `expected to check at least 6 workflows, checked ${checked}`);
});
