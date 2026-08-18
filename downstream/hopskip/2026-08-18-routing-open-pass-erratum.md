# Erratum: the routing open pass is a scheduled probe, never a per-PR gate (2026-08-18)

**Applies to:** the three governed repos that adopted the routing layer (ai-fleet,
analytics-infrastructure, enrichment-pipeline). infra-ops never installed it — no action.
**Corrects:** the 2026-08-14 routing-kind-enforcement prompt, **step 3** ("wire the open
pass as a gate… ai-fleet: an npm script in `host/package.json` plus a `run-tests.yml`
step") and its line 107 phrasing ("a repo can wire the open pass as a blocking gate").
Both are retracted.
**Ships with:** this PR carries the upstream half —
`templates/workflows/issue-routing-probe.yml` 1.0.0, the probe wiring the
`check-issue-routing.mjs` header always documented. Steps 1–3 are runnable on merge.
**Already applied:** ai-fleet PR #2006 (2026-08-18) — the incident repo, fixed same-day.
analytics-infrastructure and enrichment-pipeline never wired the open pass anywhere
(recorded in their CLAUDE.md prompt logs), so their only action is step 1's grep and,
when they do wire it, the probe template — not a lint job.

## What happened

The 08-14 prompt's step 3 contradicted the script's own header, which has said since
1.0.0: `workflow: on: schedule + workflow_dispatch (not per-PR — it is a backlog sweep,
not a diff check)`. The prompt overrode the template; the template was right.

ai-fleet applied step 3 at 11:30 UTC on 2026-08-18. Within four hours:

- **12:57** — the PR for issue #1832 went red: #866 gained `impl:frontier` mid-triage
  with no tier line yet (R2/R3).
- **13:58** — the same branch went green with no code change (someone finished typing).
- **14:25** — an unrelated docs PR went red: #866 still open, plus #1999 created with a
  tier line minutes before its label (R1).

Neither blocking issue was touched by the PRs it blocked. The step-3 pre-gate sweep
("fix or grandfather every finding, then wire the gate") cleaned the backlog at gate-on
time and could not help the steady state: **the gate's input is the live issue
database, writable by anyone at any time — including people mid-triage, whose transient
states (label before tier line, tier line before label) are R1–R3 violations for
minutes at a time.** A per-PR gate must be a function of the PR's diff. A global
backlog invariant can never be that, and wiring it as one hands a denial-of-service on
the merge queue to anyone with issue-write access.

## The rule

The open pass is a **probe**: scheduled, R1–R3 still `error` severity so a red run
demands triage attention — but the blast radius of a violation is one red cron job,
not every open PR. This is the same shape as the closed pass (08-14 prompt, step 4),
the stale-blocker probe (2026-08-18), and the scheduled audit itself: **anything whose
input is live external state rather than the diff runs on a schedule.** Diff-scoped
gates gate; state-scoped checks probe.

## Steps

1. **Check your wiring:**
   ```bash
   grep -rn "check-issue-routing" .github/workflows/ */package.json package.json 2>/dev/null
   ```
   If the only hits are scheduled workflows and npm wrappers: done, record the erratum
   as applied. If a per-PR job (your PR-gate workflow) invokes the open pass: step 2.

2. **Move the open pass to the probe.** Install
   `templates/workflows/issue-routing-probe.yml` as
   `.github/workflows/issue-routing-probe.yml` (adjust the cron to land before your
   weekly triage/audit), and remove the open-pass step from the PR-gate workflow,
   leaving a comment pointing here so it is not re-added by pattern-matching the other
   lints. ai-fleet PR #2006 is the reference diff, including the reason comment.

3. **Close the coverage-lint hole, if you have one.** ai-fleet's
   `check-lint-ci-coverage.mjs` asserted every lint is referenced in its PR-gate
   workflow — removing the gate step would have tripped it, and a silent exemption
   would have recreated the ten-days-dead failure mode that script exists to catch.
   The reference diff adds a *declared* `WIRED_AS_PROBE` set: probe entries are exempt
   from the PR-gate workflow but still asserted wired in **some** workflow. If your
   repo has an equivalent lint-coverage check, apply the same shape; if it does not,
   no action.

## Verification

```bash
# The open pass is wired on a schedule, not on PRs
grep -rn "check-issue-routing" .github/workflows/   # hits only in issue-routing-probe.yml / routing-closed-pass.yml
# The probe runs green manually
gh workflow run issue-routing-probe.yml && gh run list --workflow issue-routing-probe.yml --limit 1
# The lint-coverage check (where it exists) still passes
npm run lint:lint-ci-coverage                       # ai-fleet
```

The verification observes the *effect* (no per-PR invocation remains, the probe
executes) rather than grepping only the file this prompt just told you to write.
