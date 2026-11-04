// Fixture tests for templates/scripts/generate-roadmap.mjs — Layer 3's data
// pass of the backlog-grooming regime (templates/backlog-grooming.md). Ported
// with the template from ai-fleet (2026-09-20 Layer 3 v2 prompt §6). Contracts:
//
//   1. golden      — the fixture substrate renders exactly the committed
//                    golden file, byte for byte. An intentional renderer
//                    change regenerates the golden (run the CLI with
//                    --fixtures test/fixtures/roadmap --out
//                    test/fixtures/roadmap/golden/roadmap-data.md and commit
//                    the diff); an unintentional one fails here.
//   2. determinism — two CLI runs over the same fixtures produce identical
//                    bytes ("a re-run over unchanged substrate is
//                    byte-identical, or every run is a spurious diff").
//   3. forced lapse — a last-groom marker older than the DoD cadence renders
//                    the header UNTRUSTED.
//   4. gh absent   — SKIPPED, exit 0, and no artifact written (fail-closed:
//                    a degraded run never reads as a fresh projection).
//   5. debt table  — known-age unparented issues land in the right bands,
//                    status:deferred renders separately with its date, and
//                    the header's >90d count matches the fixture.
//   6. child graph — open children only, issue-number order, blank when none.
//   7. impl tier   — the epic's impl: label value, blank when untiered.
//   8. api version — every live read pins the REST API version explicitly
//                    instead of inheriting gh's default (ai-fleet #4066).
//   9. rolling issue — found by the probe's label in the loaded graph, never a
//                    hard-coded number (added at extraction: the source copy
//                    hard-coded its own issue #2352).
//  10. --gate      — refused loudly; a projection never gates a merge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const FIXTURES = resolve(REPO, 'test', 'fixtures', 'roadmap');
const SCRIPT = resolve(REPO, 'templates', 'scripts', 'generate-roadmap.mjs');
const LIB = resolve(REPO, 'templates', 'scripts', 'lib', 'backlog-graph.mjs');
const { renderArtifact, loadFixture, groomMarkersFrom, rollingIssueOf } = await import(SCRIPT);

test('1. golden — fixture substrate renders the committed golden file byte-identically', () => {
  const golden = readFileSync(join(FIXTURES, 'golden', 'roadmap-data.md'), 'utf8');
  assert.equal(renderArtifact(loadFixture(FIXTURES)), golden);
});

test('2. determinism — two CLI runs over the same fixtures produce identical bytes', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'roadmap-det-'));
  const run = (name) => {
    const out = join(tmp, name);
    const r = spawnSync(process.execPath, [SCRIPT, '--fixtures', FIXTURES, '--out', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return readFileSync(out, 'utf8');
  };
  assert.equal(run('a.md'), run('b.md'));
});

test('3. forced lapse — a groom marker older than the cadence renders UNTRUSTED', () => {
  const inputs = loadFixture(FIXTURES);
  inputs.groomMarkers = groomMarkersFrom(
    JSON.parse(readFileSync(join(FIXTURES, 'groom-comments-lapsed.json'), 'utf8')),
  );
  const out = renderArtifact(inputs);
  assert.match(out, /trust: \*\*UNTRUSTED\*\*/);
  assert.match(out, /cadence: weekly → lapsed/);
  // …and the base fixture (marker 2d before the substrate clock) is TRUSTED.
  assert.match(renderArtifact(loadFixture(FIXTURES)), /trust: \*\*TRUSTED\*\*/);
});

test('4. gh absent — SKIPPED, exit 0, no artifact written', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'roadmap-nogh-'));
  const out = join(tmp, 'roadmap-data.md');
  const r = spawnSync(process.execPath, [SCRIPT, '--out', out], {
    encoding: 'utf8',
    env: { ...process.env, PATH: '/nonexistent' },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^SKIPPED generate-roadmap/);
  assert.equal(existsSync(out), false, 'a SKIPPED run must not write the artifact');
});

test('5. debt table — bands, deferred separation, and the header >90d count', () => {
  const out = renderArtifact(loadFixture(FIXTURES));
  const row = (n) => out.split('\n').find((l) => l.includes(`Issue: #${n} `));

  // Bands, against the fixture's substrate clock (2026-09-20).
  assert.match(row(505), /sweep \(>180d\)/);   // 292d
  assert.match(row(504), /sweep \(90–180d\)/); // 141d
  assert.match(row(503), /watch \(30–90d\)/);  // 80d
  assert.match(row(502), /watch \(30–90d\)/);  // 49d
  assert.match(row(501), /fresh \(<30d\)/);    // 9d

  // The header's >90d actionable count matches the fixture's two sweep rows.
  assert.match(out, /debt >90d \(actionable\): 2/);

  // Deferred rows render in their own table with their dates, never in the
  // actionable one.
  const deferredSection = out.split('### Deferred on the record')[1];
  assert.match(deferredSection, /Issue: #506 .* 2026-08-15/);
  assert.match(deferredSection, /Issue: #507 .* 2026-07-01/);
  assert.equal(row(506).includes('sweep'), false, 'deferred rows stay out of the actionable table');

  // Membership: epics (#100), parents (#510), and linked children (#511) are
  // not debt; a mere mention of an epic (#509) is.
  const debtSection = out.split('## Debt')[1];
  assert.equal(debtSection.includes('Issue: #100 '), false);
  assert.equal(debtSection.includes('Issue: #510 '), false);
  assert.equal(debtSection.includes('Issue: #511 '), false);
  assert.match(debtSection, /Issue: #509 /);
  assert.match(out, /unparented: 9 of 14 open · bug=5 chore=3 other=1/);
});

test('6. child graph — open children only, issue-number order, blank when none', () => {
  const out = renderArtifact(loadFixture(FIXTURES));
  const section = out.split('## Child graph')[1].split('## Debt')[0];

  // #200 has one open child (#202); #201 is closed, so it never appears.
  assert.match(section, /\| #200 \| #202 \|/);
  assert.equal(section.includes('#201'), false, 'a closed child must not be listed');
  // A delivered epic (#100) and a childless epic (#300) render blank.
  assert.match(section, /\| #100 \| {2}\|/);
  assert.match(section, /\| #300 \| {2}\|/);
  // Every roadmap epic gets a row, in issue-number order.
  assert.deepEqual(
    section.split('\n').filter((l) => /^\| #\d+ \|/.test(l)).map((l) => l.match(/#(\d+)/)[1]),
    ['100', '200', '300'],
  );
});

test('7. impl tier column — the epic label value, blank when untiered (#3328)', () => {
  const out = renderArtifact(loadFixture(FIXTURES));
  const roadmapSection = out.split('## Roadmap')[1].split('## Child graph')[0];

  // The column exists, and every roadmap row carries it (same width as header).
  const header = roadmapSection.split('\n').find((l) => l.startsWith('| issue |'));
  assert.ok(header, 'roadmap header present');
  assert.ok(header.includes('| impl tier |'), 'impl tier column in the header');
  const width = header.split('|').length;
  const rows = roadmapSection.split('\n').filter((l) => l.startsWith('| Issue: '));
  assert.ok(rows.length > 0);
  for (const r of rows) assert.equal(r.split('|').length, width, `row width == header: ${r.slice(0, 40)}`);

  // #100 carries `impl:standard` → `standard`; #200/#300 carry no impl: label → blank.
  const rowFor = (n) => rows.find((r) => r.includes(`#${n} `));
  assert.match(rowFor(100), /\|[^|]*\|\s*standard\s*\|/);
  assert.equal(/\bstandard\b|\bfrontier\b|\bhuman\b/.test(rowFor(200)), false, '#200 untiered');
  // The coverage summary line is unchanged in meaning.
  assert.match(out, /impl: tier coverage: 1\/3 epics carry an impl: tier/);
});

test('8. live reads pin the REST API version by header — on the first page too (#4066)', () => {
  // Page 1 and page N are one argv for gh; the header rides both.
  // A stub `gh` on PATH is the only honest seam here: the text-editing tool
  // mangles a function-typed argument in this call, so the stub records argv
  // from the shell instead.
  const dir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  const log = join(dir, 'argv');
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`, { mode: 0o755 });
  spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { ghList } from '${LIB}'; ghList('repos/x/y/issues?state=open&per_page=100');`],
  { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
  const calls = [readFileSync(log, 'utf8')];
  assert.equal(calls.length, 1);
  assert.match(calls[0], /-H X-GitHub-Api-Version: \d{4}-\d{2}-\d{2}/);
  // A version gh does not inherit — 2022-11-28 is the default #4066 rules out.
  assert.doesNotMatch(calls[0], /X-GitHub-Api-Version: 2022-11-28/);

  // Every live read that is not a list read goes through ghV as well.
  const src = readFileSync(LIB, 'utf8');
  const live = src.split('export function loadGraphLive')[1].split('/** docs/adr/')[0];
  assert.doesNotMatch(live.replace(/ghV\(/g, ''), /\bgh\(\['api'/, 'no bare gh api call in the live loader');
});

test('9. rolling issue — found by the probe label in the loaded graph, lowest number wins', () => {
  const inputs = loadFixture(FIXTURES);
  // The base fixture carries no labeled issue: the header says so plainly
  // rather than citing a number that means nothing in this repo.
  assert.equal(rollingIssueOf(inputs.graph), null);
  assert.match(renderArtifact(inputs), /findings: no open `backlog-currency-probe` issue/);

  // Overlay two labeled issues (a duplicate the probe should never create):
  // the render cites the lowest, deterministically.
  const labeled = (number) => ({
    number, title: 'backlog-currency probe — rolling findings', state: 'open',
    created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-14T08:31:00Z',
    labels: [{ name: 'backlog-currency-probe' }], body: 'Weekly output.',
  });
  const graph = { ...inputs.graph, issues: [...inputs.graph.issues, labeled(9002), labeled(9001)] };
  assert.equal(rollingIssueOf(graph), 9001);
  assert.match(renderArtifact({ ...inputs, graph }), /findings: rolling issue #9001\b/);
});

test('10. --gate is refused — the artifact is probe-class', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--gate'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /refused/);
});
