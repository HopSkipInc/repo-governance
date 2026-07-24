#!/usr/bin/env node
// template: scripts/check-duplicated-sql.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:duplicated-sql  [governance template — copy to <project>/scripts/, TypeScript repos
 * with inline SQL only]
 *
 * Detects SQL queries that are duplicated across multiple source files.
 *
 * The code smell: the same query (e.g. a join between two core tables) is inlined in
 * several files instead of being centralized in a single registry/adapter class.
 * Duplicated SQL drifts independently — one copy gets a new column, the others don't.
 *
 * Approach:
 *   1. Scan every non-test source file for template-literal strings that look like SQL
 *      (contain SELECT/INSERT/UPDATE/DELETE + FROM/INTO/SET/JOIN)
 *   2. Normalize: strip -- comments, collapse whitespace, replace ${...} interpolations
 *      with ? so dynamic queries with the same structure match
 *   3. Group by normalized SQL text
 *   4. Flag any group spanning 2+ different files
 *
 * Template interpolations like `${COLS}` are replaced with ? so queries that differ
 * only in which columns are interpolated are still compared on their structure. A query
 * using `${COLS} FROM tools` in one file and `${OTHER_COLS} FROM tools` in another will
 * match — which is correct, since they're likely the same query with drifted column
 * lists.
 *
 * Limitation (by design, a deliberate trade-off, not an oversight): this is a regex
 * heuristic, not a SQL parser. It catches near-exact duplicates (same SQL, minor
 * whitespace differences) but won't catch semantic equivalents with different column
 * orders or restructured JOINs. That's fine — the goal is to catch copy-paste drift, not
 * to prove semantic equivalence. It only scans backtick template literals, so a repo
 * that builds SQL a different way (string concatenation, an ORM) needs a different
 * detector or none at all.
 *
 * PRE-EXISTING DUPLICATES: adopting this lint on a live codebase will likely surface
 * duplicates that predate it. Don't block the PR that adds the lint on fixing all of
 * them — seed PRE_EXISTING_DUPLICATES below with each one's normalized snippet (first
 * 80 chars) and consolidate them opportunistically. New duplicates NOT in the allowlist
 * are blocked from day one.
 *
 * CONFIGURE BEFORE USE — edit SRC_DIR for your repo's layout.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:duplicated-sql": "node scripts/check-duplicated-sql.mjs"
 */

import { readdirSync, readFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CONFIGURE FOR YOUR REPO ──────────────────────────────────────────────────
const SRC_DIR = join(__dirname, '..', 'src');
// ──────────────────────────────────────────────────────────────────────────

// ── File collection ──────────────────────────────────────────────────────────

function collectTsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsFiles(full, acc);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

// ── SQL extraction ───────────────────────────────────────────────────────────
//
// Template literals containing SQL keywords. We match backtick strings that contain
// at least one SQL verb (SELECT, INSERT, UPDATE, DELETE) AND one SQL clause keyword
// (FROM, INTO, SET, VALUES, JOIN) to avoid matching arbitrary template literals that
// happen to contain the word "select".

const SQL_VERBS = /\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i;
const SQL_CLAUSES = /\b(FROM|INTO|SET|VALUES|JOIN)\b/i;

function extractSqlStrings(content) {
  const queries = [];
  const BACKTICK_RE = /`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let match;
  while ((match = BACKTICK_RE.exec(content)) !== null) {
    const raw = match[1];
    if (!SQL_VERBS.test(raw) || !SQL_CLAUSES.test(raw)) continue;

    const lineNum = content.slice(0, match.index).split('\n').length;
    const normalized = normalizeSql(raw);

    // Skip trivially short queries (health checks like `SELECT 1`)
    if (normalized.length < 40) continue;

    queries.push({ normalized, raw, line: lineNum });
  }
  return queries;
}

function normalizeSql(raw) {
  return raw
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\$\{[^}]+\}/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Allowlist for pre-existing duplicates ────────────────────────────────────
//
// Duplicated SQL that predates this linter. Each entry is a normalized SQL snippet
// (first 80 chars, lowercased) allowed to remain duplicated until consolidated. New
// duplicates NOT in this list are blocked.
//
// To remove an entry: consolidate the query into a single registry/adapter, delete the
// inline copies, then remove the snippet from this set.

const PRE_EXISTING_DUPLICATES = new Set([
  // 'select example_query_prefix_here from ...',
]);

function isAllowlisted(normalizedSql) {
  const snippet = normalizedSql.slice(0, 80);
  return PRE_EXISTING_DUPLICATES.has(snippet);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = collectTsFiles(SRC_DIR);

const groups = new Map(); // normalized SQL → [{ file, line }]

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const queries = extractSqlStrings(content);
  for (const q of queries) {
    if (!groups.has(q.normalized)) groups.set(q.normalized, []);
    groups.get(q.normalized).push({ file, line: q.line });
  }
}

let failed = false;
let violationCount = 0;
let allowlistedCount = 0;

for (const [sql, occurrences] of groups) {
  const uniqueFiles = new Set(occurrences.map((o) => o.file));
  if (uniqueFiles.size < 2) continue;

  if (isAllowlisted(sql)) {
    allowlistedCount++;
    continue;
  }

  violationCount++;
  console.error(`ERROR: SQL query duplicated across ${uniqueFiles.size} files:`);
  for (const occ of occurrences) {
    console.error(`  ${relative(SRC_DIR, occ.file)}:${occ.line}`);
  }
  const snippet = sql.length > 120 ? sql.slice(0, 120) + '...' : sql;
  console.error(`  SQL: ${snippet}`);
  console.error('');
  failed = true;
}

if (failed) {
  console.error(`${violationCount} new duplicated SQL query group(s) found. Centralize each in a single registry/adapter class.`);
  console.error(`(${allowlistedCount} pre-existing duplicate group(s) in allowlist — consolidate when convenient.)`);
  process.exit(1);
}

console.log(`OK — no new duplicated SQL queries across source files. (${allowlistedCount} pre-existing group(s) in allowlist.)`);
process.exit(0);
