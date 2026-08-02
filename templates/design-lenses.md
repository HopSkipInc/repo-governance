<!-- template: design-lenses.md v1.1.0 · updated 2026-08-02 -->
# Design Lenses

**Status:** Policy — enforced by the ADR template, `check-design-lens.mjs`, the PR template, and a per-repo records file
**Related:** [Definition of Done](definition-of-done.md), [ADR-022](adr/022-definition-of-done.md), [ADR-048](adr/048-schema-promises-are-governed.md), [Agent Routing](agent-routing.md)
**Paired records file:** `design-lenses-records.md` (per-repo; this policy is identical everywhere, the records are not)

---

## Purpose

A design decision usually makes a claim about the world — that a measurement is trustworthy, that a boundary holds, that a human will read an alert correctly, that a feedback loop improves things. Those claim types are not new. Statistics, control theory, human factors, accounting, and security economics have each spent a century finding the ways their claim type fails.

Engineering teams rediscover those failure modes the expensive way, one outage at a time, and usually without ever naming what they hit. **This policy makes the borrowing deliberate, cheap, and reviewable.**

It is not a reading list, and it is not a bias checklist. It is one required line in every ADR, one filter that decides whether a borrowed concept is real, and a records file that accumulates what each repo has learned.

---

## 1. Why this exists — the incident

**HopSkipInc/ai-fleet, 2026-08-02.** A draft ADR (ADR-062) set out to fix a measured defect: the eval CI gate reported two documentation-only commits as a **+12.5% quality improvement**, on an 8-case dataset where a single flipping case *is* 12.5%. The draft carried six rules — repeat counts, medians, noise floors, baseline provenance, judge calibration, gate-versus-probe boundaries. It was internally consistent, enforced, and reviewed.

It was also about to make things worse in a way nobody in the room could see.

Every one of those six rules addressed **variance**. None addressed **bias**. Running an eval three times instead of once yields a tighter estimate — of whatever the dataset happens to measure. Applied to an unrepresentative sample, the ADR would have made the gate *more confident without making it more right*, which is a worse failure than the false greens it was written to fix.

The gap was found by a single question from a human reviewer: *"our design eliminates survivorship bias risk, correct?"*

Applying that lens took under an hour and produced:

- **A harness defect** — the eval fixture invoker returned `{ ok: true }` unconditionally, so **no eval case could express a failing tool**. Every eval ever run had executed in a world where every tool succeeded. Filed as a whole-class coverage gap that no amount of dataset growth reaches.
- **Two named sampling hazards** written into the ADR so downstream work inherits rather than rediscovers them: mining test cases from production traces samples only the conversations that happened (users who gave up leave no trace), and retention plus redaction remove a non-random subset skewed toward the easy and the recent.
- **A seventh rule**, plus an explicit statement in Consequences that the ADR governs variance and not bias, naming which issues own bias.

**The mechanism that produced this was luck.** Two research agents had read ~28 vendor pages and all 61 ADRs in that repo and surfaced none of it. It took one human who happened to know a term from sampling theory and happened to be suspicious at the right moment. That is not a process. This policy is the attempt to make it one.

---

## 2. The rule

> **A borrowed concept earns its place only if it generates a falsifiable prediction about the artifact in front of you.**

"Survivorship bias" earned its place because it predicted something specific and checkable: *there exists production behaviour this harness structurally cannot represent.* Someone went and looked. It could have come back negative — the harness could have handled error outcomes fine. It didn't.

"Our agents are like an ant colony" predicts nothing, cannot come back negative, and changes no code.

This single filter is what separates disciplinary grounding from decorative interdisciplinarity. Apply it ruthlessly. If you cannot state the prediction in one sentence, and you cannot say what a negative result would look like, **you have a metaphor, not a lens.**

A negative result is a success and must be recorded as one. "Checked X, found nothing" is real evidence and belongs in the records file. A framework that only ever records confirmations is itself running on survivorship bias.

---

## 3. Claim classes and their disciplines

Match the discipline to **the kind of claim the artifact makes**, not to its subject matter. An ADR about agents is not a "computer science" problem — it is whichever of these it asserts.

| When the artifact claims… | Borrow from | Core questions |
|---|---|---|
| **A measurement is trustworthy** — scores, gates, baselines, metrics, dashboards | Experimental design, sampling theory | What is the sampling frame? Is this bias or variance? What is the base rate? What does the instrument structurally never see? |
| **A judgment is accurate or fair** — classifiers, LLM judges, rubrics, tiering, scoring | Psychometrics, measurement theory | Construct validity — are you measuring the thing or a proxy? Inter-rater reliability against human labels? Does the scale mean the same thing at both ends? |
| **A feedback loop improves things** — self-tuning, optimizers, retraining, auto-remediation | Control theory, econometrics | Goodhart's law — does the metric survive being optimized against? Does the proposer grade itself? Delay, oscillation, distribution shift? |
| **A human will act correctly on this** — alerts, approval gates, dashboards, CI status, review requests | Human factors, HCI | Alarm fatigue — what is the false-positive rate and what happens to attention when it is chronically wrong? Automation bias? Mode error? |
| **A boundary holds under pressure** — authz, tenancy isolation, credential handling, input guards | Security economics, adversarial analysis | Who profits from breaking it? Is it incentive-compatible? What is the cheapest attack, not the most sophisticated? |
| **A number reflects economic reality** — cost caps, budgets, pricing, quotas, usage accounting | Accounting, managerial economics | What is off-balance-sheet? Accrual versus cash — are you reserving against a quantity you cannot know yet? Who bears the cost of being wrong? Moral hazard? |
| **A distributed process is correct** — orchestration, retries, schedulers, queues, workers | Distributed systems theory | Partial failure? Idempotence? Split brain? What is your failure detector and what is its false-positive rate? |
| **An estimate or plan is sound** — timelines, capacity, rollout sequencing, cost projections | Forecasting, decision analysis | What is the reference class? Planning fallacy? Are the intervals calibrated, and against what track record? |

This table is deliberately short. Eight classes covering most of what a platform team decides is more useful than forty that get skimmed. Repos may extend it in their **records file**, not here — extensions are evidence, and evidence is per-repo.

**State the table's own sampling frame:** these eight rows were mined from a single platform repo's decision corpus, so they are the claim classes *that repo happened to make claims about*. Treat the table as a floor, not a census. A firmware repo will meet "this completes in bounded time" (real-time scheduling), a data pipeline "this transformation preserves meaning" — claim types no row here covers. That is what §3.1 and the extension mechanism are for, and it is why nobody needs to enumerate the disciplines in advance: the corpus generates the demand.

### 3.1 Fit — how missing rows become visible

A missing row is invisible in the abstract but loud in the residuals. **Every classification against this table states its fit:**

- **`clean`** — the artifact's claim sits squarely in a row.
- **`forced — <why>`** — the nearest row is named, with one line on why it doesn't quite fit.

A forced fit is not a failure; it is the only signal a missing row ever emits. Forced fits are recorded in the records file's lens log (§5.3), and **accumulated forced fits are the raw material for new claim classes** — the audit's lens-hygiene probe flags three or more pending forced fits and asks what row would make them stop being awkward. This is how the table evolves: by residue, not by committee. An extension earned this way carries its forced-fit rows as evidence; an extension proposed from the armchair carries none and must earn its first prediction before it is cited.

---

## 4. The three questions

Where a full lens does not obviously apply, these three force the same work. They are discipline-derived but artifact-facing: each demands you open a file rather than nod.

1. **What does this system structurally never see?** *(sampling frame)*
2. **Who benefits from this measurement being wrong, and what would they do about it?** *(Goodhart, incentive-compatibility)*
3. **What happens when it is right a thousand times and then wrong once?** *(base rates, alarm fatigue, automation bias)*

Question 1 found the harness defect in §1. Questions 2 and 3 are the two that most often come back negative, which is exactly why they are worth asking.

---

## 5. Where this binds

### 5.1 The ADR template gains one required line

Every ADR carries a **Lens** line, placed with the front matter, filled in the **Proposed** draft — never retrofitted at Accepted.

```markdown
**Lens:** <claim class> → <discipline> · predicted: <one sentence> · checked: <where you looked> · result: <confirmed / not found>
```

Worked, from ADR-062:

```markdown
**Lens:** measurement trustworthiness → sampling theory · predicted: production behaviour exists
that the eval harness cannot represent · checked: fixture-tool-invoker.ts, eval case schema ·
result: confirmed — tool failures inexpressible, filed #1486
```

`result: not found` is a complete and valid entry. Record it.

An ADR may name more than one lens. An ADR that genuinely makes no external claim — a pure naming convention, a file-layout decision — writes `**Lens:** none — internal convention, no external claim`, and a reviewer may challenge that.

### 5.2 What is mechanically enforced, and what is not

Per ADR-022, enforcement ships with the promise. Per ADR-048, a promise that ships without its consumer must be registered as such. **This policy is scrupulous about the distinction, because over-claiming enforcement here would be precisely the defect the policy exists to catch.**

| Requirement | Enforcement | Kind |
|---|---|---|
| Every new ADR carries a `**Lens:**` line | `check-design-lens.mjs` — greps `docs/adr/*.md`, fails on a missing line; pre-existing ADRs grandfathered by an explicit list in the script with a tracking issue | **Mechanical** — wired into `npm run check` *and* CI, per ADR-022 |
| The line names a real claim class from §3 or a records-file extension | Same lint — validates the class against the table, plus any extensions declared in the records file §3 | **Mechanical** |
| `checked:` names locations that exist | Same lint — every path-shaped token in the `checked:` field must resolve to a real file in the repo | **Mechanical** |
| `result: confirmed` carries a consequence | Same lint — a confirmation with no trailing detail or reference is flagged | **Reported** (WARN, not a gate — see below) |
| The prediction is genuinely falsifiable | — | **Human review only** |
| The check was performed honestly | — | **Human review only** |
| The right lens was chosen | — | **Human review only** |

The last three cannot be mechanized. Say so out loud rather than inventing a lint that pretends otherwise — a lint that passes on `**Lens:** measurement → statistics · predicted: it's fine` is worse than no lint, because it converts a judgment into a green check.

What the path check buys is subtler than honesty: it **raises the price of the cheapest dishonesty above the price of the work**. Nobody can mechanically verify that a file was read — but a fabricated Lens line whose `checked:` paths must exist and whose confirmation must cite something real costs nearly as much to fake as to do. The ritual-compliance failure mode (§6) always takes the cheapest route; the lint's job is to close the cheap routes, not to pretend it closed them all.

Reviewers carry the unmechanizable part. The PR template gains one line under **ADR**:

```markdown
- [ ] The `Lens` line names a prediction that could have come back negative, states where it was checked, and links the lens-sweep evidence trail (§7)
```

### 5.3 The records file

Each repo maintains `design-lenses-records.md` — same relationship as `agent-routing-records.md` to `agent-routing.md`. The policy is identical across repos; the evidence is not.

It holds three things:

1. **A retroactive naming pass.** Existing decisions mapped to the concept they already instantiate. This is the cheapest high-value work in the whole policy — roughly an hour per repo — because it converts "we learned this the hard way once" into "we recognise this shape on sight."
2. **A running log** of lens applications, including negatives, each row carrying its §3.1 **fit** (`clean` or `forced — <why>`). The forced rows are the input to taxonomy maintenance.
3. **Repo-specific extensions** to the §3 table, with the evidence that earned them and an **origin** (`residuals`, `incident`, `armchair`, `inherited`). The governance repo's promotion sweep reads these across repos — an extension appearing independently in two repos' records, evidence attached, is a candidate for the upstream table. Generalization is settled by counting, not by argument.

---

## 6. Failure modes

Named because each will happen, and each is recoverable if caught early.

**Decorative analogy.** A metaphor that predicts nothing. *Countermeasure:* §2's filter — state the prediction and what a negative looks like, or drop it.

**Ritual compliance.** The Lens line fills with `N/A` or a discipline name and no prediction. *Countermeasure:* the line's required fields are the *prediction* and *where you checked*, not the discipline. A line without those fails review even though it passes the lint. Watch for this first — it is the most likely way the policy dies.

**Lens shopping.** Choosing the discipline that flatters the design. *Countermeasure:* the claim class determines the lens, and the claim class is a property of the artifact, not the author. If your ADR gates a merge on a number, you owe the measurement lens whether or not you enjoy it.

**Expertise theater.** Invoking a concept you don't understand well enough to apply. *Countermeasure:* if you cannot state the falsifiable prediction in one sentence, you do not have the concept yet. Borrowing the vocabulary without the mechanism is worse than not borrowing, because it inoculates the team against hearing the real version later.

**Retrofitting.** Applying the lens after the design is fixed, to justify it. *Countermeasure:* the line lands in the **Proposed** draft. An ADR arriving at Accepted with its first Lens line is a review finding.

**Escalation to ceremony.** Someone proposes lens sections, lens sub-reviews, a lens council. *Countermeasure:* this policy is one line in a template plus a records file. If it grows a fourth artifact, something has gone wrong.

---

## 7. Division of labour between humans and agents

This matters for any repo running agent fleets, and it is drawn from watching it happen rather than from theory.

**Agents apply a named lens exhaustively and well.** Given "read this as a statistician," an agent will trace the implication into the code, find the specific line, check the adjacent surfaces, and reason about what the lens does and does not cover. In §1's incident, that work — from question to filed defect to a new ADR rule — took under an hour and was thorough.

**Agents do not reliably notice that a lens is missing — in the open-ended, no-taxonomy case.** Two research agents read ~28 external pages and 61 ADRs and surfaced nothing. An artifact contains no signal announcing that an unconsulted discipline would object; absence is not represented in the text. **But that incident predates this table.** Once the table exists, lens selection collapses from absence detection (hard, unowned) to classification against a fixed list (agent-tractable). The absence problem survives only at the table's edges — noticing that *no row fits* — and §3.1 converts even that into an observable: the forced fit.

So:

| Step | Owner | Why |
|---|---|---|
| Propose candidate claim classes from the artifact, with fit | **Agent** | A classification task against a fixed table — agents are good at this, and it beats a human's memory for which classes exist |
| Challenge the classification, especially a `Lens: none` or a forced fit | **Human** | The residual judgment — cheap to exercise on a proposal, unreliable from a blank page |
| Apply the lens exhaustively, trace to code, produce the prediction and check it | **Agent** | Mechanical once named, and benefits from tirelessness |
| Judge whether the result changes the design | **Human** | The `gate:human-review` case — a judgment no test settles |
| Propose new claim classes from accumulated forced fits | **Agent** (audit-time) | A missing row is invisible in the abstract but loud in the residuals — "what row would make these five awkward entries stop being awkward" is evidence-driven, not open-ended |
| Confirm an extension; sign off on upstream promotion | **Human** | An extension binds future reviews; a promotion binds other repos |

Note this is the same shape as the routing classifier: **it proposes, it never labels.** Reuse the idiom; the team already understands it.

**The application pass runs in a separate session from the authoring session** — `skills/lens-sweep/` exists for this. A session that spent an hour building a design has every contextual incentive to find `not found`; the sweep agent sees only the artifact, never the design rationale. Same reasoning as the routing classifier's pin: the instruction must not be read by the thing it binds. The sweep's deliverable is the proposed Lens line **plus its evidence trail** — quoted code from the checked files, what was looked for, what was found. A reviewer skimming a real trail catches a fabricated one far more reliably than a reviewer reading a one-line attestation.

Practical form: at the top of a design session, a human says *"read this as a statistician"* or *"as a human-factors person,"* and the agent sweeps. One sentence of human input buys the whole application pass.

---

## 8. Worked examples

### 8.1 Confirmed — ADR-062 (ai-fleet, 2026-08-02)

| Step | Content |
|---|---|
| Claim | An eval score tells you whether a change made the agent better or worse |
| Class | Measurement trustworthiness |
| Lens | Sampling theory |
| Prediction | There exists production behaviour the harness structurally cannot represent |
| Checked | `host/src/evals/fixture-tool-invoker.ts`, the `EvalCase` schema, trace retention rules |
| Result | **Confirmed** — the fixture invoker returned success unconditionally; no case could express a failing tool |
| Change | New ADR rule on representativeness; a Consequences paragraph stating the ADR governs variance and not bias; a filed harness defect; two sampling hazards documented for downstream work |

### 8.2 Learned the expensive way — ADR-026 (ai-fleet, 2026-05-22)

A CI job ran live tests against production credentials on every push. Transient upstream failures kept it red for weeks. The ADR records that this *"trained reviewers to ignore the X,"* letting real regressions hide in the noise. The fix — separating **gates** (block merges; in-repo only) from **probes** (monitor production; never block) — is sound.

It is also **alarm fatigue**, a solved problem in human factors since the 1970s, arrived at by paying for it and never named as such. Had the claim class been recognised at design time — *a human will act correctly on this signal* — the question "what is this alert's false-positive rate, and what happens to attention when it is chronically wrong?" would have been available for free.

**This is the archetypal case for the retroactive naming pass.** The lesson was already bought; only the name was missing, and the name is what makes the next instance recognisable in advance.

### 8.3 Candidates for retroactive naming

Starting points for a repo's first records pass. Each is an interpretation to be confirmed by someone who knows the decision:

- A rule that an optimizer may never grade its own proposals → **Goodhart's law** (control theory / econometrics)
- Rejecting pre-call cost reservation because the final quantity is unknowable at reservation time → **accrual versus cash accounting**
- Judge accuracy measured as TPR/TNR against human labels → **inter-rater reliability** (psychometrics)
- Default-deny capability resolution for untrusted tenants → **incentive-compatibility / cheapest-attack analysis** (security economics)
- Watchdogs racing heartbeats against durable timers → **failure detectors** and their false-positive rates (distributed systems)

---

## 9. What this policy does not do

- **It does not make anyone an expert.** It makes the *question* available at the moment it is cheap to ask. Depth is the reviewer's job.
- **It does not catch novel failure modes** — only ones some discipline has already characterised. Genuinely new problems still cost full price.
- **It does not replace the Definition of Done, testing methodology, or ADR discipline.** It sits upstream of them: those verify you built the thing right; this asks whether the thing claims more than it can support.
- **It is not a research mandate.** Nothing here required reading a paper. Survivorship bias, Goodhart's law, and alarm fatigue are all famous. The constraint was never knowledge — it was *asking at the moment the artifact made the relevant claim*. That is a trigger problem, which process solves.

---

## 10. Downstream installation

### 10.1 Per-repo steps

1. Copy `design-lenses.md` into the repo's docs directory, preserving the version stamp.
2. Create `design-lenses-records.md` from the records template. Seed it with the retroactive naming pass — budget about an hour; §8.3 gives starting points.
3. Add the **Lens** line to the repo's ADR template.
4. Add the reviewer checkbox to the PR template under **ADR**.
5. Install `skills/lens-sweep/` — the separate-session application pass (§7). Without it, Lens lines get written by the authoring session, which is the proposer grading itself.
6. Install `check-design-lens.mjs` and wire it into `npm run check` **and** CI. Repos with a lint-coverage meta-lint will fail until it is in both — that is the meta-lint working.
7. Grandfather pre-existing ADRs by explicit list in the script, with a tracking issue for the backfill. Do not backfill in the install PR; a bulk retrofit produces exactly the ritual compliance §6 warns about.
8. Add the lens-hygiene probe to the repo's audit domains (see the Definition of Done's audit section) — it is the standing form of the §10.3 first-cycle check, and it is where forced fits get read.
9. Add the row to the repo's **Synced templates** table:

   | Template | Installed version | Synced on |
   |---|---|---|
   | docs/design-lenses.md | 1.1.0 | YYYY-MM-DD |
   | docs/design-lenses-records.md | 1.1.0 | YYYY-MM-DD |
   | .claude/skills/lens-sweep/SKILL.md | 1.0.0 | YYYY-MM-DD |
   | scripts/check-design-lens.mjs | 1.0.0 | YYYY-MM-DD |

### 10.2 Client prompt row

For `downstream/<client>/_client.md`, as `YYYY-MM-DD-design-lenses.md`:

> Install the Design Lenses policy. Copy `templates/design-lenses.md` into the repo's docs directory with its version stamp intact. Create `design-lenses-records.md` from `templates/design-lenses-records.md` and seed it with a retroactive naming pass over existing ADRs — map each to the discipline concept it already instantiates, using §8.3 as starting points; aim for five to ten entries, not exhaustive coverage. Add the `**Lens:**` line to the ADR template and the reviewer checkbox to the PR template. Install `templates/skills/lens-sweep/` as `.claude/skills/lens-sweep/` — Lens lines are produced by that skill in a separate session, never by the ADR's authoring session. Install `templates/scripts/check-design-lens.mjs`, wire it into both `npm run check` and CI, and grandfather all pre-existing ADRs by explicit list with a tracking issue for the backfill. Do not backfill in this PR. Add the lens-hygiene probe to the audit domains per the DoD's audit section. Update the Synced templates table. Report which existing decisions the naming pass mapped, and any §3 extensions the repo's domain warranted.

### 10.3 Rollout sequencing

Install into **one** repo first and let it run for a review cycle before propagating. The failure mode to watch for is §6's ritual compliance, and it is only visible once real ADRs have passed through. If Lens lines come back naming disciplines but no falsifiable predictions, fix the template's required fields before the policy reaches the other repos — a policy that has already degraded into ceremony in three repos is far harder to rescue than one.

Suggested first-cycle check: read every Lens line written in the first month and count how many state a prediction that could have come back negative. Below half, the policy is not working yet. After the first cycle, this check does not retire — it becomes the audit's **lens-hygiene probe** (a probe, never a gate: it reads judgment from prose), which also reads the forced-fit residue and the confirmed/not-found ratio. A lens log that is all confirmations after a dozen entries means the lens is only being applied where someone already suspected a problem — which is survivorship bias, run on the policy itself.

---

## Changelog

- **1.1.0** (2026-08-02) — taxonomy maintenance: §3 states its own sampling frame; §3.1 fit (`clean`/`forced`) makes missing rows observable as residuals; §5.2 lint additionally verifies `checked:` paths exist and confirmations carry a consequence; §7 corrects the agent-capability claim to the pre-table case, adds the residual-driven row-proposal steps, and requires the application pass to run in a separate session (`skills/lens-sweep/`); records file §3 extensions gain an origin and feed a cross-repo promotion sweep.
- **1.0.0** (2026-08-02) — initial policy. Derived from the ADR-062 survivorship-bias incident in HopSkipInc/ai-fleet.
