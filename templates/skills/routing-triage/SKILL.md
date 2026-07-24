---
name: routing-triage
description: >
  Bootstrap or refresh a repo's agent-routing tiers. Probes the codebase for its risk
  surfaces — isolation boundaries, credential handling, uncovered code, dropping
  migrations — then classifies open issues by the failure mode their botched
  implementation would produce, not by difficulty. Proposes an `impl:` tier and a kind
  (`spec` or `inherent`) with a one-line reason for each, surfaces the disputed calls for
  a human, applies the labels and tier lines, and writes the repo's calibration set to
  docs/agent-routing.md.
version: 1.0.0
triggers:
  - /routing-triage
  - /routing-triage refresh
---

# Agent Routing Triage

Governed by **`docs/agent-routing.md` in this repo**. Read it before running this skill — the
tier definitions, the two load-bearing rules, the escalation responses, and the downgrade
rules are there, not here. This file is only the procedure.

**If `docs/agent-routing.md` does not exist, the install is incomplete — stop and say so.**
The policy must be materialized into the repo before the skill runs, because the skill is
useless to anyone who cannot read the policy, and not everyone running it has access to the
governance repo. Do not silently fall back to a path outside this repository.

**This skill must be run by a frontier-class model or a human.** Triage is itself a
frontier task: the router has to be smarter than the routed. A standard-class model
running this skill will systematically under-call the tiers it is about to be handed,
which is the exact conflict of interest the policy exists to prevent. If you are not
frontier-class, stop and say so.

**Bounded by default.** Do not attempt a whole backlog on the first run. Triage 15–30
issues, confirm the calls, build the calibration set, then widen. A 200-issue pass
produces 200 unexamined guesses and no calibration.

---

## Step 0: Discover the repo

Do not assume any of this — find it.

```bash
# The existing label taxonomy — you are adding to it, not replacing it
gh label list --limit 200

# The bounded candidate set. Prefer issues that are ready to be worked:
gh issue list --state open --label "status:ready" --limit 200 \
  --json number,title,labels,body

# Does the repo already have routing?
gh issue list --state open --label "impl:standard" --limit 1 --json number
ls docs/agent-routing.md 2>/dev/null
```

Then map the repo's **risk surfaces**, because the heuristics table is unusable without
them. You are looking for the paths where a wrong change fails silently:

1. **Isolation and tenancy.** Grep the source and the ADRs for the repo's own vocabulary —
   `tenant`, `workspace`, `org`, `RLS`, `row.level`, `scope`, `isolation`. Read any ADR that
   governs a boundary. Record the paths.
2. **Credentials and secrets.** Where are keys read, granted, or rotated? Which modules
   touch the secret store?
3. **Safety invariants.** Grep for fail-closed guards, feature flags that gate a security
   check, `allow`/`deny` defaults. Anything whose *removal* is the dangerous direction.
4. **Migrations.** Find the migration directory. Note which migrations drop or rename.
5. **Coverage.** Find the test config and any coverage report. Which directories have real
   tests, and which have none? This is the single highest-value input — an uncovered
   surface pushes everything touching it up a tier.
6. **Existing patterns.** Which abstractions already exist? Work that copies an existing
   pattern is `standard`; work that invents one is `frontier`.

Write the surface map down before classifying anything. Every tier call you make will cite it.

---

## Step 1: Spawn the evidence agent

Give it the surface map from Step 0 and the candidate issue set. Its job is to classify,
not to decide — it produces proposals a human will dispute.

### What to read

- The full body of every candidate issue, not just the title. The tier depends on how well
  the issue is *specified*, which is only visible in the body.
- The files each issue names, if it names any. An issue with no file anchors is already
  showing you something.
- The surface map from Step 0.

### What to produce

#### 1. Proposed tiers (the main table)

One row per issue. Every row cites evidence — a path, a test file's absence, an ADR.

**The rows below are illustrative shapes, not classifications to copy.** Do not anchor on
them: the same-looking issue in your repo may sort differently, and a seeded example that
disagrees with the merits will drag every triager toward the wrong call.

| # | Proposed | Kind | Failure mode if botched | Evidence |
|---|---|---|---|---|
| NNN | standard | — | loud — type error at build | no risk surface touched; `[dir]/` covered by [test] |
| NNN | frontier | inherent | silent — wrong scope returns plausible rows | touches [isolation path]; no cross-tenant test exists |
| NNN | frontier | spec | loud, but "correct" is undefined | no tolerance threshold stated in the AC |
| NNN | human | inherent | silent — removes a fail-open guard | [safety invariant path] |

**The "failure mode" column is the load-bearing one.** If the agent cannot state what a
botched implementation would look like and whether anyone would notice, it has not done the
classification — it has guessed at difficulty. Reject those rows and make it redo them.

#### 2. Kind splits that matter

List every issue proposed above `standard` where the kind is **`spec`**, with the specific
sentence that is missing. These are not routing decisions — they are authoring bugs, and
each one is a candidate for rewrite-then-downgrade. This list is the skill's highest-value
output.

#### 3. Disputed calls

Issues where two signals point different directions, or where the agent's confidence is
low. Present them with the case for each tier. Do not let the agent break its own ties —
these are the interview.

#### 4. Escalate-only lint candidates

Path patterns that appeared in three or more `inherent` escalations. These are mechanically
detectable and belong in the Layer 5 lint later: "any issue touching `X/` is at least
`frontier`."

#### 5. What the backlog cannot tell you

Issues whose tier depends on intent the body does not carry. Do not guess these — they go
to the human verbatim.

---

## Step 2: Wait, then interview

Bring the human the disputes and the `spec` list. Not the whole table — the table is mostly
uncontroversial and reviewing 30 obvious rows exhausts the attention you need for the six
that matter.

Ask, in this order:

1. **The disputed calls, one at a time.** Present both cases, ask for the call and the
   *reason*. The reason becomes the tier line.
2. **The `spec` escalations.** For each: "this is frontier only because the issue doesn't
   say [X]. Do you want to answer that now and drop it to standard, or leave it?" Many will
   be answerable in a sentence — that is the whole point of the kind split, and the fastest
   demonstration of why it exists.
3. **Split candidates.** For every escalated issue, ask whether a mechanical half can be
   lifted out: plumbing, config, scaffolding, the cost cap around the admission logic. If
   yes, propose the split — it is usually the highest-value response available, and it is
   the one triagers forget. See *Responses to an escalation* in the policy.
4. **The surfaces you could not classify.** Verbatim.
5. **Nothing else.** Do not ask the human to confirm the obvious rows.

If the human disagrees with a call, ask what signal you missed, then check whether that
signal applies to other rows too. One correction usually moves several.

---

## Step 3: Apply

Only after confirmation. Never bulk-apply proposed tiers unreviewed.

Create the labels if they do not exist:

```bash
gh label create "impl:standard" --color 0E8A16 --description "Any capable coding model can implement from the issue as written"
gh label create "impl:frontier" --color D93F0B --description "Frontier model may implement autonomously; non-frontier should not"
gh label create "impl:human"    --color B60205 --description "Needs a human in the loop regardless of model capability"
```

Then, per issue: apply the label, and **append the tier line to the body**. The label routes;
the line explains. An issue with a label and no line is malformed — the next agent sees a
constraint with no reason and cannot tell whether it still applies.

```
## Impl tier
frontier (inherent) — touches the [boundary]; a wrong scope returns plausible-looking
rows and no test covers cross-tenant reads.
```

Edit bodies with `gh issue edit <n> --body-file <tmp>`; read the current body first and
append, never overwrite. If the repo has an issue-body schema, the block goes where the
schema says.

**Rewrite before you label** any issue the human chose to answer in Step 2.2 — fix the body,
*then* apply the lower tier. The downgrade and the spec fix land in the same edit. That
ordering is the anti-gaming rule, and this is the run where you establish it.

---

## Step 4: Extend docs/agent-routing.md

The policy was installed here before the run (Step 0 refused to start otherwise). You are
appending this repo's own records to it — not creating it, and not editing the policy text
above them. Three sections:

1. **The model→class mapping**, dated. Which model IDs count as standard and frontier
   *today*. This is the file that churns; the labels never do.
2. **The calibration set** — 5–8 of the issues you just triaged, with tier, kind, and the
   one-line reason. Pick the ones that were *disputed*, not the obvious ones: the value of a
   calibration set is settling future arguments, and the obvious cases never generate any.
3. **Repo-specific surfaces** — the map from Step 0, so the next run does not rediscover it.

Do not copy another repo's calibration set. The examples only work if the people triaging
recognise them.

Then add the routing block to CLAUDE.md / AGENTS.md — the template is at the end of
[agent-routing.md](../../agent-routing.md).

---

## Step 5: Branch, commit, open PR

```bash
git checkout -b governance/agent-routing
git add docs/agent-routing.md CLAUDE.md
git commit -m "governance: agent routing tiers + calibration set"
gh pr create --title "governance: agent routing tiers" --body "..."
```

The PR body reports: how many issues triaged, the tier distribution, the `spec` count and
how many were fixed-and-downgraded in this pass, and the lint candidates from Step 1.4.

---

## Step 6: Present

Report to the human:

- Tier distribution across the triaged set.
- **Spec-escalation ratio** — `spec` escalations as a share of the set. This is the number
  that trends down over time; today's run is the baseline, so state it plainly.
- Issues rewritten-and-downgraded in this pass.
- Lint candidates for Layer 5.
- Which surfaces from Step 0 had no coverage — hand this to `test-coverage-interview`,
  because coverage on those surfaces is what makes their issues cheap to route.

---

## Refresh mode (`/routing-triage refresh`)

Triage only what is new or changed:

- Open issues with no `impl:` label.
- Issues whose body changed materially since their tier was set — the spec may have improved.
- Every `spec` escalation older than one audit cycle: it has been sitting there being
  expensive. Re-ask whether the missing sentence can be written now.
- Any surface where coverage was added since the last run — those issues may drop a tier,
  and this is the good kind of downgrade.

Do **not** re-triage `inherent` escalations looking for savings. They move when the
architecture moves, which arrives as an ADR, not as a triage pass.

---

## Tips

- Read the body before the title. Titles describe intent; tiers depend on specification.
- "I would have to think about it" is not a tier signal. "A wrong answer here looks right"
  is.
- Epics get a tier table over their children, not a single tier. An epic whose children
  span standard→human is normal and useful; collapsing it to `human` strands the mechanical
  work.
- If more than half the escalations are `spec`, stop triaging and say so. The finding is
  that the backlog is unauthored, and more labels will not fix it.
- If nothing comes out `inherent`, you have not found the repo's risk surfaces. Go back to
  Step 0.
