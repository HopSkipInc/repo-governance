<!-- template: adr/_template.md v1.1.0 · updated 2026-08-08 -->
# ADR-NNN: <Title>

**Status:** Proposed | Accepted | Rejected | Superseded by ADR-NNN | Retired
**Date:** YYYY-MM-DD

---

## Context

What problem this decision solves. Written so a stranger could read it and understand
why this was a decision, not a default.

State what was happening before, what failure mode it produced, and what alternatives
were considered. Where the decision was driven by a specific incident, cite it. Where
the decision was discovered by probing the codebase rather than made deliberatively,
say so — "the codebase has done this consistently since the first commit" is valid
context, and noting it as discovered vs. decided is the difference between an ADR and
a retroactive justification.

## Decision

What is decided. One sentence, specific enough to be violated.

"We use a repository layer for all database access" can be violated. "We follow good
engineering practices" cannot. If you cannot state what would violate this decision,
it is not a decision — it is a platitude.

## Enforcement

What lint, check, or CI gate enforces this decision. An ADR cannot move to **Accepted**
without enforcement wired and passing. This is the architecture-layer form of the DoD's
core rule: enforcement ships with the promise, not after it.

If the enforcement is genuinely expensive to build now, the ADR stays **Proposed** with
a tracking issue, and the audit holds the gap.

- **Lint/check:** <script name or CI step, or "not yet built — tracking issue #N">
- **Wired into:** <npm run check / CI workflow name / pre-commit hook>

## Consequences

What this commits us to. What it forecloses. What work it authorizes — and what work it
makes off-limits without superseding this record first.

## References

- Related ADRs, docs, issues, PRs

---

<!--
==============================================================================
DELETE EVERYTHING BELOW THIS LINE WHEN YOU WRITE A REAL ADR
==============================================================================

## What an ADR is

An ADR records a decision about how the code is shaped — architectural patterns,
conventions, and invariants that would be expensive to break. A PDR records a decision
about why the software exists at all.

The test: an ADR is falsified by engineering reality. A PDR is falsified by market
reality. "All DB access goes through the repository layer" is an ADR. "We serve solo
operators, not agencies" is a PDR. If you cannot say what external event would make the
decision wrong, it is probably an ADR.

## The rule

**An ADR without enforcement is a suggestion. Every ADR ships with the lint, check, or
CI gate that enforces it.**

This is the architecture-layer form of the DoD's core rule — enforcement ships with the
promise. A PDR without a falsifier is a wish; an ADR without a lint is a hope.

An ADR with no enforcement can never be violated loudly. It can only be violated
silently, which is the exact failure mode the ADR exists to prevent.

## Enforcement discipline

The enforcement must be **deterministic** — a script that exits 0 or non-zero, not a
judgment call. "The reviewer checks that X" is not enforcement; it is optimism about
reviewers. "The CI fails if X" is enforcement.

Good:
- `scripts/check-repository-pattern.mjs` — fails if any source file imports a DB driver
  directly instead of going through `src/repositories/`
- CI gate on migration naming — fails if a migration file doesn't match `NNN_*.sql`
- `npm run lint` includes a custom rule that rejects inline SQL in route handlers

Not good:
- "Code review ensures X" — reviewers are not deterministic
- "We agreed to X" — agreements rot the moment someone is under pressure
- "The README says X" — documentation is not enforcement

If you cannot write a lint for it, the ADR stays Proposed with a tracking issue. The
audit will flag it every cycle until the lint ships or the ADR is superseded.

## Discovered vs. decided

Many ADRs are discovered by probing the codebase, not made deliberatively. "Every file
in src/services/ exports a register() function" might be a deliberate pattern or might
be how the first engineer happened to do it and everyone else copied. Both are valid
ADRs — the codebase enforces the convention whether or not anyone decided it.

When writing a discovered ADR, note in Context that it was discovered, not decided. The
interview's job is to confirm the pattern is intentional (or at least load-bearing enough
to enforce). If it's accidental and not load-bearing, it's not an ADR — it's just how
the code happened to be written, and codifying it adds friction without value.

## Changing your mind

Never edit a Decision in place. Write a new ADR that supersedes the old one, set the old
one's Status to `Superseded by ADR-NNN`, and leave its Context intact. The record of
what you believed and why you changed it is the most valuable thing in the corpus.

A superseded ADR is not an embarrassment; it is evidence the mechanism works.

## Deciding against it — Rejected

A proposal that is argued down is a decision, and it needs a record for the same reason
an accepted one does: without it, deletion is the only option, and a deleted proposal
comes back. Six months later nobody remembers the argument, someone re-proposes it, and
it gets re-litigated from scratch.

Set Status to **Rejected** and leave Context and Decision **intact** — the proposal has
to still be readable, or the record cannot stop the re-proposal it exists to stop. State
in Consequences **what would reopen it**: the observable change in the world that would
make this worth revisiting. That line is the mirror of a falsifier. A Rejected record
without one is not a decision, it is a mood, and it will be overturned by whoever argues
hardest next time.

Replace the Enforcement section with a single line — `Enforcement: n/a — Rejected` — and
do not delete the heading. A Rejected record promises nothing, so it needs no lint; the
audit's Proposed-for-3-cycles sweep does not see it, which is the point.

Rejected records stay in the index and are never pruned. The corpus of what was refused
and why is what makes the next proposal cheaper to evaluate.
-->
