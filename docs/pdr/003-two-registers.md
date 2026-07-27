# PDR-003: Two vocabularies, one per offering

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

A vocabulary shift was decided on 2026-05-20 — away from DORA, ADR coherence, and
governance debt; toward contractor, build window, launch date, spec drift. It was applied to
`gtm/one-pager.md`, where team-state records the DORA mapping section being removed as "not
the buyer's vocabulary."

It was never applied to `gtm/positioning.md`, which still carries a `## DORA mapping`
section and still lists DORA, change failure rate, MTTR, lead time, and deployment frequency
under **Use**. That file also already contains a two-register rule for a newer term: *"Use
[hill-climbing the cost-to-outcome frontier] with technical buyers and partners. **Never in
the founder one-pager** — that document was deliberately stripped of DORA vocabulary for the
same reason."*

So the practice has been operating two registers for at least a month while recording a
single-register decision. The behaviour was right; the record was wrong.

## Decision

Two registers, deliberately, mapping one-to-one onto the two offerings in
[PDR-001](001-two-offerings-one-methodology.md).

- **Founder register** (serviced tier): contractor, build window, launch date, spec drift,
  "the system holds without you," "architecture rules written down with an automatic check
  each." Never: ADR, PDR, DORA, MTTR, hill-climbing.
- **Technical register** (self-serve tier, and partners): DORA, change failure rate, MTTR,
  lead time, deployment frequency, hill-climbing the cost-to-outcome frontier, ADR/PDR by
  name.

Neither register's terms cross into the other's artifacts.

## Falsifier

- [ ] Revisit by 2027-01-31, or the first time a single prospect fits both offerings — a
      technical co-founder buying the serviced tier — and neither artifact is handable as-is
- [ ] Revisit if either register drifts more than one quarter behind the other again. It
      already did, for two months, and nothing detected it

## Consequences

- Every buyer-facing artifact declares its register at the top, so a reader can tell which
  document they are holding.
- `positioning.md` is the technical register and **keeps** its DORA section — the apparent
  inconsistency was the correct behaviour and is now the recorded one.
- `one-pager.md` is the founder register and keeps DORA out.
- Two registers means two things to keep in sync, and the drift is invisible without an
  instrument. A `gtm/` staleness trigger — collateral unchanged while N layer artifacts
  changed — is the enforcement this record owes and does not yet have.
