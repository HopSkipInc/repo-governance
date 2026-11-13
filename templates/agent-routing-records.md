<!-- template: agent-routing-records.md v1.3.0 · updated 2026-11-13 -->
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

The `routing-classifier` agent binds its triage class in frontmatter (`# routing-class:`); that
binding is what makes triage un-self-certifiable. **Every pin must resolve to a model this file
lists at the triage class** — through §1/§2 where there is no registry, the registry where there
is one. `check-classifier-pin-drift.mjs` gates that agreement and fails closed.

| Harness | Pin file | Class | Resolved via | Reviewed |
|---|---|---|---|---|
| Claude Code | `.claude/agents/routing-classifier.md` | [class] | §1/§2 or registry | [YYYY-MM-DD] |
| opencode | `~/.config/opencode/agents/routing-classifier.md` (global) | [class] | §1/§2 or registry | [YYYY-MM-DD] |

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

## 8. Risk → class rule

Maps an issue's `risk:` labels to a minimum capability class. **The rule names classes,
never models** — a class resolves to a model through §1/§2. Gate labels are orthogonal:
they record human completion and do not change the class.

**Highest signal wins.** The derived class is the highest class among the rows for the
labels the issue carries. Zero labels uses the `(none)` row. The default below is the
policy's assignment-heuristics table read as a function; a repo may change a row, and
changing the rule never touches an issue.

| Risk label | Minimum class |
|---|---|
| (none) | standard |
| `risk:silent-failure` | frontier |
| `risk:boundary` | frontier |
| `risk:irreversible` | frontier |
| `risk:new-abstraction` | frontier |
| `risk:uncovered` | frontier |

`check-routing-equivalence.mjs` reads this table by its section heading and applies it to
the open backlog. Every difference from an issue's `impl:` tier is resolved on the record —
the issue is re-tiered, or the rule is changed — before `impl:` is retired for any consumer.

## 9. Approval posture

**Posture:** `solo` | `reviewed`
**Set by:** [name, not a role]
**Set on:** [YYYY-MM-DD]
**Decision:** [the PDR/ADR that authorizes the posture]
**Re-enable when:** [a named trigger — a second engineer with merge rights, the first paying
client live, or a production incident whose cause a second reviewer would have caught]
**Hard core (still gated):** irreversible production data deletion/drop/rename; `gate:decision`
generally (a PDR/ADR is owned by a person); money movement and external contracts or legal
commitments; a credential the org does not delegate to a service identity.
**Standing grants:** [what an agent may execute without per-action approval — environment,
scope, and the controls it must pass first]
**Substitute controls:** CI on every change; a post-deploy smoke check that observes the
effect; a tested backup and rollback path; the evidence attached to the PR. A control that does
not apply to a surface this posture covers is recorded `n/a — <reason>`, not omitted.

`reviewed` keeps the required-reviewer gates and per-action approval. `solo` turns them off for
automated deploys and repeatable operations and replaces them with the standing grants above;
the hard core stays gated. **An absent approval in `solo` is expected, not a finding** — read
this section before restoring a gate. Changing the posture is one owner edit to this section,
not a code change. Decision model: repo-governance PDR-012.

## Review log

| Date | Policy version | What changed |
|---|---|---|
| [YYYY-MM-DD] | [X.Y.Z] | [e.g. initial records from the bootstrap run] |
