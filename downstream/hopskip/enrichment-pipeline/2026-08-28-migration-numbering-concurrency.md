# Migration numbering under concurrency: correct the uniqueness claim (2026-08-28)

**Applies to:** HopSkipInc/enrichment-pipeline.
**Ships with:** `templates/db-migration-governance.md` **v1.1.0** — new `## Numbering under
concurrency (required)` section, the adoption one-way-door warning, four audit-checklist
rows, and a naming rule that no longer mandates a prefix shape.
**Source:** a 2026-08-27 census of all three DbUp repos. This repo is the template's named
reference implementation and the only install of its `YYYYMMDD_NNNN` naming rule — and the
census found the collision living in its `NOTES.md` the whole time.

## 0. What the census found here

`dbmigrations/scripts/migrations/NOTES.md` carries a section headed **"Known duplicate
sequence numbers (do not rename)"**, with the reasoning stated correctly:

> Renaming them would cause DbUp to treat the renamed file as a new, unapplied script and
> attempt to re-run it.

That is the same conclusion ai-fleet and analytics-infrastructure each reached
independently, in their own lints, in their own words. Three repos, three registers of
un-renamable collisions, one root cause — and the template mentioned none of it until
v1.1.0.

Three further facts from the same corpus:

- **Same-day pairs are routine.** Eleven distinct dates in the history (active + archive)
  carry two or more migrations, up to fifteen on `20251025`. The date prefix does not
  isolate concurrent lanes.
- **The registered collision is real:** `20260110_0036_add_quality_scores_to_enrichment_jobs.sql`
  and `20260110_0036_add_transliterated_venue_fields.sql` — same date, same sequence,
  ordered only by the accident of `q` sorting before `t`.
- **The archive shows the hand-rolled escape hatch:** `20251025_0007b` through `_0007f`,
  five letter-suffixed files hanging off one sequence number, plus a genuine same-date
  duplicate at `20251026_0014`. That is what a team reaches for when the naming scheme has
  no legal way to express two changes at once.

## 1. Correct the false claim in `NOTES.md`

The file's last section currently states:

> Scripts after 20260110 restart at `_0001_` per date prefix rather than a global sequence.
> This is intentional — the date prefix provides uniqueness and ordering.

It provides **ordering**. The `0036` pair four sections above that sentence is the disproof
of uniqueness, in the same document. Rewrite the sentence to say what is true: the date
prefix provides ordering and bounds a collision to a single day; it does not make the name
unique, because two lanes opened on the same day both compute the same next sequence.

This correction matters beyond tidiness — that sentence is the reassurance that keeps the
next author from adding a uniqueness token.

## 2. Naming: append the issue number

New migrations become `YYYYMMDD_NNNN_ISSUE_description.sql`:

```
20260828_0001_461_add_venue_dedup_index.sql
```

The date keeps ordering, `NNNN` keeps the per-date sequence, and the issue number makes the
name unique with a token the author already owns and no other lane can pick. Two migrations
authored the same day are then legal by construction — no letter suffixes, no `NOTES.md`
entry, no "do not rename" register growing.

Existing files are **not** renamed. Every one of them is journaled; renaming is exactly the
thing `NOTES.md` correctly forbids.

## 3. Mark the register permanent, and stop calling it a quirk

The "Known duplicate sequence numbers (do not rename)" table stays. Change its framing: it
is a **permanent** record of accepted collisions, not a list of quirks awaiting cleanup —
there is no cleanup available, by DbUp's design. Note that the pairs are safe because the
two migrations are independent, and that this is the general rule: relative order between
independent migrations does not matter.

One correction to the table itself while you are in there: the first row pairs
`20260102_0033_*` with `20260103_0033_*`, which are on **different dates** and therefore not
a collision at all. Only the `20260110_0036` pair is one. Fix or drop the row.

## 4. No numbering lint here — record the decision

This repo has **no** mechanical numbering check, and the census does not recommend adding
one. Four active migrations post-squash, historically about one per day, and the collision
register already lives in `NOTES.md` where the audit checklist reads it. Inventing a gate
for a four-file corpus is the over-codification the methodology's own §3 exists to prevent.

Record that as a deliberate absence — in `docs/code-conventions.md` §3 (Not codified) if
that is where this repo keeps such rulings — so the next governance sync does not read the
gap as an oversight and propose the lint. If migration volume or concurrency rises, the
trigger to revisit is the first same-day pair authored *after* this prompt lands.

## 5. Fix `generate-migration`

`dbmigrations/GenerateMigrationCommand.cs` scaffolds `yyyyMMddHHmmss-slug.sql` — a filename
that matches this repo's convention not at all. The same defect exists in ai-fleet's copy,
which is why the command the template mandates is used nowhere in the fleet.

This repo is the reference implementation for the template's CLI contract, so fix it here
first: emit `YYYYMMDD_NNNN_ISSUE_description.sql`, computing `NNNN` as the next free
sequence for today's date and taking the issue number as a required argument. The generator
is the natural place to allocate both tokens, and a correct generator is what makes step 2's
convention self-enforcing without a lint.

## 6. Declare the template

Add `db-migration-governance.md` to `### Synced templates` at **v1.1.0**. This repo is
on-template for the prefix shape; the new material is the concurrency section, which changes
the naming convention (step 2) and the register's framing (step 3).

## 7. Verification — observe the effect, never grep the file you just wrote

1. **The generator produces a usable name.** Run `generate-migration` with an issue number
   and confirm the emitted filename matches `^\d{8}_\d{4}_\d+_` and lands in
   `scripts/migrations/`. Delete the scaffold. If the file lands anywhere else — e.g. a
   directory literally named `scripts\migrations` — the default script-folder path is not
   platform-neutral: fix the default (forward slashes are accepted by .NET on Windows
   too), do **not** work around it with an explicit `-s`. *(Found live during application:
   the pre-existing default `scripts\migrations` wrote probes to a garbage directory on
   Linux; fixed in the same PR.)*
2. **A same-day pair is expressible.** Generate two migrations on the same day for different
   issues and confirm both names are distinct with no suffix hack needed. Delete both.
3. **The harness still applies the corpus from scratch.** Run
   `test-harness --spawn-container` and confirm a clean apply — this is the check that a
   naming change has not disturbed lexicographic apply order.
4. **`NOTES.md` no longer asserts uniqueness.** Read the corrected section and confirm it
   claims ordering only, and that the `20260102`/`20260103` non-collision row is gone or
   fixed.

## 8. Record

Append to `### Applied governance updates` in `CLAUDE.md` with the verification results and
the PR number. If any path or claim here does not match the repo, **stop and report upstream
instead of adapting silently.**

## Applied — 2026-08-28

HopSkipInc/enrichment-pipeline#507 — generator emits `YYYYMMDD_NNNN_ISSUE_description.sql`
with `--issue` required; `NOTES.md` uniqueness claim corrected to ordering-only, register
reframed permanent, non-collision `20260102`/`20260103` rows dropped; no-lint decision
recorded in `docs/code-conventions.md` §3 with the revisit trigger (first same-day pair
authored after 2026-08-28); template declared v1.1.0. Verification step 1 caught the
Windows-path default (see the note inline there); `test-harness --spawn-container` PASS.
