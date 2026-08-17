# Governance update: the kind field becomes load-bearing — wire the routing lint, gate at close (2026-08-14)

**Applies to:** all four governed repos that installed `scripts/check-issue-routing.mjs`
(ai-fleet, analytics-infrastructure, enrichment-pipeline, infra-ops).
**Source:** measurement run against HopSkipInc/ai-fleet's closed backlog, 2026-08-14
(111 completed issues). Not an upstream template redesign — the rule already exists and
is already `error`-severity. What is missing is that **nothing runs it**, and its scope
excludes the only issues an estimator can learn from.
**Sequencing:** independent of the 2026-08-08 / 2026-08-11 / 2026-08-13 stanza chain.
But **ai-fleet first, other repos after one cycle** — see "Sequencing" below. This follows
PDR-010 Consequences 4 (*"Instrument HopSkip first, template second"*) and PDR-006's rule
that friction is measured before it is solved.
**Depends on:** [PDR-010](../../docs/pdr/010-estimation-calibrates-on-observed-deliveries.md)
(Proposed, 2026-08-14) — which is what makes the kind field load-bearing beyond routing.

## The problem this solves

R3 (`kind-declared`) has been in `check-issue-routing.mjs` since 1.0.0, at `error`
severity. In ai-fleet, **42% of closed `impl:frontier` issues (13/31) carry no declared
kind.** Both facts are true at once because of two gaps:

1. **The lint is installed and wired to nothing.** In ai-fleet, `check-issue-routing.mjs`
   sits at repo root `scripts/`, is declared in CLAUDE.md's synced-templates table, is
   referenced by a comment in `host/scripts/check-root-clutter.mjs` — and is invoked by
   no workflow and no npm script. Fifty-plus sibling lints run via `host/package.json`;
   this one is not among them. It has never executed in CI. *(Verified by exhaustive grep
   2026-08-14. The other three repos must check themselves — I could not inspect them.)*

2. **`const STATE = 'open'` — the lint never sees a closed issue.** That scope is right
   for governance: the point is to fix an issue *before* it is worked. It is exactly wrong
   for calibration. An issue that closes without a kind is permanently unusable as a
   training example, and nothing ever flags it. The backlog self-cleans; the historical
   record silently rots.

### Why this is now worth enforcement effort

The kind field was justified as a routing input. **PDR-010 Decision 1 makes it part of the
estimation bucket key** — alongside tier, files touched, test-surface coverage, DoD work
type, model, and harness. That promotes it from a routing hint to a field the delivery
forecast is computed from, which is a materially higher bar than "a triager should fill
this in."

A supporting measurement, run 2026-08-14 over 111 ai-fleet issues closed `completed`
(1 duplicate, 2 not_planned excluded), using issue cycle time:

| Group | n | p50 (hrs) | p90 (hrs) |
|---|---:|---:|---:|
| tier = standard | 80 | 22.0 | 197.2 |
| tier = frontier | 31 | 165.0 | 409.8 |
| frontier / `both` | 5 | **335.5** | 454.9 |
| frontier / *(no kind)* | 13 | 200.0 | 409.8 |
| frontier / `inherent` | 13 | **26.1** | 239.5 |
| standard / `spec` | 7 | 4.3 | 116.4 |

Tier separates 7.5x at the median (n = 80 / 31). The kind rows point the same way — the
undeclared bucket sits with `both`, not with `inherent` — but **every kind cell here is
thin under PDR-010 Decision 1 (`n` of 5, 7, 13) and no estimate may be derived from any of
them.** They are shown for shape and to motivate collecting the field, nothing more.

**Read the table under three explicit limits**, all of which are things PDR-010 forecloses
in the real practice and which this retrospective could not avoid:

- The unit is wall-clock hours, a human-scale unit PDR-010 forecloses for cost. Hours are a
  lead-time metric; they belong beside `governance-health.md`'s existing trailing-4-week
  lead time, not in a cost baseline. Cycle time also includes backlog queue, not working time.
- The admission filter was `state_reason = completed` — close to merged-and-green, which
  PDR-010 explicitly forecloses. The sample is therefore biased **fast**, in exactly the
  direction PDR-010's hazard paragraph predicts.
- The token axis is entirely unmeasured; that session had no DB access.

What survives those limits is the only claim this prompt needs: **the field is missing at a
rate that would make the bucket key unusable, and nothing currently detects that.** That is
true regardless of what the ratios turn out to be.

One consequence worth stating plainly for the owner: `spec` and `both` are what make
*"rewrite this issue and the forecast tightens"* a mechanical recommendation rather than an
opinion. That is the product argument for spending enforcement effort on a triage field.

### What this prompt deliberately does NOT ask for

**No retroactive kind backfill on closed issues.** `templates/routing-calibration-protocol.md`
is explicit that predictions must be frozen before implementation — "if classification
happens after the attempts, you have a narrative, not an experiment." Labelling a closed
issue's kind having already seen how long it took manufactures exactly that. Historical
gaps stay gaps. The fix is forward-only.

## What changes upstream

- **`templates/scripts/check-issue-routing.mjs` 1.2.0 → 1.3.0.**
  - New `STATE`/window handling: in addition to the `open` sweep, a closed-issue pass over
    a bounded recency window (default: closed within 30 days) applying **R1–R3 only**.
    R4–R8 are contradiction rules about work not yet done and must not fire on closed
    issues. R6 (ungrounded downgrade) is explicitly excluded — it is meaningless post-close.
  - The closed pass reports under a distinct heading and its own exit contribution, so a
    repo can wire the open pass as a blocking gate and the closed pass as a WARN during
    adoption, then promote.
  - Census output gains a `kind coverage` line (count by kind, plus undeclared) — this is
    the number that says whether the repo's history is estimable.
- **`templates/agent-routing.md` → next minor.** A short subsection under the two
  load-bearing rules recording the second purpose: the kind is an input to delivery
  forecasting, `both` is the high-variance bucket, and an escalation closed without a kind
  is a permanently lost data point. This is a *rationale* addition — no rule changes, no
  tier definitions move.

## Sequencing — ai-fleet first

PDR-010 Consequences 4 orders this: *"Instrument HopSkip first, template second. No new
template … until one window has run on this repo's own deliveries."* The same order applies
to the enforcement that feeds it. **Apply steps 1–6 in ai-fleet, run one closed-pass cycle,
read the kind-coverage number, then propagate to the other three repos.** Pushing a probe
to four repos before knowing what its output looks like in one is the friction-before-
measurement move PDR-006 forecloses.

The other three repos should still run **step 1 now** — it is a one-line grep, and knowing
whether the lint is dead there too is free.

## Steps

1. **Confirm whether your repo actually runs the lint.** Do not assume the declaration
   table means it executes:
   ```bash
   grep -rn "check-issue-routing" .github/workflows/ */package.json package.json 2>/dev/null
   ```
   Zero hits outside the script itself and doc/declaration text = the lint is dead.

2. **Install the 1.3.0 script** over your copy at its existing path (ai-fleet: repo root
   `scripts/`; check yours). Keep the path — relocating it breaks the root-clutter
   allowlist in repos that carry one.

3. **Wire the open pass as a gate**, matching how your repo runs its other lints (ai-fleet:
   an npm script in `host/package.json` plus a `run-tests.yml` step; other repos: your
   existing lint job). It needs a GitHub token with issue read scope.

4. **Wire the closed pass**, initially WARN. It needs to run on a schedule, not per-PR — a
   PR does not close issues at merge time reliably enough to gate on. A daily or weekly
   cron alongside your existing probes is right. Per ADR-026 in ai-fleet, this is a
   **probe**, not a gate: it monitors record quality and must never block a merge.

5. **Close the meta-gap.** If your repo has a lint-coverage checker (ai-fleet:
   `host/scripts/check-lint-ci-coverage.mjs`), extend it to cover lints living outside the
   primary scripts directory. A lint-coverage check that cannot see the repo-root
   `scripts/` directory is how a template-installed, error-severity rule ran for ten days
   without executing once.

6. **Record the kind-coverage baseline** in your routing records file (ai-fleet:
   `docs/agent-routing-records.md`) — the census line from the first closed-pass run.
   That is the before-number for the next audit cycle, and it is the number that decides
   whether PDR-010's bucket key is populated well enough to compute anything from.

## Verification

```bash
# 3 — open pass runs and is reachable from the repo's normal lint entrypoint
npm run lint:issue-routing            # or your repo's equivalent; must exist
# 4 — closed pass runs, reports R1–R3 only, and prints kind coverage
node scripts/check-issue-routing.mjs --closed --days 30
# 5 — the coverage checker now sees the root script
npm run lint:lint-ci-coverage         # ai-fleet; must not report it as unwired
```

The step-1 grep run again should now return hits in a workflow file. If it does not, the
lint is still dead and steps 2–6 changed nothing — that is the failure mode this whole
prompt exists to catch, and it is invisible unless you re-run the grep.

## Note for the PDR-010 author — measured 2026-08-17, one claim retracted

An earlier draft of this prompt suggested PDR-010's schema addition might be five fields
rather than six, on the grounds that `agent_spans.fleet_id → fleet_runs.fleet_id →
fleet_runs.pr_url` looked like an existing two-hop span → PR path. **That is retracted.**
Measured against prod: **`agent_spans.fleet_id` is NULL on 29,532 of 29,532 rows** — every
row is `source='host'`, and the MCP `record_span` worker tool has never written one. The
path exists in the schema and resolves **zero** spans. PDR-010's *"verified missing"* is
not overstated, the addition stands at **six** fields, and harness identity is confirmed
recorded nowhere.

Three findings from that run that do bear on Consequences 1:

1. **The token vector already exists, in a different table.** `events` where
   `event_type='worker.cost'` carries `{fleet_run_id, worker_name, model, input_tokens,
   output_tokens, cache_creation_tokens, cache_read_tokens, cumulative_*}` — 15,997 events
   resolving to 81 of 83 registered runs, no NULL token fields, cumulative counters
   reconciling with delta sums. So Decision 3's "host DB carries token vectors" is already
   satisfied — by the event stream, not by `agent_spans`. **Open question for the author:
   are spans the right home at all, or should `worker.cost` be promoted to the record of
   account and the six fields land there instead?** That is a different scope than
   instrumenting a table nothing writes.
2. **The unattributed line is 49.5%.** 73 runs carrying 15,680 `worker.cost` events and
   ≈1.23 B tokens have no `fleet_runs` row — mostly `fwm-*` and local/dev harness runs
   emitting into the prod event store. Decision 2 says a large unattributed line means the
   allocation rule is wrong; at nearly half of all observed fleet spend, that test fires.
   The cause is specific and fixable — a dispatch path that emits cost events without
   registering a run — so this is a bug with a number attached, not an accounting posture.
3. **Cache reads are 96.0% of admitted tokens.** This vindicates Decision 3's insistence on
   the four-class vector: a blended total would misstate spend by roughly an order of
   magnitude, since cache reads price near a tenth of input. It also implies
   ai-fleet's `FLEET_BUDGET_CLASS_TOKENS` "blended token" classes need a cache-class-aware
   mix assumption — a **cap** concern, and therefore out of scope here per Decision 4's
   separation, but it should not be lost.

Full retrospective, with the admission-filter deviations stated: ai-fleet
`docs/agent-routing-records.md`, section dated 2026-08-17, marked *retrospective, PDR-010
Proposed*.

### And the coverage number bears on this prompt directly

**Only 17 of 113 tiered closed-completed issues (15%) have any linked fleet run**; 14
survive admission. The other ~85% were closed by hand or by interactive sessions with no
fleet telemetry at all. Token spend tracked the tier in the right direction (p50 11.8 M
standard vs 39.5 M frontier, ~3.3× against 7.5× in calendar) but every cell was thin and
the `standard` bucket pooled two models, so nothing was derived.

The consequence for enforcement: **the kind field's value is currently realised through the
calendar axis, not the token axis**, because the token axis only sees a recent fleet-only
slice. That does not weaken the case for collecting the field — it is the input to both
axes — but it does mean this prompt should not be justified to anyone as unlocking a dollar
forecast. It unlocks the bucket key. The dollar half needs the substrate PDR-010 authorizes
plus far more fleet-dispatched delivery than history contains.

## Open question for the owner

The closed pass tells you a kind is missing *after* the issue is closed, which is too late
to fix honestly (see "does NOT ask for" above). The stronger design is a **close-time
gate**: an escalation cannot be closed as `completed` without a declared kind. That is
enforceable via a GitHub Action on `issues.closed`, but it is a workflow change with real
friction and it can be worked around by closing as `not_planned`. Recommend adopting the
probe first, reading one cycle of the coverage number, and deciding on the close-time gate
with that number in hand rather than in advance.
