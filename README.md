# repo-governance

Templates and recipes for sustainable engineering governance: Definition of Done, staleness audits, lint-enforced architecture decisions, and a five-layer skill suite that probes an existing codebase and interviews the team to bootstrap governance artifacts.

---

## What this is

A small, portable practice built around five observations:

1. **"CI is green" is not the same as "done."** Every codebase drifts — docs go stale, ADRs promise lints that never ship, bugs recur because there was no regression test. A Definition of Done (DoD) is a per-work-type checklist that makes "done" explicit before a PR merges.

2. **Lints catch things before they happen; audits catch things after they slip through.** The DoD tells you what to check. Lints enforce the most important rules automatically. A periodic staleness audit catches everything that's too expensive or too infrequent to lint.

3. **The practice compounds.** Each audit finding that could have been a lint becomes a lint. Over time, the audit gets quieter and the signal improves. You start with the audit; the lints are its output.

4. **A build can be perfectly disciplined and still be pointed at the wrong thing.** Every check above compares one repo artifact to another — code to docs, ADRs to lints. None of them can tell you the product drifted from its reason for existing, because purpose isn't in the repo to compare against. That failure is silent: no red CI, no failed test, just velocity in the wrong direction. Product Decision Records give it something to compare against.

5. **Every layer of "why" can be bootstrapped by probing the codebase — except purpose.** Architecture is in the patterns. Code conventions are in the naming and structure. Test strategy is in the coverage map. Agent instructions are in the config files. Each has a skill that probes the repo, drafts candidates from evidence, and interviews the human to confirm. The five-layer sweep turns an existing codebase into a seeded governance corpus in one onboarding session.

## What you get

| Artifact | Layer | What it does |
|---|---|---|
| `templates/definition-of-done.md` | Policy | Per-work-type done checklist |
| `templates/adr/_template.md` | Policy | Blank ADR form — every ADR ships with its enforcement (lint/check/gate) |
| `templates/adr/README.md` | Policy | ADR index template — `lint:adr-readme-sync` fails the build on unregistered records |
| `templates/adr/022-definition-of-done.md` | Policy | ADR giving DoD its authority (optional, for ADR-using repos) |
| `templates/pdr/` | Policy | Product Decision Records — who this serves, what bet it makes, what it won't do. Every record carries the condition that would retire it |
| `templates/adr/023-product-decision-records.md` | Policy | ADR giving PDRs their authority (optional, for ADR-using repos) |
| `templates/pull_request_template.md` | Friction | `Fixes #N` prompt + per-type checklists on every PR |
| `templates/workflows/scheduled-audit.yml` | Automation | Daily weekday Claude-powered staleness audit → PR |
| `templates/workflows/audit-deadman.yml` | Automation | Dead-man probe — goes red and files a P1 if the audit itself silently dies |
| `templates/workflows/db-migration-harness-*.yml` | Automation | Ephemeral-DB migration harness as a required PR gate (Postgres + SQL Server) |
| `templates/issue-authoring.md` | Policy | Issue schema + label taxonomy so every issue is born actionable |
| `templates/db-migration-governance.md` | Standard | DbUp mandate, append-only discipline, squash triggers, audit checklist |
| `templates/watch-items.md` | Policy | Watch-list format — anything deferred on a condition, swept by the audit |
| `templates/governance-health.md` | Measurement | Output shape for the auto-generated DORA-proxy metrics doc |
| `templates/scripts/check-adr-readme-sync.mjs` | Lint (GATE) | Every ADR and PDR must be registered in its index — catches numbering collisions |
| `templates/scripts/check-breaking-migrations.mjs` | Lint (GATE) | A dropped/renamed migration column or table must have zero remaining code references |
| `templates/scripts/check-magic-strings.mjs` | Lint (GATE, TS repos) | A value from an exported type alias used as a magic string instead of the alias's constant |
| `templates/scripts/check-inline-type-unions.mjs` | Lint (GATE, TS repos) | An inline string-literal union that duplicates an exported type alias elsewhere |
| `templates/scripts/check-duplicated-sql.mjs` | Lint (GATE, TS repos) | A SQL query inlined in 2+ files instead of centralized in one registry/adapter |
| `templates/scripts/check-root-clutter.mjs` | Lint (GATE) | Repo root holds project-defining files only — working files must live in a subdirectory |
| `templates/scripts/check-schema-promises.mjs` | Lint (GATE) | An enforcement-bearing schema element (RLS policy, rate-limit/lifecycle column) must have a real consumer or a tracked dormant-schema entry |
| `templates/scripts/lint-stub-tests.mjs` | Lint (REPORT, npm repos) | A `test`/`test:*` script that exits 0 without running anything — false-green CI |
| `templates/skills/competitive-analysis/` | Skill | Self-discovering competitive analysis → a watch-item doc + PR |
| `templates/skills/pdr-interview/` | Skill | Probes the repo, then interviews the person who holds the thesis → a PDR corpus + PR |
| `templates/skills/adr-interview/` | Skill | Probes the codebase for load-bearing patterns, surfaces enforcement gaps → an ADR corpus with lints + PR |
| `templates/skills/clean-code-interview/` | Skill | Probes for naming/organization conventions, triages intentional vs accidental → coding standard ADRs + convention notes + PR |
| `templates/skills/test-coverage-interview/` | Skill | Maps coverage gaps and false-green traps, interviews for testing strategy → testing standard ADRs with coverage gates + PR |
| `templates/skills/agent-instructions-interview/` | Skill | Reconciles CLAUDE.md/AGENTS.md against reality, surfaces tribal knowledge → verified agent instructions + PR |
| `templates/agent-routing.md` | Policy | `impl:` tier on every issue (standard/frontier/human) + kind (spec/inherent/both) so a dispatcher routes by failure mode, not difficulty |
| `templates/skills/routing-triage/` | Skill | Bootstraps or refreshes a repo's agent-routing tiers — delegates classification to a model-pinned subagent |
| `templates/agents/routing-classifier.md` | Agent (Claude Code) | Pinned-model classifier subagent — proposes tiers, read-only by construction. Per-repo |
| `templates/agents/routing-classifier.opencode.md` | Agent (opencode) | Same classifier, opencode-native frontmatter (`mode: subagent`, `permission:` block). Global — one agent serves every repo |
| `templates/routing-calibration-protocol.md` | Protocol | Freeze predictions, run a weak model at the backlog, measure the gap — validates the tier taxonomy |
| `templates/scripts/check-issue-routing.mjs` | Lint (GATE) | Six mechanical routing rules via GitHub API — structural errors fail, contradictions warn |
| `templates/governance-sync-claude-section.md` | Integration | CLAUDE.md breadcrumb so downstream agents can self-navigate to governance |
| `docs/claude-md-additions.md` | Integration | The two lines to add to `CLAUDE.md` or session instructions |
| `docs/personas.md` | Reference | Named roles (repo owner, reviewer, auditor, remediator) used by templates — most small teams collapse all into the founder |
| `docs/governance-health-spec.md` | Measurement | Implementation spec for DORA-proxy metrics derived from audit docs |

## How to apply it

See [GETTING_STARTED.md](./GETTING_STARTED.md) — roughly 20 minutes for a new repo, 40 minutes if you have existing ADRs to reconcile. The five-layer sweep (Steps 3–7) adds 30–60 minutes if run interactively, or can be spread across sessions.

## The compounding dynamic

```
Five-layer sweep bootstraps artifacts (PDRs, ADRs, conventions, tests, agent instructions)
        ↓                                              ↑
Audit catches drift → recommends refresh skill → layer artifacts updated
        ↓                                              ↑
Finding prompts a lint → lint enforces pre-commit → next audit is quieter
        ↓
governance-health.md tracks failure rate + MTTR over time
```

The system is a self-correcting loop: the five skills bootstrap the layers, the DoD
enforces them at PR time, the audit catches drift and recommends refreshes, and the
refresh skills bring the layers back into alignment. The audit gets quieter over time
because each refresh closes the gaps the audit was flagging.

Start with just the audit and DoD. Add the five-layer sweep when you're ready to seed
the governance artifacts. Run refresh skills when the audit says a layer is stale —
not on a fixed schedule, not all at once, only what's drifted.

## The five layers of governance

Each layer answers a different question, and each has a skill that probes the codebase,
drafts candidates from evidence, and walks the human through confirming or filling in the
gaps:

| Layer | Artifact | Answers | Skill | Evidence vs. interview |
|---|---|---|---|---|
| Product | `docs/pdr/` | Why does this software exist at all? | `pdr-interview` | Interview is origination — purpose is not in the codebase |
| Architecture | `docs/adr/` | Why is the code shaped this way? | `adr-interview` | Probe is primary — architecture IS in the codebase; interview confirms |
| Clean code | conventions + ADRs | How should code be written? | `clean-code-interview` | Probe + triage — intentional vs. accidental patterns |
| Test coverage | testing ADRs + gates | How is code verified? | `test-coverage-interview` | Probe maps what exists; interview fills in the strategy |
| Agent instructions | `CLAUDE.md` / `AGENTS.md` | How are agents briefed? | `agent-instructions-interview` | Probe reconciles docs with reality; interview surfaces tribal knowledge |

The bottom four are recoverable from the repo — you can probe a codebase for its
architecture, conventions, test coverage, and instruction accuracy. **The top one isn't.**
Purpose exists only in a human's head, which is why the PDR corpus is the one artifact
here that can't be bootstrapped by reading code. See `templates/skills/pdr-interview/`.

## Keeping templates current

If you run this practice across multiple repos, one of them will evolve faster than the templates — audit findings will generate new DoD rules, and "why this rule exists" sections will fill in from real incidents. The `.claude/commands/sync-from-repo.md` skill (for Claude Code users) diffs a live source repo against these templates and applies abstracted improvements as `[PROPOSED]` markers for review.

## What this is not

- A build system or CI framework — it integrates with whatever CI you already have
- An opinionated ADR format — bring your own or start fresh
- Specific to any language or stack — the templates are plain Markdown and GitHub Actions YAML

---

Built from practice in [ai-fleet](https://github.com/HopSkipInc/ai-fleet). Refined over eleven audit cycles and counting — including two silent failures of the audit machinery itself, which is why the dead-man probe exists.
