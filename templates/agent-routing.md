# Agent Routing

**Version:** 1.2.0 · **Last updated:** 2026-07-24
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

The tell is the word "and" in the issue title, or an acceptance-criteria list where the
first three items are mechanical and the fourth is the whole risk. Both are common, and
both are invisible if you only ask "what tier is this."

A split is not a downgrade and is never subject to the downgrade rules. Nothing was talked
down; the work was divided and each part got the tier it deserves.

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
```

```
## Impl tier
frontier (spec) — acceptance criteria don't specify retry semantics on partial failure.
```

Rules: the line names the tier, the kind (`spec` or `inherent`), and one sentence of reason.
A tier above `standard` with no kind is malformed. "It's complicated" is not a reason —
say what fails and whether the failure is loud.

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

## Audit signals

Four numbers, reported as findings, not as a compliance score:

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
minimum capability class required, and an `## Impl tier` line giving the kind (`spec` or
`inherent`) and the reason.

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
on an issue you are about to implement.

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
7. **Chasing the frontier ratio to zero.** `inherent` escalations are supposed to persist.
   A repo reporting zero has mislabeled its dangerous surfaces, not eliminated them.
