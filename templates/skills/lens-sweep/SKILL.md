---
name: lens-sweep
description: >
  Apply the Design Lenses policy to a Proposed ADR in a separate session from the one
  that authored it. Classifies the ADR's claims against the policy §3 table (plus the
  repo's records-file extensions), states the fit, generates a falsifiable prediction
  per lens, opens the files and checks it, and returns a proposed **Lens:** line plus
  the evidence trail — quoted code, what was looked for, what was found. Proposes,
  never applies: the line lands in the ADR via the author's PR, with the trail linked
  for the reviewer. Records the application (including negatives and forced fits) in
  docs/design-lenses-records.md.
version: 1.0.0
updated: 2026-08-02
triggers:
  - /lens-sweep
  - /lens-sweep <adr-path>
---

# Lens Sweep

Governed by **`docs/design-lenses.md` in this repo** — read it before running. The claim-class
table (§3), the falsifiability filter (§2), the fit rule (§3.1), and the failure modes (§6)
are there, not here. This file is only the procedure.

**If `docs/design-lenses.md` does not exist, stop and say so.** Install the policy first
(governance repo, `templates/design-lenses.md`). A sweep run from memory of the policy will
drift from the table the lint validates against.

## Why this is a separate session — do not skip this constraint

**A session that authored a design has every contextual incentive to find `not found`.** The
sweep must run with no access to the authoring session's context: it sees the artifact, the
codebase, and the policy — never the design rationale or the discussion that produced it.
Same reasoning as the routing classifier's pin: the instruction must not be read by the thing
it binds (proposer-grades-itself is the policy's own §8.3 Goodhart entry).

If you are the session that wrote or materially edited this ADR, **refuse and say so**. The
correct output is "this needs a fresh session", not a sweep with a disclaimer.

## Procedure

### 1. Classify

Read the ADR. Ignore its Consequences section's self-assessment — classify from what the
ADR *asserts*, not what it says about itself.

- List every external claim the ADR makes, in the §3 table's terms. Most ADRs make one or
  two; an ADR asserting none gets `Lens: none — <reason>` and you stop after recording it
  (a reviewer may challenge the `none`).
- Check `docs/design-lenses-records.md` §3 for local extensions — they are valid classes.
- **State the fit for each: `clean` or `forced — <why>`, naming the nearest class.** A forced
  fit is a finding in its own right (policy §3.1) — record it even if you proceed with the
  nearest class. Do not silently jam a claim into the least-bad row.

### 2. Predict

For each claim class, the table names the discipline and its core questions. Produce **one
falsifiable prediction per lens** — a sentence about *this artifact* that someone can go
check, with a stated negative ("if the harness handles error outcomes, this comes back
not found"). Apply §2 ruthlessly: no prediction, no lens — a discipline name with no
prediction is the ritual compliance the policy dies of first.

### 3. Check

Open the files. This step is the sweep's reason to exist — do not reason from the ADR's
prose about the code; read the code.

- Trace the prediction to the specific surfaces that would falsify or confirm it.
- Quote the load-bearing lines (path, line, snippet) into the trail as you go.
- A negative result is a success. Write it down with the same care as a hit.

### 4. Deliver

Produce, in one message:

1. **The proposed Lens line(s)**, exactly in §5.1 format — class, discipline, prediction,
   `checked:` naming the real paths you opened, `result: confirmed — <consequence, issue ref>`
   or `result: not found`.
2. **The evidence trail** — per lens: the prediction, the negative that was possible, each
   file opened with the quoted lines that settled it, and the reasoning from quote to result.
   The trail is the deliverable; the line is the summary. A reviewer skimming a real trail
   catches a fabricated one far more reliably than a one-line attestation.
3. **Confirmed findings as filed issues** — a confirmed prediction that exposes a defect gets
   an issue in the same pass, referenced from the Lens line.
4. **A log row appended to `docs/design-lenses-records.md` §2** — date, artifact, class,
   fit, lens, prediction, checked, result, outcome. Forced fits and negatives included;
   a log of confirmations only is the policy running on survivorship bias.

**You propose; you never apply.** The Lens line goes into the ADR by its author's hand in
their PR, with the trail linked from the PR description. If the author edits the line's
substance — weakens the prediction, drops a checked path — that is a review finding, and the
diff between proposed and landed is how the reviewer sees it.

## Tips

- The claim class is a property of the artifact, not the author (§6, lens shopping). If the
  ADR gates a merge on a number, it owes the measurement lens whether or not anyone enjoys it.
- Questions 2 and 3 of the policy's §4 most often come back negative. Ask them anyway;
  negatives are what keep the log honest.
- If you cannot state what a negative result would look like before opening a file, you have
  a metaphor, not a lens — go back to step 2.
- Budget: one lens applied well beats three applied thinly. ADR-062's whole pass — question
  to filed defect to new rule — took under an hour.
