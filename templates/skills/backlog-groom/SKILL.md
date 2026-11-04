---
name: backlog-groom
description: >
  Verify one epic body's claims against the actual tree — the currency half of the
  backlog-grooming regime (Layer 2, judgment). Extracts every falsifiable code claim
  from the epic, verifies each with a named command, reads the comments for
  corrections the body never absorbed, and proposes corrected sentences for anything
  stale. Never edits the issue body unattended. A completed pass posts the
  `backlog-groom: pass complete` marker comment — the roadmap generator's
  last-groom-pass source. Trigger: the backlog-currency lint's
  TRIGGER line (a child closed after the epic's last body update), or a direct ask
  to "groom epic #N".
version: 1.2.0
updated: 2026-11-04
triggers:
  - /backlog-groom
  - groom epic
  - backlog groom
  - verify epic body
  - is this epic stale
---

# Backlog groom — claim verification for one epic

Layer 2 of the backlog-grooming regime (`docs/backlog-grooming.md`). The mechanical
half (`scripts/check-backlog-currency.mjs`, the weekly probe) reads the issue
*graph*. This skill owns what a graph cannot see: **C7 — a body asserting a code
fact that has changed.** That class produced the worst error of the source repo's
2026-08-20 roadmap incident (ai-fleet #1252 said "RLS is written but not engaged —
the flag defaults off" a month after #1341 deleted the flag;
`isRlsIsolationEnabled()` returned `true` unconditionally), so it is not optional.

**Relationship to a prioritization pass.** If the repo also runs one (now/next/later
scoring plus mechanical label fixes — ai-fleet's local `groom-backlog` skill is
one), that pass is *prioritization*; this skill is *currency* — verifying what
bodies assert. A stale claim discovered mid-scoring is a C7 finding, not something
the scoring pass silently works around. One regime, two passes — **currency before
prioritization**, because a priority computed from a stale body is the incident
this regime exists to retire.

## Contract

1. **One epic per invocation.** Reading 36 in one context is how the original
   error happened. If asked to groom several, loop — full independence per epic,
   never a merged read.

2. **Extract every falsifiable claim about the code** — file paths, function
   names, flags and their defaults, "X is not wired", "no handler does Y", row
   counts, migration numbers and what they contain. Intent and rationale prose is
   not a claim; skip it.

3. **Verify each claim with a named command.** A grep, a test run, a SQL query —
   not an impression. Record the exact command and its observed output.

4. **Emit `claim → verified | stale | unverifiable`**, with the command and the
   output beside each verdict.

5. **For each `stale` claim, propose the corrected sentence.** Do not rewrite the
   body unattended — the body is the author's, and an agent silently editing epics
   is how intent gets laundered. Corrections land by a human's edit or a PR.

6. **Read the comments, not just the body.** A correction living in comments while
   the body stays stale is a stale-body finding (ai-fleet #1426's Dependencies
   section sat stale for 15 days while the correction sat in a comment the whole
   time). Report
   these as `stale — corrected in comments, body never updated`.

7. **For each `unverifiable` claim, name the command or surface that *would*
   verify it.** `unverifiable` without a named gap is where claims go to be
   forgotten.

## Input

`gh issue view <N> --json title,body,labels,updatedAt,comments` for the epic,
plus the repo tree at the current commit. The lint's TRIGGER line
(`info #N TRIGGER children-changed-since-body-update`) is the scheduled trigger —
the weekly run grooms up to three TRIGGERed epics, or the least-recently-groomed
epic when none fired (`docs/backlog-grooming.md` §4). A direct `/backlog-groom #N`
works too.

## Output

A report (comment on the issue, or the fleet run's output doc) with one block per
claim:

```
claim: <verbatim sentence from the body>
verdict: verified | stale | unverifiable
command: <what was run>
evidence: <the output that decided it>
proposed: <corrected sentence, when stale>
gap: <what would verify it, when unverifiable>
```

Close with a one-line verdict for the epic: `current` (every claim verified) or
`stale: k of n claims` with the proposed corrections listed. The human dispositions;
the next probe run's census is the proof the corrections landed.

## Closing step — the marker comment

A completed pass posts a comment on the epic carrying the fixed marker line:

```
backlog-groom: pass complete — verified <a>, stale <b>, unverifiable <c>
```

`gh issue comment <epic> --body "...the report...\n\nbacklog-groom: pass complete — verified 4, stale 1, unverifiable 0"`
The roadmap generator (`scripts/generate-roadmap.mjs`) reads the newest marker
across epics as the substrate's last-groom-pass and measures it against the
cadence declared in `docs/definition-of-done.md` (`backlog grooming cadence:
weekly`); the comment's own `created_at` is the date, so the marker
line itself carries none. **A pass with no marker comment is invisible — that
is the correct failure direction** (it untrusts the roadmap projection's
header). A pass that ran but could not post is a pass that did not happen.
