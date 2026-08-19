// template: scripts/census-record-sections.mjs v1.0.0 · updated 2026-08-19
/**
 * census-record-sections  [TEMPLATE — ships to governed repos]
 *
 * Report-only companion to write-record.mjs (issue #97). Writes nothing.
 *
 * Why it exists: write-record ≤1.2.0 keyed sections by exact heading text, so
 * real corpora (`## Decision 1: …`, `## Enforcement (ships with the decision,
 * per ADR-022)`) read as missing sections — 63 of 66 ai-fleet ADRs refused on
 * amend, and an earlier hand census reported "24 ADRs missing ## Decision"
 * when ZERO were (the count was an artifact of the matcher). The rule that
 * fell out: triage output about record sections must be generated WITH
 * normalization applied, or it libels the corpus. This script is that
 * normalized census, run before any backfill, so every repo produces
 * comparable buckets.
 *
 * Per corpus it reports:
 *   1. corpus size
 *   2. Bucket C — amendable under any version (every required heading bare)
 *   3. Bucket A — unblocked by write-record ≥1.3.0 alone, ZERO record edits
 *   4. Bucket B — still blocked, with the specific missing/empty canonical
 *      sections per record (grouped counts alone are not actionable)
 *   5. heading-variant inventory — every non-bare heading that normalizes to
 *      a governed section, with frequency (this is how you learn whether the
 *      repo has a house style the template was fighting)
 *   6. P0 flag — records carrying BOTH an exact protected heading and variant
 *      siblings (`## Decision` AND `## Decision 1:`): under ≤1.2.0 the
 *      protected-section guard is vacuous for the siblings — audit
 *      `git log -p` on any such record for an amend that landed while the
 *      guard was vacuous
 *   7. scaffold-marker collisions — marker literals in legitimate prose
 *   8. Status parse failures — records whose front matter does not yield a
 *      status the validator accepts (not amendable under ANY version)
 *
 * Buckets are computed against write-record ≥1.3.0 semantics — normalization,
 * the Superseded ## Enforcement exemption, and this repo's .write-record.json
 * if present. If the installed write-record is older, the script says so up
 * front: bucket A is a promise about 1.3.0, not about what is installed.
 *
 * Section parsing, normalization, and config handling are mirrored from
 * scripts/write-record.mjs v1.3.0 — if the two drift, the census lies about
 * the gate. Keep them in lockstep.
 *
 * Usage:  node scripts/census-record-sections.mjs
 * Exits 0 always — it is a report, not a gate. A repo with no recognizable
 * corpus dir is reported, not failed (the register's `## Mediated write
 * paths` rows may be wrong).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

const ROOT = repoRoot();

const CORPUS_DIRS = {
  adr: ['docs/adr', 'adr', 'adrs', 'decisions'],
  pdr: ['docs/pdr', 'pdr'],
};
const LABEL = { adr: 'ADR', pdr: 'PDR' };
const LINT_HOMES = ['scripts', 'host/scripts', 'tools'];

const PROTECTED_SECTIONS = ['Context', 'Decision'];
const REQUIRED_SECTIONS = {
  adr: ['Context', 'Decision', 'Enforcement', 'Consequences'],
  pdr: ['Context', 'Decision', 'Consequences'],
};
const SCAFFOLD_MARKERS = {
  adr: ['<Title>', '<script name', '<npm run check', 'ADR-NNN', 'YYYY-MM-DD', 'DELETE EVERYTHING BELOW'],
  pdr: [
    '<Title>',
    '<the person whose call',
    '<specific observable condition>',
    '<observable condition',
    'PDR-NNN',
    'YYYY-MM-DD',
    'DELETE EVERYTHING BELOW',
  ],
};
const FALSIFIER = /^\s*[-*]\s*\[( |x|X)\]\s*Revisit\b(.*)$/gm;

// --- mirrored from write-record.mjs v1.3.0 (keep in lockstep) --------------

function parseRecord(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const firstSection = lines.findIndex((l) => l.startsWith('## '));
  const head = (firstSection === -1 ? lines : lines.slice(0, firstSection)).join('\n');
  const sections = [];
  if (firstSection !== -1) {
    for (let i = firstSection; i < lines.length; i++) {
      if (!lines[i].startsWith('## ')) continue;
      const next = lines.findIndex((l, j) => j > i && l.startsWith('## '));
      const slice = lines.slice(i, next === -1 ? lines.length : next).join('\n').replace(/\s+$/, '');
      sections.push({ name: lines[i].slice(3).trim(), slice });
    }
  }
  return { head, sections };
}

function canonicalOf(rawName, canonicals) {
  for (const c of canonicals) {
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${esc}s?\\b\\s*($|[:—–(-]|\\d)`, 'i').test(rawName)) return c;
  }
  return null;
}

function sectionMatches(sections, name, canonicals) {
  return sections.filter((s) => canonicalOf(s.name, canonicals) === name);
}

function bodyOfSlice(slice) {
  return slice.split('\n').slice(1).join('\n').trim();
}

function statusOf(head) {
  return (head.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1] ?? '').trim();
}

function effectiveRequired(status, rules) {
  if (/^Superseded\b/i.test(status)) return rules.required.filter((r) => r !== 'Enforcement');
  return rules.required;
}

function softRules(kind, config) {
  const over = config?.[kind] ?? {};
  const required = Array.isArray(over.required) && over.required.every((r) => typeof r === 'string' && r.trim()) ? over.required : REQUIRED_SECTIONS[kind];
  const protectedS = Array.isArray(over.protected) && over.protected.every((r) => typeof r === 'string' && r.trim()) ? over.protected : PROTECTED_SECTIONS;
  const canonicals = [...new Set([...required, ...protectedS, ...(kind === 'pdr' ? ['What would reopen this'] : [])])];
  return { required, protected: protectedS, canonicals };
}

// ---------------------------------------------------------------------------

function loadConfigSoft() {
  const p = join(ROOT, '.write-record.json');
  if (!existsSync(p)) return { config: {}, warning: null };
  try {
    return { config: JSON.parse(readFileSync(p, 'utf8')), warning: null };
  } catch (e) {
    return { config: {}, warning: `.write-record.json is not valid JSON (${e.message}) — censused against DEFAULT section rules; write-record would refuse closed on this` };
  }
}

function installedWriteRecord() {
  for (const d of LINT_HOMES) {
    const p = join(ROOT, d, 'write-record.mjs');
    if (existsSync(p)) {
      const stamp = readFileSync(p, 'utf8').match(/^\/\/ template: scripts\/write-record\.mjs v(\d+)\.(\d+)\.(\d+)/m);
      return { path: `${d}/write-record.mjs`, version: stamp ? stamp.slice(1).map(Number) : null };
    }
  }
  return null;
}

function censusKind(kind, dir, config) {
  const rules = softRules(kind, config);
  const corpusDir = join(ROOT, dir);
  const files = readdirSync(corpusDir)
    .filter((f) => /^\d{3,4}-.+\.md$/.test(f))
    .sort();
  const label = LABEL[kind];
  const statusRe = new RegExp(`^(Proposed|Accepted|Rejected|Retired|Superseded by ${label}-\\d{3,4})\\b`);

  const bucketC = [];
  const bucketA = [];
  const bucketB = []; // { file, problems: [...] }
  const variants = new Map(); // raw heading -> count
  const p0 = []; // { file, name, exact, total }
  const scaffold = []; // { file, marker, lines }
  const statusBad = []; // { file, status }

  for (const f of files) {
    const text = readFileSync(join(corpusDir, f), 'utf8');
    const { head, sections } = parseRecord(text);
    const status = statusOf(head);

    const statusOk = status && statusRe.test(status);
    if (!statusOk) statusBad.push({ file: f, status: status || '(none)' });

    let allBare = true;
    const problems = [];
    for (const name of effectiveRequired(status, rules)) {
      const matches = sectionMatches(sections, name, rules.canonicals);
      if (matches.length === 0) {
        problems.push(`missing ${name}`);
        allBare = false;
        continue;
      }
      if (matches.every((m) => bodyOfSlice(m.slice) === '')) problems.push(`empty ${name}`);
      if (!matches.some((m) => m.name === name && bodyOfSlice(m.slice) !== '')) allBare = false;
    }
    // C and A promise amendability — a record whose Status does not parse is
    // refused by validate() whatever its sections look like, so it is listed
    // in item 8 and kept out of both.
    if (problems.length === 0 && allBare && statusOk) bucketC.push(f);
    else if (problems.length === 0 && statusOk) bucketA.push(f);
    else if (problems.length > 0) bucketB.push({ file: f, problems });

    for (const s of sections) {
      const c = canonicalOf(s.name, rules.canonicals);
      if (c && s.name !== c) variants.set(s.name, (variants.get(s.name) ?? 0) + 1);
    }

    for (const name of rules.protected) {
      const matches = sectionMatches(sections, name, rules.canonicals);
      const exact = matches.filter((m) => m.name === name).length;
      if (exact >= 1 && matches.length >= 2) p0.push({ file: f, name, exact, total: matches.length });
    }

    for (const marker of SCAFFOLD_MARKERS[kind]) {
      const hits = text
        .split('\n')
        .map((l, i) => ({ l, n: i + 1 }))
        .filter(({ l }) => l.includes(marker))
        // YYYY-MM-DD is scaffold only as the Date placeholder / falsifier date
        // (write-record 1.3.0); elsewhere it is prose and IS the collision.
        .filter(({ l }) => marker !== 'YYYY-MM-DD' || (!/^\*\*(Date|Last confirmed):\*\*/.test(l.trim()) && !new RegExp(FALSIFIER.source).test(l)));
      if (hits.length) scaffold.push({ file: f, marker, lines: hits.map((h) => h.n) });
    }
  }

  console.log(`\n== ${kind} corpus: ${dir}/ — ${files.length} record(s) ==`);
  console.log(`Bucket C — amendable under any version (all required headings bare): ${bucketC.length}`);
  if (bucketC.length) console.log(`  ${bucketC.map((f) => f.match(/^\d+/)[0]).join(', ')}`);
  console.log(`Bucket A — unblocked by write-record ≥1.3.0 alone (zero record edits): ${bucketA.length}`);
  if (bucketA.length) console.log(`  ${bucketA.map((f) => f.match(/^\d+/)[0]).join(', ')}`);
  console.log(`Bucket B — still blocked (content genuinely absent): ${bucketB.length}`);
  for (const b of bucketB) console.log(`  ${b.file.match(/^\d+/)[0]}: ${b.problems.join('; ')}`);
  console.log(`Heading variants (normalize to a governed section, not bare): ${variants.size}`);
  for (const [raw, count] of [...variants.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${count}×  ## ${raw}`);
  console.log(`P0 — exact protected heading + variant siblings (guard vacuous for siblings under ≤1.2.0): ${p0.length}`);
  for (const p of p0) console.log(`  ${p.file}: ## ${p.name} — ${p.exact} exact of ${p.total} matching — audit git log -p for amends that landed while the guard was vacuous`);
  console.log(`Scaffold-marker collisions in prose: ${scaffold.length}`);
  for (const s of scaffold) console.log(`  ${s.file}: "${s.marker}" on line(s) ${s.lines.join(', ')}`);
  console.log(`Status parse failures (not amendable under ANY version): ${statusBad.length}`);
  for (const s of statusBad) console.log(`  ${s.file}: Status reads "${s.status.slice(0, 80)}${s.status.length > 80 ? '…' : ''}"`);
}

// --------------------------------------------------------------------- main

console.log(`census-record-sections: ${ROOT}`);

const installed = installedWriteRecord();
if (!installed) {
  console.log('write-record: NOT INSTALLED — buckets describe what ≥1.3.0 would accept; nothing here is amendable by script today');
} else if (!installed.version) {
  console.log(`write-record: installed at ${installed.path} but its version stamp does not parse — buckets assume ≥1.3.0 semantics; confirm by hand`);
} else {
  const [maj, min] = installed.version;
  console.log(`write-record: v${installed.version.join('.')} installed (${installed.path})`);
  if (maj < 1 || (maj === 1 && min < 3)) {
    console.log(`WARNING — installed write-record is <1.3.0: buckets are post-normalization. Bucket A records are NOT amendable until 1.3.0 is installed, and ≤1.2.0's missingOk makes the protected-section guard vacuous for variant-heading records — see the P0 count before syncing anything`);
  }
}

const { config, warning } = loadConfigSoft();
if (warning) console.log(`WARNING — ${warning}`);

let found = false;
for (const kind of ['adr', 'pdr']) {
  const dir = CORPUS_DIRS[kind].find((d) => existsSync(join(ROOT, d)));
  if (!dir) {
    console.log(`\n== ${kind} corpus: none found (looked: ${CORPUS_DIRS[kind].join(', ')}) ==`);
    continue;
  }
  found = true;
  censusKind(kind, dir, config);
}
if (!found) {
  console.log('\nno recognizable corpus in this repo — if a corpus exists elsewhere, the register’s `## Mediated write paths` rows may be wrong');
}
