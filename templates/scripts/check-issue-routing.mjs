#!/usr/bin/env node
// template: scripts/check-issue-routing.mjs v1.1.0 · updated 2026-07-26
/**
 * lint:issue-routing  [governance template — copy to <project>/scripts/]
 *
 * Mechanically enforces the routing rules from templates/agent-routing.md and
 * templates/issue-authoring.md (Layer 2). Without this, every rule below
 * degrades into a manual audit check that nobody runs, and the taxonomy
 * quietly stops meaning anything within a couple of months.
 *
 * Unlike the other lint templates here, this one parses no source code — it
 * queries the GitHub API. That makes it the only lint in the set that is
 * genuinely language-agnostic: it works identically in a TypeScript, C#,
 * Python, or Go repo, because issues are issues.
 *
 * RULES
 *   R1 one-impl-label      exactly one impl: label            (structural)
 *   R2 tier-line-present   body has an "## Impl tier" section (structural)
 *   R3 kind-declared       tier > standard declares a kind    (structural)
 *   R4 ready-vs-spec       status:ready + spec-component kind (contradiction)
 *   R5 structure-vs-kind   needs-structure + no spec component(contradiction)
 *   R6 ungrounded-downgrade  impl: lowered with no body edit  (contradiction)
 *   R7 undecomposed          escalation hedges but never split (contradiction)
 *
 * R4: an issue that is frontier only because it is under-specified is ready to
 * be *rewritten*, not worked. R5: your own validator says the issue is
 * under-specified while triage said specification would not help — both cannot
 * be true, and the usual correct answer is kind `both`. R6 is the anti-gaming
 * check: a tier may only be lowered in the same edit that removes the reason.
 *
 * R7 is the mechanical-majority tell. Escalations announce their own
 * splittability in the tier line, in the triager's own words — "mostly
 * mechanical, but…", "X alone would be standard", "highest signal wins",
 * "mostly built, the residual is…". Each is a correct application of *assign by
 * the highest signal* and a missed split: the triager saw the mechanical
 * majority, named it, and escalated the whole issue anyway. Measured across
 * three live backlogs, that pattern produced two splits in thirty-eight
 * escalations.
 *
 * R7 clears when the tier line carries a decomposition record — either a
 * `Not splittable: <mechanism>` sentence or a `Split from|into #N` reference.
 * That interlock is the point: the hedge is only a finding while the
 * decomposition is missing, so the cheapest way to silence the lint is to do
 * the thing the policy asks for.
 *
 * R4–R7 default to WARN. Promote them to ERROR (the WARN→FAIL convention) once
 * your backlog is clean — a first run over an untriaged backlog will be noisy,
 * and a lint that cries wolf on day one gets disabled on day two.
 *
 * R6 requires the GraphQL userContentEdits field. If that query fails, R6 is
 * reported as SKIPPED, never as passing. A check that fails open is worse than
 * no check, because it reads as evidence.
 *
 * CONFIGURE BEFORE USE — REPO is auto-detected from git remote; override it if
 * you run this outside a checkout. Review SEVERITY and STRUCTURE_LABEL.
 *
 * Requires the `gh` CLI, authenticated.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:issue-routing": "node scripts/check-issue-routing.mjs"
 *   workflow:      on: schedule + workflow_dispatch (not per-PR — it is a
 *                  backlog sweep, not a diff check)
 */

import { execFileSync } from 'child_process';

// ---------------------------------------------------------------- configure

/** Severity per rule: 'error' fails the build, 'warn' reports only, 'off' skips. */
const SEVERITY = {
  R1: 'error',
  R2: 'error',
  R3: 'error',
  R4: 'warn',
  R5: 'warn',
  R6: 'warn',
  R7: 'warn',
};

/** The label your issue-structure validator applies. */
const STRUCTURE_LABEL = 'needs-structure';

/** Issue states to sweep. */
const STATE = 'open';

/** Max issues to fetch. */
const LIMIT = 500;

/** R6: a body edit this many minutes either side of the label change counts as grounding it. */
const GROUNDING_WINDOW_MINUTES = 60;

/** Tier ranking — a move to a lower rank is a downgrade. */
const TIER_RANK = { 'impl:standard': 1, 'impl:frontier': 2, 'impl:human': 3 };

/** Kinds that mean "specification would help". */
const SPEC_KINDS = ['spec', 'both'];

/**
 * R7: phrases in a tier line that concede a mechanical majority. Each was
 * observed verbatim in a live backlog on an escalation that was never split.
 * Tune to your triagers' vocabulary — this list is a starting point, not a
 * closed set, and a hedge you see twice belongs in it.
 */
const HEDGE_PATTERNS = [
  /\bmostly mechanical\b/i,
  /\bmostly built\b/i,
  /\blargely mechanical\b/i,
  /\bhighest signal wins\b/i,
  /\bresidual is\b/i,
  /\balone would be\s+(standard|frontier)\b/i,
  /\bon its own (would|is)\s+(standard|frontier)\b/i,
  /\bthe (rest|remainder|bulk) is mechanical\b/i,
  /\bmechanical (except|apart from|other than)\b/i,
];

/**
 * R7 clears on either half of the decomposition record. `Not splittable:` must
 * be followed by something — the policy is explicit that "it's all one thing"
 * is not a statement, and an empty marker is exactly that dressed up.
 */
const NOT_SPLITTABLE = /\bnot splittable\b\s*[::-]\s*\S+/i;
const SPLIT_REFERENCE = /\bsplit\s+(from|into)\b[^.\n]*#\d+/i;

// ------------------------------------------------------------------ helpers

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function repoSlug() {
  if (process.env.ROUTING_REPO) return process.env.ROUTING_REPO;
  const out = JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner']));
  return out.nameWithOwner;
}

/**
 * The "## Impl tier" block, or null.
 *
 * Line-scanned rather than regex-matched on purpose: JavaScript has no \Z
 * anchor, so the obvious `(?=^##\s|\Z)` terminator silently degrades to
 * "followed by a literal Z" and the block never ends. That bug reported every
 * correctly-formatted issue in a live repo as missing its tier line.
 */
function tierBlock(body) {
  if (!body) return null;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##[ \t]*Impl tier[ \t]*$/i.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##[ \t]/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

function declaredKind(block) {
  if (!block) return null;
  const m = block.match(/\b(spec|inherent|both)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function implLabels(labels) {
  return labels.map((l) => l.name).filter((n) => n.startsWith('impl:'));
}

// -------------------------------------------------------------------- rules

const findings = [];
function report(rule, number, message) {
  const sev = SEVERITY[rule];
  if (sev === 'off') return;
  findings.push({ rule, sev, number, message });
}

const REPO = repoSlug();

const issues = JSON.parse(
  gh(['issue', 'list', '--repo', REPO, '--state', STATE, '--limit', String(LIMIT),
      '--json', 'number,title,body,labels'])
);

const tiered = [];

/** Decomposition census — the mechanical half of the audit's signal 5. */
const census = { escalations: 0, notSplittable: 0, split: 0, undeclared: 0 };

for (const issue of issues) {
  const names = issue.labels.map((l) => l.name);
  const impls = implLabels(issue.labels);
  const block = tierBlock(issue.body);
  const kind = declaredKind(block);

  // Untiered issues are only checked by R1 if they carry a tier line, and by
  // nothing else — an untriaged backlog is not a violation, it is just untriaged.
  if (impls.length === 0 && !block) continue;

  if (impls.length !== 1) {
    report('R1', issue.number, `expected exactly one impl: label, found ${impls.length}${impls.length ? ` (${impls.join(', ')})` : ''}`);
  }
  if (impls.length > 0 && !block) {
    report('R2', issue.number, `carries ${impls[0]} but has no "## Impl tier" section — the label routes, the line explains; a constraint with no reason cannot be re-evaluated`);
  }
  if (impls.length === 0 && block) {
    report('R1', issue.number, 'has an "## Impl tier" section but no impl: label — nothing will route on it');
  }

  const tier = impls[0];
  if (tier && tier !== 'impl:standard') {
    if (!kind) {
      report('R3', issue.number, `${tier} with no kind declared — must be spec, inherent, or both. Without the kind the escalation is permanent and the ratio cannot be computed`);
    }
    if (kind && SPEC_KINDS.includes(kind) && names.includes('status:ready')) {
      report('R4', issue.number, `status:ready + ${tier} (${kind}) — ready to be rewritten, not worked. Fix the spec or drop status:ready`);
    }
  }
  if (tier && names.includes(STRUCTURE_LABEL) && !(kind && SPEC_KINDS.includes(kind))) {
    report('R5', issue.number, `carries ${STRUCTURE_LABEL} but is tiered ${kind ? `(${kind})` : 'with no spec component'} — the validator says under-specified, triage says specification would not help. Usual correct answer: both`);
  }

  // R7: the tier line concedes a mechanical majority but carries no decomposition
  // record. The hedge is the triager writing the split proposal in prose and then
  // escalating the whole issue anyway.
  if (tier && tier !== 'impl:standard' && block) {
    const isSplit = SPLIT_REFERENCE.test(block);
    const isDeclared = NOT_SPLITTABLE.test(block);
    const decomposed = isSplit || isDeclared;
    census.escalations += 1;
    if (isSplit) census.split += 1;
    else if (isDeclared) census.notSplittable += 1;
    else census.undeclared += 1;
    if (!decomposed) {
      const hedge = HEDGE_PATTERNS.find((p) => p.test(block));
      if (hedge) {
        report('R7', issue.number, `${tier} tier line concedes a mechanical majority (${block.match(hedge)[0].trim()}) but carries no decomposition record — lift the mechanical half into a standard issue, or state in one sentence what makes it inseparable ("Not splittable: <mechanism>")`);
      }
    }
  }

  if (tier) tiered.push(issue.number);
}

// ------------------------------------------------------- R6 ungrounded downgrade

let r6Skipped = null;
if (SEVERITY.R6 !== 'off' && tiered.length) {
  const [owner, name] = REPO.split('/');
  for (const number of tiered) {
    let events, edits;
    try {
      events = JSON.parse(gh(['api', `repos/${REPO}/issues/${number}/timeline`, '--paginate']))
        .filter((e) => (e.event === 'labeled' || e.event === 'unlabeled') && e.label?.name?.startsWith('impl:'));
      if (!events.length) continue;
      const q = `query($o:String!,$n:String!,$i:Int!){repository(owner:$o,name:$n){issue(number:$i){userContentEdits(first:100){nodes{editedAt}}}}}`;
      const res = JSON.parse(gh(['api', 'graphql', '-f', `query=${q}`, '-F', `o=${owner}`, '-F', `n=${name}`, '-F', `i=${number}`]));
      edits = res.data.repository.issue.userContentEdits.nodes.map((e) => Date.parse(e.editedAt));
    } catch (err) {
      r6Skipped = err.message.split('\n')[0];
      break;
    }

    // Reconstruct downgrades: an impl: label added whose rank is lower than one removed nearby.
    const added = events.filter((e) => e.event === 'labeled');
    const removed = events.filter((e) => e.event === 'unlabeled');
    for (const a of added) {
      const t = Date.parse(a.created_at);
      const near = removed.find((r) => Math.abs(Date.parse(r.created_at) - t) < GROUNDING_WINDOW_MINUTES * 60000);
      if (!near) continue;
      const from = TIER_RANK[near.label.name] ?? 0;
      const to = TIER_RANK[a.label.name] ?? 0;
      if (to >= from) continue; // not a downgrade
      const grounded = edits.some((e) => Math.abs(e - t) < GROUNDING_WINDOW_MINUTES * 60000);
      if (!grounded) {
        report('R6', number, `downgraded ${near.label.name} → ${a.label.name} with no body edit within ${GROUNDING_WINDOW_MINUTES}m. A tier may only be lowered in the same edit that removes the reason; an inherent tier cannot be lowered by relabeling at all`);
      }
    }
  }
}

// ------------------------------------------------------------------- output

const errors = findings.filter((f) => f.sev === 'error');
const warns = findings.filter((f) => f.sev === 'warn');

console.log(`check-issue-routing: ${REPO} — swept ${issues.length} ${STATE} issues, ${tiered.length} tiered.`);

if (census.escalations) {
  const pct = ((census.escalations / tiered.length) * 100).toFixed(0);
  console.log(
    `\nDecomposition census: ${census.escalations}/${tiered.length} tiered issues escalate (${pct}%) — ` +
    `${census.split} split, ${census.notSplittable} declared not splittable, ${census.undeclared} undeclared.`
  );
  console.log(
    'Compare the ratio against this repo\'s target (per-repo, in the client governance record — ' +
    'adopting ≤ 20%, mature ≤ 10%). All-declared-and-never-split and not-attempting-the-rule ' +
    'look identical from the ratio alone; the split count is what separates them.'
  );
}

for (const group of [errors, warns]) {
  if (!group.length) continue;
  const label = group === errors ? 'ERROR' : 'WARN';
  console[group === errors ? 'error' : 'log'](`\n${label} (${group.length}):`);
  for (const f of group.sort((a, b) => a.number - b.number)) {
    console[group === errors ? 'error' : 'log'](`  #${f.number} [${f.rule}] ${f.message}`);
  }
}

if (r6Skipped) {
  console.log(`\nR6 SKIPPED — could not read label timeline or edit history (${r6Skipped}).`);
  console.log('Not counted as passing. R6 needs repo read access and the GraphQL userContentEdits field.');
}

if (!findings.length && !r6Skipped) {
  console.log('OK: all tiered issues carry a single impl: label, a tier line, a kind, and no contradictions.');
}

process.exit(errors.length ? 1 : 0);
