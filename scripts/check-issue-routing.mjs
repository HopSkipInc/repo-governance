#!/usr/bin/env node
// template: scripts/check-issue-routing.mjs v1.4.0 · updated 2026-08-17
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
 *   R1 one-impl-label      exactly one impl: label; an epic's child tier
 *                            table (policy §Mechanism 3) is exempt — it
 *                            carries no single tier by design   (structural)
 *   R2 tier-line-present   body has an "## Impl tier" section (structural)
 *   R3 kind-declared       tier > standard declares a kind    (structural)
 *   R4 ready-vs-spec       status:ready + spec-component kind (contradiction)
 *   R5 structure-vs-kind   needs-structure + no spec component(contradiction)
 *   R6 ungrounded-downgrade  impl: lowered with no body edit  (contradiction)
 *   R7 undecomposed          escalation hedges but never split (contradiction)
 *   R8 uncovered-no-record   escalation blames coverage, no record(contradiction)
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
 * R8 is R7's sibling one signal over. The heuristics table escalates an issue
 * when no existing test covers the surface being changed — which means the tier
 * is not a property of the issue at all, it is a property of the test suite, and
 * it expires the moment somebody writes the test. An escalation that cites the
 * uncovered surface and carries no coverage record has recorded a recurring cost
 * with no way to stop paying it. R8 clears on `Coverage gap: #N` (the issue that
 * closes it) or `Coverage: not testable — <mechanism>` (the property cannot be
 * verified at any level). Same interlock as R7: the cheapest way to silence the
 * lint is to do what the policy asks.
 *
 * The census this prints is the audit's signal 6. Watch for the same surface
 * named by several escalations — that is one test's worth of work holding
 * multiple issues above standard, and it is the highest-return item the coverage
 * layer will find.
 *
 * R4–R8 default to WARN. Promote them to ERROR (the WARN→FAIL convention) once
 * your backlog is clean — a first run over an untriaged backlog will be noisy,
 * and a lint that cries wolf on day one gets disabled on day two.
 *
 * R6 requires the GraphQL userContentEdits field. If that query fails, R6 is
 * reported as SKIPPED, never as passing. A check that fails open is worse than
 * no check, because it reads as evidence.
 *
 * CLOSED PASS (1.4.0+) — `--closed [--days N] [--closed-gate]`
 *
 * The open sweep governs work not yet done. The closed pass answers a
 * different question: is this repo's history estimable? The estimation bucket
 * key includes the kind, and an escalation that closes without one is a
 * permanently lost data point — the calibration protocol forbids classifying
 * it after the fact ("a narrative, not an experiment"). So the closed pass
 * applies R1–R3 only to issues closed within the window (default 30 days)
 * and prints a kind-coverage census. R4–R8 are contradiction rules about work
 * in flight and cannot fire honestly on finished work; R6 is excluded the
 * same way.
 *
 * The closed pass is a probe by default: findings print under their own
 * heading and never fail the build (it monitors record quality; it must never
 * block a merge). `--closed-gate` promotes it to blocking — the adoption path
 * is probe first, one cycle of the coverage number, then decide. Wire it on a
 * schedule, not per-PR: issues close between PRs, and a PR does not close
 * issues at merge time reliably enough to gate on.
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
  R8: 'warn',
};

/** The label your issue-structure validator applies. */
const STRUCTURE_LABEL = 'needs-structure';

/** Issue states to sweep. `--closed` overrides this — see the header. */
const STATE = 'open';

/** Max issues to fetch. */
const LIMIT = 500;

/** Default recency window for the closed pass. */
const DEFAULT_CLOSED_DAYS = 30;

/** Rules that fire on closed issues. R4–R8 are contradiction rules about work
 *  in flight; on finished work they cannot fire honestly. */
const CLOSED_RULES = new Set(['R1', 'R2', 'R3']);

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

/**
 * R8: phrases that cite the uncovered-surface signal as a reason for the tier.
 * Same tuning advice as HEDGE_PATTERNS — add what your triagers actually write.
 *
 * The last three entries are the 2026-07-27 ai-fleet additions: "has no test
 * file" was used three times in a single triage run and matched none of the
 * original seven — every one of those escalations rested entirely on the
 * uncovered-surface signal, escaped R8, and got no expiry condition. The
 * file-named form is written `(test|spec).<ext>` so it reads across languages
 * (get.test.ts, Foo.spec.cs); the observed phrasing was TypeScript.
 */
const COVERAGE_SIGNAL = [
  /\bno (existing |current )?tests?\b[^.\n]*\bcovers?\b/i,
  /\bnot covered by (a )?tests?\b/i,
  /\bno test coverage\b/i,
  /\bno coverage\b/i,
  /\buncovered\b/i,
  /\buntested\b/i,
  /\bnothing (currently )?(covers|verifies|exercises)\b/i,
  /\bno test files?\b/i,
  /\bno \S+\.(test|spec)\.[a-z0-9]+\b/i,
  /\basserts? nothing about\b/i,
];

/**
 * R8 clears on either form of the coverage record. Both require something after
 * the marker for the same reason `Not splittable:` does — "Coverage: not testable"
 * with no mechanism is the flattering call with a colon after it.
 */
const COVERAGE_GAP = /\bcoverage gap\b\s*[::-]\s*[^\n]*#\d+/i;
const COVERAGE_NOT_TESTABLE = /\bcoverage\b\s*[::-]\s*not testable\b\s*[—–\-:]\s*\S+/i;

/**
 * The epic shape (policy §Mechanism 3): an epic carries a tier table over its
 * children rather than a single tier, so it has no impl: label and its tier
 * block is the child table, not a tier line. R1 must not demand a label on
 * the shape the policy prescribes — it did, on every epic, until 1.3.0.
 * Detected two ways, either sufficient: the repo's `epic` label, or a table
 * row in the block pairing a child issue with a tier. A qualified heading
 * (e.g. `## Impl tier (epic …)`) never reaches here at all — it falls outside
 * tierBlock's anchored heading and the issue is skipped above.
 */
const EPIC_TIER_ROW = /^\s*\|[^\n]*#\d+[^\n]*\|\s*(standard|frontier|human)\s*\|/im;

function isEpicShape(names, block) {
  return names.some((n) => n.toLowerCase() === 'epic') || (block ? EPIC_TIER_ROW.test(block) : false);
}

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

/**
 * The kind is read from its declaration site — the first line of the block,
 * where the tier is declared — never from prose. The previous whole-block
 * `\b(spec|inherent|both)\b` false-positived on ordinary English ("fails closed
 * at **both** decision points"), reporting kind=both on standard issues
 * (ai-fleet #1356, #1354). Harmless to today's rules (R3/R4/R7 gate on tier,
 * R5 needs the structure label), but the field was untrustworthy and any
 * future rule reading kind without checking tier would misfire.
 *
 * The declaration shapes below are the observed dialects, not aspirations —
 * run against ai-fleet's live backlog before tightening: the canonical
 * `frontier (inherent)`, the backticked `` `frontier` (`inherent`) ``, the
 * slash form `` `human` / `inherent` ``, the comma-kind form
 * `impl: frontier, kind both`, the em-dash form `` `frontier` — kind `both` ``,
 * and the standalone `**Kind: inherent.**`.
 * Emphasis is stripped first; what each shape has in common is the kind word
 * bound to the tier word or the word "kind", which is what prose never does.
 */
function declaredKind(block) {
  if (!block) return null;
  const firstLine = block.split(/\r?\n/, 1)[0].replace(/[`*]/g, '');
  const m =
    firstLine.match(/\b(?:standard|frontier|human)\b[^(]*\((?:kind:\s*)?(spec|inherent|both)\)/i) ||
    firstLine.match(/\b(?:standard|frontier|human)\b\s*[/,]\s*(?:kind[:\s]*)?(spec|inherent|both)\b/i) ||
    firstLine.match(/\b(?:standard|frontier|human)\b\s*[—–-]\s*kind[:\s]+(spec|inherent|both)\b/i) ||
    firstLine.match(/\bkind\s*:\s*(spec|inherent|both)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function implLabels(labels) {
  return labels.map((l) => l.name).filter((n) => n.startsWith('impl:'));
}

// -------------------------------------------------------------------- rules

const findings = [];
function report(rule, number, message) {
  if (CLOSED && !CLOSED_RULES.has(rule)) return;
  const sev = SEVERITY[rule];
  if (sev === 'off') return;
  findings.push({ rule, sev, number, message });
}

// ------------------------------------------------------- closed-pass flags

const ARGS = process.argv.slice(2);
const CLOSED = ARGS.includes('--closed');
const CLOSED_GATE = ARGS.includes('--closed-gate');
let DAYS = DEFAULT_CLOSED_DAYS;
const daysIdx = ARGS.indexOf('--days');
if (daysIdx !== -1) {
  DAYS = Number(ARGS[daysIdx + 1]);
  if (!Number.isInteger(DAYS) || DAYS < 1) {
    console.error(`check-issue-routing: --days needs a positive integer, got "${ARGS[daysIdx + 1]}"`);
    process.exit(2);
  }
}

const REPO = repoSlug();

const state = CLOSED ? 'closed' : STATE;
const fields = CLOSED ? 'number,title,body,labels,closedAt' : 'number,title,body,labels';
const fetched = JSON.parse(
  gh(['issue', 'list', '--repo', REPO, '--state', state, '--limit', String(LIMIT),
      '--json', fields])
);

/** The window filters client-side: one fetch path, no `--search` date dialect. */
const cutoff = Date.now() - DAYS * 24 * 60 * 60 * 1000;
const issues = CLOSED ? fetched.filter((i) => Date.parse(i.closedAt) >= cutoff) : fetched;

const tiered = [];

/** Decomposition census — the mechanical half of the audit's signal 5. */
const census = { escalations: 0, notSplittable: 0, split: 0, undeclared: 0 };

/** Coverage census — the mechanical half of the audit's signal 6. */
const coverage = { cited: 0, gap: 0, notTestable: 0, unrecorded: 0, issues: [] };

/** Kind coverage census (closed pass only) — the estimability number. */
const kindCoverage = { escalations: 0, spec: 0, inherent: 0, both: 0, undeclared: 0 };

for (const issue of issues) {
  const names = issue.labels.map((l) => l.name);
  const impls = implLabels(issue.labels);
  const block = tierBlock(issue.body);
  const kind = declaredKind(block);

  // Untiered issues are only checked by R1 if they carry a tier line, and by
  // nothing else — an untriaged backlog is not a violation, it is just untriaged.
  if (impls.length === 0 && !block) continue;

  const epic = isEpicShape(names, block);
  if (impls.length !== 1 && !(epic && impls.length === 0)) {
    report('R1', issue.number, `expected exactly one impl: label, found ${impls.length}${impls.length ? ` (${impls.join(', ')})` : ''}`);
  }
  if (impls.length > 0 && !block) {
    report('R2', issue.number, `carries ${impls[0]} but has no "## Impl tier" section — the label routes, the line explains; a constraint with no reason cannot be re-evaluated`);
  }
  if (impls.length === 0 && block && !epic) {
    report('R1', issue.number, 'has an "## Impl tier" section but no impl: label — nothing will route on it. If this is an epic, the block should be the child tier table (policy §Mechanism 3), which R1 exempts');
  }

  const tier = impls[0];
  if (CLOSED && tier && tier !== 'impl:standard') {
    kindCoverage.escalations += 1;
    if (kind) kindCoverage[kind] += 1;
    else kindCoverage.undeclared += 1;
  }
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
  // escalating the whole issue anyway. Open-pass only — the census reads work habits,
  // and a closed issue's hedge is no longer actionable.
  if (!CLOSED && tier && tier !== 'impl:standard' && block) {
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

  // R8: the tier line blames an uncovered surface but names no way to close it.
  // The tier is then a standing charge against a test nobody has been asked to write.
  // Open-pass only, same reasoning as R7.
  if (!CLOSED && tier && tier !== 'impl:standard' && block) {
    const signal = COVERAGE_SIGNAL.find((p) => p.test(block));
    if (signal) {
      const hasGap = COVERAGE_GAP.test(block);
      const hasNotTestable = COVERAGE_NOT_TESTABLE.test(block);
      coverage.cited += 1;
      coverage.issues.push(issue.number);
      if (hasGap) coverage.gap += 1;
      else if (hasNotTestable) coverage.notTestable += 1;
      else {
        coverage.unrecorded += 1;
        report('R8', issue.number, `${tier} tier line cites an uncovered surface ("${block.match(signal)[0].trim()}") but carries no coverage record — file the gap and link it ("Coverage gap: #N"), or state the mechanism that makes the property unverifiable ("Coverage: not testable — <mechanism>"). Without one, the tier has no expiry condition`);
      }
    }
  }

  if (tier) tiered.push(issue.number);
}

// ------------------------------------------------------- R6 ungrounded downgrade
// Open-pass only: a closed issue's tier history is frozen, and the rule exists
// to catch gaming in flight — post-close it is meaningless.

let r6Skipped = null;
if (!CLOSED && SEVERITY.R6 !== 'off' && tiered.length) {
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

console.log(
  CLOSED
    ? `check-issue-routing (closed pass, R1–R3, last ${DAYS}d): ${REPO} — swept ${issues.length} closed issues, ${tiered.length} tiered.`
    : `check-issue-routing: ${REPO} — swept ${issues.length} ${STATE} issues, ${tiered.length} tiered.`
);

if (CLOSED) {
  const declared = kindCoverage.spec + kindCoverage.inherent + kindCoverage.both;
  const pct = kindCoverage.escalations ? Math.round((declared / kindCoverage.escalations) * 100) : 0;
  console.log(
    `\nKind coverage: ${kindCoverage.escalations} closed escalation(s) in window — ` +
    `${kindCoverage.spec} spec, ${kindCoverage.inherent} inherent, ${kindCoverage.both} both, ` +
    `${kindCoverage.undeclared} undeclared (${pct}% declared).`
  );
  console.log(
    'This is the number that says whether the repo\'s history is estimable: the estimation ' +
    'bucket key includes the kind, and an escalation closed without one is a data point ' +
    'nothing can recover.'
  );
}

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

if (coverage.cited) {
  console.log(
    `\nCoverage census: ${coverage.cited}/${census.escalations || tiered.length} escalations rest on an uncovered surface — ` +
    `${coverage.gap} with a linked gap issue, ${coverage.notTestable} declared not testable, ${coverage.unrecorded} unrecorded ` +
    `(${coverage.issues.map((n) => `#${n}`).join(', ')}).`
  );
  console.log(
    'These are issues paying frontier rates for a test nobody wrote. Read the list for repeats: ' +
    'one surface named by several escalations is one test\'s worth of work holding all of them above standard.'
  );
}

if (CLOSED) {
  if (findings.length) {
    const posture = CLOSED_GATE ? 'gate' : 'probe — never blocks a merge';
    console.log(`\nCLOSED PASS (${findings.length}, ${posture}):`);
    for (const f of findings.sort((a, b) => a.number - b.number)) {
      console.log(`  #${f.number} [${f.rule}] ${f.message}`);
    }
  }
} else {
  for (const group of [errors, warns]) {
    if (!group.length) continue;
    const label = group === errors ? 'ERROR' : 'WARN';
    console[group === errors ? 'error' : 'log'](`\n${label} (${group.length}):`);
    for (const f of group.sort((a, b) => a.number - b.number)) {
      console[group === errors ? 'error' : 'log'](`  #${f.number} [${f.rule}] ${f.message}`);
    }
  }
}

if (r6Skipped) {
  console.log(`\nR6 SKIPPED — could not read label timeline or edit history (${r6Skipped}).`);
  console.log('Not counted as passing. R6 needs repo read access and the GraphQL userContentEdits field.');
}

if (!findings.length && !r6Skipped) {
  console.log(
    CLOSED
      ? 'OK: every closed escalation in the window carries a single impl: label, a tier line, and a kind.'
      : 'OK: all tiered issues carry a single impl: label, a tier line, a kind, and no contradictions.'
  );
}

process.exit(CLOSED ? (CLOSED_GATE && findings.length ? 1 : 0) : errors.length ? 1 : 0);
