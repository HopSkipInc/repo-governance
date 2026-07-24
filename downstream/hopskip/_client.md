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
| HopSkipInc/ai-fleet | [2026-07-23 two-phase audit lifecycle](ai-fleet/2026-07-23-two-phase-audit-lifecycle.md) | pending |
| HopSkipInc/analytics-infrastructure | [2026-07-23 two-phase audit lifecycle](analytics-infrastructure/2026-07-23-two-phase-audit-lifecycle.md) | pending |
| HopSkipInc/enrichment-pipeline | [2026-07-23 two-phase audit lifecycle](enrichment-pipeline/2026-07-23-two-phase-audit-lifecycle.md) | applied 2026-07-24 |
| HopSkipInc/ai-fleet | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | partial — first run 2026-07-24 under policy 1.0.0 (17 issues, epic #1339). **Re-sync backfill owed:** `both` kind, general-backlog re-baseline, provisional calibration marking, validator rules |
| HopSkipInc/analytics-infrastructure | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | partial — first run 2026-07-24 under policy 1.0.0/1.1.0 (~24 issues, ~75% single epic → spec ratio sample-limited). **Re-sync backfill owed** + GLM-5.2 calibration run queued (`docs/experiments/2026-07-24-glm-routing-calibration.md`) |
| HopSkipInc/enrichment-pipeline | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | applied 2026-07-24 — setup only (policy v1.6.0, skill, classifier agent, labels, validator, CLAUDE.md block); triage run pending frontier model session |

Prompts are dated files in each repo's subdirectory. Run them in the respective repo's Claude Code context. Update status to `applied YYYY-MM-DD` once run, or `partial — <note>` if only some steps landed.
