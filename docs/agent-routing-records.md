<!-- template: agent-routing-records.md v1.0.0 · updated 2026-07-26 -->
# Agent Routing — Records for repo-governance

**Policy version these records were written against:** 1.10.0
**Last reviewed:** 2026-07-26 — full pin/class review against 1.9.0. The pointer above moved to
1.10.0 on 2026-08-02 (re-sync, commit d897351) *without* a fresh pin/class review; the 1.10.0
delta is the coverage rule, which touches neither. Next full review resets this line.
**Policy:** [`docs/agent-routing.md`](agent-routing.md)

> **This file never syncs.** It is the per-repo counterpart to the policy, which is
> byte-identical everywhere. Everything here is a *record* — dated, local, and unreconstructible
> from upstream. A `cp` from the governance repo must never touch this file.
>
> Split out of `docs/agent-routing.md` on 2026-07-26 (policy 1.9.0). The two were one file, and
> the conventional boundary inside it got crossed: the policy said "append your records here"
> while the adoption checklist verified the same file was `diff -q`-identical to the template.

---

## 1. Model → class

| Class | Models | As of |
|---|---|---|
| standard | GLM-5.2, Claude Sonnet 5, Claude Haiku 4.5 | 2026-07-26 |
| frontier | Claude Opus 5 | 2026-07-26 |

Notes on contested calls:

- **GLM-5.2 is `standard`, not `frontier`.** Recorded because a 2026-07-24 opencode run
  classified this repo's backlog inline and described itself as a "frontier model (glm-5.2)" in
  the PR body. That is the self-certification the pin exists to prevent. The run is scored in
  [`docs/experiments/2026-07-24-glm-issue-7-tier-violation.md`](experiments/2026-07-24-glm-issue-7-tier-violation.md).
- **Claude Sonnet 5 moved frontier → standard on 2026-07-26.** The 2026-07-24 table listed it
  as frontier. Consequence worth stating plainly: **Sonnet 5 may no longer classify issues.**
  Triage requires frontier class, so the classifier pins must resolve to Opus 5 in every
  harness, and a Sonnet-5 session that wants tiers has to delegate.
- **`claude-opus-4-8` removed.** It was in the 2026-07-24 frontier row and had been superseded;
  neither live pin resolved to it. This is the "pin quietly names a retired model" case, caught
  by the 2026-07-26 re-sync — which is the review this table exists to receive.

## 2. Model → harness route

Addresses, not capability claims. The same model reached two ways is the same class.

| Model | Claude Code | opencode |
|---|---|---|
| Claude Opus 5 | `opus` | `opencode/claude-opus-5` |
| Claude Sonnet 5 | `sonnet` | `opencode/claude-sonnet-5` |
| Claude Haiku 4.5 | `haiku` | — |
| GLM-5.2 | — | `opencode/glm-5.2` |

Dashes are "not routed here today", not "unavailable" — fill a cell when a route is actually
used, so an empty cell never reads as a capability judgement.

## 3. Classifier pins

| Harness | Pin file | Resolves to (model) | Class | Reviewed |
|---|---|---|---|---|
| Claude Code | `.claude/agents/routing-classifier.md` | Claude Opus 5 (`opus`) | frontier | 2026-07-26 |
| opencode | `~/.config/opencode/agents/routing-classifier.md` (global) | Claude Opus 5 (`opencode/claude-opus-5`) | frontier | 2026-07-26 |

Both pins resolve to a model this file lists as `frontier`. ✅

**Both pins are live in this environment.** The 2026-07-24 record named only the Claude Code
path; the opencode global agent was installed the same day and went unrecorded until the
2026-07-26 re-sync. The opencode pin is **global** — one agent serves every repo on the
machine — so a change to it affects all governed repos and a re-sync reviews them in batch.

Local deviations from the agent template, preserved deliberately:

- **`hidden: false`** on the opencode global agent (template ships `hidden: true`), so
  `@routing-classifier` is invocable from the picker. Preserved across the 2026-07-26 sync
  rather than clobbered. If the template ever depends on `hidden`, revisit this.

## 4. Routing ratio

| Reading | Date | Escalations / tiered | Stage | Target | Decomposition record |
|---|---|---|---|---|---|
| Baseline | 2026-07-26 | 5/6 (83%) | Bootstrap | record only | 0 split, 0 declared, 5 undeclared |
| Sweep 2 | 2026-08-02 | 3/9 (33%) post-split; 3/3 (100%) pre-split | Adopting | record only — set after a general-backlog reading | 3 split (#13→#17,#18 · #14→#19,#20,#21 · #15→#22), 0 declared not splittable at parent level, 0 undeclared |
| Sweep 3 | 2026-08-02 | 0/4 post-responses; 1/1 (100%) pre-split | Adopting | record only | 1 split (#33→#36,#37 + residue), 1 coverage gap filed (#38), 0 declared not splittable, 0 undeclared |

Measured across all states — the backlog is fully closed, so an open-issue sweep reads zero.

**Sweep 3 run note (refresh mode, sample of one).** Candidate set was exactly #33, the only
untiered open issue; no ratio is reported from a sample of one. Delegation confirmed:
separately-spawned `routing-classifier` (opencode global pin → `opencode/claude-opus-5` →
frontier per §1). The installed global agent was v1.1.0 against template v1.2.0 — the delta
is the 1.10.0 coverage output schema, supplied verbatim in the delegation prompt; the global
re-sync is queued in the pending client prompts rather than done unilaterally from here,
because bumping it would create MISMATCH churn against three client declarations.

**The headline: the first run where the decomposition and coverage rules produced zero
frontier.** #33 classified `frontier (spec)`; the split moved both mechanical halves to
standard children (#36, #37); the two-sentence spec fix (binding demonstration with control
run, register-completeness rule) landed in the same edit as the tier per the anti-gaming
ordering; the coverage record was filed as a gap (#38), not a not-testable — the property is
verifiable at the live level, merely not in CI. Residue: `standard`. Spec-escalation ratio
on the classification: 1/1 (100%) — resolved by split + rewrite combined, none left standing.

**Provenance caution, second instance.** #33 was authored by the same session that wrote the
research note it implements — the same shape as the sweep-2 caution. The classifier's §7
finding is the calibration insight worth keeping: *the spec debt was a missing criterion, not
a missing section.* The issue was structurally complete (Context / Work / four Verifiable
outcomes) and still missed two sentences — "verify by reading the template" where a binary
assertion belonged, and a capability cited to documentation where a demonstration was
required. Same-session authoring produces complete-looking specs with exactly this blind
spot; a structural validator would not catch either gap.

**Kind dispute, settled by the owner: `spec` over `both`.** The losing case — a stanza
demonstrated binding at one harness version can silently stop binding at the next while the
assertion lint stays green — was declined as an `inherent` remainder because the research
note's own "What would change this recommendation" section already carries the re-inventory
trigger. Recorded so a future dispute reads both sides.

**Intent decisions (owner, 2026-08-02):** self-install the enforcement pair on this repo
(lint at `templates/scripts/`, fixtures here, CI wiring, stanza installed locally); the
register's authoritative source is the repo's CLAUDE.md records-files paragraph; the
migration-hook deferral stands (the ai-fleet PreToolUse hook exists at `1cbaa74b` but no
audit-cycle measurement is visible — a trigger is not fired until observed); the PDR-007
boundary review was the #34 merge itself.

**Sweep 2 sample caution (per the classifier's own composition check):** all three parents were
filed together in session 18 (2026-07-31) from one competitive scan of `tacoda/open-refinery` —
3 of 3 from a single provenance, far past the half-the-set threshold. The 100% pre-split rate
and 100% spec-component rate measure that session's authoring, not this repo's backlog. Do not
treat this as a second calibration cycle, and do not add these rows to §5 without marking the
provenance. Delegation was confirmed: classification ran as a separately-spawned
`routing-classifier` agent (Claude Code pin), 2026-08-02. The sweep's standout finding — the
10 standing `check-downstream-drift` MISMATCHes are false positives (declared-path dialect,
line 151) — came from the classifier *running the read-only lint* during surface-mapping,
which is the probe-before-classify rule paying out.

**Decomposition debt:** 5 escalations ÷ ~4 distinct surfaces (bootstrap fidelity, template
version drift, downstream distribution, the taxonomy itself) ≈ 1.25. Low, and expected: this
repo's issues were authored one-per-concern rather than one-per-component. The high *ratio*
with a low *debt* is the honest signature of a small backlog whose work genuinely is mostly
governance-mechanism design — not of a decomposition problem.

**No target set.** Bootstrap stage: the baseline predates the decomposition rule, so it is the
number the rule exists to move, not a number to be judged against. Set a target after the next
triage run produces escalations under policy ≥ 1.8.0.

## 5. Calibration set

### Calibration set (bootstrap run 2026-07-24 — all rows now resolved against outcomes 2026-07-26)

Sample composition: all four open issues at the time. The entire backlog — no epic, no
curation, the honest baseline. Zero carried an under-structure marker (the repo has no such
validator).

**All four issues have since closed, so every row is promoted or corrected below.** Per the
policy, the *classification* stays frozen at triage time; the Status column records what the
outcome proved.

| # | Tier | Kind | Why (frozen at triage) | Status | Outcome evidence |
|---|---|---|---|---|---|
| 7 | frontier | inherent | Bad tiers get skimmed and accepted, and this set is what settles future disputes — silent and compounding. | **confirmed** | The strongest evidence in the set: a *deliberate tier violation* ran GLM-5.2 (standard class) at this issue under the calibration protocol, predictions frozen in advance. Verdict: "the violation validated the tier." It produced a mis-kinded `#4`, which then seeded this very set — the exact silent-compounding failure the tier predicted. |
| 1 | **frontier** | **both** | analyze-repo's template matrix is hand-maintained and named 18 of 36 templates — a bootstrapped repo silently receives roughly the session-8 practice while the analysis still prints a score and reads as a success. Also carried no acceptance criteria. | **confirmed** | Escalated `standard` → `frontier` by human decision (`0e328e9`). It was the dogfood run's *single overconfident call* — the one row a standard-class triager marked "obvious standard", and the one that most deserved a human. Shipped as `check-analyze-repo-coverage.mjs` (`14c6a18`) with the register-not-suppression-list rule. |
| 2 | frontier | ~~spec~~ → **both** | Does not pick a versioning approach; specifying it makes the stamping and drift wiring mechanical. | **corrected** | The `spec` half held — once the approach was chosen, stamping 34 templates was mechanical (`bd460e6`). But the deliverable contained a *silent* failure the triage missed: rule 3 of `check-template-versions.mjs` "was blind to the case it existed for" (`8db1f67`) — it compared dates not versions, so a same-day edit compared equal and a version bump left alone satisfied it. **A drift lint that silently does not detect drift reads exactly like a passing one.** That is an `inherent` component, and the row was filed as pure `spec`. |
| 4 | frontier | **both** | Silent failure (shallow analysis reads as thorough) **and** under-specified (no acceptance criteria bind what "done" means). | **confirmed** | Both halves materialized, each caught by a separate review round. Spec half: the original filing omitted the update-download protocol, added by amendment. Inherent half: v1 recommended a `contents:read` PAT on this repo — which scopes to every client's slice — and review established clients never get read access at all. The revision rewrote 170 of 219 lines (`8b06285`). GLM had originally kinded this `inherent`; human review moved it to `both`. |

**Spec-escalation ratio (frozen at classification): 3 of 4 (75%)** — `#1` both, `#2` both
(corrected from spec), `#4` both. Resolved by rewrite: 1 (`#1` — acceptance criteria written).
Resolved by split: 0.

### Calibration addition (sweep 3, 2026-08-02 — provenance-marked)

Same-session-authored issue, per the §4 caution — do not read this row as a second
calibration cycle.

| # | Tier | Kind | Why (frozen at triage) | Status | Outcome evidence |
|---|---|---|---|---|---|
| 33 | frontier → **standard** post-responses | spec | The template's value rested on a path-globbed permission deny actually blocking an edit, cited to documentation and an allow-side config — never observed to deny. A stanza that installs, stamps green, and does not bind is invisible to every structural gate. | **resolved by split + rewrite** | Split into #36, #37 (both standard); two-sentence spec fix in the same edit as the tier; coverage gap #38 filed (live level, not "not testable"). The kind dispute (`spec` vs `both` on harness-version staleness) was settled `spec` by the owner — the re-inventory trigger already lives in the research note. First run in this repo where decomposition + coverage rules produced zero frontier. |

**Corrections history.** The bootstrap run reported 25%; review moved it to 75%; the outcome
pass leaves it at 75% but changes *which* rows carry the spec component. Every correction has
moved the same direction — toward more spec debt, never less — and the reason is structural:
the run could not reach `both` at all (the CLAUDE.md block it worked from listed two kinds,
fixed in policy 1.5.0), so anything *also* under-specified was recorded as purely `inherent`,
the flattering call. **A two-kind taxonomy systematically under-reports spec debt**, which is
the metric the whole practice exists to drive down.

**Misroutes: zero in both directions.** No row was over-called (no escalation turned out to be
mechanical work covered by tests) and no `standard` issue produced a revert or follow-up bug.
`#2`'s correction is a *kind* error, not a tier error — the escalation itself was right.

**Annotation, pre-1.8.0:** none of these rows carries a decomposition record, because the rule
did not exist when they were triaged. Deliberately **not** retrofitted — reconstructing a split
proposal from a closed issue is invention, not evidence, and would put fabricated records in the
one artifact whose value is being real. Rows triaged from 2026-07-26 forward carry them.

**Standing caution:** four rows is a small set and three of the four resolved to `both`, which
may say more about this repo's authoring in July 2026 than about the taxonomy. Treat it as
weaker evidence than the heuristics table until it has rows from a second triage cycle.

## 6. Repo-specific risk surfaces

| Surface | Paths | Why it fails silently | Covered by tests? |
|---|---|---|---|
| Bootstrap fidelity | `templates/skills/analyze-repo/`, the applicability matrix | A bootstrap omitting half the templates prints the same score as a complete one; surfaces months later as "why doesn't this client have X" | Partial — `check-analyze-repo-coverage.mjs` |
| Template version drift | every `templates/**` stamp | A downstream repo runs an unknown vintage and neither side can tell; a drift lint that silently fails to detect drift reads as passing | Partial — `scripts/check-template-versions.mjs` (rule 3 fixed `8db1f67`) |
| Downstream distribution | `downstream/<client>/` | This repo is the whole book of business; any repo-level read grant to one client leaks every other, and the over-served client has no reason to report it | **No** — design-stage only, see `docs/mcp-governance-sync-research.md` |
| The routing taxonomy itself | `templates/agent-routing.md`, this file | Bad tiers get skimmed, accepted, and seeded into the calibration set that settles future disputes | Partial — `templates/scripts/check-issue-routing.mjs` (structure only, never judgement) |

**The recurring shape:** every surface here fails by *looking like success*. This repo produces
governance artifacts, and a governance artifact that does not govern is indistinguishable from
one that does until someone audits it. That is why the escalation ratio is high and the
decomposition debt is low — the risk is real and it is spread thin, not concentrated.

## 7. Escalate-only lint candidates

Too few escalations (5) to reach the three-per-pattern threshold. Nothing to promote yet.

## Review log

| Date | Policy version | What changed |
|---|---|---|
| 2026-07-24 | 1.0.0 → 1.6.0 | Initial records from the bootstrap run, inside `docs/agent-routing.md` |
| 2026-07-26 | 1.9.0 | Split into this file. Mapping split into class←model + model→route; Sonnet 5 → standard; `claude-opus-4-8` retired; opencode pin recorded; all four calibration rows resolved against outcomes (`#2` corrected `spec` → `both`); ratio baseline and surfaces added |
