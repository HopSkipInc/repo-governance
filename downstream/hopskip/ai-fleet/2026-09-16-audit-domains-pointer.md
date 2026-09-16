# Audit Domains — single definition, machine goals point at it — ai-fleet

**Client:** Hopskip (internal)
**Source:** greg/repo-governance session 2026-09-16 (PR #108 — `templates/audit-domains.md` v1.0.0)
**Scope:** Install `docs/audit-domains.md`; replace the inline domain block in each of the three audit machines' stored goals with a pointer to it.

> **THIS STEP CARRIES MIGRATIONS.** Three of them, one per audit machine, against
> `state_machines` rows in the fleet host database. It is not a file copy with a doc
> change. Read the "Before you write anything" section first — the current goal text is
> the input to the migration and you cannot write the guard without reading it.

---

## Context

The staleness audit in this repo is a **cron state machine dispatching a fleet worker**,
not a GitHub Actions workflow. `.github/workflows/scheduled-audit.yml` is not installed
here and should not be; the YAML workflow is the governance fallback for estates with no
fleet workers. `audit-deadman.yml` stays exactly as it is — it watches for the artifact
the fleet produces and is unaffected by everything below.

The domain list each audit runs currently lives **inline in that machine's goal text**, a
row in Postgres, amended over time by migrations that `jsonb_set` + `replace` into the
stored definition under guards on the current wording.

That has produced a divergence nobody is positioned to see:

- `0258_audit_machines_code_hygiene_domain.sql` added a code-hygiene domain to several
  machines.
- `0375_audit_enrichment_pipeline_quality_coverage_domain.sql` added the
  quality-and-coverage domain to `audit-enrichment-pipeline` **only**.

**The three audit machines are running different domain sets right now.** Each individual
migration is careful — the wording guards make a drifted goal fail loudly instead of
half-applying — but a guard protects one machine's edit. Nothing compares machines. And a
domain list inside a database row is invisible to every check that reads files: no version
stamp, no drift check, no diff. The domain set a given audit ran cannot be recovered from
the repository.

Upstream now ships one definition — `templates/audit-domains.md` v1.0.0 — carrying domains
1–8 verbatim from the workflow template plus a new domain 9 (configuration and secrets).
This prompt installs it here and converts the machines to read it.

**After this lands, adding a domain is an edit to one markdown file and a version bump.**
No migration, no DB write, and no way for the machines to diverge again, because there is
one copy.

---

## Before you write anything

You cannot author these migrations from this prompt alone. The guard text must match what
is actually stored, and this prompt's author could not read your database.

1. **Read the current goal of each of the three machines** — `audit-fleet`,
   `audit-data-platform`, `audit-enrichment-pipeline` — from `state_machines`. Use the
   same read path the recent audit migrations use.
2. **Identify the exact inline domain block in each**, including its surrounding text, so
   the `replace()` has an unambiguous anchor. Follow the pattern in
   `0389_audit_fleet_monday_cadence.sql`: guard on the current shape so wording drift
   fails loud via the integrity check rather than silently matching nothing.
3. **Record, per machine, which domains it currently runs.** This is the input to the
   convergence note below, and it is the only moment the pre-migration state is
   recoverable.
4. **Harvest any repo paths the inline domains reference that `audit-domains.md` does not.**
   At least one is known: `0291_audit_fleet_watch_sweep.sql` points the watch sweep at
   `docs/competitive-intel/*.md`, while the upstream domain 5 globs `docs/watch-items/`.
   Decide per path whether to migrate the directory, or to carry the legacy path into the
   installed `docs/audit-domains.md` as a local amendment. **Do not drop it silently** —
   a sweep pointed at a directory nobody creates matches nothing and reports nothing,
   which reads exactly like a clean run.

---

## What to do

### 1. Install the domain definitions

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/audit-domains.md docs/audit-domains.md
git add docs/audit-domains.md
```

Keep the version stamp on line 1 intact — it is what lets a future sync detect drift, and
what each audit report will quote.

If step 4 above found local paths to carry, amend them into the installed copy **and note
the amendment in the sync log row**, so the next sync knows this copy is not byte-identical
to upstream and why.

### 2. One migration per machine

Three migrations, or one migration handling three machines — match whatever the repo's
current numbering discipline prefers, and follow
`docs/db-migration-governance.md` on naming under concurrency.

Each replaces the inline domain block in the stored goal with a pointer. The pointer text:

> Read `docs/audit-domains.md` from the checked-out repository. It defines every domain to
> check, the severity scale, the P2 aging rule, and the finding-ID convention. Run every
> domain it lists. Quote the file's version stamp (line 1) at the top of the audit
> document. If the file is absent, stop and report that — do not substitute your own
> domain list.

Everything else in each goal stays: Step 0 idempotency pre-flight, the required-artifact
contract, the pinned output format, the PR and Slack steps, the two-phase lifecycle. **This
migration changes what the worker checks, and nothing about how it runs or reports.**

Each migration's header comment must state, for its machine:

- which domains it ran before, and which it will run after;
- that the change is a convergence, and therefore a **behaviour change on the first run**;
- the guard it depends on, and what a drifted goal will look like when it fails.

### 3. State the convergence in the migration notes, not in the resulting PR

At least one machine gains domains it was not running. The first audit after this lands
will surface findings in those domains, and they will look like a sudden regression in a
repo that has not changed. Say so in the migration header and in the PR body, so the next
audit's reviewer reads the spike correctly.

### 4. Update the DoD audit section

`docs/definition-of-done.md`'s `## Audit` section describes the domains the machine runs.
Replace the enumeration with a reference to `docs/audit-domains.md`, keeping the
repo-specific framing (state machine, cron cadence, migrations) exactly as it is. Two
copies of a domain list is the problem this whole change exists to remove; do not leave
one behind in the DoD.

While there: upstream `definition-of-done.md` is now v1.6.0, which adds a sixth staleness
trigger (configuration) alongside the five layers. Sync it if this repo's copy is
version-tracked, or port the row if it is locally amended.

### 5. Domain 9 needs its records file to be useful

Domain 9 audits the configuration surface against
`docs/configuration-governance-records.md` and reports **SKIPPED** when that file does not
exist — which it will, here, until the configuration-governance set lands (upstream PR
#107 ships the policy; the records form, interview, and lint follow). SKIPPED is the
correct and intended behaviour: the domain reports that it could not run rather than
reporting clean. Do not stub the records file to make the domain quiet.

---

## Verification

**Do not verify by grepping the file you just copied.** That confirms a `cp` ran and
nothing else. The claim being made is that the audit reads it, so observe the audit.

1. **The stored goal contains the pointer and no inline domain block.** Re-read each of
   the three machine definitions after the migration. This is the migration's own
   post-condition, not the end of verification.
2. **A dispatched audit actually reads the file.** Trigger one machine manually and
   confirm the resulting audit document quotes the `docs/audit-domains.md` version stamp
   as instructed. A report with no stamp means the worker did not read the file, whatever
   the goal says.
3. **The audit reports the full domain set**, including the domains its machine was not
   previously running, and including domain 9 as SKIPPED with its reason.
4. **The absence case fails loudly.** On a scratch branch with `docs/audit-domains.md`
   removed, a dispatched audit must stop and report the missing file. If it instead
   produces a normal-looking report, the pointer is being treated as advisory and the
   whole mechanism is decorative — that outcome is the finding, and it comes back upstream.
5. `audit-deadman.yml` still passes on its existing cadence — the artifact contract is
   unchanged.

---

## Report back upstream

- Per machine: domains before, domains after, and the migration number.
- Any local amendment made to the installed `docs/audit-domains.md`, with the reason.
- The disposition of the `docs/competitive-intel/` vs `docs/watch-items/` path, since the
  upstream matrix already flags that split as a PARTIAL and the resolution here is
  evidence for whether the template should carry both.
- Whether verification step 4 behaved as specified. If it did not, the pointer contract
  needs enforcement upstream rather than instruction.
