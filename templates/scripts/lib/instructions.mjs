#!/usr/bin/env node
// template: scripts/lib/instructions.mjs v1.0.0 · updated 2026-11-05
/**
 * lib:instructions  [governance template — copy to <project>/scripts/lib/]
 *
 * The one reader of a repo's always-loaded agent instructions (issue #130).
 * AGENTS.md is the canonical file; CLAUDE.md is the one-line `@AGENTS.md` import
 * that gives Claude Code the same text. A consumer that reads "the first file
 * that exists" therefore reads a pointer, finds no section, and reports SKIPPED —
 * a check that fails open reads as evidence.
 *
 * This follows the lib/backlog-graph.mjs precedent: one enumerator shared by
 * every consumer, installed at `lib/` beside each of them. The scripts that use
 * it are check-enforcement-stanzas, check-downstream-drift, check-claim-coverage
 * and check-instructions-budget.
 *
 * Import resolution is deliberately narrow, matching what Claude Code does:
 * a line that is exactly `@<path>` (no other tokens) outside a fenced code
 * block. The path resolves relative to the importing file. At most five hops
 * are followed; a cycle or a repeated file is read once.
 *
 * An import that cannot be read is returned in `unresolved`, never silently
 * dropped. `files` lists every file actually read, so a budget lint can print
 * per-file bytes and a caller can distinguish "no instruction files" (a skip)
 * from "instructions exist but resolve to nothing" (a finding).
 *
 *   const { text, files, unresolved } = resolveInstructions(repoRoot);
 *
 * Read-only. It never writes.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { dirname, join, relative, resolve as resolvePath } from 'path';

/** The deepest import chain followed, counted from a top-level file. */
export const MAX_IMPORT_DEPTH = 5;

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;
const IMPORT = /^@(\S+)$/;

/**
 * Resolve a repo's always-loaded instruction text.
 *
 * @param {string} root repo root (the directory holding AGENTS.md / CLAUDE.md)
 * @returns {{text: string, files: Array<{path: string, relative: string, bytes: number}>,
 *            unresolved: Array<{from: string|null, target: string, resolved: string, reason: string}>}}
 */
export function resolveInstructions(root) {
  const files = [];
  const unresolved = [];
  const seen = new Set();
  const chunks = [];

  function read(abs, depth, importedFrom) {
    let src;
    try {
      src = readFileSync(abs, 'utf8');
    } catch {
      unresolved.push({ from: importedFrom, target: abs, resolved: abs, reason: 'unreadable' });
      return;
    }
    seen.add(abs);
    files.push({ path: abs, relative: relative(root, abs), bytes: Buffer.byteLength(src, 'utf8') });

    // A fenced block closes only on the SAME character with at least the
    // opening length. A shorter ``` inside a ```` fence is content, and toggling
    // a bare boolean there would treat the rest of the file as code — the
    // budget check would then silently miss a live `@path` import below it.
    let fence = null; // { char, len }
    for (const line of src.split(/\r?\n/)) {
      const f = line.match(FENCE);
      if (fence) {
        // A closing fence has only whitespace after its run. `` ```not-a-close ``
        // is content, not a close; treating it as one inverts the rest of the
        // file and can hide a live import from the budget check.
        if (f && f[1][0] === fence.char && f[1].length >= fence.len && f[2].trim() === '') fence = null;
        chunks.push(line);
        continue;
      }
      if (f) {
        fence = { char: f[1][0], len: f[1].length };
        chunks.push(line);
        continue;
      }
      const m = line.match(IMPORT);
      if (!m) {
        chunks.push(line);
        continue;
      }
      const target = m[1];
      const targetAbs = resolvePath(dirname(abs), target);
      // A repeated file is a duplicate or a cycle: read once, terminate quietly.
      if (seen.has(targetAbs)) continue;
      if (depth >= MAX_IMPORT_DEPTH) {
        unresolved.push({ from: abs, target, resolved: targetAbs, reason: 'depth-limit' });
        chunks.push(line);
        continue;
      }
      if (!existsSync(targetAbs) || !statSync(targetAbs).isFile()) {
        unresolved.push({ from: abs, target, resolved: targetAbs, reason: 'not-found' });
        chunks.push(line);
        continue;
      }
      read(targetAbs, depth + 1, abs);
    }
  }

  // AGENTS.md first: when CLAUDE.md is the one-line import, the text is included
  // once rather than duplicated by the direct read.
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const abs = join(root, name);
    if (!existsSync(abs) || !statSync(abs).isFile() || seen.has(abs)) continue;
    read(abs, 0, null);
  }

  return { text: chunks.join('\n'), files, unresolved };
}
