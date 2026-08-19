// Fixture tests for scripts/census-record-sections.mjs (template, self-installed).
//
// Same rule as the lint fixtures: fire on a known-bad input, clear on a
// known-good one. The census is report-only (exit 0 always), so the
// assertions pin the REPORT — buckets, the P0 flag, scaffold collisions, and
// the installed-version warning. The byte-identical self-install assertion
// rides at the bottom, same as write-record.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO, 'scripts/census-record-sections.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-census-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd) {
  const out = execFileSync('node', [SCRIPT], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
}

const ADR_README = '# Architecture Decision Records\n\n';

const bareRecord = (status = 'Accepted') => `# ADR-001: Bare

**Status:** ${status}
**Date:** 2026-08-01

---

## Context

c

## Decision

d

## Enforcement

scripts/x.mjs

## Consequences

c
`;

/** The known-bad corpus: one record per finding class. */
function badCorpus() {
  return {
    'docs/adr/README.md': ADR_README,
    // bucket C control
    'docs/adr/001-bare.md': bareRecord(),
    // bucket A — variant headings, content present
    'docs/adr/002-variant.md': `# ADR-002: Variant

**Status:** Accepted
**Date:** 2026-08-01

---

## Context

c

## Decision 1: Storage backend

d

## Enforcement (ships with the decision, per ADR-022)

scripts/x.mjs

## Consequences

c
`,
    // bucket B — genuinely missing Consequences
    'docs/adr/003-blocked.md': `# ADR-003: Blocked

**Status:** Accepted
**Date:** 2026-08-01

---

## Context

c

## Decision

d

## Enforcement

scripts/x.mjs
`,
    // P0 — exact Decision AND a variant sibling
    'docs/adr/004-p0.md': `# ADR-004: P0

**Status:** Accepted
**Date:** 2026-08-01

---

## Context

c

## Decision

d

## Decision 2: a later split

d2

## Enforcement

scripts/x.mjs

## Consequences

c
`,
    // scaffold collision — YYYY-MM-DD in prose (ai-fleet ADR-009's shape)
    'docs/adr/005-cron.md': bareRecord().replace('## Consequences\n\nc\n', '## Consequences\n\nCron keys read `scheduler:<slug>:<YYYY-MM-DDTHH:mm>`.\n').replace('# ADR-001: Bare', '# ADR-005: Cron'),
    // status parse failure — a paragraph where the value belongs
    'docs/adr/006-status.md': bareRecord('**Split — read the per-section status, not one banner.**').replace('# ADR-001: Bare', '# ADR-006: Status'),
    // installed write-record is pre-1.3.0 → the WARNING must fire
    'host/scripts/write-record.mjs': '// template: scripts/write-record.mjs v1.0.0 · updated 2026-08-13\n',
  };
}

test('census: the known-bad corpus reports every class — buckets, variants, P0, scaffold, status', () => {
  const out = run(fixture(badCorpus()));
  assert.match(out, /== adr corpus: docs\/adr\/ — 6 record\(s\) ==/);
  assert.match(out, /Bucket C[^\n]*: 3/); // 001, 004, 005 — bare sections + parseable status
  assert.match(out, /Bucket A[^\n]*: 1/); // 002-variant — sections complete via normalization
  assert.match(out, /Bucket B[^\n]*: 1/);
  assert.match(out, /003: missing Consequences/);
  assert.match(out, /1× {2}## Decision 1: Storage backend/);
  assert.match(out, /1× {2}## Enforcement \(ships with the decision, per ADR-022\)/);
  assert.match(out, /P0[^\n]*: 1/);
  assert.match(out, /004-p0\.md: ## Decision — 1 exact of 2 matching/);
  assert.match(out, /005-cron\.md: "YYYY-MM-DD" on line\(s\) \d+/);
  assert.match(out, /Status parse failures[^\n]*: 1/);
  assert.match(out, /006-status\.md: Status reads/);
  assert.match(out, /WARNING — installed write-record is <1\.3\.0/);
});

test('census: the known-good corpus clears — all bucket C, zero findings', () => {
  const out = run(
    fixture({
      'docs/adr/README.md': ADR_README,
      'docs/adr/001-bare.md': bareRecord(),
      'scripts/write-record.mjs': '// template: scripts/write-record.mjs v1.3.0 · updated 2026-08-19\n',
    }),
  );
  assert.match(out, /write-record: v1\.3\.0 installed/);
  assert.doesNotMatch(out, /WARNING/);
  assert.match(out, /Bucket C[^\n]*: 1/);
  assert.match(out, /Bucket A[^\n]*: 0/);
  assert.match(out, /Bucket B[^\n]*: 0/);
  assert.match(out, /P0[^\n]*: 0/);
  assert.match(out, /Scaffold-marker collisions in prose: 0/);
  assert.match(out, /Status parse failures[^\n]*: 0/);
});

test('census: a Superseded record without ## Enforcement is bucket C, not B (Q2 exemption)', () => {
  const out = run(
    fixture({
      'docs/adr/README.md': ADR_README,
      'docs/adr/001-first.md': bareRecord(),
      'docs/adr/002-old.md': bareRecord('Superseded by ADR-001')
        .replace('# ADR-001: Bare', '# ADR-002: Old')
        .replace(/\n## Enforcement\n\nscripts\/x\.mjs\n/, '\n'),
      'scripts/write-record.mjs': '// template: scripts/write-record.mjs v1.3.0 · updated 2026-08-19\n',
    }),
  );
  assert.match(out, /Bucket C[^\n]*: 2/);
  assert.match(out, /Bucket B[^\n]*: 0/);
});

test('census: no recognizable corpus is reported, not failed — the register rows may be wrong', () => {
  const out = run(fixture({ 'README.md': '# nothing here\n' }));
  assert.match(out, /== adr corpus: none found/);
  assert.match(out, /== pdr corpus: none found/);
  assert.match(out, /no recognizable corpus in this repo/);
  assert.match(out, /write-record: NOT INSTALLED/);
});

test('census-record-sections: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/census-record-sections.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/census-record-sections.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});
