# AI-Native Growth Story Arc — revisit tracker

**Date:** 2026-07-23
**Owner:** Greg
**Focus:** Re-check the AI growth story arc after the in-flight fleet-worker + customer-POC remediation lands
**Source:** [`../ai-growth-story/`](../ai-growth-story/) (`spine.md`, `evidence.md`, `README.md`)
**Home:** relocated from `ai-fleet` 2026-08-02 alongside the story it tracks. Note: this hub
runs **no scheduled audit sweep** (see "who audits the auditor" below), so until that changes
this tracker is checked by hand, not surfaced automatically.

---

## TL;DR

A dated, evidence-first "AI growth story arc" was excavated from the git history of the
three AI-era repos on 2026-07-23 (extended 2026-08-02 with this hub as the fourth
component) and recorded in `docs/ai-growth-story/`. Two of its load-bearing claims were
expected to change as focused remediation landed. This item exists so the arc gets
re-checked against reality instead of drifting stale — and so the (currently OPEN)
narrative-frame decision gets settled.

## The claims most likely to move

1. **`ai-fleet` is L3 "AI-native operations" but *fragile*.** The strongest tell — the
   platform's own agents audit all three repos weekly, with real spend ($43–$71/run:
   ai-fleet PRs #941, #975, #1118, #1131, #1154) — was undercut by a 16-day silent
   outage of all three audit machines (2026-07-04 → 07-20). Root causes and fixes:
   [`ai-fleet:docs/audits/audit-2026-07-20-investigation.md`](https://github.com/HopSkipInc/ai-fleet/blob/master/docs/audits/audit-2026-07-20-investigation.md)
   (branch default `master`→remote-HEAD; cost-cap migration 0337 raising $3→$80).
   Related: ai-fleet#1117, analytics-infrastructure#137, enrichment-pipeline#410.

2. **Product AI is L1/demo-stage.** Customer-facing safety guards (L1/L2/L3), RLS
   (ai-fleet#1253), and B2C auth all landed the week of 2026-07-17 and are unproven. The
   customer POC is tracked in
   [`ai-fleet:docs/demos/`](https://github.com/HopSkipInc/ai-fleet/tree/master/docs/demos)
   (`2026-07-23-*`).

## What to re-check at the revisit

- Have all three audit machines run green for a full weekday/Monday cycle since the fix
  deployed? If yes → soften the "L3-fragile" caveat in `spine.md` §4/§6.
- Did the customer POC/demo land and exercise the safety + RLS + B2C stack against a real
  workspace? If yes → move the product-AI rung off "demo" in `spine.md` §4 and the README
  snapshot table.
- Settle the OPEN frame-emphasis decision (operations-first vs. balanced vs.
  product-first) — see `spine.md` §1.

## Status 2026-08-02

- **Audit machines: fixed and resumed.** 0337/0338 merged ~07-21; post-fix artifacts in
  all three repos (ai-fleet 07-22/07-23, analytics 07-23 + a special 07-30, enrichment
  07-23/07-27). Audit lifecycle reworked to two-phase on 07-27 (see ai-fleet CLAUDE.md
  §Applied governance updates) — the likely reason per-weekday ai-fleet artifacts stop
  after 07-23. Sustained-cadence verification is the remaining open piece of line 1 below.
- **Customer POC: in flight, not landed** (web-external counter-offer flow merging as of
  08-02). Line 2 stays open.
- **This hub transferred into HopSkipInc (08-02) and was excavated** — dossier 4 in
  [`../ai-growth-story/evidence.md`](../ai-growth-story/evidence.md); spine updated (the
  loop, the transfer beat, two new warts). New lines 4–5 below track the follow-ups: the
  `_client.md` ledger's 16-day false "applied" for enrichment's sync fix (actually landed
  07-23, enrichment `a0e7bd11`, via audit remediation — ledger never corrected), and the
  hub itself being un-audited. The story relocated here from ai-fleet the same day.

## Proposed next steps

- [ ] **Watch list:** revisit 2026-07-30 when the audit-machine fix (branch default + migration 0337) has deployed and all three weekly audits have run green for one full cycle — then update the `ai-fleet` L3 placement in `docs/ai-growth-story/spine.md`.
- [ ] **Watch list:** revisit 2026-07-30 when the customer POC/demo (ai-fleet `docs/demos/2026-07-23-*`) has landed and exercised the safety + RLS + B2C stack — then re-grade the product-AI rung.
- [ ] **Watch list:** revisit 2026-07-30 to settle the story-arc frame emphasis (operations-first / balanced / product-first) and decide whether to build the deliverable (memo / deck / interactive artifact).
- [ ] **Watch list:** revisit when `downstream/hopskip/_client.md`'s enrichment row for the 2026-07-07 ownership-fix prompt is corrected (actual application 2026-07-23, enrichment `a0e7bd11`) and a decision exists on who/what audits `repo-governance` itself — then re-grade the standards-layer warts in `docs/ai-growth-story/spine.md` §6.
- [ ] **Watch list:** revisit by 2026-10-31 (PDR-002 falsifier expiry) when the "deliberately pre-commercial" stance is either reaffirmed or changed — it decides how the story's product-seed thread is told.
