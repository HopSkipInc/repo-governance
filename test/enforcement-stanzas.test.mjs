// Fixture tests for scripts/check-enforcement-stanzas.mjs (template, self-installed).
//
// Same rule as the other lint fixtures: fire on a known-bad input, clear on a
// known-good one. The cases pin the two properties the issue's tier rests on —
// the register-completeness rule (a CLAUDE.md-listed records file absent from the
// register is a blocking UNREGISTERED) and fail-closed behaviour (a missing
// register or unparseable config is an error, never a pass). The opencode
// NOT-BINDING case pins the last-match-wins ordering check: a deny listed before
// the "*" catch-all reads correctly and does not bind.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const LINT = resolve(REPO, 'scripts/check-enforcement-stanzas.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-enforcement-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd) {
  try {
    const out = execFileSync('node', [LINT], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const BT = '`';
const register = (harnessRows = [], pathRows = [], exemptionRows = null) =>
  '# Enforcement stanzas register\n\n## Harnesses\n\n' +
  '| harness | config path |\n|---|---|\n' +
  harnessRows.map((r) => `| ${BT}${r[0]}${BT} | ${BT}${r[1]}${BT} |`).join('\n') +
  '\n\n## Records paths\n\n| path |\n|---|\n' +
  pathRows.map((p) => `| ${BT}${p}${BT} |`).join('\n') +
  '\n' +
  (exemptionRows === null
    ? ''
    : '\n## Paragraph exemptions\n\n| path | Reason |\n|---|---|\n' +
      exemptionRows.map((r) => `| ${BT}${r[0]}${BT} | ${r[1]} |`).join('\n') +
      '\n');

// Claude Code parses .claude/settings.json as STRICT JSON — the stamp is a
// "_governance_install" key here, never a // comment. The comment form is the
// v1.0.1 bug, and it has its own MALFORMED regression test below.
const CLAUDE_STAMP = '  "_governance_install": "governance-install: harness-enforcement.md v1.1.0 · updated 2026-08-11",\n';

const CLAUDE_CFG =
  '{\n' + CLAUDE_STAMP +
  '  "permissions": {\n    "deny": [\n' +
  '      "Edit(docs/pdr/**)",\n      "Edit(docs/code-conventions.md)",\n' +
  '      "Read(./.env)",\n      "Read(./.env.*)",\n      "Read(**/.env)",\n      "Read(**/.env.*)",\n' +
  '      "Edit(./.env)",\n      "Edit(./.env.*)"\n    ]\n  }\n}\n';

const OPENCODE_CFG =
  '{\n  // governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08\n' +
  '  "permission": {\n' +
  '    "edit": { "*": "allow", "docs/pdr/**": "deny", "docs/code-conventions.md": "deny", ".env": "deny", ".env.*": "deny", "**/.env": "deny", "**/.env.*": "deny" },\n' +
  '    "read": { "*": "allow", ".env": "deny", ".env.*": "deny", "**/.env": "deny", "**/.env.*": "deny" }\n' +
  '  }\n}\n';

const CLAUDE_MD =
  '# Repo\n\n## Records files — never `cp` over these\n\n' +
  `${BT}docs/code-conventions.md${BT}, and everything in ${BT}docs/pdr/${BT}.\n\n## Something else\n`;

const BOTH = [
  ['claude-code', '.claude/settings.json'],
  ['opencode', 'opencode.json'],
];
const PATHS = ['docs/pdr/', 'docs/code-conventions.md'];

test('enforcement: compliant installs for both harnesses clear', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK: every registered harness/);
  assert.match(out, /2 harness\(es\) registered/);
});

test('enforcement: a missing harness config is a blocking MISSING', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISSING/);
  assert.match(out, /\.claude\/settings\.json does not exist/);
});

test('enforcement: a deliberately-removed stamp fails CI naming the stanza', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG.replace(CLAUDE_STAMP, ''),
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /UNSTAMPED/);
  assert.match(out, /governance-install: harness-enforcement/);
});

// The v1.0.1 regression, locked. That version parsed BOTH configs as JSONC, so a
// `.claude/settings.json` carrying the stamp as a `//` comment cleared this lint
// while Claude Code discarded the file whole and enforced none of it — a full day
// of green CI over an inert stanza (analytics-infrastructure #437 → #449).
// The comment form must now be MALFORMED, and the message must say why.
test('enforcement: a // comment in .claude/settings.json is MALFORMED — Claude Code parses it as strict JSON', () => {
  const commentStamped = CLAUDE_CFG.replace(
    CLAUDE_STAMP,
    '  // governance-install: harness-enforcement.md v1.0.0 · updated 2026-08-08\n',
  );
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': commentStamped,
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MALFORMED/);
  assert.match(out, /does not parse as strict JSON/);
  // the actionable half: name the cause and the fix, not just the parse error
  assert.match(out, /every rule in the stanza is inert/);
  assert.match(out, /_governance_install/);
});

// The mirror image: opencode IS JSONC-tolerant and rejects unknown keys at
// startup, so the comment form is correct there and must keep clearing.
test('enforcement: a // comment in opencode.json still clears — that harness is JSONC-tolerant', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK: every registered harness/);
});

test('enforcement: a missing records deny rule is a blocking MISSING-RULE naming it', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG.replace('      "Edit(docs/pdr/**)",\n', ''),
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISSING-RULE/);
  assert.match(out, /Edit\(docs\/pdr\/\*\*\)/);
});

test('enforcement: a missing secrets deny rule is a blocking MISSING-RULE', () => {
  const cfg = JSON.parse(OPENCODE_CFG.replace(/^\s*\/\/.*$/gm, ''));
  delete cfg.permission.read['**/.env'];
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': '// governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08\n' + JSON.stringify(cfg, null, 2),
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISSING-RULE/);
  assert.match(out, /permission\.read/);
});

test('enforcement: opencode deny listed before the catch-all is NOT-BINDING', () => {
  const badOrder = OPENCODE_CFG.replace(
    '"edit": { "*": "allow", "docs/pdr/**": "deny",',
    '"edit": { "docs/pdr/**": "deny", "*": "allow",',
  );
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': badOrder,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOT-BINDING/);
  assert.match(out, /Catch-all first, denies after/);
});

test('enforcement: a CLAUDE.md-listed records file absent from the register is a blocking UNREGISTERED naming the file', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, ['docs/pdr/']),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /UNREGISTERED/);
  assert.match(out, /docs\/code-conventions\.md/);
  assert.match(out, /never silently unasserted/);
});

test('enforcement: a paragraph-mentioned non-records path clears when exempted with a reason', () => {
  // The house paragraph names the forms directory as a contrast ("The blank forms
  // live in `templates/`") — the completeness rule reads it, and the register
  // exempts it on the record. First live run of this lint caught exactly this.
  const mdWithContrast = CLAUDE_MD.replace(
    '\n\n## Something else\n',
    ` The blank forms live in ${BT}templates/${BT}.\n\n## Something else\n`,
  );
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS, [
      ['templates/', 'contrast clause — the forms directory, not a records file'],
    ]),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': mdWithContrast,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /1 paragraph exemption\(s\)/);
});

test('enforcement: a paragraph exemption without a reason fails closed — a reasonless exemption is a suppression', () => {
  const mdWithContrast = CLAUDE_MD.replace(
    '\n\n## Something else\n',
    ` The blank forms live in ${BT}templates/${BT}.\n\n## Something else\n`,
  );
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS, [['templates/', '']]),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': mdWithContrast,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /ERROR/);
  assert.match(out, /no reason/);
});

test('enforcement: records paths at ask clear — the recorded per-repo downgrade', () => {
  // ask is a human checkpoint interactively and auto-rejects headless
  // (demonstrated 2026-08-08, both harnesses) — the lint accepts it for records.
  const claudeAsk = CLAUDE_CFG.replace(
    '"deny": [\n      "Edit(docs/pdr/**)",\n      "Edit(docs/code-conventions.md)",\n',
    '"deny": [\n',
  ).replace(
    '    ]\n  }\n}',
    '    ],\n    "ask": [\n      "Edit(docs/pdr/**)",\n      "Edit(docs/code-conventions.md)"\n    ]\n  }\n}',
  );
  const ocCfg = JSON.parse(OPENCODE_CFG.replace(/^\s*\/\/.*$/gm, ''));
  ocCfg.permission.edit['docs/pdr/**'] = 'ask';
  ocCfg.permission.edit['docs/code-conventions.md'] = 'ask';
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': claudeAsk,
    'opencode.json': '// governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08\n' + JSON.stringify(ocCfg, null, 2),
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK: every registered harness/);
});

test('enforcement: secrets at ask is a blocking MISSING-RULE — secrets never run at ask', () => {
  const ocCfg = JSON.parse(OPENCODE_CFG.replace(/^\s*\/\/.*$/gm, ''));
  ocCfg.permission.read['.env'] = 'ask';
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': '// governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08\n' + JSON.stringify(ocCfg, null, 2),
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISSING-RULE/);
  assert.match(out, /secrets never run at ask/);
});

test('enforcement: records at ask listed before the catch-all is still NOT-BINDING', () => {
  const ocCfg = JSON.parse(OPENCODE_CFG.replace(/^\s*\/\/.*$/gm, ''));
  const edit = ocCfg.permission.edit;
  const reordered = { 'docs/pdr/**': 'ask', '*': 'allow' };
  for (const k of Object.keys(edit)) if (k !== '*' && k !== 'docs/pdr/**') reordered[k] = edit[k];
  ocCfg.permission.edit = reordered;
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': '// governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08\n' + JSON.stringify(ocCfg, null, 2),
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOT-BINDING/);
  assert.match(out, /docs\/pdr\/\*\*/);
});

test('enforcement: no records paragraph is a loud SKIPPED, never a silent pass', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED: no CLAUDE.md\/AGENTS.md records-files paragraph/);
  assert.match(out, /completeness SKIPPED/);
});

test('enforcement: an unparseable config is a blocking MALFORMED', () => {
  const dir = fixture({
    'docs/enforcement-stanzas-register.md': register(BOTH, PATHS),
    '.claude/settings.json': '{ not json',
    'opencode.json': OPENCODE_CFG,
    'CLAUDE.md': CLAUDE_MD,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MALFORMED/);
});

test('enforcement: a missing register fails closed, never passes', () => {
  const dir = fixture({
    '.claude/settings.json': CLAUDE_CFG,
    'opencode.json': OPENCODE_CFG,
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /ERROR/);
  assert.match(out, /register not found/);
  assert.doesNotMatch(out, /^OK:/m);
});

test('enforcement: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/check-enforcement-stanzas.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/check-enforcement-stanzas.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});
