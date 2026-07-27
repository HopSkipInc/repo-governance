# PDR-001: Two offerings, one methodology

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

The repo has recorded its buyer two ways since May, and both records were live at the same
time. `.claude/team-state.md` (2026-05-20) says the beachhead is non-technical founders,
"not corporate CTOs, not VPEs." `gtm/positioning.md` (revised 2026-06-14, edited again
2026-07-24) says the **primary** buyer is CTO / VP Engineering at AI-enabled mid-market
companies and non-technical founders are **secondary**. Exactly inverted. Neither cites the
other, and the contradiction survived two months and several edits to both files.

The question that resolved it was not "which buyer." Both are real. It is **which offering**
each one buys, and the two are not the same product.

## Decision

One methodology, two offerings, differentiated by committed service hours.

- **Serviced tier — non-technical founders.** The practice *plus a bucket of hours*: spec
  review, install, and hand-holding through the build window. The hours are the product;
  the artifacts are what the hours produce. This is the tier that carries a price.
- **Self-serve tier — technically-led teams** (CTOs, VPEs, technical founders). The
  methodology as documentation and templates. No committed hours, no install support. Docs,
  a pat on the head, and a shove into the real world.

Stated so it can be wrong: it claims founders are buying *judgment on tap* rather than
artifacts, and that a technical team can adopt this from the README without help.

## Falsifier

- [ ] Revisit by 2027-01-31 when the first paid founder engagement closes — if the founder's
      stated reason for renewing cites the artifacts rather than the hours, the hours are not
      the product and the two tiers should merge
- [ ] Revisit when self-serve adopters generate more than 8 hours of unbilled support in any
      single month — at that point the docs-only tier is not self-serve, it is subsidised

## Consequences

- `gtm/positioning.md`'s primary/secondary framing is **wrong** and needs rewriting as two
  offerings rather than a ranked buyer list. That is the file's first substantive edit since
  2026-06-14.
- Two vocabularies follow directly — see [PDR-003](003-two-registers.md).
- **The public repo is the self-serve product.** `README.md`, `GETTING_STARTED.md`, and
  `/analyze-repo` stop being marketing and become product surface for a whole tier. A
  bootstrap that half-works is a failed delivery, not a bad brochure — which is what makes
  the day-one-red ADR bug found on 2026-07-27 a customer-facing defect in hindsight.
- Pricing work, when it is authorized ([PDR-002](002-pre-commercial.md)), applies only to
  the serviced tier.
- It forecloses selling installation labour to technical teams. If a CTO wants hours, that
  is the serviced tier and this record has to be superseded to price it differently.
