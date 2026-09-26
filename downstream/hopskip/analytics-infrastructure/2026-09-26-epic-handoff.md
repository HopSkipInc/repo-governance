# Epic handoff: rolling continuation section + freshness probe — analytics-infrastructure (2026-09-26)

**Client:** Hopskip (internal)
**Source:** repo-governance PR #115 — `epic-handoff.md` v1.0.0,
`scripts/check-epic-handoff.mjs` v1.0.0, `workflows/epic-handoff-probe.yml` v1.0.0,
`issue-authoring.md` 1.4.0, `definition-of-done.md` 1.6.0.
**Scope:** install the rolling-handoff policy and its freshness probe, port the DoD and
issue-authoring deltas into this repo's **Adapted** files, and canonicalize the live
section on epic #229. **This repo is the source of the practice** — the section was
applied by hand here on 2026-09-25 and is the live example the template was drawn from.

---

## 0. What this repo already has (and what it doesn't)

- Epic **#229** (Data Access Query Gateway) already carries a `## ▶ Pick up here — rolling
  handoff` section dated 2026-09-25 — the real-world application that motivated the
  template. Its date currently sits in the heading: `## ▶ Pick up here — rolling handoff
  (updated 2026-09-25)`. The probe accepts that **legacy** form, but §4 below canonicalizes
  it to the dedicated marker line.
- This repo runs `stale-blocker-probe.yml` but **not** the grooming regime — there is no
  `check-backlog-currency.mjs`. So this probe is the *only* freshness backstop for epic
  handoffs here; the `stale`/`undated` classes are the ones that matter.
- `docs/definition-of-done.md` and `docs/issue-authoring.md` are **Adapted** (no stamp,
  repo-specific — see the Synced-templates "Adapted" note). **Do not `cp` the templates
  over them**; port the deltas by hand.

## 1. Install the policy doc

Copy `templates/epic-handoff.md` to `docs/epic-handoff.md`, byte-identical (stamp
`epic-handoff.md v1.0.0` on line 1). Policy doc, not a records file — no stanza change,
and do **not** register it in `docs/enforcement-stanzas-register.md`.

## 2. Install the probe

Copy `templates/scripts/check-epic-handoff.mjs` to `scripts/check-epic-handoff.mjs`,
byte-identical. Declare it wherever this repo's installed lints are inventoried (verify
the shape — this repo has no `check-lint-ci-coverage.mjs`; the `code-hygiene.yml` job list
is the likely home).

## 3. Install the workflow

Copy `templates/workflows/epic-handoff-probe.yml` to `.github/workflows/`. Keep the
`github.token` default — no cross-repo secret is needed. Adjust the cron only if it
collides with this repo's existing windows (`stale-blocker-probe` Mondays 08:00 UTC;
`issue-routing-probe` Mondays 08:15 UTC). **Probe, never a gate** — never wire it into
`ci.yml` or a per-PR job (ADR-026).

## 4. Canonicalize the live section on #229, and add handoffs to the active epics

1. Edit epic #229's handoff: move the date out of the heading onto its own line —
   `**Handoff updated:** 2026-09-25` (keep the date that is actually true; do not bump it
   to today unless the session genuinely refreshed the content) — and add the
   `<!-- template: epic-handoff.md v1.0.0 · updated 2026-09-26 -->` marker. Keep the body
   of the section; it is a good one.
2. Add a handoff to any other epic currently being worked (the gateway epic is the main
   one). Let the first probe run surface the rest as a rolling issue — its `missing` class
   is report-only precisely so adoption does not start with a wall.

## 5. Port the delta into the Adapted DoD

In `docs/definition-of-done.md` (Adapted — hand-edit), add the upstream **Epic handoff
(rolling continuation)** block from `templates/definition-of-done.md` v1.6.0. Five rows:
read at session start with the staleness distrust rule; refresh on any child close;
refresh at session end; single writer when more than one session may write; retire on epic
close. Fill the why-block with this repo's own incident — epic #229 is the concrete one
(the 2026-09-25 session's closing state, and the handoff section it produced).

## 6. Port the delta into the Adapted issue-authoring

In `docs/issue-authoring.md` (Adapted — hand-edit), extend the epic rule with the upstream
1.4.0 sentence: an epic carries a `## ▶ Pick up here — rolling handoff` section once a
session has worked it (not required at creation), refreshed at session end and on every
child close. Point at `docs/epic-handoff.md`.

## 7. Declare and record

Add three rows to the **Synced templates** table in `CLAUDE.md`:

```
| `docs/epic-handoff.md` | v1.0.0 | 2026-MM-DD |
| `scripts/check-epic-handoff.mjs` | v1.0.0 | 2026-MM-DD |
| `.github/workflows/epic-handoff-probe.yml` | v1.0.0 | 2026-MM-DD (cron adjusted to <slot>; probe, never a gate) |
```

Then append one entry to the applied-updates list in the governance section: the prompt
filename, the date, the PR number, that the DoD and issue-authoring deltas were
**hand-ported into the Adapted files**, and that #229's handoff was canonicalized.

## Verification (observe the effect, not the file)

1. `node scripts/check-epic-handoff.mjs` locally: prints a census, exits 0, and **#229
   reads `fresh`** if you kept its true date within the 21-day window (if the handoff is
   genuinely older, that is a correct `stale` — refresh it rather than faking the date).
2. **Negative probe:** on a scratch epic (or via the fixture corpus), blank the marker and
   confirm the class is `undated` and `--gate` exits 1; then restore. Proves the marker is
   read, not merely present.
3. `gh workflow run epic-handoff-probe.yml`; the rolling issue labeled
   `epic-handoff-probe` appears. A green run with no rolling issue is a failure.
4. `diff -q` each of the three installed artifacts against its template (workflow except
   the cron slot) — byte-identical.
