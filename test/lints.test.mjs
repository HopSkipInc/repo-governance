// Fixture tests for repo-governance's own lints.
//
// The coverage floor for this repo is not a percentage — it is a rule: every
// script in scripts/ fires on a known-bad input and clears on a known-good one.
// That rule exists because two lint bugs have already shipped here, and both
// were of the only kind that matters in a lint: a check that quietly stops
// checking. `check-template-versions` rule 3 compared dates instead of versions,
// so a same-day edit compared equal and the rule "was blind to the case it
// existed for". `check-issue-routing` used a `\Z` anchor, which JavaScript does
// not have, and reported every correctly-formatted issue as malformed.
//
// A passing lint and a broken lint produce identical CI output. These tests are
// the only thing that tells them apart.
//
// Run:  node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const script = (name) => resolve(REPO, 'scripts', name);

/** A throwaway git repo containing exactly the files a case needs. */
function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-fixture-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

/** Run a lint inside a fixture. Returns { code, out } — never throws on failure. */
function run(name, cwd, { env = {}, args = [] } = {}) {
  try {
    const out = execFileSync('node', [script(name), ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// --------------------------------------------------------- blank-form-naming

const STAMP = '<!-- template: x.md v1.0.0 · updated 2026-07-27 -->\n';

test('blank-form-naming: clean corpus passes', () => {
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n',
    'docs/adr/README.md': '# Index\n',
    'docs/adr/_template.md': '# Form\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('blank-form-naming: R1 fires on an unprefixed non-record file in a corpus', () => {
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n',
    'docs/adr/notes.md': '# Loose notes\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
  assert.match(out, /notes\.md/);
});

test('blank-form-naming: R1 structurally cannot see a form numbered like a record', () => {
  // The original incident. `000-template.md` matches the record pattern, so R1
  // classifies it as a record and skips it. R2 catches this one by name, and R3
  // catches the case where the name gives nothing away.
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n',
    'docs/adr/000-template.md': '# Form\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
  assert.doesNotMatch(out, /R1/);
});

test('blank-form-naming: R3 catches a form whose name gives nothing away', () => {
  const dir = fixture({
    'docs/adr/001-real-record.md': '# A record\n\nA real decision with no placeholders.\n',
    'docs/adr/000-blank.md': '# [TITLE]\n\n**Status:** [STATUS]\n**Date:** [YYYY-MM-DD]\n**Confirmed by:** [NAME]\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
  assert.match(out, /000-blank\.md/);
});

test('blank-form-naming: a date-prefixed directory is not a records corpus', () => {
  // `2026-07-07-thing.md` once read as record number 2026, which made every
  // watch-item and downstream-prompt directory look like a corpus. R3 then fired
  // on a real watch item that documented `<path>` placeholders in prose.
  const dir = fixture({
    'docs/watch-items/2026-07-07-thing.md': 'Run `cp <path> <dest>` for each <client> and <repo>.\n',
    'docs/watch-items/notes.md': '# Loose notes\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
});

test('blank-form-naming: R3 does not apply under templates/, where everything is a form', () => {
  const dir = fixture({
    'templates/adr/022-real-record.md': '# [TITLE]\n**Status:** [STATUS]\n**Date:** [YYYY-MM-DD]\n**By:** [NAME]\n',
    'templates/adr/_template.md': '# [TITLE]\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
});

test('blank-form-naming: R2 fires on a template-named file outside any corpus', () => {
  const dir = fixture({ 'docs/audit-template.md': '# Form\n' });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
});

test("blank-form-naming: GitHub's magic filenames are exempt", () => {
  const dir = fixture({
    '.github/pull_request_template.md': '# PR\n',
    'templates/pull_request_template.md': '# PR\n',
  });
  const { code, out } = run('check-blank-form-naming.mjs', dir);
  assert.equal(code, 0, out);
});

// ------------------------------------------------------------ template-versions

test('template-versions: a stamped template with a matching path passes', () => {
  const dir = fixture({
    'templates/thing.md': '<!-- template: thing.md v1.0.0 · updated 2026-07-27 -->\n# Thing\n',
  });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 0, out);
});

test('template-versions: an unstamped template fails', () => {
  const dir = fixture({ 'templates/thing.md': '# Thing, no stamp\n' });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 1, out);
});

test("template-versions: a stamp naming another template's path fails", () => {
  const dir = fixture({
    'templates/copied.md': '<!-- template: original.md v1.0.0 · updated 2026-07-27 -->\n',
  });
  const { code, out } = run('check-template-versions.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /copied\.md|original\.md/);
});

// ------------------------------------------------------- analyze-repo-coverage

/**
 * The lint's EXCLUSIONS list names three real templates by path, so a fixture
 * must contain them or they read as stale exclusions. That coupling is
 * deliberate — it is repo-governance's own lint, not a portable template — but
 * it has to be reproduced here or every case fails for the wrong reason.
 */
const EXCLUDED_TEMPLATES = {
  'templates/adr/022-definition-of-done.md': STAMP,
  'templates/routing-calibration-protocol.md': STAMP,
  'templates/agents/routing-classifier.md': STAMP,
};

test('analyze-repo-coverage: a template named in the matrix passes', () => {
  const dir = fixture({
    ...EXCLUDED_TEMPLATES,
    'templates/thing.md': STAMP,
    '.claude/commands/analyze-repo.md': '| `thing.md` | Always | P1 | because |\n',
  });
  const { code, out } = run('check-analyze-repo-coverage.mjs', dir);
  assert.equal(code, 0, out);
});

test('analyze-repo-coverage: a template missing from the matrix fails', () => {
  const dir = fixture({
    ...EXCLUDED_TEMPLATES,
    'templates/thing.md': STAMP,
    'templates/forgotten.md': STAMP,
    '.claude/commands/analyze-repo.md': '| `thing.md` | Always | P1 | because |\n',
  });
  const { code, out } = run('check-analyze-repo-coverage.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /forgotten\.md/);
});

// ------------------------------------------------------------- issue-routing

/**
 * `gh` is stubbed on PATH. It answers `issue list` with the case's issues and
 * every `api` call with `[]`, which short-circuits R6 without needing GraphQL.
 */
function ghStub(dir, issues) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const payload = JSON.stringify(issues).replace(/'/g, `'\\''`);
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh\ncase "$1" in\n  issue) printf '%s' '${payload}' ;;\n  *) printf '[]' ;;\nesac\n`
  );
  chmodSync(join(bin, 'gh'), 0o755);
  return { PATH: `${bin}:${process.env.PATH}`, ROUTING_REPO: 'fixture/repo' };
}

const tierBody = (line) => `Some description.\n\n## Impl tier\n${line}\n`;

test('issue-routing: a well-formed escalation passes', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 1,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — composes the entitlement predicate; a union where an intersection was required silently grants paid features.\nNot splittable: one function, every branch reads it.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('issue-routing: R8 fires when a tier line blames coverage with no record', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 7,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — a wrong scope leaks cross-workspace data silently, and no test covers cross-tenant reads.\nNot splittable: one predicate function.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#7/);
});

test('issue-routing: R8 clears on a linked coverage gap', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 7,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — no test covers cross-tenant reads.\nNot splittable: one predicate function.\nCoverage gap: #99 — cross-tenant read scoping is unverified at any level.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.doesNotMatch(out, /R8/, out);
});

test('issue-routing: "Coverage: not testable" with no mechanism does not clear R8', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 7,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — the surface is untested.\nNot splittable: one predicate function.\nCoverage: not testable'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
});

test('issue-routing: the tier block ends at the next heading, not at a literal Z', () => {
  // Regression for the `\Z` anchor bug: a body whose tier block is followed by
  // another section must still parse, and the kind must be found inside the
  // block rather than anywhere in the body.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 3,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: `## Impl tier\nfrontier (inherent) — silent failure on the tenancy boundary.\nNot splittable: single transaction.\n\n## Verifiable outcomes\n- [ ] something\n`,
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R3/);
});

test('issue-routing: R3 fires on an escalation with no kind', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 4,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — it is complicated.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
});
