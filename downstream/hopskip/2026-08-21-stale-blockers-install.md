# Install check-stale-blockers v1.0.0 — the blocker-currency probe (2026-08-21)

**Applies to:** HopSkipInc/analytics-infrastructure. ai-fleet installs the same script as
step 0 of the [2026-08-21 backlog-grooming regime](ai-fleet/2026-08-21-backlog-grooming-regime.md)
— one install, tracked there. Other repos take it on a later sync.
**Ships with:** nothing new — `templates/scripts/check-stale-blockers.mjs` v1.0.0 and
`templates/workflows/stale-blocker-probe.yml` v1.0.0 both shipped 2026-08-18. This prompt
installs them. It requests no template work.
**Source:** the 2026-08-17 cross-repo epic review (three of four apparently-stalled programs
were not blocked — the blocker had closed weeks earlier; one sat 14 days on the critical path
of an irreversible credential revocation, another two months against a blocker that cleared in
May) and the 2026-08-20 ai-fleet roadmap incident, which produced the grooming regime this
probe is one component of.

## 0. Why this half ships first

Unlike the currency lint and groom skill in the regime prompt, this script is **already a
shipped template** — no pilot cycle owed, no §8 gate applies. It reads citation prose
(`## Dependencies` sections, `blocked-by` refs), not the sub-issue graph; the graph axis is
what is piloting in ai-fleet.

Convention check, run 2026-08-21 against the live backlog: **58 of the 60 most recent open
issues** in analytics-infrastructure carry `blocked-by` / `## Dependencies`. The detector has
real signal here. Expect findings on the first run — that is the point of installing it.

What the script detects (each class documented in its header): `phantom` (dependent open,
blocker closed), `unresolved-ref`, `unreachable` (a loudly reported hole, never a silent
zero), `mutual-deferral`, `stale-status`. Probe exit contract per ADR-026: findings never
block a merge; SKIPPED is reported, never counted clean.

## 1. Steps

1. Copy `templates/scripts/check-stale-blockers.mjs` **byte-identical** to
   `scripts/check-stale-blockers.mjs` (this repo's lint home is `scripts/`). Verify with
   `diff` against the template.
2. Copy `templates/workflows/stale-blocker-probe.yml` **byte-identical** to
   `.github/workflows/stale-blocker-probe.yml`. Adjust only the cron comment if a different
   weekly slot suits the triage rhythm — the `schedule` + `workflow_dispatch`-only trigger
   set is the ADR-026 contract and does not change.
3. **The one judgment call: `STALE_BLOCKERS_TOKEN`.** The default `GITHUB_TOKEN` reads only
   this repo. This backlog references ai-fleet (e.g. #243's lockdown chain) — without an
   estate-spanning PAT those refs degrade to SKIPPED scopes, which is a reported hole, not a
   clean pass. Set the secret, or accept a same-repo-only probe with eyes open.
4. Declare the probe wherever this repo declares its CI wiring, so it cannot rot unwired —
   the estate has a live precedent of a validator sitting declared-but-invoked-by-nothing
   for two weeks.
5. Run it once by hand (`gh` authenticated) and disposition every finding: `phantom` → sweep
   the dependent; `unresolved-ref` → fix the authoring; `unreachable` → widen the token;
   `mutual-deferral` → a human breaks the cycle; `stale-status` → date or refresh the
   `## Status` line.
6. The weekly audit cites the probe's **trend line** in its backlog domain — findings count,
   dispositions this cycle — and never transcribes the findings list into the audit doc.
   (Why: the regime prompt's §5 — an authored doc full of mechanical findings is one more
   artifact decaying between issues of itself.)

## 2. Verification

- `node scripts/check-stale-blockers.mjs` runs and prints its census line; with `gh` absent
  or unauthenticated it reports SKIPPED, never clean.
- The probe has its own Actions status surface (schedule + workflow_dispatch), appears on no
  PR check, and its rolling issue carries the `stale-blocker-probe` label.
- Every first-run finding carries a disposition, recorded wherever this repo dispositions
  audit findings.

## 3. What this is not

- Not the sub-issue-graph axis — epics fully delivered but open, declared-vs-linked
  hierarchy, milestone-table drift. That is `check-backlog-currency.mjs`, piloting in
  ai-fleet per the regime prompt and extracted to `templates/` only after its §8 gate passes
  (self-test, two probe cycles dispositioned, false-positive review, three human-merged
  groom passes).
- Not a gate. `--gate` promotion is a separate decision after the findings rate settles.
