# Claim-backing classification — worked example for repo-governance

**Date:** 2026-08-02
**Method:** hand-classification of this repo's *already-recorded* claims against the
definitions in `templates/governance-health.md` v1.1.0 ("Definitions — claims and
backing"). No derivation rule is invented here — every row was read from the cited
artifact, and every row cites its source so a wrong classification is visible to review.

> **This file never syncs.** It is a records file — the worked example of a template
> taxonomy applied to this repo's own claims. The definitions live in
> `templates/governance-health.md`; everything here is local and dated.

Class values: **both** (told and enforced) · **instruction-only** (told, nothing
enforces) · **gate-only** (enforced, nothing records it) · **neither** (an imitation
surface — reads as governed, nothing instructs or enforces).

## §1 — enforced conventions

Source: `docs/code-conventions.md` §1 (rows 1–7). Each row names its enforcement in the
"Enforcement (rule or script)" and "Gate or report" columns; the claim is told by the
conventions file itself and, for rows 1–5, mirrored in `CLAUDE.md` ("Working on
templates" rules 1–4).

| # | Claim (abbreviated) | Instruction backing | Gate backing | Class |
|---|---|---|---|---|
| 1 | `templates/` files carry a version stamp naming their own path | `docs/code-conventions.md` §1; `CLAUDE.md` "Working on templates" §1 | `scripts/check-template-versions.mjs` R1–R2, gate in CI | both |
| 2 | A template changed in a commit has its version bumped in the same commit | `docs/code-conventions.md` §1; `CLAUDE.md` §1 | `check-template-versions.mjs` R3 (`--base`), gate in CI | both |
| 3 | Every template is named in the `/analyze-repo` matrix or excluded on the record | `docs/code-conventions.md` §1; `CLAUDE.md` §2 | `scripts/check-analyze-repo-coverage.mjs`, gate in CI | both |
| 4 | A blank form is `_`-prefixed and never carries a record's number | `docs/code-conventions.md` §1; `CLAUDE.md` §4 | `scripts/check-blank-form-naming.mjs` R1–R3, gate in CI | both |
| 5 | Every `scripts/` script has a fixture test (fires on known-bad, clears on known-good) | `docs/code-conventions.md` §1; `CLAUDE.md` §3 | `test/lints.test.mjs` (+ `lens`/`drift` siblings), run in CI | both |
| 6 | Every record in `docs/adr/` and `docs/pdr/` is registered in its README index | `docs/code-conventions.md` §1 (no CLAUDE.md mirror) | `scripts/check-adr-readme-sync.mjs`, gate in CI | both |
| 7 | An Accepted PDR carries a falsifier, not a ruled-out phrasing | `docs/code-conventions.md` §1; ADR column points at the PDR corpus | `scripts/check-pdr-falsifiers.mjs` R1–R2 gate; R3–R4 report-only | both (the claim as written is fully gated; the report-only rules back extensions of it, not the claim itself) |

## §4 — enforcement without a record (the inverse case)

Source: `docs/code-conventions.md` §4 (one row). §4 exists for **gate-only** artifacts —
a check that runs with no convention claiming it.

| Check | Implied convention (§4) | Instruction backing | Gate backing | Class |
|---|---|---|---|---|
| `scripts/check-downstream-drift.mjs` | Downstream repos' declared template versions must match their files, and must not lag the templates | As classified **2026-08-02**: told by `.claude/commands/review-sync.md` Step 5.0 (disposition rules) and this repo's `CLAUDE.md` (commands + "two scripts" binding note); recorded in §4 itself | The script, wired 2026-08-02 to the `/review-sync` Step 5.0 ritual — a human trigger, not CI (it reads local client checkouts, so CI is impossible by construction) | **both**, on a ritual trigger — see the seed-row note below |

**Seed-row note (classified as of 2026-08-02, per issue #18):** the row above is the
seed. Its wiring status is changing under #14, so the state classified is stated
explicitly:

- **At the §4 writing (2026-07-27):** the script was wired *nowhere* — §4 filed it as
  gate-only (enforcement artifact, no record), and §5 simultaneously filed it as a
  blocking claim with no trigger ("a gate with no gate"). Both framings name the same
  object from opposite sides; functionally it sat at **neither** — the convention was
  unrecorded as normative and the check ran on no trigger. An imitation surface with a
  post-mortem attached.
- **As of 2026-08-02** (post-#19/#20/#21): **both**, gated on the `/review-sync` ritual
  trigger. The residue is still open: the disposition of the standing findings (3
  NOSTAMP, 13 BEHIND as of the #19 fix run) and the §5 row's close-out are #14's
  deliverable, and a ritual trigger decays back toward *neither* if the ritual stops
  running — which is exactly what the open §5 row exists to track.

## §5 — contradictions on the record

Source: `docs/code-conventions.md` §5 (two rows).

| Contradiction | Sides | Class | State as of 2026-08-02 |
|---|---|---|---|
| `check-downstream-drift.mjs` exits non-zero on MISMATCH and is wired to no trigger | The script's blocking claim vs. no workflow, hook, or skill step invoking it | At filing (2026-07-27): **neither** in effect (see seed-row note) | Trigger wired 2026-08-02 (Step 5.0). Row remains open on the record — its close-out with the disposition of standing findings is #14's residue |
| `issue-routing.yml` ran `templates/scripts/check-issue-routing.mjs` in place while every client copies it to `scripts/` | The template header's "CONFIGURE BEFORE USE" vs. this repo never configuring it | At the time: **instruction-only** (the header told the rule; nothing enforced it, and the repo could not comply without editing what ships) | **Resolved 2026-07-27** — template copied to `scripts/`, workflow repointed |

## What this example deliberately does not do

- No enumeration rule — the rows above were read by hand from three cited sections of
  one file. How claims are enumerated from artifacts mechanically is the #13 residue.
- No score — "coverage" as a fraction is a formula, and formulas are the #13 residue.
- No claims beyond the recorded rows — CLAUDE.md gotchas and lint headers
  carry claims, but they were not part of the recorded-claims corpus this example
  was bounded to (#18's scope: §1, §4, §5 rows only).
