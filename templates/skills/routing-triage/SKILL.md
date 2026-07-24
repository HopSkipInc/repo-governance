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
version: 1.1.0
updated: 2026-07-24
triggers:
  - /routing-triage
  - /routing-triage refresh
---

# Agent Routing Triage

Governed by **`docs/agent-routing.md` in this repo**. Read it before running this skill — the
tier definitions, the two load-bearing rules, the escalation responses, and the downgrade
rules are there, not here. This file is only the procedure.

**If `docs/agent-routing.md` does not exist, you are on a bootstrap run.** Do not stop, and
do not proceed without the policy either — materialize it first:

```bash
# Bootstrap: copy the current policy into this repo, then read it from here
mkdir -p docs
cp <governance-repo>/templates/agent-routing.md docs/agent-routing.md
grep -m2 -E '^\*\*Version:|^\*\*Last updated' docs/agent-routing.md   # record this in the run notes
```

If you cannot reach the governance repo, stop and say so — the skill is useless to anyone who
cannot read the policy, and a triager working from memory of a previous version will produce
calls that silently disagree with the current rules.

**Always copy the policy at run start; never trust a local copy that is already there.** The
policy is a synced artifact and has changed mid-adoption before. Compare the `Version:` line
in `docs/agent-routing.md` against the template. If the local copy is behind, re-sync before
triaging and note both versions — the kinds and the escalation responses have changed between
versions, and a run split across two versions is not internally consistent.

**Classification is delegated to the `routing-classifier` agent, which pins its own model.**
Triage is a frontier task — the router has to be smarter than the routed — but asking a model
to certify its own class does not work: the instruction is read by the thing it is meant to
bind. The pin lives in `.claude/agents/routing-classifier.md` frontmatter and is resolved by
the harness at spawn, so the classifier never gets a vote.

**You may run this skill at any model class.** The parts you own — `gh` calls, the interview,
applying the batch, writing records, opening the PR — are not the frontier task. The
classification is, and you do not do it.

**If `.claude/agents/routing-classifier.md` is missing, stop.** Do not classify inline as a
fallback. An inline fallback is exactly the ungated path this split exists to remove, and it
would be invisible in the output — the tiers would look identical.

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

### Sample composition check — do this before classifying anything

**A bounded set drawn mostly from one recently-authored or recently-reviewed epic will produce
a flattering spec ratio and a worthless baseline.** Design or pre-implementation review is
exactly the process that removes spec debt, so measuring there tells you the review worked. On
the first run of this skill anywhere, this trap has already fired once.

```bash
# What fraction of the candidate set belongs to a single epic or parent?
gh issue list --state open --label "status:ready" --limit 200 --json number,title,body \
  | grep -oE 'child-of #[0-9]+|part of #[0-9]+' | sort | uniq -c | sort -rn
```

Rules:

- If **more than half** the candidate set traces to one epic, the set is not a baseline. Either
  widen it to the general backlog, or run it anyway and **refuse to report a spec ratio**,
  stating plainly that the sample was curated.
- Prefer a set spanning several areas and at least two `theme:`/`area:` families.
- Deliberately include issues carrying the repo's under-structure marker (`needs-structure` or
  equivalent). Excluding them guarantees a low spec ratio and hides the population the metric
  exists to measure.
- Record the sample's composition in the run notes. A ratio without its sample is not a number.

The **risk-surface map** is built by the `routing-classifier` agent in Step 1, not here —
deciding which paths fail silently is a judgement call and belongs on the pinned side of the
split. What follows is what the classifier probes for, kept here so you can tell whether its
map is plausible before you act on it:

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

You do not have to produce this map — the classifier does, and cites it in every row.

---

## Step 1: Delegate to the routing-classifier agent

Spawn `routing-classifier` with the candidate issue set and the sample-composition notes from
Step 0. It maps the risk surfaces itself and returns the proposal tables — its job is to
classify, not to decide, and it is read-only by construction: it proposes, you apply.

Do not paraphrase its output into your own judgement. If a row looks wrong, that is a
**dispute** and belongs in the interview (Step 2), not a silent correction. A skill that
edits the classifier's calls has reintroduced the unpinned path through the back door.

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

List every issue proposed above `standard` carrying a `spec` component (`spec` or `both`),
with the specific sentence that is missing.

Before finalizing, run the **under-structure cross-check**: any issue carrying the repo's own
under-structure marker (`needs-structure` or equivalent) that you tiered without a `spec`
component is a contradiction — the validator says it is under-specified, you said
specification wouldn't help. Re-examine every one; the usual correct answer is `both`. These are not routing decisions — they are authoring bugs, and
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

**If Step 0 found an isolation, tenancy, or credential surface, create the `gate:` family too**
— the policy calls for it from day one in those repos, and the trivial-diff-on-a-boundary case
arrives in the first pass, not eventually:

```bash
gh label create "gate:human-approval" --color 5319E7 --description "Agent may prepare; a human owns the irreversible step"
gh label create "gate:human-review"   --color 5319E7 --description "Judgment call no test settles"
gh label create "gate:credentials"    --color 5319E7 --description "Agent structurally cannot hold the keys"
gh label create "gate:decision"       --color 5319E7 --description "Outcome should be recorded as a PDR/ADR by a person first"
```

Do not skip this because the labels happen to already exist — verify, because a repo that
inherited them from an earlier run masks the gap for the next repo that does not.

Then, per issue: apply the label, and **append the tier line to the body**. The label routes;
the line explains. An issue with a label and no line is malformed — the next agent sees a
constraint with no reason and cannot tell whether it still applies.

```
## Impl tier
frontier (inherent) — touches the [boundary]; a wrong scope returns plausible-looking
rows and no test covers cross-tenant reads.
```

**Apply from a reviewed batch file, not an ad-hoc loop.** Write every intended change to a
single file first — issue number, label, and the exact tier line — have the human read it, then
execute it. A shell loop over 24 issues that mangles a label or double-writes a heading is easy
to produce and quiet to miss, and the damage is spread across two dozen live issues before
anything looks wrong. This is the observed failure mode from the first two runs, and both times
it was the scripting, not the policy.

```bash
# batch.tsv — one line per issue, reviewed before anything executes
# <issue>\t<impl-label>\t<gate-labels|->\t<tier line>
while IFS=$'\t' read -r n impl gates line; do
  gh issue view "$n" --json body -q .body > /tmp/body-$n.md
  printf '\n## Impl tier\n%s\n' "$line" >> /tmp/body-$n.md
  gh issue edit "$n" --add-label "$impl" --body-file /tmp/body-$n.md
  [ "$gates" != "-" ] && gh issue edit "$n" --add-label "$gates"
done < batch.tsv
```

Read the current body first and append, never overwrite. If the repo has an issue-body schema,
the block goes where the schema says. Spot-check three issues after the batch before declaring
it done.

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

   On a bootstrap run every example will be an **open, just-triaged** issue, because the tiers
   did not exist when anything closed. That is expected — head the section
   `Calibration set (provisional — built from open issues on the bootstrap run, YYYY-MM-DD)`
   and treat it as weaker evidence than the heuristics table until the issues close and the
   outcomes either confirm or contradict the calls.
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
- **Spec-escalation ratio** — escalations with a `spec` component (`spec` or `both`) as a
  share of the set, measured on the *classification*, before responses were applied. Report
  three numbers: classified `spec`, resolved by rewrite, resolved by split. Counting only
  the surviving labels makes every well-handled case vanish and reads 0% for a backlog that
  had plenty.
- **Whether the sample was pre-cleaned.** If the triaged set came from an epic that had just
  been through design or pre-implementation review, say so — that review already removed the
  spec debt, and the ratio measures the review rather than the repo. A first-run 0% is much
  more often a biased sample than a well-authored backlog.
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
