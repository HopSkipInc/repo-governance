# Governance Bootstrap — SourcingService (Doorbell, Azure DevOps) — 2026-08-10

**Pilot for the Doorbell estate.** Plan of record:
`~/.claude/plans/twinkling-mapping-acorn.md` (approved 2026-08-10). The pilot exists to
separate per-repo cost from the one-time estate cost — **do not pay estate costs
(Phase 4) inside this repo.** Adoption class: `full`, so the pilot exercises the
expensive half.

Paste the prompt below the rule into Claude Code in `~/repos/Doorbell/SourcingService`.
Phases 1–2 run agent-led with light review. **Phase 3 needs a human in the room** — the
records interviews cannot be produced by an agent working alone.

---

# Governance Analysis — SourcingService

**Target:** `~/repos/Doorbell/SourcingService`  **Analyzed:** 2026-08-10  **Focus:** estate pilot — full-class bootstrap on Azure DevOps

## Repo snapshot

| Dimension | Signal |
|---|---|
| Stack | .NET 6, Azure Functions v4 **in-process** (`Microsoft.NET.Sdk.Functions` 4.6.0); xUnit + Moq + coverlet.collector 3.1.2; ARM JSON under `infrastructure/` |
| CI | **Azure DevOps** `pipelines/ci-build.yml` (branch `main`) — NuGetAuthenticate + restore + build + archive; **`!**/*test*.csproj` excluded from restore and build; no test task** |
| ADRs | none — Phase 3 seeds the corpus |
| DB presence | no SQL — Cosmos DB (245 refs / 102 files), Service Bus (128 refs), Blob (22 refs); zero migration surface |
| Monorepo | no — `functions/` + `tests/` + `infrastructure/` |
| Agent tooling | `CLAUDE.md` is a one-line stub; `.claude/` holds one tracked QA scratch file |
| Trigger surface | 96 HTTP + 7 ServiceBus + 2 Timer triggers; 106 source `.cs` files vs 12 real test classes |
| Platform deps | `HopSkip.Authentication` / `HopSkip.Models` / `HopSkip.Services` at **floating `1.0.*`** from the private `HopSkipPlatform` feed |

## Hand corrections (the probe is GitHub-native)

`/analyze-repo`'s mechanical probes mis-score this platform. Corrections applied:

1. **CI detection** — the probe globs `.github/workflows/*.yml`, which does not exist
   here. CI was scored by reading `pipelines/ci-build.yml` directly.
2. **PR template** — the probe checks `.github/pull_request_template.md` and would
   report ABSENT. Corrected to PRESENT: `docs/pull_request_template.md` is the path
   **Azure DevOps actually reads**, and it carries real content. It needs DoD alignment,
   not relocation. **Do not create a `.github/` directory in this repo.**
3. **Audit rows** — scheduled-audit/deadman are GitHub Actions templates. Scored ABSENT
   (no trace of any audit mechanism), with the cause recorded: the AzDO port is estate
   work, Phase 4(b). Not silently N/A — the gap is real and shared by all 14 repos.

## Governance score: 14/100 — Greenfield

| Artifact | Status | Notes |
|---|---|---|
| Definition of Done | ABSENT | Phase 2 |
| PR template | PRESENT *(corrected)* | `docs/pull_request_template.md`, AzDO path; generic content — fill in Phase 2 |
| Issue authoring | ABSENT | backlog is AzDO work items with no repo key — excluded pending Phase 4(c) |
| Scheduled audit | ABSENT *(platform)* | no GitHub Actions; port is Phase 4(b), one-time, shared |
| Audit deadman | N/A | no audit to watch |
| Governance health | N/A | fewer than 3 audit cycles; blocked behind 4(b) |
| ADR lint | N/A | no ADR directory until Phase 3 |
| DB migration CI | N/A | no SQL, no migrations |
| CLAUDE.md section | ABSENT | stub file, no governance section |
| Watch items | ABSENT | deferred — see below |
| Product decisions (PDR) | ABSENT | decisions live in Aha! `PROD-*` records — cite, don't re-derive |

Score = 2 / (2 × 7 applicable) = **14/100**. N/A: deadman, health, ADR lint, DB harness.

## Excluded on the record (platform deltas — not gaps)

Recorded once here so the other 13 repos inherit the record, per the plan:

- **No SQL / no migrations:** `db-migration-governance.md`,
  `workflows/db-migration-harness-postgres.yml`,
  `workflows/db-migration-harness-sqlserver.yml`,
  `scripts/check-breaking-migrations.mjs`, `scripts/check-schema-promises.mjs`.
- **No TypeScript:** `scripts/check-magic-strings.mjs`,
  `scripts/check-inline-type-unions.mjs`, `scripts/check-duplicated-sql.mjs`,
  `scripts/lint-stub-tests.mjs`. (These bind in `browser-app-v2`, not here.)
- **No GitHub Actions:** `workflows/scheduled-audit.yml`, `workflows/audit-deadman.yml`
  — deferred, not waived; revisit when Phase 4(b) lands the AzDO port.
- **No repo-scoped backlog key:** `agent-routing.md`, `agent-routing-records.md`,
  `skills/routing-triage/`, `agents/routing-classifier.opencode.md`,
  `routing-calibration-protocol.md`, `scripts/check-issue-routing.mjs`,
  `issue-authoring.md` — the Doorbell project holds 969 open work items keyed by
  vendor/team area paths, not service. Revisit when Phase 4(c) introduces a repo key.

## Deferred with revisit conditions

- `watch-items.md` — P2 informational; revisit at Phase 3 close (needs a sweep home;
  the audit loop that sweeps it is 4(b) work).
- `governance-health.md` — needs 3+ audit cycles; revisit after 4(b).
- `skills/competitive-analysis/` — optional capability; not scheduled in the pilot.

## Not in pilot scope — Phase 4 (one-time, shared across all 14)

(a) AzDO governance pipeline template · (b) audit-loop port to scheduled AzDO pipelines ·
(c) repo↔work-item key + routing-check port · (d) estate-level conventions tier.
**Do not improvise any of these inside SourcingService** — a per-repo answer to a shared
question is how the estate ends up with 14 snowflakes.

---
---

# Prompt — paste into Claude Code in `~/repos/Doorbell/SourcingService`

We're adopting the governance framework from `~/repos/HopSkipInc/repo-governance` at the
**`full`** adoption class, as the pilot for the Doorbell (Azure DevOps) estate. The
approved plan is `~/.claude/plans/twinkling-mapping-acorn.md` — read it first; it is the
scope contract. Work the phases in order. Do not start Phase 3 without a human in the
room.

**Before starting:**
1. Read `~/repos/HopSkipInc/repo-governance/GETTING_STARTED.md` in full.
2. Read this repo's current state: `CLAUDE.md` (one-line stub), `README.md` (untouched
   AzDO scaffold), `docs/pull_request_template.md`, `pipelines/ci-build.yml`,
   `tests/tests.csproj`, `functions/functions.csproj`, `functions/Startup.cs`,
   `functions/Configuration.cs`.
3. Read `~/repos/Doorbell/ImportExportService/CLAUDE.md` — the house reference for shape
   and depth, and evidence that several patterns here are estate-wide.

**Repo context** (from static analysis 2026-08-10 — verify anything you rely on):
- Client / owner: Hopskip (internal), Doorbell AzDO project (`dev.azure.com/saratogasandboxes/Doorbell`)
- Repo purpose: venue-sourcing events and intent handling — RFP/event plans, proposal
  requests, planner workflows (derive the precise statement from the code during Phase 1)
- Stack: .NET 6, Azure Functions v4 **in-process**; Cosmos DB + Service Bus + Blob; ARM
  JSON infra; xUnit + Moq + coverlet.collector 3.1.2
- Existing CI: Azure DevOps `pipelines/ci-build.yml`, branch **`main`** — restore and
  build **exclude `*test*.csproj`; no test task runs anywhere**
- Tests: 12 real test classes under `tests/` (Plans + ProposalRequests + IntentHandlers),
  Trait Category `"Unit"`; `SmokeTest.cs` and two stub helpers alongside
- Trigger surface: 96 HTTP + 7 ServiceBus + 2 Timer across 106 source files
- Platform packages: `HopSkip.Authentication` / `HopSkip.Models` / `HopSkip.Services`
  floating at `1.0.*` from the private `HopSkipPlatform` feed (nuget.config wires it;
  local restore needs the Azure Artifacts Credential Provider)
- Root clutter already tracked in git: `__azurite_db_blob__.json`,
  `__azurite_db_blob_extent__.json`, `__blobstorage__/` — Azurite local-emulator state
- `.claude/qa-BUG-7461-turnkey.md` — tracked session scratch, does not belong in the repo

## Phase 1 — Legibility (no CI change, no gates)

1. **Real `CLAUDE.md`** via the `agent-instructions-interview` skill
   (`~/repos/HopSkipInc/repo-governance/templates/skills/agent-instructions-interview/`).
   Match `ImportExportService/CLAUDE.md` for shape and depth: build/test commands,
   architecture overview (trigger inventory, Cosmos-via-`IBinder`/`CosmosDBAttribute`
   pattern, `Startup.cs` DI, outbound HTTP discipline, telemetry/correlation),
   configuration keys, testing strategy, project structure. Confirm the environment
   naming (dev/qasbx/demo/prod) against `Configuration.cs` before writing it.
2. **System map** — apply
   `~/repos/HopSkipInc/repo-governance/downstream/hopskip/2026-08-09-graphify-local-regen.md`
   **as corrected 2026-08-10** (graphifyy`[sql]==0.9.35` pin; steady-state determinism
   check). Do NOT apply the superseded 2026-08-07 CI prompt. This repo is .NET: if
   extraction yields ~zero nodes for `.cs` files, stop and report back to
   repo-governance before proceeding — do not ship an empty map as if it were a map.
3. **Replace `README.md`** — the AzDO scaffold is worse than nothing. Purpose, trigger
   boundaries, build/test commands, and the system-map link line from the regen prompt.
4. **Governance sync section + closing contract** — install
   `templates/governance-sync-claude-section.md` (v1.3.1) into `CLAUDE.md`: client
   `hopskip`, repo slug `SourcingService`, **class: `full`**. Declare each installed
   template in the Synced-templates table (repo-relative paths, versions from each
   template's stamp). Then install the `templates/closing-contract.md` section.
5. **Root clutter** — `git rm -r --cached __blobstorage__ __azurite_db_blob__.json
   __azurite_db_blob_extent__.json` and gitignore them (Azurite regenerates locally);
   move `.claude/qa-BUG-7461-turnkey.md` out of the repo (preserve a copy outside the
   tree if the content matters to its author).

Deferred from Phase 1: `harness-enforcement.md` — its path register is installer-filled
from CLAUDE.md's records paragraph, and no records files exist until Phase 3.

## Phase 2 — Make the gate real

1. **Run the suite locally first:** `dotnet test tests/tests.csproj` (restore needs
   auth to the `HopSkipPlatform` feed — Azure Artifacts Credential Provider). **If it is
   red, that is the finding** — fix it as separate work before gating anything. Do not
   turn on a gate you have not seen pass.
2. **`pipelines/ci-build.yml`:** stop excluding tests — delete `!**/*test*.csproj` from
   both the restore and build `projects:` blocks. Add the test task copied from
   `~/repos/Doorbell/ImportExportService/pipelines/ci-build.yml:47-53`
   (`DotNetCoreCLI@2`, `command: 'test'`, `--filter "Category!=Integration"`,
   `publishTestResults: true`) and append `--collect:"XPlat Code Coverage"` to its
   arguments (coverlet.collector 3.1.2 is already referenced). The `!=Integration`
   filter is correct here even though this repo's trait is `"Unit"` — nothing is
   categorized Integration.
3. **Branch policy:** wire the build as **required build validation on `main`** via the
   `ado-branch-gates` skill (`/gates list --repo SourcingService` to see current state).
4. **`docs/definition-of-done.md`** from `templates/definition-of-done.md`, adapted to
   this repo's work types (function triggers, Cosmos access, platform-package floating
   pins, ARM infra). **Every DoD row names the AzDO gate that enforces it, or is marked
   deliberately unenforced** — an unenforced promise erodes the doc, and a check that
   cannot run must report SKIPPED, never pass.
5. **Fill `docs/pull_request_template.md`** — it already sits at the path AzDO reads;
   align its checklists with the DoD. Do not create `.github/`.

**Phase 2 verification:** open a throwaway PR against `main` with a deliberately failing
test and confirm **AzDO blocks the merge**. A green pipeline is not evidence the gate
binds — check the gate, not the file you just wrote. Close the PR unmerged.

## Phase 3 — Records (human in the room, ~2 sessions)

- `test-coverage-interview` → `docs/testing-strategy.md`. 12 test classes against 106
  source files and 96 HTTP triggers: **§6 (properties nothing verifies) will be the bulk
  of the document.** That is the honest output and a routing input later.
- `clean-code-interview` → `docs/code-conventions.md`.
- `pdr-interview` → `docs/pdr/` (+ `adr/023-product-decision-records.md`). **Cite the
  Aha! `PROD-*` records rather than re-deriving them** — Aha! is the product tier.
  Every Accepted PDR carries an observable falsifier line.
- ADR corpus (`templates/adr/README.md` + `_template.md`) + `design-lenses.md` +
  `design-lenses-records.md` + `skills/lens-sweep/` + `scripts/check-design-lens.mjs`:
  a retroactive naming pass over patterns that already exist — Cosmos via
  `IBinder`/`CosmosDBAttribute`, `IHttpClientFactory`-only outbound HTTP, correlation
  through the telemetry helper, CloudEvents. Cross-check against
  `ImportExportService/CLAUDE.md`, which documents four of these: patterns shared across
  repos are **estate-wide** and get flagged for Phase 4(d), not re-derived per repo.
- `harness-enforcement.md` + `scripts/check-enforcement-stanzas.mjs` — now that records
  paths exist to protect.
- `scripts/check-adr-readme-sync.mjs` — run locally in report mode until Phase 4(a)
  gives it a pipeline home.

## Excluded on the record (do not install)

No SQL/migrations family · no TypeScript lints · no GitHub Actions (audit loop port is
Phase 4(b)) · no agent-routing family or `issue-authoring.md` (no repo↔work-item key;
Phase 4(c)). The full list with reasons is in the analysis above. **A template outside
this list that you believe applies is a plan amendment — stop and raise it, don't
improvise.** Phase 4 items (a)–(d) are one-time estate work and are explicitly out of
scope for this repo.

## After applying

- Phase 1 check: a fresh session in this repo, given only the repo, can name the
  service's purpose, its triggers, and its Cosmos/Service Bus boundaries without being
  told. `graphify-out/` regenerates deterministically (cycles 2 and 3 byte-identical).
- Phase 2 check: the throwaway-PR gate test above.
- Phase 3 check: every Accepted PDR carries a falsifier; `docs/testing-strategy.md` §6
  names real unverified properties; the ADR index registers every record.
- No `ANTHROPIC_API_KEY`, no first audit: the audit loop does not exist on AzDO yet.
  The pilot produces a snapshot, not a compounding system, until Phase 4(b) — that is
  expected and recorded, not a step you missed.

**Reference files (in `~/repos/HopSkipInc/repo-governance`):**
- `GETTING_STARTED.md` — full step-by-step guide
- `templates/` — all template files
- `downstream/hopskip/2026-08-09-graphify-local-regen.md` — corrected regen prompt
- `downstream/hopskip/_client.md` §Doorbell estate — the estate record this pilot feeds
