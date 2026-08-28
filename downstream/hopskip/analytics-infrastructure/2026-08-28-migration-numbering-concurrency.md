# Migration numbering under concurrency: decide before the first race (2026-08-28)

**Applies to:** HopSkipInc/analytics-infrastructure.
**Ships with:** `templates/db-migration-governance.md` **v1.1.0** — new `## Numbering under
concurrency (required)` section, the adoption one-way-door warning, four audit-checklist
rows, and a naming rule that no longer mandates a prefix shape.
**Source:** a 2026-08-27 census of all three DbUp repos. This repo has **not** had the
incident yet. That is the reason to apply this now rather than later.

## 0. The loaded trap

This repo enforces unique numeric prefixes (`scripts/lint-sql-ddl.py` rule 5) with
`GRANDFATHERED_DUPLICATE_PREFIXES = set()` — **empty**. It also enforces append-only
immutability, because `sql/dbmigrations` journals every file by filename in
`dbo.SchemaVersions` and `schema.yml` fires **automatically on push to main**.

Those three facts compose into a trap with no legal exit. Two PRs racing on the same
prefix both merge; the second merge deploys and journals; the file can no longer be renamed
(DbUp would re-run it as new); rule 5 goes red on `main`; and the only way to green is to
edit the lint and create the first entry in that empty set — under incident pressure,
deciding policy in a hotfix.

ai-fleet has already been through this door. Its `0430` pair merged nine minutes apart on
2026-08-20, both green before the other landed, and its lint now records that dedupe-by-
rename and immutability were "mutually unsatisfiable" once both were journaled.
Grandfathering was the only resolution.

**The window in which this repo could have fixed numbering cheaply has already closed.** The
prefix burn-down finished 2026-07-04 — `031→066`, `042→067`, `043→068`, `312→325` — and DbUp
was adopted 2026-07-05. One day. Everything journaled since then is un-renamable.

## 1. Naming: append the issue number

New files in `sql/schema/` become `NNN_ISSUE_description.sql`:

```
614_2308_gold_app_hotels_add_region.sql
```

`NNN` stays a `max + 1` guess and no longer has to be right; the issue number makes the
name unique and no other lane can pick it. Two lanes both landing on `614` is legal.

Existing files carry no issue token and are **not** renamed or retroactively failed.

## 2. `scripts/lint-sql-ddl.py` — three changes

1. **Rule 5 keys on the `NNN_ISSUE` pair.** A filename matching `^(\d+)_(\d+)_` keys on
   `prefix + '_' + issue`; one matching only `^(\d+)_` keys on the prefix alone (the whole
   existing corpus). Duplicate *keys* still fail — two files for one issue at one ordinal is
   an authoring mistake, not a race.
2. **Require the token on newly added files only.** Diff against the base ref and check only
   files added on the branch; if no base ref resolves, report SKIPPED rather than passing or
   failing. Never demand the token from a file already on `main`.
3. **Record the resolution in the lint, before the incident.** `GRANDFATHERED_DUPLICATE_PREFIXES`
   stays empty, and its comment now states *why it can stay empty*: with duplicate ordinals
   legal, a race no longer produces a rule-5 violation, so nothing needs to enter it. Add the
   sentence naming which gate yields if a pre-token collision ever surfaces: immutability
   wins, the duplicate is accepted, and the entry is permanent — never burn-down debt.

**Leave rule 7 exactly as it is.** The unique-base-filename rule, and its register documented
as *permanent* because "DbUp would re-run the renamed file as new", is the best-designed
collision control in the fleet. It targets prose ambiguity rather than apply order, and it is
being promoted upstream on this repo's evidence, not weakened here.

## 3. Update `CLAUDE.md` §Schema Changes

The §Key rules list gains the naming rule and the reason. The existing successor-suffix rule
("Successor migrations get a disambiguating suffix") stays — it solves a different problem
(two files touching the same view) and rule 7 keeps enforcing it.

Do not describe the ordinal as unique. It is a label.

## 4. Declare the template

Add `db-migration-governance.md` to `### Synced templates` at **v1.1.0**, noting the
deviation: this repo runs a flat `NNN_` prefix, not the template's `YYYYMMDD_NNNN`, which
v1.1.0 explicitly sanctions.

## 5. Check what `generate-migration` emits

`sql/dbmigrations` exposes the command the template mandates. In the other two DbUp repos it
scaffolds `yyyyMMddHHmmss-slug.sql` — a name that fails their own numbering lints, which is
why nobody uses it. Check this repo's implementation. If it has the same defect, either fix
it to emit `NNN_ISSUE_description.sql` (the generator is the natural place to allocate both
tokens) or record that the command is unused here. Do not leave a mandated command emitting
names the repo's own gate rejects.

## 6. Verification — observe the effect, never grep the file you just wrote

1. **Same ordinal, different issues → passes.** Create `614_1111_probe_a.sql` and
   `614_2222_probe_b.sql`, run `python scripts/lint-sql-ddl.py`, confirm green. Delete both.
2. **Same ordinal, same issue → fails.** `614_1111_probe_a.sql` + `614_1111_probe_b.sql`
   fails naming the duplicate key. Delete both.
3. **New file without the token → fails**, with a message telling the author to add the issue
   number. Delete it.
4. **History is not retroactively failed.** Clean tree, lint green across all 223 existing
   tokenless files. This proves the added-files-only scoping.
5. **Rule 7 still fires.** Create a file whose base name duplicates an existing one and
   confirm it still fails — this change must not have widened rule 5 into rule 7's territory.
6. **No base ref → SKIPPED**, not a pass and not a failure.
7. The `db-migration-harness` gate and the full `ci.yml` job set are green on the branch.

## 7. Record

Append to `### Applied governance updates` in `CLAUDE.md` with the verification results and
PR number. If any path or claim here does not match the repo, **stop and report upstream
instead of adapting silently.**
