# Governance update: `rolling-report` marker, and epics exempt whether tiered or not (2026-11-09)

**Applies to:** HopSkipInc/ai-fleet first, then HopSkipInc/analytics-infrastructure,
HopSkipInc/enrichment-pipeline and HopSkipInc/infra-ops on install — every repo that carries
the routing scripts.
**Source:** repo-governance issue #155. After the PDR-011 backfill (ai-fleet#4681), two
script gaps accounted for 27 of the 31 remaining equivalence items on ai-fleet. Neither was a
routing disagreement: 15 epics carrying an `impl:` label, and 12 bot-owned rolling reports.

## What ships

| Artifact | Version | Change |
|---|---|---|
| `scripts/check-routing-equivalence.mjs` | **1.3.1** | exempts every epic-shaped issue (tiered or not) and every `rolling-report` issue; both get their own EXEMPT heading and never count as unresolved |
| `scripts/check-issue-routing.mjs` | **1.7.0** | new **R13** warns when an epic carries a single `impl:` label; `rolling-report` issues are skipped before any rule reads them |
| `skills/routing-triage/SKILL.md` | **1.9.0** | excludes `rolling-report` from the candidate set and never writes a tier line into one |
| `agents/routing-classifier.md` | **1.5.0** | skips `rolling-report` issues |
| `agents/routing-classifier.opencode.md` | **1.6.0** | skips `rolling-report` issues |

Both scripts are cumulative over the versions the pending 2026-11-08 prompt names: install
**1.7.0 / 1.3.1**, not 1.6.1 / 1.2.0. One install takes both changes.

## The marker

A **rolling report** is an open issue a workflow rewrites on every run. Applying labels to
one is fine — labels survive — but a `## Impl tier` line does not: the workflow rewrites the
body and removes it. On ai-fleet a backfill wrote `## Impl tier` into #2567 and the bot
removed it about 40 minutes later, leaving the labels behind. The issue then flaps between
"label with no tier line" (the routing lint) and a permanent difference (the equivalence
check), and no triage pass can make it stick.

The marker is a single label, **`rolling-report`**. Detection is that label and nothing
else — never body text, because the body is the thing the workflow rewrites.

## Steps

**1. Re-sync the routing artifacts** into the paths your CLAUDE.md's Synced-templates table
declares:

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-issue-routing.mjs \
   <declared scripts dir>/check-issue-routing.mjs
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-routing-equivalence.mjs \
   <declared scripts dir>/check-routing-equivalence.mjs
cp ~/repos/HopSkipInc/repo-governance/templates/skills/routing-triage/SKILL.md \
   <declared skills dir>/routing-triage/SKILL.md
```

Install the classifier pin for your harness from `templates/agents/` (Claude Code per-repo,
opencode global). Bump the Synced-templates rows in the same commit.

**2. Create the label.**

```bash
gh label create "rolling-report" --color C5DEF5 \
  --description "Workflow output issue, rewritten each run — never triage or tier"
```

**3. Add the label to existing rolling reports.** Add it *alongside* each probe's own label;
the workflow's lookup by its own label is unaffected.

**4. Add `rolling-report` at creation in every workflow that owns one.** Append it to the
labels on the `gh issue create` call (and, where the workflow creates the issue by other
means, to the equivalent call). On ai-fleet that is these twelve:

| Workflow | Rolling issue |
|---|---|
| `.github/workflows/stale-blocker-probe.yml` | #2351 |
| `.github/workflows/backlog-currency-probe.yml` | #2352 |
| `.github/workflows/evals.yml` (scheduled eval gate) | #2567 |
| `.github/workflows/inference-usage-probes.yml` | #2568 |
| `.github/workflows/provider-key-custody-probe.yml` | #3448 |
| `.github/workflows/event-trigger-refusal-probe.yml` | #4177 |
| `.github/workflows/mcp-auth-probe.yml` | #4065 |
| `.github/workflows/model-class-drift-probe.yml` | #3880 |
| `.github/workflows/platform-fallback-spend.yml` | #3396 |
| `.github/workflows/caller-ceiling-headroom.yml` | #3290 |
| `.github/workflows/merge-path-probe.yml` | #3021 |
| `.github/workflows/epic-handoff-probe.yml` | #3243 |

Each repo should enumerate its own equivalent producers rather than assuming it has the same
set. `merge-path-probe.yml`, `epic-handoff-probe.yml`, `backlog-currency-probe.yml` and
`stale-blocker-probe.yml` also ship as templates in repo-governance; they carry the same
requirement when re-synced.

**5. Re-run both checks and record the movement.** The equivalence check needs
`docs/agent-routing-records.md` §8.

```bash
node scripts/check-issue-routing.mjs           # first line must name the rolling-report skip
node scripts/check-routing-equivalence.mjs
```

The properties to observe, in order of importance:

- the 15 `epic`-labelled issues never appear under **DIFFERENCES** — under 1.2.0 a tiered
  epic was compared; under 1.3.1 every epic is under **EXEMPT EPICS**;
- the 12 `rolling-report` issues appear under **EXEMPT ROLLING REPORTS** and nowhere else;
- the routing lint prints `N rolling report(s) skipped` (12 on ai-fleet after step 3), and
  no `[R13]` finding remains once no epic carries an `impl:` label;
- the remaining unresolved items are the real backlog work from ai-fleet#4681, not script
  defects. Record the before/after count in the PR. If it is not at or below 4, the
  survivors are real — triage them; do not narrow the check.

**State of ai-fleet on 2026-11-09, for the re-run's baseline:** all 15 epics named in the
issue carry the `epic` label and none carries an `impl:` label, so the 1.3.1 epic exemption
guarantees that a labelled epic never returns as a difference; today it moves #2090 and
#4588 from "compared" to the EXEMPT list (both already equivalent). Of the 12 rolling
reports, eleven currently compare equivalent under the rule and **#3243 is the sole
unresolved item** — applying the marker to it is what clears the run.

## Not done here, owed

- **The 12 ai-fleet rolling reports** need the label added there (step 3). repo-governance
  must not write labels into another repo.
- **The 12 ai-fleet workflows** need `rolling-report` on their `gh issue create` calls
  (step 4). That change is what keeps future runs marked; it is not what exempts an
  already-labelled issue. On 2026-11-09 only #3243 is listed, and applying the label to it
  is what takes the check to exit 0.
- **The backfill** (risk labels on the remaining frontier issues, tiers on the untriaged
  backlog) remains ai-fleet#4681, unchanged by this prompt.
