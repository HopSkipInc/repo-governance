<!-- template: pdr/_template.md v1.1.0 · updated 2026-08-08 -->
# PDR-NNN: <Title>

**Status:** Proposed | Accepted | Rejected | Superseded by PDR-NNN | Retired
**Date:** YYYY-MM-DD
**Confirmed by:** <the person whose call this actually is — a name, not a role>
**Last confirmed:** YYYY-MM-DD

---

## Context

What we believe about the market, the users, or the business that makes this decision
necessary. Written so a stranger could read it and disagree.

State what you know and how you know it. "Users want X" is not context. "Four of the six
people we onboarded in May asked for X unprompted; the other two never opened that screen"
is context. Where the belief is a guess, say it is a guess.

## Decision

What we are doing, who we serve, or what we are deliberately **not** doing.

State it specifically enough to be wrong. "We serve small businesses" cannot be wrong —
it has no edge. "We serve solo operators billing under $500k who do their own books"
can be wrong, which is what makes it worth writing down.

## Falsifier

What would prove this wrong, and when we look.

- [ ] Revisit by YYYY-MM-DD when <specific observable condition>

## Consequences

What this commits us to. What it forecloses. What work it authorizes — and what work it
makes off-limits without superseding this record first.

---

<!--
=============================================================================
DELETE EVERYTHING BELOW THIS LINE WHEN YOU WRITE A REAL PDR
=============================================================================

## What a PDR is

A PDR records a decision about *why this software exists* — who it serves, what bet it
makes, what it deliberately will not do. An ADR records a decision about *how the code is
shaped*.

The test: an ADR is falsified by engineering reality. A PDR is falsified by market
reality. "All DB access goes through the repository layer" is an ADR. "We serve solo
operators, not agencies" is a PDR. If you cannot say what external event would make the
decision wrong, it is probably an ADR.

## The rule

**A decision without a falsifier is a wish. Every PDR ships with the condition that would
retire it.**

This is the product-layer form of the DoD's core rule — enforcement ships with the
promise. An ADR that promises a lint cannot reach Accepted without the lint. A PDR that
makes a bet cannot reach Accepted without the condition that would settle it.

A PDR with no falsifier is a vision statement. Vision statements do not rot loudly; they
rot silently, while the team keeps building efficiently in the direction they point.

## Falsifier discipline

The condition must be **observable** — a date, a named external event, a threshold
someone could check without a meeting.

Good:
- `- [ ] Revisit by 2026-12-01 when the pilot cohort renews or churns`
- `- [ ] Revisit when a second paying customer asks for the mobile app`
- `- [ ] Revisit when monthly active teams exceeds 50`

Not good:
- `- [ ] Revisit later` — the sweep cannot tell whether it is due
- `- [ ] Revisit if this stops working` — "working" is not observable
- `- [ ] Revisit at the next planning cycle` — that is a calendar entry, not a falsifier

Checked (`- [x]`) means the condition arrived and was dealt with — the audit stops
reporting it. Unchecked and past due is a P2 finding.

## Non-goals are records, not sections

A thing you have decided not to build gets its own numbered PDR, with its own falsifier.
`002-not-building-mobile.md` is a real record with a real condition ("revisit when a
paying customer asks twice"). This is the highest-signal artifact in the set: the audit
can check shipped work against a stated non-goal, which it can do for nothing else at
this layer.

Non-goals buried as a bullet in a strategy doc get silently violated. Non-goals with a
number get cited in PR review.

## Changing your mind

Changing your mind is healthy. **Unrecorded** change is the drift.

Never edit a Decision in place. Write a new PDR that supersedes the old one, set the old
one's Status to `Superseded by PDR-NNN`, and leave its Context intact — the record of
what you believed and why you were wrong is the most valuable thing in the corpus.
A superseded PDR is not an embarrassment; it is evidence the mechanism works.

## Deciding against it — Rejected

A bet that is proposed and argued down is a decision, and it needs a record for the same
reason an accepted one does. Deletion is not an option: the deleted proposal comes back,
and it gets re-litigated from scratch because nobody can reconstruct what killed it.

Set Status to **Rejected** and leave Context and Decision **intact** — the proposal must
stay readable or the record cannot stop the re-proposal it exists to stop. In place of a
falsifier, write **what would reopen it**:

    ## What would reopen this
    - [ ] Reopen when <observable condition — a named event, a threshold, a date>

This is the falsifier inverted. An Accepted PDR names the condition that would prove the
bet wrong; a Rejected one names the condition that would make it right after all. Both
are the same discipline: a decision nobody can check is not a decision.

`lint:pdr-falsifiers` does not fire on Rejected records — it gates Accepted only — so
this line is held by review and by the audit, not by CI. Write it anyway. A Rejected
record with no reopen condition is not a decision, it is a mood, and it will be
overturned by whoever argues hardest next time.

Rejected records stay in the index and are never pruned. `Confirmed by` still names the
person who made the call — refusing is as much a signature as accepting.

## Last confirmed

Bump `Last confirmed` whenever the person named in `Confirmed by` re-reads the record and
says it still holds. The audit flags anything unconfirmed for 90 days — not because the
bet went stale on day 90, but because nobody looking at it for a quarter is the condition
under which stale bets survive.
-->
