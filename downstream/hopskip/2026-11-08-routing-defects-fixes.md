# Governance update: PDR-011 equivalence/lint defects — epics exempt, human gates, full sweep (2026-11-08)

**Applies to:** HopSkipInc/ai-fleet, HopSkipInc/analytics-infrastructure and
HopSkipInc/enrichment-pipeline — the three repos that carry the routing scripts.
HopSkipInc/infra-ops is included on install: the pending 2026-11-07 PDR-011 prompt installs
both scripts there, so it must install these versions rather than the ones that prompt names.
Recorded so the fourth repo is considered, not silent.
**Source:** repo-governance issue #152 — three defects observed when ai-fleet applied the
2026-11-07 PDR-011 prompt (HopSkipInc/ai-fleet#4683). Its first equivalence run reported 485
unresolved items, 81 of them false.
**Supersedes the script versions in the pending 2026-11-07 prompt:**
`scripts/check-issue-routing.mjs` **1.6.0 → 1.6.1** and
`scripts/check-routing-equivalence.mjs` **1.1.0 → 1.2.0**. The 11-07 prompt's instructions
and every other artifact version are unchanged.

## The problems these fix

**1. Epics counted as UNTIERED.** The equivalence check pushed every issue without an
`impl:` label into UNTIERED, including the epic shape policy §Mechanism 3 prescribes (a
child tier table, no single tier). On ai-fleet that was 43 false items and the check could
never reach zero. It now detects the epic shape exactly as `check-issue-routing.mjs`'s
`isEpicShape()` does — the `epic` label, or a child/tier row in the `## Impl tier` block —
and lists epics under their own EXEMPT heading.

**2. `impl:human` could never match.** The rule outputs `standard`/`frontier` only, and
human completion lives in the `gate:` family (PDR-011 decision 2). The script compared
`human` against the derived class, so all 38 human-tier issues were permanent differences.
An `impl:human` issue with any `gate:` label is now equivalent and the class comparison does
not apply; one with no `gate:` label is listed under **IMPL:HUMAN WITHOUT A GATE LABEL**, not
as a class difference.

**3. The routing lint read only 500 issues.** `LIMIT = 500` fed `gh issue list --limit 500`;
ai-fleet has 795 open issues, so R1–R12 never read the oldest 295 and nothing said so — a
check that fails open reading as evidence. The sweep now paginates the whole result set with
`gh api --paginate --slurp`, bounds the closed pass with `since`, and reports SKIPPED (exit 2)
rather than passing if the fetch fails.

## Steps

**1. Re-sync the two scripts, byte-identical**, into the path your CLAUDE.md's
Synced-templates table declares (that declaration is what `check-downstream-drift` verifies):

| Repo | Declared path (as of 2026-11-07) |
|---|---|
| HopSkipInc/ai-fleet | `scripts/check-issue-routing.mjs`, `scripts/check-routing-equivalence.mjs` |
| HopSkipInc/analytics-infrastructure | `scripts/check-issue-routing.mjs`, `scripts/check-routing-equivalence.mjs` on install |
| HopSkipInc/enrichment-pipeline | `scripts/check-issue-routing.mjs`, `scripts/check-routing-equivalence.mjs` on install |
| HopSkipInc/infra-ops | both on install |

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-issue-routing.mjs \
   <declared path>
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-routing-equivalence.mjs \
   <declared path>
```

If the 2026-11-07 prompt has not been applied yet, apply it with these two files at 1.6.1 /
1.2.0 where it says 1.6.0 / 1.1.0. If it has been applied, this is a two-file re-sync; do not
re-apply the rest of that prompt.

**2. Bump the Synced-templates rows** in your CLAUDE.md / AGENTS.md for both artifacts.

**3. Re-run the checks** (see below). The equivalence check is a gate: it still exits
non-zero until the real backlog work lands, but its unresolved count must drop by exactly
the false items and the surviving items must be real.

## Verification — observe the effect, not the installed file

```bash
node scripts/check-issue-routing.mjs          # first line must report every open issue
node scripts/check-routing-equivalence.mjs    # needs docs/agent-routing-records.md §8
```

On ai-fleet at the 2026-11-08 run the expected movement is:

- routing lint: **swept 795 open issues**, not 500 (new R1–R3 findings on the oldest 295
  are the fix working — triage them, do not narrow the lint);
- equivalence: UNTIERED **245 → 202**, the **43 epics** move to EXEMPT EPICS, the **38**
  `impl:human` issues split into **14 equivalent** (they carry a `gate:` label) and **24
  listed as needing one**;
- total unresolved **485 → 428** — the remaining 428 are the real untriaged/backfill work
  tracked by ai-fleet#4681, not script defects.

On the other repos the absolute numbers differ; the properties to check are the same: epics
are never in UNTIERED, no gate-carrying `impl:human` issue is a difference, and the sweep
count equals the repo's open issue count.

## Not done here, owed

- **The 24 ai-fleet `impl:human` issues with no `gate:` label** need one filed by an
  ai-fleet session (the family is `gate:decision`, `gate:human-review`,
  `gate:human-approval`, `gate:credentials`). repo-governance must not write there.
- **The backfill itself** (risk labels on the remaining frontier issues, tiers on the
  untriaged backlog) is ai-fleet#4681, unchanged by this prompt.
