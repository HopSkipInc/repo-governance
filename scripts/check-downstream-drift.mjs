#!/usr/bin/env node
/**
 * lint:downstream-drift  [repo-governance's own lint — NOT a downstream template]
 *
 * Closes scope item 4 of #2. Items 1-3 gave every template a version stamp and
 * gave downstream repos a place to declare what they installed. Nothing compared
 * the two, so a governed repo could run any vintage and neither side could tell.
 *
 * It lives here, not in each repo's scheduled audit, because repo-governance owns
 * the ledger and downstream repos are read-only sources (the session-10 trust
 * boundary). It also has to work for clients who have no access to this repo at
 * all, which rules out the audit asking upstream "am I behind?".
 *
 * Three findings, and the second is the one that motivated the design:
 *
 *   BEHIND      declared version is older than the current template
 *   MISMATCH    the declaration does not match reality — the file is missing, or
 *               its stamp says something other than what the repo declared
 *   UNDECLARED  governance artifacts are installed with no Synced-templates table,
 *               so there is nothing to compare at all
 *
 * MISMATCH matters more than BEHIND. A repo that is behind knows what it has. A
 * repo whose declaration is wrong reports a clean bill of health it has not got —
 * observed 2026-07-24, when a governed repo declared `docs/agent-routing.md v1.4.0`
 * and the file did not exist.
 *
 * Read-only. It never writes to a governed repo.
 *
 * NOT wired to CI, deliberately. It reads local checkouts of the governed repos,
 * which a GitHub runner does not have. Run it during governance sync, from a
 * machine that has them. If no governed repo is reachable it reports SKIPPED and
 * says so — never a pass, because a check that cannot see its subject reporting
 * OK is the fail-open sin this repo keeps finding in its own work.
 *
 * Wiring:  node scripts/check-downstream-drift.mjs
 *          node scripts/check-downstream-drift.mjs --strict   # BEHIND also fails
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, relative } from 'path';
import { homedir } from 'os';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const TEMPLATES = join(ROOT, 'templates');
const DOWNSTREAM = join(ROOT, 'downstream');
const STRICT = process.argv.includes('--strict');
const EXTS = ['.md', '.mjs', '.yml'];

/** Where a declared path in a governed repo maps back to under templates/. */
const PREFIXES = ['docs/', '.claude/skills/', '.claude/agents/', 'scripts/', '.github/workflows/', 'templates/'];

function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (EXTS.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

function stampOf(src, isFrontmatter) {
  const head = src.slice(0, 1200);
  if (isFrontmatter) return head.match(/^version:\s*(\S+)/m)?.[1] ?? null;
  return head.match(/template:\s*\S+\s+v(\d+\.\d+\.\d+)/)?.[1] ?? null;
}
const isFm = (p) => p.endsWith('SKILL.md') || p.includes('/agents/');

/** Current version of every template, keyed by path relative to templates/. */
const current = new Map();
for (const f of walk(TEMPLATES)) {
  const rel = relative(TEMPLATES, f);
  const v = stampOf(readFileSync(f, 'utf8'), isFm(f));
  if (v) current.set(rel, v);
}

/** Governed repos: (repo, localPath) from every client ledger. */
function governedRepos() {
  const out = [];
  for (const client of readdirSync(DOWNSTREAM)) {
    const ledger = join(DOWNSTREAM, client, '_client.md');
    if (!existsSync(ledger)) continue;
    for (const line of readFileSync(ledger, 'utf8').split('\n')) {
      const m = line.match(/^\|\s*([\w.-]+\/[\w.-]+)\s*\|\s*`([^`]+)`\s*\|/);
      if (m) out.push({ repo: m[1], path: m[2].replace(/^~/, homedir()) });
    }
  }
  return out;
}

/** Map a repo-relative declared path back to a templates/ key. */
function toTemplateKey(declared) {
  const d = declared.replace(/^`|`$/g, '').trim();
  for (const p of PREFIXES) {
    if (d.startsWith(p)) {
      const tail = d.slice(p.length);
      if (current.has(tail)) return tail;
      for (const sub of ['skills/', 'agents/', 'scripts/', 'workflows/']) {
        if (current.has(sub + tail)) return sub + tail;
      }
    }
  }
  return current.has(d) ? d : null;
}

const findings = [];
const repos = governedRepos();

const reachable = repos.filter((r) => existsSync(r.path));
if (repos.length && !reachable.length) {
  console.log(`check-downstream-drift: SKIPPED — ${repos.length} governed repo(s) in the ledger, none reachable on this machine.`);
  console.log('This tool needs local checkouts. Run it during governance sync, not in CI.');
  console.log('Reporting SKIPPED rather than OK: a check that cannot see its subject has not passed.');
  process.exit(0);
}

for (const { repo, path } of repos) {
  if (!existsSync(path)) {
    // Some repos reachable, this one not — a real ledger problem, not a missing environment.
    findings.push({ sev: 'MISMATCH', repo, msg: `ledger points at ${path}, which does not exist` });
    continue;
  }
  const claudeMd = join(path, 'CLAUDE.md');
  const md = existsSync(claudeMd) ? readFileSync(claudeMd, 'utf8') : '';
  const section = md.match(/###\s*Synced templates([\s\S]*?)(?=\n###\s|\n##\s|$)/i)?.[1] ?? null;

  if (!section) {
    // Is anything governance-shaped installed despite no declaration?
    const installed = ['docs/agent-routing.md', '.claude/skills/routing-triage/SKILL.md', 'docs/definition-of-done.md']
      .filter((f) => existsSync(join(path, f)));
    if (installed.length) {
      findings.push({
        sev: 'UNDECLARED',
        repo,
        msg: `${installed.length} governance artifact(s) installed with no "### Synced templates" table — nothing to compare (${installed.join(', ')})`,
      });
    }
    continue;
  }

  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*`?([^|`]+)`?\s*\|\s*v?([\w.]+)\s*\|/);
    if (!m || /^-+$/.test(m[1].trim()) || m[1].trim().toLowerCase() === 'template') continue;
    const declaredPath = m[1].trim();
    const declaredVer = m[2].trim();
    if (declaredVer === '—' || declaredVer === '-') continue;

    const key = toTemplateKey(declaredPath);
    if (!key) continue; // adapted/local artifact, not a tracked template

    const onDisk = join(path, declaredPath.replace(/^`|`$/g, ''));
    if (!existsSync(onDisk)) {
      findings.push({
        sev: 'MISMATCH',
        repo,
        msg: `declares ${declaredPath} v${declaredVer} but the file does not exist — a clean bill of health it has not got`,
      });
      continue;
    }
    const actual = stampOf(readFileSync(onDisk, 'utf8'), isFm(onDisk));
    if (actual && actual !== declaredVer) {
      findings.push({ sev: 'MISMATCH', repo, msg: `declares ${declaredPath} v${declaredVer} but the installed file stamps v${actual}` });
      continue;
    }
    const latest = current.get(key);
    if (latest && latest !== declaredVer) {
      findings.push({ sev: 'BEHIND', repo, msg: `${declaredPath} at v${declaredVer}, template is v${latest}` });
    }
  }
}

const order = { MISMATCH: 0, UNDECLARED: 1, BEHIND: 2 };
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.repo.localeCompare(b.repo));

console.log(`check-downstream-drift: ${repos.length} governed repo(s), ${current.size} templates.`);

if (!findings.length) {
  console.log('OK: every governed repo declares what it installed, and the declarations are true and current.');
  process.exit(0);
}

for (const sev of ['MISMATCH', 'UNDECLARED', 'BEHIND']) {
  const g = findings.filter((f) => f.sev === sev);
  if (!g.length) continue;
  console.log(`\n${sev} (${g.length}):`);
  for (const f of g) console.log(`  ${f.repo}: ${f.msg}`);
}

const blocking = findings.filter((f) => f.sev === 'MISMATCH' || (STRICT && f.sev !== 'MISMATCH'));
if (blocking.length) {
  console.error(`\n${blocking.length} blocking finding(s).`);
  console.error('MISMATCH always blocks: a wrong declaration is worse than a stale one, because it reports health the repo has not got.');
  process.exit(1);
}
console.log('\nNo MISMATCH findings. BEHIND and UNDECLARED are reported, not blocking (use --strict to gate them).');
process.exit(0);
