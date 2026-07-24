<!-- template: db-migration-governance.md v1.0.0 · updated 2026-07-24 -->
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

**Naming:** `YYYYMMDD_NNNN_description.sql` — NNNN is a 4-digit sequence within the date, starting at `0001`.

**Immutability:** Once applied to any environment, migration files are immutable. No edits, no deletes. All changes go in new files.

**One concern per file:** Keep files focused. Unrelated changes → separate files.

**Squash baselines:** Use idempotent DDL throughout — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, SQL Server `IF OBJECT_ID IS NULL` guards, etc. This lets the baseline apply safely to both fresh environments and existing environments where individual scripts were previously applied.

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
- [ ] Repo-local schema-change docs match the append-only discipline — no stale instructions telling developers or agents to edit existing migration files after deployment. Check all agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `GEMINI.md`, etc.), ADRs, README, and contributing guides. Search for patterns like "both changes in the same file", "add to the CREATE TABLE block", or "ALTER TABLE ADD section below" that describe the pre-DbUp idempotent-replay model
