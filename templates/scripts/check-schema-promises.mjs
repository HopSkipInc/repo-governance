#!/usr/bin/env node
// template: scripts/check-schema-promises.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:schema-promises  [governance template — copy to <project migration-runner dir>/scripts/]
 *
 * Enforcement ships with the schema — the migration-time mirror of
 * `check-breaking-migrations.mjs` (templates/scripts/), which asks "does a
 * REMOVED/RENAMED element have zero remaining consumers?". This asks the
 * opposite question: "does an ADDED enforcement-bearing element (a tenancy
 * policy, a rate-limit or lifecycle column, a residency flag) have a real
 * consumer, or is it a dormant promise?"
 *
 * A migration can add an enforcement-bearing schema element that no code
 * path consumes: inert row-level-security policies, phantom rate limits,
 * dead lifecycle columns. The schema then promises a control that doesn't
 * exist — silent, because nothing red shows up: the migration applies fine,
 * the column exists, and nobody asked "does anything consume this?" See
 * `templates/definition-of-done.md`'s Migration section and Feature section
 * ("Schema that promises a control nobody built is a defect, not a head
 * start") — this script is the mechanical backstop for that rule.
 *
 * Mechanism:
 *   1. Extract "promises" from your migration files via a CURATED pattern
 *      list (extend ENFORCEMENT_COLUMNS / ENFORCEMENT_PREFIXES as new
 *      classes of enforcement-bearing schema appear in your repo):
 *        - tenancy GUCs referenced by CREATE POLICY (Postgres RLS pattern:
 *          current_setting('app.*'))
 *        - lifecycle columns: deleted_at, disabled_at, archived_at,
 *          suspended_at, revoked_at
 *        - rate-limit columns: rate_limit*
 *        - residency columns: region
 *   2. For each promise, require EITHER a production consumer in your
 *      source directories (tests and fixtures don't count) OR an entry in
 *      a dormant-schema register (a JSON file) with a tracking issue and an
 *      activates-when condition.
 *   3. Keep the register honest: entries whose element no longer exists in
 *      the schema, or whose element now HAS consumers, fail the lint until
 *      removed.
 *
 * Limitation (by design, a deliberate trade-off, not an oversight): this
 * catches "promised and never consumed." It cannot catch "consumed with the
 * wrong semantics" (e.g. a tenancy column resolving by the wrong grouping).
 * Semantic mismatches belong to your staleness audit and the DoD migration
 * checklist, not a mechanical lint.
 *
 * CONFIGURE BEFORE USE — edit the constants below for your repo's layout,
 * and ENFORCEMENT_COLUMNS / ENFORCEMENT_PREFIXES for your schema's actual
 * enforcement-bearing patterns. The defaults below are a reasonable SaaS
 * starting point, not a complete list for any specific repo.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:schema-promises": "node scripts/check-schema-promises.mjs"
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

// ── CONFIGURE FOR YOUR REPO ──────────────────────────────────────────────────
const MIGRATIONS_DIR = join(repoRoot, 'db', 'dbmigrations', 'scripts', 'migrations');
const REGISTER_PATH = join(repoRoot, 'db', 'dormant-schema.json');
const SOURCE_DIRS = [join(repoRoot, 'src')];

const ENFORCEMENT_COLUMNS = new Set([
  'deleted_at',
  'disabled_at',
  'archived_at',
  'suspended_at',
  'revoked_at',
  'region',
]);
const ENFORCEMENT_PREFIXES = ['rate_limit'];
// ──────────────────────────────────────────────────────────────────────────

const COLUMN_TYPES =
  '(?:TIMESTAMPTZ|TIMESTAMP|INTEGER|INT|BIGINT|SMALLINT|TEXT|VARCHAR|NVARCHAR|JSONB|UUID|UNIQUEIDENTIFIER|BOOLEAN|BIT|NUMERIC|DECIMAL|DATE)';

// ── 1. Extract promises from migrations ─────────────────────────────────────

function isEnforcementColumn(name) {
  return ENFORCEMENT_COLUMNS.has(name) || ENFORCEMENT_PREFIXES.some((p) => name.startsWith(p));
}

const promises = new Map(); // element → { kind, where:[file:line] }

function addPromise(element, kind, where) {
  if (!promises.has(element)) promises.set(element, { kind, where: [] });
  promises.get(element).where.push(where);
}

const migrationFiles = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !f.startsWith('TEMPLATE')).sort()
  : [];

for (const file of migrationFiles) {
  const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  const lines = content.split('\n');
  let currentTable = null;
  let inPolicy = false;

  lines.forEach((line, i) => {
    const loc = `${file}:${i + 1}`;
    const noComment = line.replace(/--.*$/, '');

    const create = noComment.match(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/i);
    if (create) currentTable = create[1].toLowerCase();
    if (/^\s*\);/.test(noComment)) currentTable = null;

    // Tenancy GUCs promised by RLS policies (Postgres pattern)
    if (/CREATE POLICY/i.test(noComment)) inPolicy = true;
    if (inPolicy) {
      for (const m of noComment.matchAll(/current_setting\(\s*'(app\.[a-z_]+)'/gi)) {
        addPromise(`guc:${m[1]}`, 'rls-tenancy-guc', loc);
      }
      if (/;\s*$/.test(noComment)) inPolicy = false;
    }

    // Enforcement-bearing columns in CREATE TABLE bodies
    if (currentTable) {
      const col = noComment.match(new RegExp(`^\\s*([a-z_]+)\\s+${COLUMN_TYPES}`, 'i'));
      if (col && isEnforcementColumn(col[1].toLowerCase())) {
        addPromise(`${currentTable}.${col[1].toLowerCase()}`, 'enforcement-column', loc);
      }
    }

    // Enforcement-bearing columns via ALTER TABLE ... ADD COLUMN
    const alter = noComment.match(
      new RegExp(`ALTER TABLE (?:IF EXISTS )?([a-z_]+)\\s+ADD COLUMN (?:IF NOT EXISTS )?([a-z_]+)\\s+${COLUMN_TYPES}`, 'i'),
    );
    if (alter && isEnforcementColumn(alter[2].toLowerCase())) {
      addPromise(`${alter[1].toLowerCase()}.${alter[2].toLowerCase()}`, 'enforcement-column', loc);
    }
  });
}

// ── 2. Find production consumers in your source directories ────────────────

function collectSourceFiles(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === 'bin' || entry === 'obj' || entry === 'test-fixtures') continue;
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.js') || entry.endsWith('.cs') || entry.endsWith('.py')) &&
      !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts')
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const sources = SOURCE_DIRS.flatMap((dir) => collectSourceFiles(dir, [])).map((f) => ({
  path: f,
  content: readFileSync(f, 'utf8'),
}));

function hasConsumer(element, kind) {
  if (kind === 'rls-tenancy-guc') {
    const guc = element.replace(/^guc:/, '');
    return sources.some((s) => s.content.includes(guc));
  }
  const [table, column] = element.split('.');
  const colRe = new RegExp(`\\b${column}\\b`);
  const tableRe = new RegExp(`\\b${table}\\b`);
  return sources.some((s) => colRe.test(s.content) && tableRe.test(s.content));
}

// ── 3. Cross-check against the dormant-schema register ──────────────────────

let register = { entries: [] };
if (existsSync(REGISTER_PATH)) {
  register = JSON.parse(readFileSync(REGISTER_PATH, 'utf8'));
}
const registered = new Map(register.entries.map((e) => [e.element, e]));

const errors = [];

for (const [element, { kind, where }] of promises) {
  const entry = registered.get(element);
  const consumed = hasConsumer(element, kind);

  if (!consumed && !entry) {
    errors.push(
      `UNCONSUMED PROMISE: ${element} (${kind}; ${where[0]}${where.length > 1 ? ` +${where.length - 1} more` : ''}) ` +
      `has no production consumer in your source directories. Ship the consuming code in this PR, ` +
      `or register it in ${REGISTER_PATH.split('/').slice(-2).join('/')} with a tracking issue and an activates-when condition.`,
    );
  }
  if (consumed && entry && (entry.check ?? 'consumer-grep') === 'consumer-grep') {
    errors.push(
      `STALE REGISTER ENTRY: ${element} is registered as dormant but now has production consumers — ` +
      `remove it from the register (and close/update ${entry.tracking}).`,
    );
  }
}

for (const entry of register.entries) {
  if (!/^#\d+$/.test(entry.tracking ?? '')) {
    errors.push(
      `REGISTER ENTRY WITHOUT TRACKING ISSUE: ${entry.element} — every dormant element needs a "#N" tracking issue (a known gap without a number never gets fixed).`,
    );
  }
  if (!entry.activates_when) {
    errors.push(`REGISTER ENTRY WITHOUT activates_when: ${entry.element} — state the condition under which this scaffolding becomes load-bearing.`);
  }
  if ((entry.check ?? 'consumer-grep') === 'consumer-grep' && !promises.has(entry.element)) {
    errors.push(
      `ORPHAN REGISTER ENTRY: ${entry.element} does not match any enforcement-bearing element in your migrations — remove it or fix the element key.`,
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

if (errors.length) {
  console.error(`check-schema-promises: ${errors.length} violation(s)\n`);
  for (const e of errors) console.error(`  ${e}\n`);
  process.exit(1);
}

console.log(
  `check-schema-promises: OK — ${promises.size} enforcement-bearing element(s); ` +
  `${[...promises.keys()].filter((el) => hasConsumer(el, promises.get(el).kind)).length} consumed, ` +
  `${register.entries.length} registered dormant.`,
);
