# Nick Weber / Hatch — Framework Import Analysis

**Date:** 2026-08-05
**URL:** https://hatch.crankychickens.com/
**Author:** Nick Weber, v1.0, 2026
**Focus:** Does anything in Nick's published methodology fill a hole in this practice, and what must be declined on the record so it is not re-proposed?
**Research coverage:** All nine pages fetched in full via Tavily (`tavily_map` found eight; `/measurement/` was reachable only from the site nav and the Cold Read cross-link, and it is the most load-bearing page on the site). No external sources followed — the site cites Andrew Ng's autonomy spectrum but does not link it.

---

## TL;DR

Nick's corpus is the same practice as this one, arrived at independently from the opposite end: he starts from **measuring an automation that already runs** and works back toward whether it should; this repo starts from **whether work may be attempted** and works forward. Most of the overlap is validation, and validation from an independent instance is worth recording — but three of his ideas are genuinely not in this framework, and one of them fills a hole this repo's own policy names and then leaves empty.

**The headline: `Cold Read`.** After work ships, hand the artifact trail to a model with the original estimate withheld and ask what it would have called the work. The delta is *tier drift*. This repo already asks for that number — audit signal #3, "over-calling costs money instead of correctness, which makes it much harder to notice — report it explicitly" — and ships no mechanism that produces it. What it ships instead is `templates/routing-calibration-protocol.md`: a once-per-repo designed experiment requiring deliberate weak-model runs plus a blind frontier review pass. That is the expensive instrument. Cold read is the cheap continuous one, and the two are complements, not rivals.

**The uncomfortable corollary.** `docs/agent-routing-records.md` §5 reports **"Misroutes: zero in both directions"** across four rows, from an outcome pass performed by readers who had the tier in front of them. Zero over-calls is precisely the reading anchoring predicts, because an over-call looks like carefulness rather than error. That number is not necessarily wrong — but nothing in the current procedure could have produced a different one, and that is the property worth fixing.

---

## Source map

Nine pages, two registers, one methodology — which is this repo's [PDR-003](../pdr/003-two-registers.md) observed in the wild, in an independent practice.

| Page | Register | What it is |
|---|---|---|
| `/cad/` | professional | **Controlled AI Development** — the core methodology. AC-as-specification gate, prompts-as-source, sessions-as-observable-pipelines, Goldilocks fixtures, the eval loop, the Fellowship (TDD) model |
| `/measurement/` | professional | **The Measurement Layer** — construct validity, codebooks, leading vs lagging indicators, operational definitions. Companion to CAD, and the page the rest of the site depends on |
| `/cold-read/` | professional | **Cold Read** — post-ship unanchored re-assessment of shipped work; produces tier drift and classification rules |
| `/casita/` | professional | **The God Function in Feathers** — essay on amplifying a trusted gatekeeper rather than replacing them |
| `/framework/nick-ng` | hybrid | **Nick × Ng** — Ng's autonomy spectrum (one axis) crossed with a process-maturity axis, producing a 2D grid with named danger zones |
| `/ai-ops/`, `/framework/workflow-v3`, `/framework/pipeline-v3`, `/` (TDD-as-specs) | kid / game studio | The same framework run on a children's game project — nest/flock scores, per-skill intervention rates, graduation to fleet, tests-as-specs with a reverse-translation check |

The kid register is not a toy version. The scoring rules on the AI Ops board are stated more precisely than the professional pages state anything (`nest ≥ 4 AND runs ≥ 10 AND rate == 0 → READY`), which is worth noticing: the audience that cannot read between the lines forced the operational definitions the professional register left implicit. Same effect this repo gets from writing for a client's first CI run.

---

## Overlap map

| Nick's concept | Our equivalent | Read |
|---|---|---|
| Blast radius as a **gate**, scored on reversibility × scope × detection lag; "a 0% intervention rate does not reduce blast radius" | The `gate:` family (`gate:human-approval`, `gate:credentials`) | **Independent arrival at the same argument.** His sentence is the cleanest statement of why `impl:` and `gate:` must be orthogonal families that exists anywhere, including here. Validation — except **detection lag**, which we do not have. See carry-forward 2 |
| Codebook — a written definition of what counts as an instance, with examples that do and do not qualify | The calibration set (5–8 worked examples; "triage disputes get settled by nearest neighbour against the set") | Validation. Our policy already says a taxonomy without calibration examples drifts within two months. His framing adds the *name* and the psychometric backing, not the mechanism |
| Parachute Principle — define constructs before the first run; after 30 runs the data is colonized by the team's intuitions | Calibration protocol: "freeze the predictions… if classification happens after the attempts, you have a narrative, not an experiment"; "limits to state before the results arrive" | Validation, strongly. Same rule, better slogan |
| Prompts are source artifacts — version-controlled, reviewed, owned | `downstream/<client>/[<repo>/]YYYY-MM-DD-<slug>.md`, 17/17 conforming, reviewed in PRs | We already do this and do not claim credit for it. His addition — review the *prompt sequence*, not only the output — is a real gap in `/review-sync`, which walks output markers file by file. Minor |
| Goldilocks fixtures — curated ground truth derived from approved AC, gating the PR; objective vs rubric | `docs/testing-strategy.md` §1: every script fires on a known-bad input and clears on a known-good one | Validation of the objective half. The rubric half is declined — see Declined |
| AC as specification, approved before development; "AC written after the fact is documentation" | `templates/issue-authoring.md` — Verifiable outcomes (binary, observable) + Verification, both required by the routing lint | Validation |
| Tests-as-specs, and the reverse translation as a free correctness check | Interview skills; `lens-sweep` running in a separate session; the classifier that "proposes, never labels" | Same idiom. The specific sharpening — restate the rule as *a case it catches and a case it does not* — is not in any of our skills. See carry-forward 5 |
| Beast-mode flag — one massive prompt attempting diagnosis and resolution together, no checkpoint | Observable stop conditions (`templates/agent-routing.md`) | **Not present.** Every condition on our list is a *state* condition; none is about the shape of the attempt. See carry-forward 4 |
| Nest / flock scores, intervention rate, graduation to fleet | — | Declined, with reasons |
| OpenTelemetry session instrumentation | — | Declined ([PDR-006](../pdr/006-no-premature-infrastructure.md)) |
| Cold read → tier drift → classification rules | `templates/routing-calibration-protocol.md`; `docs/agent-routing-records.md` §5 | **The real gap.** See carry-forward 1 |

---

## Carry-forwards

Ranked. Each names the exact file, the cost, and what would show it was wrong.

### 1. Cold read as the cheap half of routing calibration

**What it is.** After work merges, feed the artifact trail — diff, files and modules touched, review rounds, attempts made, which stop conditions fired, any follow-up bug — to a frontier model **with the `impl:` label and the Impl-tier line stripped**, and ask what tier and kind it would have assigned. The delta against what was actually assigned is tier drift. Nick's discipline on the output is the part that makes it more than a vibe: every read must produce at least one **structural finding**, defined as a generalizable classification rule rather than a comment about this ticket. *"Azure B2C was hard"* is not a finding. *"Work touching undocumented third-party auth behaviour is only discoverable in a live environment and cannot be scoped from documentation alone"* is.

**The hole it fills.** Three, actually:

- **Audit signal #3 has no instrument.** The policy asks for misroutes in both directions and says outright that over-calls are "much harder to notice." Nothing produces the number. The one dataset we have reports zero over-calls in four rows, read by people holding the tier.
- **The calibration protocol is the expensive instrument and it has run once**, as the deliberate GLM-5.2 tier violation on `#7` (`docs/experiments/2026-07-24-glm-issue-7-tier-violation.md`). It is a designed experiment with unmerged branches and a paid blind review pass. It cannot be the routine calibration path, and it was never meant to be — it says so: "run once per repo."
- **§5's promotion rule has no procedure.** "Promote a row to confirmed when its issue closes and the outcome matched the tier" describes an outcome, not a method, and the method it implies is an anchored reader.

**Why this is not a downgrade backdoor.** It never touches an issue's label. The Downgrades rule is about relabeling live issues; a cold read reads closed work and produces evidence about the *heuristics*. The calibration protocol already licenses that path — "completes both is the result that should make you loosen the heuristics." Cold read is how that evidence gets collected without designing an experiment.

**Cost.** Nick reports five minutes to pull artifacts and ten for the read. Here it is a skill plus a records section — no infrastructure, so [PDR-006](../pdr/006-no-premature-infrastructure.md) is satisfied by construction.

**Where it lands.** A `cold-read` skill under `templates/skills/`, a §8 in `templates/agent-routing-records.md` for drift readings, and a paragraph in `templates/agent-routing.md` §Audit signals wiring signal #3 to it. Nick's collect-before-encoding rule ports directly onto our bootstrap stage: **the first eight to ten reads are logged and nothing is changed**, because a single drift reading is not evidence and acting on one produces relabeling exactly the way chasing a first-pass frontier ratio does.

**Falsifier.** After ten reads on a repo, if drift is 0 on every row, either the tiering is genuinely calibrated or the read is anchored by something the strip did not remove (the diff itself carries the tier's fingerprints — a `Not splittable:` sentence quoted in a commit message, a split's sibling references). Report which, and if it is the second, the strip is the thing that needs fixing, not the tiers.

### 2. Detection lag — the operational definition of "silent"

**What it is.** Nick scores blast radius on three dimensions: reversibility, scope, and **detection lag** — how long before someone notices. Our heuristics table carries reversibility ("blast radius crosses many modules, or is hard to reverse") and scope, and treats silence as one bit: "failure is silent — a wrong result looks correct."

**Why the third dimension matters here.** One bit forces a judgment call at the exact moment a triager is looking for the flattering answer. A change that reddens CI is detection lag ≈ minutes. A change that produces wrong analytics numbers noticed at quarter close is detection lag ≈ 90 days — loud eventually, and functionally silent. Under the current table a triager who thinks hard reaches `frontier` and a triager who reads "the build would break" stops at `standard`. Naming detection lag converts an impression into a question with a unit.

This is the same move `both` made on the kind field and the non-splittability sentence made on decomposition: replace a judgment nobody can argue with by one that can be checked against the diff afterwards.

**Where it lands.** One row in the assignment-heuristics table and one clause in the `inherent` definition, in `templates/agent-routing.md`. Small enough to ride with carry-forward 1; large enough to need a version bump and a records note either way.

**Support from our own corpus.** `docs/agent-routing-records.md` §6 already reaches this conclusion without the vocabulary: *"every surface here fails by looking like success… a governance artifact that does not govern is indistinguishable from one that does until someone audits it."* That is a detection-lag statement — the lag is "until the next audit," and this repo runs none.

### 3. The codebook rule, applied to the metrics we already ship

**What it is.** Nick: intervention rate "sounds like AI reliability but might be measuring developer patience, ticket quality, or sprint pressure." Every construct needs an operational definition and an inter-rater check, written *before* the first run.

**The finding.** `templates/governance-health.md` ships `failure score = (P0×3) + (P1×2) + (P2×1)` — a weighted sum over a severity classification with **no operational definition anywhere in the template**, no examples of what does and does not qualify as P1, and no inter-rater check. Meanwhile the claim-coverage metric on the same page carries a full derivation contract: named sources, a definition of "claim," a definition of "gate-backed," and a fail-closed SKIPPED rule — because [PDR-008](../pdr/008-claim-coverage-is-a-health-metric.md) made someone write it down.

So this repo knows how to do exactly what Nick is asking for, did it once under the pressure of a PDR, and left the older metric alone. That asymmetry is the finding; the fix is a codebook paragraph for P0/P1/P2 in the same shape as the claim-coverage contract, not a new metric.

**Falsifier, cheap.** Take one past audit's findings, have two readers classify severity independently, and count agreement. Below ~80% and the failure score is averaging different things across cycles and the trend line is not readable.

### 4. The beast-mode flag as an observable stop condition

**What it is.** A single prompt attempting diagnosis and resolution simultaneously with no checkpoint between them. The failure is that the model "confidently resolves the wrong thing because it diagnosed wrong inside a single context window" — and it is invisible in the output, because a confident fix to a misdiagnosed problem looks exactly like a fix.

**Why it belongs on our list.** All six of our observable stop conditions are state conditions — attempt counts, file types, diff size, missing metadata. None describes the *shape of the attempt*, and Nick lists this one under what travels to any team and any domain. It also has a sibling already on our books: anti-pattern 7, **weakened verification**, where the implementer "finds whichever mutation turns the build red, which is rarely the rule that was meant." That is a misdiagnosis surviving because nothing forced the diagnosis to be stated before the fix was written.

**Observable form** (our list requires binary and observable, which rules out "don't be overconfident"): *the issue asks you to find a cause and fix it, and you are about to write the fix without having stated the diagnosis.* State it, then fix. One line in `templates/agent-routing.md` §Observable stop conditions and the CLAUDE.md section template.

**The honest risk.** This is one step from ceremony, and it is the item on this list most likely to degrade into a box someone ticks. If a repo running it cannot point to one case where stating the diagnosis first changed the fix, it should come back off.

### 5. The two-cases restatement

**What it is.** In Casita, a rule submitted in plain English comes back as: *here is what your rule means in practice, here is a case it would catch, here is a case it would not catch — is this what you meant?* The homepage runs the same loop on tests: the model reads the test and says the business rule back, and a restatement that sounds wrong to a stakeholder is a caught spec error.

**Why it is worth taking.** Our interview skills already propose-and-confirm, and `lens-sweep` already runs in a separate session for the right reason. What none of them do is force the confirmation into a shape where a wrong understanding is *visible*. "Is this what you meant?" is answered yes by default. "Here is a case it catches and a case it does not" cannot be — it makes the boundary concrete, and it is a falsifier in miniature, which is the move this repo already requires of every accepted PDR.

**Where it lands.** The confirmation step of `pdr-interview`, `adr-interview`, and `clean-code-interview`, and optionally as a suggested shape for the **Verifiable outcomes** section in `templates/issue-authoring.md`. Cheapest item on this list.

---

## Declined, with reasons

Recorded so the next person reading this site does not re-propose them. A dropped idea with a written reason is a decision; without one it is indistinguishable from an oversight — `docs/code-conventions.md` §3's argument, applied to an external source.

| Idea | Why declined |
|---|---|
| **Nest / flock scores and the graduation event** — per-skill run logs, intervention rates, `runs ≥ 10 AND rate == 0 → READY` | Needs a delivery log, per-skill run accounting, and a dashboard. [PDR-006](../pdr/006-no-premature-infrastructure.md): friction is measured before it is solved, and nothing here is at capacity. It also has the shape `docs/code-conventions.md` §3 rejected for coverage percentages — a number that reads as rigour and is mostly a function of how you counted. **And graduation inverts our Downgrades rule**: Nick's system is built to *reduce* human involvement on evidence; ours forbids de-escalation by design. Both are correct for their domains — his worst case is a wrong sprite, ours is a silent tenant leak — and the difference is the reason not to import the mechanism wholesale later |
| **OpenTelemetry session instrumentation** (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) | [PDR-006](../pdr/006-no-premature-infrastructure.md). Also directly counter-indicated by Nick's own Measurement Layer: "instrumentation without construct definition produces noise faster." Carry-forward 3 is the prerequisite; the telemetry is not the next step after it |
| **Rubric fixtures — LLM-judged pass/fail on subjective output** | `templates/design-lenses.md` §1 is the receipt: an eval CI gate in ai-fleet reported two documentation-only commits as a +12.5% quality improvement, and the ADR written to fix it addressed variance while the actual defect was bias. `docs/testing-strategy.md` §3 already records prose correctness as deliberately untested. A rubric gate over prose is the exact artifact that incident produced |
| **A new "amplify vs. replace" claim class in the design-lenses table** | Tempting — Casita's design test ("does this amplify a trusted gatekeeper, or try to replace them?") is a real claim type about earned authority, and the nearest existing row (human factors / alarm fatigue) is about attention, not authority. **But `templates/design-lenses.md` §3 forbids exactly this move**: extensions are earned from accumulated forced fits, land in a repo's *records* file, and an armchair extension "carries none and must earn its first prediction before it is cited." The correct disposition is a **retroactive-naming candidate** — the `gate:` family and the classifier's proposes-never-labels idiom are both unnamed instances of it, which is the ADR-026/alarm-fatigue shape from §8.2 |
| **Cost and token dashboards per session** | Same as telemetry. The calibration protocol's report item 7 already asks for cost by tier at the one moment it is decision-relevant |

---

## The finding this analysis produces against us

Our own `templates/design-lenses.md` §3 names the claim class and the discipline:

> **A judgment is accurate or fair** — classifiers, LLM judges, rubrics, **tiering**, scoring → *Psychometrics, measurement theory* — construct validity (are you measuring the thing or a proxy?), inter-rater reliability against human labels, does the scale mean the same thing at both ends?

`templates/agent-routing.md` is a tiering system. The lens policy binds ADRs and this repo runs no ADR corpus, so no Lens line was ever owed — but the claim class is ours, the discipline is ours, and the questions have not been asked of our own instrument. Nick's Measurement Layer is that lens, applied, by someone who did not know our table existed.

Two of the three questions already have partial answers sitting in `docs/agent-routing-records.md` §5, and both are the shape the lens predicts:

- **Construct validity — the instrument could not represent one of its own categories.** "The run could not reach `both` at all (the CLAUDE.md block it worked from listed two kinds)… **a two-kind taxonomy systematically under-reports spec debt**, which is the metric the whole practice exists to drive down." That is structurally identical to the ADR-062 incident that produced the lens policy — a harness in which no eval case could express a failing tool. Same failure, different artifact, already on our record and never named as the same thing.
- **Inter-rater reliability — one disagreement, resolved by authority.** §4 records a kind dispute (`spec` vs `both` on `#33`) "settled by the owner." That is the right call for one issue and it is not a reliability measurement. Two independent classifications of the same already-tiered issue would be, and a blind re-classification is the same mechanism as a cold read minus the outcome evidence — which means carry-forward 1 buys this one nearly free.

The third question — does the scale mean the same thing at both ends — is untouched.

---

## Where we go further

Worth stating, because the import list above is long enough to read as deference.

Nick's framework measures **an automation that already runs**: a skill exists, it has a run history, and the question is how much human is still needed. Every construct on the Measurement Layer page presumes a population of runs — intervention rate, nest score, flock score, graduation. The framework has nothing to say about work that has never been attempted, because there is no run to score.

This repo's unit is **an issue nobody has touched**, and the question is whether it may be attempted at all. That is the harder direction, and it is why the decomposition rule exists here and has no counterpart there: Nick can split a workflow into steps because he has watched it run five-step pipelines, per-step dings, exact attribution. Tiering has to divide work into dangerous and mechanical halves *before* anyone has seen either half fail.

His grid does, however, read usefully on this repo as a one-time diagnostic, at no cost: `check-downstream-drift.mjs` and `check-lens-promotion.mjs` are automation built ahead of process — wired to no trigger, "currently reporting findings nobody sees" per `CLAUDE.md`. On the Nick × Ng grid that is the *premature* cell, and it is the cell whose named remedy is "reduce automation or accept the risk explicitly." One of the two was resolved on 2026-08-02 (drift, wired to `/review-sync` Step 5.0); the other is still shouting into the void.

---

## Proposed next steps

- [ ] File the **cold-read** carry-forward as an issue against `templates/skills/` + `templates/agent-routing-records.md` §8 + the audit-signals wiring in `templates/agent-routing.md`. It is `impl:standard` on its face — new skill file, new records section, prose edit — but it touches the taxonomy's own calibration path, which `docs/agent-routing-records.md` §6 lists as a risk surface that fails silently. Decompose before tiering; the skill and the records section are separable from the policy edit.
- [ ] Add **detection lag** to the assignment-heuristics table and the `inherent` definition (`templates/agent-routing.md`), with a version bump and a records note. Smallest high-leverage edit on this list.
- [ ] Write the **P0/P1/P2 codebook paragraph** into `templates/governance-health.md`, in the same shape as the existing claim-coverage derivation contract. Then run the two-reader agreement check against one past audit's findings before trusting another failure-score trend line.
- [ ] Add the **beast-mode stop condition** to `templates/agent-routing.md` §Observable stop conditions and the CLAUDE.md section template — *state the diagnosis before writing the fix* — and pair it with anti-pattern 7 (weakened verification), which is the same failure seen from the other end.
- [ ] Add the **two-cases restatement** to the confirmation step of `pdr-interview`, `adr-interview`, and `clean-code-interview`.
- [ ] **Watch list:** revisit the "amplify vs. replace" claim class when a governed repo's `design-lenses-records.md` accumulates three or more forced fits against the human-factors row — that is the residual threshold `templates/design-lenses.md` §3.1 sets for proposing a new class, and it is the only path that gives the extension evidence rather than an anecdote.
- [ ] **Watch list:** revisit the nest/flock scoring model when a [PDR-006](../pdr/006-no-premature-infrastructure.md) phase trigger fires — if governance-sync ever grows a delivery log with per-run records, per-skill intervention rates become nearly free and the decline above is re-argued on different facts.
- [ ] **Watch list:** revisit in 6 months (2027-02-05) — Nick's pages are all v1.0 and the site states the methodology is under continuous improvement using its own eval loop. Re-read for what the cold read produced after ten to twelve reads, which is the point his own page says the tier-drift patterns start meaning anything, and which is the only external evidence anyone will have that the method works before we run it here.
