#!/usr/bin/env node
// template: scripts/check-merge-path.mjs v1.1.0 · updated 2026-09-19
/**
 * lint:merge-path  [governance template — copy to <project>/scripts/]
 *
 * GitHub refuses APPROVE and REQUEST_CHANGES from a pull request's own author.
 * A repository whose pull requests are produced under two different identities —
 * a bot for platform-dispatched agents, the operator's own account for agents
 * running in an interactive harness — cannot satisfy one approval rule with
 * both. Setting `required_approving_review_count >= 1` makes every
 * operator-authored pull request unmergeable except by administrative bypass.
 *
 * Observed end state (2026-09-19, ai-fleet): six open pull requests, all
 * authored by the operator, 29 green checks apiece, and a merge path whose only
 * exit was the bypass dialog. The approval requirement had become a second
 * confirmation click carrying no signal — worse than no requirement, because the
 * audit trail recorded an approval gate that had never approved anything.
 *
 * A gate no existing party can satisfy is not a strict gate, it is a bypass
 * habit. Bypass habits are invisible in configuration and obvious in history,
 * so this check reads BOTH and will not pretend the config half is the answer.
 *
 * Policy: merge-path.md. Read it before changing a threshold here.
 *
 * CLASSES (each with its own fixture pair):
 *   ungated              a pull-request rule exists and the required-status-check
 *                        list is EMPTY. The only blocking class. Dropping an
 *                        approval requirement is safe while checks carry the
 *                        verdict; dropping both is not a streamlined merge path,
 *                        it is an unreviewed one (merge-path.md D7)
 *   click-tax            required checks exist but auto-merge is disabled, so a
 *                        human decision does not survive the CI wait and every
 *                        merge costs a return visit (D3)
 *   merge-friction       more than one merge method enabled, or heads are not
 *                        deleted on merge — a repository-wide decision re-posed
 *                        on every single merge (D4)
 *   self-authored-block  approvals are required AND a threshold share of recent
 *                        merges were authored by the account that merged them.
 *                        Those pull requests were structurally unapprovable. This
 *                        is the CAUSE
 *   decorative-approval  approvals are required AND a threshold share of recent
 *                        merges landed with zero approving reviews. This is the
 *                        SYMPTOM — the rule is being walked through
 *   merge-queue-deadlock a merge queue is REQUIRED on the branch and a workflow
 *                        supplying pull-request checks does not trigger on
 *                        `merge_group`. The queue builds a temporary branch and
 *                        waits for required checks to report on IT; a workflow
 *                        triggered only on `pull_request` never runs there, so
 *                        the entry waits forever. This does not degrade the
 *                        merge path, it stops it completely, for every pull
 *                        request at once — which is why it blocks (D8)
 *   unreachable          an API call failed. Reported SKIPPED, never counted
 *                        clean
 *
 * `self-authored-block` is NOT `decorative-approval`. One says the rule cannot be
 * satisfied; the other says it is not being satisfied. A run that merges them
 * reports a process problem for a structural one, and the remedies differ: the
 * first needs a second identity or a check-based verdict, the second needs
 * someone to stop clicking through.
 *
 * EXIT CONTRACT — a merge-path lint must never be the reason a merge is blocked
 * for a cause unrelated to the diff (ADR-026):
 *   probe (default)   exits 0 whether or not it finds anything
 *   --gate            `ungated` and `merge-queue-deadlock` exit 1. Both are
 *                     deterministic from config plus files on disk, and both
 *                     have a total failure mode. Nothing else gates
 *   --gate + skipped  any unreachable scope exits 2 — distinct from clean (0)
 *                     and from findings (1), so a degraded gate cannot read as
 *                     green. Same contract as R6 in check-issue-routing.mjs: a
 *                     check that fails open reads as evidence
 *
 * The two history classes are THRESHOLD-BASED and ship report-only. A threshold
 * nobody has run against a real repository is a guess, and a guessed threshold
 * that gates is a lint that gets disabled. Promote after one audit cycle with a
 * stable observed rate — the discipline lint-stub-tests.mjs and
 * check-weakened-verification.mjs already ship under.
 *
 * Branch rules are read from `repos/{repo}/rules/branches/{branch}` — the
 * EFFECTIVE rules for a branch. It covers rulesets and classic protection alike
 * and needs no admin scope, unlike `branches/{branch}/protection`, which 403s
 * for exactly the non-admin callers this check is meant to run as.
 *
 * CONFIGURE BEFORE USE — REPO is auto-detected from the git remote; override
 * with MERGE_PATH_REPO when running outside a checkout.
 *
 * Requires the `gh` CLI, authenticated.
 *
 * Wiring: schedule, or by hand during a governance sync. Per-PR is legal (the
 * config half is cheap) but the history half costs one API call per sampled pull
 * request, so prefer a weekly probe.
 */

import { execFileSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';

// ---------------------------------------------------------------- configure

/** Where workflow files live, relative to the repo root. Override with
 *  MERGE_PATH_WORKFLOWS_DIR when running outside a checkout. */
const WORKFLOWS_DIR = process.env.MERGE_PATH_WORKFLOWS_DIR ?? '.github/workflows';

/** A workflow deliberately scoped to pull requests only declares itself with
 *  this marker, the same way every other exemption here is declared rather than
 *  inferred. An undeclared omission is the deadlock, not a preference. */
const QUEUE_OPT_OUT = /merge-queue:\s*not-required/;

/** Recent merged pull requests sampled for the history half. */
const DEFAULT_LIMIT = 30;

/** Share of sampled merges landing with no approving review, above which
 *  `decorative-approval` fires. Provisional — see the promotion note above. */
const DEFAULT_BYPASS_THRESHOLD = 0.25;

/** Share of sampled merges whose author merged their own pull request, above
 *  which `self-authored-block` fires. Provisional. */
const DEFAULT_SELF_THRESHOLD = 0.5;

// --------------------------------------------------------------------- args

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i === -1 || i + 1 >= argv.length ? d : argv[i + 1];
};

const GATE = has('--gate');
const JSON_OUT = has('--json');
const LIMIT = Number(val('--limit', DEFAULT_LIMIT));
const BYPASS_THRESHOLD = Number(val('--bypass-threshold', DEFAULT_BYPASS_THRESHOLD));
const SELF_THRESHOLD = Number(val('--self-threshold', DEFAULT_SELF_THRESHOLD));

// --------------------------------------------------------------------- repo

function detectRepo() {
  if (process.env.MERGE_PATH_REPO) return process.env.MERGE_PATH_REPO;
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (m) return m[1];
  } catch {
    /* fall through — reported as unreachable below */
  }
  return null;
}

const REPO = detectRepo();

// ---------------------------------------------------------------------- api

/** Scopes that could not be read. Never empty AND clean at the same time. */
const unreachable = [];

function api(path, what) {
  try {
    const out = execFileSync('gh', ['api', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (err) {
    const detail = (err.stderr || err.message || '').toString().trim().split('\n')[0];
    unreachable.push({ what, path, detail });
    return null;
  }
}

// ------------------------------------------------------------------ collect

const findings = [];
const add = (cls, message, detail) => findings.push({ class: cls, message, detail });

if (!REPO) {
  unreachable.push({
    what: 'repository',
    path: '(git remote)',
    detail: 'no GitHub remote resolved and MERGE_PATH_REPO unset',
  });
}

const repo = REPO ? api(`repos/${REPO}`, 'repository settings') : null;
const branch = val('--branch', repo?.default_branch ?? 'main');
const rules = REPO ? api(`repos/${REPO}/rules/branches/${branch}`, `branch rules for ${branch}`) : null;

/** Effective rules arrive as a flat array of {type, parameters}. */
const ruleOf = (type) => (Array.isArray(rules) ? rules.find((r) => r?.type === type) : undefined);

const prRule = ruleOf('pull_request');
const checksRule = ruleOf('required_status_checks');
const requiredChecks = checksRule?.parameters?.required_status_checks ?? [];
const requiredApprovals = prRule?.parameters?.required_approving_review_count ?? 0;

// ---- config half ----------------------------------------------------------

if (prRule && requiredChecks.length === 0) {
  add(
    'ungated',
    `a pull request is required on ${branch} but no status check is`,
    'Merge is one click and nothing verifies the diff. Removing an approval requirement is safe only while checks carry the verdict (merge-path.md D7).',
  );
}

if (repo && requiredChecks.length > 0 && repo.allow_auto_merge === false) {
  add(
    'click-tax',
    `${requiredChecks.length} required check(s) on ${branch} and auto-merge is disabled`,
    'A human decision does not survive the CI wait — every merge costs a return visit after the checks finish (merge-path.md D3).',
  );
}

if (repo) {
  const methods = [
    ['squash', repo.allow_squash_merge],
    ['merge commit', repo.allow_merge_commit],
    ['rebase', repo.allow_rebase_merge],
  ].filter(([, on]) => on === true);
  const reasons = [];
  if (methods.length > 1) reasons.push(`${methods.length} merge methods enabled (${methods.map(([n]) => n).join(', ')})`);
  if (repo.delete_branch_on_merge === false) reasons.push('head branches are not deleted on merge');
  if (reasons.length > 0) {
    add(
      'merge-friction',
      reasons.join('; '),
      'A repository-wide decision re-posed on every merge, plus cleanup nobody chose to own (merge-path.md D4).',
    );
  }
}

// ---- merge queue ----------------------------------------------------------

const queueRule = ruleOf('merge_queue');

if (queueRule) {
  let workflows = null;
  try {
    workflows = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  } catch (err) {
    unreachable.push({
      what: 'workflow files',
      path: WORKFLOWS_DIR,
      detail: `a merge queue is required but the workflow directory could not be read (${err.code ?? 'error'}) — the deadlock check did not run`,
    });
  }

  const offenders = [];
  for (const file of workflows ?? []) {
    let body;
    try {
      body = readFileSync(`${WORKFLOWS_DIR}/${file}`, 'utf8');
    } catch {
      unreachable.push({ what: `workflow ${file}`, path: `${WORKFLOWS_DIR}/${file}`, detail: 'unreadable' });
      continue;
    }
    // Trigger keys sit at two-space indent under `on:`; a bare substring match
    // would also hit the words in a comment or a job name.
    const triggersOnPr = /^\s{2}pull_request(_target)?:/m.test(body);
    const triggersOnQueue = /^\s{2}merge_group:/m.test(body);
    if (triggersOnPr && !triggersOnQueue && !QUEUE_OPT_OUT.test(body)) offenders.push(file);
  }

  if (offenders.length > 0) {
    add(
      'merge-queue-deadlock',
      `a merge queue is required on ${branch} and ${offenders.length} workflow(s) never run in it: ${offenders.join(', ')}`,
      'The queue waits for required checks to report on its temporary branch. A workflow triggered only on `pull_request` never runs there, so every queued entry waits forever. Add `merge_group:` to each `on:` block, or declare the workflow pull-request-only with a `merge-queue: not-required` comment (merge-path.md D8).',
    );
  }
}

// ---- history half ---------------------------------------------------------

let sampled = 0;
let bypassed = 0;
let selfMerged = 0;

const pulls = REPO
  ? api(
      `repos/${REPO}/pulls?state=closed&base=${encodeURIComponent(branch)}&per_page=${LIMIT}&sort=updated&direction=desc`,
      `recent pull requests on ${branch}`,
    )
  : null;

if (Array.isArray(pulls)) {
  const merged = pulls.filter((p) => p?.merged_at);
  for (const pr of merged) {
    const reviews = api(`repos/${REPO}/pulls/${pr.number}/reviews`, `reviews on #${pr.number}`);
    if (!Array.isArray(reviews)) continue; // counted unreachable; never counted clean
    sampled += 1;
    if (!reviews.some((r) => r?.state === 'APPROVED')) bypassed += 1;
    const author = pr.user?.login;
    const merger = pr.merged_by?.login;
    if (author && merger && author === merger) selfMerged += 1;
  }
}

if (requiredApprovals >= 1 && sampled > 0) {
  const bypassRate = bypassed / sampled;
  const selfRate = selfMerged / sampled;

  if (selfRate > SELF_THRESHOLD) {
    add(
      'self-authored-block',
      `${selfMerged} of ${sampled} sampled merges were authored by the account that merged them, while ${requiredApprovals} approval(s) are required`,
      'GitHub forbids self-approval, so those pull requests were structurally unapprovable. The cause: give the reviewing agent its own identity, or move the verdict to a check run (merge-path.md D1).',
    );
  }

  if (bypassRate > BYPASS_THRESHOLD) {
    add(
      'decorative-approval',
      `${bypassed} of ${sampled} sampled merges landed with no approving review, while ${requiredApprovals} approval(s) are required`,
      'The requirement is being walked through rather than met. The symptom: an approval gate that records approvals it never received (merge-path.md D5).',
    );
  }
}

// ------------------------------------------------------------------- report

const census = {
  repo: REPO,
  branch,
  required_approvals: requiredApprovals,
  required_checks: requiredChecks.map((c) => c.context ?? c),
  auto_merge: repo?.allow_auto_merge ?? null,
  merge_queue_required: Boolean(ruleOf('merge_queue')),
  delete_branch_on_merge: repo?.delete_branch_on_merge ?? null,
  sampled_merges: sampled,
  merged_without_approval: bypassed,
  self_merged: selfMerged,
};

if (JSON_OUT) {
  console.log(JSON.stringify({ census, findings, unreachable }, null, 2));
} else {
  console.log(`merge-path: ${REPO ?? '(unresolved)'} @ ${branch}`);
  console.log(
    `  approvals required: ${requiredApprovals} · required checks: ${census.required_checks.length} · auto-merge: ${census.auto_merge}`,
  );
  console.log(`  sampled merges: ${sampled} · without approval: ${bypassed} · self-merged: ${selfMerged}`);
  for (const f of findings) {
    console.log(`\n  [${f.class}] ${f.message}`);
    console.log(`    ${f.detail}`);
  }
  for (const u of unreachable) {
    console.log(`\n  SKIPPED ${u.what} (${u.path})`);
    console.log(`    ${u.detail}`);
  }
  if (findings.length === 0 && unreachable.length === 0) console.log('\n  clean');
}

// The trailer is human-mode only: appending it under --json would emit invalid
// JSON in exactly the case --json exists to report. Machine consumers read the
// `unreachable` array, which is never absent when a scope failed.
if (!JSON_OUT && unreachable.length > 0) {
  console.log(
    `\nSKIPPED: ${unreachable.length} scope(s) unreadable — this run is NOT evidence that the merge path is sound.`,
  );
}

if (GATE && unreachable.length > 0) process.exit(2);
if (GATE && findings.some((f) => f.class === 'ungated' || f.class === 'merge-queue-deadlock')) process.exit(1);
process.exit(0);
