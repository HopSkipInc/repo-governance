---
name: roadmap-narrative
description: >
  The judgment half of Layer 3 of the backlog-grooming regime
  (docs/backlog-grooming.md). Reads the generated data artifact
  (docs/roadmap-data.md), verifies every load-bearing code claim with a named
  command before asserting it (the Layer 2 contract), and writes prose into the
  marked sections of docs/roadmap.md — the sequence, the dependency horizons,
  and the cross-cutting observations. Never recomputes the trust header, never
  edits outside the marked sections, never writes the human-owned
  roadmap-commit block. Trigger: step 3 of the weekly roadmap-groom run, or a
  direct ask to "write the roadmap narrative".
version: 1.1.0
updated: 2026-11-04
triggers:
  - /roadmap-narrative
  - roadmap narrative
  - write the roadmap
  - refresh the roadmap
---

# Roadmap narrative — the judgment pass over the data artifact

The data pass (`scripts/generate-roadmap.mjs` → `docs/roadmap-data.md`) is the
substrate: deterministic, `gh`-only, always current to its substrate clock.
This skill is the product: the reading a human plans from. Six hand-built
roadmap runs in the source repo (ai-fleet, 2026-08-20 → 2026-09-12) proved the
table alone is never the deliverable — every real roadmap carried a sequence, a dependency ordering,
and cross-cutting observations that a row-per-item schema cannot express.
Those sections live here and nowhere else.

## Before you write

1. Read `docs/roadmap-data.md`. **Quote its trust header verbatim at the top
   of the narrative** — never recompute it, never paraphrase it. If it reads
   UNTRUSTED, the narrative says so and stops pretending to be current: name
   what would re-trust it (a groom pass whose marker comment lands).
2. If `docs/roadmap-data.md` is missing or stale relative to the backlog,
   regenerate it: `node scripts/generate-roadmap.mjs` — then commit that diff
   separately or flag it; the narrative never smuggles a data refresh.

## The Layer 2 contract, applied here

Every load-bearing code claim the narrative makes — a file, a function, a
flag, "X is not wired", a row count — is verified with a named command before
it is asserted:

```
claim: <what the narrative wants to say>
verdict: verified | stale | unverifiable
command: <the grep / test run / query actually executed>
evidence: <the output that decided it>
```

`file:line@ref` or it is not provenance — the ref is mandatory (a line number
without a commit is unfalsifiable a week later). For each `unverifiable`,
name the command or surface that *would* verify it. Verify against the ref
the artifact was generated from, then against current master; a claim that
rotated between the two is a data-artifact diff waiting to happen — say so.

## What goes in the marked sections

`docs/roadmap.md` carries four marked sections. Write inside the markers
only — and only the three `roadmap-narrative:*` ones:

```
<!-- roadmap-narrative:sequence:start -->
<!-- roadmap-narrative:sequence:end -->
<!-- roadmap-narrative:horizons:start -->
<!-- roadmap-narrative:horizons:end -->
<!-- roadmap-narrative:observations:start -->
<!-- roadmap-narrative:observations:end -->
```

The fourth is the human-owned commitment block:

```
<!-- roadmap-commit:start -->
Committed YYYY-MM-DD: #NNN, #NNN
<!-- roadmap-commit:end -->
```

**Never write `roadmap-commit`.** The sequence above is the fleet's
*recommendation*; the commit block is the human's *decision* — a separate
record with its own grammar and its own gate (`scripts/check-roadmap-commit.mjs`;
`docs/backlog-grooming.md` §5). It is filled by the human during review of the
weekly PR (or by a reviewing agent
recording the human's stated answer verbatim — never auto-filled, never
carried forward from the previous cycle). Touching it is the one write in this
document that is not yours.

- **Sequence** — "start next, in this order"; each entry names what gates it
  (a decision, a credential, a dependency, a deliberate wait — the four block
  types, never collapsed). Sourced from the data table's status and block-type
  columns plus your verification.
- **Dependency horizons** — the ordering of work across the weeks ahead, by
  what unblocks what.
- **Cross-cutting observations** — each a named mechanism, not a theme.
  "Four things to watch" means four mechanisms with provenance
  (e.g. *a guard that was green because it could not see the thing it
  guarded*), not four vibes.

## The discipline that keeps this document honest

- **Outside the marked sections: propose, never edit.** The rest of the
  document is the author's — the same rule as backlog-groom. A correction to
  prose outside the markers is a suggestion in the PR/commit message or a
  comment, not an edit.
- **Point-in-time and forward only.** No session narrative, no "what we
  decided today", no changelog of the document's own revisions — the six-run
  pilot accumulated all three and needed a rewrite. Git is the version log.
- **Name what expires, and expect almost nothing to.** Six runs over ~39
  epics found exactly one genuinely perishable item. If your draft marks many
  rows expiring, the calibration is wrong, not the backlog.
- **Owner statements enter dated and attributed.** A future-facing statement
  from the product owner is a provenance class of its own — quote it with its
  date and who said it. Layer 2 claim-checking does not apply to it, but it
  expires like everything else.

## Output

The edited `docs/roadmap.md` (marked sections only) plus, in the commit or PR
body, the claim→verdict table for every load-bearing assertion the narrative
makes. The data artifact's commit diff remains the machine-readable record;
your diff is the human-readable record of how the reading changed.
