---
name: analyze-repo
description: Statically probe a repo (local or GitHub URL), score its governance readiness, recommend which templates apply, and produce a customized bootstrap prompt — replaces the manual _kickoff-prompt.md fill-in workflow
---

# Governance Analyze Repo

Statically probes a target repo, scores its governance readiness, and produces a customized bootstrap prompt. No code execution — directory listing, file reading, and manifest parsing only.

**Usage:**
- `/analyze-repo ~/repos/HopSkipInc/some-repo`
- `/analyze-repo https://github.com/owner/repo`
- `/analyze-repo . --client "Hopskip" --repo-slug "new-service"`

---

## Step 0: Parse input

From the user's message, extract:
- `TARGET` — local path or GitHub URL (required)
- `CLIENT` — client/owner name from `--client` or prompt (optional — if absent, use `unknown`)
- `REPO_SLUG` — repo slug from `--repo-slug` or prompt (optional — if absent, derive from repo name)
- `FOCUS` — optional focus area or concern from `--focus` or prompt

If the target is a GitHub URL, warn the user that remote probing is limited (public file listing only via `gh api` or WebFetch) and suggest cloning locally first. Continue with whatever level of access is available.

If the target is a local path, verify it exists and is a git repo:
```bash
test -d "<TARGET>/.git" || echo "ERROR: not a git repo"
```

---

### Quick pre-check: already governed?

Before the full probe, check if this repo already has a governance sync section:

```bash
grep -l "governance-sync\|repo-governance\|## Governance" <TARGET>/CLAUDE.md <TARGET>/AGENTS.md 2>/dev/null
```

If found, read the section. If the repo already declares a repo-governance path and has applied governance updates, **stop here.** Report:

```
## Already governed — no bootstrap needed

This repo has a governance sync section in <file>.
It is already tracked in the repo-governance maintenance ledger.

**Suggestion:** Use `/sync-from-repo` to check for template updates instead of bootstrap.
```

Continue with the full probe anyway if the user asks ("analyze it anyway" / "score it anyway"). The reposcape report is still useful for gap detection even on governed repos.

---

## Step 1: Static probe — gather the raw data

Run all probes in parallel. For each probe, note whether the data was fetched locally or remotely.

### 1.1 Language stack detection

Check for lockfiles and manifests. For each found, note the language and version sources:

```bash
ls <TARGET>/package.json 2>/dev/null                      && echo "Node.js/TS — package.json"
ls <TARGET>/Cargo.toml 2>/dev/null                        && echo "Rust — Cargo.toml"
ls <TARGET>/go.mod 2>/dev/null                            && echo "Go — go.mod"
ls <TARGET>/requirements.txt 2>/dev/null                  && echo "Python — requirements.txt"
ls <TARGET>/pyproject.toml 2>/dev/null                    && echo "Python — pyproject.toml"
ls <TARGET>/Gemfile 2>/dev/null                           && echo "Ruby — Gemfile"
ls <TARGET>/composer.json 2>/dev/null                     && echo "PHP — composer.json"
ls <TARGET>/build.gradle* 2>/dev/null                     && echo "Java/Kotlin — Gradle"
ls <TARGET>/pom.xml 2>/dev/null                           && echo "Java — Maven"
find <TARGET> -maxdepth 3 -name "*.sln" 2>/dev/null       | head -1 && echo ".NET — .sln (nested)"
find <TARGET> -maxdepth 3 -name "*.csproj" 2>/dev/null    | head -1 && echo ".NET — .csproj (nested)"
find <TARGET> -maxdepth 3 -name "*.fsproj" 2>/dev/null    | head -1 && echo "F# — .fsproj (nested)"
find <TARGET> -maxdepth 3 -name "*.sqlproj" 2>/dev/null   | head -1 && echo "SQL Server — .sqlproj"
find <TARGET> -maxdepth 3 -name "Dockerfile*" 2>/dev/null  | head -1 && echo "Docker — Dockerfile"
ls <TARGET>/mix.exs 2>/dev/null                           && echo "Elixir — mix.exs"
```

Also check for monorepo patterns:
```bash
ls -d <TARGET>/packages/ 2>/dev/null                      && echo "monorepo:packages/"
test -f <TARGET>/pnpm-workspace.yaml 2>/dev/null          && echo "monorepo:pnpm"
test -f <TARGET>/lerna.json 2>/dev/null                   && echo "monorepo:lerna"
test -f <TARGET>/turbo.json 2>/dev/null                   && echo "monorepo:turbo"
```

### 1.2 CI/CD config detection

```bash
ls <TARGET>/.github/workflows/*.yml 2>/dev/null           | head -20
ls <TARGET>/azure-pipelines.yml 2>/dev/null
ls <TARGET>/.gitlab-ci.yml 2>/dev/null
ls <TARGET>/Jenkinsfile 2>/dev/null
ls <TARGET>/.circleci/config.yml 2>/dev/null
```

Read the contents of any `scheduled-audit*.yml`, `audit-deadman*.yml`, or `lint*.yml` workflow files — note their presence and what they gate on.

### 1.3 ADR directory detection

```bash
ls <TARGET>/docs/adr/ 2>/dev/null                         && echo "ADRs: docs/adr/"
ls <TARGET>/adr/ 2>/dev/null                              && echo "ADRs: adr/"
ls <TARGET>/adrs/ 2>/dev/null                             && echo "ADRs: adrs/"
ls <TARGET>/decisions/ 2>/dev/null                        && echo "ADRs: decisions/"
```

If an ADR directory exists, count the files and read the highest-numbered ADR to determine the next available slot. Also check for an ADR index (`README.md` or `INDEX.md`) — note whether it exists.

### 1.4 Governance artifact detection

Check for each of the standard governance artifacts. Score each:

| Artifact | What to check | Scoring |
|---|---|---|
| Definition of Done | `docs/definition-of-done.md` | PRESENT if exists with non-template content. PARTIAL if it's a raw template copy (has `[Fill in]` placeholders). ABSENT if missing. |
| PR template | `.github/pull_request_template.md` or `.github/PULL_REQUEST_TEMPLATE.md` | PRESENT if exists. ABSENT if missing. |
| Issue authoring | `docs/issue-authoring.md` | PRESENT if exists. ABSENT if missing. |
| Scheduled audit | `.github/workflows/scheduled-audit*.yml`, OR DoD mentions an in-platform scheduler ("cron state machine", "audit.*machine", "audit-data-platform"), OR `docs/governance-health.md` (implies audit is running) | PRESENT if workflow, in-platform scheduler reference, or health doc exists. ABSENT if no trace of any audit mechanism. |
| Audit deadman | `.github/workflows/audit-deadman*.yml` | PRESENT if exists. NOT_APPLICABLE if no scheduled audit. ABSENT if audit exists but no deadman. |
| Stale-blocker probe | `.github/workflows/stale-blocker-probe*.yml` | PRESENT if exists. NOT_APPLICABLE if the backlog carries no `blocked-by` cross-issue dependencies (nothing to probe). ABSENT if dependencies exist but no probe does. |
| Governance health | `docs/governance-health.md` | PRESENT if exists. ABSENT if missing. NOT_APPLICABLE if fewer than 3 audit cycles. |
| ADR lint | any workflow/lint that checks ADR ↔ README consistency | PRESENT if exists. ABSENT if missing. NOT_APPLICABLE if no ADR directory. |
| DB migration CI | `.github/workflows/db-migration-harness*.yml` or equivalent | PRESENT if exists. ABSENT if DB migrations exist but no harness. NOT_APPLICABLE if no DB. |
| CLAUDE.md section | `CLAUDE.md` or `AGENTS.md` contains a `## Governance` or `## Applied governance` section | PRESENT if governance section exists. ABSENT if CLAUDE.md exists but no governance section. NOT_APPLICABLE if no CLAUDE.md/AGENTS.md. |
| Watch items | `docs/watch-items/` (or legacy `docs/competitive-intel/`) | PRESENT if directory exists with files. PARTIAL if only the legacy `docs/competitive-intel/` path exists — the sweep globs `docs/watch-items/`, so a legacy dir is swept by nothing. ABSENT if missing. |
| Product decisions (PDR) | `docs/pdr/` with `NNN-*.md` records + `README.md` index | PRESENT if ≥1 record exists, the index registers them, and every record with Status **Accepted** carries an observable falsifier line (`- [ ] Revisit by`). PARTIAL if the directory exists but records lack falsifiers, the index is missing, or the records still carry template placeholders. ABSENT if missing. **Never NOT_APPLICABLE.** |

Also check for domain-specific concerns that may indicate additional template applicability:
- DB migrations directory (`migrations/`, `db/migrations/`, `sql/`) → `db-migration-governance.md`
- Code quality lints (`code-hygiene.md`, `lint:` scripts in package.json) → note existing coverage
- Skills directory (`.claude/skills/` or similar) → note agent tooling maturity

### 1.5 File tree snapshot

Read the top-level directory listing:
```bash
ls -1 <TARGET>/
```

And one level deep in each of these (if they exist):
```bash
for dir in src lib host func functions functions-dotnet docs .github .claude; do
  test -d "<TARGET>/$dir" && echo "=== $dir ===" && ls -1 "<TARGET>/$dir/" | head -30
done
```

### 1.6 README and CLAUDE.md

Read `<TARGET>/README.md` (first 50 lines) and `<TARGET>/CLAUDE.md` or `<TARGET>/AGENTS.md` if they exist. Extract: project purpose, team size signals, existing conventions, any governance references already present.

---

## Step 2: Score and recommend

### 2.1 Governance readiness score

Assign one point per artifact in §1.4:
- PRESENT = 2 points
- PARTIAL = 1 point
- ABSENT = 0 points
- NOT_APPLICABLE = exclude from denominator

```
Score = (sum of points) / (2 × count of applicable artifacts) × 100
```

**Product decisions are never NOT_APPLICABLE.** Every other artifact can be legitimately absent — deadman needs an audit to watch, health needs three cycles of data, ADR lint needs an ADR directory, DB harness needs a database. But every repo that exists has a reason to exist. Scoring PDR as N/A would be saying "this project doesn't need to know why it's being built," which is never true. A greenfield repo scores 0 here and that is a finding, not a technicality — expect most repos to, and say so plainly rather than softening it.

Present the score with a label:
- 0–25: **Greenfield** — no governance artifacts. Full bootstrap needed.
- 26–50: **Partial** — some artifacts exist but are template-default or incomplete.
- 51–75: **Adopted** — most artifacts present, some gaps remain.
- 76–100: **Mature** — full governance surface. Audit and refine, don't bootstrap.

### 2.2 Template applicability matrix

For each template in `~/repos/HopSkipInc/repo-governance/templates/`, determine whether it applies.

**Templates are named by their path relative to `templates/`** — not by bare filename. Seven
skills share the basename `SKILL.md`, so a bare name matches the wrong thing. `scripts/check-analyze-repo-coverage.mjs`
enforces that every template appears here or is excluded on the record.

**Adoption classes (PDR-009, 2026-08-03).** The framework ships two named depths,
declared on the `class:` line of the repo's CLAUDE.md Governance section:

- **full** — every row below whose condition is met. The three current governed repos
  run this.
- **core** — only rows marked `core` in the Class column: the smallest set that makes a
  repo legibly governed (decisions recorded, DoD gated at PR submission, sync
  discoverable). For repos with a single maintainer and no agent-worked backlog.

A template outside the declared class is **excluded on the record, not silently
absent** — the downstream-drift check only ever reads declared rows, so absence was
always free; the class line makes it legible. Upgrading core → full is installing the
remaining applicable rows and editing one line: the class is a depth, not an identity.

| Template | Applicable if | Priority | Rationale | Class |
|---|---|---|---|---|
| `definition-of-done.md` | Always | P0 | Core artifact — everything else scaffolds off it | core |
| `pdr/` + `adr/023-product-decision-records.md` | Always | P0 | The only artifact recording *why* the software exists. Cannot be bootstrapped by reading the repo — requires interviewing the decision-maker (`skills/pdr-interview/`). Flag in the prompt that this step needs a human, not an agent working alone | full |
| `pull_request_template.md` | Always | P0 | Enforces DoD at PR submission | core |
| `issue-authoring.md` | Backlog has >10 open issues or issue quality is a concern | P1 | Structure for backlog hygiene | full |
| `workflows/scheduled-audit.yml` | Always (after DoD + PR template) | P0 | Compounding dynamic requires the audit loop | full |
| `workflows/audit-deadman.yml` | scheduled-audit is applied | P0 | Required companion — audit without deadman is unverifiable | full |
| `db-migration-governance.md` | DB detected (migrations dir, DbUp, Flyway, Alembic, etc.) | P1 | Migration safety is a DoD gate | full |
| `workflows/db-migration-harness-postgres.yml` | DB migration governance applied **and** Postgres | P2 | CI gate for the migration policy | full |
| `workflows/db-migration-harness-sqlserver.yml` | DB migration governance applied **and** SQL Server | P2 | CI gate for the migration policy | full |
| `watch-items.md` | Always (informational) | P2 | Watch-list format — low urgency, high compound value | full |
| `governance-health.md` | After 3+ audit cycles | P2 (deferred) | Metrics need data to be meaningful | full |
| `governance-sync-claude-section.md` | CLAUDE.md or AGENTS.md exists | P0 | Tells downstream agents about repo-governance; carries the Synced-templates table drift detection reads | core |
| `closing-contract.md` | CLAUDE.md or AGENTS.md exists | P2 | Ends the closing-caveat tic: responses end with the result; loose ends ride the ledger, blocking ones lead | core |
| `adr/README.md` + `adr/_template.md` | ADR corpus is being applied | P0 | The index and the blank form — an ADR directory without both drifts immediately | core |
| `scripts/check-adr-readme-sync.mjs` | ADR directory **or** PDR directory exists | P1 | Prevents index drift in both corpora — one script covers both | core |
| **`agent-routing.md`** | Backlog is worked by coding agents | P1 | `impl:` tiers keep work a weak model would botch away from it. Skip only if all implementation is human | full |
| **`agent-routing-records.md`** | agent-routing is applied | P1 | The per-repo records file — model→class, pin resolutions, ratio readings, calibration set. Never syncs after install. Without it the repo appends records to the policy, which the adoption check requires to be identical to the template | full |
| **`skills/routing-triage/`** | agent-routing is applied | P1 | How tiers actually get assigned; installs a `agents/routing-classifier*` variant as its dependency | full |
| **`agents/routing-classifier.opencode.md`** | agent-routing is applied **and** the team runs opencode | P1 | opencode does not read `.claude/agents/`, so the Claude Code pin does not bind there. Installs globally to `~/.config/opencode/agents/`. Install instead of — not alongside — the Claude Code variant on an opencode-only team | full |
| **`scripts/check-issue-routing.mjs`** | agent-routing is applied | P1 | Mechanical enforcement of the routing rules; queries the GitHub API, so language-agnostic | full |
| **`skills/adr-interview/`** | Repo has load-bearing patterns and no ADRs, or ADRs without enforcement | P1 | Five-layer sweep — layer 2 | full |
| **`skills/clean-code-interview/`** | Always | P2 | Five-layer sweep — layer 3 | full |
| **`code-conventions.md`** | clean-code-interview is applied | P2 | The layer-3 records file — enforced / documented / **not codified**. Never syncs after install. Without it the interview's output disperses into ADRs and CLAUDE.md and no audit domain has anything to measure against, and the next refresh re-proposes every pattern the last one dropped | full |
| **`skills/test-coverage-interview/`** | Always | P1 | Five-layer sweep — layer 4. Coverage is what keeps issues cheap to route | full |
| **`testing-strategy.md`** | test-coverage-interview is applied | P1 | The layer-4 records file — coverage floor, coverage map, deliberate exemptions, false-green register, and §6 (properties nothing verifies). §6 is a routing input: `agent-routing.md`'s coverage rule reads it instead of guessing at the suite. Never syncs after install | full |
| **`skills/agent-instructions-interview/`** | CLAUDE.md or AGENTS.md exists | P1 | Five-layer sweep — layer 5 | full |
| `skills/competitive-analysis/` | Team values competitive intel | P2 | Self-discovering skill — adds capability | full |
| `skills/pdr-interview/` | PDR corpus is being applied | P0 | How the PDR corpus actually gets written — the interview is the work, the record is the output | full |
| **`scripts/check-root-clutter.mjs`** | Always | P2 | Directory listing, zero language dependency; converged independently in three repos before being templated | full |
| **`scripts/check-breaking-migrations.mjs`** | DB migration governance applied | P1 | A migration dropping/renaming a column must have zero remaining code references. Driven by a real outage | full |
| **`scripts/check-schema-promises.mjs`** | DB migration governance applied | P1 | Sibling of the above — enforcement-bearing schema must have a consumer or a dormant register entry | full |
| **`scripts/lint-stub-tests.mjs`** | npm `test`/`test:*` scripts exist | P2 | Catches false-green CI. Ships in report mode; promote to gate once clean | full |
| **`scripts/check-weakened-verification.mjs`** | Repo has an automated test suite **and** CI can supply a base ref | P1 | The only mechanical check on weakened verification (`agent-routing.md` anti-pattern 7) — a workaround with a *negative* diff, which no pattern lint can see. Reads the net assertion/skip delta and clears on a `testing-strategy.md` §6 row or a `VERIFICATION-DELTA:` line. Language-agnostic by convention, not by parsing; ships in report mode, promote to gate after one audit cycle | full |
| **`scripts/check-magic-strings.mjs`** | TypeScript repo | P2 | Value duplicating an exported alias without importing it | full |
| **`scripts/check-inline-type-unions.mjs`** | TypeScript repo | P2 | Type-level sibling of the above | full |
| **`scripts/check-duplicated-sql.mjs`** | TypeScript repo **and** inline SQL | P2 | Same query inlined in 2+ files instead of a registry | full |
| `design-lenses.md` | ADR corpus is being applied | P1 | One required falsifiable line per ADR — borrows a mature discipline's failure-mode check at the moment the claim is made. The §2 filter (prediction or drop it) is the whole policy | full |
| `design-lenses-records.md` | design-lenses is applied | P1 | The per-repo evidence file — retroactive naming pass, lens log with forced fits, local claim-class extensions. Never syncs after install; extensions feed the upstream promotion sweep | full |
| `skills/lens-sweep/` | design-lenses is applied | P1 | The application pass, run in a separate session from the ADR's authoring session — proposes Lens lines with evidence trails; proposes, never applies | full |
| `scripts/check-design-lens.mjs` | design-lenses is applied | P1 | Mechanical floor — Lens line present, class valid against table + extensions, `checked:` paths exist, confirmations carry a consequence | full |
| **`system-map.md`** | Always | P2 | Generated system-map policy — in-session regeneration for the delta read (commit nothing on working branches); the committed map has a single writer, the `chore/graphify-refresh` lane, driven by the audit freshness probe; publishing rules (never anonymous static hosting); pinned supply chain with fixed `PYTHONHASHSEED`; the estate merge contract | core |
| **`scripts/check-system-map-lane.mjs`** | system-map.md is applied | P2 | The lane gate — R1: only `chore/graphify-refresh*`/`chore/graphify-install` branches may touch `graphify-out/**`; R2: refresh branches touch nothing else. Fails closed when branch or change set is indeterminable. Keeps the single-writer invariant a CI gate instead of a convention | core |
| **`harness-enforcement.md`** | CLAUDE.md exists **and** the team runs Claude Code | P1 | Permission-deny stanza — records-file protection + secrets hygiene, enforced by the harness pre-action, not by instructions. Path register is installer-filled from the repo's own CLAUDE.md records paragraph (PDR-004 — no shadow mirror). Ships with a binding demonstration in the installing PR; presence is linted by `check-enforcement-stanzas.mjs` | full |
| **`harness-enforcement.opencode.md`** | CLAUDE.md or AGENTS.md exists **and** the team runs opencode | P1 | opencode variant of the same stanza — `permission.edit`/`read` path rules, last-match-wins ordering documented (catch-all first). Install instead of — not alongside — the Claude Code variant on an opencode-only team; both on a mixed team | full |
| **`scripts/check-enforcement-stanzas.mjs`** | a `harness-enforcement*` variant is applied | P1 | The install-assertion half — a stanza cannot report its own absence. Register-driven (`docs/enforcement-stanzas-register.md`); fails closed on a missing register; blocking UNREGISTERED when a CLAUDE.md-listed records file has no register entry; catches the opencode catch-all-ordering mistake statically | full |
| **`scripts/write-record.mjs`** | a `harness-enforcement*` variant is applied | P1 | The mediated write path (issue #81) — agents publish ADRs/PDRs through a validating, append-only script while the stanza keeps denying raw edits to records paths. Without it, every records write is human hands (deny), a human keystroke (ask), or impossible (headless — ask auto-rejects, so fleet workers cannot author records). Register each corpus in `## Mediated write paths` | full |
| **`scripts/check-stale-blockers.mjs`** | The backlog carries cross-issue dependencies (`blocked-by` refs in issue bodies) | P1 | The phantom-blocker detector — a probe, never a gate. Five classes (phantom, unresolved-ref, unreachable→SKIPPED, mutual-deferral, stale-status); a scope the token cannot read is reported SKIPPED, never counted clean. Ships alongside the `issue-authoring.md` ref-resolution rule and the `definition-of-done.md` dependent sweep, which is the primary control — the probe is the backstop | full |
| **`workflows/stale-blocker-probe.yml`** | `scripts/check-stale-blockers.mjs` is applied | P1 | The weekly cron that runs the probe and upserts one rolling issue, escalating to P1 when a phantom sits on a P1 issue for two consecutive runs. Needs an estate-spanning token (`STALE_BLOCKERS_TOKEN` secret) for cross-repo refs; without it the probe degrades to same-repo-only, loudly | full |

**Bolded rows were added 2026-07-24**, when `check-analyze-repo-coverage.mjs` found the matrix
named 13 of 36 templates. Everything bold was previously unreachable via `/analyze-repo`.
The two `graphify` rows were added 2026-08-07 alongside the templates they shipped. The
`workflows/graphify-report.yml` row was removed 2026-08-09 when the template was deleted:
its CI commit-back proved unlandable in any repo with required status checks (field
report: enrichment-pipeline PRs #474/#475), so freshness moved to in-session regeneration
under `system-map.md` v2.0.0. The `check-system-map-lane.mjs` row was added 2026-08-12
with `system-map.md` v3.0.0: committing the map on every working branch made every pair
of concurrent code PRs conflict in `graphify-out/**`, so the committed map moved to a
single `chore/graphify-refresh` lane and the lint is what keeps every other branch off it
(issue #<79>).
The two `harness-enforcement` rows were added 2026-08-08 alongside the templates they
ship (issue #<36>); the `check-enforcement-stanzas.mjs` row landed with its lint the
same day (issue #<37>). The `scripts/write-record.mjs` row was added 2026-08-13 with
the mediated write path (issue #<81>). The `check-stale-blockers.mjs` /
`stale-blocker-probe.yml` rows were added 2026-08-18 with the stale-blocker controls
(issue #<89>).

### 2.3 Priority-ordered action plan

Consolidate the matrix into an ordered list of concrete actions. If the repo declares
an adoption class (or the user picks one now), restrict the list to that class's rows —
a `core` repo gets the `core` rows whose conditions are met, and everything else is
recorded as excluded-by-class, not as a gap:

```
## What to apply (in order)

1. [P0] <template> — <reason specific to this repo>
2. [P0] <template> — <reason>
3. [P1] <template> — <reason> (defer if: <condition>)
...
```

Flag any actions that are already done (artifact PRESENT — "already applied, skip"). Flag any that are deferred with a revisit condition.

---

## Step 3: Produce output

### 3.1 Display the analysis to the user

Output the reposcape report to the terminal. Format:

```
# Governance Analysis — <REPO_SLUG>

**Target:** <TARGET>  **Analyzed:** YYYY-MM-DD  **Focus:** <FOCUS or "broad sweep">

## Repo snapshot

| Dimension | Signal |
|---|---|
| Stack | <detected languages/frameworks> |
| CI | <detected CI system> |
| ADRs | <count> in <directory> (next: <slot>) |
| DB presence | <yes/no — type> |
| Monorepo | <yes/no — layout> |
| Agent tooling | <CLAUDE.md present / skills dir / none> |

## Governance score: XX/100 — <label>

| Artifact | Status | Notes |
|---|---|---|
| <name> | PRESENT / PARTIAL / ABSENT / N/A | <detail> |
| ... | | |

## Priority action plan

1. [P0] <action> — <one-line rationale>
2. [P0] <action>
...

## Custom bootstrap prompt
→ written to <output path>
```

### 3.2 Write the customized bootstrap prompt

If `CLIENT` and `REPO_SLUG` are provided:
```bash
REPO_DIR="downstream/${CLIENT}/${REPO_SLUG}"
mkdir -p "<REPO_DIR>"
```
Output path: `downstream/<CLIENT>/<REPO_SLUG>/YYYY-MM-DD-bootstrap.md`

Otherwise:
Output path: `/tmp/governance-bootstrap-YYYY-MM-DD.md`

The bootstrap prompt is a single self-contained message to paste into Claude Code in the target repo. It MUST be customized — no `[FILL IN]` placeholders. Every blank is pre-filled from the probe data.

Write the prompt following this structure:

```markdown
# Governance Bootstrap — <REPO_SLUG> — <DATE>

Paste this into Claude Code in the <TARGET> repo.

---

We're adopting the governance framework from `~/repos/HopSkipInc/repo-governance`. Your job is to set up governance for this repo by following GETTING_STARTED there.

**Before starting:**
1. Read `~/repos/HopSkipInc/repo-governance/GETTING_STARTED.md` in full.
2. Read this repo's current state: check what's in `docs/`, `.github/workflows/`, and `CLAUDE.md` (or whatever session instruction file this repo uses).

**Repo context** (pre-filled from static analysis):
- Client / owner: <CLIENT>
- Repo purpose: <extracted from README first 50 lines, or "unknown — check README">
- Stack: <detected languages/frameworks from §1.1>
- Existing CI: <detected CI system from §1.2, or "none detected">
- Existing docs: <summary of docs/ contents from §1.5, or "none detected">
- Existing ADRs: <count from §1.3, or "none detected">
- DB presence: <yes/no + type from §1.1, or "none detected">
- Monorepo: <yes/no + layout from §1.1, or "no">
- Agent instruction files: <CLAUDE.md / AGENTS.md / none>

**What to apply (in order):**

[INSERT THE PRIORITY-ORDERED ACTION PLAN FROM §2.3, CONVERTED TO NUMBERED STEP FORMAT.
 Each step follows the pattern from downstream/_kickoff-prompt.md steps 1-6:
 - File to copy from, file to write to
 - Adaptation instructions specific to this repo's stack
 - Skip instruction if artifact is already PRESENT]

**Already present — skip:**
[LIST ALL ARTIFACTS THAT SCORED PRESENT]

**Deferred — revisit later:**
[LIST ALL DEFERRED ACTIONS WITH THEIR REVISIT CONDITIONS]

**Adaptation rules:**
- Replace all placeholder CI commands (`[project CI check command]`, `npm run check`, etc.) with this repo's actual commands: <detected commands>
- Replace `[project source directories]` with real paths: <detected source directories>
- Drop "Why this rule exists" placeholders only if there is genuinely no incident to cite — never invent one
- Don't add DoD rules without an enforcement plan — every rule is a promise, and an unenforced promise erodes the whole doc

**After applying:**
- Confirm `ANTHROPIC_API_KEY` is set as a GitHub Actions secret (the audit workflow needs it)
- Verify each DoD row has a gating CI step, not just a manual checkbox — enforcement ships with the promise
- Run the first audit: `gh workflow run scheduled-audit.yml` (or wait for the next scheduled run)
- Treat the first audit as inventory, not a grade — work P0s this week, P1s next sprint, track P2s
- Add the governance sync section to CLAUDE.md by applying `templates/governance-sync-claude-section.md`

**Reference files (in `~/repos/HopSkipInc/repo-governance`):**
- `GETTING_STARTED.md` — full step-by-step guide with context
- `templates/` — all template files
- `docs/governance-health-spec.md` — add health metrics tracking after 3+ audit cycles
```

---

## Step 4: Record the analysis

Add a row to the maintenance log if CLIENT and REPO_SLUG were provided — either in `downstream/<CLIENT>/_client.md` (if it exists) or by creating a minimal client file:

```markdown
# <CLIENT> — Client Registry

## Governed Repos

| Repo | Path | Status | First analyzed |
|---|---|---|---|
| <REPO_SLUG> | `<TARGET>` | bootstrap needed — see YYYY-MM-DD-bootstrap.md | YYYY-MM-DD |

## Maintenance Log

| Date | Repo | Prompt | Status |
|---|---|---|---|
| YYYY-MM-DD | <REPO_SLUG> | downstream/<CLIENT>/<REPO_SLUG>/YYYY-MM-DD-bootstrap.md | pending |
```

---

## Tips

- The probe is static only — no `npm install`, no `cargo build`, no code execution. If a lockfile exists, note its presence; don't parse it.
- If a governance artifact exists but is clearly a raw template copy (has `[Fill in]` placeholders from the original template), score it PARTIAL, not PRESENT. The bootstrap prompt should instruct the agent to customize it rather than skip it.
- The `CLIENT` and `REPO_SLUG` flags are optional but recommended — they wire the analysis into the downstream maintenance ledger. Without them, the bootstrap prompt goes to `/tmp/` and there's no audit trail.
- If the target repo is already governed (has a governance CLAUDE.md section with a repo-governance path), note this in the report and recommend `/sync-from-repo` instead of bootstrap — the repo is past the kickoff phase.
