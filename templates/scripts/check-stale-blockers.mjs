#!/usr/bin/env node
// template: scripts/check-stale-blockers.mjs v1.0.0 · updated 2026-08-18
/**
 * lint:stale-blockers  [governance template — copy to <project>/scripts/]
 *
 * A blocker is asserted once, in prose, and never re-evaluated. Closing the
 * upstream issue does not touch the downstream one, and nothing else in the
 * stack reads a `blocked-by` line and asks whether it is still true. The
 * observed cost (2026-08-17, cross-repo epic review): three of four
 * apparently-stalled programs were not blocked at all — the blocker had closed
 * weeks earlier and the dependent's body was never re-read. One of them sat 14
 * days on the critical path of an irreversible credential revocation; another
 * sat two months against a blocker that had cleared in May.
 *
 * This script is the detector backstop. The PRIMARY control is the dependent
 * sweep in definition-of-done.md (search for `blocked-by` refs to an issue
 * before closing it) — zero tooling, catches the failure at the moment it
 * becomes true. This probe exists for when the sweep didn't happen.
 *
 * CLASSES (each with its own census count and its own fixture):
 *   phantom          dependent open, blocker CLOSED — sweep the dependent
 *   unresolved-ref   ref does not exist in a repo the run COULD read — fix
 *                    the authoring
 *   unreachable      the ref's repo could not be read at all — SKIPPED,
 *                    never counted clean. A probe that degrades to
 *                    same-repo-only silently drops the highest-risk class
 *                    (the cross-repo ones), so an unreadable scope is a
 *                    loudly reported hole, not a zero
 *   mutual-deferral  two open issues cite each other and both carry
 *                    status:blocked / status:deferred — a human breaks the
 *                    cycle
 *   stale-status     status:blocked / status:needs-decision whose `## Status`
 *                    line is undated or older than --max-status-age (30d)
 *
 * `unreachable` is NOT `unresolved-ref`: one is an environment problem (scope
 * the token), the other is an authoring defect. A run that merges them
 * reports an authoring problem for a missing credential.
 *
 * `blocked-by external: <reason>` is unresolvable BY DESIGN — the policy form
 * for a blocker that is not an issue (a human decision, a vendor answer). It
 * is never a finding. It exists so the detector can tell "deliberately not an
 * issue" from "unparseable"; unparseable tokens count in the census as
 * `unparsed` so format drift is visible without becoming a finding class of
 * its own.
 *
 * EXIT CONTRACT — this is a probe, never a gate (ADR-007/ADR-026: a GitHub
 * outage or an expired token must never block a merge for a reason unrelated
 * to the diff):
 *   probe (default)   exits 0 whether or not it finds anything
 *   --gate            phantom + unresolved-ref findings exit 1
 *   --gate + skipped  any unreachable scope exits 2 — distinct from clean
 *                     (0) and from findings (1), so a degraded gate cannot
 *                     read as green. Same contract as R6 in
 *                     check-issue-routing.mjs: a check that fails open reads
 *                     as evidence.
 *
 * The `## Dependencies` parser is a LINE SCAN. JavaScript has no \Z anchor —
 * `(?=^##\s|\Z)` silently degrades to "followed by a literal Z", which is the
 * bug that made the routing lint report every correctly-formatted issue in a
 * live backlog as malformed. Do not "simplify" the scan into a regex.
 *
 * CONFIGURE BEFORE USE — REPO is auto-detected from git remote; override with
 * STALE_BLOCKERS_REPO when running outside a checkout. Cross-repo refs are
 * resolved opportunistically: whatever the token can read is in scope, and
 * whatever it cannot is SKIPPED. For estate-wide coverage, run with a token
 * that spans the repos your backlog references.
 *
 * Requires the `gh` CLI, authenticated.
 *
 * Wiring: schedule only (see templates/workflows/stale-blocker-probe.yml) —
 * this is a backlog sweep, not a diff check. Never wire it per-PR.
 */

import { execFileSync } from 'child_process';

// ---------------------------------------------------------------- configure

/** Max issues fetched from the swept repo. */
const LIMIT = 500;

/** Labels that make a status line stale-able and a mutual deferral real. */
const STALE_STATUS_LABELS = ['status:blocked', 'status:needs-decision'];
const DEFERRED_LABELS = ['status:blocked', 'status:deferred'];

/** gh stderr that means "repo readable, issue number does not resolve".
 *  Every other failure shape lands in unreachable/SKIPPED instead — see
 *  resolveRef. */
const ISSUE_MISSING = /resolve to an Issue/i;

// --------------------------------------------------------------------- args

const ARGS = process.argv.slice(2);
const GATE = ARGS.includes('--gate');

const DEFAULT_MAX_STATUS_AGE = 30;
let MAX_STATUS_AGE = DEFAULT_MAX_STATUS_AGE;
const ageIdx = ARGS.indexOf('--max-status-age');
if (ageIdx !== -1) {
  MAX_STATUS_AGE = Number(ARGS[ageIdx + 1]);
  if (!Number.isInteger(MAX_STATUS_AGE) || MAX_STATUS_AGE < 1) {
    console.error(`check-stale-blockers: --max-status-age needs a positive integer, got "${ARGS[ageIdx + 1]}"`);
    process.exit(2);
  }
}

// ------------------------------------------------------------------ helpers

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function repoSlug() {
  if (process.env.STALE_BLOCKERS_REPO) return process.env.STALE_BLOCKERS_REPO;
  const out = JSON.parse(gh(['repo', 'view', '--json', 'nameWithOwner']));
  return out.nameWithOwner;
}

const REPO = repoSlug();
const REPO_OWNER = REPO.split('/')[0];

/**
 * The "## Dependencies" block, or null. Line-scanned, never a \Z regex —
 * see the header.
 */
function sectionBlock(body, name) {
  if (!body) return null;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^##[ \\t]*${name}[ \\t]*$`, 'i').test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##[ \t]/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

/** Tokens that may sit between refs in a list without ending it. */
const REF_CONNECTORS = new Set(['and', '&', 'by', 'then', 'plus', '—', '–', ';', 'and/or']);

/**
 * Parse the blocked-by refs out of a Dependencies block.
 *
 * Tolerates the observed live dialects, all from real backlogs (the 2026-08-18
 * corpus run over ai-fleet's 373 open issues):
 *   blocked-by #237, #241 · blocks #9 · child-of #3      (·-joined, comma list)
 *   blocked-by analytics#237, #241, #335                 (bare-repo, owner inferred;
 *                                                         bare continuations inherit
 *                                                         the previous ref's repo)
 *   blocked-by HopSkipInc/analytics#237                  (fully qualified)
 *   **blocked-by #1978** (the join-key column) and **#1977** (emphasis + annotation)
 *   blocked-by #1935 — continuation only pays off once … (em-dash rationale)
 *   blocked-by #960 … landing as part of PR #955         (annotation WITH a ref
 *                                                         in it — reads as a ref,
 *                                                         not as prose; see below)
 *   blocked-by external: waiting on the vendor contract  (unresolvable by design)
 *   blocked-by none
 *
 * Returns { refs: [{repo, number}], external: boolean, unparsed: number }.
 * `repo` is always fully qualified (owner/repo) so cross-repo reads and the
 * unreachable-scope accounting have one shape. `unparsed` counts SEGMENTS that
 * carry a blocking claim with no resolvable ref at all — the format-drift
 * signal for the corpus-normalization issue. Annotation prose AFTER a resolved
 * ref is not drift and does not count.
 *
 * Known limitation, accepted: annotation prose that itself names `#N` has that
 * number read as a blocker ref (ai-fleet #957's "... blocked-by #960" prefix
 * of an annotation scanned as a ref — a true positive from a false parse).
 * Prose-once-removed is out of scope on purpose (issue #89: a prose detector
 * is a heuristic that misfires); the phantom finding tells the sweeper to
 * re-read the body, which is where the annotation gets read correctly.
 */
function parseDependencies(body) {
  const block = sectionBlock(body, 'Dependencies');
  const out = { refs: [], external: false, unparsed: 0 };
  if (!block) return out;
  const seen = new Set();

  // Strip emphasis AND backticks — the corpus carries refs as
  // `HopSkipInc/analytics-infrastructure#237` (ai-fleet #1428–#1430), and the
  // backtick made the token unparseable on the first corpus run. Parens are
  // NOT stripped — the corpus carries both "(the join-key column)"
  // (annotation) and "#961 (web CI gates, blocked-by #960)" (the ref lives
  // inside the parens; stripping them lost ai-fleet #957's only blocker).
  const cleaned = block.replace(/\*\*/g, '').replace(/`/g, '');

  // Segments are `·`-joined; each segment starts with its keyword. Newlines
  // also separate segments (authors hard-wrap).
  for (const segment of cleaned.split(/[·\n]/)) {
    const m = segment.match(/\bblocked-by\b\s*:?[ \t]*(.*)/i);
    if (!m) continue;
    let rest = m[1].trim();
    // "nothing" is the corpus's other spelling of "none" (3 live uses in
    // ai-fleet on the 2026-08-18 run) — tolerate both.
    if (!rest || /^(none|nothing)\b/i.test(rest)) continue;
    if (/^external\s*:/i.test(rest)) {
      out.external = true;
      continue;
    }
    // A trailing `blocks #Y` / `child-of #Z` clause on the same segment is not
    // part of the blocker list.
    rest = rest.split(/\b(?:blocks|child-of)\b/i)[0];

    let lastRepo = null;
    let found = 0;
    for (const token of rest.split(/[,\s]+/)) {
      if (!token || REF_CONNECTORS.has(token.toLowerCase())) continue;
      const ref = parseRef(token, lastRepo);
      if (ref) {
        // A ref-shaped token is a ref wherever it appears — including inside
        // annotation prose ("… landing as part of PR #955"), per the header's
        // accepted limitation. Dedupe: annotation re-names the blocker
        // ("the predicate #1460 establishes"), and a duplicate is one claim,
        // not two.
        const k = `${ref.repo}#${ref.number}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.refs.push(ref);
        }
        lastRepo = ref.repo;
        found += 1;
      } else if (found === 0) {
        // A blocking claim with no resolvable ref — the exact thing the
        // policy's reference-resolution rule exists to prevent. Count the
        // segment once; this is the corpus's format-drift signal.
        out.unparsed += 1;
        break;
      }
      // Non-ref tokens after a resolved ref are annotation prose
      // ("— continuation only pays off once …"). Not drift; skip and keep
      // scanning for more refs.
    }
  }
  return out;
}

/**
 * `#N` | `repo#N` (owner inferred from the swept repo) | `owner/repo#N`.
 * A bare `#N` inherits `inherit` — the previous ref's repo in the same list —
 * before falling back to the swept repo: "blocked-by analytics#237, #241"
 * reads as three analytics issues in the live corpus, not a repo switch
 * mid-list.
 */
function parseRef(token, inherit = null) {
  const m = token.replace(/^[(\[]+/, '').replace(/[.,;)\]]+$/, '').match(/^(?:([A-Za-z0-9_.-]+)\/)?([A-Za-z0-9_.-]+)?#(\d+)$/);
  if (!m) return null;
  const [, owner, repo, number] = m;
  if (owner && repo) return { repo: `${owner}/${repo}`, number: Number(number) };
  if (!owner && repo) return { repo: `${REPO_OWNER}/${repo}`, number: Number(number) };
  return { repo: inherit ?? REPO, number: Number(number) };
}

/** The first date (YYYY-MM-DD) in the "## Status" block, or null. */
function statusDate(body) {
  const block = sectionBlock(body, 'Status');
  if (!block) return null;
  const m = block.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? Date.parse(m[1]) : null;
}

// ------------------------------------------------------- blocker resolution

/** issue view cache: `${repo}#${n}` → { state, body, labels } | 'missing'. */
const refCache = new Map();
/** repo → error message. A repo on this list is a SKIPPED scope. */
const unreachable = new Map();

function resolveRef(ref) {
  const key = `${ref.repo}#${ref.number}`;
  if (refCache.has(key)) return refCache.get(key);
  if (unreachable.has(ref.repo)) return 'unreachable';

  let result;
  try {
    const raw = gh(['issue', 'view', String(ref.number), '--repo', ref.repo,
      '--json', 'number,state,body,labels']);
    const issue = JSON.parse(raw);
    result = {
      state: String(issue.state).toUpperCase(),
      body: issue.body || '',
      labels: (issue.labels || []).map((l) => l.name),
    };
  } catch (err) {
    const msg = `${err.stderr ?? ''}${err.message ?? ''}`.split('\n')[0];
    if (ISSUE_MISSING.test(msg)) {
      // The repo answered; the issue number does not resolve. Authoring defect.
      result = 'missing';
    } else {
      // Deliberate default: ANY other failure — repo not found, auth, network,
      // or a gh error shape we have never seen — is unreachable, never a
      // finding. A hole we report beats a defect we invent.
      unreachable.set(ref.repo, msg || 'unknown error');
      return 'unreachable';
    }
  }
  refCache.set(key, result);
  return result;
}

// -------------------------------------------------------------------- sweep

const issues = JSON.parse(
  gh(['issue', 'list', '--repo', REPO, '--state', 'open', '--limit', String(LIMIT),
      '--json', 'number,title,body,labels'])
);

const findings = [];
function report(cls, number, message) {
  findings.push({ cls, number, message });
}

const census = { phantom: 0, 'unresolved-ref': 0, 'mutual-deferral': 0, 'stale-status': 0, unparsed: 0 };
let refCount = 0;

const cutoff = Date.now() - MAX_STATUS_AGE * 24 * 60 * 60 * 1000;

for (const issue of issues) {
  const names = issue.labels.map((l) => l.name);
  const deps = parseDependencies(issue.body);
  refCount += deps.refs.length;
  census.unparsed += deps.unparsed;

  for (const ref of deps.refs) {
    const resolved = resolveRef(ref);
    if (resolved === 'unreachable') continue; // accounted on the scope, once
    if (resolved === 'missing') {
      census['unresolved-ref'] += 1;
      report('unresolved-ref', issue.number,
        `blocked-by ${key(ref)} — no issue ${ref.number} in ${ref.repo}, and the repo IS readable. ` +
        'Fix the authoring (typo, renumbered, or wrong repo); this is not an environment problem');
      continue;
    }
    if (resolved.state === 'CLOSED') {
      census.phantom += 1;
      const p1 = names.includes('P1') ? ' [P1 dependent]' : '';
      report('phantom', issue.number,
        `blocked-by ${key(ref)} — the blocker is CLOSED${p1}. Sweep the dependent: clear the ref, ` +
        'flip status:blocked if it was the last blocker, correct body prose that still asserts it');
      continue;
    }
    // Mutual deferral: the blocker cites us back, and both sides carry a
    // blocked/deferred status label. Reported once, from the lower-numbered
    // side of the pair.
    const back = parseDependencies(resolved.body);
    const citesBack = back.refs.some((r) => r.repo === REPO && r.number === issue.number);
    if (citesBack) {
      const bothDeferred =
        names.some((n) => DEFERRED_LABELS.includes(n)) &&
        resolved.labels.some((n) => DEFERRED_LABELS.includes(n));
      if (bothDeferred) {
        const pairKey = [issue.number, ref.number].sort((a, b) => a - b).join('/');
        if (!findings.some((f) => f.cls === 'mutual-deferral' && f.pairKey === pairKey)) {
          census['mutual-deferral'] += 1;
          findings.push({ cls: 'mutual-deferral', number: issue.number, pairKey,
            message: `#${issue.number} and ${key(ref)} cite each other, both blocked/deferred — ` +
              'mutual deferral. A human breaks the cycle; the probe never will' });
        }
      }
    }
  }

  // Stale status: blocked/needs-decision with an undated or old status line.
  if (names.some((n) => STALE_STATUS_LABELS.includes(n))) {
    const dated = statusDate(issue.body);
    if (dated === null) {
      census['stale-status'] += 1;
      report('stale-status', issue.number,
        'status line carries no date — an undated blocked/needs-decision assertion can never age, ' +
        'which is exactly how the two-month phantom went unnoticed. Re-verify and date it, or close');
    } else if (dated < cutoff) {
      census['stale-status'] += 1;
      const ageDays = Math.floor((Date.now() - dated) / (24 * 60 * 60 * 1000));
      report('stale-status', issue.number,
        `status line dated ${new Date(dated).toISOString().slice(0, 10)} is ${ageDays}d old ` +
        `(max ${MAX_STATUS_AGE}d) — re-verify the blocker still holds and re-date, or close`);
    }
  }
}

function key(ref) {
  return ref.repo === REPO ? `#${ref.number}` : `${ref.repo}#${ref.number}`;
}

// ------------------------------------------------------------------- output

console.log(
  `check-stale-blockers: ${REPO} — swept ${issues.length} open issues, ${refCount} blocked-by refs ` +
  `(max status age ${MAX_STATUS_AGE}d).`
);
console.log(
  `census: phantom ${census.phantom} · unresolved-ref ${census['unresolved-ref']} · ` +
  `mutual-deferral ${census['mutual-deferral']} · stale-status ${census['stale-status']} · ` +
  `unparsed ${census.unparsed} · scopes skipped ${unreachable.size}`
);

if (findings.length) {
  console.log(`\nFINDINGS (${findings.length}, ${GATE ? 'gate' : 'probe — never blocks a merge'}):`);
  for (const f of findings.sort((a, b) => a.number - b.number)) {
    console.log(`  #${f.number} [${f.cls}] ${f.message}`);
  }
}

for (const [repo, msg] of unreachable) {
  console.log(`\nSKIPPED: scope ${repo} unreachable (${msg}).`);
}
if (unreachable.size) {
  console.log(
    'Not counted as clean: refs into these scopes were never read, and a cross-repo phantom is ' +
    'the highest-risk class this probe exists for. Fix the token scope, then re-run.'
  );
}

if (!findings.length && !unreachable.size) {
  console.log('OK: every blocked-by ref resolves to a live blocker, statuses are dated, no cycles.');
}

process.exit(
  unreachable.size && GATE ? 2
    : GATE && census.phantom + census['unresolved-ref'] > 0 ? 1
    : 0
);
