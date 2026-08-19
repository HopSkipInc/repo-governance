# write-record 1.3.0: install the section-matching fix, then triage the ADR corpus (2026-08-19)

**Applies to:** HopSkipInc/ai-fleet (the reporting repo). Other governed repos take the
same two scripts on their next sync and re-run the census; the remediation tree at the
bottom is written for ai-fleet's numbers.
**Ships with:** repo-governance issue #97 — `templates/scripts/write-record.mjs` **1.3.0**
and the new report-only `templates/scripts/census-record-sections.mjs` 1.0.0.
**Source report:** the 2026-08-19 defect prompt authored in this repo while amending
ADR-031 (PR #2017). Owner decisions Q1–Q5 are baked in below.

## 0. Install rule — read before syncing anything

**Do not install write-record 1.2.0 in this repo. Go straight to 1.3.0.** 1.2.0's
`missingOk` relaxation (pre-existing section absence is warn-only on amend) is correct
for MADR-dialect corpora and dangerous here: 24 of this repo's ADRs carry their Decisions
only under variant headings (`## Decision 1: …`, `## Decision: …`), which ≤1.3.0's guard
could not see — under 1.2.0 those amends would pass with the protected-section guard
comparing `null === null`, i.e. **Decisions rewritable in place with the gate green**.
1.3.0 normalizes headings AND hardens the guard in one change precisely because shipping
them separately converts a false-refusal into a silent-acceptance.

## 1. What 1.3.0 changes

- **Heading normalization.** `## Decision 1: <summary>`, `## Decisions`,
  `## Decision: <summary>`, `## Decision (PROPOSED — …)`,
  `## Enforcement (ships with the decision, per ADR-022)`, `## Consequences (PROPOSED)`
  all resolve to their canonical sections. `## Contextual notes`, `## Decision Log`, and
  `## Amendment (…)` deliberately do not. When normalization satisfies a required
  section, the script says which heading did it.
- **Guard hardening.** All sections normalizing to a protected name are compared in
  document order (deleting `## Decision 3` or renumbering 2→3 is a refusal); a record
  with no protected-normalizing section is an explicit refusal, never a pass.
- **`YYYY-MM-DD` scoped.** Checked as the `**Date:**` placeholder and the PDR falsifier
  date, not a whole-body substring — ADR-009's cron key spec is legitimate prose.
- **Superseded exemption (Q2).** Records with Status `Superseded …` no longer require
  `## Enforcement`.
- **`.write-record.json` (Q3).** Optional per-corpus config: `required` / `protected`
  section lists per kind, and a `grandfather` record-number cutoff below which amend
  treats missing/empty required sections as warnings. This repo does not need it yet —
  the census below is what would justify it.
- **`check` mode (Q4).** `node host/scripts/write-record.mjs check adr <draft>` validates
  and prints the resolved section map, writing nothing.

**Q1 ruling:** `## Decision Log` does not normalize. This corpus does not use it; if the
census's variant inventory ever shows it, that is a conversation, not a regex patch.
**Q5 finding:** nothing in the upstream `templates/` blank forms or examples uses a
suffixed heading — the `## Enforcement (ships with the decision, per ADR-022)` form is
THIS repo's house style, and 1.3.0 accepts it as-is. Do not "fix" the headings.

## 2. Install

```
host/scripts/write-record.mjs            → 1.3.0 (byte-identical from repo-governance templates/)
scripts/census-record-sections.mjs       → 1.0.0 (new; report-only)
```

Register row: `host/scripts/write-record.mjs | 1.3.0 | <date> (byte-identical; section
matching normalized, protected-section guard hardened — repo-governance #97)` and an
`## Applied governance updates` entry.

## 3. Verify (in order, before touching any record)

```bash
# 1. census — the buckets below should reproduce
node scripts/census-record-sections.mjs

# 2. round-trip a bucket-A record — no content change, expect OK
cp docs/adr/060-*.md /tmp/roundtrip.md
node host/scripts/write-record.mjs amend adr 060 /tmp/roundtrip.md   # expect OK, git status clean after

# 3. tamper probe — the test whose absence let this defect ship
#    alter one line inside a `## Decision N:` section of a bucket-A record, then:
node host/scripts/write-record.mjs amend adr 060 /tmp/tampered.md
#    expect: REFUSED naming "## Decision changed" — NOT "missing required section"

# 4. dry-run a draft to see the section map
node host/scripts/write-record.mjs check adr /tmp/roundtrip.md
```

## 4. This repo's census (script-generated 2026-08-19, normalization applied)

| Bucket | Count | Records |
|---|---|---|
| C — amendable under any version | 3 | 037, 066, 068 |
| A — unblocked by 1.3.0 alone, **zero record edits** | 5 | 016, 017, 060, 063, 067 |
| B — genuinely missing content | 58 | 55 missing `## Enforcement`; 3 missing `## Enforcement` + `## Consequences` (023, 047, 053) |

P0 (exact protected heading + variant siblings — guard vacuous under ≤1.2.0): **0**.
Scaffold-marker collisions in prose: **3** — ADR-009 (lines 58, 61), ADR-022, ADR-034
(all `YYYY-MM-DD` as format specifiers; legitimate, unblocked by 1.3.0's scoped check).
Status parse failures (not amendable under ANY version): **2** — ADR-037 (a 1,200-char
paragraph as Status), ADR-053 (`**Split — read the per-section status**`). Both need a
human to pick a real status value; that is a records edit through the stanza's ask path,
not a script fix.

Deltas from the original hand census, stated so they do not confuse: the hand census ran
against 1.0.0's exact matcher and a working tree mid-amend. The script census says
ADR-031 carries **no** Enforcement heading on master (bucket B, not C), and 016/017 move
to bucket A via the Superseded exemption (Q2). Trust the script — generating triage
numbers without normalization applied is how the earlier "24 ADRs missing ## Decision"
misreading happened (zero were).

## 5. Remediation tree

**Bucket A (5 records) — do nothing.** 1.3.0 makes them amendable. Never rewrite a
record's headings to satisfy a matcher; the `## Decision 1/2/3` structure carries real
information (ADR-001's three storage decisions, ADR-044's six).

**Bucket B (58 records) — content authorship, not a formatting sweep, and not
agent-unilateral:**

- Every Enforcement entry cites a guard that **actually exists** — a named lint wired
  into the check chain, a named test, or an explicitly-labelled review-only position.
  Verify each against `host/package.json`'s check chain. An Enforcement table naming a
  lint that does not exist is worse than no table.
- **"Enforcement: PR review" as a bulk answer is prohibited.** The backfill's value IS
  discovering which decisions are actually unenforced.
- **Batch by theme** (credentials, fleet, cost, inference, …), ≤10 records per PR, one
  reviewer pass each — the repo's own routing rules stop agents at 15-file diffs.
- **Proposed records (13):** their Enforcement section is a promise; the promise names
  its tracking issue.
- Amends go through `host/scripts/write-record.mjs amend` — the 1.3.0 script is the
  sanctioned path; raw edits to records paths stay denied.

**ADR-031 note:** the source report said it was merged with a bare `## Enforcement`
hand-fit; master carries no Enforcement section. Whether PR #2017 dropped it or a later
amend did, it is bucket B today — include it in the vendor/SDK theme batch.

## 6. Then

Re-run the census after each backfill batch; bucket B drains to zero over cycles, not in
one PR. When it does, this repo's corpus is fully inside the gate the stanza promised.
