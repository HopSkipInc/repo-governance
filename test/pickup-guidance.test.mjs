// Fixtures for the shared pickup resolver and the first-prompt hooks.
//
// The hook's contract is fail-open: on any error it must add nothing and the
// prompt must go through. These tests pin every listed failure — no gh auth,
// network failure, unknown issue, malformed labels, missing rule — plus the
// first-prompt-only rule, the opt-out, and the shared resolver's output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  formatGuidance,
  makeHookState,
  parseIssueRef,
  resolveForPrompt,
} from '../scripts/pickup-guidance.mjs';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const RECORDS = readFileSync(resolve(REPO, 'docs/agent-routing-records.md'), 'utf8');

const RULES_OK = RECORDS;
const RULES_MISSING = '# Records\n\n## 1. Model → class\n\n| Class | Models | As of |\n|---|---|---|\n| standard | Sonnet | 2026-01-01 |\n';

function fixture(records = RULES_OK) {
  const dir = mkdtempSync(join(tmpdir(), 'pickup-fixture-'));
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'agent-routing-records.md'), records);
  return dir;
}

/** A gh stub. `payload` is the issue JSON for `issue view`; `fail` simulates an auth/network error. */
function ghStub(dir, payload, { fail = false, message = 'gh: not logged in' } = {}) {
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const body = fail
    ? `printf '%s\\n' '${message.replace(/'/g, `'\\''`)}' >&2; exit 1`
    : `printf '%s' '${JSON.stringify(payload).replace(/'/g, `'\\''`)}'`;
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\ncase "$1" in\n  issue) ${body} ;;\n  *) ${body} ;;\nesac\n`);
  chmodSync(join(bin, 'gh'), 0o755);
  return `${bin}:${process.env.PATH}`;
}

const issue = (number, labels) => ({ number, title: `Issue ${number}`, labels: labels.map((name) => ({ name })) });

/** A fake exec for the direct resolver tests, so no PATH juggling is needed. */
const fakeExec = (json) => (cmd, args) => {
  if (args[0] === 'issue') return JSON.stringify(json);
  if (args[0] === 'repo') return 'fixture/repo';
  throw new Error('unexpected gh call');
};

function runHook(cwd, env, input) {
  return spawnSync('node', [resolve(REPO, 'templates/hooks/pickup-guidance.mjs')], {
    cwd,
    env: { ...process.env, ...env },
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 20000,
  });
}

const promptEvent = (session, prompt) => ({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt });

// ---------------------------------------------------------------- resolver

test('pickup: parseIssueRef accepts #N and this-repo URLs, rejects another repo', () => {
  assert.deepEqual(parseIssueRef('work on #145 please', 'HopSkipInc/repo-governance'), {
    number: '145',
    repo: 'hopskipinc/repo-governance',
  });
  assert.equal(
    parseIssueRef('https://github.com/HopSkipInc/repo-governance/issues/143', 'HopSkipInc/repo-governance').number,
    '143'
  );
  assert.equal(
    parseIssueRef('https://github.com/HopSkipInc/ai-fleet/issues/42', 'HopSkipInc/repo-governance'),
    null
  );
  assert.equal(parseIssueRef('no issue here', 'HopSkipInc/repo-governance'), null);
});

test('pickup: a frontier risk label derives frontier and the route', () => {
  const state = resolveForPrompt('#145', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'claude',
    exec: fakeExec(issue(145, ['risk:silent-failure'])),
  });
  assert.ok(state);
  assert.equal(state.requiredClass, 'frontier');
  assert.equal(state.route.slug, 'opus');
});

test('pickup: no risk labels derive standard', () => {
  const state = resolveForPrompt('#143', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'opencode',
    exec: fakeExec(issue(143, [])),
  });
  assert.ok(state);
  assert.equal(state.requiredClass, 'standard');
  assert.equal(state.route.slug, 'hopskip-gateway/claude-haiku-4-5-20251001');
});

test('pickup: gate labels are carried into the advisory', () => {
  const state = resolveForPrompt('#49', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'opencode',
    exec: fakeExec(issue(49, ['risk:boundary', 'gate:credentials'])),
  });
  const text = formatGuidance(state, null, { harness: 'opencode' });
  assert.match(text, /A human finishes this: gate:credentials/);
});

test('pickup: formatGuidance compares below, above, equal and unknown', () => {
  const opts = {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'claude',
    exec: fakeExec(issue(145, ['risk:silent-failure'])),
  };
  const frontier = resolveForPrompt('#145', opts);
  assert.match(formatGuidance(frontier, 'claude-haiku-4-5-20251001', { harness: 'claude' }), /below the required class/);
  assert.match(formatGuidance(frontier, 'opus', { harness: 'claude' }), /matches the required class/);

  const standard = resolveForPrompt('#143', { ...opts, exec: fakeExec(issue(143, [])) });
  assert.match(formatGuidance(standard, 'opus', { harness: 'claude' }), /above the required class/);
  assert.match(formatGuidance(standard, null, { harness: 'claude' }), /not readable in this harness/);
  assert.match(formatGuidance(standard, 'mystery-model', { harness: 'claude' }), /class not in the map/);
});

test('pickup: an unknown risk label is malformed and resolves to null', () => {
  const state = resolveForPrompt('#1', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'claude',
    exec: fakeExec(issue(1, ['risk:not-a-label'])),
  });
  assert.equal(state, null);
});

test('pickup: malformed labels (not an array) resolve to null', () => {
  const state = resolveForPrompt('#1', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'claude',
    exec: () => JSON.stringify({ number: 1, title: 'x', labels: 'nope' }),
  });
  assert.equal(state, null);
});

test('pickup: a missing rule resolves to null', () => {
  const state = resolveForPrompt('#145', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(RULES_MISSING), 'docs', 'agent-routing-records.md'),
    harness: 'claude',
    exec: fakeExec(issue(145, ['risk:silent-failure'])),
  });
  assert.equal(state, null);
});

test('pickup: gh failure resolves to null', () => {
  const state = resolveForPrompt('#145', {
    repo: 'fixture/repo',
    recordsPath: join(fixture(), 'docs', 'agent-routing-records.md'),
    harness: 'claude',
    exec: () => {
      throw new Error('network failure');
    },
  });
  assert.equal(state, null);
});

// ------------------------------------------------------- v2 hook state machine

test('pickup v2 hook: first prompt sets, first context consumes, later context is silent', () => {
  const dir = fixture();
  const state = makeHookState();
  const opts = {
    repo: 'fixture/repo',
    recordsPath: join(dir, 'docs', 'agent-routing-records.md'),
    harness: 'opencode',
    exec: fakeExec(issue(145, ['risk:silent-failure'])),
  };
  state.onPrompt('s1', '#145', opts);
  const text = state.onContext('s1', 'hopskip-gateway/claude-haiku-4-5-20251001');
  assert.match(text, /\[pickup\] Required class: frontier/);
  assert.match(text, /below the required class/);
  assert.equal(state.onContext('s1', 'hopskip-gateway/claude-haiku-4-5-20251001'), null);
});

test('pickup v2 hook: a later prompt is never inspected, and errors never throw', () => {
  const dir = fixture();
  const state = makeHookState();
  const opts = {
    repo: 'fixture/repo',
    recordsPath: join(dir, 'docs', 'agent-routing-records.md'),
    harness: 'opencode',
    exec: fakeExec(issue(145, ['risk:silent-failure'])),
  };
  state.onPrompt('s1', 'no issue reference', opts);
  state.onPrompt('s1', '#145', opts);
  assert.equal(state.onContext('s1', 'hopskip-gateway/claude-haiku-4-5-20251001'), null);

  assert.doesNotThrow(() => state.onPrompt('s2', '#145', { ...opts, exec: () => { throw new Error('no auth'); } }));
  assert.equal(state.onContext('s2', 'hopskip-gateway/claude-haiku-4-5-20251001'), null);
});

// ------------------------------------------------------------ Claude Code hook

test('claude hook: the first prompt adds guidance and the session proceeds (exit 0)', () => {
  const dir = fixture();
  const env = {
    PATH: ghStub(dir, issue(145, ['risk:silent-failure'])),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  };
  const { status, stdout } = runHook(dir, env, promptEvent('s1', 'work on #145'));
  assert.equal(status, 0);
  assert.match(stdout, /\[pickup\] Issue #145/);
  assert.match(stdout, /\[pickup\] Required class: frontier/);
  assert.match(stdout, /\[pickup\] Switch in this session: \/model opus/);
});

test('claude hook: a later prompt in the same session adds nothing', () => {
  const dir = fixture();
  const env = {
    PATH: ghStub(dir, issue(145, ['risk:silent-failure'])),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  };
  const first = runHook(dir, env, promptEvent('s1', '#145'));
  assert.match(first.stdout, /Required class: frontier/);
  const second = runHook(dir, env, promptEvent('s1', '#143'));
  assert.equal(second.status, 0);
  assert.equal(second.stdout.trim(), '');
});

test('claude hook: no gh auth fails open', () => {
  const dir = fixture();
  const { status, stdout } = runHook(dir, {
    PATH: ghStub(dir, null, { fail: true }),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  }, promptEvent('s1', '#145'));
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

test('claude hook: network failure fails open', () => {
  const dir = fixture();
  const { status, stdout } = runHook(dir, {
    PATH: ghStub(dir, null, { fail: true, message: 'dial tcp: i/o timeout' }),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  }, promptEvent('s1', '#145'));
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

test('claude hook: an unknown issue fails open', () => {
  const dir = fixture();
  const { status, stdout } = runHook(dir, {
    PATH: ghStub(dir, null, { fail: true, message: 'Could not resolve to an Issue with the number of 99999' }),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  }, promptEvent('s1', '#99999'));
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

test('claude hook: malformed labels fail open', () => {
  const dir = fixture();
  const { status, stdout } = runHook(dir, {
    PATH: ghStub(dir, { number: 145, title: 'x', labels: 'not-an-array' }),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  }, promptEvent('s1', '#145'));
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

test('claude hook: a missing rule fails open', () => {
  const dir = fixture(RULES_MISSING);
  const { status, stdout } = runHook(dir, {
    PATH: ghStub(dir, issue(145, ['risk:silent-failure'])),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: join(dir, 'home'),
  }, promptEvent('s1', '#145'));
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

test('claude hook: the user-level opt-out suppresses guidance', () => {
  const dir = fixture();
  const home = join(dir, 'home');
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'settings.json'), JSON.stringify({ pickupGuidance: false }));
  const { status, stdout } = runHook(dir, {
    PATH: ghStub(dir, issue(145, ['risk:silent-failure'])),
    ROUTING_REPO: 'fixture/repo',
    PICKUP_HOOK_STATE: join(dir, 'state'),
    HOME: home,
  }, promptEvent('s1', '#145'));
  assert.equal(status, 0);
  assert.equal(stdout.trim(), '');
});

test('pickup: the self-installed resolver and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/pickup-guidance.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/pickup-guidance.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});
