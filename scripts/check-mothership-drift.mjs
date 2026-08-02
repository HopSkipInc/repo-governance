#!/usr/bin/env node
/**
 * lint:mothership-drift  [repo-governance's own lint — NOT a downstream template]
 *
 * Closes issue #23. The 2026-08-02 routing sweep's preflight found
 * docs/agent-routing.md at 1.9.0 while templates/agent-routing.md shipped 1.10.0 —
 * the repo that enforces template sync in every governed repo ran no check on its
 * own installed copies. check-downstream-drift.mjs reads the downstream ledgers,
 * which do not list this repo; check-template-versions.mjs walks templates/ only.
 * The stale copy was caught by an agent's preflight — luck, not process (fixed by
 * hand in d897351).
 *
 * The lint reads a register (docs/mothership-drift-register.md) of docs/ files
 * required to be byte-identical to their template. A docs/ file absent from the
 * register is not compared. This is a register, not a suppression list (pattern:
 * check-analyze-repo-coverage.mjs): a templates/<->docs/ name collision present on
 * disk but absent from the register is REPORTED — to be registered or exempted on
 * the record — never silently skipped.
 *
 * Records are never registered. The register's exemption entries carry the reason:
 * a byte-identical lint firing on a records file invites `cp` as the remedy, which
 * destroys records with no diff to recover from.
 *
 * Two findings, both blocking:
 *
 *   STALE        a registered pair is not byte-identical (or the docs copy is gone)
 *   UNREGISTERED a name collision exists on disk with no register entry at all
 *
 * Messages name both paths and state which side is authoritative. They never
 * suggest `cp` — see the exemption reason above.
 *
 * Fails closed: a missing or malformed register is an error, never a pass — a
 * check that cannot read its register has not run.
 *
 * Wired:  node scripts/check-mothership-drift.mjs   (runs in CI — pure repo-local reads)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const DOCS = join(ROOT, 'docs');
const TEMPLATES = join(ROOT, 'templates');
const REGISTER = join(DOCS, 'mothership-drift-register.md');

function failClosed(msg) {
  console.error(`check-mothership-drift: ERROR — ${msg}`);
  console.error('Reporting an error, not a pass: a check that cannot read its register has not run.');
  process.exit(1);
}

// ---------------------------------------------------------------- the register

if (!existsSync(REGISTER)) failClosed(`register not found at docs/mothership-drift-register.md`);
const registerText = readFileSync(REGISTER, 'utf8');

/** Table rows under a `## <heading>` section, as arrays of trimmed cell strings. */
function tableRows(sectionHeading) {
  const lines = registerText.split('\n');
  const start = lines.findIndex((l) => l.startsWith(sectionHeading));
  if (start === -1) failClosed(`register has no "${sectionHeading}" section`);
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('## ')) break;
    if (!l.trim().startsWith('|')) continue;
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.every((c) => /^-+$/.test(c))) continue; // separator row
    rows.push(cells);
  }
  return rows.slice(1); // drop the header row
}

/** A registered pair: docs file required byte-identical to its template. Paths are
 *  stored relative to their root (docs/, templates/) for comparison, and the
 *  repo-relative form is rebuilt in messages. */
const pairs = tableRows('## Registered pairs').map((cells, i) => {
  if (cells.length < 3) failClosed(`registered-pairs row ${i + 1} is malformed (needs docs path, templates path, since)`);
  const strip = (s) => s.replace(/^`|`$/g, '');
  return { docs: strip(cells[0]).replace(/^docs\//, ''), templates: strip(cells[1]).replace(/^templates\//, '') };
});

/** An exemption: an exact docs/ path, or a prefix when it ends in `/`. Reason required. */
const exemptions = tableRows('## Exemptions').map((cells, i) => {
  if (cells.length < 2 || !cells[1] || /^-+$/.test(cells[1])) {
    failClosed(`exemption row ${i + 1} carries no reason — an exemption without its reason on the record is a suppression`);
  }
  return cells[0].replace(/^`|`$/g, '').replace(/^docs\//, '');
});

// ------------------------------------------------------------- the collisions

/** Every markdown file under docs/, returned relative to docs/. */
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.md')) acc.push(relative(DOCS, p));
  }
  return acc;
}

const isExempt = (rel) => exemptions.some((x) => (x.endsWith('/') ? rel.startsWith(x) : rel === x));
const collisions = walk(DOCS).filter((rel) => existsSync(join(TEMPLATES, rel)));

const findings = [];

for (const rel of collisions) {
  const pair = pairs.find((p) => p.docs === rel);
  if (pair) {
    const same = readFileSync(join(DOCS, rel)).equals(readFileSync(join(TEMPLATES, pair.templates)));
    if (!same) {
      findings.push({
        sev: 'STALE',
        msg: `docs/${pair.docs} differs from templates/${pair.templates} — the templates/ side is authoritative; re-sync the docs copy from it, or amend the register if the divergence is intentional`,
      });
    }
    continue;
  }
  if (isExempt(rel)) continue; // exempted on the record, with a reason — stays silent
  findings.push({
    sev: 'UNREGISTERED',
    msg: `${rel} exists under both docs/ and templates/ but is absent from the register — register it as a synced pair or exempt it with a reason in docs/mothership-drift-register.md`,
  });
}

// A registered pair whose docs copy has gone missing cannot be byte-identical.
for (const pair of pairs) {
  if (!existsSync(join(DOCS, pair.docs))) {
    findings.push({
      sev: 'STALE',
      msg: `docs/${pair.docs} is registered as byte-identical to templates/${pair.templates} but does not exist — the templates/ side is authoritative; restore the docs copy from it, or amend the register`,
    });
  }
}

// ----------------------------------------------------------------- the report

console.log(`check-mothership-drift: ${pairs.length} registered pair(s), ${exemptions.length} exemption(s), ${collisions.length} collision(s) on disk.`);

if (!findings.length) {
  console.log('OK: every registered docs/ copy is byte-identical to its template, and every collision is on the register.');
  process.exit(0);
}

for (const f of findings) console.log(`\n${f.sev}: ${f.msg}`);
console.error(`\n${findings.length} blocking finding(s).`);
process.exit(1);
