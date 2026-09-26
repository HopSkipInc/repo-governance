# Epic handoff: rolling continuation section + freshness probe — ai-fleet (2026-09-26)

**Client:** Hopskip (internal)
**Source:** repo-governance PR #115 — `epic-handoff.md` v1.0.0,
`scripts/check-epic-handoff.mjs` v1.0.0, `workflows/epic-handoff-probe.yml` v1.0.0,
`issue-authoring.md` 1.4.0, `definition-of-done.md` 1.6.0.
**Scope:** give the epic body a **dated rolling handoff** so a restart, a failed fleet
worker, parallel sessions, or a night's sleep never costs the next session the epic's live
state; wire the obligation into this repo's Adapted DoD and issue-authoring; install the
freshness probe. **Do not `cp` the DoD or issue-authoring templates** — both are *Adapted*
here (no stamp, repo-specific incident text). Port the delta by hand.

> **Read this repo's grooming regime first.** ai-fleet already owns the
> epic-body-versus-children axis: `scripts/check-backlog-currency.mjs` emits
> `info … TRIGGER children-changed-since-body-update` when a child's `closed_at` is newer
> than the epic's `updated_at`. The handoff probe deliberately does **not** touch that
> axis — it reads epic bodies only. §1 and §6 below are the overlap boundary; do not let
> the two detectors grow a second enumerator over the same graph (PDR-008's
> two-enumerators hazard).

---

## 1. Install the policy doc

Copy `templates/epic-handoff.md` to `docs/epic-handoff.md`, byte-identical (stamp
`epic-handoff.md v1.0.0` on line 1). It is a policy doc, not a records file — no stanza
change, and do **not** add it to `docs/enforcement-stanzas-register.md`.

Its Relationship section names this repo's exact split: `check-backlog-currency.mjs` owns
body-vs-graph; `check-epic-handoff.mjs` owns the handoff section (presence, `Handoff
updated` marker, age). The handoff is the per-epic analogue of the generated roadmap's
trust header: a stale marker makes the do-next order *untrusted*, not wrong. The
`backlog-groom` marker comment on the epic stays the machine marker; the handoff links to
it and never reproduces its counts.

## 2. Install the probe

Copy `templates/scripts/check-epic-handoff.mjs` to `scripts/check-epic-handoff.mjs`,
byte-identical. Body-only, `gh`-based, probe-class. Declare it in whatever lint-coverage
manifest this repo uses (`check-lint-ci-coverage.mjs` or its replacement — verify the
manifest's shape first; the 2026-08-21 grooming prompt set the precedent that an installed
mechanism must be declared so it cannot rot unwired).

## 3. Install the workflow

Copy `templates/workflows/epic-handoff-probe.yml` to `.github/workflows/`, byte-identical
except the cron slot if it collides — land it beside `backlog-currency-probe.yml` and
`stale-blocker-probe.yml`. It uses the default `github.token`; no cross-repo secret is
needed, because the probe never reads another repo.

**Probe, never a gate.** Do not wire it into any per-PR workflow. The state of the backlog
is not a function of a diff (ADR-026; the 2026-08-18 erratum).

## 4. Port the delta into the Adapted DoD

In `docs/definition-of-done.md` (Adapted — hand-edit, no stamp), add the upstream's new
**Epic handoff (rolling continuation)** block from `templates/definition-of-done.md`
v1.6.0 (search that template for the heading). Five rows: read at session start with the
staleness distrust rule; refresh on any child close; refresh at session end; single writer
when more than one session may write; retire on epic close.

Fill the why-block with **this repo's own incident**, not the template's fenced example.
There will be one: the roadmap/groom work (2026-08-20 → 2026-09-20) ran across many
sessions and epics, and re-derivation is exactly the cost this block removes. Use the
real episode.

## 5. Port the delta into the Adapted issue-authoring

In `docs/issue-authoring.md` (Adapted — hand-edit), extend the epic rule with the
upstream 1.4.0 sentence: an epic carries a `## ▶ Pick up here — rolling handoff` section
once a session has worked it (not required at creation), refreshed at session end and on
every child close. Point at `docs/epic-handoff.md`.

## 6. Adopt it on the live epics

The probe's `missing` class is report-only on purpose — first adoption finds every active
epic without a handoff, and a cold-start wall gets ignored. Do not try to hand-write all
of them. Instead:

1. Add (or canonicalize) the handoff on the epic(s) currently being worked, starting with
   whichever epic the roadmap's "start next" names. Use the exact heading and the
   `**Handoff updated:** YYYY-MM-DD` marker line from `docs/epic-handoff.md`.
2. Let the first probe run surface the rest as a rolling issue; work that queue at the
   groom cadence, not in this PR.

## 7. Declare and record

Add three rows to the **Synced templates** table in `CLAUDE.md`:

```
| `docs/epic-handoff.md` | v1.0.0 | 2026-MM-DD |
| `scripts/check-epic-handoff.mjs` | v1.0.0 | 2026-MM-DD |
| `.github/workflows/epic-handoff-probe.yml` | v1.0.0 | 2026-MM-DD (cron adjusted to <slot>; probe, never a gate) |
```

Then append one entry to `### Applied governance updates` (or this repo's equivalent —
verify the heading) recording: the prompt filename, the date, the PR number, that the DoD
and issue-authoring deltas were **hand-ported into the Adapted files**, and which epic got
the first live handoff.

## Verification (observe the effect, not the file)

1. `node scripts/check-epic-handoff.mjs` run locally: it prints a census and exits 0.
   Confirm the epic you adopted in §6 reads `fresh`.
2. **Negative probe:** temporarily blank the `Handoff updated` date on a scratch epic
   body (or use a fixture), confirm the class reported is `undated` and that `--gate`
   exits 1 — then restore. This proves the marker is actually read.
3. `gh workflow run epic-handoff-probe.yml`; a rolling issue labeled
   `epic-handoff-probe` appears with the census and findings — a green run with **no**
   rolling issue is a failure, however clean the log.
4. **Overlap check:** `grep -n "children-changed-since-body-update"
   scripts/check-backlog-currency.mjs` still resolves to its TRIGGER, and
   `check-epic-handoff.mjs` contains no sub-issue fetch. The two axes stay separate.
5. Byte-identity of the three installed artifacts against the templates
   (`diff -q` each), except the cron slot.
