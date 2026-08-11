// template: scripts/check-enforcement-stanzas.mjs v1.1.0 · updated 2026-08-11
/**
 * lint:enforcement-stanzas  [TEMPLATE — ships to governed repos]
 *
 * Closes issue #37 (split from #33). A permission stanza cannot report its own
 * absence: the fail-open shape here is an agent that believes it is gated and is
 * not. This lint is the out-of-band detection half of the enforcement pair
 * (templates/harness-enforcement.md + harness-enforcement.opencode.md): it reads
 * the repo's harness configs and fails CI when a required stanza is absent,
 * malformed, or incomplete.
 *
 * Register-driven, the check-mothership-drift.mjs shape: the register
 * (docs/enforcement-stanzas-register.md) names the required harnesses and the
 * repo's records paths; a missing or malformed register fails closed.
 *
 * The register-completeness rule (issue #33's spec fix): every backticked path in
 * the repo's CLAUDE.md (or AGENTS.md) records-files paragraph — the section whose
 * `##` heading contains "records" — must appear in the register. A listed file
 * with no register entry is a blocking UNREGISTERED naming the file: an
 * unprotected records file is reported, never silently unasserted. If no records
 * paragraph is found, the rule reports SKIPPED — loudly, never a silent pass.
 *
 * Paragraphs mention non-records too (this repo's own paragraph names the forms
 * directory as a contrast: "The blank forms live in `templates/`"). The optional
 * `## Paragraph exemptions` register section carries those, reason required per
 * row — an exemption without its reason on the record is a suppression.
 *
 * Findings, all blocking unless noted:
 *
 *   MISSING        a registered harness's config file does not exist
 *   UNSTAMPED      the config carries no governance-install stamp for the stanza
 *   MALFORMED      the config does not parse IN ITS OWN HARNESS'S DIALECT — strict
 *                  JSON for .claude/settings.json, JSONC for opencode.json. Parsing
 *                  both as JSONC (v1.0.1) accepted files Claude Code discards whole,
 *                  reporting a stanza as present while nothing was enforced
 *   MISSING-RULE   a required rule is absent — records paths accept `deny` or `ask`
 *                  (the register records which mode the repo runs; ask auto-rejects
 *                  headless, demonstrated 2026-08-08 both harnesses); secrets paths
 *                  must be `deny` — there is no legitimate agent-reads-.env workflow
 *   NOT-BINDING    (opencode) a required rule is listed before the "*" catch-all —
 *                  last-match-wins means the catch-all silently overwrites it
 *   UNREGISTERED   a path in the CLAUDE.md records paragraph has no register entry
 *
 * Secrets rules are a lint constant (the SECRETS set below), not register data —
 * they ship with the stanza template and version with it; a repo must not edit
 * them away by editing a register file.
 *
 * Wired:  node scripts/check-enforcement-stanzas.mjs   (runs in CI — pure repo-local reads)
 */

import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const REGISTER = join(ROOT, 'docs', 'enforcement-stanzas-register.md');

/** The secrets path set shipped by the stanza templates. Per harness, in the exact
 *  pattern syntax that harness expects. */
const SECRETS = {
  'claude-code': {
    key: 'deny',
    patterns: ['Read(./.env)', 'Read(./.env.*)', 'Read(**/.env)', 'Read(**/.env.*)', 'Edit(./.env)', 'Edit(./.env.*)'],
  },
  opencode: {
    edit: ['.env', '.env.*', '**/.env', '**/.env.*'],
    read: ['.env', '.env.*', '**/.env', '**/.env.*'],
  },
};

const HARNESS_CONFIG = {
  'claude-code': '.claude/settings.json',
  opencode: 'opencode.json',
};

function failClosed(msg) {
  console.error(`check-enforcement-stanzas: ERROR — ${msg}`);
  console.error('Reporting an error, not a pass: a check that cannot read its register has not run.');
  process.exit(1);
}

// ---------------------------------------------------------------- the register

if (!existsSync(REGISTER)) failClosed(`register not found at docs/enforcement-stanzas-register.md`);
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

const stripTicks = (s) => s.replace(/^`|`$/g, '');

const harnesses = tableRows('## Harnesses').map((cells, i) => {
  if (cells.length < 2 || !HARNESS_CONFIG[stripTicks(cells[0])]) {
    failClosed(`harnesses row ${i + 1} is malformed (known harnesses: ${Object.keys(HARNESS_CONFIG).join(', ')})`);
  }
  return stripTicks(cells[0]);
});

/** Records paths exactly as the repo's CLAUDE.md names them — files as-is,
 *  directories with a trailing slash. */
const recordsPaths = tableRows('## Records paths').map((cells, i) => {
  if (!cells[0]) failClosed(`records-paths row ${i + 1} is malformed (empty path cell)`);
  return stripTicks(cells[0]);
});

if (!harnesses.length) failClosed('register names no harnesses — a register that requires nothing proves nothing');
if (!recordsPaths.length) failClosed('register names no records paths — the stanza exists to protect them');

/** Optional section: paths the records paragraph mentions that are NOT records
 *  (the house paragraph names the forms directory as a contrast). Absent section
 *  means no exemptions; a present section with a reasonless row fails closed. */
const paragraphExemptions = registerText.includes('## Paragraph exemptions')
  ? tableRows('## Paragraph exemptions').map((cells, i) => {
      if (cells.length < 2 || !cells[1] || /^-+$/.test(cells[1])) {
        failClosed(`paragraph-exemptions row ${i + 1} carries no reason — an exemption without its reason on the record is a suppression`);
      }
      return stripTicks(cells[0]);
    })
  : [];

// ------------------------------------------------------- config file parsing

/** Parse a config in its own harness's dialect — NOT uniformly JSONC.
 *
 *  This distinction is load-bearing and was learned the expensive way. v1.0.1
 *  parsed both configs as JSONC, which meant it validated a `.claude/settings.json`
 *  that Claude Code itself refuses to load: that loader is strict JSON and discards
 *  the whole file on a comment, voiding every rule in it. The lint reported a
 *  complete, correctly-ordered, stamped stanza while nothing was enforced
 *  (analytics-infrastructure #437, one day green, found by a startup warning and
 *  not by this lint). A presence lint that accepts input the harness rejects is
 *  the fail-open it exists to detect.
 *
 *  So: strict JSON for Claude Code, JSONC for opencode (which does tolerate
 *  comments, and whose closed startup schema rejects the key form instead).
 *  Keep this per-harness for as long as the harnesses disagree. */
function parseHarnessConfig(harness, path) {
  const raw = readFileSync(path, 'utf8');
  if (harness === 'claude-code') return JSON.parse(raw);
  return parseJsonc(raw);
}

/** Strip full-line and trailing `//` comments, then parse.
 *  Limitation: a `//` inside a string value would be misread — no plausible
 *  permission rule carries one; path patterns never do. */
function parseJsonc(raw) {
  const stripped = raw
    .split('\n')
    .map((line) => {
      let out = '';
      let inStr = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"' && line[i - 1] !== '\\') inStr = !inStr;
        if (!inStr && line[i] === '/' && line[i + 1] === '/') break;
        out += line[i];
      }
      return out;
    })
    .join('\n');
  return JSON.parse(stripped);
}

/** The deny patterns a harness config must carry for one records path.
 *  A directory (trailing `/`) requires the `**` glob form. */
function requiredPatterns(harness, recordsPath) {
  const p = recordsPath.endsWith('/') ? `${recordsPath}**` : recordsPath;
  if (harness === 'claude-code') return { deny: [`Edit(${p})`] };
  return { edit: [p] };
}

// ------------------------------------------------------------------ the audit

const findings = [];

for (const harness of harnesses) {
  const configPath = join(ROOT, HARNESS_CONFIG[harness]);
  if (!existsSync(configPath)) {
    findings.push({
      sev: 'MISSING',
      msg: `${HARNESS_CONFIG[harness]} does not exist — the register requires a ${harness} enforcement stanza and there is no config to carry it`,
    });
    continue;
  }

  const raw = readFileSync(configPath, 'utf8');
  if (!raw.includes('governance-install: harness-enforcement')) {
    findings.push({
      sev: 'UNSTAMPED',
      msg: `${HARNESS_CONFIG[harness]} carries no "governance-install: harness-enforcement" stamp — the stamp is how install drift is detected; keep it when installing. Form is per harness: .claude/settings.json takes a "_governance_install" string key whose VALUE carries the full stamp text (that file is strict JSON — a // comment there voids the entire stanza); opencode.json takes a // comment (the key form is fatal there, schema-validated at startup)`,
    });
  }

  let config;
  try {
    config = parseHarnessConfig(harness, configPath);
  } catch (err) {
    const hint =
      harness === 'claude-code' && /^\s*\/\//m.test(raw)
        ? ' — this file contains a "//" comment and Claude Code parses it as STRICT JSON: the whole file is discarded and every rule in the stanza is inert. Move the governance-install stamp into a "_governance_install" string key (harness-enforcement.md v1.1.0+)'
        : '';
    findings.push({
      sev: 'MALFORMED',
      msg: `${HARNESS_CONFIG[harness]} does not parse as ${harness === 'claude-code' ? 'strict JSON' : 'JSONC'}: ${err.message}${hint}`,
    });
    continue;
  }

  if (harness === 'claude-code') {
    const deny = config?.permissions?.deny;
    if (!Array.isArray(deny)) {
      findings.push({ sev: 'MALFORMED', msg: `${HARNESS_CONFIG[harness]} has no permissions.deny array` });
      continue;
    }
    const ask = config?.permissions?.ask;
    // Records rules accept deny or ask — ask is a human checkpoint interactively
    // and auto-rejects headless; the register records the repo's mode. Secrets
    // rules must be deny: there is no legitimate agent-reads-.env workflow.
    for (const p of recordsPaths) {
      const rule = requiredPatterns(harness, p).deny[0];
      if (!deny.includes(rule) && !(Array.isArray(ask) && ask.includes(rule))) {
        findings.push({
          sev: 'MISSING-RULE',
          msg: `${HARNESS_CONFIG[harness]} has no "${rule}" in permissions.deny or permissions.ask — the stanza is incomplete; reinstall from templates/harness-enforcement.md`,
        });
      }
    }
    for (const rule of SECRETS['claude-code'].patterns) {
      if (!deny.includes(rule)) {
        findings.push({
          sev: 'MISSING-RULE',
          msg: `${HARNESS_CONFIG[harness]} permissions.deny lacks "${rule}" — secrets rules must be deny, never ask; reinstall from templates/harness-enforcement.md`,
        });
      }
    }
  }

  if (harness === 'opencode') {
    const perm = config?.permission;
    if (!perm || typeof perm !== 'object') {
      findings.push({ sev: 'MALFORMED', msg: `${HARNESS_CONFIG[harness]} has no permission object` });
      continue;
    }
    for (const kind of ['edit', 'read']) {
      const rules = perm[kind];
      if (!rules || typeof rules !== 'object') {
        findings.push({ sev: 'MALFORMED', msg: `${HARNESS_CONFIG[harness]} has no permission.${kind} object` });
        continue;
      }
      // Records rules accept deny or ask (edit kind only — records are protected
      // from writes; reads of records are legitimate work). Secrets rules must be
      // deny in both kinds.
      const required = [
        ...(kind === 'edit' ? recordsPaths.flatMap((p) => requiredPatterns(harness, p).edit.map((rule) => ({ rule, modes: ['deny', 'ask'] }))) : []),
        ...SECRETS.opencode[kind].map((rule) => ({ rule, modes: ['deny'] })),
      ];
      const keys = Object.keys(rules);
      const catchAllIdx = keys.indexOf('*');
      for (const { rule, modes } of required) {
        if (!modes.includes(rules[rule])) {
          findings.push({
            sev: 'MISSING-RULE',
            msg: `${HARNESS_CONFIG[harness]} permission.${kind} lacks "${rule}": ${modes.length > 1 ? '"deny" or "ask"' : '"deny" (secrets never run at ask)'} — the stanza is incomplete; reinstall from templates/harness-enforcement.opencode.md`,
          });
          continue;
        }
        // Last match wins: a rule listed before the "*" catch-all is dead config —
        // it reads correctly and does not bind. That is the one install mistake
        // this lint exists to catch statically.
        if (catchAllIdx !== -1 && keys.indexOf(rule) < catchAllIdx) {
          findings.push({
            sev: 'NOT-BINDING',
            msg: `${HARNESS_CONFIG[harness]} permission.${kind} lists "${rule}" BEFORE the "*" catch-all — last-match-wins means the catch-all overwrites it. Catch-all first, denies after.`,
          });
        }
      }
    }
  }
}

// ------------------------------------------- register completeness (UNREGISTERED)

/** The records-files paragraph: the section whose `##` heading contains
 *  "records" in CLAUDE.md, falling back to AGENTS.md. Backticked tokens that look
 *  like paths (contain `/` or end in `.md`) are the authoritative list. */
function recordsParagraphPaths() {
  const source = ['CLAUDE.md', 'AGENTS.md'].map((f) => join(ROOT, f)).find(existsSync);
  if (!source) return null;
  const lines = readFileSync(source, 'utf8').split('\n');
  const start = lines.findIndex((l) => /^##\s/i.test(l) && /records/i.test(l));
  if (start === -1) return null;
  const paths = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    for (const m of lines[i].matchAll(/`([^`]+)`/g)) {
      if (m[1].includes('/') || m[1].endsWith('.md')) paths.push(m[1]);
    }
  }
  return paths;
}

const listed = recordsParagraphPaths();
if (listed === null) {
  console.log('SKIPPED: no CLAUDE.md/AGENTS.md records-files paragraph found — the register-completeness rule did not run. This is a skip, not a pass.');
} else {
  for (const p of listed) {
    if (!recordsPaths.includes(p) && !paragraphExemptions.includes(p)) {
      findings.push({
        sev: 'UNREGISTERED',
        msg: `${p} is named in the records-files paragraph but absent from docs/enforcement-stanzas-register.md — an unprotected records file is reported, never silently unasserted. Add it to the register and to every registered harness's stanza.`,
      });
    }
  }
}

// ----------------------------------------------------------------- the report

console.log(
  `check-enforcement-stanzas: ${harnesses.length} harness(es) registered (${harnesses.join(', ')}), ${recordsPaths.length} records path(s), ${paragraphExemptions.length} paragraph exemption(s), ${listed === null ? 'completeness SKIPPED' : `${listed.length} paragraph path(s) checked`}.`,
);

if (!findings.length) {
  console.log('OK: every registered harness carries a stamped, complete, correctly-ordered enforcement stanza.');
  process.exit(0);
}

for (const f of findings) console.log(`\n${f.sev}: ${f.msg}`);
console.error(`\n${findings.length} blocking finding(s).`);
process.exit(1);
