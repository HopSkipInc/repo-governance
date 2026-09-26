// Fixture tests for templates/scripts/check-epic-handoff.mjs.
//
// Same rule as every script here (docs/testing-strategy.md §1): each class fires on a
// known-bad fixture and clears on a known-good one, and the paired case proves the
// detector branch is load-bearing. The report-only classes (missing, future) get the
// directional test too: they must fire AND must not gate. The gh-unavailable contract
// must print SKIPPED, never read as clean, and make a gated run exit 2 rather than 0.
//
// `gh` is stubbed on PATH by a data-driven node stub: GH_STUB (path to a JSON spec)
// holds the open-issue list, or `{"fail": true}` to simulate gh absent/unauthenticated.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO, 'templates', 'scripts', 'check-epic-handoff.mjs');

const STUB_SOURCE = `#!/usr/bin/env node
// Data-driven gh stub. Spec (JSON at $GH_STUB):
//   { "issues": [ ...open issues... ] }  |  { "fail": true } (gh unavailable)
const spec = JSON.parse(require('fs').readFileSync(process.env.GH_STUB, 'utf8'));
const args = process.argv.slice(2);
if (spec.fail) {
  process.stderr.write('gh: not authenticated. Run gh auth login.\\n');
  process.exit(1);
}
if (args[0] === 'issue' && args[1] === 'list') {
  process.stdout.write(JSON.stringify(spec.issues ?? []));
} else {
  process.stderr.write('gh stub: unhandled ' + args.join(' ') + '\\n');
  process.exit(1);
}
`;

/** A fixture dir carrying the gh stub + spec. Returns env for run(). */
function ghStub(spec) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-handoff-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'gh'), STUB_SOURCE);
  chmodSync(join(bin, 'gh'), 0o755);
  const specPath = join(dir, 'spec.json');
  writeFileSync(specPath, JSON.stringify(spec));
  return {
    PATH: `${bin}:${process.env.PATH}`,
    GH_STUB: specPath,
    EPIC_HANDOFF_REPO: 'fixture/repo',
  };
}

function run(env, args = []) {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
const date = (daysAgo) => iso(daysAgo).slice(0, 10);

/** An issue. labels is a list of names; updatedAt defaults to now. */
const issue = (number, body, labels = [], updatedDaysAgo = 0) => ({
  number,
  title: 'x',
  body,
  labels: labels.map((name) => ({ name })),
  updatedAt: iso(updatedDaysAgo),
});

const epic = (number, body, updatedDaysAgo = 0, labels = ['epic']) =>
  issue(number, body, labels, updatedDaysAgo);

const handoff = (dateLine, extra = '') =>
  `## ▶ Pick up here — rolling handoff\n\n${dateLine}\n**Do next:** #1\n${extra}`;

// --------------------------------------------------------------------- undated

test('epic-handoff: undated fires on a section with no date (probe exits 0)', () => {
  const env = ghStub({ issues: [epic(12, handoff('No date here.'))] });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /#12 \[undated\]/);
  assert.match(out, /census: fresh 0 · stale 0 · undated 1/);
});

test('epic-handoff: --gate promotes undated to exit 1', () => {
  const env = ghStub({ issues: [epic(12, handoff('No date here.'))] });
  const { code, out } = run(env, ['--gate']);
  assert.equal(code, 1, out);
});

// ----------------------------------------------------------------------- stale

test('epic-handoff: stale fires on a dated handoff older than max-age', () => {
  const env = ghStub({ issues: [epic(12, handoff(`**Handoff updated:** ${date(45)}`))] });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /#12 \[stale\].*45d old/);
  assert.match(out, /census: fresh 0 · stale 1/);
});

test('epic-handoff: --gate promotes stale to exit 1', () => {
  const env = ghStub({ issues: [epic(12, handoff(`**Handoff updated:** ${date(45)}`))] });
  const { code, out } = run(env, ['--gate']);
  assert.equal(code, 1, out);
});

test('epic-handoff: --max-age moves the line and rejects a non-integer loudly', () => {
  const env = ghStub({ issues: [epic(12, handoff(`**Handoff updated:** ${date(15)}`))] });
  assert.match(run(env, ['--max-age', '10']).out, /#12 \[stale\]/);
  assert.doesNotMatch(run(env, ['--max-age', '20']).out, /\[stale\]/);
  const bad = run(env, ['--max-age', 'soon']);
  assert.equal(bad.code, 2, bad.out);
  assert.match(bad.out, /--max-age needs a positive integer/);
});

// ----------------------------------------------------------------------- fresh

test('epic-handoff: a fresh dated handoff is clean', () => {
  const env = ghStub({ issues: [epic(12, handoff(`**Handoff updated:** ${date(3)}`))] });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /census: fresh 1 · stale 0/);
  assert.match(out, /OK:/);
  assert.equal(code, run(env, ['--gate']).code, out); // gate stays green
});

// ---------------------------------------------------------------------- future

test('epic-handoff: future is report-only — it fires but never gates', () => {
  const env = ghStub({ issues: [epic(12, handoff(`**Handoff updated:** ${date(-3)}`))] });
  const { out } = run(env);
  assert.match(out, /#12 \[future\]/);
  assert.equal(run(env, ['--gate']).code, 0, out); // future is not gate-eligible
});

// --------------------------------------------------------------------- missing

test('epic-handoff: missing fires on an active epic with no handoff, but never gates', () => {
  const env = ghStub({ issues: [epic(12, 'A big epic body with no handoff section.', 2)] });
  const out = run(env).out;
  assert.match(out, /#12 \[missing\]/);
  assert.match(out, /census: .*missing 1/);
  assert.equal(run(env, ['--gate']).code, 0, out); // report-only on first adoption
});

test('epic-handoff: a dormant epic with no handoff is counted, not reported', () => {
  const env = ghStub({ issues: [epic(12, 'A sleeping epic body.', 120)] });
  const out = run(env).out;
  assert.doesNotMatch(out, /#12 \[/);
  assert.match(out, /dormant 1/);
  assert.match(out, /missing 0/);
});

test('epic-handoff: a non-epic issue with no handoff is not our surface', () => {
  const env = ghStub({ issues: [issue(12, 'A plain bug with no handoff.', ['bug'], 1)] });
  const out = run(env).out;
  assert.match(out, /0 open epic\(s\)/);
  assert.doesNotMatch(out, /\[missing\]/);
});

test('epic-handoff: an epic declared by a Work-type line (no label) is swept', () => {
  const env = ghStub({
    issues: [issue(12, `## Work type\nepic\n\nno handoff yet`, ['P1'], 1)],
  });
  const out = run(env).out;
  assert.match(out, /#12 \[missing\]/, out);
});

// ------------------------------------------------------------------- dialects

test('epic-handoff: the legacy heading date form is accepted', () => {
  // analytics-infrastructure epic #229 shipped this shape on 2026-09-25.
  const body = `## ▶ Pick up here — rolling handoff (updated ${date(2)})\n\n**Do next:** #1\n`;
  const { out } = run(envFor(body));
  assert.match(out, /census: fresh 1/);
  assert.doesNotMatch(out, /\[undated\]/);
});

function envFor(body) {
  return ghStub({ issues: [epic(12, body)] });
}

test('epic-handoff: an "updated" date in a LATER section is not read (line scan, no \\Z)', () => {
  // Regression guard for the bug class in the header: a correct scan ends the
  // handoff block at the next `## ` heading. This body has no date in the handoff
  // and a date under Phase history — the handoff must read as undated.
  const body = `## ▶ Pick up here — rolling handoff\n\n**Do next:** #1\n\n` +
    `## Phase history\n\nLast reviewed: updated 2026-01-01.\n`;
  const { out } = run(envFor(body));
  assert.match(out, /#12 \[undated\]/, out);
});

test('epic-handoff: a date glued to annotation prose is not taken as the marker', () => {
  // `Handoff updated` must begin the line; prose naming it elsewhere is ignored.
  const body = `## ▶ Pick up here — rolling handoff\n\n` +
    `The previous session noted the handoff updated: ${date(90)} but never fixed it.\n`;
  const { out } = run(envFor(body));
  assert.match(out, /#12 \[undated\]/, out); // no line-leading marker -> undated
});

// -------------------------------------------------------------------- skipped

test('epic-handoff: gh unavailable prints SKIPPED and never reads as clean', () => {
  const env = ghStub({ fail: true });
  const { code, out } = run(env);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /OK:/);
});

test('epic-handoff: --gate with gh unavailable exits 2, not 0 and not 1', () => {
  const env = ghStub({ fail: true });
  const { code, out } = run(env, ['--gate']);
  assert.equal(code, 2, out);
});

// ------------------------------------------------------------------ census all

test('epic-handoff: a mixed backlog lands each epic in exactly one class', () => {
  const env = ghStub({
    issues: [
      epic(1, handoff(`**Handoff updated:** ${date(2)}`)), // fresh
      epic(2, handoff(`**Handoff updated:** ${date(45)}`)), // stale
      epic(3, handoff('no date')), // undated
      epic(4, handoff(`**Handoff updated:** ${date(-5)}`)), // future
      epic(5, 'active, no handoff', 3), // missing
      epic(6, 'dormant, no handoff', 200), // dormant
      issue(7, 'plain bug', ['bug']), // ignored
    ],
  });
  const { out } = run(env);
  assert.match(out, /6 open epic\(s\) of 7 open issues/, out);
  assert.match(out, /fresh 1 · stale 1 · undated 1 · future 1 · missing 1 · dormant 1/);
  // #7 is a bug, not an epic — one finding per real epic, none for the bug.
  for (const n of [2, 3, 4, 5]) assert.match(out, new RegExp(`^  #${n} \\[`, 'm'), out);
  assert.doesNotMatch(out, /^  #7 \[/m, out);
});
