// Fixture tests for templates/scripts/check-system-map-lane.mjs.
//
// Same rule as lints.test.mjs: fire on a known-bad input, clear on a known-good
// one. The fail-closed cases matter as much as the rule cases — this gate's
// whole input is a git diff, so "base ref did not resolve" must read as
// SKIPPED + failure, never as pass.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LINT = resolve(REPO, 'templates', 'scripts', 'check-system-map-lane.mjs');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'fixture',
  GIT_AUTHOR_EMAIL: 'fixture@test',
  GIT_COMMITTER_NAME: 'fixture',
  GIT_COMMITTER_EMAIL: 'fixture@test',
  // Neutralize the caller's CI env so precedence tests start clean.
  GITHUB_HEAD_REF: '',
  GITHUB_BASE_REF: '',
  SYSTEM_MAP_LANE_BRANCH: '',
};

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: GIT_ENV }).trim();
}

function put(dir, rel, content) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

/**
 * A throwaway repo: master carries `base` files; then `branch` is created
 * (or HEAD detached when branch is null) carrying `change` files on top.
 */
function scenario({ base = { 'src/app.ts': 'export {}\n' }, branch, change = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-lane-'));
  git(dir, 'init', '-q', '-b', 'master');
  for (const [rel, content] of Object.entries(base)) put(dir, rel, content);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  if (branch) git(dir, 'checkout', '-q', '-b', branch);
  else git(dir, 'checkout', '-q', '--detach');
  for (const [rel, content] of Object.entries(change)) put(dir, rel, content);
  if (Object.keys(change).length) {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'change');
  }
  return dir;
}

/** Run the lint. Returns { code, out } — never throws on failure. */
function run(dir, { args = [], env = {} } = {}) {
  try {
    const out = execFileSync('node', [LINT, ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...GIT_ENV, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const BASE = ['--base', 'master'];

test('lane: ordinary code change on a working branch passes', () => {
  const dir = scenario({ branch: 'feat/thing', change: { 'src/more.ts': 'export {}\n' } });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 0, out);
  assert.match(out, /OK: system-map lane intact/);
});

test('lane: R1 fires when a working branch touches graphify-out/', () => {
  const dir = scenario({
    branch: 'feat/thing',
    change: { 'graphify-out/graph.json': '{}\n', 'src/more.ts': 'export {}\n' },
  });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
  assert.match(out, /graphify-out\/graph\.json/);
});

test('lane: refresh branch carrying only graphify-out passes (R2 clear)', () => {
  const dir = scenario({
    branch: 'chore/graphify-refresh',
    change: { 'graphify-out/graph.json': '{}\n', 'graphify-out/GRAPH_REPORT.md': '# report\n' },
  });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 0, out);
  assert.match(out, /OK: system-map lane intact/);
});

test('lane: R2 fires when the refresh lane carries code', () => {
  const dir = scenario({
    branch: 'chore/graphify-refresh',
    change: { 'graphify-out/graph.json': '{}\n', 'src/sneaky.ts': 'export {}\n' },
  });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 1, out);
  assert.match(out, /R2/);
  assert.match(out, /src\/sneaky\.ts/);
});

test('lane: install bootstrap branch may carry the first map plus install edits', () => {
  const dir = scenario({
    branch: 'chore/graphify-install',
    change: { 'graphify-out/graph.json': '{}\n', 'README.md': '# readme\n', '.gitignore': 'x\n' },
  });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 0, out);
  assert.match(out, /bootstrap lane/);
});

test('lane: .graphifyignore is not graphify-out/ — a working branch may edit it', () => {
  const dir = scenario({ branch: 'feat/thing', change: { '.graphifyignore': '*.pem\n' } });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 0, out);
});

test('lane: docs/system-map.md is prose, not the artifact — a working branch may edit it', () => {
  const dir = scenario({ branch: 'feat/thing', change: { 'docs/system-map.md': 'edit\n' } });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 0, out);
});

test('lane: branch name resolves from the checked-out HEAD when no flag is given', () => {
  const dir = scenario({
    branch: 'feat/thing',
    change: { 'graphify-out/graph.json': '{}\n' },
  });
  const { code, out } = run(dir, { args: BASE }); // no --branch
  assert.equal(code, 1, out);
  assert.match(out, /R1/);
});

test('lane: SYSTEM_MAP_LANE_BRANCH supplies the branch name', () => {
  const dir = scenario({
    branch: 'some-random-branch',
    change: { 'graphify-out/graph.json': '{}\n' },
  });
  const { code, out } = run(dir, {
    args: BASE,
    env: { SYSTEM_MAP_LANE_BRANCH: 'chore/graphify-refresh' },
  });
  assert.equal(code, 0, out);
});

test('lane: fails closed (SKIPPED) when no base ref can be resolved', () => {
  const dir = scenario({ branch: 'feat/thing', change: { 'src/more.ts': 'export {}\n' } });
  const { code, out } = run(dir); // no --base, no origin/*
  assert.equal(code, 1, out);
  assert.match(out, /SKIPPED/);
  assert.match(out, /failing closed/);
});

test('lane: fails closed (SKIPPED) when graphify-out is touched but the branch is unknown', () => {
  const dir = scenario({
    branch: null, // detached HEAD
    change: { 'graphify-out/graph.json': '{}\n' },
  });
  const { code, out } = run(dir, { args: BASE });
  assert.equal(code, 1, out);
  assert.match(out, /SKIPPED/);
});
