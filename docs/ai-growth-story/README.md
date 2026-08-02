# AI Growth Story Arc

A dated, evidence-first account of HopSkip's trajectory toward being "AI-native,"
built from the **git history** of the AI-era repos (`ai-fleet`, `analytics-infrastructure`,
`enrichment-pipeline`, and this `repo-governance` standards hub) — not from marketing or memory.

- **Snapshot date:** 2026-07-23 · **Updated:** 2026-08-02 (fourth component added: `repo-governance`)
- **Home:** relocated here from `ai-fleet` on 2026-08-02, the day this hub transferred into
  HopSkipInc (originally recorded there 2026-07-23 via HopSkipInc/ai-fleet#1323, when the hub
  still lived outside the org). A cross-repo organizational story belongs in the org's meta-repo.
- **Revisit:** 2026-07-30 — see [`../watch-items/2026-07-23-ai-native-story-arc.md`](../watch-items/2026-07-23-ai-native-story-arc.md)
- **Status:** evidence spine complete; narrative frame **recommended but not yet chosen** (see below)

## Why this exists

HopSkip was founded ~2019 and got serious about AI in mid-2025. The honest question
this answers: *can a 7-year-old company call itself "AI-native," and if not, what is
the true story?*

The goal is a **spine that survives scrutiny** — the same facts can be told to an
internal audience (candor: "where are we really") and to investors (trajectory:
"here's the slope and what we're fixing") without either version contradicting the
other. If the two tellings can't be built from an identical evidence base, the story
isn't honest. Warts are therefore first-class here.

This was recorded as a point-in-time snapshot specifically because two of its
load-bearing claims were expected to move as focused remediation landed
(fleet-worker reliability, customer POC/demo). Freezing the analysis lets us **diff
the story against reality** at each revisit instead of reconstructing it.

## What's here

| File | What it is |
|------|-----------|
| [`spine.md`](spine.md) | The canonical evidence backbone: timeline, maturity placement, the load-bearing receipts, the warts, and the two-flavor plan. Audience-blind — both tellings derive from this. |
| [`evidence.md`](evidence.md) | The receipted per-repo excavation dossiers behind the spine (the audit trail). |
| `README.md` (this file) | Index, frame, and revisit protocol. |

## The frame (recommended — decision OPEN)

> **HopSkip is becoming AI-native in how it *builds and runs* the company — not (yet)
> in what it *sells*. Converted, not born; and the conversion shows up in the
> engineering org before it shows up in the product.**

Three candidate emphases were surfaced; **operations/engineering-first** is
recommended (hardest to fake, survives diligence). The decision was **not finalized**
— settle it at the revisit. See [`spine.md` §1](spine.md).

## Maturity snapshot (2026-07-23, updated 2026-08-02)

A company can sit at different rungs on different axes. Ladder definitions are in `spine.md` §2.

| Axis | Rung | One-line honest read |
|------|------|----------------------|
| Product AI | **L1** | Off-the-shelf calls (Gemini enrichment, Azure embeddings); customer agent at demo stage |
| Data foundation | **L2 (floor)** | Genuinely rebuilt for AI-first consumption; a conventional warehouse under a real, off-the-shelf semantic layer |
| Operational AI | **L3 (qualified)** | Own agents audit/govern all three repos weekly — real, receipted, and *fragile* (a 16-day silent outage) |
| Engineering AI | measurable | 44% of `ai-fleet` commits and 38% of `enrichment-pipeline` commits are AI-agent-authored |
| Standards layer | hub (not a rung) | Governance-as-code provably extracted from ai-fleet practice, tested (79/79) and agent-executed — but distribution is hand-cranked and the hub is un-audited itself |

## Revisit protocol (2026-07-30)

1. **Fleet-worker reliability** — the audit-machine outage
   ([`ai-fleet:docs/audits/audit-2026-07-20-investigation.md`](https://github.com/HopSkipInc/ai-fleet/blob/master/docs/audits/audit-2026-07-20-investigation.md))
   is being fixed (branch-default + cost-cap migration 0337). Re-check: have all three
   audits run green for a full cycle? If yes, the "L3-fragile" caveat softens.
   *(2026-08-02: fix merged; audits resumed 07-22 → 07-27 in all three repos; lifecycle
   reworked to two-phase 07-27. Sustained cadence still to verify.)*
2. **Customer POC/demo maturity** — safety guards (L1/L2/L3), RLS (#1253 in ai-fleet), and
   B2C landed the week of 2026-07-17 and are unproven. Re-check the
   [`ai-fleet:docs/demos/2026-07-23-*`](https://github.com/HopSkipInc/ai-fleet/tree/master/docs/demos)
   outcomes. If the POC lands, the product-AI rung moves off "demo."
3. Settle the frame-emphasis decision and, if desired, build the deliverable
   (memo / deck / interactive artifact — the last would use the Hopskip brand kit).
4. **Governance-loop items (added 2026-08-02)** — correct this hub's ledger row for
   enrichment's 2026-07-07 prompt (the fix actually landed 07-23, enrichment `a0e7bd11`,
   via audit remediation); decide who/what audits `repo-governance` itself (it ships the
   audit machinery to every spoke and runs none of it on itself).

## Provenance

Built 2026-07-23 from full git history (the working clones were shallow and were
unshallowed for the analysis) via parallel per-repo excavation. Extended 2026-08-02 with
a fourth excavation (`repo-governance`, 102 commits), run the day the hub was transferred
into HopSkipInc, and relocated here the same day. Every claim carries a spot-checkable
receipt (commit SHA, migration number, dated artifact) in `evidence.md`. A few doc-drift
discrepancies surfaced during the digs and are noted in `spine.md` §8 — they are
themselves part of the "young and fast" story.
