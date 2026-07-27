# PDR-002: Pre-commercial — build the capability before selling it

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

Stated intent and revealed intent disagree, and the merge log is the honest one.

All five merged PRs since 2026-07-16 deepen the methodology — PDRs (#3), CI (#8), routing
dogfood (#9), the decomposition rule (#10), clean-code and test-coverage layers (#11). Every
closed issue is methodology or infrastructure. **Zero** work has touched packaging, pricing,
client-acquisition, or onboarding ergonomics. All three governed repos are Hopskip-internal.
There is one external engagement, pro-bono, whose case study has been pending since ~August.
`.claude/personal-state.md` says the hang-a-shingle goal is "real but not urgent."

Meanwhile `gtm/` carries a sales motion, a partnership tracker, and pricing questions that
have been open and untouched since 2026-06-14.

Read as a commercial practice, that is drift. Read as a decision, it is coherent — and it
was never written down, so nothing could tell the two apart.

## Decision

repo-governance is **deliberately pre-commercial**. Build the capability until it is
undeniable; do not price, package, or prospect until then.

This is a decision to defer, not the absence of one. The distinction matters because they
are indistinguishable from the outside and they age differently: a decision has an expiry.

## Falsifier

- [ ] Revisit by 2026-10-31, or when the BModelr case study publishes (~August 2026),
      whichever comes first
- [ ] Revisit if three consecutive working sessions *after* the case study lands ship
      methodology depth with zero packaging, pricing, or client-acquisition work — at that
      point the bet has decayed into deferral and this record should be superseded or
      retired rather than quietly held

The second condition is checkable from the merge log without a meeting, which is the point.

## Consequences

- **`gtm/` is a secondary artifact by design.** That licenses its staleness until the
  falsifier fires — and it explains why five sessions of material landed with no GTM commit
  and nobody noticed. It does not license the collateral being *wrong*, only being behind.
- No work on pricing, tiering, or branding is authorized before the falsifier fires. The
  open questions in `positioning.md` stay open **on purpose**, and should say so.
- The one-pager's job is to be accurate, not polished.
- It forecloses treating inbound interest as validation. Until the falsifier fires, an
  interested prospect is a data point, not a reason to start packaging.
