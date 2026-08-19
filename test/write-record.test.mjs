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

// --------------------------- 2026-08-18: corpus dialects (issue #91)
// A MADR corpus (bracketed `# [ADR-0011] Title` H1s, 4-digit filenames) failed
// closed on every amend — the number-identity regex anchored on the template's
// own `# ADR-NNN:` form — and the next create would have minted a 3-digit file
// beside a 4-digit README table. The dialect is derived from disk, both ways:
// amend READS both H1 forms, create MINTS the corpus's form.

/** The reporter's corpus shape: root adr/, 4-digit files, bracketed H1s. */
function madrCorpus({ revisedEdit = null } = {}) {
  const existing = `# [ADR-0011] Data-boundary contracts

**Status:** Accepted
**Date:** 2026-07-20

---

## Context

Positional records crossed the HTTP boundary unchecked.

## Decision

All inbound positional records are parsed by the boundary contract before use.

## Enforcement

tools/check-boundary-contracts.mjs, wired into CI

## Consequences

HTTP handlers lose direct access to raw positional payloads.
`;
  let revised = existing;
  if (revisedEdit) revised = revised.replace('## Consequences\n\n', `## Consequences\n\n${revisedEdit}\n`);
  return {
    'adr/README.md':
      '# Architecture Decision Records\n\nEvery file in this directory must appear in the table below.\n\n' +
      '| # | Title | Status | Enforcement |\n|---|-------|--------|-------------|\n' +
      '| [0011](0011-data-boundary-contracts.md) | Data-boundary contracts | Accepted | tools/check-boundary-contracts.mjs |\n',
    'adr/0011-data-boundary-contracts.md': existing,
    'revised.md': revised,
  };
}

test('amend (91): a MADR bracket-form corpus amends — the number identity reads through the brackets', () => {
  const dir = fixture(madrCorpus({ revisedEdit: 'Triage-interview ruling: HTTP-boundary positional records are permanently exempt from the §8 rule (decided 2026-08-18).' }));
  const { code, out } = run(dir, ['amend', 'adr', '0011', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(readFileSync(join(dir, 'adr/0011-data-boundary-contracts.md'), 'utf8'), /permanently exempt/);
});

test('amend (91): an unpadded lookup finds a 4-digit record — `amend adr 11`', () => {
  const dir = fixture(madrCorpus({ revisedEdit: 'A consequence note.' }));
  const { code, out } = run(dir, ['amend', 'adr', '11', 'revised.md']);
  assert.equal(code, 0, out);
});

test('amend (91): renumbering is still refused through the brackets', () => {
  const files = madrCorpus();
  files['revised.md'] = files['revised.md'].replace('# [ADR-0011]', '# [ADR-0012]');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '0011', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /number cannot change/);
});

test('amend (91): the space variant (`# ADR 0007:`) reads too — one live record in the reporter\'s corpus uses it', () => {
  const files = madrCorpus();
  files['adr/0007-webhook-delivery-quality-tracking.md'] = files['adr/0011-data-boundary-contracts.md']
    .replace('# [ADR-0011] Data-boundary contracts', '# ADR 0007: Webhook Delivery Quality Tracking');
  files['adr/README.md'] = files['adr/README.md'].replace(
    '| [0011](0011-data-boundary-contracts.md) | Data-boundary contracts | Accepted | tools/check-boundary-contracts.mjs |\n',
    '| [0007](0007-webhook-delivery-quality-tracking.md) | Webhook Delivery Quality Tracking | Accepted | tools/check-boundary-contracts.mjs |\n| [0011](0011-data-boundary-contracts.md) | Data-boundary contracts | Accepted | tools/check-boundary-contracts.mjs |\n',
  );
  files['revised.md'] = files['adr/0007-webhook-delivery-quality-tracking.md'].replace('## Consequences\n\n', '## Consequences\n\nA note.\n');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '0007', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(readFileSync(join(dir, 'adr/0007-webhook-delivery-quality-tracking.md'), 'utf8'), /A note\./);
});

test('create (91): a 4-digit corpus mints a 4-digit file and README link — not a 3-digit row in a 4-digit table', () => {
  const files = madrCorpus();
  delete files['revised.md'];
  files['draft.md'] = adrDraft({ title: 'Queue consumers run in the worker tier' });
  const dir = fixture(files);
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  assert.ok(existsSync(join(dir, 'adr/0012-queue-consumers-run-in-the-worker-tier.md')), out);
  const readme = readFileSync(join(dir, 'adr/README.md'), 'utf8');
  assert.match(readme, /\[0012\]\(0012-queue-consumers-run-in-the-worker-tier\.md\)/);
});

test('create (91): a bracket-dialect corpus is minted in its own dialect — create writes what amend can re-read', () => {
  const files = madrCorpus();
  delete files['revised.md'];
  files['draft.md'] = adrDraft({ title: 'Queue consumers run in the worker tier' });
  const dir = fixture(files);
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  const written = readFileSync(join(dir, 'adr/0012-queue-consumers-run-in-the-worker-tier.md'), 'utf8');
  assert.match(written, /^# \[ADR-0012\] Queue consumers run in the worker tier$/m);
  // And the new record amends cleanly — the write path and the read path agree.
  const revised = written.replace('## Consequences\n\n', '## Consequences\n\nA note.\n');
  writeFileSync(join(dir, 'revised.md'), revised);
  const again = run(dir, ['amend', 'adr', '0012', 'revised.md']);
  assert.equal(again.code, 0, again.out);
});

test('create (91): a bracket draft into a bracket corpus mints one bracket pair, not two', () => {
  const files = madrCorpus();
  delete files['revised.md'];
  files['draft.md'] = adrDraft({ body: adrDraft().replace('# ADR-NNN: All DB access through the repository layer', '# [ADR-NNN] All DB access through the repository layer') });
  const dir = fixture(files);
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  const written = readFileSync(join(dir, 'adr/0012-all-db-access-through-the-repository-layer.md'), 'utf8');
  assert.match(written, /^# \[ADR-0012\] All DB access through the repository layer$/m);
  assert.doesNotMatch(written, /\[\[ADR|NNN/);
});

test('create (91): a plain-majority corpus keeps the template form even with one bracketed oddity on disk', () => {
  const dir = fixture({
    'docs/adr/README.md':
      ADR_README + '| [001](001-first.md) | First | Accepted | a lint |\n| [002](002-second.md) | Second | Accepted | a lint |\n',
    'docs/adr/001-first.md': '# ADR-001: First\n',
    'docs/adr/002-second.md': '# [ADR-002] Second\n', // the oddity — one bracketed record
    'draft.md': adrDraft(),
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  const written = readFileSync(join(dir, 'docs/adr/003-all-db-access-through-the-repository-layer.md'), 'utf8');
  assert.match(written, /^# ADR-003: All DB access through the repository layer$/m);
});

test('amend (91): a corpus-dialect section absence (no ## Enforcement anywhere) warns but does not refuse', () => {
  const files = madrCorpus();
  const strip = (t) => t.replace(/\n## Enforcement\n\ntools\/check-boundary-contracts\.mjs, wired into CI\n/, '');
  files['adr/0011-data-boundary-contracts.md'] = strip(files['adr/0011-data-boundary-contracts.md']);
  files['revised.md'] = strip(files['revised.md']).replace('## Consequences\n\n', '## Consequences\n\nA ruling note.\n');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '0011', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(out, /WARNING — ADR-0011 has no ## Enforcement section/);
  assert.match(readFileSync(join(dir, 'adr/0011-data-boundary-contracts.md'), 'utf8'), /A ruling note\./);
});

test('amend (91): dropping a section the record HAD is still refused — the guard is anti-degradation, not a backfill mandate', () => {
  const files = madrCorpus(); // this corpus's record DOES carry ## Enforcement
  files['revised.md'] = files['revised.md'].replace(/\n## Enforcement\n\ntools\/check-boundary-contracts\.mjs, wired into CI\n/, '');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '0011', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /missing required section: ## Enforcement/);
});

test('create (91): stays strict in a dialect corpus — a new record meets the house sections whatever the corpus\'s history', () => {
  const files = madrCorpus();
  delete files['revised.md'];
  files['adr/0011-data-boundary-contracts.md'] = files['adr/0011-data-boundary-contracts.md'].replace(
    /\n## Enforcement\n\ntools\/check-boundary-contracts\.mjs, wired into CI\n/, '');
  files['draft.md'] = adrDraft({ title: 'Queue consumers run in the worker tier' }).replace(/## Enforcement[\s\S]*?(?=## Consequences)/, '');
  const dir = fixture(files);
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /missing required section: ## Enforcement/);
});

// --------------------------- 2026-08-19: section matching (issue #97)
// Exact-equality heading matching made variant headings (`## Decision 1: …`,
// `## Enforcement (ships with the decision, per ADR-022)`) invisible to the
// required-section check AND the protected-section guard — which then compared
// null === null and passed on nothing. 1.3.0 normalizes headings, hardens the
// guard, scopes the YYYY-MM-DD marker, exempts Superseded records from
// ## Enforcement, adds .write-record.json, and adds `check`. These fixtures
// pin each of those — the tamper regression is the one that would have caught
// the defect.

/** ai-fleet's house shape: numbered Decision sections, suffixed Enforcement. */
function variantCorpus() {
  const existing = `# ADR-001: Storage backend

**Status:** Accepted
**Date:** 2026-08-01

---

## Context

Storage was per-instance files; the second instance broke that.

## Decision 1: Storage backend

The events table replaces Azure Files.

## Decision 2 — Data source

Postgres, not blobs.

## Decision 3: Retention

Ninety days hot, then archive.

## Enforcement (ships with the decision, per ADR-022)

scripts/check-storage-backend.mjs, wired into CI

## Consequences

File-access code is deleted.
`;
  return {
    'docs/adr/README.md':
      ADR_README + '| [001](001-storage-backend.md) | Storage backend | Accepted | scripts/check-storage-backend.mjs |\n',
    'docs/adr/001-storage-backend.md': existing,
    'revised.md': existing.replace('## Consequences\n\n', '## Consequences\n\nA note.\n'),
  };
}

test('amend (97): a variant-heading record amends — normalization satisfies the required sections, and says which headings did it', () => {
  const dir = fixture(variantCorpus());
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(out, /## Decision satisfied by "## Decision 1: Storage backend"/);
  assert.match(out, /## Enforcement satisfied by "## Enforcement \(ships with the decision, per ADR-022\)"/);
  assert.match(readFileSync(join(dir, 'docs/adr/001-storage-backend.md'), 'utf8'), /A note\./);
});

test('amend (97): TAMPER REGRESSION — a Decision edit inside a variant-heading record is refused, naming the protected section', () => {
  // The test whose absence let the defect ship: pre-1.3.0 this was refused for
  // the WRONG reason (missing required section), and under 1.2.0's missingOk
  // it would have been accepted outright — the gate reporting success while a
  // Decision was rewritten in place.
  const files = variantCorpus();
  files['revised.md'] = files['revised.md'].replace('The events table replaces Azure Files.', 'Azure Files stays the store of record.');
  const dir = fixture(files);
  const before = readFileSync(join(dir, 'docs/adr/001-storage-backend.md'), 'utf8');
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Decision changed/);
  assert.doesNotMatch(out, /missing required section/);
  assert.equal(readFileSync(join(dir, 'docs/adr/001-storage-backend.md'), 'utf8'), before);
});

test('amend (97): deleting one of three Decision sections is refused', () => {
  const files = variantCorpus();
  files['revised.md'] = files['revised.md'].replace('\n## Decision 3: Retention\n\nNinety days hot, then archive.\n', '');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Decision changed/);
  assert.match(out, /3 section\(s\) on disk vs 2 .*deleting or renumbering/);
});

test('amend (97): renumbering Decision 2 → 3 is refused — the heading is part of the record of what was decided', () => {
  const files = variantCorpus();
  files['revised.md'] = files['revised.md'].replace('## Decision 2 — Data source', '## Decision 3 — Data source');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /REFUSED: ## Decision changed/);
});

test('amend (97): a record with no Decision-normalizing heading is refused explicitly — a missing protected section is never a pass', () => {
  const existing = `# ADR-001: Decision log record

**Status:** Accepted
**Date:** 2026-08-01

---

## Context

c

## Decision Log

d

## Enforcement

scripts/x.mjs

## Consequences

c
`;
  const dir = fixture({
    'docs/adr/README.md': ADR_README + '| [001](001-decision-log-record.md) | Decision log record | Accepted | scripts/x.mjs |\n',
    'docs/adr/001-decision-log-record.md': existing,
    'revised.md': existing.replace('## Consequences\n\n', '## Consequences\n\nA note.\n'),
  });
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /has no section normalizing to ## Decision/);
  assert.match(out, /never a pass|nothing to compare/);
});

/** Draft builder for the normalizer table: the four required sections with
 *  swappable heading text, plus optional extra sections. */
function headingDraft({ context = '## Context', decision = '## Decision', enforcement = '## Enforcement', consequences = '## Consequences', extra = '' }) {
  return `# ADR-NNN: Heading table probe

**Status:** Proposed
**Date:** 2026-08-01

---

${context}

c

${decision}

d

${enforcement}

not yet built — tracking issue #99

${consequences}

c
${extra}`;
}

const NORMALIZER_CASES = [
  // [heading slot override, expected map resolution, expectError]
  { name: 'control: bare Context resolves', over: {}, map: ['## Context  →  Context'], error: null },
  {
    name: '## Contextual notes does NOT satisfy Context — the \\b is what saves it',
    over: { context: '## Contextual notes' },
    map: ['## Contextual notes  →  (not a governed section)'],
    error: /missing required section: ## Context/,
  },
  {
    name: '## Decision Log does NOT satisfy Decision (Q1 — owner decision)',
    over: { decision: '## Decision Log' },
    map: ['## Decision Log  →  (not a governed section)'],
    error: /missing required section: ## Decision/,
  },
  {
    name: '## Decisions satisfies Decision',
    over: { decision: '## Decisions' },
    map: ['## Decisions  →  Decision'],
    error: null,
  },
  {
    name: '## Decision: <summary> satisfies Decision',
    over: { decision: '## Decision: All tool registration goes through the tools table' },
    map: ['## Decision: All tool registration goes through the tools table  →  Decision'],
    error: null,
  },
  {
    name: '## Consequences (PROPOSED) satisfies Consequences',
    over: { consequences: '## Consequences (PROPOSED)' },
    map: ['## Consequences (PROPOSED)  →  Consequences'],
    error: null,
  },
  {
    name: '## Enforcement (ships with the decision, per ADR-022) satisfies Enforcement',
    over: { enforcement: '## Enforcement (ships with the decision, per ADR-022)' },
    map: ['## Enforcement (ships with the decision, per ADR-022)  →  Enforcement'],
    error: null,
  },
  {
    name: '## Amendment (…): stays out of the canonical set',
    over: { extra: '\n## Amendment (2026-07-07): revisited\n\na\n' },
    map: ['## Amendment (2026-07-07): revisited  →  (not a governed section)'],
    error: null,
  },
];

for (const c of NORMALIZER_CASES) {
  test(`check (97): ${c.name}`, () => {
    const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': headingDraft(c.over) });
    const { code, out } = run(dir, ['check', 'adr', 'draft.md']);
    for (const line of c.map) assert.ok(out.includes(line), `expected map line "${line}" in:\n${out}`);
    if (c.error) {
      assert.equal(code, 1, out);
      assert.match(out, c.error);
    } else {
      assert.equal(code, 0, out);
    }
    // check writes nothing
    assert.equal(readdirSync(join(dir, 'docs/adr')).filter((f) => /^\d{3}-/.test(f)).length, 0);
  });
}

test('create (97): the house style is not forced to a single Decision — a ## Decision 1/2 draft publishes', () => {
  const body = headingDraft({ decision: '## Decision 1: Storage backend' }).replace(
    '## Decision 1: Storage backend\n\nd\n',
    '## Decision 1: Storage backend\n\nd1\n\n## Decision 2: Data source\n\nd2\n',
  );
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': body });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  assert.match(out, /## Decision satisfied by "## Decision 1: Storage backend"/);
  assert.ok(existsSync(join(dir, 'docs/adr/001-heading-table-probe.md')));
});

test('create (97): three EMPTY Decision sections still fail on empty', () => {
  const body = headingDraft({}).replace(
    '## Decision\n\nd\n',
    '## Decision 1: A\n\n\n## Decision 2: B\n\n## Decision 3: C\n',
  );
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': body });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /section ## Decision is empty/);
});

test('create (97): YYYY-MM-DD in a code span is legitimate prose, not scaffold (ai-fleet ADR-009)', () => {
  const body = adrDraft().replace(
    'Module B gets rewritten; new repos ship with the lint on day one.',
    'Cron keys read `scheduler:<slug>:<YYYY-MM-DDTHH:mm>` — a format specifier, not an unfilled date.',
  );
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': body });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
});

test('amend (97): an unfilled **Date:** field is the placeholder refusal, scoped to the field', () => {
  const files = acceptedCorpus();
  for (const k of Object.keys(files)) {
    if (k.endsWith('.md') && k !== 'revised.md' || k === 'revised.md') files[k] = files[k].replace('**Date:** 2026-08-01', '**Date:** YYYY-MM-DD');
  }
  files['revised.md'] = files['revised.md'].replace('## Consequences\n\n', '## Consequences\n\nA note.\n');
  const dir = fixture(files);
  const { code, out } = run(dir, ['amend', 'adr', '001', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /\*\*Date:\*\* field still holds the placeholder/);
});

test('create (97): a PDR falsifier holding the placeholder date is refused — a falsifier without a real date is a wish', () => {
  const dir = fixture({
    'docs/pdr/README.md': PDR_README,
    'draft.md': pdrDraft({ status: 'Accepted', falsifier: 'Revisit by YYYY-MM-DD when the pilot cohort churns' }),
  });
  const { code, out } = run(dir, ['create', 'pdr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /falsifier still holds the placeholder date/);
});

test('create (97): a Superseded record is exempt from ## Enforcement (Q2)', () => {
  const body = adrDraft({ status: 'Superseded by ADR-001' }).replace(/## Enforcement[\s\S]*?(?=## Consequences)/, '');
  const dir = fixture({
    'docs/adr/README.md': ADR_README + '| [001](001-first.md) | First | Accepted | a lint |\n',
    'docs/adr/001-first.md': '# ADR-001: First\n',
    'draft.md': body,
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
});

test('config (97): .write-record.json that is not valid JSON refuses closed', () => {
  const dir = fixture({ 'docs/adr/README.md': ADR_README, '.write-record.json': '{ not json', 'draft.md': adrDraft() });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /not valid JSON/);
});

test('config (97): an unknown key refuses closed — an unrecognized key that silently did nothing would weaken the gate', () => {
  const dir = fixture({
    'docs/adr/README.md': ADR_README,
    '.write-record.json': JSON.stringify({ adr: { requires: [] } }),
    'draft.md': adrDraft(),
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 1, out);
  assert.match(out, /unknown key "requires"/);
});

test('config (97): required override — a corpus that never adopted the Enforcement rule declares its own list', () => {
  const body = adrDraft().replace(/## Enforcement[\s\S]*?(?=## Consequences)/, '');
  const dir = fixture({
    'docs/adr/README.md': ADR_README,
    '.write-record.json': JSON.stringify({ adr: { required: ['Context', 'Decision', 'Consequences'] } }),
    'draft.md': body,
  });
  const { code, out } = run(dir, ['create', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
});

/** A grandfather fixture: record N with an empty ## Consequences on disk. */
function grandfatherCorpus(num, config) {
  const pad = String(num).padStart(3, '0');
  const existing = `# ADR-${pad}: Old record

**Status:** Accepted
**Date:** 2026-08-01

---

## Context

c

## Decision

d

## Enforcement

scripts/x.mjs

## Consequences
`;
  return {
    'docs/adr/README.md': ADR_README + `| [${pad}](${pad}-old-record.md) | Old record | Accepted | scripts/x.mjs |\n`,
    '.write-record.json': JSON.stringify(config),
    [`docs/adr/${pad}-old-record.md`]: existing,
    'revised.md': existing.replace('scripts/x.mjs', 'scripts/x.mjs, wired into CI'),
  };
}

test('config (97): grandfather — a record at/below the cutoff warns on an empty required section instead of refusing', () => {
  const dir = fixture(grandfatherCorpus(3, { adr: { grandfather: 5 } }));
  const { code, out } = run(dir, ['amend', 'adr', '003', 'revised.md']);
  assert.equal(code, 0, out);
  assert.match(out, /## Consequences empty — warn-only under the corpus's grandfather cutoff \(5\)/);
});

test('config (97): grandfather — a record above the cutoff is still refused', () => {
  const dir = fixture(grandfatherCorpus(6, { adr: { grandfather: 5 } }));
  const { code, out } = run(dir, ['amend', 'adr', '006', 'revised.md']);
  assert.equal(code, 1, out);
  assert.match(out, /section ## Consequences is empty/);
});

test('check (97): a clean draft prints the map and the OK, writing nothing', () => {
  const dir = fixture({ 'docs/adr/README.md': ADR_README, 'draft.md': adrDraft() });
  const { code, out } = run(dir, ['check', 'adr', 'draft.md']);
  assert.equal(code, 0, out);
  assert.match(out, /section map/);
  assert.match(out, /## Decision  →  Decision/);
  assert.match(out, /nothing written/);
});

// ------------------------------------------------------- self-install + misc

test('write-record: the self-installed copy and the template are byte-identical', () => {
  const installed = readFileSync(resolve(REPO, 'scripts/write-record.mjs'), 'utf8');
  const template = readFileSync(resolve(REPO, 'templates/scripts/write-record.mjs'), 'utf8');
  assert.equal(installed, template, 'scripts/ and templates/scripts/ copies drifted — re-sync and re-stamp');
});
