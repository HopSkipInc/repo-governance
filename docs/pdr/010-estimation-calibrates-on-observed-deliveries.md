<!-- Draft — awaiting confirmation by Greg Leizerowicz. See Status note below. -->
# PDR-010: Estimation calibrates on observed deliveries, measured in tokens

**Status:** Proposed
**Date:** 2026-08-14
**Confirmed by:** — (drafted for Greg Leizerowicz; unconfirmed)
**Last confirmed:** —

> **Status note.** The falsifiers below are present and observable, so the gap between
> this record and `Accepted` is not the falsifier — it is confirmation. The four decisions
> here are methodology-owner calls, and the record is drafted for signature, not signed.
> `lint:pdr-falsifiers` gates `Accepted` records only, so this one passes R1–R2 either way;
> that is a property of the lint, not a reason to read this as live.

---

## Context

An LLM asked to estimate a unit of work produces a number calibrated on **human**
delivery: a cost structure where the expensive parts are typing, context reload, and
coordination. Actual commit history across the governed repos runs orders of magnitude
faster than those estimates. The observation that started this is Greg's, 2026-08-14.

The tempting repair is a multiplier — divide the human estimate by the observed speedup.
That repair is wrong, and the reason is the whole point of this record. **The two cost
structures differ in shape, not by a factor.** Agent delivery puts the expensive parts
somewhere else entirely: retry loops, review latency, and the human in the approval path.
`templates/agent-routing.md` already asserts where that bites — `standard` doc and spec
work is where the speedup is near-total, and `inherent` boundary work is where it is
modest, because the bottleneck there is human review. A single ratio averages over
exactly the distinction the routing policy exists to draw.

**What we know and how.** Three things are already on the record here, and each one
constrains this decision:

1. `templates/routing-calibration-protocol.md` v1.1.0 is already a predict → falsify →
   measure-the-gap loop, run once per repo. Its §"The measurement problem" establishes,
   for tiering, that *"did tests pass"* and *"did it merge"* **cannot be the outcome
   variable**, because green CI is precisely the signal a silent botch produces. Its
   limits section establishes *"one model, one harness, one repo"* — the harness is part
   of the result.
2. `templates/governance-health.md` v1.2.0 already computes trailing-4-week lead time and
   deployment frequency. Rolling-window reporting is not new infrastructure here.
3. `record_span` (fleet-host MCP) already captures the right primitive per turn: `model`,
   `input_tokens`, `output_tokens`, `cache_creation_tokens`, `cache_read_tokens`,
   `duration_ms`, `loop_count`, `tool_call_count`. Cache classes are split out, which is
   what makes real spend computable at all — cache reads price near a tenth of input.

**What is missing, verified 2026-08-14.** `record_span` has no join key to a commit, an
issue, or a PR; `fleet_run_id` / `worker_name` / `agent_role` are injected from the token,
so no commit↔span path exists today. It also carries no harness identity, no reasoning
effort, and no context-compaction signal. Git already carries the other half of the join:
`Claude-Session:` trailers appear in 3 commits and `Co-Authored-By: Claude Fable 5` names
the model, and 35 of the last 60 commit subjects carry a `#N` issue reference.

**The hazard, stated before the numbers arrive.** Three independent gaps bias this
measurement in the same direction — *faster and cheaper*: an admission filter of
merged-and-green admits silent botches, which are fast; cost attached only to landed
commits drops retries and dead ends; spans drawn only from fleet workers drop interactive
human-in-the-loop work, which is the expensive kind. The downstream consumers of this
number are **caps that terminate work** and **metered usage that sets prices**. A
fast-biased baseline therefore produces a budget only fast-and-wrong work can meet, and a
price below cost. This is the enumeration hazard PDR-008 already names — *"an enumerator
that under-counts silently reports high coverage, and the metric becomes the thing it
measures"* — with money and a kill switch attached.

## Decision

Estimation calibrates on a rolling window of **observed clean deliveries**, measured as a
**token vector plus a model-and-harness identity**. Four sub-decisions follow, and the
fourth is the one that makes the other three safe.

**1. Reference class, not ratio.** The unit of estimation is a **bucket**, keyed on
features observable *before* the work: `impl:` tier and kind, files touched, whether a
test surface already covered it, and DoD work type — **plus model and harness**, which are
part of the key and not a metadata column, per the calibration protocol's own limits.
Estimation means "this looks like bucket C; here is what bucket C has actually cost."
Every cell reports its sample count `n`. A cell below a minimum `n` reports **thin** and
derives no estimate and no cap. Carrying a prior model's baseline across an upgrade is
permitted only as an explicit dated assumption with a staleness flag — never as a silent
merge.

**2. Measurement flows span → issue → PR.** Cost is incurred per span, and a large share
of it produces no commit at all: exploration, dead ends, the frontier review pass,
up-to-3× retries under the stop condition, and design conversations like the one that
produced this record. The commit is the **attribution** granularity, never the
**measurement** granularity. Attribution is declared **at dispatch** — via the existing
`spawn-fleet-tool.ts` goal contract — not reconstructed from commit archaeology later,
for the same reason the calibration protocol freezes predictions before the run. Every
rollup carries an explicit **unattributed** line; if it is large, the allocation rule is
wrong, and that is the number that keeps the practice honest.

**3. Storage splits three ways, and dollars are never stored.**

| Layer | Carries | Why there |
|---|---|---|
| Git trailer | `Claude-Session:` (exists), `Issue: #N` (new) | Knowable at commit time, immutable, never needs correcting |
| ai-fleet host DB | token vectors, model string verbatim, durations | Correctable; where cost is actually incurred |
| Committed price table | `(model, token class, threshold mode, effective date range)` | Diffable, PR-reviewed, makes any past window recomputable |

Dollars are a **derived view**, computed at read time. Storing them as the primitive means
a price change silently invalidates the window and re-ranks the buckets. The model string
is stored verbatim because it carries a pricing *mode*, not only an identity — the `[1m]`
long-context variants price at a premium above a threshold.

**4. One measurement, three consumers — and gross is not billable.** The same spans serve
gates, health metrics, and metered usage, and they do not want the same number.
**Calibration takes gross cost**, retries and dead ends included, because that is the true
cost of producing the delivery. **Metering takes billable cost**, because a client is not
charged for our own agent botching a retry or for HopSkip methodology R&D done in their
repo. Both views derive from one record via a **billability classification declared at
dispatch**. Storing only one of the two numbers is foreclosed: bill on gross and we
overcharge for our own mistakes; calibrate on billable and estimates run low, which
produces caps that kill work that was going fine.

**Where the data lands is settled by the offering, per PDR-001.** Serviced-tier work is
performed by HopSkip's own fleet, so the spans are HopSkip's operational telemetry about
HopSkip's own labour, and the ai-fleet host DB is the correct home — this is also the only
tier that carries a price, so metered usage is a serviced-tier concept and nothing else.
Self-serve adopters run bare Node in CI with no MCP access, so **`templates/` ships a
contract — required fields, units, the fail-closed rule — and never an implementation.**
No template may depend on the host DB or on MCP availability. The host DB is HopSkip's
first implementation of that contract, exactly as PDR-008 made the health-template section
a contract that client generators implement per repo.

**Bright line on content.** Spans store counts, identifiers, and durations. **Never prompt
or response content.** Counts about our own execution are our telemetry; the moment a span
carries prompt text or a diff, serviced-tier telemetry becomes client-code egress into a
HopSkip-owned database, which is a different decision with a legal shape and is not
authorized here.

**Admission is fail-closed.** A PR enters the window only if it is DoD-complete for its
work type, is not followed by a revert, fix commit, or reopen inside the window, and has
span coverage for its commits. Missing provenance means **excluded**, never counted clean;
missing span coverage means **SKIPPED**, never counted cheap. Note the honest direction:
exclusions make the baseline *slower*. A recalibration practice that only ever ratchets
toward faster is broken by construction.

**A cap is not an estimate, and is never derived by the same pass.** An estimate is a
forecast and sits near the middle of a bucket's clean distribution. A cap is a kill switch
and sits at a high percentile plus stated headroom. **Caps enforce in tokens**, not
dollars — a token budget is locally checkable and deterministic, and it is the unit the
API actually enforces; dollars are for human reporting. The practice counts how often a
cap fired on work a frontier review later found correct, which is this record's sharpest
falsifier and the protocol's existing rule that *"a stop condition that fires on work the
model would have completed is a tax."*

## Falsifier

- [ ] Revisit when the reconciliation check first runs against a full month of
      serviced-tier spans — if `allocated + unattributed` differs from Anthropic billed
      spend by more than 10%, the span → issue → PR allocation rule is wrong and the
      undercount is measured rather than argued
- [ ] Revisit when the first cap derived from this data fires on work a frontier review
      later finds correct — one such event retires the percentile-plus-headroom rule
- [ ] Revisit at the first model upgrade that lands mid-window — if every bucket falls
      below minimum `n` and the practice yields no usable estimate for a full cycle, then
      keying the bucket on model is too fine and this record owes a pooling rule instead
- [ ] Revisit when the first self-serve adopter implements the contract, if their reported
      token totals for a PR differ from what the host DB computes for the same PR — the
      contract is ambiguous where it pretends to be mechanical
- [ ] Revisit by 2026-11-14 when the window has run 90 days on HopSkip's own deliveries —
      if the observed speedup is uniform across buckets rather than concentrated in
      `standard` spec and doc work, then the shape claim in Context is wrong and a
      multiplier was the right repair all along

## Consequences

**Authorizes**, in this order — the sequencing is itself a decision, per PDR-006's rule
that friction is measured before it is solved:

1. **ai-fleet span-schema additions** — six fields: a commit/issue/PR join key, harness
   identity and version, reasoning effort or thinking tokens, a context-compaction signal,
   a billability classification, and an engagement key. This record authorizes work in two
   repositories; the practice cannot be codified end-to-end from repo-governance.
2. **A versioned price table** committed to this repo, in the #51 option-2
   committed-snapshot shape.
3. **The `Issue: #N` trailer convention.** It must use `Issue:` — **not** `Fixes:`,
   `Closes:`, or `Resolves:`, which auto-close from anywhere in a commit message. That
   gotcha has fired twice here, once in the very commit documenting it.
4. **Instrument HopSkip first, template second.** No new template and no
   `governance-health.md` section until one window has run on this repo's own deliveries —
   the same order PDR-008 imposed on the claim enumerator, and for the same reason. When
   the template does land, the numbers compute in `templates/governance-health.md` beside
   the existing lead-time and deployment-frequency metrics, and the *practice* takes the
   protocol shape as a sibling to `templates/routing-calibration-protocol.md`, reusing its
   three verdicts — correct / incorrect / **weakened verification** — as the admission
   filter rather than inventing a second quality vocabulary.

**Forecloses**, until superseded — recorded so none of it is re-litigated:

- A global speedup multiplier, or any single ratio between human and agent estimates
- Story points, ideal-hours, or any human-scale unit as the measurement
- Merged-and-CI-green as the admission filter
- Caps derived from the same pass as estimates, or expressed in dollars for enforcement
- Dollars stored as the measurement primitive
- Prompt or response content in a span record
- Any artifact under `templates/` depending on MCP, the host DB, or network reachability
- Self-serve client data flowing into HopSkip infrastructure
- A pricing decision resting on metered usage before the reconciliation check has run once

**Relation to issue 51.** The state-store question is the same crux, and this record
answers it once for both: git-history-derived join keys, host DB for hub-side
observations, committed artifact for the price table, and nothing in `templates/`
depending on any of it. Issue 51's open question 7 — *"the same enumerators could feed
both; worth designing together or explicitly not"* — is answered **together**, with
metered billing as the third consumer.

**Owed elsewhere.** A `docs/code-conventions.md` §2 row for the `Issue:` trailer
convention once it is in use, and a §1 row if it is ever linted. Not taken in this record's
PR, because that file is a records file and the convention is not yet in use.

**Open, and deliberately not decided here.** Whether building the metering substrate counts
as pricing work under PDR-002, or is upstream of it. The reading taken while drafting is
that measuring is not pricing — but PDR-002 is the record that says, and the disagreement
is cheaper to find now than after the schema ships.
