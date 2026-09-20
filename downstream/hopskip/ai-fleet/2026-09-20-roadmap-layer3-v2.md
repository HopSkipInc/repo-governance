# Roadmap Layer 3 v2 — generated data artifact + narrative skill — ai-fleet

**Client:** Hopskip (internal)
**Source:** repo-governance session 2026-09-20 — the six hand-built roadmap runs
(2026-08-20 → 2026-09-12) measured against the v1 spec; Layer 3 revised in place, v1 →
v2, in `2026-08-21-backlog-grooming-regime.md` §3 (banner dated 2026-09-20).
**Scope:** build Layer 3 v2 here — the deterministic data pass
(`scripts/generate-roadmap.mjs`) with its committed artifact (**two tables: roadmap +
debt**), the scheduled publishing workflow, the narrative skill
(`.claude/skills/roadmap-narrative/`), and the debt sweep
(`.claude/skills/debt-sweep/`). **No `templates/` artifact ships from this work.**
Extraction waits on one full cycle here (PDR-010 Consequences 4), and Layers 1–2's own
§8 gate is separate, unmet, and not relaxed by this prompt.

---

## Context

The 2026-08-21 regime shipped Layers 1 and 2 (PR #2350) and never built Layer 3 — the
CLAUDE.md governance log entry names the currency lint and the groom skill and never
mentions the roadmap. In the gap, the roadmap was produced six times by hand as chat
Artifacts. Those runs are the pilot, and they falsified parts of the v1 spec:

1. **The table was never the product.** Every roadmap carried a sequence, a dependency
   ordering, and cross-cutting observations — sections a row-per-item schema cannot
   express. v2 splits the deterministic data pass from the judgment narrative pass.
2. **Load-bearing provenance was `file:line@ref`,** not "a command": the claims that
   settled epics were ones like `registry-pricing-table.ts:193` raising rather than
   falling back. A line number without a ref is unfalsifiable a week later.
3. **`expires` density is near-zero** — one genuinely perishable item across ~39 epics
   in six runs.
4. **The trust header — v1's most valuable requirement — was never rendered.** v2 makes
   it a generated field of the data pass so a narrative pass cannot forget it.
5. **v1 never said what is versioned.** v2: both artifacts committed; git is the
   version log; published pages are renders. Re-runs over unchanged substrate are
   byte-identical, or every run is a spurious diff.
6. **Children-win-over-bodies needed its inverse named:** a body can be right about a
   decision while the graph is silently wrong about the shape (#1886's tenancy blocker
   was partly answered by two issues in another epic that never referenced it). The
   rule governs status assertions; intent claims verify against code via Layer 2.

A seventh observation landed the same day, from a census taken while revising: **412 of
525 open issues (78%) have no epic** — one-off bugs and chores that an epic-shaped
roadmap never renders. Their age profile is the tech-debt shape: 229 issues 30–90d old,
63 older, only 25 carrying `status:deferred`. v2 therefore carries a **debt table** in
the data artifact and a **debt sweep** skill to disposition it — visibility for
planning, plus a forcing function for the pile.

The revised §3 is the spec. This prompt is the build order.

---

## Before you write anything

1. **Read the revised §3 Layer 3** in
   `~/repos/HopSkipInc/repo-governance/downstream/hopskip/ai-fleet/2026-08-21-backlog-grooming-regime.md`
   (the v2 banner, 2026-09-20). Where this prompt and that text disagree, that text
   wins — report the collision upstream rather than picking one silently.
2. **Read `scripts/check-backlog-currency.mjs`.** `loadGraphLive` / `loadGraphFixtures`
   / `analyze` and the `gh` helpers are the loader the data pass shares.
3. **Read `scripts/check-stale-blockers.mjs`'s header.** It is a byte-identical synced
   template (v1.0.0). **Do not refactor it to the shared loader** — that drifts it off
   upstream to save a deduplication. Unifying its loader is an upstream template
   revision, owed at extraction time, and this prompt's report-back carries that debt.
4. **Confirm the records stanza does not cover the two new paths:**
   `grep -n "roadmap" .claude/settings.json opencode.json docs/enforcement-stanzas-register.md`
   — expect zero hits, and keep it that way. `docs/roadmap-data.md` is rewritten
   wholesale every run and `docs/roadmap.md`'s marked sections likewise; that is the
   opposite of a record, and a guarded path would funnel a generated file through
   `write-record.mjs`, which is a category error.
5. **Confirm the targets do not exist:** `docs/roadmap.md`, `docs/roadmap-data.md`,
   `scripts/generate-roadmap.mjs` should all be absent.

## What to do

### 1. Extract the shared graph loader

Move graph loading out of `check-backlog-currency.mjs` into
`scripts/lib/backlog-graph.mjs` (`loadGraphLive`, `loadGraphFixtures`, the `gh`
helpers) and import it from both the lint and the new generator. **Proof of a clean
refactor: the lint's output over its fixture corpus is byte-identical before and
after, and the 13 existing fixture tests pass untouched.** No detection-semantics
changes ride this PR.

### 2. The data pass — `scripts/generate-roadmap.mjs`

Deterministic, `gh`-only, no model, no host DB, no MCP. Reads the graph through the
shared loader. Emits `docs/roadmap-data.md`:

- **Trust header first — generated, so it cannot be omitted:**
  - lint last green (from the workflow-run API for `backlog-currency-probe.yml`, with
    the rolling issues #2352/#2351 as the findings surface);
  - last groom pass, measured against the DoD-declared cadence — `current` or
    `lapsed`, and `lapsed` renders the projection **UNTRUSTED** in the header, because
    a stale roadmap that looks fresh is the incident this regime exists to retire;
  - the census line, generated-row count, **and the >90d debt count** — a growing debt
    mass must be visible in the committed diff with no new mechanics.
  - **No wall-clock self-timestamp.** The commit is the timestamp. Every header field
    is a substrate fact that changes only when the substrate changes — that is what
    makes the artifact's diff mean something.
- **The v2 six-column roadmap table** per the revised §3: `status` (derived only —
  child graph, ADR header, or tree check, never a body), `provenance`
  (`file:line@ref` for code claims — the ref is mandatory; command + date for graph
  claims; dated and attributed for owner statements), `block type`, `expires`
  (expected density near-zero), `intent` (the only body-sourced column), `estimate`
  (renders `thin` — the PDR-010 seam stays **keyed, not computed**; §4 of the regime
  prompt is unchanged and this prompt does not touch it).
- **The debt table** — the unparented population (no epic, no children), age-bucketed
  (`<30d` / `30–90d` / `90–180d` / `>180d`), with the bug/chore mix read from labels.
  Columns: issue, age days, last activity, labels, escalation band. `status:deferred`
  renders in a **separate count with its date** — deferred-on-the-record is a
  decision; aging-by-neglect is drift; the table exists to make the two
  distinguishable. The 2026-09-20 baseline for sanity-checking your first run: 412
  unparented of 525 open, 229 in the 30–90d band, 63 older, 67 `bug`, 58 `chore`, 25
  deferred.
- **Deterministic:** stable sorted ordering everywhere; a re-run over unchanged
  substrate is byte-identical.
- **Fail closed:** `gh` absent or unauthenticated → `SKIPPED`, never a clean pass.
- `Issue: #N` join keys on every generated row.

**The last-groom-pass source.** Extend `backlog-groom`'s closing step: a completed
pass posts a dated comment on the epic with a fixed marker line
(`backlog-groom: pass complete — <verdict counts>`). The generator reads the newest
marker across epics. That is the whole mechanism — a groom pass with no comment is
invisible, which is the correct failure direction (it untrusts the header).

### 3. Publishing — scheduled and on-demand, never a gate

- `.github/workflows/roadmap-probe.yml`: weekly cron (land it beside the currency
  probe's slot) plus `workflow_dispatch`. It regenerates the artifact on a branch and
  opens or refreshes a PR with `gh pr create`; **a human merges** — the merge-path
  policy keeps the click, and the PR diff *is* the backlog delta for the week.
- On-demand from any session: `node scripts/generate-roadmap.mjs`, commit by hand.
  Same artifact, same determinism.
- **Classification, stated once:** this is a projection of live backlog state, not a
  function of a diff — ADR-026 and the 2026-08-18 erratum's rule (diff-scoped gates
  gate; state-scoped checks probe) make it probe-class. It never blocks a merge. Do
  not wire it into any PR-gate workflow.

### 4. The narrative skill — `.claude/skills/roadmap-narrative/`

Reads `docs/roadmap-data.md`; verifies every load-bearing code claim with a named
command before asserting it (the Layer 2 contract — `claim → verified | stale |
unverifiable`, with the command and its output beside each verdict); writes prose into
**marked sections** of `docs/roadmap.md`:

- the sequence — "start next, in this order", each row naming what gates it;
- the dependency horizons;
- cross-cutting observations — each a named mechanism, not a theme.

Outside its marked sections it **proposes and never edits** — the backlog-groom
discipline, because the rest of the document is the author's. `file:line@ref` or it is
not provenance. The narrative pass quotes the data artifact's trust header at the top;
it never recomputes it.

### 5. The debt sweep — `.claude/skills/debt-sweep/`

The debt table is detection; this is the disposition, and §8's measured state says
disposition is already the binding constraint in this repo. The skill runs against the
freshly regenerated debt table — same weekly cadence, and on demand (`/debt-sweep`).
Per run, it takes the **N oldest escalation candidates** (>90d band first; default
N=5) plus any `30–90d` bugs it can cheaply repro-check, and for each item:

1. **Triage** — the item has a `status:` label and an `impl:` tier, or it gets routed
   into the routing layer's queue. (17 open bugs had no status label at all on
   2026-09-20.)
2. **Reproduce-or-close for bugs** — verify the bug still reproduces, with the named
   command or observation recorded; if it does not, **propose closure with the
   evidence attached**. A one-off's claims live in its repro steps, not an epic body —
   that is what gets verified.
3. **Parenting and re-parenting** — if an epic owns the item, propose the link; if it
   sits under the wrong epic, propose the move. **Propose, never apply.** A graph
   write is invisible in a PR diff — precisely the unreviewable class — so a human
   clicks. This is the remediation for the children-win inverse: the graph that was
   silently wrong because no link was ever made (#1886) gets a mechanism that makes
   the missing link visible.
4. **A three-way disposition** — fix (scheduled), defer (`status:deferred` **with a
   date**), or close (with a reason). The sweep proposes; a human merges. Batched,
   because the cold-start mass (59 issues at 90–180d) cannot be dispositioned in one
   pass, and a wall gets ignored.

Output is a report (comment on a rolling issue, or the run's output doc): one line per
item — `issue → triage | repro-verdict | parenting proposal | disposition proposal`,
with the evidence beside each verdict.

### 6. Fixture tests

Extend the lint's fixture corpus for the generator and wire it into `run-tests.yml`
beside the currency fixtures:

1. known fixture graph → `roadmap-data.md` output is the committed golden file,
   byte-identical;
2. determinism — two runs over the same fixtures produce identical bytes;
3. forced lapse — a fixture whose last-groom marker breaches the cadence → header
   renders UNTRUSTED;
4. `gh` absent → SKIPPED, exit 0, and no artifact written;
5. debt table — a fixture with unparented issues of known ages lands each in the right
   band, `status:deferred` items render separately with their dates, and the header's
   >90d count matches the fixture.

## Verification

1. **Refactor purity:** the currency lint's fixture output is byte-identical pre- and
   post-extraction. This is the proof step 1 exists; do not skip it because the diff
   "looks mechanical".
2. `node scripts/generate-roadmap.mjs` twice →
   `git diff --exit-code docs/roadmap-data.md` clean.
3. **Header truth:** the emitted last-green date equals what
   `gh run list --workflow backlog-currency-probe.yml --limit 1` reports. Fixture 3
   above observes the lapsed case.
4. **Observe the effect, not the file:** trigger `roadmap-probe.yml` via
   `workflow_dispatch`; a PR appears containing the regenerated `docs/roadmap-data.md`
   and nothing else. A green run with no PR is a failure, however clean the log.
5. One narrative pass run by hand on a live artifact: every code claim in the output
   carries `file:line@ref`; every change outside the marked sections was proposed, not
   written.
6. Grep the artifact for any `status` assertion whose provenance is body-sourced —
   expect zero.
7. Records stanza untouched; `write-record.mjs` never invoked; both new paths absent
   from `docs/enforcement-stanzas-register.md`.
8. **Debt table sanity:** the first live run's unparented count and band distribution
   are within drift of the 2026-09-20 baseline (412 unparented, 229 in 30–90d,
   63 older) — a large divergence means the enumeration is wrong, not that the backlog
   changed that much in a day.
9. **Debt sweep dry run:** one manual `/debt-sweep` over the five oldest >90d items —
   every bug carries a repro verdict with its command, every parenting proposal names
   the target epic, and **no graph write or issue edit happened**: proposals only.

## Report back upstream

- The first live artifact's census versus the probe's own census line — agreement, or
  the discrepancy named.
- The first debt-table read: unparented count, band distribution, bug/chore mix, and
  how it compares to the 2026-09-20 baseline (412 / 229 / 63 / 67 / 58 / 25).
- Any schema column that proved uncomputable from the graph, and what it actually
  reads.
- Whether the loader extraction stayed output-pure (verification 1).
- The first narrative pass's human review: corrections merged, or a recorded
  none-needed.
- The first sweep batch: dispositions proposed by class (triage / repro-close /
  parenting / fix / defer / close), and which the human merged.
- The stale-blockers loader unification is owed **upstream** as a template revision —
  this prompt's application report is where that debt gets acknowledged.

## Extraction gate (for the template, later)

All five before `templates/scripts/generate-roadmap.mjs` ships: (1) two scheduled
cycles landed as merged PRs; (2) one byte-identical re-run observed in CI; (3) one
narrative pass human-reviewed with corrections merged (or a recorded none-needed);
(4) the header observed reporting UNTRUSTED correctly at least once, real or drilled;
(5) **one debt-sweep batch with its proposed dispositions merged by a human** — the
same standard §8 condition 4 sets for `backlog-groom`, for the same reason. Layers
1–2's §8 gate in the 2026-08-21 prompt is separate and unmet — nothing here relaxes
it.
