# Testing Strategy — Records for repo-governance

**Last refreshed:** 2026-07-27 by Greg (`test-coverage-interview`, dogfood run)
**Refresh trigger that fired:** bootstrap

> **This file never syncs.** Blank form is `templates/testing-strategy.md`; contents are local.

> **What is being verified here.** This repo ships markdown and lints. The lints are the only
> executable artifact, and they are the only thing a test can verify. Everything else is
> verified by being applied to a real repo — which is a real strategy, and one that has
> historically found its bugs late.

---

## 1. Coverage floor — the gate

| | |
|---|---|
| **Floor** | not a percentage — see below |
| **Actual at last refresh** | n/a (no instrumented suite) |
| **Where configured** | `test/*.test.mjs`, run by `node --test` in `.github/workflows/governance-lints.yml` |
| **Gate status** | required check |
| **Also gated** | — (a line-coverage delta is not meaningful for 5 scripts and 69 markdown files) |

**The floor is a rule, not a number:** *every script in `scripts/` has a fixture test that
asserts it fires on a known-bad input and clears on a known-good one.*

A percentage would be theatre here. The rule is aimed at the failure this repo has actually
had, twice, and it is the only failure a lint has: **a check that quietly stops checking.**

- `check-template-versions` rule 3 compared dates instead of versions, so a same-day edit
  compared equal — it "was blind to the case it existed for" (`8db1f67`).
- `check-issue-routing` used a `\Z` anchor, which JavaScript does not have, so the block
  terminator degraded to "followed by a literal Z" and every correctly-formatted issue in a
  live repo was reported as malformed.

Both shipped. Both were found by a human reading output. A passing lint and a broken lint
produce identical CI output, which is what makes this the right floor for this repo.

| Date | Floor | Actual | Note |
|---|---|---|---|
| 2026-07-27 | fixture test per own-lint | 4 of 5 scripts covered | `check-downstream-drift.mjs` is the exception — see §2 |
| 2026-07-27 | fixture test per own-lint | 6 of 7 scripts covered | PDR bootstrap added two lints, both covered on arrival. The rule held on its first test: `check-pdr-falsifiers` R2 was wrong about 5 of 7 real falsifiers and the fixtures pinned the corrected split |
| 2026-08-02 | fixture test per own-lint | 7 of 7 scripts covered | `check-downstream-drift.mjs` covered (#20) — the "hard to test" note was defeated by the `lens.test.mjs` fixture shape: throwaway git repo, fake client checkouts at absolute paths inside it |

## 2. Coverage map

| Module / path | Test levels present | Status | Risk surface? | Tracking |
|---|---|---|---|---|
| `scripts/check-blank-form-naming.mjs` | fixture (7 cases) | covered | no | — |
| `scripts/check-template-versions.mjs` | fixture (3 cases, R1–R2) | **partial** — R3 (bump-on-change) needs `--base` and real history | yes | unfiled |
| `scripts/check-analyze-repo-coverage.mjs` | fixture (2 cases) | covered | no | — |
| `scripts/check-issue-routing.mjs` | fixture (6 cases, `gh` stubbed on PATH) | covered | yes | — |
| `scripts/check-pdr-falsifiers.mjs` | fixture (9 cases, all 4 rules) | covered | yes | — |
| `scripts/check-adr-readme-sync.mjs` | fixture (2 cases) | covered | no | — |
| `scripts/check-downstream-drift.mjs` | fixture (10 cases, `test/drift.test.mjs`) | covered — both declared-path dialects, all four finding classes, SKIPPED | yes | #20 |
| `templates/scripts/*.mjs` (8 files) | none | deliberate — see §3 | yes | — |
| `templates/**/*.md`, `docs/`, `downstream/` | bootstrap smoke test | **partial** — see §6 | yes | — |

**R3 is the untested rule that matters most.** It is the one that already failed silently,
and it is untested because its fixture needs two commits in a throwaway repo rather than a
file tree. That is a fixture-shape problem, not an impossibility — it is a gap, and it is
recorded as one rather than being quietly folded into "covered".

## 3. Deliberately untested

| Path | Why it is not tested | Would we notice if it broke? | Reviewed |
|---|---|---|---|
| `templates/scripts/*.mjs` (the 8 downstream lint templates) | They parse other repos' source trees. A fixture would be a synthetic TypeScript/SQL tree per lint, and would test the fixture's shape more than the lint | **Partly, and late.** A client's first run surfaces it — which is the same "found by a human reading output" path that let two bugs ship here. Honest status: this is a gap being accepted on cost, not a property that cannot be verified | 2026-07-27 |
| `templates/**/*.md` prose | Prose correctness is not mechanically checkable | No — this is what the audit and `/review-sync` exist for | 2026-07-27 |
| `gtm/` | Sales collateral, not shipped artifacts | Not applicable | 2026-07-27 |

**The first row is the weak one on this page.** `check-issue-routing.mjs` was in exactly that
category until 2026-07-27, and it got a fixture in an afternoon with a 40-line `gh` stub —
after shipping the `\Z` bug to a live backlog. Re-read this row at the next refresh with that
in mind.

## 4. Test levels — what each is for

| Level | What it covers | Where it lives | How it runs | Runtime |
|---|---|---|---|---|
| fixture | one lint against a throwaway git repo built per case | `test/lints.test.mjs` | `node --test test/*.test.mjs` | <1s |
| bootstrap smoke | the whole template set applied to a throwaway repo, per GETTING_STARTED's own commands | `test/bootstrap-smoke.test.mjs` | same | <1s |
| live | the lints run against real backlogs (`ROUTING_REPO=<owner>/<repo>`) | — | by hand, during triage | seconds |

- **Fast/slow separation:** not needed. The whole suite is under a second.
- **No mocking framework, no runner dependency.** `node:test` + `node:assert`, no
  `package.json`. Adding one would imply this repo is a publishable package.
- **The bootstrap smoke test derives its bootstrap from `GETTING_STARTED.md` itself** — it
  parses and executes the guide's `mkdir`/`cp` lines. A hand-kept copy list would test the
  list. This tests the instructions a client actually follows.

## 5. False-green register

| What | Where | Kind | Disposition |
|---|---|---|---|
| — | — | — | Nothing found. There was no suite to be falsely green |

Two adjacent habits already in place, and both are the right ones — record them so a later
refresh does not "simplify" them away:

- `check-template-versions` prints `(Rule 3 needs --base <ref>.)` and exits 0 rather than
  reporting a pass that silently skipped its most important rule.
- `check-issue-routing` R6 reports **SKIPPED**, never passing, when the GraphQL
  `userContentEdits` query is unavailable. *A check that fails open reads as evidence.*

## 6. What tests do not verify at all

**This section is a routing input.** Each line is a surface where a wrong result looks
correct — the exact condition that pushes an issue above `standard`.

| Property not verified | Surface | What a silent failure looks like | Tracking |
|---|---|---|---|
| **A template is *correct* when applied** — only that it exists (`check-template-versions`), is listed (`check-analyze-repo-coverage`), and that the guide's copies land and the copied lints pass (`bootstrap-smoke`) | `templates/**` | A client bootstraps, CI is green, and the artifact is subtly wrong — a sweep globbing a renamed directory reports nothing, which is indistinguishable from "nothing to report" | partially closed 2026-07-27 by `test/bootstrap-smoke.test.mjs`; the residue is prose correctness and conditional (DB/TypeScript) template paths |
| **The 8 downstream lint templates run at all** before reaching a client | `templates/scripts/` | A client installs a lint that crashes, or worse, one that passes because its regex silently matches nothing | unfiled — see §3 row 1 |
| **Rule 3 of `check-template-versions` still detects a bump-less change** | `scripts/check-template-versions.mjs` | The stamp drift rule stops firing and every template reads as current | unfiled — see §2 |
| **`check-downstream-drift` findings reach a human** | client sync boundary | 10 blocking findings sit in a script nobody runs; a client is reported as governed at a version it does not have | see `docs/code-conventions.md` §5 |

**Nothing currently escalates on these**, because this repo's open backlog is empty. When it
is not, an issue touching `templates/scripts/` should carry
`Coverage gap: #N` per the coverage rule in `templates/agent-routing.md` — row 2 above is the
line it would cite.

## Review log

| Date | Trigger | What changed |
|---|---|---|
| 2026-07-27 | bootstrap | Floor set as a rule rather than a percentage. 19 fixture cases across 4 lints + 6 bootstrap-smoke cases, all wired into CI. Two bugs found by writing the tests: `check-blank-form-naming` R1 could not see a form numbered like a record (R3 added), and its record pattern matched date-prefixed files. One live defect found by the smoke test: GETTING_STARTED's ADR block never copied `README.md`, so a repo following it exactly had red CI on day one — live since session 13 |
