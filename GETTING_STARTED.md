# Getting Started

Apply this practice to any repo — new or existing. The steps below take about 20 minutes for a fresh repo, 40 minutes if you have existing ADRs or docs to reconcile.

## Prerequisites

- A GitHub repo with Actions enabled
- An `ANTHROPIC_API_KEY` secret set in the repo (or org-level) — the audit workflow uses it
- Claude Code locally if you want AI-assisted audit sessions

---

## Step 1 — Copy the templates

```bash
# From the root of your repo
mkdir -p docs/audits .github/workflows
cp path/to/repo-governance/templates/definition-of-done.md docs/definition-of-done.md
cp path/to/repo-governance/templates/pull_request_template.md .github/pull_request_template.md
cp path/to/repo-governance/templates/workflows/scheduled-audit.yml .github/workflows/scheduled-audit.yml
cp path/to/repo-governance/templates/workflows/audit-deadman.yml .github/workflows/audit-deadman.yml
```

If your backlog needs structure (most do):
```bash
cp path/to/repo-governance/templates/issue-authoring.md docs/issue-authoring.md
```

Audit docs land in `docs/audits/` — if your `.gitignore` has a `docs/*` pattern, make sure it doesn't silently block that subdirectory.

If your repo uses ADRs:
```bash
mkdir -p docs/adr
cp path/to/repo-governance/templates/adr/022-definition-of-done.md docs/adr/022-definition-of-done.md
cp path/to/repo-governance/templates/scripts/check-adr-readme-sync.mjs scripts/check-adr-readme-sync.mjs
```

To record *why the software exists* — not just how the code is shaped (see Step 3):
```bash
mkdir -p docs/pdr
cp path/to/repo-governance/templates/pdr/_template.md docs/pdr/_template.md
cp path/to/repo-governance/templates/pdr/README.md docs/pdr/README.md
cp path/to/repo-governance/templates/adr/023-product-decision-records.md docs/adr/023-product-decision-records.md   # if you use ADRs
```

If you want the watch-list convention and the skills:
```bash
cp path/to/repo-governance/templates/watch-items.md docs/watch-items.md
cp -r path/to/repo-governance/templates/skills/competitive-analysis .claude/skills/
cp -r path/to/repo-governance/templates/skills/pdr-interview .claude/skills/
```

The clean-code and test-coverage layers each keep a records file. Copy the blank forms when
you run their interviews (Steps 5–6) — they are filled in by the interview, never by hand,
and like `docs/agent-routing-records.md` they never sync back:
```bash
cp path/to/repo-governance/templates/code-conventions.md docs/code-conventions.md
cp path/to/repo-governance/templates/testing-strategy.md docs/testing-strategy.md
```

If your repo has a database, also see `templates/db-migration-governance.md` and the matching `templates/workflows/db-migration-harness-*.yml`. If it has migrations, also copy the breaking-migration gate (edit `MIGRATIONS_DIR` and `SOURCE_DIRS` at the top of the file for your layout):
```bash
cp path/to/repo-governance/templates/scripts/check-breaking-migrations.mjs scripts/check-breaking-migrations.mjs
```

If your repo is TypeScript, the following three lints catch duplicated values/types and duplicated inline SQL before they drift (edit `SRC_DIR` at the top of each file):
```bash
cp path/to/repo-governance/templates/scripts/check-magic-strings.mjs scripts/check-magic-strings.mjs
cp path/to/repo-governance/templates/scripts/check-inline-type-unions.mjs scripts/check-inline-type-unions.mjs
cp path/to/repo-governance/templates/scripts/check-duplicated-sql.mjs scripts/check-duplicated-sql.mjs   # only if your repo embeds SQL as backtick template literals
```

Every repo — no language dependency, edit `ALLOWED` for your actual top-level entries:
```bash
cp path/to/repo-governance/templates/scripts/check-root-clutter.mjs scripts/check-root-clutter.mjs
```

If your repo has migrations that add enforcement-bearing schema (RLS policies, rate-limit or lifecycle columns), edit `MIGRATIONS_DIR`/`SOURCE_DIRS`/`ENFORCEMENT_COLUMNS` for your layout:
```bash
cp path/to/repo-governance/templates/scripts/check-schema-promises.mjs scripts/check-schema-promises.mjs
```

If your repo uses npm test scripts, this catches false-green stubs (report mode, not a gate):
```bash
cp path/to/repo-governance/templates/scripts/lint-stub-tests.mjs scripts/lint-stub-tests.mjs
```

---

## Step 2 — Customize definition-of-done.md

Open `docs/definition-of-done.md` and work through it:

**Remove rows that don't apply.** If your repo has no database migrations, delete the Migration row. If it's a library with no deployment, trim the feature row's deployment checks.

**Add rows for work types you have that aren't listed.** Common additions: `Hotfix` (subset of bug fix, no test required if time-critical — make that explicit), `Dependency update`, `Refactor`.

**Fill in the "why this rule exists" callouts.** Each row has a placeholder. Go back to a real incident, a real audit finding, or a real bug that slipped through and write one sentence. The "why" is what makes the rule stick — a checklist without a story is just friction.

**Don't add rules you won't enforce.** Every rule in the DoD is a promise. An unenforced rule erodes trust in the whole document faster than having no rule at all.

---

## Steps 3–7 — The five-layer governance sweep

A repo under governance has five layers of "why." Each has a skill that probes the
codebase, drafts candidates from real evidence, and walks the person who holds the
knowledge through confirming, correcting, and filling in the gaps. Run them in order —
each layer authorizes the one below it.

| Step | Layer | What it captures | Skill | Evidence vs. interview |
|------|-------|-----------------|-------|----------------------|
| 3 | Product (PDRs) | Why the software exists | `pdr-interview` | Interview is origination — purpose is not in the codebase |
| 4 | Architecture (ADRs) | How the code is shaped | `adr-interview` | Probe is primary — architecture IS in the codebase; interview confirms |
| 5 | Clean code | How code is written | `clean-code-interview` | Probe + triage — sorting intentional conventions from accidental patterns |
| 6 | Test coverage | How code is verified | `test-coverage-interview` | Probe maps what exists; interview fills in the strategy |
| 7 | Agent instructions | How agents are briefed | `agent-instructions-interview` | Probe reconciles docs with reality; interview surfaces tribal knowledge |

**Each skill follows the same five-step pattern:** discover the repo → spawn a background
evidence agent → interview the human (evidence-led, one question at a time) → write
records → open a PR. The interview dynamics differ by layer — that's the design. A PDR
interview asks you to *originate* (purpose is in your head). An ADR interview asks you to
*confirm* (the codebase already shows the decision). A clean code interview asks you to
*triage* (intentional vs. accidental). A test coverage interview asks you to *fill gaps*
(the strategy is missing). An agent instructions interview asks you to *reconcile*
(instructions vs. reality) and surface *tribal knowledge*.

**Every ADR ships with enforcement.** A PDR without a falsifier is a wish; an ADR without
a lint is a suggestion. If the enforcement is genuinely expensive to build now, the ADR
stays Proposed with a tracking issue, and the audit holds the gap.

**Keep each layer to five or fewer records at onboarding.** Cover what a contractor (human
or AI) could violate silently. Everything else can emerge from audit findings later, which
is the normal path — each audit P1 that could be a lint becomes an ADR waiting to be
written.

---

### Step 3 — Capture why the software exists (PDRs)

<!-- Skip this step if you're not adopting docs/pdr/ -->

Before you record how the code is shaped, record what it's for. Every project runs on a
handful of product bets — who it serves, what it deliberately won't do, what has to
become true for it to matter. Those bets authorize every architectural decision underneath
them, and they are almost never written down.

**You cannot interview a codebase for purpose.** It isn't in there. It exists only in the
head of whoever is making the call, so the only way to get it is to ask them.

1. **Get the actual decision-maker in the room.** Not their proxy. A PDR corpus
   reconstructed by an engineer guessing at the founder's intent is fiction with line
   numbers.
2. **Write 3–5 records** in `docs/pdr/`, following `templates/pdr/_template.md`. Include
   at least one **non-goal** — the thing you've already decided not to build.
3. **Every record ships with a falsifier** — the observable condition that would retire
   it. **A decision without a falsifier is a wish.**
4. **Register each record in `docs/pdr/README.md`** — `check-adr-readme-sync.mjs` fails
   the build otherwise.

**Claude Code users:** the `pdr-interview` skill does this properly — it probes the repo
first, drafts candidates from real evidence, surfaces the places the repo contradicts
itself about its own purpose, and only then asks. Blank-slate interviews produce mission
statements; evidence-led interviews produce decisions.

---

### Step 4 — Capture the implicit decisions (ADRs with enforcement)

<!-- Skip this step if you're not adopting docs/adr/ -->

Every codebase already runs on a handful of load-bearing architectural decisions that
exist only in someone's head — "all DB access goes through the repository layer,"
"secrets never touch env vars," "migrations are append-only." Don't wait for the audit to
trip over violations one at a time. Capture them now.

**Architecture IS in the codebase.** Consistent patterns that would be expensive to break
are decisions, whether or not anyone wrote them down. The evidence agent does the heavy
lifting; the human confirms, corrects, and fills in the "why."

1. **Identify 3–5 decisions** the build actually depends on. Each one must be specific
   enough to be violated — "we follow good practices" is not a decision.
2. **Write each as an ADR** (`docs/adr/`) following `templates/adr/_template.md` — what
   is decided, why, what the consequences are, and what enforces it.
3. **Ship each ADR with its enforcement** — a lint, check, or CI gate in the same PR. An
   ADR without enforcement is a suggestion.
4. **Register each record in `docs/adr/README.md`** — `check-adr-readme-sync.mjs` fails
   the build otherwise.

**Claude Code users:** the `adr-interview` skill probes the codebase for consistent
patterns, existing lints without ADRs, and contradictions between modules. It then
interviews you to confirm which patterns are intentional, which are accidental, and which
need enforcement.

---

### Step 5 — Capture code quality conventions (clean code)

How should code be written in this repo? Naming, file organization, error handling
patterns, import conventions, dead code policy. Some of these are load-bearing (violation
causes bugs) and deserve ADRs with lints. Some are intentional but cosmetic (we prefer
it, but a violation isn't dangerous) and belong in a convention note. Some are accidental
— just how the first engineer happened to type.

1. **Run `clean-code-interview`** — it probes for naming patterns, file organization,
   quality invariants, existing lints without documentation, and contradictions between
   modules.
2. **Triage each candidate:** enforce (ADR + lint), document (convention note), or drop
   (accidental, not worth codifying).
3. **For "enforce" candidates:** write an ADR with the lint wired in the same PR. Many
   clean code conventions have off-the-shelf enforcement (eslint, ruff, prettier) — the
   work is configuration, not writing a custom script.
4. **For "document" candidates:** add to `CLAUDE.md` under `## Code Conventions` or to
   `CONTRIBUTING.md`. These are preferences, not rules.
5. **Record all three buckets in `docs/code-conventions.md`** (from
   `templates/code-conventions.md`). This is the layer's artifact — the DoD points at it,
   audit domain 8 measures against it, and its §3 (Not codified) is what stops the next
   refresh proposing the same accidental patterns again. A refresh that shipped ADRs and
   lints but left this file untouched produced nothing the audit can read.

**Don't over-promote to ADRs.** A repo with 20 ADRs about code style is a repo where
nobody reads ADRs. Reserve ADRs for conventions where violation causes bugs or wastes
work.

---

### Step 6 — Capture the testing strategy (test coverage)

How is code verified in this repo? What gets tested, at what level, and what's
deliberately untested? The tests exist in the codebase; the *strategy* behind them almost
never does.

1. **Run `test-coverage-interview`** — it maps coverage by module, identifies false-green
   tests, checks whether coverage thresholds are enforced, and surfaces contradictions
   between the DoD's test requirements and what CI actually gates.
2. **For each gap:** is it a real gap (file a tracking issue), deliberately untested
   (document why), or hard to test (file a tracking issue with the blocker)?
3. **Wire coverage enforcement:** if the team agrees on a threshold, configure it in the
   test framework and wire it as a required CI check. Start with the *current* coverage
   as the floor — don't set a target the codebase can't meet on day one.
4. **Remediate false-green tests:** stubs, skipped tests, and no-op assertions are worse
   than missing tests — they create the illusion of verification.
5. **Record it all in `docs/testing-strategy.md`** (from `templates/testing-strategy.md`):
   the floor, the coverage map, the deliberate exemptions, the false-green register, and §6
   — the properties no test verifies *at any level*. §6 is the section that pays: agent
   routing reads it as a tier lever, so each line there is a test whose absence is being
   billed at frontier rates on every issue that touches the surface.

---

### Step 7 — Audit agent instructions (CLAUDE.md / AGENTS.md)

What does an AI agent need to know to work effectively in this repo? Build commands, test
commands, lint commands, architecture overview, key files, conventions, and gotchas. If
the briefing is wrong, every agent that works in the repo makes the same mistakes.

1. **Run `agent-instructions-interview`** — it reads existing instruction files, verifies
   every command and path against the codebase, checks for missing sections, and
   surfaces contradictions between instructions and reality.
2. **The interview surfaces tribal knowledge** — the gotchas that aren't written anywhere
   but would cause an agent to do the wrong work on day one. This is the highest-value
   output.
3. **Verify every command and path.** A wrong command in CLAUDE.md is worse than a missing
   one — agents follow instructions into walls.
4. **Consolidate multiple instruction files** (CLAUDE.md + AGENTS.md + .cursorrules) into
   one primary. Overlapping but slightly different instructions are a drift factory.

If you don't have a `CLAUDE.md`, see `docs/claude-md-additions.md` for the full minimal
snippet. The `agent-instructions-interview` skill produces a complete, verified file from
scratch.

---

## Step 8 — Configure the audit workflow

Open `.github/workflows/scheduled-audit.yml` and set the cron schedule to fit your cadence. The default is weekdays at 09:00 ET (14:00 UTC).

The workflow prompt already covers eight domains (ADR coherence, docs drift, codebase discipline, GitHub backlog, watch-list sweep, PDR coherence, governance layer staleness, code quality and coverage). Domains 7 and 8 are a pair — 8 measures the clean-code and test-coverage layers against their records files, 7 decides whether that evidence means a layer needs refreshing. Delete the PDR domain if you're not adopting `docs/pdr/` — a domain that sweeps a directory you don't have reports nothing, which is indistinguishable from a clean result. If your repo has specific patterns you want audited — a particular directory, a specific naming convention, a known recurring drift type — add them to the prompt's "also check" section.

Ensure `ANTHROPIC_API_KEY` is available as a secret.

The workflow opens a PR each run with the audit doc (Phase 1). Review the findings, then run the remediation session on the same branch to apply dispositions and fixes (Phase 2). See `docs/definition-of-done.md` → Audit remediation for the checklist.

The companion `audit-deadman.yml` is the watchdog's watchdog: if no audit artifact appears for 4 days, it goes red and files a P1 issue. This matters more than it sounds — GitHub disables scheduled workflows after 60 days of repo inactivity, and an audit that dies produces *nothing*, so nothing turns red on its own. Set its cron to fire after your audit's window.

---

## Step 9 — Run your first audit

Either wait for the scheduled run or trigger it manually:

```bash
gh workflow run scheduled-audit.yml
```

Your first audit will be noisy. That's expected and useful — it's an inventory of existing drift, not a grade. The audit PR has a two-phase lifecycle:

**Phase 1 (audit session):** The audit runs, writes the doc, opens a PR, and stops. Review the findings.

**Phase 2 (remediation session):** Check out the audit branch, apply dispositions to each finding — fix P0s in the PR, file issues for P1s (cite them inline), WONT-FIX P2s with rationale — update the audit doc with dispositions, and push to the same PR. See `docs/definition-of-done.md` → Audit remediation for the checklist.

Merge the PR once CI is green and every finding has a disposition. The merged PR contains both the audit doc and the fixes.

As you fix findings, note which ones could have been caught by a lint. Each one of those is an ADR waiting to be written.

---

## Step 10 — Add governance health tracking (optional, recommended after 3+ audit cycles)

Once you have three audit docs, you have enough data to measure whether the practice is working. The `docs/governance-health-spec.md` in this repo is an implementation brief — read it, then implement it in your repo.

**What you get:** Four metrics derived entirely from artifacts already in your repo:

| Metric | Proxy for | Data source |
|---|---|---|
| Weighted new findings per audit | Change failure rate | Audit doc headline table |
| Median days P1 first seen → resolved | MTTR | Audit doc finding IDs |
| PR merge rate (merges/week) | Deployment frequency | GitHub API |
| PR open-to-merge time (p50/p90) | Lead time | GitHub API |

The first two are free — the audit docs already contain everything needed. The last two require a short `gh pr list` query.

**What to build:** A script (`scripts/governance-health.mjs` or equivalent) that reads the audit docs, queries GitHub, and writes `docs/governance-health.md` with a running trend table. Wire it into your audit workflow so it updates automatically. `templates/governance-health.md` shows the exact output shape, refined over 8 audit cycles in the reference implementation.

**When to look at it:** Monthly retrospective — not per-PR. You're measuring the governance system, not individuals. Don't set targets until you have 6+ data points; calibrate first.

See `docs/governance-health-spec.md` for the full output format, implementation plan, and notes on what not to do.

---

## Building lints over time

The DoD has a core rule: **enforcement ships with the promise, not after it.** When you write an ADR that says "we will always do X," a lint for X goes in the same PR.

Lints are just scripts that run in `npm run check` (or your equivalent pre-commit/CI step). Common first lints:

- **Migration naming** — enforce a prefix + sequential numbering convention
- **Schema from types** — if you derive JSON schemas from TypeScript, lint that no hand-authored schemas exist
- **Dependency declarations** — if tools declare their external dependencies, lint that declarations and implementations match
- **Test coverage shape** — if you have a three-tier test pattern, lint that each tier exists

You don't need any of these on day 1. Add them when an audit finding proves they're needed.

---

## What "done" looks like

After setup, your normal workflow looks like this:

1. Work on a feature or fix
2. Open a PR — the template prompts you for `Fixes #N` and the type-specific checklist
3. Satisfy the checklist before requesting review
4. Merge — GitHub closes the linked issue automatically
5. Each weekday morning, the audit runs and opens a PR with the audit doc (Phase 1)
6. Review the audit findings, then run the remediation session on the same branch — fix P0s, file issues for P1s, WONT-FIX P2s, update the doc with dispositions, push (Phase 2)
7. Merge the audit PR — audit doc and fixes land together

Over time: each audit P1 that could be a lint becomes a lint. The audit gets quieter. The codebase stays honest.

---

## Ongoing practice — the five-layer refresh cycle

The five-layer sweep (Steps 3–7) is not a one-time onboarding event. Each layer has a
staleness clock — the codebase changes, and the layer's artifacts drift from reality.
The refresh cycle keeps them honest.

### How staleness is detected

Two mechanisms detect when a layer needs refreshing:

1. **The audit (automatic):** Domain 7 checks each layer's staleness triggers and
   reports stale layers as P2 findings with the recommended refresh skill. This runs
   every audit cycle — you don't have to remember to check.

2. **The governance-sync check (on demand):** When a downstream repo checks for
   updates from repo-governance, the governance-sync section in CLAUDE.md tells the
   agent to check each layer's staleness trigger and run the matching refresh skill
   if stale. If nothing is stale, the agent skips the refresh step entirely.

### The staleness triggers

| Layer | Stale when… | Refresh skill |
|---|---|---|
| PDRs | `Last confirmed` > 90 days, or falsifier fired | `pdr-interview refresh` |
| ADRs | Lints without ADRs, ADRs Proposed 3+ cycles, module contradictions | `adr-interview refresh` |
| Clean code | Lint/formatter config changed, new modules violate conventions | `clean-code-interview refresh` |
| Test coverage | Coverage dropped, new untested modules, false-green tests | `test-coverage-interview refresh` |
| Agent instructions | Commands/paths don't match reality, tooling migrated | `agent-instructions-interview refresh` |

See `docs/definition-of-done.md` → Governance layer refresh for the full checklist.

### Refresh what's stale, not everything

The five layers have independent staleness clocks. A tooling migration makes agent
instructions stale but doesn't make PDRs stale. A product pivot makes PDRs stale but
doesn't make clean code conventions stale. Running all five refreshes when one layer
drifted is wasted effort — and effort that's wasted is effort that won't happen next
time.

### The closed loop

```
Five-layer sweep (onboarding) → artifacts seeded
        ↓
Audit detects staleness → recommends refresh skill
        ↓
Agent runs refresh skill → layer artifacts updated
        ↓
DoD + audit domains re-derived from updated artifacts
        ↓
Next audit reflects updated layers → quieter if refresh caught the drift
```

The whole system is a self-correcting loop: the five skills bootstrap the layers, the
DoD enforces them at PR time, the audit catches drift between them, and the refresh
skills bring them back into alignment. The audit gets quieter over time because each
refresh closes the gaps the audit was flagging.

### Dependent layers

When a refresh changes a layer's artifacts, check the dependent layers:

- **PDR superseded** → ADRs that served the old bet may need re-evaluation
- **ADR changed** → clean code conventions that express the ADR may need updating
- **ADR with new enforcement** → test coverage strategy may need to check the new invariant
- **Any layer changed** → agent instructions may need to reference the new artifacts

If a dependent layer is stale as a result, flag it for refresh in the same session or
file a tracking issue.

### The layer refresh log

Each downstream repo's CLAUDE.md includes a `### Layer refresh log` table (installed by
the governance-sync section). This tracks when each layer was last refreshed and what
triggered it. The staleness check compares this against the triggers — if a layer was
refreshed recently and nothing has changed, it's not stale.

---

## Keeping the templates current

If you run this practice in multiple repos, your fastest-moving repo will generate improvements that should flow back to the templates — new DoD rules born from real incidents, "why this rule exists" sections filled in from actual outages, new work types that turned out to matter.

**For Claude Code users:** The `.claude/commands/sync-from-repo.md` skill automates this. Invoke `/sync-from-repo` from inside this repo after a sprint boundary in your source repo. It reads both repos' governance artifacts, abstracts any implementation-specific details, and applies proposed improvements as `[PROPOSED]` markers directly in the template files for you to review and accept or reject.

The intended flow:
1. Build and refine new practices in your live repo (audit → lint → DoD update)
2. Run `/sync-from-repo` when things stabilize
3. Review `[PROPOSED]` markers, remove the ones that don't generalize
4. Commit and the improvement is available for all future repos
