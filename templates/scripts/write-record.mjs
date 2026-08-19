// template: scripts/write-record.mjs v1.3.0 · updated 2026-08-19
/**
 * write-record  [TEMPLATE — ships to governed repos]
 *
 * Closes issue #81. The harness-enforcement stanza denies raw Edit/Write on the
 * repo's records paths — it gates paths, not intent, so it cannot tell "agent
 * creates ADR-063" from "agent cp's a blank form over ADR-022". Without a
 * mediated path, every records write is human hands (deny), a human keystroke
 * per write (ask), or impossible (headless — ask auto-rejects, and a fleet
 * worker has nobody to ask). "Human writes the ADR" had become part of the
 * normal process. This script is the mediated write path: the sanctioned,
 * validating, append-only way for an agent to publish a decision record while
 * the stanza keeps denying the raw file tools.
 *
 * It runs via Bash — a subprocess, which the stanza documentedly does not bind.
 * That is design, not circumvention: the deny rules close the accident vector
 * (one-shot Edit/Write/cp onto an existing record, the two observed incidents),
 * and this script is the gate the permission layer cannot express — append-only
 * creation, section-level amendment guards, README registration, and a
 * post-write run of the corpus's own lints. Any OTHER scripted write to records
 * paths remains exactly the violation it was before.
 *
 * The human checkpoint moves to the PR merge — where it already sits for every
 * other artifact, and the only checkpoint that exists for fleet workers.
 *
 * Usage:
 *   node scripts/write-record.mjs create <adr|pdr> <draft-file>
 *   node scripts/write-record.mjs amend  <adr|pdr> <NNN> <revised-file>
 *   node scripts/write-record.mjs amend  <adr|pdr> readme <revised-file>
 *   node scripts/write-record.mjs check  <adr|pdr> <draft-file>
 *
 * create  — allocate the next free number (max over files AND README links, +1;
 *           gaps are never reclaimed — a skipped number is cheaper than a
 *           reused one), validate per kind, write append-only (wx; there is no
 *           overwrite code path), register the README inventory row, run the
 *           corpus lints.
 * amend   — full-file replace under a section guard: ## Context and ## Decision
 *           must survive byte-identical ("never edit a Decision in place" is
 *           the templates' own rule; here it is mechanical), the H1 number
 *           cannot change, and the result must pass the same validation as a
 *           create. The README row's derived cells (Status both kinds, Last
 *           confirmed for PDR) are synced automatically — those cells restate
 *           the record, so the record is their source. The curated cells
 *           (Title, Enforcement summary) are NOT auto-touched: use
 *           `amend readme`, which guards the index itself.
 *
 *           PRE-CONFIRMATION REVISION MODE (1.1.0, issue #88). The section
 *           guard cannot distinguish revising an unsigned draft from
 *           rewriting history — it fired identically on both, and the only
 *           scripted path left for fixing an unsigned draft was supersession:
 *           a manufactured chain for a position nobody ever held (observed
 *           live 2026-08-17, PDR-010's pre-signature fix routed around the
 *           script). The guard therefore lifts for a record that is
 *           pre-confirmation ON DISK and stays pre-confirmation in the
 *           revised file:
 *             PDR: Status Proposed AND `Confirmed by:` unfilled
 *                  (`—`, empty, or a <placeholder>)
 *             ADR: Status Proposed (ADRs carry no Confirmed-by; Proposed is
 *                  the pre-confirmation state)
 *           The flip to confirmed/Accepted locks Context and Decision
 *           permanently — so the flip amend itself must carry those sections
 *           byte-identical (no smuggling a Decision edit into the acceptance
 *           amend). A Proposed PDR WITH a confirmer named is a contradictory
 *           state: the signature IS the confirmation, and the record is
 *           treated as locked.
 *
 *           CORPUS DIALECTS (1.2.0, issue #91). The script derives the corpus's
 *           numbering dialect from what is on disk instead of assuming the
 *           template's own form: pad WIDTH is the widest number in use
 *           (filenames and README link targets), minimum 3 — a corpus already
 *           at 4 digits (MADR corpora, e.g. enrichment-pipeline's `adr/0021`)
 *           gets a 4-digit mint, not a 3-digit file beside a 4-digit table;
 *           and the H1 is minted bracketed (`# [ADR-0011] Title`) when the
 *           corpus's records read that way. amend accepts all three observed
 *           H1 variants on read — `# ADR-011: T`, `# [ADR-0011] T`, and
 *           `# ADR 0007: T` (space; one live record uses it — run the read
 *           against the real corpus before trusting a regex to it).
 *           1.1.0 assumed `# ADR-NNN:` and padStart(3), which left a
 *           MADR corpus deny-mode for agents AND unreadable by the sanctioned
 *           path — every amend failed closed on the bracket.
 *
 *           The same dialect logic applies to SECTIONS: a MADR corpus has no
 *           ## Enforcement anywhere (it is a house rule, not MADR's), and
 *           re-validating the whole file on amend refused every Consequences-
 *           only edit. So required-section absence is an error at CREATE
 *           (new records meet the house standard, whatever the corpus's
 *           history) and at amend only when the amend itself creates the
 *           absence (the record had the section; the revised file drops it).
 *           A pre-existing absence is warned on, loudly — the guard is
 *           anti-degradation, not a backfill mandate.
 *
 *           SECTION MATCHING (1.3.0, issue #97). Section identity is
 *           normalized, not exact: a heading resolves to a canonical name
 *           when, case-insensitively, it begins with the name (optional
 *           plural) and the next thing is a boundary — end-of-line, a
 *           colon/dash/paren, or a digit. `## Decision 1: <summary>`,
 *           `## Decisions`, and `## Enforcement (ships with the decision,
 *           per ADR-022)` all resolve; `## Contextual notes` and
 *           `## Decision Log` deliberately do not. Exact-equality matching
 *           (≤1.2.0) made every variant invisible to BOTH the
 *           required-section check and the protected-section guard — and
 *           the guard compared null === null and passed on nothing, so
 *           1.2.0's warn-only missingOk turned a false-refusal into a
 *           silent-acceptance for variant-heading records (24 live in
 *           ai-fleet, found 2026-08-19 while amending ADR-031). The guard
 *           now compares EVERY section normalizing to a protected name in
 *           document order (deleting one of three `## Decision N:` sections
 *           or renumbering 2→3 is a refusal) and refuses by name when the
 *           record on disk has no protected section at all — a missing
 *           protected section is never a pass. Also in 1.3.0: Superseded
 *           records are exempt from ## Enforcement (#97 Q2 — backfilling
 *           enforcement into a dead decision is waste); `YYYY-MM-DD` is
 *           checked as the `**Date:**` placeholder and the PDR falsifier
 *           date, not a whole-body substring (cron specs carry it
 *           legitimately — ai-fleet ADR-009); `.write-record.json` declares
 *           per-corpus required/protected sections and a grandfather
 *           cutoff (#97 Q3); and `check` dry-runs a draft, printing the
 *           resolved section map (#97 Q4).
 * check   — validate a draft against create-strict rules and print the
 *           resolved section map (every `## ` heading → its canonical
 *           section or "(not a governed section)"), writing nothing. The
 *           five-minute diagnosis tool: every §97 finding required reading
 *           the script or provoking refusals against a live corpus.
 * readme  — full-file replace of the corpus README under a structural guard:
 *           prose outside the inventory table byte-identical, header row
 *           identical, no row deletions (the never-pruned rule, also
 *           mechanical), every row's link target on disk, every record on disk
 *           in the table.
 *
 * The draft file is composed wherever the agent likes (/tmp is fine) and is
 * never modified — the script is the publish step, not the editor.
 *
 * Post-write it runs the corpus's own lints from the repo's lint home
 * (scripts/, host/scripts/, tools/): check-adr-readme-sync always,
 * check-pdr-falsifiers for PDRs, check-design-lens for ADRs — whatever exists.
 * A red lint after a write is a nonzero exit with the working tree left
 * standing, so the failure is loud where it happened. A MISSING readme-sync
 * lint is an UNGUARDED warning, not a failure: the write can be valid in a
 * repo whose corpus gates are not yet wired, and the audit owns that gap.
 *
 * Exits 0 on success, 1 on any refusal or post-write lint failure. Refusals
 * name the rule that fired — a gate you cannot understand is a gate you route
 * around.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
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
const TODAY = new Date().toISOString().slice(0, 10);

const CORPUS_DIRS = {
  adr: ['docs/adr', 'adr', 'adrs', 'decisions'],
  pdr: ['docs/pdr', 'pdr'],
};
const LABEL = { adr: 'ADR', pdr: 'PDR' };
const LINT_HOMES = ['scripts', 'host/scripts', 'tools'];

/** Sections an amend may never rewrite once the record is confirmed. The
 *  templates' rule is "never edit a Decision in place"; Context rides with it
 *  because a new rationale for the same decision IS a new decision. Before
 *  confirmation they are revisable — see the header's pre-confirmation mode.
 *  Everything else is fair game. */
const PROTECTED_SECTIONS = ['Context', 'Decision'];

const REQUIRED_SECTIONS = {
  adr: ['Context', 'Decision', 'Enforcement', 'Consequences'],
  pdr: ['Context', 'Decision', 'Consequences'],
};

/** The blank forms' own fill-me markers. A draft carrying one was never filled
 *  in — this is the day-one-red class of bug, caught at the gate. Closed list,
 *  deliberately: a generic <angle-bracket> rule false-positives on generics
 *  in prose ("Array<string>" is a thing an ADR about TypeScript would say).
 *  `YYYY-MM-DD` left this list in 1.3.0 (#97): it appears legitimately as a
 *  format specifier (`scheduler:<slug>:<YYYY-MM-DDTHH:mm>` in ai-fleet
 *  ADR-009), so it is now checked where it is actually scaffold — the
 *  `**Date:**` front-matter field and the PDR falsifier line (validate()). */
const SCAFFOLD_MARKERS = {
  adr: ['<Title>', '<script name', '<npm run check', 'ADR-NNN', 'DELETE EVERYTHING BELOW'],
  pdr: [
    '<Title>',
    '<the person whose call',
    '<specific observable condition>',
    '<observable condition',
    'PDR-NNN',
    'DELETE EVERYTHING BELOW',
  ],
};

/** Mirrored from check-pdr-falsifiers.mjs R1/R2 — the deterministic half of
 *  the falsifier gate. R3/R4 stay with the lint (heuristic and due-date
 *  reporting); creation only refuses what the lint would gate on. */
const FALSIFIER = /^\s*[-*]\s*\[( |x|X)\]\s*Revisit\b(.*)$/gm;
const VAGUE = [
  /\brevisit later\b/i,
  /\bat (the )?next (planning|cycle|review|quarter)\b/i,
  /\bwhen (appropriate|convenient|it makes sense|we have time)\b/i,
  /\bif (this )?stops working\b/i,
  /\bperiodically\b/i,
];

function die(msg) {
  console.error(`write-record: ERROR — ${msg}`);
  process.exit(1);
}

function dieAll(errors) {
  console.error('write-record: REFUSED — the draft does not publish:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ------------------------------------------------------------------ parsing

/** Split a record into the front matter (H1 + **Status:** block) and its
 *  `## ` sections. A section's `slice` runs from its heading line to the next
 *  heading, trailing whitespace stripped — the unit the amend guard compares. */
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

/** Canonical section resolution (1.3.0, issue #97). Real corpora do not write
 *  bare headings — they write `## Decision 1: <summary>`, `## Decisions`,
 *  `## Enforcement (ships with the decision, per ADR-022)`. Exact-equality
 *  matching (≤1.2.0's sectionSlice) made every variant invisible to the
 *  required-section check AND the protected-section guard, which then
 *  compared null === null and passed on nothing. A heading normalizes to
 *  canonical C when, case-insensitively, it begins with C (optional plural
 *  `s`) and the next thing is a boundary — end-of-line, a colon, a dash, an
 *  open paren, or a digit:
 *
 *    ## Decision                            → Decision
 *    ## Decisions                           → Decision
 *    ## Decision 1: Storage backend         → Decision
 *    ## Decision 2 — Data source: …         → Decision
 *    ## Decision (PROPOSED — …)             → Decision
 *    ## Enforcement (ships with …)          → Enforcement
 *    ## Consequences (PROPOSED)             → Consequences
 *    ## Contextual notes                    → (none) — the \b is what saves it
 *    ## Decision Log                        → (none) — owner decision, #97 Q1
 *    ## Amendment (2026-07-07): …           → (none) — not a governed section
 *    ## Enforcement discipline              → (none) — a prose section about
 *                                             the discipline, not the gate's
 */
function canonicalOf(rawName, canonicals) {
  for (const c of canonicals) {
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${esc}s?\\b\\s*($|[:—–(-]|\\d)`, 'i').test(rawName)) return c;
  }
  return null;
}

/** All sections whose raw heading normalizes to `name`, in document order.
 *  Multiplicity matters: `## Decision 1/2/3` are three sections, and the
 *  amend guard compares all of them. */
function sectionMatches(sections, name, canonicals) {
  return sections.filter((s) => canonicalOf(s.name, canonicals) === name);
}

function bodyOfSlice(slice) {
  return slice.split('\n').slice(1).join('\n').trim();
}

/** First non-empty body among the sections normalizing to `name`, else null. */
function sectionBody(sections, name, canonicals) {
  const matches = sectionMatches(sections, name, canonicals);
  if (matches.length === 0) return null;
  return matches.map((m) => bodyOfSlice(m.slice)).find((b) => b !== '') ?? '';
}

// ------------------------------------------------------------- configuration

/** Per-corpus configuration (1.3.0, issue #97 Q3): `.write-record.json` at
 *  the repo root lets a repo declare what its corpora require instead of
 *  inheriting an instantly-locked backlog on adoption day — the failure the
 *  §97 census measured (60 ai-fleet ADRs predating the Enforcement rule).
 *
 *    {
 *      "adr": { "required": [...], "protected": [...], "grandfather": <int> },
 *      "pdr": { ... }
 *    }
 *
 *  All keys optional per kind; defaults are the house constants above.
 *  `grandfather`: on AMEND of a record numbered ≤ the cutoff, required-section
 *  missing/empty problems degrade to warnings — a corpus that predates the
 *  gate is not held to sections its era never wrote. create is always strict:
 *  a new record gets a new number, always above the cutoff.
 *  A config the gate cannot parse is a refusal, never a pass — a silently
 *  misread config would weaken the gate invisibly. */
function loadConfig() {
  const p = join(ROOT, '.write-record.json');
  if (!existsSync(p)) return {};
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    die(`.write-record.json is not valid JSON (${e.message}) — a config the gate cannot read proves nothing; fix it or delete it`);
  }
  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) {
    die('.write-record.json must be a JSON object keyed by kind ("adr" / "pdr")');
  }
  return cfg;
}

function corpusRules(kind, config) {
  const over = config[kind] ?? {};
  for (const key of Object.keys(over)) {
    if (!['required', 'protected', 'grandfather'].includes(key)) {
      die(`.write-record.json [${kind}]: unknown key "${key}" — expected required / protected / grandfather. An unrecognized key that silently did nothing would weaken the gate invisibly`);
    }
  }
  const required = over.required ?? REQUIRED_SECTIONS[kind];
  const protectedS = over.protected ?? PROTECTED_SECTIONS;
  const grandfather = over.grandfather ?? 0;
  for (const [key, list] of [['required', required], ['protected', protectedS]]) {
    if (!Array.isArray(list) || list.some((r) => typeof r !== 'string' || r.trim() === '')) {
      die(`.write-record.json [${kind}].${key} must be an array of non-empty section names`);
    }
  }
  if (!Number.isInteger(grandfather) || grandfather < 0) {
    die(`.write-record.json [${kind}].grandfather must be a non-negative integer record number`);
  }
  // The lookup set: governed sections normalization resolves against. PDR's
  // Rejected rule reads `## What would reopen this`, which is in neither
  // required nor protected — included so variant headings resolve there too.
  const canonicals = [...new Set([...required, ...protectedS, ...(kind === 'pdr' ? ['What would reopen this'] : [])])];
  return { required, protected: protectedS, grandfather, canonicals };
}

/** Superseded records are exempt from ## Enforcement (1.3.0, #97 Q2):
 *  backfilling enforcement into a dead decision is waste, and the backlog
 *  should be honest about what is actually live. */
function effectiveRequired(status, rules) {
  if (/^Superseded\b/i.test(status)) return rules.required.filter((r) => r !== 'Enforcement');
  return rules.required;
}

function statusOf(head) {
  return (head.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1] ?? '').trim();
}

/**
 * Is this record pre-confirmation? (1.1.0, issue #88)
 *
 * A record records belief only once someone signs. Before that it is a draft,
 * and revising a draft's Context/Decision is not rewriting history. The state
 * is read from the record ITSELF, old and new file independently:
 *
 *   PDR: Status Proposed AND Confirmed by unfilled — empty, `—` (the observed
 *        live dialect is `— (drafted for <name>; unconfirmed)`), or a
 *        <placeholder>. A Proposed PDR WITH a confirmer named is
 *        contradictory — the signature is the confirmation — and counts as
 *        LOCKED, not pre-confirmation.
 *   ADR: Status Proposed. ADRs carry no Confirmed-by; Proposed is the
 *        pre-confirmation state.
 */
function isPreConfirmation(kind, head) {
  if (!/^Proposed\b/i.test(statusOf(head))) return false;
  if (kind === 'adr') return true;
  const cb = (head.match(/^\*\*Confirmed by:\*\*\s*(.*)$/m)?.[1] ?? '').trim();
  return cb === '' || /^[—-]/.test(cb) || /^<.*>$/.test(cb);
}

/** Read or replace a `**Name:** value` front-matter line. Placeholders
 *  (empty, YYYY-MM-DD, <...>) are replaced with `fill`; real values are kept. */
function fixFrontField(head, name, fill) {
  const re = new RegExp(`^(\\*\\*${name}:\\*\\*)\\s*(.*)$`, 'm');
  const m = head.match(re);
  if (!m) return head;
  const cur = m[2].trim();
  if (cur === '' || /^Y{4}-M{2}-D{2}$/.test(cur) || /^<.*>$/.test(cur)) {
    return head.replace(re, () => `${m[1]} ${fill}`);
  }
  return head;
}

// ------------------------------------------------------------------ corpora

function findCorpusDir(kind) {
  for (const d of CORPUS_DIRS[kind]) {
    if (existsSync(join(ROOT, d))) return d;
  }
  return null;
}

/** Next free number: max over filenames AND README link targets, plus one.
 *  A file deleted by hand must not free its number — the README is the
 *  longer-lived witness. The pad width is the caller's job (corpusDialect). */
function nextNumber(dir) {
  let max = 0;
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(\d{3,4})-.+\.md$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const readme = join(dir, 'README.md');
  if (existsSync(readme)) {
    for (const m of readFileSync(readme, 'utf8').matchAll(/\((\d{3,4})-[^)]+\.md\)/g)) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max + 1;
}

/** The corpus's numbering dialect (1.2.0, issue #91), derived from what is on
 *  disk — never assumed:
 *    width   the widest number in use (filenames and README link targets, the
 *            longer-lived witness for a file deleted by hand), minimum 3.
 *    bracket true when bracketed MADR H1s (`# [ADR-0011] Title`) outnumber
 *            plain ones (`# ADR-011: Title`) — an empty or plain corpus keeps
 *            the original form, a MADR corpus is written in its own dialect.
 *            create mints the detected form so its own amend can re-read it. */
function corpusDialect(dir) {
  let width = 3;
  let bracket = 0;
  let plain = 0;
  const readme = join(dir, 'README.md');
  if (existsSync(readme)) {
    for (const m of readFileSync(readme, 'utf8').matchAll(/\((\d{3,4})-[^)]+\.md\)/g)) {
      width = Math.max(width, m[1].length);
    }
  }
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(\d{3,4})-.+\.md$/);
    if (!m) continue;
    width = Math.max(width, m[1].length);
    const h1 = readFileSync(join(dir, f), 'utf8').match(/^#\s+(.+)$/m)?.[1] ?? '';
    if (/^\[(ADR|PDR)[- ]\d{3,4}\]/.test(h1)) bracket++;
    else if (/^(ADR|PDR)[- ]\d{3,4}/.test(h1)) plain++;
  }
  return { width, bracket: bracket > plain };
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

function findRecordFile(dir, numArg) {
  // Pad to the corpus's own width (1.2.0) — `amend adr 11` must find
  // 0011-*.md in a 4-digit corpus, not just 011-*.md in a 3-digit one.
  const num = numArg.replace(/^(ADR|PDR)-/i, '').padStart(corpusDialect(dir).width, '0');
  const matches = readdirSync(dir).filter((f) => f.startsWith(`${num}-`) && f.endsWith('.md'));
  return { num, file: matches[0] ?? null };
}

// ------------------------------------------------------------ README tables

/** Locate the single inventory table in a corpus README. Exactly one is
 *  supported — a README that grew a second table is a human conversation. */
function splitInventoryTable(text, what) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim().startsWith('|')) {
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) j++;
      blocks.push({ start: i, end: j });
      i = j;
    } else {
      i++;
    }
  }
  if (blocks.length === 0) die(`${what} has no inventory table — refusing to guess at its structure`);
  if (blocks.length > 1) die(`${what} has ${blocks.length} tables — exactly one inventory table is supported`);
  const { start, end } = blocks[0];
  if (end - start < 2) die(`${what}'s inventory table has no separator row — malformed`);
  return {
    lines,
    start,
    end,
    header: lines[start],
    separator: lines[start + 1],
    rows: lines.slice(start + 2, end).filter((l) => l.trim() !== ''),
  };
}

const cellsOf = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const rowOf = (cells) => `| ${cells.join(' | ')} |`;
const linkTargetOf = (line) => line.match(/\((\d{3,4}-[^)]+\.md)\)/)?.[1] ?? null;

/** The Enforcement cell is a one-line summary of the section's first content
 *  line, bullet and bold-label stripped. Best-effort display text — the PR
 *  reviewer polishes; the row exists so the number can never be reused. */
function enforcementCell(sections, canonicals) {
  const body = sectionBody(sections, 'Enforcement', canonicals);
  if (!body) return '—';
  const first = body.split('\n').find((l) => l.trim() !== '');
  return first.replace(/^[-*]\s*/, '').replace(/^\*\*[^*]+:\*\*\s*/, '').trim().slice(0, 120) || '—';
}

function minimalReadme(kind) {
  const title = kind === 'adr' ? 'Architecture Decision Records' : 'Product Decision Records';
  const header = kind === 'adr' ? '| # | Title | Status | Enforcement |' : '| # | Title | Status | Last confirmed |';
  const separator = kind === 'adr' ? '|---|-------|--------|-------------|' : '|---|-------|--------|----------------|';
  return `# ${title}\n\nEvery file in this directory must appear in the table below.\n\n${header}\n${separator}\n`;
}

// ---------------------------------------------------------------- validation

function validate(kind, text, ctx) {
  const { head, sections } = parseRecord(text);
  const rules = ctx.rules;
  const canonicals = rules.canonicals;
  const label = LABEL[kind];
  const errors = [];
  const notes = [];

  if (!/^#\s+/m.test(head)) errors.push('no `# ` title line — the record needs an H1');

  const status = statusOf(head);
  const statusRe = new RegExp(`^(Proposed|Accepted|Rejected|Retired|Superseded by ${label}-\\d{3,4})\\b`);
  if (!status) {
    errors.push('no `**Status:**` line in the front matter');
  } else if (!statusRe.test(status)) {
    errors.push(
      `Status "${status}" is not one of Proposed | Accepted | Rejected | Retired | Superseded by ${label}-NNN`,
    );
  }

  for (const name of effectiveRequired(status, rules)) {
    const matches = sectionMatches(sections, name, canonicals);
    // ctx.missingOk (amend only, 1.2.0/#91): the record ON DISK never had this
    // section — a MADR corpus has no ## Enforcement anywhere, and punishing a
    // Consequences amend for a pre-existing, corpus-wide absence is the
    // dialect assumption wearing a rule's clothes. Absence the amend itself
    // creates (the record had it, the revised file drops it) stays an error —
    // the guard is anti-degradation, not a backfill mandate.
    // ctx.grandfathered (amend only, 1.3.0/#97 Q3): the record predates the
    // gate by the corpus's own declaration — missing/empty degrade to notes.
    if (matches.length === 0) {
      if (ctx.missingOk?.includes(name)) continue;
      if (ctx.grandfathered) {
        notes.push(`## ${name} absent — warn-only under the corpus's grandfather cutoff (${rules.grandfather}); the absence predates the gate`);
        continue;
      }
      errors.push(`missing required section: ## ${name}`);
      continue;
    }
    const bodies = matches.map((m) => ({ raw: m.name, body: bodyOfSlice(m.slice) }));
    if (bodies.every((b) => b.body === '')) {
      // ## Decision 1/2/3 collectively satisfy Decision — but a record whose
      // Decision sections are ALL empty still fails on empty.
      if (ctx.grandfathered) {
        notes.push(`## ${name} empty — warn-only under the corpus's grandfather cutoff (${rules.grandfather})`);
        continue;
      }
      errors.push(`section ## ${name} is empty`);
      continue;
    }
    // Legibility (§97): when normalization is what satisfied the section, say
    // which heading did it — a normalizer whose decisions are invisible is
    // how this defect class survives.
    const satisfiedBy = bodies.find((b) => b.body !== '');
    if (satisfiedBy.raw !== name) notes.push(`## ${name} satisfied by "## ${satisfiedBy.raw}"`);
  }

  for (const marker of SCAFFOLD_MARKERS[kind]) {
    if (text.includes(marker)) {
      errors.push(`template scaffold "${marker}" is still in the record — fill the form, then publish`);
    }
  }

  // YYYY-MM-DD as a PLACEHOLDER (1.3.0/#97): the blank form's Date field and
  // the PDR falsifier date. A whole-body substring check refused real records
  // over format specifiers in prose (ai-fleet ADR-009's cron key spec).
  const dateVal = (head.match(/^\*\*Date:\*\*\s*(.*)$/m)?.[1] ?? '').trim();
  if (/^Y{4}-M{2}-D{2}$/.test(dateVal) || /^<.*>$/.test(dateVal)) {
    errors.push('the **Date:** field still holds the placeholder — give the record its real date');
  }
  if (kind === 'pdr') {
    for (const m of text.matchAll(FALSIFIER)) {
      if (m[0].includes('YYYY-MM-DD')) {
        errors.push('the falsifier still holds the placeholder date — a falsifier without a real date is a wish');
      }
    }
  }

  if (/^Accepted\b/i.test(status)) {
    if (kind === 'adr') {
      const enf = sectionBody(sections, 'Enforcement', canonicals) ?? '';
      if (/not yet built/i.test(enf)) {
        errors.push(
          'Status is Accepted but Enforcement says "not yet built" — that phrase is the Proposed marker; an ADR reaches Accepted only with enforcement wired and passing',
        );
      }
    } else {
      const falsifiers = [...text.matchAll(FALSIFIER)];
      if (falsifiers.length === 0) {
        errors.push(
          'Status is Accepted with no falsifier line — a decision without a falsifier is a wish; add `- [ ] Revisit by YYYY-MM-DD when <observable condition>` or drop back to Proposed',
        );
      }
      for (const [, , conditionRaw] of falsifiers) {
        if (VAGUE.some((p) => p.test(conditionRaw.trim()))) {
          errors.push(
            `falsifier uses a phrasing the form rules out ("${conditionRaw.trim().slice(0, 70)}") — name a date, a threshold, or an event someone could check without a meeting`,
          );
        }
      }
    }
  }

  if (/^Rejected\b/i.test(status)) {
    if (kind === 'adr') {
      const enf = sectionBody(sections, 'Enforcement', canonicals) ?? '';
      if (!/n\/a\s*[—-]\s*Rejected/i.test(enf)) {
        errors.push('a Rejected ADR\'s Enforcement section reads `n/a — Rejected`, heading kept — it promises nothing');
      }
    } else if (!sectionBody(sections, 'What would reopen this', canonicals) || !/Reopen when/i.test(text)) {
      errors.push('a Rejected PDR needs `## What would reopen this` with a `- [ ] Reopen when <condition>` line');
    }
  }

  const sup = status.match(new RegExp(`^Superseded by ${label}-(\\d{3,4})\\b`, 'i'));
  if (sup && ctx.corpusDir) {
    const target = findRecordFile(join(ROOT, ctx.corpusDir), sup[1]);
    if (!target.file) errors.push(`Status cites ${label}-${sup[1]} as superseding, but no ${sup[1]}-*.md exists in ${ctx.corpusDir}/`);
    if (ctx.num && target.num === ctx.num) errors.push(`a record cannot supersede itself (${label}-${sup[1]})`);
  }

  if (kind === 'pdr') {
    const confirmedBy = (head.match(/^\*\*Confirmed by:\*\*\s*(.+)$/m)?.[1] ?? '').trim();
    // ctx.allowUnsignedDraft (amend only, 1.1.0/#88): the record on disk and
    // the revised file are both pre-confirmation — an unsigned draft is a
    // legal thing to KEEP unsigned while revising it. create never passes
    // this: you cannot publish an unsigned draft through the script.
    if ((!confirmedBy || /^<.*>$/.test(confirmedBy)) && !ctx.allowUnsignedDraft) {
      errors.push('PDR needs `**Confirmed by:** <a name, not a role>` — refusing is as much a signature as accepting, but someone signs');
    }
  }

  if (kind === 'adr' && ctx.lensRequired && !/^\*\*Lens:\*\*/m.test(head)) {
    errors.push(
      'this repo runs design-lenses — every ADR carries a `**Lens:**` line in the front matter, filled in the Proposed draft (`none — internal convention, no external claim` is a valid value)',
    );
  }

  return { errors, notes };
}

// --------------------------------------------------------------- lint runner

function findLint(name) {
  for (const d of LINT_HOMES) {
    const p = join(ROOT, d, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Run the corpus's own lints after a write. A red one is a nonzero exit with
 *  the working tree left standing — fix forward or `git restore`. A missing
 *  readme-sync lint is UNGUARDED, said out loud, not a failure. */
function runCorpusLints(kind) {
  const needed = ['check-adr-readme-sync.mjs'];
  if (kind === 'pdr') needed.push('check-pdr-falsifiers.mjs');
  if (kind === 'adr') needed.push('check-design-lens.mjs');

  let failed = false;
  const ran = [];
  for (const name of needed) {
    const p = findLint(name);
    if (!p) {
      if (name === 'check-adr-readme-sync.mjs') {
        console.log(
          `write-record: UNGUARDED — no ${name} in ${LINT_HOMES.join(', ')}; the corpus has no index gate until it is wired. Say so in the PR body.`,
        );
      }
      continue;
    }
    try {
      execFileSync('node', [p], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      ran.push(`${name}: OK`);
    } catch (err) {
      ran.push(`${name}: FAILED`);
      console.error(`\nwrite-record: post-write lint ${name} is red — the write landed; fix forward or git restore:\n`);
      console.error(`${err.stdout ?? ''}${err.stderr ?? ''}`);
      failed = true;
    }
  }
  if (ran.length) console.log(`write-record: lints — ${ran.join('; ')}`);
  return !failed;
}

// ------------------------------------------------------------------ commands

function cmdCreate(kind, draftPath) {
  if (!existsSync(draftPath)) die(`draft not found: ${draftPath}`);
  const rules = corpusRules(kind, loadConfig());
  let text = readFileSync(draftPath, 'utf8').replace(/\r\n/g, '\n');

  let dir = findCorpusDir(kind);
  if (!dir) {
    dir = CORPUS_DIRS[kind][0];
    mkdirSync(join(ROOT, dir), { recursive: true });
    console.log(`write-record: no ${LABEL[kind]} corpus found — created ${dir}/ (bootstrap; the corpus README template ships from repo-governance)`);
  }
  const corpusDir = join(ROOT, dir);

  // Number first: the H1 is rewritten with the allocated number, so a draft
  // never reserves one and two agents' drafts cannot collide before merge.
  // The mint speaks the corpus's dialect (1.2.0, issue #91): its pad width
  // and its H1 form, so a create into a MADR corpus produces a record this
  // same script's amend can re-read.
  const dialect = corpusDialect(corpusDir);
  const num = String(nextNumber(corpusDir)).padStart(dialect.width, '0');

  let { head, sections } = parseRecord(text);
  const h1 = head.match(/^#\s+(.+)$/m);
  if (!h1) die('the draft has no `# ` title line');
  const title = h1[1].replace(new RegExp(`^\\[?${LABEL[kind]}[- ][A-Za-z0-9]{1,5}\\]?:?\\s*`), '').trim();
  if (!title || title === '<Title>') die(`the draft's H1 is still the placeholder — give the record its real title`);

  head = head.replace(/^#\s+.+$/m, () =>
    dialect.bracket ? `# [${LABEL[kind]}-${num}] ${title}` : `# ${LABEL[kind]}-${num}: ${title}`,
  );
  head = fixFrontField(head, 'Date', TODAY);
  if (kind === 'pdr') head = fixFrontField(head, 'Last confirmed', TODAY);
  text = [head, ...sections.map((s) => s.slice)].join('\n\n');

  const lensRequired = kind === 'adr' && (findLint('check-design-lens.mjs') !== null || existsSync(join(ROOT, 'docs', 'design-lenses.md')));
  const { errors, notes } = validate(kind, text, { corpusDir: dir, lensRequired, rules });
  if (errors.length) dieAll(errors);
  for (const n of notes) console.log(`write-record: note — ${n}`);

  const slug = slugify(title);
  if (!slug) die(`could not derive a filename slug from title "${title}"`);
  const file = `${num}-${slug}.md`;
  const target = join(corpusDir, file);

  // Append-only: wx fails if the path exists. There is no overwrite code path.
  writeFileSync(target, text.endsWith('\n') ? text : `${text}\n`, { flag: 'wx' });
  console.log(`write-record: created ${dir}/${file} — ${LABEL[kind]}-${num} "${title}" (Status: ${statusOf(parseRecord(text).head)})`);

  // Register the inventory row. The README is created minimal if absent and
  // the gap is said out loud — a corpus without its index invites collisions.
  const readmePath = join(corpusDir, 'README.md');
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, minimalReadme(kind), { flag: 'wx' });
    console.log(`write-record: minted a minimal ${dir}/README.md — install the full corpus README template in this PR`);
  }
  const readmeText = readFileSync(readmePath, 'utf8');
  const table = splitInventoryTable(readmeText, `${dir}/README.md`);
  const row =
    kind === 'adr'
      ? rowOf([`[${num}](${file})`, title, statusOf(parseRecord(text).head), enforcementCell(parseRecord(text).sections, rules.canonicals)])
      : rowOf([`[${num}](${file})`, title, statusOf(parseRecord(text).head), TODAY]);
  const out = [...table.lines.slice(0, table.end), row, ...table.lines.slice(table.end)].join('\n');
  writeFileSync(readmePath, out.endsWith('\n') ? out : `${out}\n`);
  console.log(`write-record: registered the row in ${dir}/README.md`);

  if (!runCorpusLints(kind)) process.exit(1);
  console.log(`OK: ${LABEL[kind]}-${num} published. Status flips, consequences, and README rows go through this script too (amend) — direct edits stay denied by the harness stanza.`);
}

function cmdAmendRecord(kind, numArg, revisedPath) {
  if (!existsSync(revisedPath)) die(`revised file not found: ${revisedPath}`);
  const rules = corpusRules(kind, loadConfig());
  const dir = findCorpusDir(kind);
  if (!dir) die(`no ${LABEL[kind]} corpus found — nothing to amend`);
  const corpusDir = join(ROOT, dir);
  const { num, file } = findRecordFile(corpusDir, numArg);
  if (!file) {
    const existing = readdirSync(corpusDir).filter((f) => /^\d{3,4}-.+\.md$/.test(f)).sort();
    die(`no ${num}-*.md in ${dir}/. Existing records: ${existing.join(', ') || '(none)'}`);
  }

  const oldText = readFileSync(join(corpusDir, file), 'utf8').replace(/\r\n/g, '\n');
  const newText = readFileSync(revisedPath, 'utf8').replace(/\r\n/g, '\n');
  const oldParsed = parseRecord(oldText);
  const newParsed = parseRecord(newText);

  // The number is identity. Renumbering is delete + create, and deletion is
  // not an operation this script performs. The H1 match accepts the observed
  // MADR variants (1.2.0, issue #91 — all three live in one real corpus):
  // `# ADR-011: T` (template form), `# [ADR-0011] T` (bracket), `# ADR 0007: T`
  // (space). Widening the READ weakens nothing — the number must still equal
  // the old one, and the filename lookup already pinned it.
  const oldNum = oldParsed.head.match(new RegExp(`#\\s+\\[?${LABEL[kind]}[- ](\\d{3,4})\\]?`))?.[1];
  const newNum = newParsed.head.match(new RegExp(`#\\s+\\[?${LABEL[kind]}[- ](\\d{3,4})\\]?`))?.[1];
  if (!newNum || newNum !== oldNum) {
    die(`the H1 number cannot change under amend (${LABEL[kind]}-${oldNum ?? '?'} → ${newNum ?? 'none'}) — a renumbering is a new record`);
  }

  // The section guard. "Never edit a Decision in place" is the blank form's
  // own rule; here it is mechanical. Context rides with the Decision.
  //
  // Pre-confirmation revision mode (1.1.0, issue #88): the guard lifts only
  // when the record ON DISK is an unsigned draft AND the revised file keeps
  // it one. A flip to confirmed/Accepted in the same amend that edits a
  // protected section is the lock bypass — refused by name.
  const draftBefore = isPreConfirmation(kind, oldParsed.head);
  const draftAfter = isPreConfirmation(kind, newParsed.head);
  const revisionMode = draftBefore && draftAfter;
  const signedProposal =
    kind === 'pdr' && /^Proposed\b/i.test(statusOf(oldParsed.head)) && !draftBefore;

  for (const name of rules.protected) {
    // Compare EVERY section normalizing to the protected name, in document
    // order (1.3.0/#97): with `## Decision 1/2/3`, comparing only the first
    // leaves the rest freely rewritable — and deleting one, or renumbering
    // 2→3, changes the record of what was decided exactly as an edit does.
    const befores = sectionMatches(oldParsed.sections, name, rules.canonicals);
    const afters = sectionMatches(newParsed.sections, name, rules.canonicals);
    if (revisionMode) continue;
    if (befores.length === 0) {
      // The latent hole, refused by name: under exact matching the guard
      // compared null === null and PASSED, and 1.2.0's warn-only missingOk
      // unmasked it — a variant-heading record could have its Decision
      // rewritten with the gate reporting success. Missing is never a pass.
      die(
        `REFUSED: ${dir}/${file} has no section normalizing to ## ${name} — the guard has nothing to compare, and amending would leave ${name} unprotected against silent rewrite. Give the record a ## ${name} section first (a human edit through the stanza's ask path), or declare the corpus's real section names in .write-record.json.`,
      );
    }
    const unchanged = befores.length === afters.length && befores.every((b, i) => b.slice === afters[i].slice);
    if (unchanged) continue;
    if (draftBefore && !draftAfter) {
      die(
        `REFUSED: ## ${name} changed in the same amend that confirms the record. The flip to signed/Accepted is what locks Context and Decision — a confirmation amend carries them byte-identical. Land the revision while the draft is unsigned, then confirm in a separate amend the PR can read on its own.`,
      );
    }
    if (signedProposal) {
      die(
        `REFUSED: ## ${name} changed, and this PDR is Proposed but SIGNED (Confirmed by is filled) — a contradictory state. The signature is the confirmation: the record is locked from that point. If the signature was premature, remove the confirmer (a Status/front-matter amend, sections untouched) and then revise; otherwise the path is supersession.`,
      );
    }
    const multiplicity =
      befores.length > 1 || afters.length > 1
        ? ` (${befores.length} section(s) on disk vs ${afters.length} in the revision, compared in document order — deleting or renumbering ${name} sections is a change)`
        : '';
    die(
      `REFUSED: ## ${name} changed${multiplicity}. A ${name} is never edited in place on a confirmed record — write a NEW record that supersedes ${LABEL[kind]}-${oldNum} (create), then amend this one's Status to \`Superseded by ${LABEL[kind]}-NNN\`. The record of what was believed and why it changed is the most valuable thing in the corpus.`,
    );
  }

  const lensRequired = kind === 'adr' && (findLint('check-design-lens.mjs') !== null || existsSync(join(ROOT, 'docs', 'design-lenses.md')));
  // Sections the record never had stay its history, not this amend's
  // obligation (1.2.0/#91) — said out loud, per the fail-closed convention.
  // Computed against the OLD record's effective required set (1.3.0/#97): a
  // Superseded flip does not make Enforcement droppable mid-flight.
  const oldRequired = effectiveRequired(statusOf(oldParsed.head), rules);
  const missingOk = oldRequired.filter((n) => sectionMatches(oldParsed.sections, n, rules.canonicals).length === 0);
  const grandfathered = rules.grandfather > 0 && Number(oldNum) <= rules.grandfather;
  const { errors, notes } = validate(kind, newText, {
    corpusDir: dir,
    num,
    lensRequired,
    allowUnsignedDraft: revisionMode,
    missingOk,
    grandfathered,
    rules,
  });
  if (errors.length) dieAll(errors);
  for (const n of notes) console.log(`write-record: note — ${n}`);
  if (missingOk.length) {
    console.log(
      `write-record: WARNING — ${LABEL[kind]}-${oldNum} has no ## ${missingOk.join(' / ## ')} section (a corpus-dialect absence, predating this amend; left as-is). The house form requires it of every NEW record — create stays strict.`,
    );
  }

  writeFileSync(join(corpusDir, file), newText.endsWith('\n') ? newText : `${newText}\n`);
  console.log(
    revisionMode
      ? `write-record: amended ${dir}/${file} (${LABEL[kind]}-${oldNum}) — pre-confirmation draft; ## Context / ## Decision revised under the unsigned-draft rule. Confirming (signature / Accepted) locks them permanently.`
      : `write-record: amended ${dir}/${file} (${LABEL[kind]}-${oldNum}) — ## Context and ## Decision verified byte-identical`,
  );

  // Derived README cells follow the record; curated cells never move without
  // `amend readme`. Status is the record's own line; Last confirmed (PDR) is
  // its front matter. Enforcement summaries stay curated — see the header.
  const readmePath = join(corpusDir, 'README.md');
  if (existsSync(readmePath)) {
    const readmeText = readFileSync(readmePath, 'utf8');
    const table = splitInventoryTable(readmeText, `${dir}/README.md`);
    const headerCells = cellsOf(table.header);
    const statusCol = headerCells.findIndex((c) => /^status$/i.test(c));
    const confirmedCol = headerCells.findIndex((c) => /^last confirmed$/i.test(c));
    const rowIdx = table.rows.findIndex((r) => linkTargetOf(r) === file);
    if (rowIdx === -1) {
      console.log(`write-record: WARNING — no README row links to ${file}; the sync lint will fail. Add the row via: amend ${kind} readme`);
    } else {
      const cells = cellsOf(table.rows[rowIdx]);
      const changes = [];
      const newStatus = statusOf(newParsed.head);
      const oldStatus = cells[headerCells.findIndex((c) => /^status$/i.test(c))];
      if (statusCol !== -1 && newStatus && cells[statusCol] !== newStatus) {
        cells[statusCol] = newStatus;
        changes.push(`Status → ${newStatus}`);
      }
      // The Enforcement cell is curated, never auto-written — but the README's
      // own convention ("tracking issue #N" ⇒ Proposed) makes a stale cell
      // legible, so a flip to Accepted over a placeholder cell is named loudly.
      if (kind === 'adr' && /^Accepted\b/i.test(newStatus) && !/^Accepted\b/i.test(oldStatus ?? '')) {
        const enfCol = headerCells.findIndex((c) => /^enforcement$/i.test(c));
        if (enfCol !== -1 && /not yet built|tracking issue/i.test(cells[enfCol] ?? '')) {
          console.log(
            `write-record: WARNING — the README Enforcement cell still reads "${cells[enfCol]}" while Status is Accepted; update it via: amend ${kind} readme`,
          );
        }
      }
      if (kind === 'pdr' && confirmedCol !== -1) {
        const lc = (newParsed.head.match(/^\*\*Last confirmed:\*\*\s*(.+)$/m)?.[1] ?? '').trim();
        if (lc && cells[confirmedCol] !== lc) {
          cells[confirmedCol] = lc;
          changes.push(`Last confirmed → ${lc}`);
        }
      }
      if (changes.length) {
        const abs = table.start + 2 + rowIdx;
        const lines = [...table.lines];
        lines[abs] = rowOf(cells);
        writeFileSync(readmePath, lines.join('\n').endsWith('\n') ? lines.join('\n') : `${lines.join('\n')}\n`);
        console.log(`write-record: README row synced (${changes.join(', ')})`);
      }
    }
  }

  if (!runCorpusLints(kind)) process.exit(1);
  console.log(`OK: ${LABEL[kind]}-${oldNum} amended.`);
}

function cmdAmendReadme(kind, revisedPath) {
  if (!existsSync(revisedPath)) die(`revised file not found: ${revisedPath}`);
  const dir = findCorpusDir(kind);
  if (!dir) die(`no ${LABEL[kind]} corpus found — nothing to amend`);
  const corpusDir = join(ROOT, dir);
  const readmePath = join(corpusDir, 'README.md');
  if (!existsSync(readmePath)) die(`${dir}/README.md does not exist — create the first record and the script mints the index`);

  const oldText = readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n');
  const newText = readFileSync(revisedPath, 'utf8').replace(/\r\n/g, '\n');
  const oldT = splitInventoryTable(oldText, `${dir}/README.md`);
  const newT = splitInventoryTable(newText, `${dir}/README.md (revised)`);

  // Prose is not ours to touch: everything outside the table is byte-identical,
  // including the template comment block that carries the naming conventions.
  const oldPre = oldT.lines.slice(0, oldT.start).join('\n');
  const newPre = newT.lines.slice(0, newT.start).join('\n');
  const oldPost = oldT.lines.slice(oldT.end).join('\n');
  const newPost = newT.lines.slice(newT.end).join('\n');
  if (oldPre !== newPre) die('REFUSED: prose above the inventory table changed — `amend readme` edits rows, not prose');
  if (oldPost !== newPost) die('REFUSED: content below the inventory table changed — `amend readme` edits rows, not prose');
  if (oldT.header !== newT.header || oldT.separator !== newT.separator) {
    die('REFUSED: the table header changed — column changes are a governance conversation, not an edit');
  }

  const oldTargets = oldT.rows.map(linkTargetOf).filter(Boolean);
  const newTargets = newT.rows.map(linkTargetOf).filter(Boolean);

  // Never pruned. A deleted proposal comes back; the record of what was
  // refused, and why, is what stops the re-litigation.
  const deleted = oldTargets.filter((t) => !newTargets.includes(t));
  if (deleted.length) {
    die(`REFUSED: row deletion(s): ${deleted.join(', ')} — Rejected and Superseded records stay in the index and are never pruned`);
  }

  for (const row of newT.rows) {
    if (cellsOf(row).length !== cellsOf(newT.header).length) {
      die(`REFUSED: a row has the wrong cell count for the header: ${row}`);
    }
    const target = linkTargetOf(row);
    if (!target) die(`REFUSED: a row carries no (NNN-file.md) record link: ${row}`);
    if (!existsSync(join(corpusDir, target))) die(`REFUSED: row links to ${target}, which does not exist in ${dir}/`);
  }

  const onDisk = readdirSync(corpusDir).filter((f) => /^\d{3,4}-.+\.md$/.test(f));
  const unregistered = onDisk.filter((f) => !newTargets.includes(f));
  if (unregistered.length) {
    die(`REFUSED: ${unregistered.join(', ')} exists in ${dir}/ but has no row — an unregistered record invites a numbering collision`);
  }

  writeFileSync(readmePath, newText.endsWith('\n') ? newText : `${newText}\n`);
  console.log(`write-record: ${dir}/README.md updated — ${newT.rows.length} row(s), prose and header verified unchanged, no deletions`);

  if (!runCorpusLints(kind)) process.exit(1);
  console.log('OK: README amended.');
}

/** check (1.3.0, #97 Q4): dry-run a draft against create-strict validation
 *  and print the resolved section map, writing nothing. Every diagnosis in
 *  the §97 report required reading the script or provoking refusals against
 *  a live corpus — this is the five-minute version. */
function cmdCheck(kind, draftPath) {
  if (!existsSync(draftPath)) die(`draft not found: ${draftPath}`);
  const rules = corpusRules(kind, loadConfig());
  const text = readFileSync(draftPath, 'utf8').replace(/\r\n/g, '\n');
  const dir = findCorpusDir(kind);
  const { head, sections } = parseRecord(text);

  console.log(`write-record check: ${LABEL[kind]} draft ${draftPath}${dir ? `, corpus ${dir}/` : ' — no corpus dir found; corpus-context checks skipped'}`);
  console.log('section map (raw heading → governed section):');
  for (const s of sections) {
    console.log(`  ## ${s.name}  →  ${canonicalOf(s.name, rules.canonicals) ?? '(not a governed section)'}`);
  }

  const lensRequired = kind === 'adr' && (findLint('check-design-lens.mjs') !== null || existsSync(join(ROOT, 'docs', 'design-lenses.md')));
  // Validate what create would validate: create allocates the H1 number and
  // fills the date fields BEFORE validating, so a draft carrying the form's
  // placeholders in exactly those positions is the expected input, not
  // scaffold. Placeholders anywhere else still fire.
  let probeHead = head.replace(/^#\s+.+$/m, (l) => l.replace(new RegExp(`${LABEL[kind]}-N{2,5}`), `${LABEL[kind]}-000`));
  probeHead = fixFrontField(fixFrontField(probeHead, 'Date', TODAY), 'Last confirmed', TODAY);
  const probe = [probeHead, ...sections.map((s) => s.slice)].join('\n\n');
  const { errors, notes } = validate(kind, probe, { corpusDir: dir ?? undefined, lensRequired, rules });
  for (const n of notes) console.log(`write-record: note — ${n}`);
  if (errors.length) dieAll(errors);
  console.log('OK: the draft would pass create validation — nothing written');
}

// --------------------------------------------------------------------- main

const [, , verb, kindArg, a, b] = process.argv;
const usage = `usage:
  node scripts/write-record.mjs create <adr|pdr> <draft-file>
  node scripts/write-record.mjs amend  <adr|pdr> <NNN> <revised-file>
  node scripts/write-record.mjs amend  <adr|pdr> readme <revised-file>
  node scripts/write-record.mjs check  <adr|pdr> <draft-file>`;

if (!['create', 'amend', 'check'].includes(verb) || !['adr', 'pdr'].includes(kindArg)) die(usage);

if (verb === 'create') {
  if (!a) die(usage);
  cmdCreate(kindArg, a);
} else if (verb === 'check') {
  if (!a) die(usage);
  cmdCheck(kindArg, a);
} else if (a === 'readme') {
  if (!b) die(usage);
  cmdAmendReadme(kindArg, b);
} else {
  if (!a || !b) die(usage);
  cmdAmendRecord(kindArg, a, b);
}
