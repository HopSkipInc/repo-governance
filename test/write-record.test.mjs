// Fixture tests for scripts/write-record.mjs (template, self-installed).
//
// Same rule as the lint fixtures: fire on a known-bad input, clear on a
// known-good one. The cases pin the three properties issue #81's design rests
// on — append-only creation with allocated numbering, the amend section guard
// (Context/Decision immutable, everything else free), and the README guard
// (rows editable, deletions refused, prose untouchable). The byte-identical
// self-install assertion rides at the bottom, same as enforcement-stanzas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const SCRIPT = resolve(REPO, 'scripts/write-record.mjs');

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'repo-gov-write-record-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

function run(cwd, args) {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const TODAY = new Date().toISOString().slice(0, 10);

const ADR_README =
  '# Architecture Decision Records\n\nEvery file in this directory must appear in the table below.\n\n' +
  '| # | Title | Status | Enforcement |\n|---|-------|--------|-------------|\n';

const PDR_README =
  '# Product Decision Records\n\nEvery file in this directory must appear in the table below.\n\n' +
  '| # | Title | Status | Last confirmed |\n|---|-------|--------|----------------|\n';

/** A valid ADR draft body (number placeholder in the H1 — create allocates). */
const adrDraft = (over = {}) =>
  over.body ??
  `# ADR-NNN: ${over.title ?? 'All DB access through the repository layer'}

**Status:** ${over.status ?? 'Proposed'}
**Date:** YYYY-MM-DD

---

## Context

${over.context ?? 'Module B queried the DB directly and a tenant filter was missed once. Discovered pattern everywhere else.'}

## Decision

All database access goes through src/repositories/. No route handler imports a DB driver.

## Enforcement

${over.enforcement ?? 'not yet built — tracking issue #99'}

## Consequences

Module B gets rewritten; new repos ship with the lint on day one.

## References

- #99
`;

const pdrDraft = (over = {}) =>
  over.body ??
  `# PDR-NNN: ${over.title ?? 'We serve solo operators'}

**Status:** ${over.status ?? 'Proposed'}
**Date:** YYYY-MM-DD
**Confirmed by:** Greg
**Last confirmed:** YYYY-MM-DD

---

## Context

Four of six onboarding calls in May were solo operators doing their own books.

## Decision

We serve solo operators billing under $500k who do their own books.

## Falsifier

- [ ] ${over.falsifier ?? 'Revisit by 2027-06-01 when the pilot cohort renews or churns'}

## Consequences

No agency features this year.
`;

// --------------------------------------------------------------------- create

test('create: ADR happy path — number allocated, H1 rewritten, README row registered', () => {
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': adrDraft() });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  const written = readFileSync(join(dir, 'docs/adr/001-all-db-access-through-the-repository-layer.md'), 'utf8');
  assert.match(written, /^# ADR-001: All DB access through the repository layer$/m);
  assert.match(written, new RegExp(`\\*\\*Date:\\*\\* ${TODAY}`));
  assert.doesNotMatch(written, /YYYY-MM-DD/);
  const readme = readFileSync(join(dir, 'docs/adr/README.md'), 'utf8');
  assert.match(readme, /\| \[001\]\(001-all-db-access-through-the-repository-layer\.md\) \| All DB access through the repository layer \| Proposed \| not yet built — tracking issue #99 \|/);
  assert.match(out, /UNGUARDED/); // no lints in the fixture — said out loud, not a failure
  assert.match(out, /OK: ADR-001 published/);
});

test('create: allocation is max+1 over files and README links — gaps are never reclaimed', () => {
  const dir = fixture({
    'docs/adr/README.md': ADR_README + '| [001](001-first.md) | First | Retired | n/a |\n| [003](003-third.md) | Third | Accepted | a lint |\n',
    'docs/adr/001-first.md': '# ADR-001: First\n',
    'docs/adr/003-third.md': '# ADR-003: Third\n',
    'draft.md': adrDraft(),
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  assert.ok(existsSync(join(dir, 'docs/adr/004-all-db-access-through-the-repository-layer.md')), out);
  assert.equal(readFileSync(join(dir, 'docs/adr/001-first.md'), 'utf8'), '# ADR-001: First\n'); // untouched
});

test('create: refuses a missing Enforcement section', () => {
  const body = adrDraft().replace(/## Enforcement[\s\S]*?(?=## Consequences)/, '');
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': body });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /missing required section: ## Enforcement/);
  assert.equal(readdirSync(join(dir, 'docs/adr')).filter((f) => /^\d{3}-/.test(f)).length, 0);
});

test('create: refuses Accepted with "not yet built" enforcement — that phrase is the Proposed marker', () => {
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': adrDraft({ status: 'Accepted' }) });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /Accepted.*not yet built|not yet built.*Accepted/i);
});

test('create: refuses template scaffold markers — the day-one-red class of bug', () => {
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': adrDraft({ title: '<Title>' }) });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /placeholder/i);
});

test('create: PDR Accepted without a falsifier is refused (R1 mirrored)', () => {
  const body = pdrDraft({ status: 'Accepted' }).replace(/## Falsifier[\s\S]*?(?=## Consequences)/, '');
  const dir = fixture({ 'docs/pdr/README.md': PDR_README, 'draft.md': body });
  const { code, out } = run(dir, ['create', 'pdr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /falsifier/i);
});

test('create: PDR Accepted with a vague falsifier is refused (R2 mirrored)', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README,
    'draft.md': pdrDraft({ status: 'Accepted', falsifier: 'Revisit later when appropriate' }),
  });
  const { code, out } = run(dir, ['create', 'pdr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /phrasing the form rules out/);
});

test('create: PDR happy path — Confirmed by required, Last confirmed filled, README row dated', () => {
  const dir = fixture({ 'docs/pdr/README.md': PDR_README, 'draft.md': pdrDraft({ status: 'Accepted' }) });
  const { code, out } = run(dir, ['create', 'pdr', 'draft.md']);
  assert.equal(code, 0, out);
  const readme = readFileSync(join(dir, 'docs/pdr/README.md'), 'utf8');
  assert.match(readme, new RegExp(`\\| \\[001\\]\\(001-we-serve-solo-operators\\.md\\) \\| We serve solo operators \\| Accepted \\| ${TODAY} \\|`));
});

test('create: PDR without a real Confirmed by is refused — someone signs', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README,
    'draft.md': pdrDraft().replace('**Confirmed by:** Greg', '**Confirmed by:** <the person whose call this actually is>'),
  });
  const { code, out } = run(dir, ['create', 'pdr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /Confirmed by/);
});

test('create: ADR requires a Lens line when the repo runs design-lenses', () => {
  const dir = fixture({
    'docs/adr/README.md': ADR_README,
    'docs/design-lenses.md': '# Design Lenses\n',
    'draft.md': adrDraft(),
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /\*\*Lens:\*\*/);
});

test('create: mints the corpus and a minimal README on true bootstrap, saying so out loud', () => {
  const dir = fixture({ 'draft.md': adrDraft() });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  assert.match(out, /no ADR corpus found — created docs\/adr\//);
  assert.match(out, /minted a minimal docs\/adr\/README\.md/);
  assert.ok(existsSync(join(dir, 'docs/adr/001-all-db-access-through-the-repository-layer.md')));
});

test('create: a post-write lint failure is a nonzero exit with the tree left standing', () => {
  const dir = fixture({
    'docs/adr/README.md': ADR_README,
    'scripts/check-adr-readme-sync.mjs': 'process.exit(1)',
    'draft.md': adrDraft(),
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /post-write lint check-adr-readme-sync\.mjs is red/);
  assert.ok(existsSync(join(dir, 'docs/adr/001-all-db-access-through-the-repository-layer.md'))); // left standing
});

// --------------------------------------------------------------------- amend

/** An existing record on disk, then a revised version to amend in. The Date
 *  placeholder is filled — a revised file is re-validated, and a scaffold
 *  marker in it is a refusal. */
function amendableCorpus(over = {}) {
  const existing = adrDraft({ title: 'Repository layer for all DB access', status: 'Proposed' })
    .replace('# ADR-NNN:', '# ADR-001:')
    .replace('**Date:** YYYY-MM-DD', '**Date:** 2026-08-01');
  return {
    'docs/adr/README.md':
      ADR_README + '| [001](001-repository-layer-for-all-db-access.md) | Repository layer for all DB access | Proposed | not yet built — tracking issue #99 |\n',
    'docs/adr/001-repository-layer-for-all-db-access.md': existing,
    'revised.md': over.revised ?? existing.replace('**Status:** Proposed', '**Status:** Accepted').replace(
      'not yet built — tracking issue #99',
      'scripts/check-repository-pattern.mjs, wired into npm run check',
    ),
  };
}

test('amend: status flip lands and the README Status cell follows', () => {
  const dir = fixture(amendableCorpus());
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(readFileSync(join(dir, 'docs/adr/001-repository-layer-for-all-db-access.md'), 'utf8'), /\*\*Status:\*\* Accepted/);
  const readme = readFileSync(join(dir, 'docs/adr/README.md'), 'utf8');
  assert.match(readme, /\| Repository layer for all DB access \| Accepted \|/);
  assert.match(out, /README row synced \(Status → Accepted\)/);
});

test('amend: a flip to Accepted over a placeholder README Enforcement cell is named loudly', () => {
  // The Enforcement cell is curated — the script warns instead of writing it.
  // The README's own convention ("tracking issue #N" ⇒ Proposed) makes the
  // stale cell legible; the warning is what keeps the row honest.
  const dir = fixture(amendableCorpus());
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(out, /WARNING — the README Enforcement cell still reads/);
  assert.match(out, /amend adr readme/);
});

/** A corpus whose record is already Accepted — the state the section guard
 *  exists for. The Enforcement section reads as wired because validate()
 *  refuses Accepted over "not yet built". */
function acceptedCorpus() {
  const existing = adrDraft({ title: 'Repository layer for all DB access', status: 'Accepted' })
    .replace('# ADR-NNN:', '# ADR-001:')
    .replace('**Date:** YYYY-MM-DD', '**Date:** 2026-08-01')
    .replace('not yet built — tracking issue #99', 'scripts/check-repository-pattern.mjs, wired into npm run check');
  return {
    'docs/adr/README.md':
      ADR_README + '| [001](001-repository-layer-for-all-db-access.md) | Repository layer for all DB access | Accepted | scripts/check-repository-pattern.mjs |\n',
    'docs/adr/001-repository-layer-for-all-db-access.md': existing,
    'revised.md': existing,
  };
}

test('amend: a Decision change on a confirmed record is refused, by name, with the supersession path', () => {
  const files = acceptedCorpus();
  files['revised.md'] = files['revised.md'].replace(
    'All database access goes through src/repositories/.',
    'Route handlers may import the DB driver directly.',
  );
  const dir = fixture(files);
  const before = readFileSync(join(dir, 'docs/adr/001-repository-layer-for-all-db-access.md'), 'utf8');
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Decision changed/);
  assert.match(out, /Superseded by ADR-NNN/);
  assert.equal(readFileSync(join(dir, 'docs/adr/001-repository-layer-for-all-db-access.md'), 'utf8'), before);
});

test('amend: a Context change on a confirmed record is refused — a new rationale for the same decision is a new decision', () => {
  const files = acceptedCorpus();
  files['revised.md'] = files['revised.md'].replace('Module B queried the DB directly', 'Actually, the real reason is different');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Context changed/);
});

// --------------------------- 2026-08-18: pre-confirmation revision mode (issue #88)
// The guard cannot distinguish revising an unsigned draft from rewriting
// history; 1.0.0 fired on both, and PDR-010's pre-signature fix had to route
// around the script. These fixtures pin the mode in both directions: the draft
// path lands, and every confirmed/locked path still refuses.

/** A Proposed ADR (pre-confirmation — ADRs carry no Confirmed-by). */
function proposedAdrCorpus(decisionEdit) {
  const files = amendableCorpus();
  if (decisionEdit) {
    files['revised.md'] = files['revised.md'].replace(
      'All database access goes through src/repositories/.',
      'All database access goes through src/repositories/; read-replicas are explicitly in scope.',
    );
    // amendableCorpus's revised also flips Status to Accepted — keep the
    // revised file Proposed so this is a pure draft revision.
    files['revised.md'] = files['revised.md'].replace('**Status:** Accepted', '**Status:** Proposed');
  }
  return files;
}

test('amend (88): a Proposed ADR draft accepts a Decision revision', () => {
  const dir = fixture(proposedAdrCorpus(true));
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(out, /unsigned-draft rule/);
  assert.match(readFileSync(join(dir, 'docs/adr/001-repository-layer-for-all-db-access.md'), 'utf8'), /read-replicas are explicitly in scope/);
});

test('amend (88): the flip to Accepted carrying a Decision edit is refused — the confirmation amend cannot smuggle the lock past itself', () => {
  const files = amendableCorpus(); // Proposed on disk; revised flips Accepted
  files['revised.md'] = files['revised.md'].replace(
    'All database access goes through src/repositories/.',
    'Route handlers may import the DB driver directly.',
  );
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Decision changed in the same amend that confirms the record/);
  assert.match(out, /Land the revision while the draft is unsigned/);
});

/** A Proposed, UNCONFIRMED PDR — the observed live dialect of the unsigned
 *  draft (PDR-010, 2026-08-14): `Confirmed by: — (drafted for …; unconfirmed)`. */
function unsignedPdrCorpus({ confirmer = '— (drafted for Greg; unconfirmed)', status = 'Proposed', decisionEdit = false } = {}) {
  const existing = pdrDraft({ title: 'We serve solo operators', status })
    .replace('# PDR-NNN:', '# PDR-001:')
    .replaceAll('YYYY-MM-DD', '2026-01-01')
    .replace('**Confirmed by:** Greg', `**Confirmed by:** ${confirmer}`)
    .replace('**Last confirmed:** 2026-01-01', '**Last confirmed:** —');
  let revised = existing;
  if (decisionEdit) {
    revised = revised.replace(
      'We serve solo operators billing under $500k who do their own books.',
      'We serve solo operators billing under $500k; harness version re-keys the estimation bucket.',
    );
  }
  return {
    'docs/pdr/README.md':
      PDR_README + '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Proposed | — |\n',
    'docs/pdr/001-we-serve-solo-operators.md': existing,
    'revised.md': revised,
  };
}

test('amend (88): a Proposed-unconfirmed PDR accepts a Decision revision, and README sync still runs', () => {
  // The PDR-010 case: the draft's Decision hadn't said whether harness version
  // re-keys the bucket, and a downstream ADR was about to rest on it.
  const dir = fixture(unsignedPdrCorpus({ decisionEdit: true }));
  const { code, out } = run(dir, ['amend', 'pdr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(out, /unsigned-draft rule/);
  assert.match(readFileSync(join(dir, 'docs/pdr/001-we-serve-solo-operators.md'), 'utf8'), /harness version re-keys/);
});

test('amend (88): an Accepted PDR still refuses the Decision edit', () => {
  const dir = fixture(unsignedPdrCorpus({ status: 'Accepted', confirmer: 'Greg', decisionEdit: true })
  );
  // Accepted requires a falsifier that passes validation — the draft has one.
  const { code, out } = run(dir, ['amend', 'pdr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Decision changed\./);
  assert.match(out, /Superseded by PDR-NNN/);
});

test('amend (88): a Proposed PDR WITH a confirmer is contradictory — locked, refused by name', () => {
  const dir = fixture(unsignedPdrCorpus({ confirmer: 'Greg', decisionEdit: true }));
  const { code, out } = run(dir, ['amend', 'pdr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /Proposed but SIGNED/);
  assert.match(out, /contradictory/);
});

test('amend (88): a PDR confirmation flip carrying a Decision edit is refused', () => {
  const files = unsignedPdrCorpus({ decisionEdit: true });
  files['revised.md'] = files['revised.md']
    .replace('**Status:** Proposed', '**Status:** Accepted')
    .replace('**Confirmed by:** — (drafted for Greg; unconfirmed)', '**Confirmed by:** Greg')
    .replace('**Last confirmed:** —', `**Last confirmed:** ${TODAY}`);
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'pdr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /in the same amend that confirms the record/);
});

test('amend (88): the PDR signing amend itself lands when sections are untouched', () => {
  // The paired half: confirm an unsigned draft with Context/Decision
  // byte-identical — Status, Confirmed by, Last confirmed all move, README
  // follows.
  const files = unsignedPdrCorpus();
  files['revised.md'] = files['revised.md']
    .replace('**Status:** Proposed', '**Status:** Accepted')
    .replace('**Confirmed by:** — (drafted for Greg; unconfirmed)', '**Confirmed by:** Greg')
    .replace('**Last confirmed:** —', `**Last confirmed:** ${TODAY}`);
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'pdr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  const readme = readFileSync(join(dir, 'docs/pdr/README.md'), 'utf8');
  assert.match(readme, /\| Accepted \|/);
});

test('amend: the H1 number is identity — a renumbering is refused', () => {
  const files = amendableCorpus();
  files['revised.md'] = files['revised.md'].replace('# ADR-001:', '# ADR-002:');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /number cannot change/);
});

test('amend: supersession requires the cited record to exist', () => {
  const files = amendableCorpus();
  const pristine = files['docs/adr/001-repository-layer-for-all-db-access.md'];
  files['revised.md'] = pristine.replace('**Status:** Proposed', '**Status:** Superseded by ADR-009');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /no 009-\*\.md exists/);
});

test('amend: PDR Last confirmed bumps sync the README cell', () => {
  const existing = pdrDraft({ title: 'We serve solo operators', status: 'Accepted' })
    .replace('# PDR-NNN:', '# PDR-001:')
    .replaceAll('YYYY-MM-DD', '2026-01-01');
  const revised = existing.replace('**Last confirmed:** 2026-01-01', `**Last confirmed:** ${TODAY}`);
  const dir = fixture({
    'docs/pdr/README.md':
      PDR_README + '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | 2026-01-01 |\n',
    'docs/pdr/001-we-serve-solo-operators.md': existing,
    'revised.md': revised,
  });
  const { code, out } = run(dir, ['amend', 'pdr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(readFileSync(join(dir, 'docs/pdr/README.md'), 'utf8'), new RegExp(`\\| Accepted \\| ${TODAY} \\|`));
  assert.match(out, /Last confirmed →/);
});

// --------------------------------------------------------------------- readme

test('amend readme: a cell edit lands (the 90-day Last confirmed sweep)', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README + '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | 2026-01-01 |\n',
    'docs/pdr/001-we-serve-solo-operators.md': '# PDR-001: We serve solo operators\n',
    'revised.md':
      PDR_README + `| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | ${TODAY} |\n`,
  });
  const { code, out } = run(dir, ['amend', 'pdr', 'readme', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(readFileSync(join(dir, 'docs/pdr/README.md'), 'utf8'), new RegExp(`${TODAY} \\|`));
});

test('amend readme: row deletion is refused — never pruned is mechanical', () => {
  const dir = fixture({
    'docs/pdr/README.md':
      PDR_README +
      '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | 2026-01-01 |\n| [002](002-not-building-mobile.md) | Not building mobile | Rejected | 2026-01-01 |\n',
    'docs/pdr/001-we-serve-solo-operators.md': '# PDR-001: We serve solo operators\n',
    'docs/pdr/002-not-building-mobile.md': '# PDR-002: Not building mobile\n',
    'revised.md': PDR_README + '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | 2026-01-01 |\n',
  });
  const { code, out } = run(dir, ['amend', 'pdr', 'readme', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /row deletion\(s\): 002-not-building-mobile\.md/);
  assert.match(out, /never pruned/);
});

test('amend readme: prose outside the table is untouchable', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README + '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | 2026-01-01 |\n',
    'docs/pdr/001-we-serve-solo-operators.md': '# PDR-001: We serve solo operators\n',
    'revised.md':
      PDR_README.replace('# Product Decision Records', '# Product Decision Records (definitely still governed)') +
      '| [001](001-we-serve-solo-operators.md) | We serve solo operators | Accepted | 2026-01-01 |\n',
  });
  const { code, out } = run(dir, ['amend', 'pdr', 'readme', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /prose above the inventory table changed/);
});

test('amend readme: a row must link to a record that exists on disk', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README,
    'revised.md': PDR_README + '| [007](007-ghost.md) | Ghost | Proposed | 2026-01-01 |\n',
  });
  const { code, out } = run(dir, ['amend', 'pdr', 'readme', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /007-ghost\.md, which does not exist/);
});

test('amend readme: every record on disk must have a row', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README,
    'docs/pdr/001-we-serve-solo-operators.md': '# PDR-001: We serve solo operators\n',
    'revised.md': PDR_README,
  });
  const { code, out } = run(dir, ['amend', 'pdr', 'readme', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /has no row/);
});

// ------------------------------------------------------- self-install + misc

test('write-record: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/write-record.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/write-record.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});
