# Migration numbering catchup: ADR-002 §5 revision + the generator decision (2026-08-28)

**Applies to:** HopSkipInc/analytics-infrastructure.
**Follows:** `2026-08-28-migration-numbering-concurrency.md` (applied: PR
HopSkipInc/analytics-infrastructure#603), which deliberately left two threads open.
This prompt closes them. **Renames nothing.**

## 1. Revise ADR-002 Decision §5 — via a new ADR, not in place

ADR-002's Decision §5 still reads "**Numeric file prefixes are unique**" and names
`lint-sql-ddl.py` as its enforcement — but rule 5 was relaxed by #603, so the Accepted
record contradicts its own lint. The mediated path refuses a Decision edit (guard-locked
byte-identical), and a Consequences note was refused too (ADR-002 predates the required
`## Enforcement` section; adding one is bucket-B human-batched backfill, not a sync-time
ride-along).

The house pattern for changing *part* of an Accepted ADR is a new ADR amending by
reference (precedent in this repo: ADR-023 amends ADR-018 Decision 6):

```bash
node scripts/write-record.mjs create adr <draft-file>
```

Draft a short ADR — suggested title "Schema file numbering: the ordinal is a label, the
issue token is the key" — whose Decision amends ADR-002 Decision §5 by reference: the
`NNN` prefix is a human label, not a uniqueness key; uniqueness comes from the
author-local issue token (`NNN_ISSUE_description.sql`, required on new files by
lint-sql-ddl rule 5 since #603); duplicate ordinals under different issues are legal.
Status **Accepted** is legitimate at creation: the enforcement already shipped with #603.
This repo's `write-record.mjs` is v1.1.0 and looks for the post-write index gate under
the name `check-adr-readme-sync.mjs` while this repo's lint is `lint-adr-readme-sync.mjs`
(the known 2026-08-14 drift) — expect the spurious `UNGUARDED` warning and run
`node scripts/lint-adr-readme-sync.mjs` by hand after the create.

If ADR-002's missing `## Enforcement` section blocks the *create* validation of the new
record (it shouldn't — the check applies to the new file, not its references), stop and
report rather than restructuring ADR-002 in passing: its section backfill is bucket-B
human work.

## 2. The `generate-migration` decision — install or deviate, on the record

The template (`db-migration-governance.md` v1.1.0, "Every DbUp project must expose at
minimum") mandates a `generate-migration` command; this repo's `sql/dbmigrations` has
none (`migrate` + `test-harness` only). Pick one, and record the pick in `CLAUDE.md`'s
Applied-governance-updates entry for this prompt:

- **(a) Port the generator** — the corrected implementation from enrichment-pipeline PR
  HopSkipInc/enrichment-pipeline#507, adapted to this repo's flat `NNN_ISSUE_` naming
  (next free prefix over `sql/schema/`, `--issue` required, underscores). The generator
  is the natural place to allocate both tokens, and `lint-sql-ddl.py` rule 5's token
  check will pass its output — that acceptance is the verification (generate a probe,
  run the lint, delete the probe).
- **(b) Record the deviation** — if the repo deliberately does not want a scaffolder
  (files here are hand-authored DDL batches with heavy local conventions), say so in the
  Synced-templates row for `db-migration-governance.md` so the drift check reads it as
  sanctioned, not absent. Deviating on a "must expose" row is a real decision; (a) is the
  default unless the owner says otherwise.

## 3. Record

Append to `### Applied governance updates` in `CLAUDE.md` with the PR number, the new ADR
number, and which fork was taken in §2 (and why, if (b)).
