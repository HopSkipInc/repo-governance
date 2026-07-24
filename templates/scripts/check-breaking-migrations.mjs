#!/usr/bin/env node
// template: scripts/check-breaking-migrations.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:breaking-migrations  [governance template — copy to <project migration-runner dir>/scripts/
 * or wherever your project's lint scripts live]
 *
 * A migration that drops a column/table, or renames a column, is safe only if no code
 * elsewhere in the repo still queries the old identifier. This can go wrong even when
 * the migration and its paired code change land in the same commit: the migration drops
 * a column in the same PR that updates one call site, but a second, unrelated file still
 * queries the old identifier and review misses it. Nothing mechanical catches this unless
 * something checks the *absence* of a reference, not just the presence of the intended one.
 *
 * This is the mirror check to a schema-promises lint (if your repo has one): that asks
 * "does an ADDED enforcement-bearing element have a consumer?"; this asks "does a
 * REMOVED/RENAMED element have zero remaining consumers?" Both are diff-text checks —
 * no DB connection needed, so this runs in any CI job without a database fixture.
 *
 * Detected patterns (case-insensitive):
 *   ALTER TABLE <table> DROP COLUMN [IF EXISTS] <column>;
 *   DROP TABLE [IF EXISTS] <table>;
 *   ALTER TABLE <table> RENAME COLUMN <old> TO <new>;
 *
 * A table/column dropped in an early migration and later re-created under the same name
 * is NOT a violation — the identifier is live again. Migrations are replayed in order to
 * track final schema state; only drops/renames still in effect after the full sequence
 * are checked against current code.
 *
 * SQL SERVER NOTE: SQL Server renames columns via `EXEC sp_rename 'table.column', 'new',
 * 'COLUMN'` rather than `RENAME COLUMN`. The RENAME_COLUMN_RE pattern below only matches
 * Postgres/ANSI syntax. If your migrations target SQL Server, add an sp_rename pattern
 * before relying on rename detection.
 *
 * Limitation (by design — a deliberate, disclosed trade-off, not an oversight): this is a
 * textual co-occurrence heuristic, not a SQL parser. It can't tell a genuine stale query
 * from an unrelated variable that happens to share a name with both the table and the
 * column. It also can't catch a query referencing a column that was never real in the
 * first place (no DROP event to key off of) — that's a plain query defect, not a
 * migration/code drift, and needs review or integration tests to catch.
 *
 * CONFIGURE BEFORE USE — edit the two constants below for your repo's layout:
 *   MIGRATIONS_DIR — where your migration .sql files live (matches the layout in
 *     templates/db-migration-governance.md: <db-root>/scripts/migrations/)
 *   SOURCE_DIRS    — the source directories to scan for lingering references. Include
 *     every directory that queries the database, not just the "main" service — the
 *     incident this lint prevents was a second, unrelated file with a stale query.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:breaking-migrations": "node scripts/check-breaking-migrations.mjs"
 *   CI:            add as a required PR gate alongside your migration harness — see
 *                  templates/db-migration-governance.md, "CI/CD requirements"
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

// ── CONFIGURE FOR YOUR REPO ──────────────────────────────────────────────────
const MIGRATIONS_DIR = join(repoRoot, 'db', 'dbmigrations', 'scripts', 'migrations');
const SOURCE_DIRS = [join(repoRoot, 'src')];
const SOURCE_EXTENSIONS = ['.ts', '.js', '.cs', '.py'];
const TEST_SUFFIXES = ['.test.ts', '.test.js', '.spec.ts', '.d.ts'];
// ──────────────────────────────────────────────────────────────────────────

const COLUMN_TYPES =
  '(?:TIMESTAMPTZ|TIMESTAMP|INTEGER|INT|BIGINT|SMALLINT|TEXT|VARCHAR|NVARCHAR|JSONB|UUID|' +
  'UNIQUEIDENTIFIER|BOOLEAN|BIT|NUMERIC|DECIMAL|DATE|DATETIME2?|DOUBLE PRECISION|FLOAT|REAL|SERIAL|MONEY)';

const CREATE_TABLE_RE = /CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/gi;
const DROP_TABLE_RE = /DROP TABLE (?:IF EXISTS )?([a-z_]+)/gi;
const ADD_COLUMN_RE = new RegExp(
  `ALTER TABLE (?:IF EXISTS )?([a-z_]+)\\s+ADD COLUMN (?:IF NOT EXISTS )?([a-z_]+)\\s+${COLUMN_TYPES}`,
  'gi',
);
const DROP_COLUMN_RE = /ALTER TABLE (?:IF EXISTS )?([a-z_]+)\s+DROP COLUMN (?:IF EXISTS )?([a-z_]+)/gi;
const RENAME_COLUMN_RE = /ALTER TABLE (?:IF EXISTS )?([a-z_]+)\s+RENAME COLUMN ([a-z_]+)\s+TO\s+([a-z_]+)/gi;

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

// Strip `-- comment` per line but preserve line structure (so line numbers stay
// accurate), then rejoin — `\s+` in the patterns above already spans the
// resulting newlines, so multi-line ALTER TABLE clauses still match.
function stripComments(content) {
  return content
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');
}

// CREATE TABLE column bodies still need per-line parsing (the body is a list of
// column defs, not a single clause to span).
function columnsFromCreateTableBody(content, tableStart) {
  const cols = [];
  const rest = content.slice(tableStart);
  const bodyLines = rest.split('\n');
  for (const l of bodyLines) {
    if (/^\s*\);/.test(l)) break;
    const col = l.match(new RegExp(`^\\s*([a-z_]+)\\s+${COLUMN_TYPES}`, 'i'));
    if (col) cols.push(col[1].toLowerCase());
  }
  return cols;
}

// ── 1. Replay all migrations in order, tracking final schema state ──────────

const tableExists = new Map(); // table -> bool
const columnExists = new Map(); // "table.column" -> bool
const breakingChanges = []; // { kind, table, column, file, line } — every drop/rename ever seen

if (existsSync(MIGRATIONS_DIR)) {
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('TEMPLATE'))
    .sort();

  for (const file of sqlFiles) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const content = stripComments(raw);

    for (const m of content.matchAll(CREATE_TABLE_RE)) {
      const table = m[1].toLowerCase();
      tableExists.set(table, true);
      for (const col of columnsFromCreateTableBody(content, m.index)) {
        columnExists.set(`${table}.${col}`, true);
      }
    }

    for (const m of content.matchAll(ADD_COLUMN_RE)) {
      const table = m[1].toLowerCase();
      tableExists.set(table, true);
      columnExists.set(`${table}.${m[2].toLowerCase()}`, true);
    }

    for (const m of content.matchAll(DROP_TABLE_RE)) {
      const table = m[1].toLowerCase();
      tableExists.set(table, false);
      breakingChanges.push({ kind: 'drop-table', table, column: null, file, line: lineOf(content, m.index) });
    }

    for (const m of content.matchAll(DROP_COLUMN_RE)) {
      const table = m[1].toLowerCase();
      const column = m[2].toLowerCase();
      columnExists.set(`${table}.${column}`, false);
      breakingChanges.push({ kind: 'drop-column', table, column, file, line: lineOf(content, m.index) });
    }

    for (const m of content.matchAll(RENAME_COLUMN_RE)) {
      const table = m[1].toLowerCase();
      const oldCol = m[2].toLowerCase();
      const newCol = m[3].toLowerCase();
      columnExists.set(`${table}.${oldCol}`, false);
      columnExists.set(`${table}.${newCol}`, true);
      // the OLD name is what must vanish from code
      breakingChanges.push({ kind: 'rename-column', table, column: oldCol, file, line: lineOf(content, m.index) });
    }
  }
}

// Keep only breaking changes still in effect in the final schema — a table/column
// dropped and later re-created under the same name is live again, not a violation.
const liveBreakingChanges = breakingChanges.filter((c) => {
  if (c.kind === 'drop-table') return tableExists.get(c.table) !== true;
  return columnExists.get(`${c.table}.${c.column}`) !== true;
});

if (liveBreakingChanges.length === 0) {
  console.log('OK — no breaking migrations (DROP COLUMN / DROP TABLE / RENAME COLUMN) currently in effect.');
  process.exit(0);
}

// ── 2. Collect production source files (tests/fixtures don't count) ────────

function collectSourceFiles(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === 'bin' || entry === 'obj' || entry === 'test-fixtures') continue;
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext)) && !TEST_SUFFIXES.some((s) => entry.endsWith(s))) {
      acc.push(full);
    }
  }
  return acc;
}

// Only search inside quoted string spans (backtick template literals, plus C#
// verbatim `@"..."` strings) — this avoids false positives from comments, regex
// literals, unrelated API paths, and TS/C# fields that happen to share a word
// with a table or column name. If your repo embeds SQL a different way (e.g.
// Python triple-quoted strings), extend this extraction.
function extractSqlStrings(content) {
  const strings = [];
  for (const m of content.matchAll(/`([^`]*)`/gs)) strings.push(m[1]);
  for (const m of content.matchAll(/@"([^"]*)"/gs)) strings.push(m[1]);
  return strings.join('\n');
}

const sources = SOURCE_DIRS.flatMap((dir) => collectSourceFiles(dir, [])).map((f) => {
  const content = readFileSync(f, 'utf8');
  return { path: f, content: extractSqlStrings(content) };
});

// ── 3. Check each still-in-effect breaking change for lingering references ──

let failed = false;

for (const change of liveBreakingChanges) {
  const tableRe = new RegExp(`\\b${change.table}\\b`);

  if (change.kind === 'drop-table') {
    // Require SQL-ish context (FROM/JOIN/UPDATE/INTO <table>) to avoid flagging
    // identifiers that just happen to share the table's name.
    const sqlContextRe = new RegExp(`\\b(?:FROM|JOIN|UPDATE|INTO)\\s+${change.table}\\b`, 'i');
    const offenders = sources.filter((s) => sqlContextRe.test(s.content));
    if (offenders.length > 0) {
      console.error(`BREAKING MIGRATION VIOLATION: table "${change.table}" no longer exists but code still queries it`);
      console.error(`  Dropped in: ${relative(repoRoot, MIGRATIONS_DIR)}/${change.file}:${change.line}`);
      for (const o of offenders) console.error(`  Still referenced in: ${relative(repoRoot, o.path)}`);
      console.error(`  Fix: remove or update the query, or register the table as intentionally dormant.`);
      failed = true;
    }
    continue;
  }

  // drop-column / rename-column: same-file co-occurrence of table + column —
  // a weaker heuristic than the drop-table check, matching the trade-off any
  // schema-promises-style "hasConsumer" check already accepts.
  const colRe = new RegExp(`\\b${change.column}\\b`);
  const offenders = sources.filter((s) => tableRe.test(s.content) && colRe.test(s.content));
  if (offenders.length > 0) {
    const verb = change.kind === 'rename-column' ? 'renamed away from' : 'dropped';
    console.error(`BREAKING MIGRATION VIOLATION: column "${change.table}.${change.column}" was ${verb} but code still queries it`);
    console.error(`  Migration: ${relative(repoRoot, MIGRATIONS_DIR)}/${change.file}:${change.line}`);
    for (const o of offenders) console.error(`  Still referenced in: ${relative(repoRoot, o.path)}`);
    console.error(`  Fix: update the query to use the current schema before this migration can ship.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(`OK — ${liveBreakingChanges.length} breaking migration statement(s) currently in effect, no lingering code references.`);
