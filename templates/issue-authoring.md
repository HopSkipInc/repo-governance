# Issue Authoring

**Status:** Policy — enforced by [your creation tooling, CI validator, and/or periodic audit]
**Related:** [Definition of Done](definition-of-done.md) · [Agent Routing](agent-routing.md)

## Purpose

**Every issue is born actionable.** An issue exists so that a human or an AI agent can pick it up and finish it without re-deriving the intent. That requires three things, present at creation: **verifiable outcomes**, a **verification method**, and the **labels** that route and prioritize the work. An issue without these is a note, not a unit of work — and notes accumulate until someone has to re-author the whole backlog at once.

## The canonical issue schema

Every issue body uses this structure:

```
## Work type
<feature | enhancement | migration | bug | docs | epic | chore>

## Serves
<PDR-NNN — or "none — <one-line reason>". Features and epics only; omit for bugs and chores.>

## Impl tier
<standard | frontier (spec|inherent) | human (spec|inherent) — plus one sentence naming
 what a botched implementation would look like and whether the failure is loud or silent.>

## Verifiable outcomes (binary, observable)
- [ ] <outcome 1 — binary, observable>
- [ ] <outcome 2>

## Verification (how the work is proven done)
- <exact command / named test file / query>

## Definition of Done
- [ ] <the DoD rows for this work type — copy the items that apply>
- [ ] `Fixes #<this>` in the PR description

## Dependencies
blocked-by #X · blocks #Y · child-of #Z — or "none"

## Status
<one line: why ready / needs-decision / blocked / deferred>
```

Rules:

- The body must contain a **Verifiable outcomes** (or **Acceptance Criteria**) section with **at least one** checkbox line (`- [ ]`).
- The body must contain a **Verification** section.
- The body must contain a **Work type** line, **or** carry a type label.
- The body must contain an **Impl tier** line, and any tier above `standard` must declare
  its kind — `spec` or `inherent`. See [Agent Routing](agent-routing.md). An escalation with
  no kind is malformed: without it the tier is permanent, and the whole taxonomy stops
  being self-correcting.

For **epics**: "Verifiable outcomes" = "epic closes when all child issues close" **plus** 2–3 epic-level acceptance gates; list known child issue numbers under Dependencies.

<!-- Delete this rule if your repo has no docs/pdr/ -->
For **features and epics** (only): a **Serves** line naming the product decision this work advances (`PDR-NNN`), or `none` with a one-line reason. Bugs and chores don't carry it — an escape hatch that costs less than a lie is what stops the field from becoming decoration. The audit reports the orphan rate, not a compliance score: a few `none`s are healthy, a majority means the PDR corpus has stopped describing what the team is building.

## Label taxonomy

Labels are not decoration — they route, prioritize, and let a periodic audit reason about the backlog. Every issue carries exactly one priority, one status, and a type; add `area:` / `theme:` families when the repo is big enough to need routing.

| Family | Cardinality | Values |
|--------|-------------|--------|
| **priority** | exactly one | `P0`, `P1`, `P2` |
| **status** | exactly one | `status:ready`, `status:needs-decision`, `status:blocked`, `status:deferred` |
| **type** | one (or a Work-type line) | `enhancement`, `feature`, `bug`, `epic`, `chore`, `documentation` |
| **impl:** | exactly one | `impl:standard`, `impl:frontier`, `impl:human` |
| **gate:** | optional, one or more | `gate:human-approval`, `gate:human-review`, `gate:credentials`, `gate:decision` |
| **area:** | optional, one or more | `[your subsystem names]` |
| **theme:** | optional, one or more | `[your roadmap track names]` |

> GitHub issue **forms** cannot auto-apply prefixed labels from a dropdown selection — forms must ask the author to pick the dropdown **and** apply the matching label. A CI validator can enforce that the labels are actually present.

## Split at authoring, not at triage

An issue that is 80% mechanical and 20% dangerous is two issues. Splitting it is the best
response available — it routes the cheap half cheaply and shrinks the risky half — but it is
**far cheaper at creation than at triage.** Splitting later means a new issue, renumbering,
cross-references, and edits to every epic table that referenced the original.

Two tells, both visible while writing:

1. **"and" in the title.** *"Add the cost cap and the admission logic."* Two units of work with
   different failure modes wearing one number.
2. **The acceptance criteria change character partway down.** The first three items are
   plumbing, config, or scaffolding; the fourth is the entire risk. Cut between them.

If either tell fires, file two issues. The mechanical one is `impl:standard` and can be worked
immediately by anything; the residue carries the boundary and waits for what it needs. See
[Agent Routing](agent-routing.md) → *Responses to an escalation*.

## The layered enforcement model

GitHub cannot restrict who creates an issue through the UI or the API, so enforcement is layered, defense-in-depth. The posture is **label + comment, never auto-close**:

1. **Layer 1 — sanctioned creation path (proactive).** If agents or tooling file issues, the creation tool validates the structure *before* hitting GitHub and refuses to file a malformed issue.
2. **Layer 2 — CI validator (backstop).** A workflow on `issues: [opened, edited]` applies the same rules; on failure it adds a `needs-structure` label and posts a structure-check comment listing exactly what is missing. It never closes or blocks.

   **Routing rules the validator must carry.** These are mechanical, and if they are not in the
   validator they degrade into a manual audit check nobody runs:

   | Rule | Failure |
   |---|---|
   | Exactly one `impl:` label | missing or multiple |
   | Body has an `## Impl tier` line | missing |
   | Tier above `standard` declares a kind (`spec`, `inherent`, `both`) | tier present, no kind |
   | `status:ready` + a `spec`-component kind | contradiction — ready to be *rewritten*, not worked |
   | Carries `needs-structure` + tiered without a `spec` component | contradiction — validator says under-specified, triage says spec wouldn't help; the usual correct answer is `both` |
   | `impl:` label changed with no body edit in the same window | ungrounded downgrade — see Agent Routing → *Downgrades* |

   The last two are the ones worth wiring first: they catch the two ways the taxonomy quietly
   stops meaning anything.
3. **Layer 3 — periodic audit (sweep).** The staleness audit flags every open issue carrying `needs-structure` or failing the rules, as P2-style findings.

Start with Layer 3 (it's free — add it to the audit prompt). Add Layers 1–2 when creation volume justifies them.

## Anti-patterns

Recurring failure modes from the source repo's backlog sweep — each one a reason a rule above exists:

1. **Open questions masquerading as acceptance criteria.** "Decide whether to use X or Y" is a `status:needs-decision` gate, not a verifiable outcome. Outcomes must be binary and observable.
2. **No verification method.** Outcomes with no command, test, or query that proves them — no one can self-verify, so the work never reaches "done."
3. **Forward-references to documents that don't exist.** Citing an ADR (or spec) by a number that hasn't been allocated yet — numbers get taken by other work. Cite what exists; allocate, don't guess.
4. **"Known Gap" without a tracking issue number.** A gap with no number is a gap that never gets fixed.
5. **Missing `Fixes #N`.** PRs that fix an issue but don't link it leave the issue open until the next audit catches it.
6. **Hard-coded sequence numbers in issue bodies.** "Add migration 0205" goes stale the moment 0205 is taken. Reference "the next free number."
7. **Duplicate / stale issues left open after the work shipped.** Run the stale-issue sweep (DoD) at every session and audit boundary.
