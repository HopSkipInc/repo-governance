<!-- template: adr/023-product-decision-records.md v1.0.0 · updated 2026-07-24 -->
# ADR-023: Product Decisions Are Recorded and Falsifiable

**Status:** Proposed
**Date:** [DATE]

---

## Context

This repo records two kinds of why. ADRs record why the code is shaped the way it is. The Definition of Done records why each rule exists. Neither records why the software exists at all — who it serves, what bet it makes, what it deliberately will not do.

That gap is not cosmetic, because of how drift is detected here. Every audit domain compares one repo artifact against another: ADRs against the lints they promise, docs against the code they describe, issues against the PRs that closed them. Purpose has no counterpart in the repo, so nothing can be compared against it. The audit can prove the code drifted from the docs. It cannot prove the product drifted from its reason for existing.

Two failure modes follow, and only the first is currently visible at all:

1. **The build drifts from the thesis.** Work ships that serves no stated outcome. This shows up eventually as a backlog nobody can prioritize.
2. **The thesis drifts from reality.** The market moves, the bet goes stale, and the team keeps shipping — efficiently, on schedule, in the wrong direction. This produces no signal whatsoever. No red CI, no failed test, no noisy audit. It is the same silent-failure shape as an audit that quietly dies, and it is the reason the dead-man probe exists.

The vocabulary already exists to fix this. A bet with a check condition is structurally a watch item, and the audit already sweeps those. A record that must appear in an index is structurally an ADR, and a lint already enforces that. What is missing is the record.

## Decision

Product decisions are recorded as **PDRs** in `docs/pdr/`, numbered and indexed exactly as ADRs are.

**Every PDR carries a falsifier** — an observable condition, with a date or a named event, that would settle whether the bet was right. A PDR cannot move to **Accepted** without one. This is the product-layer form of the rule that governs ADRs: an ADR that promises a lint cannot be Accepted without the lint; a PDR that makes a bet cannot be Accepted without the condition that would retire it.

A decision without a falsifier is a wish.

Enforcement, layered per the usual pattern:

1. **Index lint** (`lint:adr-readme-sync`) — every record in `docs/pdr/` appears in `docs/pdr/README.md`. Reuses the existing ADR script; a repo that adds `docs/pdr/` gets the gate with no wiring change.
2. **Watch-list sweep** — PDR falsifier lines are swept alongside `docs/watch-items/`. A falsifier past due and unchecked becomes a P2.
3. **Audit domain (PDR coherence)** — Accepted records with no falsifier, records unconfirmed for 90 days, features shipping with no stated outcome, and work that contradicts a stated non-goal.

**Non-goals are records, not sections.** A thing deliberately not being built gets its own number and its own falsifier.

**Supersession, never in-place edit.** Changing the bet is healthy; changing it silently is the drift being prevented. A new PDR supersedes the old, which keeps its Context intact.

## Consequences

- **Someone has to own the bets.** Each PDR names a person in `Confirmed by`, not a role. This is the point: the corpus is only as honest as the person willing to be wrong in writing. A repo where nobody will sign is a repo where nobody knows why they are building.
- **The interview is the expensive part, not the record.** Architecture can be recovered by reading the code — consistent patterns that would be expensive to break are decisions, whether or not anyone wrote them down. Purpose cannot. It exists only in a human's head, so bootstrapping a PDR corpus requires asking one. See the `pdr-interview` skill.
- **Superseded PDRs accumulate, and that is the value.** The record of what was believed and why it turned out wrong is more useful than the current bet alone. Do not prune them.
- **The audit gets a new way to be wrong.** Orphan and non-goal checks read intent from prose, so they will produce false positives that a lint never would. This is why they are audit findings and not merge gates — probes monitor reality and never block; gates are deterministic. A judgment call belongs in a probe.
- **`Serves:` will be gamed if it is mandatory everywhere.** It applies to features and epics only, and `Serves: none` with a one-line reason is always a legitimate answer. An escape hatch cheaper than lying is what keeps the field honest; the rate of `Serves: none` is the signal, not a compliance number.

## References

- `docs/pdr/README.md` — the index the lint enforces
- `templates/pdr/_template.md` — the record format and falsifier discipline
- `docs/definition-of-done.md` — the Product decision (PDR) and PDR supersession work types
- `templates/watch-items.md` — the sweep mechanism the falsifiers hook into
- `docs/adr/022-definition-of-done.md` — the rule this one extends to the product layer
