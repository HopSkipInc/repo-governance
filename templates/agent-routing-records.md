<!-- template: agent-routing-records.md v1.0.0 · updated 2026-07-26 -->
# Agent Routing — Records for [repo]

**Policy version these records were written against:** [X.Y.Z]
**Last reviewed:** [YYYY-MM-DD]
**Policy:** [`docs/agent-routing.md`](agent-routing.md)

> **This file never syncs.** It is the per-repo counterpart to the policy, which is
> byte-identical everywhere. Everything here is a *record* — dated, local, and unreconstructible
> from upstream. A `cp` from the governance repo must never touch this file, and a repo that
> inherits another repo's calibration examples has inherited a vocabulary its triagers cannot
> recognise.
>
> Kept separate from the policy because the two were one file until policy 1.9.0, and the
> conventional boundary inside it got crossed: the policy said "append your records here" while
> the adoption checklist verified the same file was identical to the template. The file boundary
> is the fix — see *Cross-repo consistency* in the policy.

---

## 1. Model → class

What a model *is*. Changes when a model's capability is reassessed — not when a harness renames
something. **Never write a model name into a label**; this table is the one place they belong.

| Class | Models | As of |
|---|---|---|
| standard | [model names] | [YYYY-MM-DD] |
| frontier | [model names] | [YYYY-MM-DD] |

Notes on contested calls — record *why*, because the next reviewer will re-litigate it otherwise:

- [e.g. "X is `standard`, not `frontier`, recorded because a run self-described as frontier."]

## 2. Model → harness route

How each harness *addresses* the models above. Changes when a harness renames a slug, adds a
provider, or a model ships somewhere new. A row here is an address, never a capability claim.

| Model | Claude Code | opencode | [other harness] |
|---|---|---|---|
| [model name] | `[slug]` | `[provider/slug]` | — |

## 3. Classifier pins

The `routing-classifier` agent pins its model in frontmatter; that pin is what makes triage
un-self-certifiable. **Every pin must resolve to a model this file lists as `frontier`** — that
is the check this table exists to make possible without reading a harness's model catalogue.

| Harness | Pin file | Resolves to (model) | Class | Reviewed |
|---|---|---|---|---|
| Claude Code | `.claude/agents/routing-classifier.md` | [model name] | frontier | [YYYY-MM-DD] |
| opencode | `~/.config/opencode/agents/routing-classifier.md` (global) | [model name] | frontier | [YYYY-MM-DD] |

Local deviations from the agent template, if any, and why they were preserved:

- [e.g. "`hidden: false` so the agent is invocable from the picker."]

## 4. Routing ratio

The frontier ratio is a **decomposition** metric — see the policy. Targets ramp: bootstrap
records a baseline and targets nothing, adopting ≤ 20%, mature ≤ 10%.

| Reading | Date | Escalations / tiered | Stage | Target | Decomposition record |
|---|---|---|---|---|---|
| Baseline | [YYYY-MM-DD] | [N]/[M] ([P]%) | Bootstrap | record only | [N] split, [N] declared, [N] undeclared |

Readings come from `check-issue-routing.mjs`, which prints the census:

```bash
ROUTING_REPO=[owner]/[repo] node scripts/check-issue-routing.mjs
```

**Decomposition debt** — escalations ÷ distinct surfaces they name: [N]. A high number means
issues are scoped by component rather than by failure mode, and the fix is upstream in
authoring, not in triage.

## 5. Calibration set

5–8 real issues from *this* repo as worked examples. Triage disputes get settled by nearest
neighbour against this set, not by re-arguing the heuristics table.

Head it `(provisional — built from open issues on the bootstrap run, YYYY-MM-DD)` on a first
run. Promote a row to **confirmed** when its issue closes and the outcome matched the tier;
**correct** it when the outcome contradicted the tier — a provisional row that turned out wrong
is the most instructive entry the set will ever have.

The **classification is frozen at triage time**: a `both` issue whose spec was later fixed stays
`both` here and reads `inherent` on the issue itself. Those answer different questions.

### Calibration set (provisional — built from open issues on the bootstrap run, [YYYY-MM-DD])

Sample composition: [N issues — what fraction from a single epic, how many carried the
under-structure marker]. A ratio without its sample is not a number.

| # | Tier | Kind | Why | Status | Outcome evidence |
|---|---|---|---|---|---|
| [N] | [tier] | [kind] | [one line — the failure mode, not the difficulty] | provisional \| confirmed \| corrected | [what closed it, and whether the call held] |

**Spec-escalation ratio:** [N] of [M] ([P]%) — measured on the classification, before
responses. Resolved by rewrite: [N]. Resolved by split: [N].

## 6. Repo-specific risk surfaces

The map from the classifier's Step 1, so the next run does not rediscover it.

| Surface | Paths | Why it fails silently | Covered by tests? |
|---|---|---|---|
| [e.g. tenant isolation] | [paths] | [what a wrong change looks like] | [no / partial / yes] |

## 7. Escalate-only lint candidates

Path patterns that appeared in three or more `inherent` escalations — mechanically detectable,
and candidates for the Layer 5 lint ("any issue touching `X/` is at least `frontier`").

- [pattern] — [count] escalations

## Review log

| Date | Policy version | What changed |
|---|---|---|
| [YYYY-MM-DD] | [X.Y.Z] | [e.g. initial records from the bootstrap run] |
