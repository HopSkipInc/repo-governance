# PDR-008: Claim coverage is a health metric, not an audit domain

**Status:** Accepted
**Date:** 2026-08-02
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-08-02

---

## Context

The 2026-07-31 open-refinery scan surfaced a formalization this repo's records had been
circling without naming: every governance **claim** is backed by an *instruction*, a
*gate*, both, or neither, and a claim backed by neither is an **imitation surface** —
it reads as governed and nothing enforces it. The definitions shipped in
`templates/governance-health.md` v1.1.0 (#17); the worked example over this repo's own
recorded claims landed in `docs/claim-backing-example.md` (#18). What remained was where
the aggregate metric — the fraction of claims backed by both — **computes**.

Two homes were on the table. A section of `templates/governance-health.md`, beside the
other trend metrics. Or a ninth domain of `templates/workflows/scheduled-audit.yml`,
beside domain 8, which already implements claim-vs-enforcement checks ad hoc — its §1
rule ("Enforcement cell empty, aspirational, or naming a rule that does not exist → P1")
is an imitation-surface detector pointed at one table, filing per-row findings.

What we know and how: domain 8's checks are instance-level — *this* claim lacks
enforcement, here is the severity and the recommended action — and they exist to drive
remediation. The metric is the aggregate of the same comparison — *what fraction* of
claims are enforced — and an aggregate is only useful as a trend. We also know the
enumeration hazard from the routing sweep that split #13: an enumerator that
under-counts silently reports high coverage, and the metric becomes the thing it
measures. The derivation rule therefore fails closed (SKIPPED, never a partial score),
and there is exactly one enumerator — two enumerators drifting apart would be
indistinguishable from agreement.

## Decision

Claim coverage computes in the **health report**: `templates/governance-health.md`
gains a Claim coverage section carrying the derivation contract — the claim sources
(`docs/definition-of-done.md`, `CLAUDE.md`, `docs/code-conventions.md` §1–§2), the
backing classes, the fail-closed rule — and one enumerator produces the inventory the
metric aggregates. The metric answers "what fraction, and which way is it trending."

**Audit domain 8 is left in place alongside, not superseded.** It answers a different
question — "*this* claim is unenforced, here is the finding" — and its findings are
what move the metric. The boundary between them: the enumerator verifies that the
enforcement a claim names *exists* (a mechanical path check); domain 8 verifies the
deeper claim that it is *wired* (in CI, on a trigger), which is judgment-adjacent and
stays in the audit.

The enumerator ships repo-local (`scripts/`, with fixtures) for the mothership first —
the same pattern as `check-mothership-drift.mjs` — and the health-template section is
the contract client health generators implement per repo. Consequence stated plainly:
**this repo reports SKIPPED, not a score**, because it has no
`docs/definition-of-done.md` — one of the three named sources is absent, and the
fail-closed rule holds against the mothership before it holds against anyone.

## Falsifier

- [ ] Revisit by 2026-11-02 when the enumerator has run for 90 days in any governed
  repo — or earlier if a human reading one enumeration output finds a claim present in
  a source artifact that the enumerator missed. An under-counting enumerator is the
  failure this record exists against; one visible miss retires the derivation rule.
- [ ] Revisit when a second governed repo's generator implements the contract, if the
  two implementations report different claim counts for the same artifacts — the
  contract is ambiguous where it pretends to be mechanical.

## Consequences

Authorizes: the health-template section (stamp bump), the repo-local enumerator with
fixture tests, and the `docs/testing-strategy.md` §2 row for it — one implementation
PR. Forecloses, until superseded: a ninth audit domain computing the same fraction;
merging the metric into domain 8 (two enumerators); templating the enumerator itself
before a client generator has run the contract. No sweep mechanics change, so no
`docs/code-conventions.md` §5 row is owed.
