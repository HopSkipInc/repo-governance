#!/usr/bin/env node
// template: scripts/check-inline-type-unions.mjs v1.0.0 · updated 2026-07-24
/**
 * lint:inline-type-unions  [governance template — copy to <project>/scripts/, TypeScript repos only]
 *
 * Detects inline string-literal union type annotations that duplicate an exported type
 * alias defined elsewhere in the codebase.
 *
 * The code smell: someone exports `type AgentType = 'assistant' | 'worker' | 'platform'`
 * in one file, then another file writes `agentType?: 'assistant' | 'worker' | 'platform'`
 * instead of importing and using `AgentType`. The inline union can drift from the alias —
 * if a new value is added to the alias but not the inline copy (or vice versa), the type
 * system silently permits the mismatch because they're structurally compatible until they
 * diverge.
 *
 * This is the sibling check to lint:magic-strings (templates/scripts/check-magic-strings.mjs)
 * — that one catches duplicated *values*, this one catches duplicated *type annotations*.
 * Both stem from the same root cause: no single source of truth being imported.
 *
 * Approach:
 *   1. Index all exported `type X = 'a' | 'b' | ...` aliases across the source tree
 *   2. Scan every source file for inline string-literal unions in type positions (after
 *      `:`, `?:`, `as`, or in generic `<>` type args)
 *   3. Flag any inline union whose value set matches an exported alias from a different
 *      file, UNLESS the file already imports that alias
 *
 * Limitation (by design, a deliberate trade-off, not an oversight): this is a regex
 * heuristic, not a TypeScript AST walk. It can't distinguish a genuine type annotation
 * from an unrelated expression that happens to match. False positives are suppressible
 * by importing the alias (which is the fix anyway). Unions of 2 or fewer literals are
 * not flagged — short unions are common in unrelated contexts (e.g. 'read' | 'write')
 * and are rarely the subject of a shared type alias.
 *
 * CONFIGURE BEFORE USE — edit SRC_DIR for your repo's layout.
 *
 * Wiring (adapt to your repo's check script and CI):
 *   package.json:  "lint:inline-type-unions": "node scripts/check-inline-type-unions.mjs"
 */

import { readdirSync, readFileSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CONFIGURE FOR YOUR REPO ──────────────────────────────────────────────────
const SRC_DIR = join(__dirname, '..', 'src');
// ──────────────────────────────────────────────────────────────────────────

// ── File collection ──────────────────────────────────────────────────────────

function collectTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ── Extract exported type aliases (string-literal unions) ────────────────────
//
// Matches: export type Foo = 'a' | 'b' | 'c'

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

// ── Extract inline string-literal union annotations ──────────────────────────
//
// We look for string-literal unions appearing in type annotation positions:
//   - After `:` or `?:`  (field/param/return type)
//   - After `as`         (type assertion)
//   - Inside generic `<...>`  (type arguments)
// Only unions of 3+ literals are flagged (see header).

const UNION_RE = /(?::\s*|\?\s*:\s*|\bas\s+|<)\s*('[^']+'(?:\s*\|\s*'[^']+')+)/g;

function extractInlineUnions(content) {
  const unions = [];
  let match;
  UNION_RE.lastIndex = 0;
  while ((match = UNION_RE.exec(content)) !== null) {
    const unionBody = match[1];
    const values = unionBody.split('|').map((s) => s.trim().replace(/^'|'$/g, ''));
    if (values.length >= 3) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      unions.push({ values, line: lineNum, raw: unionBody });
    }
  }
  return unions;
}

// ── Check if a file imports a given alias ────────────────────────────────────

function importsAlias(content, aliasName) {
  return new RegExp(`\\bimport(?:\\s+type)?\\s*\\{[^}]*\\b${aliasName}\\b[^}]*\\}`, 's').test(content);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = collectTsFiles(SRC_DIR);

// 1. Build alias index: normalized value set → [{ name, file }]
const aliasIndex = new Map();

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const aliases = extractExportedAliases(content);
  for (const alias of aliases) {
    const key = alias.values.slice().sort().join('|');
    if (!aliasIndex.has(key)) aliasIndex.set(key, []);
    aliasIndex.get(key).push({ name: alias.name, file });
  }
}

// 2. Scan for inline unions that match an alias from a different file
let failed = false;
let violationCount = 0;

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  const inlineUnions = extractInlineUnions(content);

  for (const union of inlineUnions) {
    const key = union.values.slice().sort().join('|');
    const aliases = aliasIndex.get(key);
    if (!aliases) continue;

    const externalAlias = aliases.find((a) => a.file !== file);
    if (!externalAlias) continue;

    if (importsAlias(content, externalAlias.name)) continue;

    const relFile = relative(SRC_DIR, file);
    violationCount++;
    console.error(
      `ERROR: ${relFile}:${union.line} — inline union \`${union.raw}\` duplicates exported type alias \`${externalAlias.name}\` ` +
      `from ${relative(SRC_DIR, externalAlias.file)}. Import and use the alias instead.`
    );
    failed = true;
  }
}

if (failed) {
  console.error(`\n${violationCount} violation(s) found. Import the exported type alias instead of re-declaring the union inline.`);
  process.exit(1);
}

console.log('OK — no inline string-literal unions duplicating exported type aliases found.');
process.exit(0);
