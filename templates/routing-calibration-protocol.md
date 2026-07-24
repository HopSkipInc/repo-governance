<!-- template: routing-calibration-protocol.md v1.1.0 · updated 2026-07-24 -->
# Routing Calibration Protocol

**Status:** Experiment protocol — run once per repo to calibrate `impl:` tiers against reality
**Related:** [Agent Routing](agent-routing.md) · [Governance Health](governance-health.md)

## Purpose

Tiers assigned by a frontier model are **assertions about what a cheap model would botch,
made without a cheap model in the room.** This protocol falsifies them: predict every tier,
then let a non-frontier model actually attempt the work, then measure the gap.

It is the only procedure here that can prove the taxonomy wrong. Run it in a repo where a
botched attempt is cheap — greenfield, pre-consumer, or a throwaway branch stack.

---

## The measurement problem — read this before designing the run

**Silent failures are invisible to the obvious success metric.** That is what `inherent`
means. If the weak model botches an isolation change, CI is green and the PR looks finished.

So *"did tests pass"* and *"did it merge"* **cannot be the outcome variable.** Use them and
the experiment reliably concludes that the cheap model handled everything and the taxonomy
is unnecessary — the exact failure the taxonomy exists to catch, faithfully reproduced by
the study measuring it.

**Every attempt needs an independent frontier review pass, judging correctness on the
merits, blind to the predicted tier where practical.** That is the expensive half of this
protocol and it is not optional. Without it the `frontier`-predicted / weak-model-succeeded
cell is uninterpretable: it is either an over-call or an undetected botch, and those have
opposite implications for everything downstream.

If you cannot afford the review pass, run a smaller sample. Do not run a larger one cheaply.

---

## Prerequisites

1. **Triage first, and freeze the predictions.** Every candidate issue carries an `impl:`
   tier, a kind, and a one-line failure-mode prediction *before* any implementation attempt.
   Commit the prediction table. If classification happens after the attempts, you have a
   narrative, not an experiment — and you will never fully trust labels written by someone
   who had already seen the failures.
2. **Record the model actually under test**, with version, and the harness it runs in. The
   harness is part of the result; the same model in a different harness is a different data
   point.
3. **Blast-radius check.** Attempts land on unmerged branches. No migration that drops or
   renames is in scope regardless of how safe the repo looks.

---

## Run parameters

| Parameter | Value | Why |
|---|---|---|
| Attempts per issue | 3, then stop | Matches the deployable stop condition; more attempts measure persistence, not capability |
| Stop conditions active | Yes, all of them | You are testing the deployed configuration, not the model in the abstract |
| Branch policy | One branch per attempt, none merged | Preserves the failures for review |
| Review | Frontier pass, per attempt, blind to tier | See the measurement problem above |
| Migrations | Out of scope | Non-negotiable |

---

## The prediction table

Frozen before the run. One row per issue.

| # | Predicted tier | Kind | Predicted failure mode | Evidence |
|---|---|---|---|---|
| NNN | standard | — | loud — build breaks | no risk surface; covered by [test] |
| NNN | frontier | inherent | silent — returns plausible wrong rows | [boundary path]; no test |

## The outcome table

Filled after the run. Never edit the prediction table to match.

| # | Attempts | Stop condition | CI result | **Frontier review verdict** | Cell |
|---|---|---|---|---|---|
| NNN | 1 | none | pass | correct | ✅ predicted-standard, succeeded |
| NNN | 3 | 3-attempts | fail | n/a | ✅ predicted-frontier, failed loudly |
| NNN | 1 | none | pass | **incorrect — under-blocks** | ⚠️ **silent botch** |

---

## The 2×2, and the cell that matters

|  | Weak model succeeded | Weak model failed |
|---|---|---|
| **Predicted `standard`** | ✅ Correct call | ❌ **Under-call** — tier was wrong, examine why the signal was missed |
| **Predicted `frontier`/`human`** | ⚠️ **Ambiguous** — over-call *or* silent botch. **Only the review pass distinguishes them.** | ✅ Correct call |

The top-right cell is the cheapest lesson in the protocol: an under-call is a signal you can
read directly off the heuristics table and fix.

The bottom-left cell is the entire reason the protocol exists. Reported as "the cheap model
handled it," it argues for abandoning the taxonomy. Reported after review as "the cheap model
produced a plausible wrong answer nobody would have caught," it is the strongest possible
evidence *for* it. **Same observation, opposite conclusions, distinguished only by whether
you paid for the review.**

---

## Review rubric — what counts as a failure

The frontier review pass judges the *work*, not the build. Three verdicts, and the third is
the one teams forget to look for:

| Verdict | Meaning |
|---|---|
| **correct** | Does what the issue asked, and the proof holds |
| **incorrect** | Wrong behaviour — loud if CI caught it, **silent botch** if it did not |
| **weakened verification** | The deliverable is correct; the *proof* was substituted for an easier one |

**Weakened verification is the one that will slip past you**, because every observable signal
says success: green CI, merged PR, closed issue, working code. It shows up wherever acceptance
criteria ask for something to be *shown to fail* — the implementer finds whichever mutation
turns the build red, which is rarely the rule that was meant.

Check it explicitly: for every issue whose criteria included a proof-of-failure, confirm the
failure that was demonstrated is the failure that was specified. Count these separately. They
are not silent botches — the code is fine — but they leave the same hole in your evidence, and
a run that does not distinguish them will over-report success.

## The spec A/B — run this, it is nearly free

For every issue classified `spec` or `both`, run the weak model **twice**:

1. Against the issue exactly as written.
2. Against the issue after the missing sentence is written in. Same model, same harness,
   same issue — only the specification changed.

| Result | Meaning |
|---|---|
| Fails (1), completes (2) | *A spec-limited escalation is a bug report against the spec* — measured, not asserted |
| Fails both | The kind was wrong; it was `inherent` or `both` all along |
| Completes both | The escalation was unnecessary; the heuristics over-fired |

This is the only experiment here that tests the policy's central claim directly, and it costs
one extra run on a handful of issues. Report the counts even when they are unflattering —
especially then, since "completes both" is the result that should make you loosen the
heuristics.

---

## What to report

1. **Confusion matrix** — the 2×2, filled, with the ambiguous cell resolved by review.
2. **Silent-botch count** — attempts that passed CI and failed review. The headline number.
3. **Spec A/B results** — the three counts above.
4. **Stop conditions: which fired, and did any fire uselessly.** A stop condition that never
   fires is dead weight; one that fires on work the model would have completed is a tax.
5. **Tier corrections** — every row where the outcome contradicts the prediction, and what
   signal in the heuristics table was missing or misread.
6. **Coverage handoff** — surfaces where the weak model failed and no test existed. These are
   the highest-value coverage work in the repo: coverage there is what moves those issues
   down a tier and makes them cheap to route.
7. **Cost** — tokens and dollars by tier, and cost avoided on the issues that completed at
   the cheaper class.

---

## Limits to state before the results arrive

Write these down first, so nobody over-reads the outcome later.

- **A pre-consumer repo cannot test whether silent failure is costly.** It can test whether
  the weak model *completes* the work and whether the tier predicted that. The cost half of
  the `inherent` claim is a prediction about a future state with real traffic. An isolation
  bug with no tenants is not dangerous yet.
- **Thin coverage inflates the frontier population**, correctly — but it means the result is
  partly a measurement of the test suite, not only of the model.
- **A curated sample understates spec debt.** An epic that just went through design or
  pre-implementation review has had its spec debt removed by that review. Draw from the
  general backlog.
- **One model, one harness, one repo.** The result does not generalize to other weak models
  without re-running, and the harness is part of the result.

---

## Output

The run produces three durable artifacts:

1. **The calibration set** for `docs/agent-routing.md` — now backed by observed outcomes
   rather than judgment, which is the strongest form it can take.
2. **Heuristics-table corrections** — proposed back to the governance repo as template
   changes, with the failing rows as evidence.
3. **A coverage work list**, ordered by how many issues each surface would move down a tier.
