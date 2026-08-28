# Migration numbering under concurrency: make the collision legal (2026-08-28)

**Applies to:** HopSkipInc/ai-fleet.
**Ships with:** `templates/db-migration-governance.md` **v1.1.0** — new `## Numbering under
concurrency (required)` section, the adoption one-way-door warning, four audit-checklist
rows, and a naming rule that no longer mandates a prefix shape.
**Source:** a 2026-08-27 census of all three DbUp repos in the fleet. This repo supplied
the load-bearing evidence; the template previously said nothing about any of it.

## 0. Why this is not a renumbering prompt

**Nothing in `db/dbmigrations/scripts/migrations/` gets renamed by this prompt.** All 385
files are journaled. ADR-008 Rule 6 forbids the rename and DbUp would re-run a renamed
file as new. The change is to the *rule*, not to the corpus.

The evidence that the rule is the problem, all of it already in this repo:

- DbUp journals by filename, and **nine duplicate prefixes are already applied in prod**
  (`0081`, `0084`, `0110`, `0112`, `0113`, `0134`, `0135`, `0145`, `0430`) with no
  incident.
- Exactly **one** file in the repo parses the numeric prefix:
  `host/scripts/check-adr008-migrations.mjs` (checks 4 and 5). Not DbUp, not the harness,
  not the immutability lint.
- The `0430` grandfather comment records the trap in its own words: #2143 and #2142 merged
  nine minutes apart, both green before the other landed, and once both were journaled
  Rule 4 (rename to dedupe) and Rule 6 (never rename) were **mutually unsatisfiable** —
  "grandfathering is the only resolution that keeps both lints honest."
- Renumbering is not `git mv`. Recent migrations name their own number internally 2–15
  times (`0448`: 15, `0446`: 11, `0438`: 10), so every collision fix is a rename plus a
  body hunt on a red PR.
- The cost is invisible: renames happen pre-merge and squash away, so `git log` over the
  migrations directory shows **zero** rename events. The only record is the activity
  ledger — three renumber incidents on 2026-08-27 alone.

## 1. Naming: append the issue number

New migrations are `NNNN_ISSUE_description.sql`:

```
0449_2308_intake_pipeline_tools.sql
```

`NNNN` stays a four-digit `max + 1` guess and no longer has to be right. `ISSUE` is the
GitHub issue number, which `pr-structure.yml` already requires in every PR body, so it
costs nothing to obtain and no other lane can pick it. Two lanes both landing on `0449` is
legal.

Existing files are untouched and carry no issue token — the lint below must not demand one
retroactively.

## 2. Relax Check 4 in `host/scripts/check-adr008-migrations.mjs`

Two changes in that file, both in check 4:

1. **Group by the `NNNN_ISSUE` pair, not by `NNNN`.** A filename matching
   `^(\d{4})_(\d+)_` keys on `prefix + '_' + issue`; a filename matching only `^(\d{4})_`
   keys on the prefix alone (that is the whole existing corpus). Duplicate *keys* still
   hard-fail — two migrations for the same issue at the same ordinal is a real authoring
   mistake.
2. **Require the issue token on newly added files only.** Resolve the base ref exactly as
   `check-migration-immutability.mjs` does (`GITHUB_BASE_REF` → `origin/master` →
   `origin/main`, and **SKIP with a message if none resolves** — a lint that hard-fails a
   detached checkout gets disabled). For each file added in `git diff --name-status
   <merge-base>` — two dots, against the **working tree**, matching the immutability
   lint's own shape, so a staged-but-uncommitted file is caught at `npm run check` time,
   which is exactly when an author runs it — fail if it does not match `^\d{4}_\d+_`.
   Files already on the base branch are never checked for the token.
   *(Corrected post-application: this step originally read `...HEAD`, which misses
   uncommitted work; the applied implementation uses the working-tree form.)*

Leave `GRANDFATHERED_DUPLICATE_PREFIXES` in place — the nine historical entries are still
the record — but update its comment: the set is **permanent and closed**, not burn-down
debt awaiting #594's squash, because the new naming means no future collision needs to
enter it. State in the same comment which gate yields when a race reaches master: with
duplicate ordinals legal, Rule 4 no longer contends with Rule 6 at all.

Check 5 is unaffected — it parses `^(\d{4})_` and only reads the prefix.

## 3. Amend ADR-008 Rule 4

Through the mediated path, never a raw edit. **Corrected post-application:** the command
originally printed here (`write-record.mjs amend adr 008 --section Decision`) does not
exist — no write-record version (1.1.0–1.3.0) has a `--section` flag; `amend` is a
full-file replace under section guards. And the guard locks an **Accepted** record's
`## Context` and `## Decision` byte-identical, so "Rule 4 becomes …" is not
agent-executable as a Decision edit in any repo. The house channel for a dated rule
change on an Accepted record — and what was actually applied (PR
HopSkipInc/ai-fleet#2342) — is:

```bash
# revise a full copy of the record: dated Consequences note + the Enforcement
# table row; Context/Decision byte-identical
node host/scripts/write-record.mjs amend adr 008 <revised-file>
```

The Consequences note carries: migration numbers are a human label, not a unique key;
uniqueness comes from the issue token; `next = max(existing) + 1` is a convenience, not a
contract. Keep the honest reasoning — Rule 4's text already concedes that "duplicates
don't break apply order today, but they do break the audit log", and the audit log is
`git log`, which orders by commit. Add the finding the `0430` incident produced: a
dedupe-by-rename rule and an immutability rule cannot both be enforced once a race is
journaled. The note itself flags the Decision text as still reading "must be unique",
with revision owed as a human-decided follow-up (see the catchup prompt:
`2026-08-28-migration-numbering-catchup.md`).

Update the ADR's `## Enforcement` table row for `lint:adr008` to describe the new Rule 4
(that section is not guard-protected; the amend lands it).

**Do not** claim the ordering property. Nothing in this repo verifies that filename order
matches prod apply order — `VerifyCommand` and `TestHarnessCommand` never compare
`schemaversions` to the filesystem — and numbers assigned at author time cannot deliver it
while merges land in review order. If that property is wanted, it is a separate journal-vs-
filesystem check and its own issue.

## 4. Fix the dead pre-commit migration gate (separate PR)

`.githooks/pre-commit` selects staged migrations with:

```bash
MIGRATIONS_STAGED=$(echo "$STAGED" | grep '^db/migrations/host/.*\.sql$' || true)
```

`db/migrations/` **does not exist** — the DbUp cutover on 2026-07-06 moved migrations to
`db/dbmigrations/scripts/migrations/` and renamed the journal from `schema_migrations` to
`schemaversions`. The variable is therefore always empty, so the "verify each staged
migration applied to local dev-pg" step has not run since the cutover, while ADR-008's
enforcement table still lists it as a Gate. The hook also queries `schema_migrations`,
which is the retired table.

Fix both the path and the journal table. Land it as its **own PR** — it is unrelated to the
numbering decision and should not wait on it.

## 5. Stop migrations naming their own number

Convention, not a lint: a `RAISE NOTICE` should say what changed, not which file changed
it. The script name is already in the DbUp journal and in the error output. This is what
turns a rename into a hunt, and it will keep doing so under any scheme. Apply it to new
migrations; do not touch existing ones.

## 6. Declare the template

This repo has never declared `db-migration-governance.md` in its `### Synced templates`
table — ADR-008 predates the template by two months and the DbUp cutover embedded the
existing files as-is. Add the row now, at **v1.1.0**, with the deviation noted: this repo
runs a flat `NNNN_` prefix rather than the template's `YYYYMMDD_NNNN`, which v1.1.0
explicitly sanctions ("keep whatever prefix shape the repo already has").

## 7. Verification — observe the effect, never grep the file you just wrote

Run all of these on the applying branch:

1. **Same ordinal, different issues → passes.** Create `0449_1111_probe_a.sql` and
   `0449_2222_probe_b.sql`, run `node host/scripts/check-adr008-migrations.mjs`, confirm
   green. Delete both.
2. **Same ordinal, same issue → fails.** Create `0449_1111_probe_a.sql` and
   `0449_1111_probe_b.sql`, confirm the lint fails naming the duplicate key. Delete both.
3. **New file without the token → fails.** Create `0449_probe.sql`, confirm the lint fails
   telling the author to add the issue number. Delete it.
4. **History is not retroactively failed.** With the working tree clean, the lint is green
   over all 385 existing tokenless files. This is the check that proves step 2's
   added-files-only scoping works.
5. **No base ref → SKIP, not fail.** Run the lint with `GITHUB_BASE_REF` unset in a
   detached checkout and confirm it reports SKIPPED rather than passing or failing.
6. **The hook actually fires.** Stage a real new migration and confirm the pre-commit hook
   reaches the dev-pg check — the observable effect is the hook *refusing the commit* when
   the migration has not been applied locally. A `grep` of the hook proves nothing; the
   previous version was consistent with itself and inert.
7. `npm run check` from `host/` is green, and the migration harness passes on the branch.

## 8. Record

Append to `### Applied governance updates` in `CLAUDE.md` with the deviations, the
verification results, and the PR numbers. If any step's target turns out not to match this
repo as described, **stop and report upstream rather than adapting silently** — that is the
failure mode the 2026-08-05 prompt produced here, and this prompt names live paths
precisely so it can be checked.

## Applied — 2026-08-28

- **§4 (dead pre-commit gate):** HopSkipInc/ai-fleet#2341 — fixed #1627; the dry-run
  section's `db/migrate.py` target was deleted in the cutover, so the section was retired
  (its coverage lives in the dev-pg apply + the harness workflow). Also installed
  `lint:githooks-migration-path` and 12 fire-the-hook vitest cases per the issue.
- **§1–3, 5–6 (numbering):** HopSkipInc/ai-fleet#2342 — check 4 keys on `NNNN_ISSUE`,
  token required on added files (working-tree diff, not `...HEAD` — see §2), ADR-008
  amended via the Consequences+Enforcement channel (see §3), `NOTES.md` §Naming added,
  template declared v1.1.0 with the flat-prefix deviation.
- **Found in application:** `check-migration-immutability.mjs` diffed the whole migrations
  directory unfiltered and would have failed *any* `NOTES.md` edit — never exercised
  because the lint (#1657) postdates the last NOTES.md edit by one day. Scoped to the
  journaled set (`*.sql`) in #2342, probe-verified both directions.
- **Deviations from this prompt's letter:** the §2 diff shape and the §3 amend mechanism,
  both corrected inline above; the ADR-008 Decision revision is carried by the catchup
  prompt.
