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
const AUTHORING = read('templates/issue-authoring.md');
const CLASSIFIER = read('templates/agents/routing-classifier.md');
const CLASSIFIER_OPENCODE = read('templates/agents/routing-classifier.opencode.md');
const SKILL = read('templates/skills/routing-triage/SKILL.md');
const PDR = read('docs/pdr/011-route-on-risk-labels-guide-interactive-model-choice-never-gate-it.md');

test('PDR-011 amendment: dated, Last confirmed bumped, rules 1-4 recorded', () => {
  assert.match(PDR, /## Amendment \(2026-11-08\)/);
  assert.match(PDR, /\*\*Last confirmed:\*\* 2026-11-13/);
  for (const rule of ['Rule 1 — `gate:decision`', 'Rule 2 — `gate:human-approval`', 'Rule 3 — the two spec and evidence lowerings', 'Rule 4 — `risk:silent-failure`']) {
    assert.ok(PDR.includes(rule), `PDR-011 amendment is missing "${rule}"`);
  }
  assert.match(PDR, /\*\*The dispute default\.\*\*/);
  assert.match(PDR, /\*\*A person-set gate is never removed\.\*\*/);
  assert.match(PDR, /Rule 4 below is the third path/);
  assert.match(PDR, /third lowering path and carries the same\s+dispute default/);
});

test('PDR-011 amendment 2026-11-13: a human step names its automation', () => {
  assert.match(PDR, /## Amendment \(2026-11-13\)/);
  for (const rule of [
    'Rule 5 — `impl:human` decomposes; it is never sufficient alone.',
    'Rule 6 — the `## Human step` record.',
    'Rule 7 — a gate names who decides, never who types.',
    'Rule 8 — automated is not unsupervised.',
    'Rule 9 — mitigation is owed during implementation.',
  ]) {
    assert.ok(PDR.includes(rule), `PDR-011 2026-11-13 amendment is missing "${rule}"`);
  }
  assert.match(PDR, /can a deterministic procedure be written that produces the same\s+result every time\?/);
  assert.match(PDR, /`Automation: #N`/);
  assert.match(PDR, /`Not automatable — <mechanism>`/);
  assert.match(PDR, /A\s+credential the agent can be granted — a service principal, a vault entry it may read — is an\s+automation, not a credential gate/);
  assert.match(PDR, /Audit signal 7 — human-step debt/);
  assert.match(PDR, /Revisit by 2027-05-13/);
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
    /prod configuration/,
    /live test against prod/,
    /per-environment switch/,
    /deleting prod data or relaxing a safety invariant/,
    /grant the owner issues/,
  ]) {
    assert.match(row, kind, `gate:human-approval row is missing ${kind}`);
  }
  assert.match(row, /automatically on merge is \*\*inside\*\* the merge path/);
  // 1.26.0: the approval stays human; execution goes to the agent.
  assert.match(row, /A human \*\*authorizes\*\* a step outside the merge path; the agent executes it/);
  assert.match(row, /A human re-typing the step does not satisfy the gate/);
});

test('policy: a gate carries a ## Human step record that names its automation', () => {
  const section = POLICY.split('### The `## Human step` record\n')[1]?.split('**Rules 1 and 2 govern additions.**')[0];
  assert.ok(section, 'policy has no ## Human step section');
  assert.match(section, /Every `gate:` label carries one line under `## Human step`/);
  assert.match(section, /`Automation: #N` — a linked issue that scripts or codifies the repeatable step/);
  assert.match(section, /`Not automatable — <mechanism>`/);
  assert.match(section, /legal signatory/);
  assert.match(section, /bound\s+to a natural person/);
  assert.match(section, /value judgment no test\s+settles/);
  assert.match(section, /named org policy not to delegate/);
  assert.match(section, /\*\*`Not automatable` is the flattering call\*\*/);
  assert.match(section, /A manual step discovered and left unrecorded is a Definition-of-Done failure/);
  // impl:human is transitional, and never stands alone.
  const tier = POLICY.split('- **`impl:human`** —')[1]?.split('\n## ')[0] ?? '';
  assert.match(tier, /transitional, and never sufficient on its own/);
  assert.match(tier, /decomposes[\s\S]*gate:[\s\S]*`## Human step`/);
  assert.match(tier, /"needs human hands" is not a reason/);
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
  assert.match(POLICY, /never remove\s+a `gate:` label a person set/);
  // The CLAUDE.md excerpt must not turn the sanctioned triage lowerings into a
  // licence for the implementing agent to lower its own issue.
  assert.match(POLICY, /You may never downgrade one, least of all on\s+an issue you are about to implement/);
  assert.match(POLICY, /the agent about to implement the issue may not/);
});

test('policy: version stamps agree and the mothership copy is byte-identical', () => {
  assert.match(POLICY, /<!-- template: agent-routing\.md v1\.26\.0 · updated 2026-11-13 -->/);
  assert.match(POLICY, /\*\*Version:\*\* 1\.26\.0/);
  assert.equal(
    read('docs/agent-routing.md'),
    POLICY,
    'docs/agent-routing.md drifted from templates/agent-routing.md — re-sync the registered pair',
  );
});

test('policy: the three-attempt stop counts causes, not tests (1.24.0)', () => {
  // Observable-conditions list: the definition of a cause, and that only a new failure restarts the count.
  assert.match(POLICY, /- Three attempts that fail with the same cause\. The cause is what the failure shows/);
  assert.match(POLICY, /A failure that shows something new is a new cause and restarts the count/);
  assert.match(POLICY, /is only re-described, with the same failure, is not\./);
  // AGENTS section item 4 carries the same rule, and the old per-test wording is gone everywhere.
  assert.match(POLICY, /three attempts that\s+fail with the same cause;/);
  assert.doesNotMatch(POLICY, /same failing test/i);
  assert.doesNotMatch(read('AGENTS.md'), /same failing test/i);
});

test('unreachable resources stop every work type in the policy, shipped block and local instructions', () => {
  const stopList = POLICY.split('### Observable stop conditions\n')[1]?.split('### Self-identification\n')[0];
  const shippedBlock = POLICY.split('## CLAUDE.md / AGENTS.md section\n')[1]?.split('## Anti-patterns\n')[0];
  const localBlock = read('AGENTS.md').split('## Agent routing\n')[1]?.split('## Gotchas\n')[0];
  for (const [name, section] of [
    ['observable stop list', stopList],
    ['shipped AGENTS.md block', shippedBlock],
    ['local AGENTS.md block', localBlock],
  ]) {
    assert.ok(section, `${name} is missing`);
    const text = section.replace(/\s+/g, ' ');
    assert.ok(text.includes('A verifiable outcome or a "Read first" resource the session cannot reach is a stop, for any work type.'), `${name} must stop on either unreachable resource`);
    assert.ok(text.includes('Comment with the unreachable resource and stop: the edit does not land and the turn ends; the outcome is never carried forward or waived.'), `${name} must preserve the stop's consequences`);
  }
});

test('UI authoring: canonical design reference names repo sources, images, composition and credential-free Render', () => {
  const schema = AUTHORING.split('## The canonical issue schema\n')[1]?.split('\nRules:')[0];
  assert.ok(schema, 'canonical schema is missing');
  assert.match(schema, /\n## Design reference\n/);
  assert.match(schema, /\nReference: <repo source path \+ image path, or none — <named rule> decides>\n/);
  assert.match(schema, /\nComposition: /);
  assert.match(schema, /\nRender: <exact command/);
  const rule = AUTHORING.split('## Design reference for rendered UI\n')[1]?.split('\n## Label taxonomy')[0];
  assert.ok(rule, 'rendered UI authoring rule is missing');
  for (const requirement of [
    /required when an issue's outcomes change a rendered UI/,
    /source \+ image/,
    /private tool may appear only beside its repo mirror/,
    /Reference: none — <named rule> decides/,
    /sections, columns, copy, filters, and status mapping/,
    /not only the components/,
    /Render: <command>/,
    /before\/after images without live credentials/,
  ]) assert.match(rule, requirement);
});

test('classifier pins: five lowering fields plus the Disputed marker', () => {
  for (const [label, src, version] of [
    ['Claude Code', CLASSIFIER, '1.7.0'],
    ['opencode', CLASSIFIER_OPENCODE, '1.8.0'],
  ]) {
    assert.ok(
      src.split('\n').includes(`version: ${version}`),
      `${label} pin version stamp must be exactly "version: ${version}"`,
    );
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
  assert.match(SKILL, /^version: 1\.11\.1$/m);
  assert.match(SKILL, /`decision_shape` decides `gate:decision`/);
  assert.match(SKILL, /`human_step` decides `gate:human-approval`/);
  assert.match(SKILL, /Every applied `gate:` gets a `## Human step` line/);
  assert.match(SKILL, /`Automation: #N`/);
  assert.match(SKILL, /`Not automatable — <mechanism>`/);
  assert.match(SKILL, /A gate\s+names who decides, never who types/);
  assert.match(SKILL, /A gate with no record is malformed; a record with no mechanism is malformed too/);
  // The executable batch procedure must carry the record too, not just the prose rule.
  assert.match(SKILL, /batch\.jsonl/);
  assert.match(SKILL, /jq -r '\.additions'/);
  assert.match(SKILL, /raw newlines/);
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
