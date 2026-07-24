#!/usr/bin/env node
// template: scripts/check-magic-strings.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:magic-strings  [governance template — copy to <project>/scripts/, TypeScript repos only]
 *
 * Detects magic string literals that are values from an exported string-literal union
 * type alias, used without importing the alias (or a constant from the same module).
 *
 * The code smell: someone exports `type WidgetKind = 'small' | 'medium' | 'large'` plus
 * constants like `WIDGET_SMALL = 'small'`, then another file writes `kind: 'small'`
 * instead of importing `WIDGET_SMALL`. The magic string can silently drift from the
 * alias — if a value is renamed in the type, the string literal doesn't update, and
 * TypeScript doesn't catch it because the string is structurally compatible until the
 * union narrows.
 *
 * Approach:
 *   1. Index all exported `type X = 'a' | 'b' | 'c'` aliases with 3+ values (shorter
 *      unions are too common in unrelated contexts)
 *   2. For each alias, also check if the exporting module exports constants for any of
 *      its values (e.g. `WIDGET_SMALL = 'small'`) — this is the signal the author
 *      intended constants to be used instead of magic strings
 *   3. Scan every non-test source file for string literals matching alias values
 *   4. Flag any file using 2+ values from the same alias without importing the alias
 *      (or a constant from the same module)
 *
 * The 2+ threshold avoids false positives — a single `'small'` could be a description,
 * a label, or any unrelated string. Two or more values from the same 3+-value alias in
 * the same file is a strong signal the file is working with that type and should
 * import it.
 *
 * Limitation (by design, a deliberate trade-off, not an oversight): this is a regex
 * heuristic, not a TypeScript AST walk. It can't distinguish a genuine type-typed
 * property assignment from an unrelated string that happens to match. The 2+ threshold
 * mitigates this. False positives are suppressible by importing the type alias (which
 * is the fix anyway) or by adding a `file:aliasName` entry to the ALLOWLIST below.
 *
 * CONFIGURE BEFORE USE — edit SRC_DIR for your repo's layout.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:magic-strings": "node scripts/check-magic-strings.mjs"
 */

import { readdirSync, readFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CONFIGURE FOR YOUR REPO ──────────────────────────────────────────────────
const SRC_DIR = join(__dirname, '..', 'src');
// ──────────────────────────────────────────────────────────────────────────

// ── Allowlist for false positives ────────────────────────────────────────────
//
// String values that appear in an exported type alias but are also used as unrelated
// column values or labels in other contexts. Each entry is "file:aliasName" — the
// file is allowed to use the alias's values as magic strings because they refer to a
// different concept than the alias.
const ALLOWLIST = new Set([
  // 'relative/path/to/file.ts:SomeAliasName',
]);

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

// ── Extract exported type aliases (string-literal unions, 3+ values) ─────────

const EXPORT_TYPE_UNION_RE = /export\s+type\s+(\w+)\s*=\s*('([^']+)'(?:\s*\|\s*'([^']+)')+)\s*;/g;

function extractExportedAliases(content) {
  const aliases = [];
  let match;
  EXPORT_TYPE_UNION_RE.lastIndex = 0;
  while ((match = EXPORT_TYPE_UNION_RE.exec(content)) !== null) {
    const name = match[1];
    const unionBody = match[2];
    const values = unionBody.split('|').map((s) => s.trim().replace(/^'|'$/g, ''));
    if (values.length >= 3) {
      aliases.push({ name, values });
    }
  }
  return aliases;
}

// ── Extract exported constants from the same module ──────────────────────────

const EXPORT_CONST_RE = /export\s+const\s+(\w+)\s*:\s*\w+\s*=\s*'([^']+)'/g;

function extractExportedConstants(content) {
  const constValues = new Set();
  let match;
  EXPORT_CONST_RE.lastIndex = 0;
  while ((match = EXPORT_CONST_RE.exec(content)) !== null) {
    constValues.add(match[2]);
  }
  return constValues;
}

// ── Check if a file imports from a given module ──────────────────────────────

function importsFromModule(content, modulePath) {
  const moduleName = modulePath.replace(/\.ts$/, '.js');
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+['"]([^'"]*?)${escaped}['"]`).test(content)
    || new RegExp(`import\\s+['"]([^'"]*?)${escaped}['"]`).test(content);
}

// ── Count string literal usages matching alias values ────────────────────────
//
// We look for string literals in property-assignment, argument, or return position:
//   identifier: 'value'    (property assignment)
//   return 'value'          (return statement)
//   ('value',               (function argument)

function countAliasValueUsages(content, aliasValues) {
  const valueSet = new Set(aliasValues);
  const usedValues = new Set();
  const STRING_LITERAL_RE = /(?::\s*|\(\s*|return\s+|=\s*)'([^']+)'/g;
  let match;
  while ((match = STRING_LITERAL_RE.exec(content)) !== null) {
    if (valueSet.has(match[1])) {
      usedValues.add(match[1]);
    }
  }
  return usedValues;
}

function isAllowlisted(relFile, aliasName) {
  return ALLOWLIST.has(`${relFile}:${aliasName}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = collectTsFiles(SRC_DIR);

// 1. Build alias index: alias name → { values, sourceFile, sourceRelPath }
const aliasIndex = new Map();

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const aliases = extractExportedAliases(content);
  if (aliases.length === 0) continue;

  const constValues = extractExportedConstants(content);
  const relPath = relative(SRC_DIR, file);

  for (const alias of aliases) {
    const hasConstants = alias.values.some((v) => constValues.has(v));
    if (!hasConstants) continue;

    aliasIndex.set(alias.name, {
      values: alias.values,
      sourceFile: file,
      sourceRelPath: relPath,
    });
  }
}

// 2. Scan for magic string usage
let failed = false;
let violationCount = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const relFile = relative(SRC_DIR, file);

  for (const [aliasName, aliasInfo] of aliasIndex) {
    if (file === aliasInfo.sourceFile) continue;
    if (importsFromModule(content, aliasInfo.sourceRelPath)) continue;
    if (isAllowlisted(relFile, aliasName)) continue;

    const used = countAliasValueUsages(content, aliasInfo.values);
    if (used.size < 2) continue;

    violationCount++;
    console.error(
      `ERROR: ${relFile} uses ${used.size} magic string value(s) [${[...used].join(', ')}] from exported alias ` +
      `\`${aliasName}\` (${aliasInfo.sourceRelPath}) without importing it. Import and use the alias's constants instead.`
    );
    failed = true;
  }
}

if (failed) {
  console.error(`\n${violationCount} violation(s) found. Import the exported alias/constants instead of re-typing the values.`);
  process.exit(1);
}

console.log('OK — no magic strings duplicating exported type aliases found.');
process.exit(0);
