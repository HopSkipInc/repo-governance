// Fixture tests for scripts/check-downstream-drift.mjs (repo-governance's own lint).
//
// Same rule as lints.test.mjs and lens.test.mjs: fire on a known-bad input, clear
// on a known-good one. The fixtures are a throwaway repo tree per case — the
// script resolves everything from `git rev-parse --show-toplevel`, so a git-init'd
// tmpdir with templates/, downstream/<client>/_client.md, and fake client
// checkouts at absolute paths exercises the real resolution paths, including both
// declared-path dialects live in the field (repo-relative and template-relative).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const DRIFT = resolve(REPO, 'scripts/check-downstream-drift.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-drift-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd, env = {}) {
  try {
    const out = execFileSync('node', [DRIFT], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// ------------------------------------------------------------- fixture pieces

const mdStamp = (name, v) => `<!-- template: ${name} v${v} · updated 2026-08-02 -->\n# ${name}\n`;
const fm = (v) => `---\nname: fixture\nversion: ${v}\nupdated: 2026-08-02\n---\n`;

/** A minimal templates/ tree: everything the fixture declarations resolve against. */
const templateTree = {
  'templates/agent-routing.md': mdStamp('agent-routing.md', '2.0.0'),
  'templates/skills/routing-triage/SKILL.md': fm('2.0.0'),
  'templates/agents/routing-classifier.opencode.md': fm('2.0.0'),
  'templates/governance-sync-claude-section.md': mdStamp('governance-sync-claude-section.md', '2.0.0'),
};

/** The ledger needs the fixture's absolute path, so it is written after fixture(). */
function addLedger(dir, rows) {
  mkdirSync(join(dir, 'downstream/acme'), { recursive: true });
  writeFileSync(
    join(dir, 'downstream/acme/_client.md'),
    '# Client\n\n| Repo | Local path | Notes |\n|---|---|---|\n' +
      rows.map(([repo, path]) => `| ${repo} | \`${path}\` | — |`).join('\n') + '\n'
  );
}

/** A client CLAUDE.md whose Synced templates table carries the given rows. */
const claudeMd = (rows) =>
  '# Client repo\n\n### Synced templates\n\n| Template | Installed version | Synced on |\n|---|---|---|\n' +
  rows.map(([p, v]) => `| ${p} | ${v} | 2026-08-02 |`).join('\n') + '\n';

/** Fixture with one governed repo whose CLAUDE.md declares `rows`; `extra` adds files. */
function repoFixture(rows, extra = {}) {
  const dir = fixture({
    ...templateTree,
    'clones/repo-a/CLAUDE.md': claudeMd(rows),
    ...extra,
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  return dir;
}

// ------------------------------------------------------------------- dialects

test('drift: repo-relative dialect resolves and a fully synced repo clears', () => {
  const dir = repoFixture(
    [['`docs/agent-routing.md`', 'v2.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '2.0.0') }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: template-relative dialects resolve to their install locations', () => {
  const dir = repoFixture(
    [
      ['agent-routing.md', '2.0.0'], // bare name -> docs/
      ['routing-triage/SKILL.md', '2.0.0'], // bare subpath -> .claude/skills/
    ],
    {
      'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '2.0.0'),
      'clones/repo-a/.claude/skills/routing-triage/SKILL.md': fm('2.0.0'),
    }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: parenthetical annotations and the opencode global install resolve', () => {
  const dir = repoFixture([['routing-classifier.opencode.md (opencode)', '2.0.0']]);
  // Mirrors the real install (~/.config/opencode/agents/) — the path must carry
  // '/agents/' because the script's frontmatter heuristic keys on it.
  const agentsDir = join(dir, 'opencode/agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, 'routing-classifier.md'), fm('2.0.0'));
  const { code, out } = run(dir, { OPENCODE_AGENTS_DIR: agentsDir });
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

// ------------------------------------------------------------------ findings

test('drift: true MISMATCH fires when the installed stamp disagrees with the declaration', () => {
  const dir = repoFixture(
    [['agent-routing.md', '2.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '1.0.0') }
  );
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /stamps v1\.0\.0/);
});

test('drift: MISMATCH fires when nothing resolves under either dialect', () => {
  const dir = repoFixture([['agent-routing.md', '2.0.0']]);
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /no file resolves under either declaration dialect/);
});

test('drift: NOSTAMP fires on an unstamped declared file and blocks', () => {
  const dir = repoFixture(
    [['agent-routing.md', '2.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': '# Agent Routing\n\nNo stamp anywhere.\n' }
  );
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOSTAMP/);
  assert.match(out, /carries no readable version stamp/);
});

test('drift: a section-installed template can only report NOSTAMP — a section carries no stamp', () => {
  const dir = repoFixture([['governance-sync-claude-section.md', '2.0.0']]);
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOSTAMP/);
  assert.match(out, /installed as a CLAUDE\.md section/);
  assert.doesNotMatch(out, /^MISMATCH \(/m);
});

test('drift: a section with an inline stamp verifies like a file (canonical since template v1.2.0)', () => {
  const dir = fixture({
    ...templateTree,
    'clones/repo-a/CLAUDE.md':
      '# Client repo\n\n## Governance\n\n<!-- template: governance-sync-claude-section.md v2.0.0 · updated 2026-08-02 -->\n\n' +
      claudeMd([['governance-sync-claude-section.md', '2.0.0']]),
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: a section whose inline stamp disagrees with the declaration reports MISMATCH', () => {
  const dir = fixture({
    ...templateTree,
    'clones/repo-a/CLAUDE.md':
      '# Client repo\n\n## Governance\n\n<!-- template: governance-sync-claude-section.md v1.0.0 · updated 2026-07-24 -->\n\n' +
      claudeMd([['governance-sync-claude-section.md', '2.0.0']]),
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /installed CLAUDE\.md section stamps v1\.0\.0/);
});

test('drift: the canonical global declaration (~/.config/opencode/agents/...) resolves', () => {
  const dir = repoFixture([['`~/.config/opencode/agents/routing-classifier.md`', 'v2.0.0']]);
  const agentsDir = join(dir, 'opencode/agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, 'routing-classifier.md'), fm('2.0.0'));
  const { code, out } = run(dir, { OPENCODE_AGENTS_DIR: agentsDir });
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: BEHIND reports but does not block', () => {
  const dir = repoFixture(
    [['agent-routing.md', '1.0.0']],
    { 'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '1.0.0') }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /BEHIND/);
  assert.match(out, /template is v2\.0\.0/);
});

test('drift: UNDECLARED fires on governance artifacts with no Synced templates table', () => {
  const dir = fixture({
    ...templateTree,
    'clones/repo-a/CLAUDE.md': '# Client repo with no declaration section\n',
    'clones/repo-a/docs/agent-routing.md': mdStamp('agent-routing.md', '2.0.0'),
  });
  addLedger(dir, [['acme/repo-a', join(dir, 'clones/repo-a')]]);
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /UNDECLARED/);
});

test('drift: SKIPPED — never OK — when no governed repo is reachable', () => {
  const dir = fixture({
    ...templateTree,
    'downstream/acme/_client.md':
      '# Client\n\n| Repo | Local path | Notes |\n|---|---|---|\n| acme/repo-a | `/nonexistent/path/repo-a` | — |\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /SKIPPED/);
  assert.doesNotMatch(out, /^OK:/m);
});

// ------------------------------------------- stanza installs and lint homes (#67)
//
// The 2026-08-09 estate-wide false positive: a repo applies the enforcement-stanzas
// prompt exactly as written, declares the two rows, and the lint reports MISMATCH
// because a stanza merges into the harness config and resolves to no file. Stanzas
// verify against the config's governance-install stamp instead. The stamp regex
// matches the `//` comment form and the strict-JSON `_governance_install` key form.

const STANZA_TEMPLATES = {
  'templates/harness-enforcement.md': mdStamp('harness-enforcement.md', '1.0.0'),
  'templates/harness-enforcement.opencode.md': mdStamp('harness-enforcement.opencode.md', '1.0.0'),
};
const settingsWithStamp = (v) =>
  `{\n  // governance-install: harness-enforcement.md v${v} · updated 2026-08-08\n  "permissions": { "deny": ["Read(**/.env)"] }\n}\n`;
const opencodeWithStamp = (v) =>
  `{\n  // governance-install: harness-enforcement.opencode.md v${v} · updated 2026-08-08\n  "permission": { "edit": { "**/.env": "deny" } }\n}\n`;
const scriptStamp = (name, v) => `#!/usr/bin/env node\n# template: ${name} v${v} · updated 2026-08-08\n`;

test('drift: a stanza install verifies against the config stamp, not a phantom file path', () => {
  const dir = repoFixture(
    [['harness-enforcement.md', '1.0.0'], ['harness-enforcement.opencode.md', '1.0.0']],
    {
      ...STANZA_TEMPLATES,
      'clones/repo-a/.claude/settings.json': settingsWithStamp('1.0.0'),
      'clones/repo-a/opencode.json': opencodeWithStamp('1.0.0'),
    }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: the strict-JSON _governance_install key form verifies', () => {
  const dir = repoFixture([['harness-enforcement.md', '1.0.0']], {
    ...STANZA_TEMPLATES,
    'clones/repo-a/.claude/settings.json':
      '{ "_governance_install": "governance-install: harness-enforcement.md v1.0.0 · updated 2026-08-08", "permissions": { "deny": [] } }\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: a declared stanza whose config file does not exist reports MISMATCH', () => {
  const dir = repoFixture([['harness-enforcement.md', '1.0.0']], { ...STANZA_TEMPLATES });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /\.claude\/settings\.json does not exist/);
});

test('drift: a config without the governance-install stamp reports NOSTAMP, not MISMATCH', () => {
  // The config exists — something is installed there — but the declaration cannot
  // be verified. Severity split mirrors the file case: unverifiable, not wrong.
  const dir = repoFixture([['harness-enforcement.md', '1.0.0']], {
    ...STANZA_TEMPLATES,
    'clones/repo-a/.claude/settings.json': '{ "permissions": { "deny": ["Read(**/.env)"] } }\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOSTAMP/);
  assert.match(out, /governance-install/);
  assert.doesNotMatch(out, /^MISMATCH \(/m);
});

test('drift: a stanza stamp that disagrees with the declaration reports MISMATCH', () => {
  const dir = repoFixture([['harness-enforcement.md', '1.0.0']], {
    ...STANZA_TEMPLATES,
    'clones/repo-a/.claude/settings.json': settingsWithStamp('0.9.0'),
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /MISMATCH/);
  assert.match(out, /stanza stamps v0\.9\.0/);
});

test('drift: a stanza stamped below the template version reports BEHIND without blocking', () => {
  const dir = repoFixture([['harness-enforcement.opencode.md', '1.0.0']], {
    'templates/harness-enforcement.opencode.md': mdStamp('harness-enforcement.opencode.md', '2.0.0'),
    'clones/repo-a/opencode.json': opencodeWithStamp('1.0.0'),
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /BEHIND/);
  assert.match(out, /template is v2\.0\.0/);
});

test('drift: the wrong variant stamp in a config does not satisfy the other variant', () => {
  // settings.json carrying the *opencode* stamp must not verify the claude row —
  // the per-config map scopes detection, and the regex anchors the full key.
  const dir = repoFixture([['harness-enforcement.md', '1.0.0']], {
    ...STANZA_TEMPLATES,
    'clones/repo-a/.claude/settings.json':
      '{ "_governance_install": "governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08", "permissions": { "deny": [] } }\n',
  });
  const { code, out } = run(dir);
  assert.equal(code, 1, out);
  assert.match(out, /NOSTAMP/);
});

test('drift: a lint installed at tools/ resolves and verifies', () => {
  const dir = repoFixture(
    [['`tools/check-enforcement-stanzas.mjs`', 'v1.0.0']],
    {
      'templates/scripts/check-enforcement-stanzas.mjs': scriptStamp('scripts/check-enforcement-stanzas.mjs', '1.0.0'),
      'clones/repo-a/tools/check-enforcement-stanzas.mjs': scriptStamp('scripts/check-enforcement-stanzas.mjs', '1.0.0'),
    }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: a lint installed at host/scripts/ resolves and verifies', () => {
  const dir = repoFixture(
    [['`host/scripts/check-enforcement-stanzas.mjs`', 'v1.0.0']],
    {
      'templates/scripts/check-enforcement-stanzas.mjs': scriptStamp('scripts/check-enforcement-stanzas.mjs', '1.0.0'),
      'clones/repo-a/host/scripts/check-enforcement-stanzas.mjs': scriptStamp('scripts/check-enforcement-stanzas.mjs', '1.0.0'),
    }
  );
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
});

test('drift: a declaration under an unlisted prefix is a local artifact — skipped deliberately', () => {
  // The remaining skip, pinned as deliberate: an unlisted prefix resolves to no
  // template key and produces no finding. If a new lint home appears in the
  // field, the fix is a PREFIXES entry, not a tolerated false green.
  const dir = repoFixture([['`local/check-thing.mjs`', 'v1.0.0']], {
    'clones/repo-a/local/check-thing.mjs': scriptStamp('scripts/check-thing.mjs', '1.0.0'),
  });
  const { code, out } = run(dir);
  assert.equal(code, 0, out);
  assert.match(out, /OK:/);
  assert.doesNotMatch(out, /check-thing/);
});
