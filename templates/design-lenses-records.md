<!-- template: design-lenses-records.md v1.1.0 · updated 2026-08-02 -->
# Design Lenses — Records for `<ORG>/<REPO>`

**Policy:** [design-lenses.md](design-lenses.md) — identical across repos. **This file is not.**
**Status:** Evidence — grows with every lens application, including the ones that found nothing

---

## Purpose

The policy says *how* to borrow from mature disciplines. This file records *what this repo has learned by doing it*. Three sections, each with a different job:

1. **Retroactive naming** — decisions this repo already made that instantiate a named concept. Converts "we learned this the hard way once" into "we recognise this shape on sight."
2. **Lens log** — every application, confirmed and negative alike.
3. **Local extensions** — claim classes this repo's domain warranted, with the evidence that earned them.

A file with no negative results is itself running on survivorship bias. If §2 contains only confirmations after a dozen entries, either the lens is being applied only where someone already suspected a problem, or negatives are going unrecorded. Both are worth fixing.

---

## 1. Retroactive naming

Decisions already made, mapped to the concept they instantiate. Seed with five to ten; do not attempt exhaustive coverage. Each entry is an interpretation — confirm with someone who was there before treating it as settled.

The value is not taxonomy. It is that the *next* instance becomes recognisable before you pay for it.

| Decision | Concept it instantiates | Discipline | Discovered | Notes |
|---|---|---|---|---|
| _e.g._ ADR-026 gates vs. probes | Alarm fatigue | Human factors | The expensive way — a chronically-red job trained reviewers to ignore CI | Solved problem since the 1970s; the fix was right, the name was missing |
| | | | | |

**Discovered** column values: `the expensive way` (after an incident), `by lens` (asked before it cost anything), or `inherited` (adopted from another repo's records).

A repo whose column reads entirely `the expensive way` is exactly the repo this policy is for. That distribution shifting over time is the clearest signal the policy is working.

---

## 2. Lens log

One row per application. **Record negatives** — "checked, found nothing" is evidence about where this repo's design is sound, and it is the only thing that keeps §1 honest.

| Date | Artifact | Claim class | Fit | Lens | Prediction | Checked | Result | Outcome |
|---|---|---|---|---|---|---|---|---|
| _e.g._ 2026-08-02 | ADR-062 | Measurement trustworthiness | clean | Sampling theory | Production behaviour exists that the eval harness cannot represent | `fixture-tool-invoker.ts`, `EvalCase` schema, retention rules | **Confirmed** | New ADR rule on representativeness; harness defect filed; two sampling hazards documented |
| | | | | | | | | |

`Result` is `Confirmed` or `Not found`. Both are complete entries.

`Fit` is `clean` or `forced — <why>`, naming the nearest class (policy §3.1). **A forced fit is the only signal a missing claim class ever emits — record it even when the application still produced a usable prediction.** Three or more forced fits pending is the audit's trigger to propose a new row: "what class would make these entries stop being awkward?" That proposal lands in §3 below with `residuals` as its origin and these rows as its evidence.

---

## 3. Local extensions to the claim-class table

Claim classes this repo's domain warranted beyond the eight in the policy. **Extensions live here, not in the policy** — the policy is identical across repos; evidence is local. The governance repo's promotion sweep (`check-lens-promotion.mjs`) reads this table across every governed repo: an extension appearing independently in two or more repos, evidence attached, is a promotion candidate for the upstream table. Generalization is settled by counting, not by argument.

An extension named here becomes a valid claim class for `check-design-lens.mjs` — declaring it is what makes Lens lines citing it pass the lint.

| Claim class | Discipline | Core questions | Origin | Evidence that earned it |
|---|---|---|---|---|
| | | | | |

**Origin** column values: `residuals` (proposed from accumulated forced fits — the strong path), `incident` (an outage or defect exposed the class), `armchair` (proposed by enumeration; must earn its first falsifiable prediction before Lens lines cite it), or `inherited` (promoted upstream from another repo's evidence, adopted here).

---

## 4. Calibration notes

Contested calls, reversals, and lessons about the practice itself. Record *why*, because the next reviewer will re-litigate it otherwise.

Things worth capturing here:

- A lens that looked applicable and wasn't, and what the tell was
- A prediction that was too vague to check, rewritten into one that could be
- A case where the claim class was misidentified at first, and what the correct one turned out to be
- Ritual-compliance drift spotted in review, and what fixed it

---

## Changelog

- **1.1.0** (2026-08-02) — lens log gains the `Fit` column (policy §3.1); extensions table gains `Origin` and feeds the cross-repo promotion sweep; declared extensions become lint-valid claim classes.
- **1.0.0** (YYYY-MM-DD) — records file created; retroactive naming pass seeded with N entries.
