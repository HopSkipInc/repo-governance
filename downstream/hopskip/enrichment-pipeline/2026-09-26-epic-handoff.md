# Epic handoff: rolling continuation section + freshness probe — enrichment-pipeline (2026-09-26)

**Client:** Hopskip (internal)
**Source:** repo-governance PR #115 — `epic-handoff.md` v1.0.0,
`scripts/check-epic-handoff.mjs` v1.0.0, `workflows/epic-handoff-probe.yml` v1.0.0,
`issue-authoring.md` 1.4.0, `definition-of-done.md` 1.6.0.
**Scope:** give the epic body a dated rolling handoff so an epic worked across sessions
never costs the next session its live state; port the DoD and issue-authoring deltas into
this repo's **Adapted** files; install the freshness probe.

---

## 0. Before you write anything

- `docs/definition-of-done.md` and `docs/issue-authoring.md` are **Adapted** here (no
  stamp, repo-specific — see the Synced-templates "Adapted" note). **Do not `cp` the
  templates over them**; port the deltas by hand (§4, §5).
- This repo does not run the grooming regime or `check-stale-blockers.mjs`, so the handoff
  probe is the only freshness backstop for epic bodies. Its `stale`/`undated` classes are
  the ones that matter.
- Confirm the install directories before writing: this repo keeps some synced helpers
  under `tools/` and some under `scripts/` (`scripts/check-issue-routing.mjs` is the
  precedent for a synced `check-*` lint). Use the directory that matches its existing
  `check-*` lints and declare the path you chose.

## 1. Install the policy doc

Copy `templates/epic-handoff.md` to `docs/epic-handoff.md`, byte-identical (stamp
`epic-handoff.md v1.0.0` on line 1). Policy doc, not a records file — no stanza change,
and do **not** register it in the enforcement-stanzas register.

## 2. Install the probe

Copy `templates/scripts/check-epic-handoff.mjs` to the repo's synced-lint directory
(verify: `scripts/` unless this repo's convention differs). Body-only, `gh`-based,
probe-class. Declare it wherever this repo inventories installed lints.

## 3. Install the workflow

Copy `templates/workflows/epic-handoff-probe.yml` to `.github/workflows/`. Keep the
`github.token` default — no cross-repo secret is needed. Pick a cron slot that does not
collide with this repo's existing scheduled work. **Probe, never a gate** — never wire it
into a per-PR job (ADR-026).

## 4. Port the delta into the Adapted DoD

In `docs/definition-of-done.md` (Adapted — hand-edit), add the upstream **Epic handoff
(rolling continuation)** block from `templates/definition-of-done.md` v1.6.0. Five rows:
read at session start with the staleness distrust rule; refresh on any child close;
refresh at session end; single writer when more than one session may write; retire on epic
close. Fill the why-block with this repo's own incident — the first time an epic here ran
across sessions and the next session had to re-derive its state.

## 5. Port the delta into the Adapted issue-authoring

In `docs/issue-authoring.md` (Adapted — hand-edit), extend the epic rule with the upstream
1.4.0 sentence: an epic carries a `## ▶ Pick up here — rolling handoff` section once a
session has worked it (not required at creation), refreshed at session end and on every
child close. Point at `docs/epic-handoff.md`.

## 6. Adopt it on the active epics

Add the handoff (exact heading, `**Handoff updated:** YYYY-MM-DD` marker line) to any epic
currently being worked. Let the first probe run surface the rest as a rolling issue — its
`missing` class is report-only precisely so adoption does not start with a wall.

## 7. Declare and record

Add three rows to the **Synced templates** table in `CLAUDE.md` (use the path you actually
installed):

```
| `docs/epic-handoff.md` | v1.0.0 | 2026-MM-DD |
| `scripts/check-epic-handoff.mjs` | v1.0.0 | 2026-MM-DD |
| `.github/workflows/epic-handoff-probe.yml` | v1.0.0 | 2026-MM-DD (cron adjusted to <slot>; probe, never a gate) |
```

Then append one entry to the applied-updates list: the prompt filename, the date, the PR
number, that the DoD and issue-authoring deltas were **hand-ported into the Adapted
files**, and which epic got the first live handoff.

## Verification (observe the effect, not the file)

1. Run the probe locally: it prints a census, exits 0; the epic you adopted reads `fresh`.
2. **Negative probe:** blank the marker on a scratch epic (or use the fixtures), confirm
   `undated` fires and `--gate` exits 1, then restore. Proves the marker is read.
3. `gh workflow run epic-handoff-probe.yml`; the rolling issue labeled
   `epic-handoff-probe` appears. A green run with no rolling issue is a failure.
4. `diff -q` each installed artifact against its template (workflow except the cron slot).
