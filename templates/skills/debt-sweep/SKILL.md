---
name: debt-sweep
description: >
  Disposition pass over the backlog-grooming regime's debt table — the
  unparented population (no epic, no children) in docs/roadmap-data.md
  (docs/backlog-grooming.md, Layer 3). Per run: the N oldest escalation
  candidates (sweep band first, default N=5) plus any watch-band bugs it can
  cheaply repro-check. For each: triage labels, reproduce-or-close for bugs,
  parenting proposals, and a three-way disposition (fix / defer with a date /
  close with a reason). PROPOSES, never applies — a graph write is invisible
  in a PR diff, so a human clicks. Trigger: the weekly roadmap-data
  regeneration, or a direct /debt-sweep.
version: 1.1.0
updated: 2026-11-04
triggers:
  - /debt-sweep
  - debt sweep
  - sweep the backlog debt
  - oldest unparented issues
---

# Debt sweep — disposition for the unparented pile

Detection was never the hard half; the data artifact's debt table already
detects. This skill is the disposition, and the source repo's measured state
(ai-fleet, 2026-09-20) said disposition was the binding constraint there — 78%
of the open backlog sat outside the epic graph. Batched, because the
cold-start mass cannot be dispositioned in one pass, and a wall gets ignored.

## Input

A freshly regenerated `docs/roadmap-data.md` (`node
scripts/generate-roadmap.mjs`). The sweep runs against the debt table — never
against a stale artifact or a hand-list.

## Per run

Take the **N oldest escalation candidates** (`sweep` band first — it is sorted
oldest-first; default N=5), plus any `watch`-band bugs you can cheaply
repro-check in the same sitting. For each item, in order:

1. **Triage** — the item carries a `status:` label and an `impl:` tier, or it
   gets routed into the routing layer's queue (name that as the proposal —
   17 open bugs in the source repo had no status label at all on 2026-09-20;
   an unlabeled pile is how the pile grows). Where agent-routing is not
   installed, the `impl:` half does not apply.
2. **Reproduce-or-close for bugs** — verify the bug still reproduces, with
   the named command or observation recorded beside the verdict. If it does
   not reproduce, **propose closure with the evidence attached**. A one-off's
   claims live in its repro steps, not an epic body — that is what gets
   verified.
3. **Parenting and re-parenting** — if an epic owns the item, propose the
   link; if it sits under the wrong epic, propose the move. **Propose, never
   apply** — `gh` sub-issue writes and issue edits are invisible in a PR
   diff, precisely the unreviewable class, so a human clicks. This is the
   remediation for the children-win inverse: the graph that was silently
   wrong because no link was ever made gets a mechanism that makes the
   missing link visible.
4. **Three-way disposition** — fix (scheduled, with a where-it-lands), defer
   (`status:deferred` **with a date** — deferred-on-the-record is a decision;
   aging-by-neglect is drift), or close (with a reason). One of the three,
   per item. "Leave it floating" is not a disposition.

## Output

A report — a comment on the rolling sweep issue if one exists, else the run's
output doc — one line per item:

```
issue → triage | repro-verdict (command + evidence) | parenting proposal | disposition proposal
```

with the evidence beside each verdict. The human merges the dispositions
(clicks the links, applies the labels, closes what should close). The next
roadmap-data regeneration is the proof the pile moved: the header's >90d
count and the band distribution are the trend line.

## What this skill never does

- **No graph writes, no issue edits, no closures.** Proposal text only. The
  regime's whole trust model rests on a human seeing the diff.
- **No bulk pass.** N oldest per run. A wall of dispositions is how the sweep
  itself becomes the pile.
- **No re-detection.** The debt table is the input; re-deriving the
  population here forks the definition (PDR-008's two-enumerators hazard).
