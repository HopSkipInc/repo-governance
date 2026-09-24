#!/usr/bin/env node
// template: scripts/check-classifier-pin-drift.mjs v1.0.0 · updated 2026-09-24
/**
 * lint:classifier-pin-drift  [governance template — copy to <project>/scripts/]
 *
 * The routing-classifier pins its model so the harness resolves it at spawn and
 * the classifier never votes on its own model — the pin is what makes triage
 * un-self-certifiable. The pin has to name something a harness understands: a
 * concrete slug today, or a capability class once a gateway resolves classes.
 *
 * When it names a concrete slug, that slug is a *resolved binding* — it must
 * agree with the repo's class→model map. Nothing checked that agreement:
 * §3 of `docs/agent-routing-records.md` recorded "every pin resolves to a
 * frontier model" as a step a human re-sync performed, and a human step is the
 * check that stops happening. The failure this catches is a pin that keeps
 * working, keeps reading as green, and quietly names a model the class table no
 * longer lists for the triage class — a check that cannot fail.
 *
 * WHAT IT CHECKS
 *   The pin declares its triage class (`# routing-class: <class>`, a YAML
 *   comment in the agent frontmatter) and a `model:` slug. This lint resolves
 *   the slug to a model through the records' harness-route table (§2) and
 *   asserts that model is listed under the declared class in the class table
 *   (§1). The two are adjacent artifacts — a claim in a file (the pin) against a
 *   claim in data (the map) — so neither is checked against itself.
 *
 * FAIL-CLOSED
 *   A missing `# routing-class:` marker, a class absent from §1, a slug absent
 *   from §2, or a resolved model not listed under the declared class are all
 *   findings. A repo with no classifier pin prints SKIPPED, never OK: a check
 *   that did not run is not a pass.
 *
 * ARGS
 *   --pin <path>       default `.claude/agents/routing-classifier.md`
 *   --records <path>   default `docs/agent-routing-records.md`
 *
 * Wiring:  node scripts/check-classifier-pin-drift.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
};
const PIN = arg('--pin', '.claude/agents/routing-classifier.md');
const RECORDS = arg('--records', 'docs/agent-routing-records.md');

const findings = [];
const fail = (msg) => findings.push(msg);

// --------------------------------------------------------------- the pin

const pinPath = join(ROOT, PIN);
if (!existsSync(pinPath)) {
  console.log(`SKIPPED: no classifier pin at ${PIN} — nothing to check.`);
  console.log('A check that did not run is not a pass; this repo does not ship the classifier.');
  process.exit(0);
}
const pin = readFileSync(pinPath, 'utf8');

const classMatch = pin.match(/^#[ \t]*routing-class:[ \t]*(\S+)/m);
const modelMatch = pin.match(/^model:[ \t]*(\S+)/m);

if (!classMatch) {
  fail(
    `${PIN} declares no \`# routing-class:\` marker — without it the pin's model cannot be ` +
      `checked against the class map. Add \`# routing-class: <class>\` to the frontmatter.`,
  );
}
if (!modelMatch) {
  fail(`${PIN} has no \`model:\` line — it is not a pin.`);
}

// --------------------------------------------------------------- the map

const recordsPath = join(ROOT, RECORDS);
if (!existsSync(recordsPath)) {
  console.error(`check-classifier-pin-drift: ERROR — records map not found at ${RECORDS}.`);
  console.error('Reporting an error, not a pass: a check that cannot read its map has not run.');
  process.exit(1);
}
const records = readFileSync(recordsPath, 'utf8');

/** Lines under `## <n>.` up to the next `## ` heading, or null. */
function section(text, n) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${n}[.\\s]`).test(l));
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

/** Markdown table rows as arrays of trimmed cells (header and separator dropped). */
function parseTable(lines) {
  const rows = [];
  let header = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('|')) {
      if (rows.length) break;
      continue;
    }
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.replace(/`/g, '').trim());
    if (!header) {
      header = true;
      continue;
    }
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue;
    rows.push(cells);
  }
  return rows;
}

const sec1 = section(records, 1);
const sec2 = section(records, 2);
if (!sec1 || !sec2) {
  console.error(
    `check-classifier-pin-drift: ERROR — ${RECORDS} has no §1 (class table) and/or §2 ` +
      `(harness-route table). Reporting an error, not a pass.`,
  );
  process.exit(1);
}
const classRows = parseTable(sec1);
const routeRows = parseTable(sec2);

// --------------------------------------------------------------- resolution

// Only resolve when the pin actually named a class and a model, or the missing
// piece is already a finding and a second one for the same cause is noise.
if (classMatch && modelMatch) {
  const cls = classMatch[1].trim();
  const slug = modelMatch[1].trim();

  const classRow = classRows.find((r) => r[0] === cls);
  if (!classRow) {
    fail(`pin declares class "${cls}", which ${RECORDS} §1 does not list.`);
  } else {
    const models = classRow[1].split(',').map((s) => s.trim()).filter(Boolean);
    const route = routeRows.find((r) => r.slice(1).includes(slug));
    if (!route) {
      fail(`pin slug "${slug}" appears in no §2 harness-route row — it cannot be resolved to a model.`);
    } else {
      const resolved = route[0];
      if (!models.includes(resolved)) {
        fail(
          `DRIFT — pin slug "${slug}" resolves to "${resolved}", which §1 does not list under ` +
            `class "${cls}" (listed: ${models.length ? models.join(', ') : 'none'}). The pin has ` +
            `drifted from the class map.`,
        );
      } else {
        console.log(`OK: pin → "${slug}" → "${resolved}", listed under class "${cls}".`);
      }
    }
  }
}

// --------------------------------------------------------------- report

if (findings.length) {
  console.error(`\nFAILED: ${findings.length} finding(s) in ${PIN}:\n`);
  for (const f of findings) console.error(`  - ${f}`);
  console.error(
    '\nA classifier pin that names a model the class map does not is a pin nobody gated —\n' +
      'fix the pin (or the map) before merging. The check fails closed by design.',
  );
  process.exit(1);
}

if (!classMatch || !modelMatch) process.exit(1); // one of the fail() calls above; keep exit honest
console.log(`OK: ${PIN} declares a class, and its model resolves to that class.`);
