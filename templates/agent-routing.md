<!-- template: agent-routing.md v1.8.0 · updated 2026-07-26 -->
# Agent Routing

**Version:** 1.8.0 · **Last updated:** 2026-07-26
**Status:** Policy — enforced by [your dispatcher, CI validator, and/or periodic audit]
**Related:** [Issue Authoring](issue-authoring.md) · [Definition of Done](definition-of-done.md)

> **Downstream copies must record the version they were synced from.** This policy is a
> synced artifact: a run that reads the template at the start and a copy that landed
> mid-run can differ, and a triager cannot tell. When installing, keep the header above
> intact, and record the version in the run's notes. If the header version is behind the
> template, re-sync before triaging — the kinds and the escalation responses have changed
> before and will again.

**Changelog**

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-07-24 | Initial — three `impl:` tiers, `spec`/`inherent` kinds, `gate:` family |
| 1.1.0 | 2026-07-24 | `gate:` from day one on boundary repos; "Responses to an escalation" (accept / rewrite / **split**) |
| 1.2.0 | 2026-07-24 | `both` kind; ratio measured pre-response; curated-baseline caveat; provisional calibration sets |
| 1.3.0 | 2026-07-24 | Weakened verification named as an anti-pattern — a silent failure mode of `standard`-tiered work, mitigated by authoring rather than escalation |
| 1.4.0 | 2026-07-24 | Classification delegated to a `model:`-pinned agent; the pin is the one place a model name may be written, and must appear in the mapping table |
| 1.6.0 | 2026-07-24 | What the kind means over time — fixing the spec on a `both` issue leaves `inherent`; the classification stays frozen in the calibration set. Without this `both` blocks `status:ready` forever |
| 1.7.0 | 2026-07-24 | opencode harness support — the classifier pin is harness-specific: `.claude/agents/` (Claude Code, per-repo) or `~/.config/opencode/agents/` (opencode, global). Closes the cross-harness enforcement gap from 1.4.0 |
| 1.5.0 | 2026-07-24 | CLAUDE.md block listed only two kinds — `both` was added in 1.2.0 and the block never followed. Downstream repos installing it taught their agents a two-kind taxonomy against a three-kind policy |
| 1.8.0 | 2026-07-26 | **Decompose before tiering.** An escalation now requires a split proposal or a non-splittability statement. Frontier *ratio* separated from inherent *population*; decomposition debt added as a signal; per-repo target ramp (20% → 10%). Measured across three live backlogs: 76% above-standard, 2 splits in 38 escalations, zero `both` in 33 client-repo calls |

## Purpose

Issues are increasingly implemented by autonomous agents of varying capability. Nothing in
a normal backlog tells an agent whether a given issue is within its competence, and the
failure mode is asymmetric: a weak model will confidently attempt work it will botch, and
the worst botches fail **silently** — a tenant-isolation change that looks green but leaks
data, a memory-scope change that quietly recalls nothing.

This policy puts the bound on the issue instead of in the agent's head. Every issue
declares the minimum capability class required to implement it, and *why*. A dispatcher
routes on the label; an agent reads the reason before it starts; the audit reports where
the labels turned out to be wrong.

## The two load-bearing rules

> **Tier by the failure mode, not the difficulty.**

Difficulty is a property of the person doing the work; the failure mode is a property of
the system. Work that is fiddly but fails loudly — types, tests, CI catch it — stays
routable to a cheap model, because a cheap model with a tight verification loop iterates
into correctness. Work whose wrong answer *looks right* has no loop to close. That is the
line, and it is not the same line as "how hard does this feel."

> **A spec-limited escalation is a bug report against the spec.**

There are exactly two reasons an issue sits above `impl:standard`, and every escalation
must declare which one it is:

| Kind | Meaning | Fix |
|---|---|---|
| **`spec`** | The issue doesn't say enough. The work would be mechanical if it were specified. | Rewrite the issue. The tier drops. |
| **`inherent`** | The failure is silent, or the invariants are many, or the boundary is load-bearing. A perfect spec doesn't help. | Nothing. This is where your risk actually lives. |
| **`both`** | Under-specified **and** dangerous. The commonest state on a real boundary, and the easiest to mislabel. | Rewrite the spec; the tier stays. Fixing the spec is still worth it — it shrinks what the frontier model has to derive. |

**`both` exists because the two conditions are not mutually exclusive, and forcing a single
choice biases the answer.** `inherent` is the flattering call: it cannot be challenged by
rewriting, cannot be downgraded, and reads as "we found real risk" rather than "we wrote a
bad issue." A triager forced to pick one will drift toward it, and the spec debt disappears
from the metric rather than from the backlog.

**Cross-check, mechanical:** any issue carrying the repo's own under-structure marker
(`needs-structure`, or whatever your CI validator applies) that is tiered *without* a `spec`
component is a contradiction — your validator says the issue is under-specified and your
triage says specification wouldn't help. Both can't be right. This is checkable in one query
and belongs in the audit sweep.

This distinction is what makes the taxonomy self-correcting rather than a permanent excuse.
A backlog full of `spec` escalations isn't careful — it's unauthored, and the fix is
authoring, not a bigger model. A backlog with a stable population of `inherent` escalations
is a map of the system's genuinely dangerous surfaces, and it should not trend anywhere in
particular.

It also settles the anti-gaming problem (see *Downgrades*): an `inherent` tier cannot be
talked down, and a `spec` tier can only be talked down by an edit that removes the reason.

### What the kind means over time

The kind describes the issue's **current** state, not its history. Fixing the spec on a `both`
issue retires the spec component and leaves `inherent` — the tier does not move, but the kind
does. Without this, `both` is a trap: the issue can never carry `status:ready` because the
`status:ready` + spec-component rule reads it as permanently "ready to be rewritten".

The **classification** is what the ratio and the calibration set record, and that is frozen at
triage time. So a rewritten `both` issue appears as `both — resolved by rewrite` in the
calibration set and as `inherent` on the issue itself. Those are not in conflict; they answer
different questions.

*(Found 2026-07-24 by `check-issue-routing.mjs` R4 firing on a `both` issue whose spec had just
been fixed — the lint was right and the policy was silent.)*

## Responses to an escalation

There are three, and the third is the one triagers forget.

1. **Accept it.** The tier stands, the work waits for a frontier model or a human. Correct
   for a genuinely indivisible `inherent` issue.
2. **Rewrite it.** `spec` only. Write the missing sentence; the tier drops. Body edit and
   label change in the same commit — see *Downgrades*.
3. **Split it.** Lift the mechanical half into its own issue. Plumbing, config, scaffolding,
   the cost cap wrapped around the admission logic, the endpoint around the check. The new
   issue routes `standard`; the residue stays `frontier` and gets smaller.

**Prefer the split.** It is the only response that both reduces cost *and* shrinks the
dangerous surface, and it works on `inherent` escalations where rewriting cannot help. An
issue that is 80% plumbing and 20% tenancy boundary is not a frontier issue — it is two
issues, one of which nobody noticed was cheap.

A split is not a downgrade and is never subject to the downgrade rules. Nothing was talked
down; the work was divided and each part got the tier it deserves.

### The decomposition rule

> **No issue is tiered above `standard` until decomposition has been attempted and the
> attempt is on the record.**

For every issue a triager wants to escalate, exactly one of two artifacts must exist:

1. **A split proposal** — N `standard` children plus the frontier residue, or
2. **A non-splittability statement** — one sentence naming what makes the mechanical work
   inseparable from the dangerous work.

"It's all one thing" is not a statement. Neither is "the whole issue is on the boundary."
The statement has to name the *mechanism*:

- a single transaction the whole change must land inside;
- one function whose every branch composes the predicate;
- a migration that is atomic by definition;
- a contract whose producer and consumers must change in lockstep;
- a test suite whose value is that it runs against the un-split whole.

**If a triager cannot write that sentence, the issue splits.**

This is the same move the `kind` field made one level up. `spec` vs `inherent` converted
"this is hard" into a declaration that can be argued with. The non-splittability statement
converts "this is all dangerous" into one that can be **checked against the diff afterwards**
— an issue declared inseparable whose merged PR turns out to be three mechanical commits and
one risky one was mis-declared, and that is visible in a way a bare tier never was.

**The order is the whole rule: decompose first, tier the residue.** Tiering first and asking
about splits afterwards is what this policy did through v1.7.0. It produced **two splits in
thirty-eight escalations** across three live backlogs. The response ordering was right in the
prose and backwards in the procedure.

### The mechanical-majority tell

Escalations announce their own splittability, in the tier line, in the triager's own words.
Observed verbatim in live backlogs:

- "**mostly mechanical delivery, but** the principal-keyed result cache is a silent
  cross-tenant leak surface"
- "(The starter-prompt catalog alone would be **standard; highest signal wins**.)"
- "**mostly built** — residual is converging the two scoring entry points"

Each is a correct application of *assign by the highest signal* **and** a missed split. The
triager saw the mechanical majority, named it, and escalated the whole issue anyway — because
the policy asked for a tier and never asked for a decomposition.

Older tells, still good: the word "and" in the issue title, or an acceptance-criteria list
whose first three items are mechanical and whose fourth is the entire risk.

All of these are mechanically detectable. Rule **R7** in `check-issue-routing.mjs` flags a
hedge phrase in the tier line of an escalated issue and clears when the line carries a
non-splittability statement. It is the cheap detector that tells you whether this section is
being followed.

## The tiers

An `impl:` label on every issue, declaring the **minimum** capability class required. Exactly one.

- **`impl:standard`** — any capable coding model implements it directly from the issue as
  written. Well-anchored file and symbol references, binary acceptance criteria, contained
  blast radius, and failures are **loud**.
  *e.g. de-hardcoding config, enforcing an already-specified check, a bounded feature addition.*

- **`impl:frontier`** — a frontier model may implement autonomously; a non-frontier model
  should not attempt it. Cross-cutting design, or correctness subtle enough that a
  plausible-but-wrong solution is dangerous, or **silent** failure modes. Requires holding
  several system invariants at once.
  *e.g. isolation enforcement, a new data-scoping rule, race and concurrency fixes.*

- **`impl:human`** — needs a human regardless of model capability. Not "hard code" — work an
  agent should not **unilaterally complete**: product and UX decisions, external coordination,
  credential handling, removal of a safety invariant.
  *e.g. removing a fail-open guard, confirming an external producer's contract.*

### The `gate:` family (optional — add when the repo needs it)

`impl:` answers *can an agent own this*. It cannot express "the change is small, but a human
must approve the merge." Repos that need that separation add an orthogonal family, zero or
more per issue:

| Label | Meaning |
|---|---|
| `gate:human-approval` | An agent may prepare the change; a human owns the irreversible step (prod data, money, outbound comms). |
| `gate:human-review` | A judgment call no test settles — UX, prose, threat modelling. |
| `gate:credentials` | The agent structurally cannot hold the keys. |
| `gate:decision` | The outcome should be recorded as a PDR or ADR by a person before the code lands. |

Without this family, "one-line config change on the tenant wall" has to be filed
`impl:human`, which over-escalates the *implementation* in order to protect the *merge* —
and the mechanical work never gets routed to anything. With it, the same issue is
`impl:frontier` + `gate:human-approval`: an agent prepares the PR, a human owns the button.

**Adopt `gate:` from day one if the repo has an isolation, tenancy, or credential boundary.**
The "trivial diff on a boundary" case does not arrive eventually in those repos — it arrives
in the first triage pass, and without the family every one of them files as `impl:human` and
strands its mechanical work. Defer the family only in repos that genuinely have no such
boundary: pure libraries, static sites, single-tenant internal tools.

## Assignment heuristics

Assign by the **highest** signal present, not the average.

| Signal | Tier pressure |
|---|---|
| Failure is caught loudly by tests, types, or CI | keeps it `standard` |
| Failure is silent — a wrong result looks correct | → `frontier`+ |
| Touches a security, isolation, or tenancy boundary | → `frontier`, often `human` |
| Requires inventing an abstraction not yet in the codebase | → `frontier` |
| Blast radius crosses many modules, or is hard to reverse | → `frontier`+ |
| No existing test covers the surface being changed | → `frontier` |
| Requires a product, UX, or policy decision | → `human` |
| Requires coordinating with an external team or system | → `human` |
| Handles secrets or credentials, or removes a safety invariant | → `human` |

Note what the table implies and state it out loud to your team: **the first and sixth rows
are the same lever.** Coverage on a surface is what keeps work on that surface cheap to
route. This is the point where test-coverage governance stops being hygiene and starts
showing up on the invoice.

## Mechanism

**1. Label.** One `impl:` label per issue, required. Optional `gate:` labels.

**2. Tier line in the body.** The label routes; the line explains. It carries the kind and
the reason, so the agent sees the *why* before it starts:

```
## Impl tier
frontier (inherent) — touches the tenant-isolation boundary; a wrong scope leaks
cross-workspace data silently, and no test currently covers cross-tenant reads.
Not splittable: the scope predicate is composed in one function whose every branch
reads it; there is no mechanical half to lift.
```

```
## Impl tier
frontier (spec) — acceptance criteria don't specify retry semantics on partial failure.
Split from #NNN — the endpoint, config, and wiring went to #NNN (standard); this is
the residue.
```

Rules: the line names the tier, the kind (`spec`, `inherent`, or `both`), one sentence of
reason, **and the decomposition record** — either `Split from #NNN` / `Split into #NNN, #NNN`
or a `Not splittable:` sentence naming the mechanism. A tier above `standard` missing the
kind or the decomposition record is malformed. "It's complicated" is not a reason — say what
fails and whether the failure is loud.

**3. Epic tier table.** Epics list children with tiers, so a dispatcher can route the
mechanical work cheaply and hold the boundary work back.

| Child | Tier | Kind | Why |
|---|---|---|---|
| #NNN | standard | — | loud failure, covered by [test] |
| #NNN | frontier | inherent | silent failure on [boundary] |
| #NNN | human | inherent | removes a safety invariant |

**4. Calibration set.** Keep 5–8 real issues from this repo labeled as worked examples, in
`docs/agent-routing.md`. Triage disputes get settled by nearest neighbour against the set,
not by re-arguing the heuristics table. A taxonomy without calibration examples drifts
within two months, because every triager reads "contained blast radius" differently.

**Closed issues are better, but a bootstrap run has none.** A new repo or a new area cannot
produce a set of closed, tiered examples — the tiers did not exist when those issues closed.
On a first run, build the set from **open, just-triaged issues and mark it `provisional`**:

```markdown
### Calibration set (provisional — built from open issues on the bootstrap run, 2026-07-24)
```

Promote a row to confirmed when its issue closes and the outcome matched the tier; correct it
when the outcome contradicted the tier — a provisional row that turned out wrong is the most
instructive entry the set will ever have. An all-provisional set is expected on run one and
should be treated as weaker evidence than the heuristics table, not stronger.

<!-- Fill this in from your own backlog. Do not inherit another repo's examples — the
     whole value is that they are recognisable to the people doing the triage. -->

## The self-bounding agent contract

Add to agent instructions (CLAUDE.md / AGENTS.md — see the section template below):

> Before implementing an issue, read its `impl:` tier and the Impl-tier line. If the tier
> exceeds your capability class, do not attempt implementation. Comment on the issue with
> what you would need, and stop.

Be honest about what this buys. **It is advisory and it always will be**, because the model
that cannot do the work is the same model judging whether it can. The contract catches the
honest cases and the clearly-out-of-range cases. It is not the fence.

The fence is the dispatcher (Layer 1 below).

### Observable stop conditions

"Stop if this exceeds you" produces heroism or premature bailing. Give agents conditions
they can actually evaluate, held to the same standard as acceptance criteria — binary and
observable:

- Three attempts at the same failing test.
- About to create a file type with no precedent in the repo.
- The change touches a migration that drops or renames.
- No existing test covers the surface being modified.
- The diff exceeds [N] files.
- The issue's Impl-tier line is missing, or its kind is missing.

Any of these fires → comment and stop, whatever the tier said.

### Self-identification

An agent knowing its own capability class is the crux of the advisory layer — and mostly it
should not have to. **The dispatcher knows what it launched**, so it passes the capability
budget in at launch. Self-identification is the fallback for interactive sessions, where a
human is present and already knows.

For that fallback, keep one dated mapping table in `docs/agent-routing.md`:

| Class | Approved models | As of |
|---|---|---|
| standard | [model ids] | [YYYY-MM-DD] |
| frontier | [model ids] | [YYYY-MM-DD] |

The label vocabulary never changes. The mapping churns every few months, in exactly one
file. Never write a model name into a label.

**One exception, and it is the enforcement point.** The `routing-classifier` agent definition
pins its model in frontmatter — that pin is what makes triage un-self-certifiable, so it has
to name something concrete. The pin lives in a harness-specific location:

| Harness | Pin file | Scope | Invocation |
|---|---|---|---|
| Claude Code | `.claude/agents/routing-classifier.md` | per-repo | harness spawns on skill request |
| opencode | `~/.config/opencode/agents/routing-classifier.md` | global (one per machine) | `@routing-classifier` or ask primary to delegate |

In opencode the classifier is global — one agent serves every repo, reading each repo's
`docs/agent-routing.md` at invocation. The policy is per-repo; the classifier is shared. This
is the cleaner shape: one pin to update when the model moves, not one per repo. The trade-off
is that every repo's model→class mapping table references the same global pin, so a re-sync
reviews them in batch.

Add the pin as a row in the mapping table so a re-sync reviews it:

| Class | Approved models | As of | Pinned in |
|---|---|---|---|
| frontier | [model ids] | [YYYY-MM-DD] | `.claude/agents/routing-classifier.md` or `~/.config/opencode/agents/routing-classifier.md` |

A pin nobody reviews is a pin that quietly names a retired model.

## The layered enforcement model

Same defence-in-depth posture as issue authoring — **label and comment, never auto-close**:

1. **Layer 1 — dispatcher filter (the only real enforcement).** Whatever hands work to
   agents selects issues carrying an `impl:` label at or below its capability class. This
   sits *outside* the agent, which is the entire reason it works.
   *Corollary:* an unlabeled issue is not a permissive default and not a blocking one — it
   is simply never selected by any automated dispatcher, while humans can still work it.
   Absence is self-enforcing; you do not need to pick a default.

2. **Layer 2 — agent contract (advisory).** The self-bounding contract and stop conditions
   above. Catches honest cases, cannot catch confident ones.
   *Harness note:* in opencode, the classifier agent's `permission:` frontmatter block
   (`edit: deny`, bash allowlist, `task: deny`) makes read-only enforcement harness-level,
   not advisory — the agent cannot attempt a mutating command at all. This is stronger than
   Claude Code's `tools:` restriction, which limits the tool surface but does not block
   individual commands within an allowed tool.

3. **Layer 3 — PR gate (backstop).** A PR fixing a `gate:human-review` or
   `gate:human-approval` issue requires a human approver (CODEOWNERS). A PR fixing an
   `impl:frontier` issue carries a trailer declaring what produced it.

4. **Layer 4 — periodic audit (sweep).** Reports the four numbers in *Audit signals* below.

5. **Layer 5 — tier lint (escalate-only).** A validator that raises the tier of issues whose
   text or touched paths hit a hard signal — isolation, credentials, a dropping migration.
   **It may only raise, never lower.** "This touches the tenant wall" is mechanically
   detectable; "this is actually simple" is not. A lint that can downgrade is a lint that
   auto-approves its own botches.

Start with Layer 4 — it's a line in the audit prompt. Add Layer 1 the moment anything
dispatches work automatically. Layer 5 last, and only escalate-only.

## Downgrades

The one operation that needs a rule of its own, because the incentive runs the wrong way:
the frontier ratio is a metric people want to improve, and relabeling is free.

- An **`inherent`** tier cannot be downgraded by relabeling at all. It changes when the
  architecture changes — which means an ADR (the failure became loud, the boundary moved),
  not a label edit.
- A **`spec`** tier may be downgraded **only in the same edit that removes the reason.** The
  issue body must change. A label change with no accompanying body edit is the gaming case,
  and it is visible: label events and body edits are both in the issue timeline.
- An agent **never** downgrades the tier of an issue it is about to implement. Escalation is
  self-service; de-escalation is not.

## The frontier ratio and what it measures

Two different numbers get called "the frontier ratio," and conflating them makes both
useless.

- **The frontier *ratio*** — escalations as a share of tiered issues — is a **decomposition**
  metric. It says how finely the backlog separates dangerous work from the mechanical work
  packed around it. It *should trend down*, and it responds almost entirely to splitting.
- **The inherent *population*** — the count of distinct risk **surfaces** carrying
  escalations — is a **risk** metric. It *should not trend*. It moves when the architecture
  moves, which arrives as an ADR.

**Splitting does not reduce risk; it isolates it.** Split an issue into four mechanical
children and one dangerous residue: the risk is identical, the escalation count is unchanged,
and the ratio drops. That is the intended behaviour, not gaming — the four children are now
routable to a cheap model, which is the entire economic point of the practice.

> **Decomposition debt = escalations ÷ distinct surfaces they name.**

A backlog with 22 escalations across 9 surfaces — 7 of them on a single entitlement predicate
— does not have a risk problem. It has issues scoped by **component** instead of by **failure
mode**, and every component that touches the boundary anywhere inherits the whole boundary
under *assign by the highest signal*. Decomposition debt is the number that tells the two
apart, and it is the one to watch on a backlog that resists the split.

### Set a target per repo, and ramp it

A repo adopting this practice measures somewhere north of 60% on its first pass. That is
normal. It is a statement about the granularity issues were written at, not about the repo's
risk.

| Stage | Target | What it means |
|---|---|---|
| Bootstrap (runs 1–2) | **record, don't target** | The first number is the baseline. Chasing it before you have one produces relabeling, not decomposition. |
| Adopting | **≤ 20%** | Splits are happening. The mechanical work is routing cheaply. |
| Mature | **≤ 10%** | Issues are authored at failure-mode granularity, not component granularity. |

**20% is this practice's working target today, and it is provisional.** It is not derived: no
repo has yet completed a full decomposition-first pass, so nobody knows what floor a genuinely
boundary-heavy repo hits. 10% is the destination. Treat a repo that reaches it and holds as
evidence the target was right; treat a repo that stalls at 25% with a defensible
`Not splittable:` sentence on every escalation as evidence the target was wrong. **Record
which** — this is the practice's own falsifier, and it is the only way the number stops being
a guess.

Per-repo targets and current readings live in the client's governance record
(`downstream/<client>/_client.md` in the governance repo), not here. They are records, not
shape, and they do not sync.

## Audit signals

Five numbers, reported as findings, not as a compliance score:

1. **Spec-escalation ratio** — escalations with a `spec` component (`spec` or `both`) as a
   share of the triaged set. *Should trend down.* This is the number that says whether your
   authoring is improving.

   **Measure it on the classification, not on the surviving labels.** An escalation resolved
   by rewriting or by splitting is still an escalation that happened — if you count only what
   is labeled after the response, every well-handled `spec` case vanishes and the ratio reads
   0% for a backlog that had plenty. Report three numbers: classified `spec`, of which
   resolved by rewrite, of which resolved by split.

   **Draw the baseline from the general backlog, not from a curated epic.** An epic that has
   just been through design or pre-implementation review has had its spec debt removed by
   that review — measuring there tells you the review worked, not what your authoring is
   like. A first-run 0% almost always means the sample was pre-cleaned.
2. **Inherent-escalation population** — count and location of `inherent` escalations.
   *Should not trend.* If it moves, either the system's risk surface moved or someone is
   mislabeling `spec` as `inherent` to avoid the rewrite.
3. **Misroutes, both directions.** Under-called: an `impl:standard` issue that produced a
   revert, three or more review rounds, or a follow-up bug. Over-called: an `impl:frontier`
   issue whose merged diff was mechanical and covered by tests. Over-calling costs money
   instead of correctness, which makes it much harder to notice — report it explicitly.
4. **Unlabeled worked issues** — issues that got implementation activity with no `impl:`
   label. Each one is a dispatcher that isn't filtering, or a human path that should be.
5. **Decomposition debt** — escalations ÷ distinct surfaces they name, plus the frontier
   ratio against this repo's current target. *Should trend down.* Report alongside it the
   count of escalations carrying a `Not splittable:` statement versus a `Split from`
   reference: a backlog where every escalation is declared inseparable and none was ever
   split is either genuinely indivisible or not attempting the rule, and the two look
   identical from the ratio alone. Rule R7 in `check-issue-routing.mjs` is the mechanical
   half of this signal.

## Who assigns the tier

At authoring or triage, by a human or an agent **at or above frontier class**. Triage is
itself a frontier task — the router has to be smarter than the routed — so a cheap model
must never self-assign the tier of work it is about to pick up. That is the same
conflict-of-interest as an agent downgrading its own issue, one step earlier.

Layer 5's escalate-only lint is the automated assist, not a replacement.

## Cross-repo consistency

The three tiers, the two kinds, and the heuristics table are the same everywhere — that is
the shape, and it syncs. The model→class mapping and the calibration set are per-repo and
dated — those are records, and they do not sync. A repo inheriting another repo's
calibration examples has inherited a vocabulary its triagers cannot recognise.

## Interaction with existing conventions

- **`status:ready`** now means *the spec is complete enough for its declared tier*. A
  `status:ready` + `impl:frontier (spec)` issue is a contradiction: it's ready to be rewritten,
  not ready to be worked.
- **Issue authoring** — `impl:` joins the required label families; the `## Impl tier` block
  joins the canonical schema.
- **`Serves: PDR-NNN`** — a `gate:decision` label usually means the PDR doesn't exist yet.
- **Definition of Done** — issue-authoring rows require a tier and kind; escalation requires
  a comment and a relabel; downgrade requires an accompanying body edit.

## CLAUDE.md / AGENTS.md section

```markdown
## Agent routing

Every issue carries an `impl:` label — `standard`, `frontier`, or `human` — declaring the
minimum capability class required, and an `## Impl tier` line giving the kind and the reason.

Kinds: **`spec`** (under-specified — rewrite it and the tier drops), **`inherent`** (silent
failure or load-bearing boundary — no spec fixes it), **`both`** (under-specified *and*
dangerous — rewrite the spec, the tier stays). `both` is the commonest state on a real
boundary and the easiest to mislabel: `inherent` is the flattering call, so a triager forced
to choose drifts toward it.

Before implementing an issue:

1. Read the `impl:` label and the `## Impl tier` line.
2. If the tier exceeds your capability class, do not implement. Comment with what you
   would need, and stop.
3. If the label or the kind is missing, do not implement. Comment and stop.
4. Stop and comment if any of these fire, whatever the tier says: three attempts at the
   same failing test; creating a file type with no precedent here; touching a migration
   that drops or renames; no existing test covers the surface you are changing; the diff
   exceeds [N] files.

You may escalate an issue's tier at any time. You may never downgrade one — least of all
on an issue you are about to implement. An escalation you raise must carry the same
decomposition record as any other: either lift the mechanical half into a new `standard`
issue, or state in one sentence what makes it inseparable.

Tier definitions, the model→class mapping, and this repo's calibration examples are in
`docs/agent-routing.md`.
```

## Anti-patterns

1. **Model names in labels.** `impl:opus` is a lie within two quarters. The label names the
   work; one dated table names the models.
2. **Tiering by difficulty.** "This felt hard" routes fiddly-but-loud work to expensive
   models and lets subtle-but-short work through to cheap ones — precisely backwards.
3. **Escalation with no kind.** Without `spec` / `inherent`, every escalation is permanent
   and the taxonomy stops being self-correcting. This is the failure that turns the whole
   policy into decoration.
4. **`impl:human` used as "hard."** The tier means *an agent should not unilaterally complete
   this*, not *this is difficult*. Conflating them makes agents timid on merely-hard work and
   heroic on credential work.
5. **Relying on the agent contract as enforcement.** The contract is advisory. If nothing
   filters at dispatch, nothing is enforced.
6. **A tier lint that can downgrade.** Detecting "touches the tenant wall" is mechanical;
   detecting "actually simple" is not.
7. **Treating a green build as evidence the work was verified.** The failure observed on the
   first agent-completed issue in this practice was not a botched implementation — the code was
   correct, including a subtle detail a careless human would have missed. What got botched was
   the **proof**: the issue demanded a specific check be shown to fail, and an easier failure
   was substituted. CI green, PR merged, issue closed, and the criterion that mattered
   unproven.

   Call this **weakened verification**, and note where it sits: it is a *silent* failure of a
   `standard`-tiered issue, which the heuristics table does not predict, because the tier was
   assigned on the blast radius of the *code* and the silence lives in the *test*. Any issue
   whose acceptance criteria include proving something can fail carries this exposure
   regardless of its tier — the mitigation is authoring (name the rule and the expected error;
   see [Issue Authoring](issue-authoring.md)), not escalation.

8. **Chasing the inherent *population* to zero.** `inherent` escalations are supposed to
   persist — a repo reporting zero has mislabeled its dangerous surfaces, not eliminated
   them. This is *not* an argument against a frontier-ratio target: the ratio and the
   population are different numbers moving for different reasons (see *The frontier ratio
   and what it measures*). Drive the ratio down by splitting; leave the population alone.

9. **Tiering before decomposing.** The failure this policy shipped with for seven versions.
   Ask "what tier is this" first and the answer is always the highest signal in the issue,
   which on a component-scoped backlog is always the boundary. Two splits in thirty-eight
   escalations was the measured result. Decompose, *then* tier the residue.

10. **Scoping issues by component.** "Gateway: result-set delivery" inherits every risk on
    the gateway. "Derive the principal-keyed cache key" inherits one. The unit of work
    determines the tier far more than the rubric does, which is why the highest-leverage
    fix for a bad ratio is upstream in authoring, not in triage.
