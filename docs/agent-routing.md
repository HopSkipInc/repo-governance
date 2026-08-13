<!-- template: agent-routing.md v1.13.0 · updated 2026-08-13 -->
# Agent Routing

**Version:** 1.13.0 · **Last updated:** 2026-08-13
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
| 1.9.0 | 2026-07-26 | **Policy and records split into two files** — `docs/agent-routing.md` (syncs, `diff -q`-verifiable) and `docs/agent-routing-records.md` (never syncs). The old single-file shape told repos to append records to the file the checklist verified was identical to the template; every repo that ran a triage failed it permanently and the obvious fix was deleting its own calibration set. Model→class mapping split into class←model and model→harness-route, so a slug rename stops reading as a capability change |
| 1.10.0 | 2026-07-27 | **Coverage is the fourth response.** An escalation resting on the uncovered-surface signal now requires a coverage record — a linked gap issue or a statement that the property is not testable. Ties the tier to `docs/testing-strategy.md` §2/§6 instead of to a triager's impression of the test suite. The one response that lowers the tier of every *future* issue on the surface, not just this one |
| 1.12.0 | 2026-08-12 | **Do not code around a blocker.** Two stop conditions added to the layer-1 contract — coding around a blocker instead of removing it, and weakening a test to reach green — plus the sentence that makes a stop mean something: the edit does not land and the turn ends, because a question the implementer then answers itself is the workaround applied to the stop rule. Anti-pattern 7 gains its first mechanical half (`check-weakened-verification.mjs`, net assertion/skip delta across a diff), and states why a pattern lint was never going to work: a weakened test is the one workaround with a negative diff |
| 1.13.0 | 2026-08-13 | **`gate:decision` gets its write path.** "Recorded as a PDR or ADR by a person" had drifted into "typed by a person" once the harness stanzas denied raw edits to records paths — an agent that could prepare the whole change could not publish the record of its decision. The label now says what was always meant: an agent drafts the record through the repo's mediated write path (`write-record.mjs`, issue #81); a person owns it at merge |
| 1.11.0 | 2026-08-05 | **Delegation is dispatch.** Layer 1's duties made second-person for the two dispatch shapes that already exist: an interactive driver spawning subagents (the driver is the dispatcher; the delegation prompt is the launch, and it carries the capability budget — tier, kind, reason, stop conditions, scope ceiling) and fleet dispatch (enumerated rows, claim-of-record on the issue, waves from the epic table, deploy gates as wave boundaries, `Not splittable:` as a parallelism constraint). The policy spoke about dispatchers in the third person while every task-tool harness was already dispatching |

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

There are four. The third is the one triagers forget; the fourth is the only one that is
still paying out a year later.

1. **Accept it.** The tier stands, the work waits for a frontier model or a human. Correct
   for a genuinely indivisible `inherent` issue.
2. **Rewrite it.** `spec` only. Write the missing sentence; the tier drops. Body edit and
   label change in the same commit — see *Downgrades*.
3. **Split it.** Lift the mechanical half into its own issue. Plumbing, config, scaffolding,
   the cost cap wrapped around the admission logic, the endpoint around the check. The new
   issue routes `standard`; the residue stays `frontier` and gets smaller.
4. **Cover it.** Available whenever the escalation rests on *no existing test covers the
   surface being changed*. Write the test and the signal that raised the tier is gone — for
   this issue and for every future one on that surface. File the coverage gap, link it, and
   re-tier when it closes.

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

### The coverage rule

> **An escalation resting on the uncovered-surface signal must carry a coverage record.**

Exactly one of two forms, on its own line in the tier block:

1. **`Coverage gap: #NNN`** — the issue that covers the surface. When it closes, this issue
   is re-tiered. The gap issue is `standard` almost every time: writing a test against a
   dangerous surface is not itself dangerous.
2. **`Coverage: not testable — <mechanism>`** — the property genuinely cannot be verified by
   a test at any level, and the mechanism says why (no test double for the external system,
   the failure is a timing property under real concurrency, the guarantee is enforced by a
   provider we cannot fault-inject). A surface recorded this way belongs in
   `docs/testing-strategy.md` §6, where the coverage layer can see it.

**Read the answer out of the coverage map, not out of an impression.** §2 of
`docs/testing-strategy.md` says whether a module is covered, a gap, a deliberate exemption,
or hard to test; §6 names properties nothing verifies at any level. A triager who checks the
map is answering a question the repo already answered. A triager who greps for test files is
guessing, and guesses about coverage are exactly how a surface stays expensive to route for a
year without anyone deciding it should.

**A coverage record retires one signal, not necessarily the tier.** Escalations often rest
on more than one row of the heuristics table. If the surface is also inside a single
transaction with a canonical lock order, closing the coverage gap leaves that reason
standing and the tier does not move. Say so in the record — `Coverage gap: #NNN (tier
holds regardless — see the lock-order reason above)`. The alternative is a triager who
believes filing the gap promises a downgrade, discovers it doesn't, and stops filing them.

**Order: decompose, then ask coverage of the residue.** A coverage gap filed against a
component-scoped issue names the whole component, costs a sprint, and closes nothing. Filed
against the residue it names one predicate and one behaviour.

**Why this gets its own field instead of a paragraph.** Rewriting fixes one spec. Splitting
divides one issue. Covering a surface changes the tier of *every future issue that touches
it* — it is the only response with a second payment, and the only one whose benefit lands on
work nobody has filed yet. That combination (slow, compounding, benefits someone else's
sprint) describes precisely the work that does not happen unless something asks for it. The
split rule spent seven versions as good advice nobody executed; this rule starts as a field
because that lesson was already paid for.

If the repo has no `docs/testing-strategy.md` yet, the record is still required — the answer
just comes from reading the suite, and the fact that it had to be reconstructed is itself the
trigger to run `test-coverage-interview`.

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
| `gate:decision` | The outcome should be recorded as a PDR or ADR before the code lands — an agent drafts the record through the repo's mediated write path; a person owns it at merge. |

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

That lever has a mechanism now: the sixth row may not be cited without a coverage record
(see *The coverage rule*), and the record is read out of `docs/testing-strategy.md` §2 and
§6 rather than assembled from an impression of the suite. The two files are a loop —
triage names the surfaces it is paying for, the coverage layer closes them, and the ratio
falls without anyone re-arguing a single tier.

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
Coverage gap: #NNN — cross-tenant read scoping is unverified at any level
(testing-strategy §6); covering it drops this to standard.
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
kind or the decomposition record is malformed. **If the reason cites an uncovered surface, a
coverage record is required too** — `Coverage gap: #NNN` or `Coverage: not testable — …`.
"It's complicated" is not a reason — say what fails and whether the failure is loud.

Note what the coverage record does to the first example: it converts "this is a frontier
issue" into "this is a frontier issue *until* #NNN closes." A tier with an expiry condition
attached is a different object from one without — it is the difference between a permanent
cost and a scheduled one.

**3. Epic tier table.** Epics list children with tiers, so a dispatcher can route the
mechanical work cheaply and hold the boundary work back.

| Child | Tier | Kind | Why |
|---|---|---|---|
| #NNN | standard | — | loud failure, covered by [test] |
| #NNN | frontier | inherent | silent failure on [boundary] |
| #NNN | human | inherent | removes a safety invariant |

**4. Calibration set.** Keep 5–8 real issues from this repo labeled as worked examples, in
`docs/agent-routing-records.md`. Triage disputes get settled by nearest neighbour against the set,
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

For that fallback, keep the mapping in `docs/agent-routing-records.md`. **Two tables, not
one** — capability and addressing are different concerns and they churn on different clocks:

**1. Class ← model.** What a model *is*. Changes when a model's capability is reassessed.

| Class | Models | As of |
|---|---|---|
| standard | [model names] | [YYYY-MM-DD] |
| frontier | [model names] | [YYYY-MM-DD] |

**2. Model → harness route.** How each harness *addresses* that model. Changes when a harness
renames a slug, adds a provider, or a model ships somewhere new.

| Model | Claude Code | opencode | [other harness] |
|---|---|---|---|
| [model name] | `[slug]` | `[provider/slug]` | `[slug]` |

**Why the split.** A single table conflates the model with the inference endpoint that serves
it. `opencode/claude-opus-5` and `opus` are the same model reached two ways, and the class is
a property of the *model* — the same weights do not become less capable because a different
harness dialed them. Collapsing the two means every new harness re-litigates the capability
question it has no business answering, and a slug rename reads as a capability change.

It also removes a real failure mode: with one table, a model available in only one harness
looks like a *different class* from the same model elsewhere. The class table answers "may
this model triage"; the route table answers "how do I reach it here". Only the second is
allowed to vary by harness.

The label vocabulary never changes. Both tables churn every few months, in exactly one file.
Never write a model name — or a harness slug — into a label.

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
is that every repo's records file references the same global pin, so a re-sync reviews them
in batch.

**The pin carries a harness slug; the class table carries the model.** This is the one place
the two tables meet, and it is why they are separate: a pin is an *address*, so it names
whatever its harness understands. Record which model each pin resolves to, so a reviewer can
check the pin against the class table without knowing every harness's naming scheme:

| Harness | Pin file | Resolves to (model) | Class | Reviewed |
|---|---|---|---|---|
| Claude Code | `.claude/agents/routing-classifier.md` | [model name] | frontier | [YYYY-MM-DD] |
| opencode | `~/.config/opencode/agents/routing-classifier.md` | [model name] | frontier | [YYYY-MM-DD] |

**Every pin must resolve to a model the class table lists as `frontier`.** That check is the
whole point of writing the resolution down — without it, verifying a pin means reading a
harness's model catalogue, which nobody does, and a pin drifts to a retired or downgraded
model in silence.

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

## Dispatch workflows: delegation and fleets

Layer 1 names the dispatcher without saying who that is. There are three dispatch
shapes, and the same duties attach to each:

- **A human dispatching** — a Slack message, an admin UI, a hand-picked issue. The
  human runs the filter; the policy's only ask is that the handoff carries the payload
  below.
- **An agent driver delegating to a subagent** — the driver is the dispatcher for that
  unit of work, whether it thinks of itself that way or not.
- **A fleet dispatcher** — anything that launches workers without a human reading each
  row. Here the filter is the entire product.

One correction to the picture those bullets draw: a fleet run today is almost always the
first shape, not the third — a human writes the goal and the fleet is the execution arm.
The rules in *Fleet dispatch* below are the manifest contract between that launcher and
the workers, binding the human holding the launcher now and an automated orchestrator
unchanged later. A fleet *worker*, by contrast, is never a dispatcher of issues: its
routing decision was made at launch. When a worker delegates at all, it delegates
subtasks within its issue, and the subtask rule in *Delegation is dispatch* is the one
that applies.

### Delegation is dispatch

> **The instant a driver hands work to another agent, the driver becomes the Layer-1
> dispatcher for that unit of work, and the Layer-1 duties land on it — nobody else is
> in a position to carry them.**

Both launch paths this policy describes — dispatcher and interactive — assumed the agent
doing the work is the agent somebody chose to launch. A subagent breaks the assumption
from both sides. It is launched by the driver, not the human, so the human-knows
fallback does not cover it: the human knows the driver's class and has never even seen
the subagent's. And it sees nothing of the session — no issue body, no tier line, no
stop conditions — so the agent contract does not cover it either: the subagent never saw
the contract's inputs. What it knows is exactly and only what the delegation prompt
says.

The trigger is narrow: **delegating implementation work on a tiered issue.** Read-only
research and search delegation carries no implementation risk and needs nothing from
this section.

When the trigger fires, the delegation prompt is the launch, and it carries the
capability budget *Self-identification* promised — five fields:

1. **Issue and tier.** The number, the `impl:` tier, the kind.
2. **The reason, verbatim.** The `## Impl tier` line. The why has to travel with the
   work; the subagent cannot go back and read it.
3. **Stop conditions.** The same observable list the driver holds.
4. **Scope ceiling.** This issue, these files; anything adjacent is a comment, not a
   fix. A subagent's helpfulness has no tripwire otherwise, and scope creep by a helpful
   agent is the same failure shape whether it costs a turn or a fleet dollar.
5. **The class check, run before spawning.** The subagent's capability class must meet
   the tier of the work it will hold — the issue's tier, when the whole issue is
   delegated; the subtask's own risk, when a piece of it is (see the next paragraph).
   The driver's class does not transfer. If the check fails, the driver does the work
   inline, asks the human, or does not start.

**Subtask delegation is the split response, one level down.** A worker or driver holding
a tiered issue never re-routes the issue — that decision was made upstream — but it can
still misroute the work inside it. Lifting the mechanical half to a cheaper subagent
(renames, fixtures, wiring) is exactly the decomposition this policy asks for on every
tiered surface. Routing the residue down is the anti-pattern: "it's just a subtask" does
not launder a boundary change into standard-tier work, or every frontier issue becomes
routable to the cheapest model in the room one delegation at a time.

Concurrent delegation is the lane-collision problem one level down. Two subagents
editing the same file conflict exactly the way two sessions do, so the disjointness rule
is the same one: check surfaces before spawning — a shared file means a shared worker,
or serialize — and give concurrent editing subagents separate worktree lanes under the
same protocol as concurrent sessions.

The driver owns the irreversible. Subagents prepare; the driver reviews, merges, pushes,
and runs anything deploy-gated.

### Fleet dispatch

A fleet dispatcher is Layer 1 with a manifest. Its two failure modes are **overpromise**
— a worker reporting work done that it was never scoped to hold — and **collision** —
two workers editing the same surface in ignorance of each other. The rules address those
two and nothing else:

1. **The goal enumerates rows, not ambitions.** "Implement these three issues and
   nothing else" is a dispatch; "make progress on the epic" is an overpromise generator.
   A worker that finishes its list reports completion and stops. It does not go shopping
   in the backlog.
2. **The claim-of-record lives on the issue.** A comment or an assignment before work
   starts. Run-scoped coordination — worker messaging, fleet memory — is invisible to
   the next run, the next session, and the human; the issue is the only surface every
   participant can read.
3. **Waves come from the epic tier table, and completion gates the next wave.** A wave
   dispatches only rows whose dependencies are merged. "Done" means the acceptance
   criteria passed, not that a worker emitted a completion event — the wave gate is what
   makes those the same thing.
4. **Deploy gates are wave boundaries.** The dispatcher must know the repo's
   irreversible-on-merge surfaces — schema that reaches production on push, append-only
   files, dispatch-only workflows, infrastructure parameters that need a separate deploy
   — and sequence waves around them. The gates themselves are per-repo records; the duty
   to know them is policy.
5. **A `Not splittable:` statement is a dispatch constraint.** An issue declared
   inseparable goes to exactly one worker, whole — never divided across workers or PRs.
   Note what this makes the decomposition record: dispatch metadata that triage already
   wrote. `Split from #NNN` names the siblings; `Not splittable` names the parallelism
   limit. Nobody maintains a second format.

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

Six numbers, reported as findings, not as a compliance score:

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
6. **Coverage-driven escalations** — escalations whose reason cites the uncovered-surface
   signal, split into those carrying an open `Coverage gap: #NNN` and those declared
   `Coverage: not testable`. *Should trend down.* This is the number that makes the test
   coverage layer legible in money: each row is an issue paying frontier rates for a test
   nobody wrote. Report the top surfaces by count — three escalations naming the same
   uncovered surface is one test's worth of work holding three issues above `standard`,
   and it is the highest-return item the coverage layer will find all quarter. Rule R8 in
   `check-issue-routing.mjs` is the mechanical half.

## Who assigns the tier

At authoring or triage, by a human or an agent **at or above frontier class**. Triage is
itself a frontier task — the router has to be smarter than the routed — so a cheap model
must never self-assign the tier of work it is about to pick up. That is the same
conflict-of-interest as an agent downgrading its own issue, one step earlier.

Layer 5's escalate-only lint is the automated assist, not a replacement.

## Cross-repo consistency

The three tiers, the three kinds, the decomposition rule, and the heuristics table are the
same everywhere — that is the **shape**, and it syncs. The model→class mapping and the
calibration set are per-repo and dated — those are **records**, and they never sync. A repo
inheriting another repo's calibration examples has inherited a vocabulary its triagers cannot
recognise.

### Two files, and the boundary is physical

| File | Contents | Syncs? | Check |
|---|---|---|---|
| `docs/agent-routing.md` | This policy, verbatim | Yes — byte-identical to the template | `diff -q` against the template |
| `docs/agent-routing-records.md` | Class←model + model→route tables, pin resolutions, calibration set, repo surfaces | **Never** | Version-stamp header names the policy version it was written against |

**They were one file until 2026-07-26, and that was a real defect, not a tidiness question.**
The policy told every repo to *append its records* to `docs/agent-routing.md` while the
adoption checklist verified that same file was `diff -q`-identical to the template. Both
instructions shipped together. Every repo that actually ran a triage failed the check
permanently, and the obvious way for an agent to "fix" it was to **delete its own calibration
set** — destroying the one artifact the policy says cannot be reconstructed from anywhere else.

A conventional boundary inside a shared file gets crossed. A file boundary does not. The
re-sync is now `cp` and the verification is now `diff -q`, and neither can touch the records.

**Migrating an existing repo:** move the records out first, then overwrite the policy. Never
the other way round — a `cp` over a combined file destroys the records with no diff to recover
them from, and the calibration set is the part with no upstream copy.

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
   same failing test; **coding around a blocker instead of removing it** — a fallback,
   default, retry, cast, or broad catch you would not have written had the call worked;
   **weakening a test, assertion, or matcher to reach green**; creating a file type with
   no precedent here; touching a migration that drops or renames; no existing test covers
   the surface you are changing; the diff exceeds [N] files.

   **Stopping means the edit does not land and the turn ends.** A question you then answer
   yourself two paragraphs later is not a stop — it is the workaround applied to the stop
   rule, and it is the observed way this condition fails. A degradation that is genuinely
   the right call gets declared and countersigned by a human; it is never merged on your
   own reading of your own question.

Delegating is dispatching. When you hand implementation work on a tiered issue to a
subagent, you become the dispatcher for that unit of work: check the subagent's
capability class against the tier (your own class does not transfer), and put the tier,
kind, reason, stop conditions, and a scope ceiling in the delegation prompt — the
subagent sees nothing of this conversation. Concurrent subagents need disjoint file
surfaces or separate worktree lanes, exactly as concurrent sessions do. Subagents
prepare; you review and merge.

You may escalate an issue's tier at any time. You may never downgrade one — least of all
on an issue you are about to implement. An escalation you raise must carry the same
decomposition record as any other: either lift the mechanical half into a new `standard`
issue, or state in one sentence what makes it inseparable.

Tier definitions are in `docs/agent-routing.md`. The model→class mapping and this repo's
calibration examples are in `docs/agent-routing-records.md`.
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

   There is now one mechanical half, and it is worth understanding why it took this long.
   Every other workaround an implementer writes — a fallback, a default, a cast, a broad
   catch — lands as *added* lines, so a reviewer or a grep has something to see. Weakening a
   test is the same move with a **negative** diff: a deleted assertion, a loosened matcher, a
   `.skip` where a failure used to be. There is no string to search for, which is why no
   pattern lint was ever going to find it. `scripts/check-weakened-verification.mjs` reads the
   *net* assertion and skip delta across a diff instead, and clears on a record — a row in
   `docs/testing-strategy.md` §6 naming the property that stopped being verified, or a
   `VERIFICATION-DELTA:` justification in the diff. It ships in report mode; promote it to a
   gate once one audit cycle has shown what it actually fires on.

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

11. **`Coverage: not testable` as the default.** The flattering call, one level down from
    `inherent`. Writing a test against a dangerous surface is real work that lands on this
    sprint and pays out on someone else's, so "not testable" is always the cheaper sentence
    — and it is *usually wrong*, because the honest answer is much more often "no fixture
    exists yet" than "no test could exist." The tell is the same as for non-splittability:
    a mechanism, or nothing. "It's hard to test" is not a mechanism. A `not testable` record
    that does not appear in `docs/testing-strategy.md` §6 is a triager's opinion that never
    met the coverage layer.

12. **Delegating below tier because the driver is frontier.** The driver's class does not
    transfer to the subagent it spawns. Every delegation of tiered work is a dispatch
    decision — the driver makes it, filtered or not. The unfiltered version routes the
    boundary to the cheapest model in the room, with a frontier model signing the
    receipt.
