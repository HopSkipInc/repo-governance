<!-- template: testing-strategy.md v1.0.0 · updated 2026-07-27 -->
# Testing Strategy — Records for [repo]

**Last refreshed:** [YYYY-MM-DD] by [name] (`test-coverage-interview`)
**Refresh trigger that fired:** [bootstrap | coverage dropped | new untested module | false-green found | audit finding AUDIT-…-COVERAGE-NN]

> **This file never syncs.** It is a *records* file, like `docs/agent-routing-records.md`.
> The blank form ships from repo-governance; everything written into it is local and dated.
> A `cp` from the governance repo must never touch this file.

> **The tests are in the codebase. The strategy is not.** A coverage report says module B is
> at 0%. It cannot say whether that is a gap or a decision. This page is where that answer
> lives, and it is the reason the audit can stop re-reporting the same "gap" every cycle.

---

## 1. Coverage floor — the gate

| | |
|---|---|
| **Floor** | [N]% |
| **Actual at last refresh** | [N]% ([YYYY-MM-DD]) |
| **Where configured** | [`jest --coverageThreshold` \| `vitest coverage.thresholds` \| `pytest --cov-fail-under` \| `coverlet /p:Threshold`] |
| **Gate status** | required check \| advisory \| none |
| **Also gated** | coverage does not decrease on files changed by the PR — [yes / no / not wired] |

**The floor starts at current actual, not at the aspiration.** A threshold the codebase
cannot meet on day one gets disabled, and a disabled gate teaches the team that gates are
advisory. Raise it deliberately, and record the raise below.

**A floor far under actual is not a gate.** If actual is 78% and the floor is 40%, nothing
is being caught — the number exists to be reported, not to fail. Either raise it or write
down that this is a report-only metric, but do not leave it looking like enforcement.

| Date | Floor | Actual | Note |
|---|---|---|---|
| [YYYY-MM-DD] | [N]% | [N]% | [e.g. "floor set to actual at bootstrap"] |

## 2. Coverage map

One row per source directory or module. **The `Status` column is the whole point** — it is
what distinguishes a gap from a decision, and it is what the audit reads so it stops
flagging deliberate choices as findings.

`Risk surface?` cross-references §6 of `docs/agent-routing-records.md`. Keep the two in
agreement: a surface listed there as uncovered must appear here as a gap or a deliberate
choice, never as an omission.

| Module / path | Test levels present | Status | Risk surface? | Tracking |
|---|---|---|---|---|
| [`src/foo/`] | unit, integration | covered | no | — |
| [`src/bar/`] | none | **gap** | yes | [#N] |
| [`src/types/`] | none | deliberate — see §3 | no | — |
| [`src/baz/`] | none | **hard to test** — [blocker] | yes | [#N] |

Status values, and what each obliges:

- **covered** — nothing owed.
- **gap** — a real hole. Needs a tracking issue. Counts against the repo in triage.
- **deliberate** — a decision, recorded in §3 with its reason. The audit will not flag it.
- **hard to test** — a gap plus a named blocker (missing fixture, no test double for an
  external system, needs infrastructure). Needs a tracking issue naming the blocker, not
  the coverage. "We should test this" is not a blocker.

## 3. Deliberately untested

The register that keeps §2's `deliberate` rows honest. Anything here is exempt from audit
findings **and from the routing coverage lever** — so a wrong entry here is a silent way to
downgrade real risk. Review these at every refresh.

| Path | Why it is not tested | Would we notice if it broke? | Reviewed |
|---|---|---|---|
| [path] | [generated code / thin wrapper / covered transitively through X / slated for deletion #N] | [what would catch it instead] | [YYYY-MM-DD] |

**"Would we notice if it broke?" is the question that keeps this list short.** If the answer
is no, it is a gap wearing a decision's clothes.

## 4. Test levels — what each is for

| Level | What it covers | Where it lives | How it runs | Runtime |
|---|---|---|---|---|
| unit | [pure logic, no I/O] | [alongside source \| `tests/unit/`] | [`npm run test:unit`] | [Ns] |
| integration | [real data store, real wiring] | [`tests/integration/`] | [`npm run test:integration`] | [Ns] |
| e2e | [user-visible paths] | [`tests/e2e/`] | [`npm run test:e2e`] | [Ns] |

- **Fast/slow separation:** [is there one? can a developer run only the fast tier locally?]
- **What integration tests must exercise:** the same wiring the runtime uses and the
  top-level entry point — not a standalone double and not an inner helper. A test that
  bypasses constraints and identifier resolution passes for the wrong reason.

## 5. False-green register

Tests and test scripts that pass without verifying anything. **These are worse than missing
tests** — the coverage report counts the file, CI is green, and nothing is checked.

| What | Where | Kind | Disposition |
|---|---|---|---|
| [name] | [path] | no-op assertion \| skipped, untracked \| stub script \| catch-all \| no assertions | fixed [PR] \| deleted \| tracked [#N] |

Mechanical detection: `scripts/lint-stub-tests.mjs` catches the stub-script class
(`echo "not implemented" && exit 0`). The other classes are found by reading, which is why
they belong on a page a human refreshes rather than in a lint alone.

## 6. What tests do not verify at all

The honest section. Failure modes this repo has no test for at any level — not because the
module is untested, but because the property is not the kind of thing the suite checks:
cross-tenant leakage, ordering under concurrency, an idempotency claim, a rate limit that
only exists in schema.

**This section is a routing input.** Each line here is a surface where a wrong result looks
correct, which is the exact condition that pushes an issue above `standard`. Closing one of
these is the cheapest available way to lower the repo's frontier ratio — see the coverage
lever in `docs/agent-routing.md`.

| Property not verified | Surface | What a silent failure looks like | Tracking |
|---|---|---|---|
| [e.g. cross-tenant read scoping] | [paths] | [rows from another tenant returned; response shape identical] | [#N] |

## Review log

| Date | Trigger | What changed |
|---|---|---|
| [YYYY-MM-DD] | bootstrap | [e.g. "floor set at 61% actual; 3 gaps filed; 2 false-greens deleted; 4 deliberate exemptions recorded"] |
