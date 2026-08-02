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
 * Four findings, and the middle two are the ones that motivated the design:
 *
 *   BEHIND      declared version is older than the current template
 *   MISMATCH    the declaration does not match reality — nothing resolves under
 *               either declaration dialect, or the resolved file's stamp says
 *               something other than what the repo declared
 *   NOSTAMP     the declared file exists but carries no readable version stamp,
 *               so the declaration cannot be verified at all
 *   UNDECLARED  governance artifacts are installed with no Synced-templates table,
 *               so there is nothing to compare at all
 *
 * MISMATCH matters more than BEHIND. A repo that is behind knows what it has. A
 * repo whose declaration is wrong reports a clean bill of health it has not got —
 * observed 2026-07-24, when a governed repo declared `docs/agent-routing.md v1.4.0`
 * and the file did not exist. NOSTAMP blocks for the same reason: an unverifiable
 * declaration is a clean bill of health with the evidence missing, and until
 * 2026-08-02 this lint silently skipped exactly that case.
 *
 * Two declaration dialects are live in the field: repo-relative paths
 * (`docs/agent-routing.md`) and template-relative names (`agent-routing.md`,
 * `skills/routing-triage/SKILL.md`). Resolution accepts both — try the declaration
 * as repo-relative, then map it through the template key to the client-side
 * install location. Which dialect is canonical is a decision deferred to the
 * routing backlog; this lint is correct under either outcome. A declaration may
 * carry one trailing parenthetical annotation (`routing-classifier.md (Claude
 * Code)`), stripped before resolving. Two install locations resolve specially:
 * `agents/*.opencode.md` templates install globally under
 * ~/.config/opencode/agents/ (OPENCODE_AGENTS_DIR overrides, used by the fixture
 * tests), and `governance-sync-claude-section.md` installs as a section of the
 * repo's CLAUDE.md — a present section means installed, and a section carries no
 * stamp, so it can only ever report NOSTAMP.
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

/** Strip the human annotation from a declaration: backticks, and one trailing parenthetical. */
function cleanDecl(raw) {
  return raw.replace(/^`|`$/g, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Map a declared path back to a templates/ key, in either dialect. */
function toTemplateKey(d) {
  for (const p of PREFIXES) {
    if (d.startsWith(p)) {
      const tail = d.slice(p.length);
      if (current.has(tail)) return tail;
      for (const sub of ['skills/', 'agents/', 'scripts/', 'workflows/']) {
        if (current.has(sub + tail)) return sub + tail;
      }
    }
  }
  if (current.has(d)) return d;
  // Template-relative subpath declaration (`routing-triage/SKILL.md`): try the
  // template subdirectories before giving up.
  for (const sub of ['skills/', 'agents/', 'scripts/', 'workflows/']) {
    if (current.has(sub + d)) return sub + d;
  }
  return null;
}

/** Where `agents/*.opencode.md` templates install: globally, off the repo tree. */
const OPENCODE_AGENTS = process.env.OPENCODE_AGENTS_DIR || join(homedir(), '.config/opencode/agents');

/** Templates whose installed artifact is a section of the repo's CLAUDE.md, not a file. */
const SECTION_INSTALLED = new Map([['governance-sync-claude-section.md', /###\s*Synced templates/i]]);

/**
 * Candidate on-disk locations for a declaration, in resolution order: the
 * declaration itself (repo-relative dialect), then the client-side install
 * location derived from the template key (template-relative dialect).
 * Absolute candidates (the opencode global agent) are returned as-is.
 */
function installCandidates(declared, key) {
  const out = [declared];
  if (key) {
    if (key.startsWith('skills/')) out.push('.claude/' + key);
    else if (key.startsWith('agents/')) out.push('.claude/' + key);
    else if (key.startsWith('workflows/')) out.push('.github/' + key);
    else if (key.startsWith('scripts/')) out.push(key);
    else if (!key.includes('/')) out.push('docs/' + key);
    if (key.startsWith('agents/') && key.endsWith('.opencode.md')) {
      out.push(join(OPENCODE_AGENTS, key.slice('agents/'.length).replace(/\.opencode\.md$/, '.md')));
    }
  }
  return [...new Set(out)];
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
    const declaredPath = cleanDecl(m[1]);
    const declaredVer = m[2].trim();
    if (declaredVer === '—' || declaredVer === '-') continue;

    const key = toTemplateKey(declaredPath);
    if (!key) continue; // adapted/local artifact, not a tracked template

    const cand = installCandidates(declaredPath, key).find((c) => existsSync(c.startsWith('/') ? c : join(path, c)));
    if (!cand) {
      if (SECTION_INSTALLED.has(key) && SECTION_INSTALLED.get(key).test(md)) {
        findings.push({
          sev: 'NOSTAMP',
          repo,
          msg: `declares ${declaredPath} v${declaredVer} — installed as a CLAUDE.md section, which carries no version stamp; the declaration cannot be verified`,
        });
        continue;
      }
      findings.push({
        sev: 'MISMATCH',
        repo,
        msg: `declares ${declaredPath} v${declaredVer} but no file resolves under either declaration dialect — a clean bill of health it has not got`,
      });
      continue;
    }
    const abs = cand.startsWith('/') ? cand : join(path, cand);
    const actual = stampOf(readFileSync(abs, 'utf8'), isFm(abs));
    if (!actual) {
      findings.push({
        sev: 'NOSTAMP',
        repo,
        msg: `declares ${declaredPath} v${declaredVer} but ${cand} carries no readable version stamp — the declaration cannot be verified`,
      });
      continue;
    }
    if (actual !== declaredVer) {
      findings.push({ sev: 'MISMATCH', repo, msg: `declares ${declaredPath} v${declaredVer} but the installed file stamps v${actual}` });
      continue;
    }
    const latest = current.get(key);
    if (latest && latest !== declaredVer) {
      findings.push({ sev: 'BEHIND', repo, msg: `${declaredPath} at v${declaredVer}, template is v${latest}` });
    }
  }
}

const order = { MISMATCH: 0, NOSTAMP: 1, UNDECLARED: 2, BEHIND: 3 };
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.repo.localeCompare(b.repo));

console.log(`check-downstream-drift: ${repos.length} governed repo(s), ${current.size} templates.`);

if (!findings.length) {
  console.log('OK: every governed repo declares what it installed, and the declarations are true and current.');
  process.exit(0);
}

for (const sev of ['MISMATCH', 'NOSTAMP', 'UNDECLARED', 'BEHIND']) {
  const g = findings.filter((f) => f.sev === sev);
  if (!g.length) continue;
  console.log(`\n${sev} (${g.length}):`);
  for (const f of g) console.log(`  ${f.repo}: ${f.msg}`);
}

const blocking = findings.filter((f) => f.sev === 'MISMATCH' || f.sev === 'NOSTAMP' || STRICT);
if (blocking.length) {
  console.error(`\n${blocking.length} blocking finding(s).`);
  console.error('MISMATCH and NOSTAMP always block: a wrong or unverifiable declaration is worse than a stale one, because it reports health the repo has not got.');
  process.exit(1);
}
console.log('\nNo MISMATCH or NOSTAMP findings. BEHIND and UNDECLARED are reported, not blocking (use --strict to gate them).');
process.exit(0);
