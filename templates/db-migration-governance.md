<!-- template: db-migration-governance.md v1.1.0 · updated 2026-08-28 -->
# Database Migration Governance

## Mandate

Every governed repo with a database uses **DbUp** as its migration runner. No custom runners, ORM auto-migrations, or idempotent-script-only patterns. DbUp is the single prescribed tooling across the fleet.

- Postgres: `dbup-postgresql` NuGet package
- SQL Server: `dbup-sqlserver` NuGet package

## Project layout

Migration runner lives in a .NET console project. Follow the enrichment-pipeline pattern as the reference implementation:

```
<db-root>/
  dbmigrations.csproj
  Program.cs
  scripts/
    migrations/              ← migration files (embedded resources)
      archive/               ← squash archives — subdirs only, not picked up by runner
        YYYYMMDD-squash/     ← one subdir per squash event
      NOTES.md               ← numbering quirks, squash history, intentional gaps
    verification/            ← post-migration assertions; test-harness only, not migrate
  harness-report.json        ← gitignored; emitted by test-harness
```

## Migration file discipline

**Naming:** keep whatever prefix shape the repo already has — a flat global sequence
(`NNNN_description.sql`) or a date prefix plus a per-date sequence
(`YYYYMMDD_NNNN_description.sql`). Both sort correctly under DbUp's lexicographic apply
order and both are in production across this fleet. What neither shape does is make the
name unique while two branches are open at once — that is the next section, and it is the
part that has drawn blood in every DbUp repo here.

**Immutability:** Once applied to any environment, migration files are immutable. No edits, no deletes. All changes go in new files.

**One concern per file:** Keep files focused. Unrelated changes → separate files.

**Squash baselines:** Use idempotent DDL throughout — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, SQL Server `IF OBJECT_ID IS NULL` guards, etc. This lets the baseline apply safely to both fresh environments and existing environments where individual scripts were previously applied.

## Numbering under concurrency (required)

**The uniqueness token in a migration filename must be derivable by its author alone.** A
number computed from the corpus — `max(existing) + 1`, or "the next free sequence for
today" — is not: two branches forked from the same base compute the same answer, and both
are right. Every open lane is a writer to a single counter that happens to live in a
filename, and git never sees the conflict, because the two files have different names and
merge clean.

Append a token the author already owns and no other lane can pick: **the issue number.**

```
0448_2308_intake_pipeline_tools.sql          # flat sequence + issue
20260827_0001_2308_intake_pipeline.sql       # date + per-date sequence + issue
```

The ordinal goes on doing its human job — prose cites "migration 0448" — and stops having
to be *correct*. Duplicate ordinals become legal by design, so a second lane landing on
the same number is not an incident: no rename, no red PR, and no hunt through the file
body for the number the migration names inside itself.

**Two gates that cannot both hold.** A repo that gates on unique prefixes *and* on
migration immutability has installed a contradiction, and will find it the first time a
race reaches the base branch: dedupe demands a rename, immutability forbids one, and the
only remaining exit is to declare the duplicate acceptable. A repo running both gates owes
a stated resolution **in the lint**, written before the incident rather than during it.

**What the ordinal does not buy.** It is tempting to defend prefix uniqueness as an
ordering guarantee — filename order equals the order production applied them, so a
database built from scratch matches one built by accretion. No author-time numbering
scheme delivers that. Numbers are assigned when the file is written and merges land in
review order, so a lower-numbered PR that sits in review lands after a higher one, and
from then on prod's apply order and a fresh build's apply order differ. A repo that needs
that property needs a check comparing the journal (`schemaversions` / `SchemaVersions`)
against the filesystem; renumbering was never that check. Relative order between two
*independent* migrations — the overwhelming majority — does not matter, and where a real
dependency exists, state it as a precondition inside the migration that fails loudly
rather than as an assumption about filenames.

> **Why this section exists:** all three DbUp repos in this fleet independently derived the
> same finding and wrote it down in three different files, while this template mentioned
> none of it. enrichment-pipeline's `scripts/migrations/NOTES.md` carries a section headed
> "Known duplicate sequence numbers (do not rename)". ai-fleet's ADR-008 lint carries a
> grandfathered-prefix set whose comment records that its dedupe rule and its immutability
> rule became mutually unsatisfiable once both racing files were journaled — "grandfathering
> is the only resolution that keeps both lints honest". analytics-infrastructure's
> `lint-sql-ddl.py` carries a register it documents as **permanent**, "(DbUp would re-run
> the renamed file as new)". Three teams, three registers of un-renamable collisions, one
> root cause. The letter-suffix escape hatch in enrichment-pipeline's archive
> (`20251025_0007b` through `_0007f`) is what a team reaches for when the scheme has no
> legal way to express two changes at once.
>
> That same corpus disproves the reassurance a per-date sequence invites. Its `NOTES.md`
> states "the date prefix provides uniqueness and ordering". It provides ordering. Eleven
> distinct dates in that history carry two or more migrations, and the collided pair the
> file itself registers — two `20260110_0036_*` scripts, ordered only by `q` sorting before
> `t` — sits four sections above that sentence in the same document.

## Squash process

**Trigger — either condition is sufficient:**
- **(b) Volume:** non-baseline increment count exceeds **50 files** for a given schema namespace
- **(c) Milestone:** before a major schema change — new namespace, domain object restructure, v2 of a core entity

**Steps:**

1. Run `dump-schema --minimal` (or equivalent) from a production-like environment
2. Curate the output — add `IF NOT EXISTS` guards, remove dump noise, add section comments
3. Write the baseline file: `YYYYMMDD_0001_squash_baseline.sql`

   Required header block:
   ```sql
   -- Squash baseline: YYYYMMDD
   -- Replaces: <first-replaced-file> through <last-replaced-file> (<N> files)
   -- Trigger: <"b: N files exceeded 50" | "c: <milestone description>">
   -- Applied to all environments as of: <YYYY-MM-DD>
   -- New migrations resume after this date prefix
   ```

4. Move replaced files into `scripts/migrations/archive/YYYYMMDD-squash/`
5. Add a squash event record to `scripts/migrations/NOTES.md`
6. Run `test-harness --spawn-container` — baseline must pass a clean ephemeral apply before merging

**Post-merge: mark baseline as pre-applied in all existing environments**

After the squash PR merges, the migration workflow will run against prod, staging, and any other live environments. Those environments already have the full schema, but DbUp has never seen the baseline filename — it will attempt to apply it.

`IF NOT EXISTS` guards on `CREATE TABLE` prevent errors there, but they don't cover every DDL form. Constraints (primary keys, foreign keys, unique) added outside of `CREATE TABLE ... IF NOT EXISTS` will fail with "already exists" errors when DbUp tries to apply the baseline. The reliable fix is to pre-register the baseline in `schemaversions` before re-running the migration workflow:

**Postgres:**
```sql
INSERT INTO public.schemaversions (scriptname, applied)
SELECT 'dbmigrations.scripts.migrations.<BASELINE_FILENAME>.sql', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.schemaversions
  WHERE scriptname = 'dbmigrations.scripts.migrations.<BASELINE_FILENAME>.sql'
);
```

**SQL Server:**
```sql
INSERT INTO SchemaVersions (ScriptName, Applied)
SELECT 'dbmigrations.scripts.migrations.<BASELINE_FILENAME>.sql', GETUTCDATE()
WHERE NOT EXISTS (
  SELECT 1 FROM SchemaVersions
  WHERE ScriptName = 'dbmigrations.scripts.migrations.<BASELINE_FILENAME>.sql'
);
```

The `WHERE NOT EXISTS` guard makes this idempotent — safe to run multiple times or if two environments share a connection. Run against every live environment (prod, staging, qa, dev) before re-triggering the migration workflow.

**Verify before re-running the workflow:**
```sql
SELECT scriptname FROM schemaversions WHERE scriptname LIKE '%squash_baseline%';
-- must return one row per environment
```

Then re-trigger the migration workflow to confirm it skips the baseline cleanly.

## CLI commands (reference implementation)

Every DbUp project must expose at minimum:

| Command | Purpose |
|---|---|
| `migrate` | Apply pending migrations to the target DB |
| `test-harness` | Spin up ephemeral DB, apply all migrations, run verification scripts, drop DB |
| `dump-schema` | Export current schema (use `--minimal` to strip noise) |
| `generate-migration` | Scaffold a new timestamped empty migration file |
| `verify` | Non-destructive parse/execute of each script inside a rollback transaction |

See enrichment-pipeline `dbmigrations/README.md` for the full CLI contract.

> **Check what `generate-migration` actually emits before relying on it.** In all three of
> this fleet's DbUp projects the command scaffolds `yyyyMMddHHmmss-slug.sql` — a filename
> that matches no repo's convention and would fail every repo's numbering lint. The command
> this table mandates is therefore used nowhere. Either fix the generator to emit the repo's
> real convention *including* the author-local token — the generator is the natural place to
> allocate it — or stop claiming the command.

## CI/CD requirements (required PR gate)

Every repo with a DbUp migration project must have a **harness PR gate**:

- Workflow file: `.github/workflows/db-migration-harness.yml`
- Trigger: any PR touching `<dbmigrations-dir>/**` or the workflow file itself
- Kind: **GATE** — deterministic, blocks merge on failure
- Must be registered as a **required status check** in GitHub branch protection settings

**Harness behavior:**
1. Spin up ephemeral DB via Docker
2. Apply all migrations from baseline to head
3. Load seed data
4. Run verification scripts (existence checks, row-count sanity, function smoke tests)
5. Drop the ephemeral DB
6. Emit `harness-report.json` as a workflow artifact

Templates: `templates/workflows/db-migration-harness-postgres.yml` and `templates/workflows/db-migration-harness-sqlserver.yml`.

**Two harness runs, two purposes:**

| When | Where | Purpose |
|---|---|---|
| On PR | `.github/workflows/db-migration-harness.yml` | Gate: catch problems before merge |
| On deploy | Inside the prod-deploy workflow, before `migrate` runs | Final safety check before touching real data |

Both must exist. The PR gate is the primary safety net; the deploy-time harness is a belt-and-suspenders check.

<!-- [PROPOSED from source repo] New section — review and adapt before committing -->
## Breaking-migration lint (required PR gate)

The harness gate above catches migrations that fail to *apply*. It does not catch a
migration that applies cleanly but drops or renames a column/table while code elsewhere
still queries the old identifier — this can slip through even when the migration and its
paired code fix land in the same PR, if a second, unrelated call site is missed.

- Script: `templates/scripts/check-breaking-migrations.mjs`
- Kind: **GATE** — deterministic diff-text check, no DB connection needed
- Checks: `DROP COLUMN`, `DROP TABLE`, `RENAME COLUMN` statements still in effect after
  replaying all migrations in order, cross-referenced against every source directory
  that queries the database

<!-- [PROPOSED — replace with your incident. Example pattern from source repo: an outage
where a schema drop and its intended code fix landed together, but a second, unrelated
file still queried the dropped column and nothing mechanical caught it.] -->
> **Why this gate exists:** a migration and its paired code change can both be correct in
> isolation and still break production, if a second file depends on the identifier being
> removed and nobody thought to check the whole repo, not just the obvious call site.

## Adopting DbUp in an existing repo

**Settle the numbering scheme before adoption — adoption is a one-way door on renaming.**
Before the first DbUp run, a numbering mistake is a `git mv`. After it, every file DbUp has
journaled is un-renamable in every environment that journaled it, and every future collision
is permanent. analytics-infrastructure finished renumbering its duplicate prefixes on
2026-07-04 — `031→066`, `042→067`, `043→068`, `312→325` — and adopted DbUp on 2026-07-05.
That window was one day wide and nobody told the repo it was closing. Make the three
decisions above (prefix shape, author-local token, and the lint's stated collision
resolution) *first*: they are cheap before adoption and permanent after.

**Repo has a custom runner (non-DbUp):**
1. Create the DbUp project
2. Embed existing migration files as resources
3. Handle journal bootstrap: write a one-time `bootstrap-journal` command or SQL script that populates DbUp's `schemaversions` table from the previous tracker's applied-script records
4. Test bootstrap against a dev environment before rolling to prod
5. Remove the old runner; wire DbUp into the deploy workflow

**Repo has idempotent scripts but no runner (SQL Server pattern):**
1. Create the DbUp project (`dbup-sqlserver`)
2. Embed existing idempotent SQL files — they become the day-0 baseline set
3. First DbUp run on existing environments: all scripts apply as no-ops (IF OBJECT_ID guards protect them), all get logged to `schemaversions`
4. Going forward: new changes go in new numbered files using the standard append-only pattern
5. No journal bootstrap needed — the idempotent guard is the mechanism
6. **Update repo-local schema-change documentation.** Repos that previously used the idempotent-replay model often have documentation telling developers to "edit the existing file" (e.g. "add the column to the CREATE TABLE block AND add an ALTER TABLE ADD section in the same file"). Those instructions are now stale — they describe the pre-DbUp model where every file re-ran on every deploy. After DbUp adoption, editing an already-journaled file is invisible to the migration runner (the file is skipped by name). Every such doc must be updated to say "new schema changes go in new numbered files" in the same PR that adopts DbUp. Failure to do this causes stuck migrations: developers (and AI agents) follow the stale docs, edit existing files, and DbUp never runs the changes.

   **Where to look:** Schema-change instructions can live in any file that agents or developers read for guidance. Check all of:
   - Agent instruction files — `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `GEMINI.md`, or any other tool-specific instruction file the repo uses
   - ADRs — any architecture decision record that governs schema DDL patterns
   - README and contributing guides — `README.md`, `CONTRIBUTING.md`, repo-root or `docs/` prose
   - Pre-commit hook messages or lint script comments that reference the old pattern
   
   Search broadly: `grep -rI "both changes.*same file\|CREATE TABLE block\|ALTER TABLE ADD section\|edit.*existing.*migration\|re-run.*every.*deploy" .` and update or annotate every hit.

## Optional: schema metadata publishing

Adopt when the schema is referenced by AI agents or frequently confuses analytics consumers.

- **`docs/schema-catalogue.json`** — auto-generated from the live DB post-migration. Covers all tables and views with column counts. Regenerate after each schema-changing deploy. See analytics-infrastructure `docs/sql-schema.json` as the reference format.
- **`docs/schema/<table>.json`** — hand-curated per-table files. Write one when a table has non-obvious usage patterns, join gotchas, or semantic caveats that don't belong in migration comments. See analytics-infrastructure `docs/sql-schema/<table>.json` as the reference format.

Neither file is mandatory. Both are owned by the repo team.

## Audit checklist

Governance audits should verify all of the following:

- [ ] DbUp project exists and targets the correct DB engine (Postgres or SQL Server)
- [ ] `db-migration-harness` workflow exists and is wired as a required status check in branch protection
- [ ] <!-- [PROPOSED from source repo] --> Breaking-migration lint (`check-breaking-migrations.mjs` or equivalent) is wired as a required PR gate — a dropped/renamed column or table has zero remaining code references
- [ ] No migration file has been mutated after its merge commit — verify with `git log --follow -p <file>` for any suspicious edits post-merge
- [ ] Non-baseline increment count is below 50; if above, a squash is planned or in-flight
- [ ] Dead migration namespaces (directories with no active runner config referencing them) are removed or archived — a directory that exists but is not embedded by any DbUp project is dead
- [ ] `scripts/migrations/NOTES.md` is present and documents any numbering quirks, intentional gaps, and squash history
- [ ] Migration filenames carry an **author-local** uniqueness token (issue number or equivalent) — no scheme in which two open branches compute the same name
- [ ] If the repo gates on both prefix uniqueness and migration immutability, the lint itself states which one yields when a race reaches the base branch, and any register of accepted collisions is documented as **permanent** rather than as burn-down debt
- [ ] `generate-migration` emits a filename that satisfies the repo's own numbering lint
- [ ] Nothing in the repo claims that a date prefix — or any corpus-derived sequence — makes a filename unique; a per-date sequence provides ordering only
- [ ] Repo-local schema-change docs match the append-only discipline — no stale instructions telling developers or agents to edit existing migration files after deployment. Check all agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `GEMINI.md`, etc.), ADRs, README, and contributing guides. Search for patterns like "both changes in the same file", "add to the CREATE TABLE block", or "ALTER TABLE ADD section below" that describe the pre-DbUp idempotent-replay model
