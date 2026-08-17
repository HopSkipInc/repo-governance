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

test('template-versions: rule 3 survives a template deleted across the diff', () => {
  // 2026-08-09: the estate's first-ever template deletion crashed the lint with
  // ENOENT — `git show BASE:path` succeeds (the file existed at base) while the
  // working-tree read has nothing to read. A deletion needs no version bump;
  // rule 3 skips it and the /analyze-repo matrix accounts for the removal.
  const dir = fixture({
    'templates/keep.md': '<!-- template: keep.md v1.0.0 · updated 2026-08-07 -->\n# Keep\n',
    'templates/gone.md': '<!-- template: gone.md v1.0.0 · updated 2026-08-07 -->\n# Gone\n',
  });
  const git = (args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  git(['rm', '-q', 'templates/gone.md']);
  git(['commit', '-q', '-m', 'delete gone.md']);
  const { code, out } = run('check-template-versions.mjs', dir, { args: ['--base', base] });
  assert.equal(code, 0, out);
  // Prove rule 3 actually engaged — a pass in no-base mode would be a false green.
  assert.match(out, /changed in this diff was bumped/);
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

// --------------------------- 2026-08-17: ai-fleet upstream-feedback fixes (v1.3.0)

test('issue-routing: R8 fires on "has no test file" (U1 — used 3x in one ai-fleet run, matched nothing)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 11,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — the scoping module has no test file; a wrong scope leaks silently.\nNot splittable: one predicate function.'
      ),
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#11/);
});

test('issue-routing: R8 fires on the file-named form "no get.test.ts" (U1)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — the tenant scoping path has no get.test.ts at all.\nNot splittable: one predicate function.'
      ),
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#12/);
});

test('issue-routing: R8 fires on "asserts nothing about" (U1 — the #762 phrasing)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 13,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        "frontier (inherent) — the tenancy filter's suite asserts nothing about tenant scoping.\nNot splittable: one predicate function."
      ),
    },
  ]);
  const { out } = run('check-issue-routing.mjs', dir, { env });
  assert.match(out, /R8/, out);
  assert.match(out, /#13/);
});

test('issue-routing: R1 stands down on an epic carrying the child tier table (U2)', () => {
  // Policy §Mechanism 3 prescribes exactly this shape: no impl: label, the
  // "## Impl tier" block holds the per-child table. R1 demanded a label on it.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 20,
      title: 'Epic: tenancy hardening',
      labels: [],
      body: 'Body of work.\n\n## Impl tier\n\n| Child | Tier | Kind | Why |\n|---|---|---|---|\n| #21 | standard | — | loud failure, covered by config tests |\n| #22 | frontier | inherent | silent failure on the scope boundary |\n',
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R1/);
});

test('issue-routing: R1 stands down on the `epic` label even without the table (U2)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 23,
      title: 'Epic: quota work',
      labels: [{ name: 'epic' }],
      body: 'Body of work.\n\n## Impl tier\n\nTiered by child; see the linked issues.\n',
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R1/);
});

test('issue-routing: R1 still fires on a bare tier block that is not an epic (guarding the U2 guard)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 24,
      title: 'x',
      labels: [],
      body: tierBody('frontier (inherent) — silent failure on the scope path.\nNot splittable: one function.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
  assert.match(out, /child tier table/);
});

test('issue-routing: kind is not read from prose — "both decision points" declares nothing (U3)', () => {
  // Pre-1.3.0 the whole-block `\b(spec|inherent|both)\b` read "both" here and
  // reported kind=both, silencing R3 on an escalation that declared no kind.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 30,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — the change fails closed at both decision points.\nNot splittable: one transaction.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 1, out);
  assert.match(out, /R3/);
});

test('issue-routing: a real declaration still parses when prose says "both" later (U3)', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 31,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody(
        'frontier (inherent) — fails closed at **both** decision points; a wrong scope leaks silently.\nNot splittable: one transaction.'
      ),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R3/);
});

test('issue-routing: the ai-fleet declaration dialects parse (U3 — live-corpus shapes)', () => {
  // All six R3s a strict `^tier (kind)` parse produced on ai-fleet's real
  // backlog were declared kinds in emphatic dress. These are those shapes.
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 32,
      title: 'backtick-paren form',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('`frontier` (`inherent`) — the spec is complete; no rewrite drops the tier.\nNot splittable: one transaction.'),
    },
    {
      number: 33,
      title: 'slash form',
      labels: [{ name: 'impl:human' }],
      body: tierBody('`human` / `inherent` — commercial judgement; the ordering failure is silent.\nNot splittable: milestone ordering is one decision.'),
    },
    {
      number: 34,
      title: 'comma-kind form',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('**`impl: frontier`, kind `both`.**\n`inherent`: silent and financial failure modes.\nNot splittable: one surface.'),
    },
    {
      number: 35,
      title: 'standalone kind form',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('**Kind: `inherent`.** Two load-bearing boundaries.\nNot splittable: one dispatch path.'),
    },
    {
      number: 36,
      title: 'em-dash kind form (ai-fleet #1485)',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('`frontier` — kind `both`. **Under-specified:** the answers are the deliverable.\nNot splittable: the judgment is the work.'),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /R3/);
});

// --------------------------- 2026-08-17: closed pass (v1.4.0) ----------------
// The closed pass answers "is this repo's history estimable?" — R1–R3 only over
// recently closed issues, probe posture by default, kind-coverage census. The gh
// stub answers the single fetch with the case's issues; closed fixtures carry
// closedAt, and the window filters client-side off it.

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

test('issue-routing closed pass: a kind-less closed escalation is flagged R3, probe exits 0', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — the entitlement predicate is one union; every branch reads it.'),
      closedAt: daysAgo(2),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed'] });
  assert.equal(code, 0, out);
  assert.match(out, /closed pass, R1–R3, last 30d/);
  assert.match(out, /CLOSED PASS \(1, probe/);
  assert.match(out, /#12 \[R3\]/);
  assert.match(out, /Kind coverage: 1 closed escalation\(s\) in window — 0 spec, 0 inherent, 0 both, 1 undeclared \(0% declared\)/);
});

test('issue-routing closed pass: a fully declared closed escalation is clean and counts its kind', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 13,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier (inherent) — a wrong scope leaks cross-workspace data silently.\nNot splittable: one predicate.'),
      closedAt: daysAgo(1),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed'] });
  assert.equal(code, 0, out);
  assert.match(out, /OK: every closed escalation in the window/);
  assert.match(out, /0 spec, 1 inherent, 0 both, 0 undeclared \(100% declared\)/);
});

test('issue-routing closed pass: R4–R8 cannot fire on finished work', () => {
  // The fixture is a walking contradiction — status:ready + spec kind (R4), a
  // hedge with no decomposition record (R7), a coverage signal with no record
  // (R8). The open pass flags all three; the closed pass must stay silent on
  // all of them and check declarations only.
  const issue = {
    number: 21,
    title: 'x',
    labels: [{ name: 'impl:frontier' }, { name: 'status:ready' }],
    body: tierBody('frontier (both) — mostly mechanical, and no test coverage of the retry path.'),
    closedAt: daysAgo(3),
  };
  const openRun = run('check-issue-routing.mjs', fixture({}), { env: ghStub(fixture({}), [issue]) });
  assert.match(openRun.out, /\[R4\]/);
  assert.match(openRun.out, /\[R7\]/);
  assert.match(openRun.out, /\[R8\]/);

  const dir = fixture({});
  const { code, out } = run('check-issue-routing.mjs', dir, { env: ghStub(dir, [issue]), args: ['--closed'] });
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /\[R[4-8]\]/);
  assert.match(out, /OK: every closed escalation/);
});

test('issue-routing closed pass: --closed-gate promotes findings to blocking', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — one predicate; every branch reads it.'),
      closedAt: daysAgo(2),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed', '--closed-gate'] });
  assert.equal(code, 1, out);
  assert.match(out, /CLOSED PASS \(1, gate\)/);
});

test('issue-routing closed pass: the window excludes issues closed before it', () => {
  const dir = fixture({});
  const env = ghStub(dir, [
    {
      number: 12,
      title: 'x',
      labels: [{ name: 'impl:frontier' }],
      body: tierBody('frontier — one predicate; every branch reads it.'),
      closedAt: daysAgo(60),
    },
  ]);
  const { code, out } = run('check-issue-routing.mjs', dir, { env, args: ['--closed', '--days', '30'] });
  assert.equal(code, 0, out);
  assert.match(out, /swept 0 closed issues/);
  assert.doesNotMatch(out, /#12/);
});

test('issue-routing closed pass: --days rejects a non-integer loudly', () => {
  const dir = fixture({});
  const { code, out } = run('check-issue-routing.mjs', dir, { env: ghStub(dir, []), args: ['--closed', '--days', 'soon'] });
  assert.equal(code, 2, out);
  assert.match(out, /--days needs a positive integer/);
});

const ACCEPTED = (falsifier) =>
  `# PDR-001: A bet\n\n**Status:** Accepted\n**Confirmed by:** Someone\n\n## Falsifier\n\n${falsifier}\n`;

// ------------------------------------------------------------- pdr-falsifiers

test('pdr-falsifiers: a corpus with observable falsifiers passes', () => {
  const dir = fixture({
    'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit by 2099-01-01 when the pilot cohort renews or churns'),
    'docs/pdr/002-b.md': ACCEPTED('- [ ] Revisit when three or more inbound conversations open with a compliance driver'),
  });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('pdr-falsifiers: R1 fires on an Accepted record with no falsifier', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': '**Status:** Accepted\n\n## Falsifier\n\nNothing here.\n' });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
});

test('pdr-falsifiers: a Proposed record without a falsifier is fine', () => {
  // Proposed is exactly the status for "no falsifier yet" — gating it would make
  // the status meaningless and push people to skip straight to Accepted.
  const dir = fixture({ 'docs/pdr/001-a.md': '**Status:** Proposed\n\n## Falsifier\n\nTBD.\n' });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
});

test('pdr-falsifiers: R2 gates on a phrasing the form rules out', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit later when we have time') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
});

test('pdr-falsifiers: R3 warns and does not gate', () => {
  // The heuristic half. It failed 5 of this repo's 7 real falsifiers as a gate,
  // which is why it reports instead — proving observability is a judgment call.
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit when the thing settles down') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /WARN/);
  assert.match(out, /R3/);
});

test('pdr-falsifiers: R4 reports a revisit date that has passed', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit by 2020-01-01 when the pilot renews') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /DUE/);
  assert.match(out, /2020-01-01/);
});

test('pdr-falsifiers: a checked-off falsifier is resolved, not due', () => {
  const dir = fixture({ 'docs/pdr/001-a.md': ACCEPTED('- [x] Revisit by 2020-01-01 when the pilot renews') });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /DUE/);
});

test('pdr-falsifiers: the blank form is not a record', () => {
  const dir = fixture({
    'docs/pdr/_template.md': '**Status:** Proposed | Accepted | Superseded\n\n- [ ] Revisit by YYYY-MM-DD when <condition>\n',
    'docs/pdr/001-a.md': ACCEPTED('- [ ] Revisit by 2099-01-01 when the pilot renews'),
  });
  const { code, out } = run('check-pdr-falsifiers.mjs', dir);
  assert.equal(code, 0, out);
  assert.match(out, /1 record/);
});

test('pdr-falsifiers: a repo with no docs/pdr/ passes silently', () => {
  const { code, out } = run('check-pdr-falsifiers.mjs', fixture({ 'README.md': '# x\n' }));
  assert.equal(code, 0, out);
});

// ---------------------------------------------------------- adr-readme-sync

test('adr-readme-sync: an unregistered PDR fails', () => {
  const dir = fixture({
    'docs/pdr/001-a.md': '# A\n',
    'docs/pdr/README.md': '# Index\n\nNo rows.\n',
  });
  const { code, out } = run('check-adr-readme-sync.mjs', dir);
  assert.equal(code, 1, out);
});

test('adr-readme-sync: a registered PDR passes', () => {
  const dir = fixture({
    'docs/pdr/001-a.md': '# A\n',
    'docs/pdr/README.md': '# Index\n\n| [001](001-a.md) | A | Accepted |\n',
  });
  const { code, out } = run('check-adr-readme-sync.mjs', dir);
  assert.equal(code, 0, out);
});
