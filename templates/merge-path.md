<!-- template: merge-path.md v1.1.0 · updated 2026-09-19 -->
# Merge path

How a reviewed change becomes a merged change, and which of those steps a human
performs.

This policy exists because of a failure that looks like friction and is actually a
broken gate. Its subject is narrow: the GitHub configuration between "the work is
done" and "it is on the default branch." It says nothing about what makes a change
good — that is the Definition of Done's job.

## 1. The failure this prevents

**GitHub refuses `APPROVE` and `REQUEST_CHANGES` from a pull request's own author.**
That rule is correct and unavoidable. It becomes a trap the moment a repository has
two ways of producing pull requests that author under *different* identities:

- An agent dispatched by the platform pushes under a **bot** identity. A human can
  approve it.
- An agent running in an interactive harness pushes under the **operator's own**
  identity. That operator cannot approve it.

A second machine identity *can*: where the platform reviews with an App that is not the
pull request's author, a dispatched review run casts a binding approval on either path.
So the requirement is not strictly unsatisfiable — it is unsatisfiable **by the person who
is actually there**, and satisfiable otherwise only by dispatching a run, per pull request,
at a cost, as a separate deliberate act. Read the history before concluding which you have:
a repository where the capability exists and the approval rate is still near zero has a
requirement nobody is exercising, which is the same bypass habit by a longer route.

A single `required_approving_review_count >= 1` rule cannot be right for both. Set it,
and every interactive-harness pull request is unmergeable by the operator sitting in front
of it — it waits on a dispatched review run or on administrative bypass, and in practice it
gets the bypass. The observed end state (2026-09-19, ai-fleet): every open pull request
authored by the operator, a fully green check set on each, and a merge path whose
only exit was the bypass dialog. The approval requirement had become a second
confirmation click carrying no signal — strictly worse than no requirement, because
the audit trail records an approval gate that never once approved anything.

The lesson generalizes past this one repository: **a gate no existing party can
satisfy is not a strict gate, it is a bypass habit.** Bypass habits are invisible in
configuration and obvious in history, which is why the check below reads both.

## 2. Decisions

**D1. The verdict branch protection depends on is a check run, not a review.**
Check runs carry no author restriction. The same rule therefore covers bot-authored
and human-authored pull requests, and the identity of the pull request's author stops
being an input to whether the repository's rules are satisfiable. A reviewing agent
that can only ever land a `COMMENT` on its own side's work delivers no verdict the
rules can read; the identical analysis, reported as a check, is a gate.

This governs **what the rules read, not what a review is.** A review run whose
deliverable is an inline GitHub review — findings anchored to diff lines, in a thread
the author can answer — is untouched by this and remains the right shape for findings;
a check run is a verdict with nowhere to put the reasoning. The two are complementary:
the thread carries the argument, the check carries the answer. Where a repository has
both, state which one the branch rules read. A repository whose written policy says
"the machine verdict is a check" while its review agents are instructed to produce
reviews has not chosen — it has two half-mechanisms and a gate that reads neither,
which is §1's failure wearing a different hat.

**D2. Branch rules are expressed as required checks, not required approvals.**
`required_approving_review_count` stays at 0 unless the repository has human reviewers
who are reliably *not* the author. It is not a proxy for "somebody looked" — a check is.

**D3. Auto-merge is enabled so a human decision is durable.**
Enabling auto-merge does not remove the human. It makes the human's click survive the
CI wait: "merge when ready" is pressed once, at the moment of decision, instead of
being re-pressed after every check set finishes. A repository that keeps a human on
every merge needs this *more* than one that does not, because the human is the party
paying the return-visit cost.

**D4. One merge method, and heads are deleted on merge.**
A merge-method dropdown is a decision presented on every merge that is in fact
repository-wide. Pick one (squash, unless the history argues otherwise), disable the
others, and turn on automatic head-branch deletion.

**D5. The bypass list is empty, and bypasses are counted.**
An empty bypass list is what makes the remaining rules mean something. Where a bypass
is genuinely required, it is a finding to be explained, not a standing grant. The check
below counts merges that landed without satisfying the stated requirement — the number
is the evidence for whether the rules describe the repository or merely decorate it.

**D6. The verdict is computed from the base branch, never from the pull request's head.**
A review check whose configuration, prompt, or ruleset is read out of the branch under
review can be widened by the change it is meant to judge. This is the same defect as
injecting deny-rules into a configuration file the governed agent can write: *a policy
the governed thing can edit is not a policy.* Workflow and policy files are their own
flagged class for this reason.

**D7. The rules do not get looser than the checks they replace.**
Removing an approval requirement is safe only while the required-check list is
non-empty. A repository with auto-merge enabled, one click to merge, and nothing
required is not a streamlined merge path — it is an unreviewed one. The check treats
this combination as its only blocking finding.

**D8. A merge queue is required once merge volume makes "up to date" a treadmill — and it
has one prerequisite that deadlocks the repository if skipped.**

"Require branches to be up to date" is correct in principle and unusable at volume: every
merge invalidates every other open pull request's up-to-date status, so on a repository
merging ten or more changes a day it converts one click into a serial update loop. A merge
queue is the mechanism that keeps the guarantee — nothing merges untested against what is
actually ahead of it — without the treadmill. It also tests the *merged result* rather than
a stale head, which is the only way a conflict-shaped failure gets a CI signal before it
lands.

The prerequisite: **every workflow supplying a required check must also trigger on
`merge_group`.** The queue builds a temporary branch and waits for the required checks to
report on *it*. A workflow that triggers only on `pull_request` never runs there, the check
never reports, and the entry waits forever — so turning the queue on without this does not
degrade the merge path, it stops it completely, for every pull request at once. Enable the
triggers first, in their own change, and confirm they run; flip the setting second.

Below roughly ten merges a day, skip the queue. It adds a wait and a failure mode, and
"require branches up to date" alone is survivable at that rate. This is a threshold, not a
principle.

## 3. Configuration

On the default branch:

| Setting | Value | Which decision |
|---|---|---|
| Require a pull request before merging | on | — |
| Required approving reviews | **0** | D2 |
| Required status checks | the repository's gates, **non-empty** | D7 |
| Require branches up to date | on **only without a queue** — the queue supersedes it | D8 |
| Require merge queue | on above ~10 merges/day, **after** `merge_group` triggers ship | D8 |
| Require linear history | on | D4 |
| Block force pushes | on | — |
| Bypass list | **empty** | D5 |

Repository-level:

| Setting | Value | Which decision |
|---|---|---|
| Allow auto-merge | **on** | D3 |
| Merge methods | exactly one enabled | D4 |
| Automatically delete head branches | on | D4 |

Agent-side convention: a pull request opens as a draft only while it is genuinely
incomplete. An agent that has satisfied its own Definition of Done marks the pull
request ready itself — "ready for review" is otherwise a click the human pays on every
pull request to record something the agent already knew.

## 4. Enforcement

`scripts/check-merge-path.mjs` reads the live configuration *and* recent merge history.
Configuration alone cannot distinguish a rule that holds from one that is bypassed
weekly, which is exactly the failure in §1.

| Class | Source | Severity |
|---|---|---|
| `ungated` | config | **blocking** under `--gate` (D7) |
| `click-tax` | config | report (D3) |
| `merge-friction` | config | report (D4) |
| `self-authored-block` | history | report (§1 — the cause) |
| `decorative-approval` | history | report (D5 — the symptom) |
| `merge-queue-deadlock` | config + workflows | **blocking** under `--gate` (D8) |
| `unreachable` | — | SKIPPED, never clean; exit 2 under `--gate` |

**Observed baseline (ai-fleet, 2026-08-19 → 2026-09-19, the repository this policy
was written from):** 382 merged pull requests, of which **30 carried an approving
review** — 352, or **92%, merged with no approval at all**. That is the §1 failure
measured rather than argued: whatever the stated requirement was, it was met on one
merge in thirteen. The default thresholds below (25% bypass, 50% self-merge) are set
to detect this condition, not to describe an acceptable rate.

Note the sample size this needs. A repository merging six pull requests a month cannot
produce a stable rate, so the history half stays quiet on low-traffic repositories
rather than reporting noise as a finding — check the `sampled_merges` census before
reading anything into a clean history result.

The two history classes ship **report-only and threshold-based**. A threshold nobody
has run against a real repository is a guess, and a guessed threshold that gates is a
lint that gets disabled. Promote them to blocking after one audit cycle in which the
observed rate is stable and the thresholds have been set from it — the same promotion
discipline `lint-stub-tests.mjs` and `check-weakened-verification.mjs` ship under.

## 5. Falsifier

This policy is wrong if, after adoption, merges do not get cheaper or do get less
safe. Concretely, it is falsified by either of:

- **`decorative-approval` stays above threshold after approvals are set to 0.** The
  diagnosis in §1 blamed the approval rule for bypass behaviour. If bypasses persist
  once the rule is gone, they were never about approvals and this policy treated a
  symptom.
- **A defect reaches the default branch that a required approval would have caught and
  a required check did not.** D1 claims a check can carry a verdict a review carried.
  One such escape falsifies that claim for this repository and the approval requirement
  comes back with a reviewer identity attached.

Both are observable from the same data the check already collects.
