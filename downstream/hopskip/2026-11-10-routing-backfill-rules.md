# Governance update: the four PDR-011 backfill rules and the dispute default (2026-11-10)

**Applies to:** every governed repo that carries the routing set — HopSkipInc/ai-fleet,
HopSkipInc/analytics-infrastructure, HopSkipInc/enrichment-pipeline and HopSkipInc/infra-ops.
All four take it, `full` **and** `core` alike. SourcingService has no routing layer yet
(no repo-scoped backlog key), so there is nothing to re-sync there.
**Source:** repo-governance issue #154, amending PDR-011 (dated 2026-11-08) and the
never-downgrade rule in `docs/agent-routing.md`. The rules were adopted by the owner on
HopSkipInc/ai-fleet#4681 and applied to its remaining 383 issues.

## Why

The PDR-011 backfill exposed four places where the templates' guidance was too loose to
apply consistently. Every repo that triages under the old text will reproduce the same
inconsistency. The rules are now in the policy itself; this prompt re-syncs the policy and
has each repo re-check the calls made under the old text.

## What ships

| Artifact | Version | Change |
|---|---|---|
| `docs/agent-routing.md` | **1.24.0** | Rules 1–4 in the gate table, heuristics table and `risk:silent-failure` row; new §*When a frontier tier comes down* (3a, 3b, dispute default); a person-set gate is never removed. **1.24.0** (2026-11-10, owner decision): the three-attempt stop counts causes, not tests — three attempts that fail with the same cause stop the work, and a failure that shows something new restarts the count. Where the repo mirrors item 4 of the AGENTS section in its own `AGENTS.md`/`CLAUDE.md`, hand-port that one phrase (ai-fleet applied it directly on 2026-11-10) |
| `skills/routing-triage/SKILL.md` | **1.10.1** | Step 3 applies the gate and lowering fields; never removes a person-set gate; writes the rule-3b `## Remaining scope (YYYY-MM-DD)` section |
| `agents/routing-classifier.md` | **1.6.0** | per-row lowering fields: `decision_shape`, `human_step`, `spec_only_frontier`, `evidence_only` / `remaining_scope`, `Disputed` |
| `agents/routing-classifier.opencode.md` | **1.7.0** | same fields; opencode pin (global file) |

No script changes and no migrations. The PDR-011 amendment itself lives in
repo-governance's `docs/pdr/` and never syncs — the policy is the operational text.

**The rules, for the reviewer:**

1. **`gate:decision`** only when the deliverable writes or changes an ADR/PDR (or a row in
   an ADR's decision table), or adds a new cross-cutting layer an ADR must sanction. An
   issue that only leaves a question open takes no gate; `status:ready` becomes
   `status:needs-decision`. Implementing a rule an ADR already states gets nothing.
2. **`gate:human-approval`** only when the *remaining* work includes a step outside the
   merge path: prod configuration set by hand; a live test against prod; a per-environment
   switch flipped outside the merge; deleting prod data or relaxing a safety invariant; a
   grant the owner issues. An automatic deploy on merge is inside the merge path.
3. **Two lowerings only:** 3a, a frontier issue that is frontier *only* because it is
   under-specified with no `risk:` fact → `impl:standard`, loses `status:ready` until
   rewritten; 3b, all code merged with only post-deploy evidence left → narrow to a dated
   `## Remaining scope (YYYY-MM-DD)` task and re-tier on it.
4. **`risk:silent-failure`** only when nothing else would show the wrong result. Not for a
   notification whose content is also listed where it is acted on; not for a CI check that
   joins two sources which already fail closed and ships a red-first test.

**Dispute default.** When the classifier marks a 3a, 3b or Rule-4 lowering as `Disputed`,
the existing tier stands and the issue goes to the human. **Never remove a person-set
`gate:` label**, even when a rule says it would not be added today.

## Steps

**1. Re-sync the artifacts** into the paths your CLAUDE.md / AGENTS.md Synced-templates
table declares:

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md \
   docs/agent-routing.md
cp ~/repos/HopSkipInc/repo-governance/templates/skills/routing-triage/SKILL.md \
   <declared skills dir>/routing-triage/SKILL.md
```

Install the classifier pin for your harness from `templates/agents/`: Claude Code reads the
per-repo `.claude/agents/routing-classifier.md`; opencode reads the global
`~/.config/opencode/agents/routing-classifier.md` and needs a restart. Bump the
Synced-templates rows to 1.24.0 / 1.10.1 / 1.6.0 (or 1.7.0 for the opencode pin) in the
same commit. `docs/agent-routing.md` must be byte-identical to the template — verify with
`diff -q`, not by reading it.

**2. Re-check the calls made under the old text.** Run a triage refresh, or audit the open
issues already carrying `gate:` labels or a frontier tier under these rules. For each:

- a `gate:decision` the deliverable does not support (an open question is not a decision
  record) — clear it **only if no person set it**, and flip `status:ready` to
  `status:needs-decision` where the question is still open;
- a `gate:human-approval` with no step outside the merge path — same rule: clear only when
  no person set it; an automatic deploy on merge does not qualify;
- a frontier issue that is 3a or 3b — lower only when the classifier does not mark it
  `Disputed`; write the `## Remaining scope (YYYY-MM-DD)` section for 3b;
- a `risk:silent-failure` that rule 4 excludes — remove the label, and adjust the tier only
  if no other risk fact holds it up and the classifier does not mark the call `Disputed`.

Do this from a reviewed batch file (the skill's Step 3), never an ad-hoc loop, and read each
current body before appending. **`impl:` stays required** during the transition; the rules
change what a tier and gate mean, not whether the labels exist.

**3. Verify the effect, not the files you just wrote.**

```bash
diff -q docs/agent-routing.md ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md
node scripts/check-issue-routing.mjs
node scripts/check-routing-equivalence.mjs
```

Record in the PR: the number of gates cleared, the number of `status:ready` →
`status:needs-decision` flips, the lowerings by rule (3a / 3b / Rule 4), the count the
dispute default held, and the before/after unresolved count from the equivalence check.
A repo that had not been triaged under the loose text should record "no calls to re-check"
rather than inventing movement.

**4. Record the sync.** Add the version row to the repo's Synced-templates table and note
the outcome under `### Applied governance updates` in its CLAUDE.md / AGENTS.md — never in
this repo.

## On ai-fleet specifically

The rules were adopted there on 2026-11-08 and already applied to 383 issues, so step 2 is a
confirmation pass, not a fresh backfill. The evidence to match: `gate:human-approval` +75,
`gate:decision` +68, `status:ready` → `status:needs-decision` 19, lowerings 3a 5 / 3b 8 /
Rule 4 1, and 6 lowerings stopped by the dispute default. The equivalence run moved 485 → 31
unresolved; the survivors are the #155/#4681 backlog, not these rules. If a re-run shows a
call that contradicts those numbers, the call is the thing to inspect — do not re-run the
batch until it explains the difference.
