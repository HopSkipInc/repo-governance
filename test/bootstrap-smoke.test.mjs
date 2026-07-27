// Bootstrap smoke test — applies the templates to a throwaway repo and asserts
// the result is coherent.
//
// Every template bug this practice has hit came through the same hole: nothing
// verified that a template *works* when applied, only that it exists and is
// listed. `check-analyze-repo-coverage` proves a template is offered;
// `check-template-versions` proves it is stamped. Neither reads it.
//
// The three known incidents, all of which this file is shaped to catch:
//
//   - Following GETTING_STARTED literally turned CI red on day one: the ADR
//     index lint registers every `NNN-*.md` and the blank form was named
//     `000-template.md`.
//   - A rename shipped in the skills but not the audit sweep, so the sweep
//     globbed a directory that no longer existed and reported nothing — which is
//     indistinguishable from "all items on hold".
//   - A template went a full session unlisted in the applicability matrix; a
//     bootstrap omitting it looked exactly like one that succeeded.
//
// Run:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const GETTING_STARTED = readFileSync(join(REPO, 'GETTING_STARTED.md'), 'utf8');

/** Every `cp [-r] path/to/repo-governance/<src> <dest>` line in the guide. */
function copyInstructions() {
  const out = [];
  for (const m of GETTING_STARTED.matchAll(
    /^cp\s+(?:-r\s+)?path\/to\/repo-governance\/(\S+)\s+(\S+)/gm
  )) {
    out.push({ src: m[1], dest: m[2] });
  }
  return out;
}

test('every cp source in GETTING_STARTED exists', () => {
  const instructions = copyInstructions();
  assert.ok(instructions.length > 10, `expected the guide to copy many files, found ${instructions.length}`);
  const missing = instructions.filter((i) => !existsSync(join(REPO, i.src)));
  assert.deepEqual(
    missing.map((i) => i.src),
    [],
    'GETTING_STARTED tells the reader to copy files that do not exist — a rename that missed the guide'
  );
});

test('every cp destination lands where the templates expect to find it', () => {
  // A template copied to the wrong path is worse than one not copied: the lints
  // that read it report nothing, which reads as a pass.
  const wrong = copyInstructions().filter(({ src, dest }) => {
    const srcBase = src.replace(/\/$/, '').split('/').pop();
    const destBase = dest.replace(/\/$/, '').split('/').pop();
    // A directory copy (`skills/x` → `.claude/skills/`) keeps its own name.
    if (dest.endsWith('/')) return false;
    // Blank forms and records keep their filename; policy files may be renamed
    // only if the guide says so explicitly, which none currently do.
    return srcBase !== destBase;
  });
  assert.deepEqual(wrong, [], 'a cp renames a template on the way in — every lint that reads it by name will miss it');
});

/**
 * Bootstrap a throwaway repo by executing the guide's own `mkdir`/`cp` lines.
 *
 * Deriving the bootstrap from GETTING_STARTED rather than from a hand-kept list
 * here is the whole design. A hand-kept list tests the list. This tests the
 * instructions a client actually follows, so a template added to the guide is
 * exercised automatically and one omitted from it fails an assertion — which is
 * exactly how the missing `docs/adr/README.md` went unnoticed from session 13
 * until 2026-07-27, turning CI red on day one for anyone who followed the ADR
 * block literally.
 */
function bootstrap() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-bootstrap-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });

  const step1 = GETTING_STARTED.slice(
    GETTING_STARTED.indexOf('## Step 1'),
    GETTING_STARTED.indexOf('## Step 2')
  );

  for (const line of step1.split('\n').map((l) => l.trim())) {
    const md = line.match(/^mkdir\s+-p\s+(.+)$/);
    if (md) {
      for (const d of md[1].split(/\s+/)) mkdirSync(join(dir, d), { recursive: true });
      continue;
    }
    const cp = line.match(/^cp\s+(?:-r\s+)?path\/to\/repo-governance\/(\S+)\s+(\S+)/);
    if (!cp) continue;
    const [, src, dest] = cp;
    const to = join(dir, dest.endsWith('/') ? join(dest, src.replace(/\/$/, '').split('/').pop()) : dest);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(join(REPO, src), to, { recursive: true });
  }
  return dir;
}

function runIn(dir, scriptRel) {
  try {
    return { code: 0, out: execFileSync('node', [scriptRel], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

test('a freshly bootstrapped repo passes the ADR index lint', () => {
  // The day-one-red case. The lint registers every `NNN-*.md`; the blank form
  // must not look like one, and every real record must be in the index.
  const dir = bootstrap();
  const { code, out } = runIn(dir, 'scripts/check-adr-readme-sync.mjs');
  assert.equal(code, 0, `a repo that followed GETTING_STARTED exactly has red CI:\n${out}`);
});

test('the audit sweep globs directories the bootstrap actually creates', () => {
  // The renamed-directory case: a sweep pointed at a directory nobody creates
  // matches nothing and reports nothing, which reads exactly like a clean run.
  const dir = bootstrap();
  const workflow = readFileSync(join(dir, '.github/workflows/scheduled-audit.yml'), 'utf8');
  const globbed = new Set(
    [...workflow.matchAll(/\bdocs\/([a-z-]+)\/\*/g)].map((m) => `docs/${m[1]}`)
  );
  assert.ok(globbed.size > 0, 'expected the audit prompt to sweep at least one docs/ directory');
  for (const d of globbed) {
    assert.ok(
      existsSync(join(dir, d)) || existsSync(join(dir, `${d}.md`)),
      `the audit sweeps ${d}/ but nothing in the bootstrap creates it — the sweep will match nothing and report nothing, which is indistinguishable from a clean result`
    );
  }
});

test('the bootstrapped repo has no unfilled blank form wearing a record number', () => {
  const dir = bootstrap();
  const { code, out } = runIn(dir, resolve(REPO, 'scripts/check-blank-form-naming.mjs'));
  assert.equal(code, 0, out);
});

test('every records directory the bootstrap creates has both an index and a form', () => {
  // A corpus with records and no index drifts on the first addition; a corpus
  // with no blank form gets its next record written from memory.
  const dir = bootstrap();
  for (const corpus of ['docs/adr', 'docs/pdr']) {
    const names = readdirSync(join(dir, corpus));
    assert.ok(names.includes('README.md'), `${corpus}/ has no index`);
    assert.ok(names.includes('_template.md'), `${corpus}/ has no blank form`);
  }
});
