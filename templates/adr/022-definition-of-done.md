<!-- template: adr/022-definition-of-done.md v1.0.0 · updated 2026-07-24 -->
# ADR-022: Definition of Done is a First-Class Policy

**Status:** Accepted
**Date:** [DATE]

---

## Context

Every codebase has an implicit definition of done. The implicit version is: "CI is green and I think it's ready." This produces a predictable failure mode: work that passes CI but lacks tests, leaves docs stale, or promises lints that never ship.

The failure mode compounds because deferred items rarely get picked up. A "known gap" without a tracking issue is a gap that never gets fixed. An ADR that moves to Accepted before its promised enforcement exists will be violated by the next engineer who doesn't read every ADR.

## Decision

The Definition of Done is a first-class policy, enforced by:
1. A per-work-type checklist in `docs/definition-of-done.md`
2. A PR template that surfaces the relevant checklist items at submission time
3. A periodic staleness audit that catches what slips through

An ADR cannot move to **Accepted** status until every lint or check it promises is wired into CI and passing. Existing violations must be fixed or explicitly grandfathered with a named tracking issue. The reviewer is responsible for confirming enforcement exists before approving.

## Consequences

- **PRs take slightly longer** — writing a regression test or updating a doc adds time. This is the intended cost. It is cheaper than the debugging session caused by missing the test.
- **ADRs accumulate lints over time** — each accepted ADR with a lint promise creates a script in CI. The lint corpus grows with the decision record.
- **The audit is the safety net, not the primary gate** — the audit runs periodically and catches what the DoD missed. A mature codebase's audit should be quiet. A noisy audit means a DoD rule needs a lint.

## References

- `docs/definition-of-done.md` — the per-work-type checklists
- `.github/pull_request_template.md` — the PR-time enforcement surface
- The scheduled staleness audit (`.github/workflows/scheduled-audit.yml`, or your in-platform equivalent) — the periodic catch-all
- `.github/workflows/audit-deadman.yml` — the probe that goes red if the audit itself silently dies
