# PDR-007: Non-goal — not a security or compliance practice

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

`gtm/positioning.md` states it plainly: not security buyers (CISO, compliance officer). The
compliance angle is noted as available later as a wedge into larger orgs, but the natural
opener is engineering leadership feeling pain from AI velocity outstripping their quality
systems. The stated reason is unusually honest for a positioning doc: *"Greg is honestly an
engineer not a security professional."*

The pull is real and adjacent. The practice already reasons about credential handling, vault
versus env-var storage, prompt-injection exposure, and database-enforced read-only roles —
all of that shipped in the BModelr engagement. Compliance is the easiest adjacent market to
get pulled into precisely because the work already brushes against it.

## Decision

Not sold to security or compliance buyers, and not positioned on SOC 2, NIST CSF, or control
frameworks.

**Security reasoning inside an engineering engagement stays in scope** — credential handling,
isolation boundaries, and the `gate:credentials` routing tier are engineering concerns and
remain part of the work. The non-goal is the *buyer and the positioning*, not the subject
matter.

## Falsifier

- [ ] Revisit when three or more inbound conversations open with a compliance driver (an
      audit, a customer questionnaire, a framework) rather than a velocity or quality driver

## Consequences

- No compliance collateral, no framework mappings, no control matrices.
- The adjacent lane is a partnership surface rather than an expansion — JDAQA is the model.
- It forecloses the fastest available differentiation story, since "governance" reads as
  compliance to a large part of the market. Every artifact has to work harder to say what
  kind of governance this is.
- Nothing here restricts doing security work well within an engagement. If that boundary
  starts feeling artificial in practice, the falsifier is not the test — supersede this
  record instead.
