// Fixture tests for the four PDR-011 backfill rules (repo-governance #154).
//
// The change is prose, so the only regression test that bites is a content
// assertion: each rule must live in the artifact the issue names, and the
// operability requirements (the two sanctioned lowerings, the dispute default,
// the never-remove-a-person-set-gate rule, and the classifier's lowering
// fields) must survive a future edit. The mothership pair is checked because a
// template change that forgets docs/agent-routing.md ships a stale policy to
// every governed repo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const read = (rel) => readFileSync(resolve(REPO, rel), 'utf8');

const POLICY = read('templates/agent-routing.md');
const CLASSIFIER = read('templates/agents/routing-classifier.md');
const CLASSIFIER_OPENCODE = read('templates/agents/routing-classifier.opencode.md');
const SKILL = read('templates/skills/routing-triage/SKILL.md');
const PDR = read('docs/pdr/011-route-on-risk-labels-guide-interactive-model-choice-never-gate-it.md');

test('PDR-011 amendment: dated, Last confirmed bumped, rules 1-4 recorded', () => {
  assert.match(PDR, /## Amendment \(2026-11-08\)/);
  assert.match(PDR, /\*\*Last confirmed:\*\* 2026-11-08/);
  for (const rule of ['Rule 1 — `gate:decision`', 'Rule 2 — `gate:human-approval`', 'Rule 3 — the two spec and evidence lowerings', 'Rule 4 — `risk:silent-failure`']) {
    assert.ok(PDR.includes(rule), `PDR-011 amendment is missing "${rule}"`);
  }
  assert.match(PDR, /\*\*The dispute default\.\*\*/);
  assert.match(PDR, /\*\*A person-set gate is never removed\.\*\*/);
  assert.match(PDR, /Rule 4 below is the third path/);
  assert.match(PDR, /third lowering path and carries the same\s+dispute default/);
});

test('policy: gate:decision excludes an open question and names status:needs-decision', () => {
  const row = POLICY.split('\n').find((l) => l.startsWith('| `gate:decision` |'));
  assert.ok(row, 'policy has no gate:decision row');
  assert.match(row, /writes or changes an ADR\/PDR/);
  assert.match(row, /cross-cutting layer an ADR must sanction/);
  assert.match(row, /no gate/);
  assert.match(row, /status:needs-decision/);
  assert.match(row, /rule an ADR already states gets nothing/);
});

test('policy: gate:human-approval names all five outside-merge-path step kinds', () => {
  const row = POLICY.split('\n').find((l) => l.startsWith('| `gate:human-approval` |'));
  assert.ok(row, 'policy has no gate:human-approval row');
  for (const kind of [
    /prod configuration set by hand/,
    /live test against prod/,
    /per-environment switch/,
    /deleting prod data or relaxing a safety invariant/,
    /grant the owner issues/,
  ]) {
    assert.match(row, kind, `gate:human-approval row is missing ${kind}`);
  }
  assert.match(row, /automatically on merge is \*\*inside\*\* the merge path/);
});

test('policy: risk:silent-failure carries rule 4 and its two exclusions', () => {
  const row = POLICY.split('\n').find((l) => l.startsWith('| `risk:silent-failure` |'));
  assert.ok(row, 'policy has no risk:silent-failure row');
  assert.match(row, /nothing else would show it/);
  assert.match(row, /notification whose content is also listed where it is acted on/);
  assert.match(row, /joins two sources which already fail closed and ships a red-first test/);
});

test('policy: the sanctioned lowerings and dispute default sit beside Downgrades', () => {
  assert.match(POLICY, /### When a frontier tier comes down/);
  const section = POLICY.slice(POLICY.indexOf('### When a frontier tier comes down'));
  assert.match(section, /3a — under-specified and nothing else/);
  assert.match(section, /becomes `impl:standard` and loses[\s\S]*`status:ready`/);
  assert.match(section, /explicit exception to the same-edit rule/);
  assert.match(section, /3b — evidence only/);
  assert.match(section, /## Remaining scope \(YYYY-MM-DD\)/);
  assert.match(section, /Rule 4 — the silent-failure label comes off/);
  assert.match(section, /The dispute default/);
  assert.match(section, /marks a 3a, 3b or Rule-4[\s\S]*lowering as `Disputed`, the existing tier stands/);
  assert.match(POLICY, /A `gate:` label a person set is kept/);
  // The CLAUDE.md excerpt must not turn the sanctioned triage lowerings into a
  // licence for the implementing agent to lower its own issue.
  assert.match(POLICY, /You may never downgrade one, least of all on\s+an issue you are about to implement/);
  assert.match(POLICY, /the agent about to implement the issue may not/);
});

test('policy: version stamps agree and the mothership copy is byte-identical', () => {
  assert.match(POLICY, /<!-- template: agent-routing\.md v1\.23\.1 · updated 2026-11-10 -->/);
  assert.match(POLICY, /\*\*Version:\*\* 1\.23\.1/);
  assert.equal(
    read('docs/agent-routing.md'),
    POLICY,
    'docs/agent-routing.md drifted from templates/agent-routing.md — re-sync the registered pair',
  );
});

test('classifier pins: five lowering fields plus the Disputed marker', () => {
  for (const [label, src, version] of [
    ['Claude Code', CLASSIFIER, '1.6.0'],
    ['opencode', CLASSIFIER_OPENCODE, '1.7.0'],
  ]) {
    assert.match(src, new RegExp(`^version: ${version.replace(/\./g, '\\.')}$`, 'm'), `${label} pin version stamp`);
    for (const field of ['decision_shape', 'human_step', 'spec_only_frontier', 'evidence_only', 'remaining_scope', 'Disputed']) {
      assert.ok(src.includes(field), `${label} classifier is missing the ${field} field`);
    }
    for (const shape of ['decision-record', 'new-layer', 'open-question', 'implements-existing']) {
      assert.ok(src.includes(shape), `${label} classifier is missing decision_shape value ${shape}`);
    }
    for (const step of ['prod-config-by-hand', 'live-prod-test', 'per-env-switch', 'delete-prod-data-or-relax-invariant', 'owner-issued-grant']) {
      assert.ok(src.includes(step), `${label} classifier is missing human_step kind ${step}`);
    }
    assert.match(src, /## Remaining scope \(YYYY-MM-DD\)/);
  }
});

test('triage skill Step 3 applies the rules and writes the remaining-scope section', () => {
  assert.match(SKILL, /^version: 1\.10\.1$/m);
  assert.match(SKILL, /`decision_shape` decides `gate:decision`/);
  assert.match(SKILL, /`human_step` decides `gate:human-approval`/);
  assert.match(SKILL, /Never remove a person-set `gate:` label/);
  assert.match(SKILL, /Lower only via 3a, 3b or Rule 4, and never on a disputed call/);
  assert.match(SKILL, /## Remaining scope \(YYYY-MM-DD\)/);
  // Rule 4 removes the label when something else WOULD show the error. The
  // inverted predicate ("only when nothing else would show it") would strip the
  // label from real silent failures and keep it on the exclusions.
  assert.match(SKILL, /Rule 4\s+removes `risk:silent-failure` when something else \*would\* show the wrong result/);
  assert.doesNotMatch(SKILL, /Rule 4 removes `risk:silent-failure` only when nothing else would show/);
  assert.doesNotMatch(
    SKILL,
    /Outcome should be recorded as a PDR\/ADR by a person first/,
    'the label description still teaches the old, over-broad gate:decision reading',
  );
});

test('downstream: one prompt, a row for every governed routing repo, core included', () => {
  const prompt = 'downstream/hopskip/2026-11-10-routing-backfill-rules.md';
  assert.ok(existsSync(resolve(REPO, prompt)), `${prompt} is missing`);
  const body = read(prompt);
  for (const repo of ['ai-fleet', 'analytics-infrastructure', 'enrichment-pipeline', 'infra-ops']) {
    assert.ok(body.includes(repo), `downstream prompt does not name ${repo}`);
  }
  assert.match(body, /`full` \*\*and\*\* `core` alike/);
  assert.match(body, /rule 4 excludes[\s\S]*the classifier does not mark the call `Disputed`/);

  const board = read('downstream/hopskip/_client.md');
  const rows = board.split('\n').filter((l) => l.includes('(2026-11-10-routing-backfill-rules.md)'));
  assert.equal(rows.length, 4, `expected four governed-repo rows, found ${rows.length}`);
  for (const repo of ['ai-fleet', 'analytics-infrastructure', 'enrichment-pipeline', 'infra-ops']) {
    assert.ok(rows.some((r) => r.startsWith(`| HopSkipInc/${repo} |`)), `no downstream row for ${repo}`);
  }
});
