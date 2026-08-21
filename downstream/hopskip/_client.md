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

## Doorbell estate (Azure DevOps)

Fifteen product repos — 14 .NET 6 in-process Azure Function Apps plus the legacy
`browser-app` front end — live in Azure DevOps at `dev.azure.com/saratogasandboxes/Doorbell`,
alongside `PlatformLibraries`, the shared package repo every service floats on at `1.0.*`
(16 pipelines total; only `EventSubscriptionService` and `ImportExportService` run a test
step). The current front end, `browser-app-v2`, is GitHub-hosted
(`~/repos/HopSkipInc/browser-app-v2`) — the mechanical layer works there unported and it
does not queue behind the AzDO port.

Platform deltas, recorded once here instead of per repo: **no GitHub Actions** (the audit
loop is unported — plan Phase 4(b)), **no repo-scoped backlog key** (969 open work items
keyed by vendor/team area paths — Phase 4(c)). SourcingService additionally has **no
SQL/migrations and no TypeScript**, which excludes those template families outright.

**Pilot: SourcingService at `full` class** — bootstrap
[2026-08-10](SourcingService/2026-08-10-bootstrap.md). The pilot's purpose is to separate
per-repo cost from the one-time estate cost; adoption class for the remaining repos is
deferred until that cost is measured. Plan of record:
`~/.claude/plans/twinkling-mapping-acorn.md`.

| Repo | Local path | Governance since | Maturity | Notes |
|---|---|---|---|---|
| SourcingService | `~/repos/Doorbell/SourcingService` | 2026-08-10 | Bootstrap — **class: full** | **Pilot.** Cosmos + Service Bus + Blob, no SQL; 96 HTTP triggers; suite exists but runs in CI nowhere |
| PlatformLibraries | `~/repos/Doorbell/PlatformLibraries` | — | Ungoverned | The fan-in — `HopSkip.*` packages at floating `1.0.*`; no CLAUDE.md at all. Highest-leverage second target, not the biggest one |
| ImportExportService | `~/repos/Doorbell/ImportExportService` | — | Ungoverned | House reference CLAUDE.md (120 lines); one of two repos with a CI test step |
| ReportService | `~/repos/Doorbell/ReportService` | — | Ungoverned | Substantial CLAUDE.md (112 lines) — cheap Phase 5 adopter |
| MVP | `~/repos/Doorbell/MVP` | — | Ungoverned | Substantial CLAUDE.md (110 lines) — cheap Phase 5 adopter |
| NotificationService | `~/repos/Doorbell/NotificationService` | — | Ungoverned | Substantial CLAUDE.md (89 lines) — cheap Phase 5 adopter |
| EventSubscriptionService | `~/repos/Doorbell/EventSubscriptionService` | — | Ungoverned | CLAUDE.md (58 lines); the other repo with a CI test step |
| AIService | `~/repos/Doorbell/AIService` | — | Ungoverned | |
| AnalyticsService | `~/repos/Doorbell/AnalyticsService` | — | Ungoverned | |
| ContractService | `~/repos/Doorbell/ContractService` | — | Ungoverned | |
| DocumentService | `~/repos/Doorbell/DocumentService` | — | Ungoverned | |
| MessagingService | `~/repos/Doorbell/MessagingService` | — | Ungoverned | |
| PlatformService | `~/repos/Doorbell/PlatformService` | — | Ungoverned | |
| PromotionService | `~/repos/Doorbell/PromotionService` | — | Ungoverned | |
| SellingService | `~/repos/Doorbell/SellingService` | — | Ungoverned | |
| browser-app | `~/repos/Doorbell/browser-app` | — | Ungoverned | Legacy AzDO front end; current front end is `browser-app-v2` on GitHub |

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
| HopSkipInc/analytics-infrastructure | [2026-07-23 two-phase audit lifecycle](analytics-infrastructure/2026-07-23-two-phase-audit-lifecycle.md) | applied 2026-07-24 — verified 2026-08-04 against all six prompt outcomes (personas doc, DoD two-phase lifecycle + remediation-session gate, Audit remediation work type in DoD and PR template) |
| HopSkipInc/enrichment-pipeline | [2026-07-23 two-phase audit lifecycle](enrichment-pipeline/2026-07-23-two-phase-audit-lifecycle.md) | applied 2026-07-24 |
| HopSkipInc/ai-fleet | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | partial (re-sync 2026-07-27) — policy updated to 1.9.0, records split to docs/agent-routing-records.md, skill/classifiers/validator reinstalled, labels completed, calibration set candidates identified. **Triage backfill owed:** `both` reclassification (#1215, #1344), decomposition records on all 9 escalations, general-backlog re-baseline, provisional calibration set confirmation — all require a frontier-model session (classifier pins to claude-opus-5). |
| HopSkipInc/analytics-infrastructure | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | partial — first run 2026-07-24 under policy 1.0.0/1.1.0 (~24 issues, ~75% single epic → spec ratio sample-limited). **Re-sync backfill owed** + GLM-5.2 calibration run queued (`docs/experiments/2026-07-24-glm-routing-calibration.md`) |
| HopSkipInc/enrichment-pipeline | [2026-07-24 agent routing](2026-07-24-agent-routing.md) | applied 2026-07-24 — setup only (policy v1.6.0, skill, classifier agent, labels, validator, CLAUDE.md block); triage run 2026-07-27 under policy v1.9.0 — all 16 open issues tiered, bootstrap baseline 88% escalation (no target) |
| HopSkipInc/ai-fleet | [2026-07-27 quality + coverage layers](2026-07-27-quality-coverage-layers.md) | partial 2026-08-04 — mechanical prep only: blank records forms installed (`docs/code-conventions.md` 1.0.0, `docs/testing-strategy.md` 1.0.0), interview skills installed, routing re-synced (policy 1.10.0, triage 1.6.1, lint 1.2.0). Queued for a human-in-room session: the two interviews, DoD rows (deliberately deferred — a coverage-floor checkbox against a blank §1 is unenforceable), audit domain-8 port into the in-platform audit machine, coverage backfill (frontier model) |
| HopSkipInc/analytics-infrastructure | [2026-07-27 quality + coverage layers](2026-07-27-quality-coverage-layers.md) | applied 2026-08-04 — records filled via interviews with a human in the room; first coverage measurement ever, per-project floors wired as a required gate (`check-coverage-floor.py`); routing re-synced 1.10.0/1.6.1/1.2.0; R8 backfill done (census 0 unrecorded); audit domain-8 port filed as ai-fleet #1572 |
| HopSkipInc/enrichment-pipeline | [2026-07-27 quality + coverage layers](2026-07-27-quality-coverage-layers.md) | applied 2026-08-02 — records bootstrapped via both interviews; DoD updated; routing re-synced 1.10.0/1.6.0/1.2.0/1.2.0; new CI gates (HTTP-auth lint, axios eslint ban, prettier, .NET coverage floor) + quality.yml repair (found disabled ~11 months; suite green 115/115 and re-gated); false-greens dispositioned; R8 backfill done; domain 8 ported via ai-fleet migration 0375; gaps filed #455–#462 |
| HopSkipInc/ai-fleet | [2026-08-02 Synced-declarations reconciliation](ai-fleet/2026-08-02-synced-declarations.md) | applied 2026-08-04 — first column rewritten repo-relative; definition-of-done + issue-authoring + personas moved to Adapted note; inline stamp added (v1.2.0 — v1.3.1 bump still owed via the sync ritual) |
| HopSkipInc/analytics-infrastructure | [2026-08-02 Synced-declarations reconciliation](analytics-infrastructure/2026-08-02-synced-declarations.md) | applied 2026-08-04 — version-cell hygiene done (deviation note preserved outside the cell); inline stamp added at v1.3.1 (section bump carried early); personas row to Adapted |
| HopSkipInc/enrichment-pipeline | [2026-08-02 Synced-declarations reconciliation](enrichment-pipeline/2026-08-02-synced-declarations.md) | applied 2026-08-02 — first column rewritten repo-relative; inline stamp added (v1.2.0 — v1.3.1 bump still owed via the sync ritual); org-transfer paths updated |
| HopSkipInc/infra-ops | [2026-08-03 core onboarding](infra-ops/2026-08-03-core-onboarding.md) | applied 2026-08-03 — first `core`-class adoption live (PDR-009 falsifier clock running; revisit 2026-11-03). The v1.3.1 section bump this prompt carries for the other three repos: analytics done 2026-08-04; ai-fleet + enrichment still owed via the sync ritual |
| HopSkipInc/ai-fleet | [2026-08-05 agent-routing v1.11.0 + fleet dispatch contract](ai-fleet/2026-08-05-agent-routing-v1-11-0.md) | applied 2026-08-05 (ai-fleet PR #1653) — sync half as written (policy 1.11.0 byte-identical, delegation paragraph, governance section v1.2.0 → v1.3.1, which clears the bump owed above). Enforcement half applied with three deviations, and **this prompt has been corrected in place** so it is not re-applied as originally written: (1) step 6 named `runtime/templates/base/`, which is dead code in that repo — and its verification line grepped that same dead path, so applying it as written passed verification with zero behaviour change; the block went to `docs/fleet-worker-doctrine.md` §8, the live worker prompt; (2) consequently the "no schema changes" claim was wrong — the correct home ships a migration; (3) step 6's "never … push" bullet contradicted that doctrine's §4/§7, which tell workers to push the branch and open the PR (they must not *merge*); and step 5 named only `spawn_fleet`, missing `dispatch_fleet`, the in-platform surface. Follow-up structural-fence issue filed as ai-fleet #1652. Generalized lesson added to this repo's CLAUDE.md gotchas. Separately, applying step 6 in its real home surfaced a latent prod-breaking defect in ai-fleet's prompt generator (FK violation on the migration's UPDATE branch, invisible to every from-scratch gate) — fixed with a regression test in the same PR |
| HopSkipInc/analytics-infrastructure | [2026-08-07 routing v1.11.0 re-sync](2026-08-07-routing-v1-11-0-resync.md) | applied 2026-08-10 — policy 1.10.0 → 1.11.0 byte-identical (`diff -q` clean), "Delegating is dispatching" paragraph added, synced-templates row bumped. *Row reconciled 2026-08-14 from the client checkout's applied-list; it had stood at `pending` since the work landed* |
| HopSkipInc/enrichment-pipeline | [2026-08-07 routing v1.11.0 re-sync](2026-08-07-routing-v1-11-0-resync.md) | pending — policy re-sync (steps 1–3) plus governance section v1.3.1 re-install and routing-triage 1.6.1 |
| HopSkipInc/ai-fleet | [2026-08-09 system maps: in-session regeneration](2026-08-09-graphify-local-regen.md) | pending — supersedes the deadlocked 2026-08-07 CI commit-back prompt; do NOT install the v1 workflow. Fleet workers ingest this repo's CLAUDE.md natively, but the worker image needs uv first (ai-fleet #1740). Prompt corrected in place 2026-08-10 (#72 step-5 warm-up, #75 graphifyy[sql] pin) — apply the corrected text |
| HopSkipInc/analytics-infrastructure | [2026-08-09 system maps: in-session regeneration](2026-08-09-graphify-local-regen.md) | applied 2026-08-10, **twice** — first pass pre-correction (policy v2.0.0; 3,354 nodes / 7,549 edges / 200 communities), then the same-day corrected pass (policy v2.1.0, `graphifyy[sql]==0.9.35`; 4,094 nodes / 8,016 edges / 472 communities, **498 SQL file-level nodes** — the 272-file corpus entering the map). **Field note owed upstream:** a pin/extra change does NOT invalidate the incremental manifest — a plain re-run reported `579 files cached/unchanged` and silently rewrote the *old* no-SQL graph (deleting `graphify-out/cache/` did not help; `manifest.json` is the gate). `graphify extract . --code-only --force` is the required move on a pin change; the corrected prompt's warm-up assumes a first install. *Row reconciled 2026-08-14 from the client checkout* |
| HopSkipInc/enrichment-pipeline | [2026-08-09 system maps: in-session regeneration](2026-08-09-graphify-local-regen.md) | pending — supersedes 2026-08-07, whose install deadlocked at commit-back (PRs #474/#475); v1 workflow already disabled, `graphify-out/` absent. Apply from step 0. Prompt corrected in place 2026-08-10 (#72 — this repo filed it, #75) |
| HopSkipInc/infra-ops | [2026-08-09 system maps: in-session regeneration](2026-08-09-graphify-local-regen.md) | pending — supersedes 2026-08-07 (core class); the [runtime-edge-collector](infra-ops/2026-08-07-runtime-edge-collector.md) design-first prompt rides with it. Prompt corrected in place 2026-08-10 (#72, #75); zero `.sql` files here, so the [sql] pin is a no-op for this repo — apply anyway, one-pin estate |
| HopSkipInc/ai-fleet | [2026-08-08 enforcement stanzas](2026-08-08-enforcement-stanzas.md) | pending — stanza pair + assertion lint in one PR; **merge** into existing `.claude/settings.json` (hooks-only today); records paths at **ask** (daily paired records work), secrets at deny; lint home is `host/scripts/`, wired into `run-tests.yml` |
| HopSkipInc/analytics-infrastructure | [2026-08-08 enforcement stanzas](2026-08-08-enforcement-stanzas.md) | applied 2026-08-10 — both configs created fresh; records mode `deny`; register at `docs/enforcement-stanzas-register.md` (2 harnesses, 4 records paths, 1 paragraph exemption); lint `check-enforcement-stanzas.mjs` v1.0.1 byte-identical, wired into `code-hygiene.yml`'s clutter gate. **This install is where step 2's stamp instruction was caught producing an inert stanza** — the `//` comment voided all 10 deny rules for a day with CI green (PR #437 → fix #449), which became the 2026-08-11 prompt below. *Row reconciled 2026-08-14 from the client checkout* |
| HopSkipInc/enrichment-pipeline | [2026-08-08 enforcement stanzas](2026-08-08-enforcement-stanzas.md) | pending — stanza pair + lint; **append** to the existing 13-rule `permissions.deny`, never replace (Bash-deny survival assertion in the prompt); ADRs live at root `adr/`; `tools/` + `code-hygiene.yml`. Apply after the 2026-08-07 re-sync (both touch CLAUDE.md) |
| HopSkipInc/infra-ops | [2026-08-08 enforcement stanzas](2026-08-08-enforcement-stanzas.md) | pending — stanza pair + lint; records census is `docs/adr/` only; `scripts/` + `ci.yml` governance job |
| HopSkipInc/ai-fleet | [2026-08-09 closing contract](2026-08-09-closing-contract.md) | pending — section into CLAUDE.md **and** AGENTS.md (both live there: fleet workers + Claude Code read CLAUDE.md, opencode reads AGENTS.md); one declaration row covers both |
| HopSkipInc/analytics-infrastructure | [2026-08-09 closing contract](2026-08-09-closing-contract.md) | applied 2026-08-10 — section installed at the end of CLAUDE.md (stamp `closing-contract.md v1.0.0`); no repo `AGENTS.md` exists to duplicate into (the global `~/.config/opencode/AGENTS.md` carries its own copy); declaration row added. *Row reconciled 2026-08-14 from the client checkout* |
| HopSkipInc/enrichment-pipeline | [2026-08-09 closing contract](2026-08-09-closing-contract.md) | pending — CLAUDE.md section + declaration row; touches CLAUDE.md like the pending 08-07 re-sync and 08-08 stanzas — one CLAUDE.md pass can take all three |
| HopSkipInc/infra-ops | [2026-08-09 closing contract](2026-08-09-closing-contract.md) | pending — CLAUDE.md section + declaration row (core class) |
| HopSkipInc/analytics-infrastructure | [2026-08-11 harness stamp strict JSON](2026-08-11-harness-stamp-strict-json.md) | applied retroactively 2026-08-10, **recorded 2026-08-14** — this repo is where the defect was found and fixed (PR #449) *before* the prompt existed, so the substance predates its own prompt. Only step 4 (version bump) was outstanding; it rode the 2026-08-13 sync below. Recorded because the applied-list silence made a fixed defect look pending |
| HopSkipInc/enrichment-pipeline | [2026-08-11 harness stamp strict JSON](2026-08-11-harness-stamp-strict-json.md) | pending — step 4 only (version bump + step-5 verify); this repo had already installed the `_governance_install` key form and was never inert |
| HopSkipInc/ai-fleet | [2026-08-11 harness stamp strict JSON](2026-08-11-harness-stamp-strict-json.md) | pending — no stanza installed yet (`.claude/settings.json` is `hooks`-only, no `permissions` key); install per 08-08 using **this** prompt's stamp form, not 08-08 step 2 as written |
| HopSkipInc/infra-ops | [2026-08-11 harness stamp strict JSON](2026-08-11-harness-stamp-strict-json.md) | pending — `.claude/settings.json` absent; install per 08-08 using **this** prompt's stamp form (core class) |
| HopSkipInc/analytics-infrastructure | [2026-08-13 mediated record writes](2026-08-13-mediated-record-writes.md) | applied 2026-08-14 — `scripts/write-record.mjs` v1.0.0 + `check-enforcement-stanzas.mjs` v1.0.1 → v1.2.0 both byte-identical; `## Mediated write paths` registered (ADR corpus only, no PDR corpus); CLAUDE.md write-path paragraph; stamps to v1.2.0 / v1.1.0, no rule changes. Lint green reporting `1 mediated write path(s)`; scratch-repo demo confirmed `create` publishes and `amend` refuses a changed H1. **Local drift found, not fixed here:** the script looks for `check-adr-readme-sync.mjs` as the post-write index gate; this repo names that lint `lint-adr-readme-sync.mjs` (repo-governance and ai-fleet both use `check-`), so `create` emits a spurious `UNGUARDED` and skips the post-write run — the CI gate itself is intact in `code-hygiene.yml`. Renaming touches a gate reference and belongs in its own PR. **Also owed upstream:** `templates/harness-enforcement.md`'s inline JSON example stamps `v1.1.0 · updated 2026-08-11` while the template header stamps v1.2.0 — step 4's value was followed over the example |
| HopSkipInc/ai-fleet | [2026-08-13 mediated record writes](2026-08-13-mediated-record-writes.md) | pending — **sequencing: 08-08 + 08-11 first** (no binding stanza yet). Lint home `host/scripts/`; two corpora to register (`docs/adr/`, `docs/pdr/`); records mode here is `ask`, which headless/fleet runs auto-reject — this repo is the one the script most unblocks |
| HopSkipInc/enrichment-pipeline | [2026-08-13 mediated record writes](2026-08-13-mediated-record-writes.md) | pending — **sequencing: 08-08 + 08-11 first**. Lint home `tools/`; corpora are root `adr/` and `docs/pdr/` (the script discovers root `adr/` itself — the prompt's table is a census check, not config) |
| HopSkipInc/infra-ops | [2026-08-13 mediated record writes](2026-08-13-mediated-record-writes.md) | pending — **sequencing: 08-08 + 08-11 first**. Lint home `scripts/`; `docs/adr/` only (core class, ADRs-only records census) |
| HopSkipInc/ai-fleet | [2026-08-14 routing kind enforcement](2026-08-14-routing-kind-enforcement.md) | pending — **apply here first** (PDR-010 Consequences 4). Upstream ships in the same PR: `check-issue-routing.mjs` 1.4.0 (closed pass; cumulative — subsumes the pending 08-17 validator 1.3.0 install) + `agent-routing.md` 1.14.0. Step-1 grep confirms the lint is dead (verified 2026-08-14: repo-root `scripts/`, invoked by no workflow and no npm script); install 1.4.0, **fix-or-grandfather existing open-backlog findings before the gate goes blocking**, wire the open pass as a gate and the closed pass as a **probe** (ADR-026), extend `check-lint-ci-coverage.mjs` past `host/scripts/`, record the kind-coverage baseline. No retroactive kind backfill — the calibration protocol forbids post-hoc classification |
| HopSkipInc/analytics-infrastructure | [2026-08-14 routing kind enforcement](2026-08-14-routing-kind-enforcement.md) | pending — **step-1 grep is free and runnable now**; full apply waits on ai-fleet completing one closed-pass cycle (PDR-010 Consequences 4); the 1.4.0 install then subsumes the pending 08-17 validator 1.3.0 (same script) |
| HopSkipInc/enrichment-pipeline | [2026-08-14 routing kind enforcement](2026-08-14-routing-kind-enforcement.md) | pending — **step-1 grep is free and runnable now**; full apply waits on ai-fleet completing one closed-pass cycle (PDR-010 Consequences 4); the 1.4.0 install then subsumes the pending 08-17 validator 1.3.0 (same script) |
| HopSkipInc/infra-ops | [2026-08-14 routing kind enforcement](2026-08-14-routing-kind-enforcement.md) | n/a expected — routing layer never adopted (core class), per the 2026-08-17 validator-fixes record; the step-1 grep costs one line if that record is ever doubted |
| Doorbell/SourcingService | [2026-08-10 bootstrap](SourcingService/2026-08-10-bootstrap.md) | pending — estate pilot, class: full; AzDO platform deltas recorded in the prompt and in the Doorbell subsection above |
| HopSkipInc/ai-fleet | [2026-08-17 routing validator fixes](2026-08-17-routing-validator-fixes.md) | pending — validator v1.2.0 → v1.3.0 + routing-triage 1.6.1 → 1.7.0 into the declared paths; this repo originated all three defects, so expect new R8 warnings on its #1306/#1167/#1294/#762-shaped tier lines (remediate with `Coverage gap: #N`, never by narrowing the lint). Owed on the ai-fleet side after the upstream PR merges: flip the three outbox rows to delivered with the PR reference |
| HopSkipInc/analytics-infrastructure | [2026-08-17 routing validator fixes](2026-08-17-routing-validator-fixes.md) | pending — validator v1.2.0 → v1.3.0 + routing-triage 1.6.1 → 1.7.0, both byte-identical into the declared paths; policy re-sync (1.11.0 → 1.13.0) is separately owed via the sync ritual, not this prompt |
| HopSkipInc/enrichment-pipeline | [2026-08-17 routing validator fixes](2026-08-17-routing-validator-fixes.md) | pending — validator v1.2.0 → v1.3.0 + routing-triage 1.6.1 → 1.7.0; supersedes the skill version in the pending 08-07 row (1.6.1) — one skill install takes both |
| HopSkipInc/infra-ops | [2026-08-17 routing validator fixes](2026-08-17-routing-validator-fixes.md) | n/a — routing layer never adopted (core class); no validator or skill installed to re-sync. Recorded so the omission is considered, not silent |
| HopSkipInc/ai-fleet | [2026-08-21 backlog grooming regime](ai-fleet/2026-08-21-backlog-grooming-regime.md) | pending — requests two new templates (`check-backlog-currency.mjs`, `backlog-groom` skill) rather than installing any; ai-fleet is pilot and reporting repo. Carries a self-test that must flag the 2026-08-20 incident's own issues. Estimation column is contract-only per PDR-010 (templates ship a contract, never an implementation) and stays deferred until telemetry coverage moves off ~15% (agent-routing-records.md, 2026-08-17) |

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
