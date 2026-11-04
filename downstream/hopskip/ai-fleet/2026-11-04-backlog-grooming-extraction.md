# Backlog grooming → synced templates, and the roadmap goes weekly — ai-fleet (2026-11-04)

**Client:** Hopskip (internal)
**Source:** repo-governance session 2026-11-04 — owner direction: *"not digging the daily
roadmap process — too much to remember to work through every day for not a lot of value"*,
then *"do the repo-governance side … propagate to ai-fleet as a downstream first, then …
analytics-infrastructure next"*.
**Ships with:** `backlog-grooming.md` 1.0.0 (new policy) · `scripts/lib/backlog-graph.mjs`
1.0.0 · `scripts/check-backlog-currency.mjs` 1.0.0 · `scripts/generate-roadmap.mjs` 1.0.0 ·
`scripts/check-roadmap-commit.mjs` 1.0.0 · `scripts/roadmap-deadman.mjs` 1.0.0 ·
`workflows/backlog-currency-probe.yml` 1.0.0 · `workflows/roadmap-deadman.yml` 1.0.0 ·
`workflows/roadmap-groom.yml` 1.0.0 · `skills/backlog-groom/` 1.2.0 ·
`skills/roadmap-narrative/` 1.1.0 · `skills/debt-sweep/` 1.1.0.
**Scope:** two things. (1) Replace ai-fleet's local copies of the regime with the synced
templates, which were extracted *from* those copies. (2) Move the `roadmap-groom` run from
daily to **weekly (Monday)**. That second change is **DB-backed and carries a migration**:
the schedule, the dispatch context and the frozen goal all live in the `state_machines` row.

> **The schedule is not a file.** Every cadence reference in `docs/` and `scripts/` can be
> edited correctly while the machine keeps firing daily, because the cron is
> `state_machines.definition->'triggers'->0->>'cron'` in prod. Verification below observes
> the machine's behaviour, never the files this prompt edits.

---

## Why

**The daily cadence never worked as designed.** #3341 (migration 0538, 2026-09-30)
regenerated the roadmap daily and kept the commitment weekly. Tuesday through Sunday were
supposed to be `gh pr merge --auto`, merged by the App with no human involved. That leg has
never landed, because the repository does not allow auto-merge. #4483's own status comment
reads *"Auto merge is not allowed for this repository … a human must merge"*, while its
body claims auto-merge was enabled. Here is what 2026-10-30 → 2026-11-04 produced:

| Day | PR | Outcome |
|---|---|---|
| Thu 10-30 | #4376 | closed unmerged 11-02 |
| Fri 10-31 | #4393 | closed unmerged 11-02 |
| Sun 11-01 | #4411 | empty draft (the run died before retitling), closed 11-02 |
| Mon 11-02 | #4415 | **merged by hand**: the commitment run |
| Tue 11-03 | #4446 | empty draft, still open |
| Wed 11-04 | #4483 | open, green, waiting for a human |

Every PR needed a person, and one in seven carried a decision. The owner dropped the daily
cadence. Turning auto-merge on would make the daily runs hands-off, and it was considered:
it still spends a fleet run a day (cost cap 40 USD) on data whose only decision consumer
is weekly. The policy now fixes the cadence at weekly (`backlog-grooming.md` §3) and asks
for a daily *decision* before daily is proposed again.

**Extraction, over two open gates.** The owner chose to template the full regime now so
analytics-infrastructure can install it next. Both recorded extraction gates were open,
and they are overridden on the record. Their state at extraction:

| Gate | Condition | State 2026-11-04 |
|---|---|---|
| 2026-08-21 §8 (Layers 1–2) | 1. self-test passes | met — 13 fixtures, ported upstream as 21 |
| | 2. two probe cycles, every finding dispositioned | **not met.** Census on 11-04 (#4483 body): `C1=6 C2=42 C3=9 C4=132 C5=44 C6=14` over 782 open, up from `C4=61 C5=38` over 498 on 09-14 |
| | 3. false-positive review | substantially done (PR #2558); no discrete artifact |
| | 4. groom on ≥3 epics, corrections merged by a human | **not met as recorded.** Markers on 29 issues (search, 11-04); corrections are proposed in comments and no merge of one is on the record |
| 2026-09-20 (Layer 3) | 1. two scheduled cycles merged | met (#4415 and earlier) |
| | 2. one byte-identical re-run observed in CI | fixture level only — the determinism test, every run of `run-tests.yml` |
| | 3. one narrative pass human-reviewed, merged | met in the merge sense (#4415) |
| | 4. header seen reporting UNTRUSTED | met — the 2026-09-20 cold start |
| | 5. one debt-sweep batch, dispositions merged by a human | **not met** — no sweep run found (search, 11-04) |

The unmet conditions are about *disposition* (findings worked, corrections applied, sweeps
run), not detection. The templates ship the tuned detectors. Disposition stays the open
problem, and a weekly cadence makes it a once-a-week ask.

---

## Before you write anything

1. Read `templates/backlog-grooming.md` in full. §4 is the single definition of the weekly
   run, and the machine's goal is made to point at it (step 3).
2. **The install targets are live.** Each one has a consumer:
   - `scripts/check-backlog-currency.mjs` — `backlog-currency-probe.yml` runs it, and the
     generator imports `analyze()` from it.
   - `scripts/lib/backlog-graph.mjs` — imported by both scripts.
   - `scripts/generate-roadmap.mjs` — run by the machine's goal step 2, and by hand.
   - `scripts/check-roadmap-commit.mjs` — `run-tests.yml` runs it on the `host-test` job,
     a required check.
   - `scripts/roadmap-deadman.mjs` — imported by `roadmap-deadman.yml`.
   - The three skills — named by path in the machine's frozen goal.
   - `host/src/roadmap/parse.ts` reads `docs/roadmap.md`'s `roadmap-commit` block. The
     grammar is unchanged, but its parity test (local `scripts/roadmap-commit.test.mjs`
     #7) stays local.
3. **`workflows/roadmap-groom.yml` is not installed here.** ai-fleet runs §4 in-platform;
   declare it excluded by substrate.

## What to do

### 1. Install the synced templates byte-identical

| Template | Installs over | What changes vs the local copy |
|---|---|---|
| `backlog-grooming.md` | new `docs/backlog-grooming.md` | new policy |
| `scripts/lib/backlog-graph.mjs` | `scripts/lib/backlog-graph.mjs` | header and comments only |
| `scripts/check-backlog-currency.mjs` | same path | **never lints probe-output issues** (labels `backlog-currency-probe`, `stale-blocker-probe`, `epic-handoff-probe`, `merge-path-probe`). #2352 was firing C5 on its own header line every run, and on each echoed `(unfiled)` finding. Expect the C5 census to drop on the first run |
| `scripts/generate-roadmap.mjs` | same path | the rolling issue is **found by its `backlog-currency-probe` label** in the loaded graph, not the hard-coded `#2352`; the unused `STALE_BLOCKER_ROLLING_ISSUE` is gone. Live output is unchanged while #2352 carries the label (verify) |
| `scripts/check-roadmap-commit.mjs` | same path | a `--tz` flag (default **UTC**). **Wire `--tz America/New_York`** into `run-tests.yml` to keep today's semantics. The date is now read in the same zone as the weekday, which fixes a latent local bug: a Monday-evening ET PR carrying that Monday's block read as stale. An undeterminable diff now **exits 2** instead of evaluating the file. `host-test` already checks out with `fetch-depth: 0`, so confirm that and nothing changes |
| `scripts/roadmap-deadman.mjs` | same path | comments: the weekly boundary |
| `workflows/backlog-currency-probe.yml` | same path | `actions/checkout@v4` (template convention); a SKIPPED run now **fails the job** after upserting the rolling issue, so "lint last green" never counts a run that read nothing |
| `workflows/roadmap-deadman.yml` | same path | `MAX_AGE_DAYS: 2 → 8`; the PR search comes from `weeklyPrSearch()`; generic issue body; labels `roadmap-deadman,bug,P1` (it no longer creates `area:ops`, `theme:governance`, `status:ready`) |
| `skills/backlog-groom/` | `.claude/skills/backlog-groom/SKILL.md` | 1.1.0 → 1.2.0: the weekly trigger and the no-TRIGGER fallback; the local `groom-backlog` relationship is now generic. The marker example now writes a file: the old `--body "…\n\nbacklog-groom: …"` example left `\n` literal in bash, so the marker never started a line and the generator never saw the pass |
| `skills/roadmap-narrative/` | `.claude/skills/roadmap-narrative/SKILL.md` | 1.0.0 → 1.1.0: the trigger is the weekly run, not "after the daily regeneration" |
| `skills/debt-sweep/` | `.claude/skills/debt-sweep/SKILL.md` | 1.0.0 → 1.1.0: generic incident framing |

**Local tests stay local and get adapted, not replaced.** They are wired into
`run-tests.yml`'s matrix and test ai-fleet-only surfaces (the `host/src/roadmap/parse.ts`
parity). The upstream suite covers the templates themselves:
- `roadmap-generator`: regenerate the golden (one line moves to `no open
  \`backlog-currency-probe\` issue`).
- `roadmap-deadman`: re-cut for `MAX = 8` and the weekly cases.
- `roadmap-commit`: pass `America/New_York` explicitly wherever a case depends on it.

### 2. The DoD and the narrative intro

- `docs/definition-of-done.md`: `**Backlog grooming cadence: daily**` → `weekly`, and
  rewrite that paragraph: Monday-only, no auto-merge leg, the merge is the commitment. The
  generator reads this line. **Leaving it at `daily` renders every weekly roadmap
  UNTRUSTED by Tuesday.**
- `docs/roadmap.md`: two "daily" mentions in the author-owned intro, outside the markers.
  Edit them as the author; the narrative skill never touches that prose.

### 3. The migration — weekly cadence (next free number, `NNNN_3341_…`)

`#3341` owns the cadence decision this reverses. Use targeted, guarded `replace()`es in the
0538 style, followed by an integrity block:

- **trigger:** `'0 5 * * *'` → `'0 5 * * 1'` (Monday 05:00 ET; tz stays
  `America/New_York`), guarded on the old value.
- **context:** reverse 0538's per-day form — `daily` → `weekly`, `YYYY-MM-DD` → the ISO
  week `YYYY-Www`, `idempotency_key='roadmap-groom-<YYYY-Www>'`, "in the same week
  collapse to one run". 0560's exemption and `get_execution_context` sentences survive
  untouched.
- **goal:**
  - Step 0's window goes back to the ISO week.
  - Step 1 gains the no-TRIGGER fallback (groom the least-recently-groomed epic).
  - A pointer to `docs/backlog-grooming.md §4` goes after "Work from the repo root."
  - **0538's whole `5) CADENCE SPLIT` block is replaced** by `5) WEEKLY CADENCE`: mark the
    PR ready and STOP, never enable auto-merge, the merge is the commitment.
- **name/description:** `Daily Roadmap Groom` → `Weekly Roadmap Groom`.
- **integrity:** the cron is weekly; no `YYYY-MM-DD>` key and no `daily` opener remain
  in the context; no `CADENCE SPLIT` and no `gh pr merge --auto` remain in the goal;
  the new markers are present. Skip on a fresh DB.

### 4. Docs that describe the cadence

- `docs/design/roadmap-groom-machine.md` §4 trigger row, §5 goal and §6 deadman: add a
  dated banner, and update the trigger row and the deadman bullet. §5 is a snapshot, so
  mark it as one rather than re-copying it.
- `docs/ci-cd-workflows.md`: the `roadmap-deadman.yml` row.
- `CLAUDE.md` Governance section:
  - one Synced-templates row per installed template;
  - `roadmap-groom.yml` declared excluded (in-platform substrate);
  - the applied-updates entry.

### 5. Owner actions — not taken by the applying agent

- Close #4446 (an empty draft), and #4483 or merge it (Wednesday's regeneration, still
  green).
- Nothing in repo settings changes. Auto-merge stays off; the weekly PR does not want it.

## Verification — observe the effect

1. **Prod, after the migration deploys** (read-only):
   ```sql
   SELECT definition->'triggers'->0->>'cron', definition->'triggers'->0->>'tz', name
     FROM state_machines sm JOIN workspaces w USING (workspace_id)
    WHERE sm.slug = 'roadmap-groom' AND w.slug = 'hopskip-default';
   ```
   Expect `0 5 * * 1`, `America/New_York`, `Weekly Roadmap Groom`.
2. **The first Tuesday after deploy** produces no `roadmap-groom` fleet and no new
   `chore(roadmap): roadmap-groom` PR. This is the change itself; nothing else proves it.
3. **The next Monday** produces exactly one PR with that exact title. Its body has the
   "Commitment required" block and no auto-merge, and its trust header reads TRUSTED
   (weekly cadence, fresh marker).
4. **`roadmap-deadman.yml`** stays green through that week. `workflow_dispatch` it on
   the Tuesday after a successful Monday; it must report `age 1`, `fires at 8`.
5. **CI on this PR:** `lint:roadmap-commit` runs with `--tz America/New_York` and passes,
   and the local suites pass.

## Report back upstream

- The migration's integrity block outcome on the first deploy, which is the evidence the
  prod text matched the reconstructed anchors.
- Verifications 2 and 3: the first quiet Tuesday and the first weekly PR.
- Whether the no-TRIGGER fallback fired in the first month. Its frequency says whether
  three-per-week is the right groom budget.
- Anything in the templates that did not install byte-identical, and why. Each one is a
  template defect, not a local deviation.
