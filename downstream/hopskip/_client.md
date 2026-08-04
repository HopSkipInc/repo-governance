# Client: Hopskip (internal)

**Owner:** Greg Leizerowicz
**Engagement type:** Internal — reference implementation portfolio
**Governance start:** 2026-05

## Governed repos

| Repo | Local path | Governance since | Maturity | Notes |
|---|---|---|---|---|
| HopSkipInc/ai-fleet | `~/repos/HopSkipInc/ai-fleet` | 2026-05 | High — 8+ audit cycles, governance-health live | Primary reference implementation; source for most template improvements |
| HopSkipInc/analytics-infrastructure | `~/repos/HopSkipInc/analytics-infrastructure` | 2026-06 | Early — inaugural audit done, code-hygiene not yet wired | Recent adopter; surface onboarding friction as a template signal |
| HopSkipInc/enrichment-pipeline | `~/repos/HopSkipInc/enrichment-pipeline` | 2026-06 | Early-mid — first audit cycle done | Code-hygiene / slop-detection most complete here; reference for that artifact class |
| HopSkipInc/infra-ops | `~/repos/HopSkipInc/infra-ops` | 2026-08 | Bootstrap — **class: core** | First `core`-class adopter (PDR-009 dogfood; falsifier revisit 2026-11-03). Solo-maintained IaC; deploy gates already exceed the full framework's machinery |

## Routing ratio targets

Per-repo, per `templates/agent-routing.md` §*The frontier ratio and what it measures*. The
target is a **decomposition** metric — escalations as a share of tiered issues — and it moves
by splitting, not by relabeling. The inherent *population* is a different number and is not
targeted here.

Ramp: bootstrap (runs 1–2) records a baseline and targets nothing; adopting repos target
**≤ 20%**; mature repos target **≤ 10%**. Move a repo to the next stage only after it holds
the current one across two audit cycles.

| Repo | Baseline (date) | Stage | Target | Latest reading | Decomposition record |
|---|---|---|---|---|---|
| HopSkipInc/ai-fleet | 63% — 10/16 tiered open issues, 2026-07-26 | Adopting | ≤ 20% | 63% (2026-07-26) | 0 split, 0 declared, 10 undeclared |
| HopSkipInc/analytics-infrastructure | 85% — 23/27 tiered open issues, 2026-07-26 | Bootstrap | record only | 85% (2026-07-26) | 0 split, 0 declared, 23 undeclared |
| HopSkipInc/enrichment-pipeline | not yet triaged | Bootstrap | record only | — | — |

Readings come from `check-issue-routing.mjs` (v1.1.0+), which prints the census directly:

```bash
ROUTING_REPO=<owner>/<repo> node scripts/check-issue-routing.mjs
```

**Notes on the 2026-07-26 baseline.** All three readings predate the decomposition rule
(policy v1.8.0) and are therefore the *pre-rule* baseline — the number the rule exists to
move. Two splits are known to have happened in ai-fleet (#1346 from #1255, #1347 from #1256)
and the census reports zero, because the parents' tier lines were never edited to record
them. That gap is the reason the record is now part of the tier line rather than tribal
knowledge: a split nobody wrote down is invisible to every downstream measurement.

analytics-infrastructure stays at *bootstrap* despite having the higher number: ~22 of its 23
escalations belong to a single gateway epic scoped by component, so its ratio is measuring
issue granularity in one epic rather than the repo. Re-baseline it after that epic is
decomposed, then set a target.

## Maintenance Log

| Repo | Prompt | Status |
|---|---|---|
| HopSkipInc/enrichment-pipeline | [2026-06-15](enrichment-pipeline/2026-06-15-maintenance.md) | applied 2026-06-15 |
| HopSkipInc/analytics-infrastructure | [2026-06-15](analytics-infrastructure/2026-06-15-maintenance.md) | applied 2026-06-15 |
| HopSkipInc/ai-fleet | [2026-06-15](ai-fleet/2026-06-15-maintenance.md) | applied 2026-06-15 |
| HopSkipInc/enrichment-pipeline | [2026-06-15 db-squash](enrichment-pipeline/2026-06-15-db-squash.md) | applied 2026-06-15 |
| HopSkipInc/ai-fleet | [2026-06-15 db-dbup-migration](ai-fleet/2026-06-15-db-dbup-migration.md) | applied 2026-07-06 — step 8 (doc-sync) added retroactively 2026-07-16; verified no-op (no stale pre-DbUp docs) |
| HopSkipInc/analytics-infrastructure | [2026-06-15 db-dbup-migration](analytics-infrastructure/2026-06-15-db-dbup-migration.md) | applied 2026-07-05 — step 7 (doc-sync) missing from original; retroactively added 2026-07-16 after doc-drift caused stuck migrations |
| HopSkipInc/analytics-infrastructure | [2026-06-18 adr-lint + audit prep](analytics-infrastructure/2026-06-18-adr-lint-and-audit-prep.md) | applied 2026-07-03 |
| HopSkipInc/analytics-infrastructure | [2026-07-05 watch-items sweep](analytics-infrastructure/2026-07-05-watch-items-sweep.md) | applied 2026-07-06 |
| HopSkipInc/enrichment-pipeline | [2026-07-05 watch-items sweep](enrichment-pipeline/2026-07-05-watch-items-sweep.md) | applied 2026-07-06 |
| HopSkipInc/ai-fleet | [2026-07-06 migrate to generic watch-items](ai-fleet/2026-07-06-migrate-watch-items.md) | applied 2026-07-06 |
| HopSkipInc/ai-fleet | [2026-07-07 governance sync CLAUDE.md section](2026-07-07-governance-sync-claude-section.md) | applied 2026-07-07 — bug: step 5 writes to repo-governance; fix pending below |
| HopSkipInc/analytics-infrastructure | [2026-07-07 governance sync CLAUDE.md section](2026-07-07-governance-sync-claude-section.md) | applied 2026-07-07 — bug: step 5 writes to repo-governance; fix pending below |
| HopSkipInc/enrichment-pipeline | [2026-07-07 governance sync CLAUDE.md section](2026-07-07-governance-sync-claude-section.md) | applied 2026-07-07 — bug: step 5 writes to repo-governance; fix pending below |
| HopSkipInc/ai-fleet | [2026-07-07 fix governance sync ownership](2026-07-07-fix-governance-sync-ownership.md) | applied 2026-07-07 |
| HopSkipInc/analytics-infrastructure | [2026-07-07 fix governance sync ownership](2026-07-07-fix-governance-sync-ownership.md) | applied 2026-07-07 |
| HopSkipInc/enrichment-pipeline | [2026-07-07 fix governance sync ownership](2026-07-07-fix-governance-sync-ownership.md) | applied 2026-07-07 |
| HopSkipInc/ai-fleet | [2026-07-07 competitive-analysis skill](2026-07-07-competitive-analysis-skill.md) | applied 2026-07-07 |
| HopSkipInc/analytics-infrastructure | [2026-07-07 competitive-analysis skill](2026-07-07-competitive-analysis-skill.md) | applied 2026-07-07 |
| HopSkipInc/enrichment-pipeline | [2026-07-07 competitive-analysis skill](2026-07-07-competitive-analysis-skill.md) | applied 2026-07-07 |
| HopSkipInc/ai-fleet | [2026-07-23 two-phase audit lifecycle](ai-fleet/2026-07-23-two-phase-audit-lifecycle.md) | applied 2026-07-27 — added docs/personas.md, updated DoD Audit section (two-phase lifecycle + close-out reframed), added "Audit remediation" work type to DoD and PR template, migration 0358 updates audit-fleet PR body text |
| HopSkipInc/analytics-infrastructure | [2026-07-23 two-phase audit lifecycle](analytics-infrastructure/2026-07-23-two-phase-audit-lifecycle.md) | pending |
| HopSkipInc/enrichment-pipeline | [2026-07-23 two-phase audit lifecycle](enrichment-pipeline/2026-07-23-two-phase-audit-lifecycle.md) | applied 2026-07-24 |
| HopSkipInc/ai-fleet | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | partial (re-sync 2026-07-27) — policy updated to 1.9.0, records split to docs/agent-routing-records.md, skill/classifiers/validator reinstalled, labels completed, calibration set candidates identified. **Triage backfill owed:** `both` reclassification (#1215, #1344), decomposition records on all 9 escalations, general-backlog re-baseline, provisional calibration set confirmation — all require a frontier-model session (classifier pins to claude-opus-5). |
| HopSkipInc/analytics-infrastructure | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | partial — first run 2026-07-24 under policy 1.0.0/1.1.0 (~24 issues, ~75% single epic → spec ratio sample-limited). **Re-sync backfill owed** + GLM-5.2 calibration run queued (`docs/experiments/2026-07-24-glm-routing-calibration.md`) |
| HopSkipInc/enrichment-pipeline | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | applied 2026-07-24 — setup only (policy v1.6.0, skill, classifier agent, labels, validator, CLAUDE.md block); triage run pending frontier model session |
| HopSkipInc/ai-fleet | [2026-07-27 quality + coverage layers](2026-07-27-quality-coverage-layers.md) | pending |
| HopSkipInc/analytics-infrastructure | [2026-07-27 quality + coverage layers](2026-07-27-quality-coverage-layers.md) | pending |
| HopSkipInc/enrichment-pipeline | [2026-07-27 quality + coverage layers](2026-07-27-quality-coverage-layers.md) | pending |
| HopSkipInc/ai-fleet | [2026-08-02 Synced-declarations reconciliation](ai-fleet/2026-08-02-synced-declarations.md) | pending — dialect rewrite + 2 rows to Adapted note + inline stamp |
| HopSkipInc/analytics-infrastructure | [2026-08-02 Synced-declarations reconciliation](analytics-infrastructure/2026-08-02-synced-declarations.md) | pending — version-cell hygiene + inline stamp |
| HopSkipInc/enrichment-pipeline | [2026-08-02 Synced-declarations reconciliation](enrichment-pipeline/2026-08-02-synced-declarations.md) | pending — dialect rewrite + section inline stamp |
| HopSkipInc/infra-ops | [2026-08-03 core onboarding](infra-ops/2026-08-03-core-onboarding.md) | pending — first `core`-class adoption (PDR-009); also carries the governance-sync section bump to v1.3.1 for the other three repos via the sync ritual |

The 2026-08-02 prompts come from the downstream-drift disposition (#14): the corrected
lint's surviving findings were 13 BEHIND (all already carried by the pending 2026-07-27
prompt — no duplicate generated) and 3 NOSTAMP (reconciled here: ai-fleet's two files
are adapted, owner's call; enrichment's section gets the inline stamp). The canonical
first-column dialect — repo-relative installed paths — is named in
`templates/governance-sync-claude-section.md` v1.2.0.

The 2026-07-27 prompt also carries the routing re-sync to policy 1.10.0 (the coverage lever).
A repo doing both at once should do the coverage interview **before** backfilling R8 records —
the records are read out of `docs/testing-strategy.md` §2/§6, and backfilling first means
guessing at coverage, which is the thing the lever exists to stop.

Prompts are dated files in each repo's subdirectory. Run them in the respective
repo's Claude Code context. The downstream agent records the outcome in its own
CLAUDE.md under `### Applied governance updates` and never writes here. The status
column above is updated only in this repo, during the governance sync — `/review-sync`
Step 5.0 verifies each `pending`/`partial` row against the client checkout and marks
it `applied YYYY-MM-DD` or `partial — <note>`.
