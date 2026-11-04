<!-- template: backlog-grooming.md v1.0.0 · updated 2026-11-04 -->
# Backlog grooming — currency lint, groom pass, weekly roadmap

> **Policy — syncs.** Install as `docs/backlog-grooming.md`. The two artifacts it produces,
> `docs/roadmap-data.md` (generated) and `docs/roadmap.md` (narrative plus your weekly
> commitment), are local and **never sync**. Re-syncing this policy never touches them.

## 1. What this is for

An epic body is written once and read for months. Closing a child updates the child;
nothing carries the change up to the epic. So epic bodies go stale at the rate their
children close, and any roadmap read from them inherits the staleness.

The source repo measured this on 2026-08-20 (ai-fleet). Of fourteen queued blockers, five
were already resolved. Two epics sat fully delivered and still open. One body asserted a
code fact, "the RLS flag defaults off", a month after the flag had been deleted. Every
check in the repo at the time read citation prose or a single issue. None compared an
epic with its children.

The regime has three layers. Each one does what the layer below cannot:

| Layer | What it does | Kind | Writes |
|---|---|---|---|
| 1. Currency lint | Compares every open issue with its sub-issue graph: delivered-but-open epics, closed blockers still cited, labels that contradict the graph, declared-but-unlinked hierarchy, unfiled work, stale milestone rows. Emits a `TRIGGER` for each epic whose children changed after its body did | mechanical, `gh` only | one rolling issue |
| 2. Groom pass | Verifies one epic body's code claims with named commands and proposes corrections, and never edits the body. Ends with a dated marker comment | judgment (agent) | an issue comment |
| 3. Roadmap | **Data pass:** a deterministic projection of the graph (trust header, epic table, debt table). **Narrative pass:** the sequence, dependency horizons and cross-cutting observations, verified the way Layer 2 verifies | mechanical + judgment | `docs/roadmap-data.md`, `docs/roadmap.md` |

Read the roadmap's **trust header** before trusting the roadmap (§6). It reads TRUSTED only
while a groom pass has landed within the cadence, and it shows the lint's last green run
beside that verdict.

## 2. The files

| Template | Install at | Role | Wiring |
|---|---|---|---|
| `backlog-grooming.md` | `docs/backlog-grooming.md` | this policy; §4 is the only definition of the weekly run | read at run time |
| `scripts/lib/backlog-graph.mjs` | `scripts/lib/backlog-graph.mjs` | the one issue-graph loader both scripts share | imported |
| `scripts/check-backlog-currency.mjs` | `scripts/check-backlog-currency.mjs` | Layer 1 | `workflows/backlog-currency-probe.yml` |
| `workflows/backlog-currency-probe.yml` | `.github/workflows/` | weekly probe, upserts the rolling issue | schedule |
| `skills/backlog-groom/` | `.claude/skills/backlog-groom/` | Layer 2 | the weekly run, or `/backlog-groom #N` |
| `scripts/generate-roadmap.mjs` | `scripts/generate-roadmap.mjs` | Layer 3 data pass | the weekly run, or by hand |
| `skills/roadmap-narrative/` | `.claude/skills/roadmap-narrative/` | Layer 3 narrative pass | the weekly run, or by hand |
| `skills/debt-sweep/` | `.claude/skills/debt-sweep/` | dispositions for the oldest unparented issues | by hand, after a regeneration |
| `scripts/check-roadmap-commit.mjs` | `scripts/check-roadmap-commit.mjs` | the commitment gate (§5) | an always-on required PR job |
| `workflows/roadmap-groom.yml` | `.github/workflows/` | the weekly run on GitHub Actions (§7) | schedule. Skip it if you run §4 in-platform |
| `scripts/roadmap-deadman.mjs` | `scripts/roadmap-deadman.mjs` | the deadman's decision logic | imported by the deadman |
| `workflows/roadmap-deadman.yml` | `.github/workflows/` | the watchdog on the weekly run | schedule. Required on every substrate |

The scripts read the GitHub issue graph through `gh`, plus a local scan of `docs/adr/`
headers. They use no database and no MCP. Each one prints `SKIPPED` with the reason when
it cannot read its input, and never reports a clean result it did not observe.

## 3. Cadence — weekly

| When (UTC) | What | Kind |
|---|---|---|
| Mon 08:00 | `stale-blocker-probe.yml`, if installed | probe |
| Mon 08:30 | `backlog-currency-probe.yml` | probe |
| Mon 09:00 | **the weekly run** (§4): groom → data → narrative → one PR | scheduled agent work |
| Mon, in review | **the commitment** (§5): a human fills `roadmap-commit` and merges | human |
| daily 15:00 | `roadmap-deadman.yml`: fires when the newest artifact is 8+ days old (§7) | probe |

Declare the cadence in `docs/definition-of-done.md` with exactly this line. The generator
reads it, and a missing line renders the header UNTRUSTED:

```
**Backlog grooming cadence: weekly**
```

**Why weekly and not daily.** ai-fleet ran the roadmap daily from 2026-09-30 to
2026-11-04. It regenerated every day while the commitment stayed weekly, and the
Tuesday–Sunday PRs were meant to merge themselves. They never did, because the repo did
not allow auto-merge. In the last week of the experiment one PR merged (Monday's, by
hand), two were closed unmerged, two runs died and left empty drafts, and one sat waiting.
That added up to six PRs a week for a human to clean up, for data whose only decision
consumer runs weekly. The owner dropped it. A daily cadence becomes a daily ceremony
whether or not anyone schedules one, and the commitment never needed daily data. Re-propose
daily only with a daily *decision* that consumes it.

**Between runs, on demand.** `node scripts/generate-roadmap.mjs` regenerates the data
artifact from any session at any time. Commit it, or don't; the output is deterministic.
The narrative skill runs by hand the same way. An on-demand PR that touches
`docs/roadmap.md` carries Monday's commitment forward unchanged, and the gate allows that
on every day except Monday (§5).

## 4. The weekly run

This section is the run's only definition. `workflows/roadmap-groom.yml` points its agent
steps here, and an in-platform scheduler's stored goal should do the same instead of
holding a copy that drifts. **The order is load-bearing.**

0. **Idempotency.** One run per ISO week. A re-trigger in the same week is a no-op, not a
   second PR.
1. **Groom pass (judgment).** Read the currency lint's `TRIGGER` lines, from the rolling
   issue labeled `backlog-currency-probe` or `node scripts/check-backlog-currency.mjs`.
   Run the `backlog-groom` skill on up to three TRIGGERed epics. **If none fired, groom
   the one open epic whose newest marker is oldest, or one that has never been groomed.**
   A week without a pass is a lapsed week. Post the marker comment on each epic, even when
   nothing was stale. Never edit an epic body; propose corrections in the comment.
   *This runs before the data pass because the trust header reads the newest marker.
   Generating first writes an UNTRUSTED header.*
2. **Data pass (deterministic).** `node scripts/generate-roadmap.mjs`. Confirm it printed
   `wrote docs/roadmap-data.md`. Exit 0 is not proof: on unauthenticated `gh` or a failed
   fetch it prints `SKIPPED` and exits 0 without writing. **A SKIPPED data pass stops the
   run.** Never hand-edit the artifact.
3. **Narrative pass (judgment).** The `roadmap-narrative` skill:
   - Quote the fresh trust header verbatim.
   - Verify every load-bearing claim with a named command.
   - Write only the three `roadmap-narrative:*` marked sections of `docs/roadmap.md`.
   - **Never write the `roadmap-commit` block.**
4. **One PR, which a human merges.** Title it exactly
   `chore(roadmap): roadmap-groom (data + narrative)`. `roadmap-deadman.yml` matches that
   prefix. It touches `docs/roadmap-data.md` and `docs/roadmap.md` and nothing else. The
   body carries:
   - the claim → verdict table for every load-bearing assertion in the narrative;
   - the **recommended** sequence, labeled as a recommendation and not a decision;
   - the committed-set diff: what the current `roadmap-commit` block names, what has
     since closed, and what the recommendation newly proposes or drops;
   - a **"Commitment required"** block naming the two valid answers (§5).

   **Never enable auto-merge** on this PR. The merge is the commitment.

If the data pass SKIPPED or the trust header cannot be read, stop and report. Do not
fabricate a pass.

## 5. The commitment

The sequence in the narrative is the agent's *recommendation*. The commitment is the
human's *decision*, and it lives in its own marked block in `docs/roadmap.md`:

```
<!-- roadmap-commit:start -->
Committed 2026-11-09: #1426, #1471
<!-- roadmap-commit:end -->
```

There are exactly two valid answers: a `#N` list, or `Committed YYYY-MM-DD: none — at
capacity`. An empty or absent block is a lapse, and the gate tells the two apart. The
human fills the block while reviewing the weekly PR. A reviewing agent may type the
human's stated answer verbatim, but nothing auto-fills it or carries it forward on
Monday.

`scripts/check-roadmap-commit.mjs` enforces it. Wire it into an **always-on required** PR
job, never a path-filtered one, with
`--base <base sha> --pr-created <pull_request.created_at>`. The job must check out with
`fetch-depth: 0` so the base commit is present; when git cannot compute the diff, the gate
exits 2 and names the fix rather than guessing. Add `--tz <IANA zone>` if your weekly run
or your reviewers sit near midnight UTC; the gate then reads both the weekday and the date
in that zone. A PR that leaves `docs/roadmap.md` untouched exits 0 immediately. A PR that
touches it is held to the grammar every day. On Monday, the commitment day, the block's
date must also be on or after the PR's creation date.

## 6. The trust header

`docs/roadmap-data.md` opens with a generated header. It has no wall-clock timestamp: the
commit is the timestamp. Every age is measured against the **substrate clock**, the
newest activity anywhere in the graph, so a re-run over an unchanged backlog is
byte-identical and the committed diff is the backlog delta. The header shows:

- `trust:` **TRUSTED** when the newest groom marker falls within the declared cadence of
  the substrate clock, and **UNTRUSTED** when it is older or there is none. The verdict
  reads the marker only;
- `lint last green:` the currency probe's newest successful run and its rolling issue.
  Read it beside the verdict: a header can say TRUSTED while the lint has been red for
  weeks. A probe run that SKIPPED fails its job (§2's workflow), so it never counts as
  green;
- `last groom pass:` the newest marker, who posted it, and the cadence verdict;
- the lint's census line, row counts, and the actionable debt older than 90 days.

When the header says UNTRUSTED, the narrative says so too, and names what would re-trust
it: a groom pass whose marker lands.

## 7. Substrate, and the deadman

Two substrates can run §4:

- **GitHub Actions** — `workflows/roadmap-groom.yml`. It needs `ANTHROPIC_API_KEY` and
  `ROADMAP_PR_TOKEN`: a GitHub App installation token or a fine-grained PAT with Contents,
  Pull requests and Issues write, plus Actions read. The default `github.token` is not
  enough. GitHub's default setting refuses to let it open PRs at all, a PR it does open
  gets no checks, and under required checks that PR can never merge.
- **In-platform** — a scheduler that dispatches an agent with §4 as its goal (ai-fleet's
  `roadmap-groom` cron state machine). Its PR identity is the platform's own app, and it
  skips `roadmap-groom.yml`.

**Install `workflows/roadmap-deadman.yml` on both.** A dead scheduled run produces nothing,
and nothing turns red by itself. ai-fleet's first roadmap probe ran for a week and never
published once, and its judgment passes never ran at all. The deadman sits outside the
scheduler it watches. It looks only at repo artifacts: the newest commit to
`docs/roadmap-data.md`, or the newest PR with the exact title and that file in its diff. It
files one idempotent P1 issue and goes red when that artifact is 8 or more days old.

Its clock is the newer of the run's PR and the merge commit. When the weekly PR merges on
Monday, a missed next Monday fires on Tuesday. A PR merged later in the week pushes the
alarm out by the same number of days, so merge the weekly PR promptly.

## 8. Install

The install order is fixed, because each layer reads the output of the one before it:

1. **Conventions the scripts read** (`issue-authoring.md`): the `epic` label;
   `status:blocked`, `status:needs-decision` and `status:deferred`; `## Dependencies`
   sections; and GitHub sub-issues for epic → child links. Without sub-issue links,
   Layer 1 reports one C4 per epic that declares children in prose, and the roadmap reads
   every such epic as empty. `impl:` labels are optional and fill the roadmap's
   `impl tier` column.
2. **Layer 1**: the lib, the lint, and the probe workflow. Run the probe once by hand, then
   disposition the first census before going further. Install `stale-blocker-probe.yml`
   too, if the backlog carries `blocked-by` refs.
3. **Layer 2**: the `backlog-groom` skill, and the DoD cadence line (§3).
4. **Layer 3**: the generator, the two skills, and `docs/roadmap.md`, created **once** from
   the skeleton below. Never re-copy it after that: from then on it carries your
   commitments. Then wire the commitment gate (§5).
5. **The weekly run**: `workflows/roadmap-groom.yml`, or your in-platform equivalent.
6. **The deadman**: `scripts/roadmap-deadman.mjs` and `workflows/roadmap-deadman.yml`,
   **after** the first weekly PR exists. With no artifact yet, its clock reads as the
   epoch, and it would file a P1 on install day.

The `docs/roadmap.md` skeleton:

```markdown
# Roadmap

A projection of the backlog, trustworthy only while the currency lint is green and
grooming runs on the declared cadence (weekly). `docs/roadmap-data.md` is the generated
data; the marked sections below are written weekly by the `roadmap-narrative` skill.
Everything outside them is author-owned. The `roadmap-commit` block is the human's
weekly decision, gated by `scripts/check-roadmap-commit.mjs`.

<!-- roadmap-commit:start -->
Committed YYYY-MM-DD: none — at capacity
<!-- roadmap-commit:end -->

<!-- roadmap-narrative:sequence:start -->
_Not yet written._
<!-- roadmap-narrative:sequence:end -->

<!-- roadmap-narrative:horizons:start -->
_Not yet written._
<!-- roadmap-narrative:horizons:end -->

<!-- roadmap-narrative:observations:start -->
_Not yet written._
<!-- roadmap-narrative:observations:end -->
```

Replace `YYYY-MM-DD` with the install date. The placeholder is not valid grammar, so the
gate fails a PR that leaves it in place.

## 9. What never happens

- The lint and the generator are never per-PR gates. They project backlog state, and
  backlog state is not a function of a PR's diff. Only the commitment gate (§5) runs
  per PR, and it is diff-scoped.
- No agent edits an epic body, a sub-issue link, a label or an issue's state unattended.
  The groom pass and the debt sweep **propose**, and a human applies.
- No agent writes the `roadmap-commit` block on its own judgment. The weekly PR is never
  auto-merged.
- The run is weekly, not daily (§3).
- `docs/roadmap-data.md` is never hand-edited, and `docs/roadmap.md` is never overwritten
  from the skeleton.
- The `estimate` column renders `thin`. Estimation is a contract seam (PDR-010), not a
  computed field, until a repo's own delivery telemetry can back it.

## 10. Origin

Built and run in ai-fleet first: Layers 1–2 from 2026-08-28, Layer 3 from 2026-09-20,
in-platform from 2026-09-24, and daily from 2026-09-30 to 2026-11-04. Extracted here
2026-11-04 by owner direction, on the weekly cadence. Two extraction gates were still
open when it was extracted: the 2026-08-21 grooming-regime prompt's §8 and the
2026-09-20 Layer 3 prompt's five conditions. The extraction prompt
`downstream/hopskip/ai-fleet/2026-11-04-backlog-grooming-extraction.md` records the gate
state at extraction.
