// Fixture tests for templates/scripts/check-weakened-verification.mjs
// (ships to governed repos; this repo does not yet wire it into its own CI).
//
// Same rule as lints.test.mjs: fire on a known-bad input, clear on a known-good
// one. Two extra obligations specific to this lint:
//
//   * It is a delta lint, so every case needs two commits. A single-snapshot
//     fixture would pass against a lint that had stopped reading the base
//     revision at all — the exact class of bug (`check-template-versions` rule
//     3 comparing dates instead of versions) these tests exist to catch.
//   * Its largest false-positive class is a test file that moved rather than
//     weakened. The rename and split cases below are load-bearing: a lint that
//     fires on those is dead inside a week, and dead-by-alarm-fatigue is
//     indistinguishable in CI from working.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LINT = resolve(REPO, 'templates/scripts/check-weakened-verification.mjs');

const git = (dir, args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function write(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    if (content === null) {
      rmSync(p, { force: true });
      continue;
    }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
}

/** Base revision committed; returns { dir, base }. */
function fixture(baseFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-verif-'));
  git(dir, ['init', '-q']);
  write(dir, baseFiles);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']).trim();
  return { dir, base };
}

/** Apply changes as a second commit. `null` content deletes. */
function head(dir, changes, message = 'head') {
  write(dir, changes);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function run(dir, args = []) {
  try {
    const out = execFileSync('node', [LINT, ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GOVERNANCE_BASE_REF: '' },
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const THREE_ASSERTIONS = `
import { test } from 'node:test';
test('a', () => {
  expect(one()).toBe(1);
  expect(two()).toBe(2);
  expect(three()).toBe(3);
});
`;

const ONE_ASSERTION = `
import { test } from 'node:test';
test('a', () => {
  expect(one()).toBe(1);
});
`;

// ------------------------------------------------------------------ fail-closed

test('weakened-verification: no --base reports SKIPPED and never OK', () => {
  const { dir } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /^OK:/m, 'a check that cannot run must not read as a pass');
});

test('weakened-verification: --gate with no --base exits 1 — an unrunnable gate is loud', () => {
  const { dir } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  const { code, out } = run(dir, ['--gate']);
  assert.equal(code, 1, out);
  assert.match(out, /SKIPPED/);
});

test('weakened-verification: an unresolvable base ref is SKIPPED, not a pass', () => {
  const { dir } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  const { code, out } = run(dir, ['--base', 'refs/heads/does-not-exist']);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /^OK:/m);
});

// --------------------------------------------------------------- known-good

test('weakened-verification: added assertions pass', () => {
  const { dir, base } = fixture({ 'src/a.test.js': ONE_ASSERTION });
  head(dir, { 'src/a.test.js': THREE_ASSERTIONS });
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out);
  assert.match(out, /OK: no net loss/);
});

test('weakened-verification: a rename with unchanged content is net zero', () => {
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  git(dir, ['mv', 'src/a.test.js', 'src/renamed.test.js']);
  git(dir, ['commit', '-q', '-m', 'rename']);
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out);
  assert.match(out, /OK: no net loss/);
});

test('weakened-verification: splitting one test file into two is net zero', () => {
  // The reason the lint nets across the diff instead of reading per-file. A
  // per-file rule fires here, and firing here is how the lint gets ignored.
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  head(dir, {
    'src/a.test.js': ONE_ASSERTION,
    'src/b.test.js': `test('b', () => {\n  expect(two()).toBe(2);\n  expect(three()).toBe(3);\n});\n`,
  });
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out);
  assert.match(out, /OK: no net loss/);
});

test('weakened-verification: changes outside test files are ignored', () => {
  const { dir, base } = fixture({
    'src/a.test.js': THREE_ASSERTIONS,
    'src/app.js': 'export const f = () => expect;\n',
  });
  head(dir, { 'src/app.js': 'export const f = () => 1;\n' });
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out);
  assert.match(out, /OK: no net loss/);
});

// ---------------------------------------------------------------- known-bad

test('weakened-verification: a removed assertion with no record is a finding', () => {
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  head(dir, { 'src/a.test.js': ONE_ASSERTION });
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out); // report mode
  assert.match(out, /\[FINDING\]/);
  assert.match(out, /assertions -2/);
});

test('weakened-verification: --gate turns the same finding into exit 1', () => {
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  head(dir, { 'src/a.test.js': ONE_ASSERTION });
  const { code, out } = run(dir, ['--base', base, '--gate']);
  assert.equal(code, 1, out);
  assert.match(out, /\[FINDING\]/);
});

test('weakened-verification: deleting a test file is a finding', () => {
  const { dir, base } = fixture({
    'src/a.test.js': THREE_ASSERTIONS,
    'src/b.test.js': ONE_ASSERTION,
  });
  head(dir, { 'src/a.test.js': null });
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out);
  assert.match(out, /\[FINDING\]/);
  assert.match(out, /assertions -3/);
});

test('weakened-verification: an added skip is a finding even when assertions hold', () => {
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  head(dir, { 'src/a.test.js': THREE_ASSERTIONS.replace("test('a'", "test.skip('a'") });
  const { code, out } = run(dir, ['--base', base]);
  assert.equal(code, 0, out);
  assert.match(out, /\[FINDING\]/);
  assert.match(out, /skips \+1/);
});

test('weakened-verification: .only counts as a skip — it disables every other test', () => {
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  head(dir, { 'src/a.test.js': THREE_ASSERTIONS.replace("test('a'", "test.only('a'") });
  const { code, out } = run(dir, ['--base', base]);
  assert.match(out, /\[FINDING\]/, out);
  assert.match(out, /skips \+1/);
});

test('weakened-verification: python and C# skip markers are seen too', () => {
  const { dir, base } = fixture({
    'tests/test_thing.py': 'def test_a():\n    assert one() == 1\n',
    'src/ThingTests.cs': 'public class ThingTests {\n  [Fact]\n  public void A() { Assert.Equal(1, One()); }\n}\n',
  });
  head(dir, {
    'tests/test_thing.py': '@pytest.mark.skip(reason="flaky")\ndef test_a():\n    assert one() == 1\n',
    'src/ThingTests.cs':
      'public class ThingTests {\n  [Fact(Skip = "flaky")]\n  public void A() { Assert.Equal(1, One()); }\n}\n',
  });
  const { code, out } = run(dir, ['--base', base]);
  assert.match(out, /\[FINDING\]/, out);
  assert.match(out, /skips \+2/);
});

// ----------------------------------------------------- the records that clear

const STRATEGY = (rows) => `# Testing Strategy

## 1. Floor

Words.

## 6. What tests do not verify at all

| Property not verified | Surface | What a silent failure looks like | Tracking |
|---|---|---|---|
${rows.map((r) => `| ${r} | src/a.js | wrong result looks correct | #1 |`).join('\n')}

## Review log

| Date | Trigger | What changed |
|---|---|---|
`;

test('weakened-verification: a new §6 row in the register clears the finding', () => {
  const { dir, base } = fixture({
    'src/a.test.js': THREE_ASSERTIONS,
    'docs/testing-strategy.md': STRATEGY(['cross-tenant read scoping']),
  });
  head(dir, {
    'src/a.test.js': ONE_ASSERTION,
    'docs/testing-strategy.md': STRATEGY(['cross-tenant read scoping', 'ordering under concurrency']),
  });
  const { code, out } = run(dir, ['--base', base, '--gate']);
  assert.equal(code, 0, out);
  assert.match(out, /gained a row/);
});

test('weakened-verification: touching the register without adding a row does not clear it', () => {
  // The cheapest dishonesty available: edit the records file, add nothing. The
  // lint reads the row count, not the fact that the file appears in the diff.
  const { dir, base } = fixture({
    'src/a.test.js': THREE_ASSERTIONS,
    'docs/testing-strategy.md': STRATEGY(['cross-tenant read scoping']),
  });
  head(dir, {
    'src/a.test.js': ONE_ASSERTION,
    'docs/testing-strategy.md': STRATEGY(['cross-tenant read scoping']).replace('Words.', 'More words.'),
  });
  const { code, out } = run(dir, ['--base', base, '--gate']);
  assert.equal(code, 1, out);
  assert.match(out, /\[FINDING\]/);
});

test('weakened-verification: a §6 row that already existed at base does not clear it', () => {
  const { dir, base } = fixture({
    'src/a.test.js': THREE_ASSERTIONS,
    'docs/testing-strategy.md': STRATEGY(['cross-tenant read scoping', 'ordering under concurrency']),
  });
  head(dir, { 'src/a.test.js': ONE_ASSERTION });
  const { code, out } = run(dir, ['--base', base, '--gate']);
  assert.equal(code, 1, out);
});

test('weakened-verification: a VERIFICATION-DELTA line in the diff clears the finding', () => {
  const { dir, base } = fixture({ 'src/a.test.js': THREE_ASSERTIONS });
  head(dir, {
    'src/a.test.js':
      `// VERIFICATION-DELTA: three shallow toBe checks replaced by one deep-equal on the whole shape\n` +
      ONE_ASSERTION.replace('expect(one()).toBe(1);', 'expect(all()).toEqual(SHAPE);'),
  });
  const { code, out } = run(dir, ['--base', base, '--gate']);
  assert.equal(code, 0, out);
  assert.match(out, /VERIFICATION-DELTA/);
});

test('weakened-verification: a VERIFICATION-DELTA present at base does not clear a new loss', () => {
  // Only added lines count. A marker left in the tree by an earlier PR must not
  // license every later weakening in the same file.
  const marker = '// VERIFICATION-DELTA: earlier, unrelated justification\n';
  const { dir, base } = fixture({ 'src/a.test.js': marker + THREE_ASSERTIONS });
  head(dir, { 'src/a.test.js': marker + ONE_ASSERTION });
  const { code, out } = run(dir, ['--base', base, '--gate']);
  assert.equal(code, 1, out);
  assert.match(out, /\[FINDING\]/);
});

test('weakened-verification: VERIFICATION_REGISTER points the check at a repo-specific path', () => {
  const { dir, base } = fixture({
    'src/a.test.js': THREE_ASSERTIONS,
    'QA/coverage-records.md': STRATEGY(['cross-tenant read scoping']),
  });
  head(dir, {
    'src/a.test.js': ONE_ASSERTION,
    'QA/coverage-records.md': STRATEGY(['cross-tenant read scoping', 'ordering under concurrency']),
  });
  const out = (() => {
    try {
      return {
        code: 0,
        out: execFileSync('node', [LINT, '--base', base, '--gate'], {
          cwd: dir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, VERIFICATION_REGISTER: 'QA/coverage-records.md' },
        }),
      };
    } catch (err) {
      return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  })();
  assert.equal(out.code, 0, out.out);
  assert.match(out.out, /QA\/coverage-records\.md gained a row/);
});
