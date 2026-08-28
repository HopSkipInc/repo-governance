# Migration numbering catchup: generator port + ADR-008 Decision revision (2026-08-28)

**Applies to:** HopSkipInc/ai-fleet.
**Follows:** `2026-08-28-migration-numbering-concurrency.md` (applied: PRs
HopSkipInc/ai-fleet#2341, HopSkipInc/ai-fleet#2342), which deliberately left two
threads open. This prompt closes them. **Renames nothing.**

## 1. Port the fixed `generate-migration`

`db/dbmigrations/GenerateMigrationCommand.cs` still scaffolds `yyyyMMddHHmmss-slug.sql` —
a name that fails this repo's own `lint:adr008` (check 4b requires `NNNN_ISSUE_` on new
files), which is why the command the template mandates is used nowhere. The corrected
reference implementation landed in enrichment-pipeline PR
HopSkipInc/enrichment-pipeline#507 (`dbmigrations/GenerateMigrationCommand.cs`,
`ArgumentParser.cs`, `DbConfig.cs`). Port it with the flat-prefix adaptation:

- Emit `NNNN_ISSUE_description.sql` (this repo's convention — no date prefix).
  `NNNN` = `max(existing NNNN) + 1` over `db/dbmigrations/scripts/migrations/`,
  a convenience label, not a contract; `ISSUE` comes from a **required** `--issue`/`-i`
  argument (digits only — refuse with a message naming the governance rule when absent).
- Slugify to **underscores**, lowercase (the old dash slug fails no lint here but matches
  no migration name in the corpus).
- Check this repo's `ScriptFolder` default for the defect found downstream: a
  Windows-style `scripts\migrations` default is a *literal directory name* on Linux —
  normalize to forward slashes wherever the default is set (`DbConfig.cs` /
  `ArgumentParser.cs`); .NET accepts `/` on Windows too.
- `dbmigrations/README.md` (or wherever the CLI is documented): update the
  `generate-migration` row, examples, and any "timestamped" description to the real
  convention. Check `docs/` and the ADR set for stale references to the old emission
  while there.

**Verification — observe the effect:** run the generator with `--issue` and confirm the
file lands in `db/dbmigrations/scripts/migrations/` named `^\d{4}_\d+_[a-z0-9_]+\.sql`;
run `node host/scripts/check-adr008-migrations.mjs` and confirm the generated file
**passes the lint** (that is the point of the port — the mandated command must emit names
the repo's own gate accepts); run it again without `--issue` and confirm refusal with a
non-zero exit; delete all probe files.

## 2. Revise ADR-008 Rule 4's Decision text — via a new ADR, not in place

ADR-008 is Accepted; its `## Decision` is guard-locked byte-identical under
`write-record.mjs` (all versions), and the 2026-08-28 Consequences note says explicitly
that the Decision revision is a human-decided follow-up. The house pattern for changing
*part* of an Accepted ADR without rewriting it is a new ADR amending by reference
(precedent: analytics-infrastructure ADR-023 amends ADR-018 Decision 6):

```bash
node host/scripts/write-record.mjs create adr <draft-file>
```

Draft a short ADR — suggested title "Migration numbering is a label; uniqueness is the
issue token" — whose Decision amends ADR-008 Rule 4 by reference: the `NNNN` ordinal is a
human label, not a unique key; uniqueness comes from the author-local issue token;
`next = max(existing) + 1` is a convenience, not a contract; duplicate ordinals under
different issues are legal. Status **Accepted** is legitimate at creation: the
enforcement already shipped (the `lint:adr008` pair-keying + token check on master since
#2342) — per this repo's own rule, an ADR reaches Accepted only with enforcement wired
and passing, and here it already is. Do not claim the ordering property (filename order
vs prod apply order is unverified — that is a journal-vs-filesystem check and its own
issue, if wanted).

Then, through the same mediated path, append one Consequences line to ADR-008 pointing at
the new record (`amend adr 008 <revised-file>` — Consequences is not guard-protected;
Context/Decision stay byte-identical) so a reader of ADR-008 sees the amendment at the
point of decision.

**Verification:** the create registers the README row and the corpus lints pass
(`check-adr-readme-sync` runs as the post-write gate); the amend lands with the guard
printing Context/Decision byte-identical; `npm run check` green.

## 3. Record

Append to `### Applied governance updates` in `CLAUDE.md` with the PR number and the new
ADR number. If the port's source (enrichment-pipeline#507's implementation) does not match
this repo's dbmigrations project shape, stop and report rather than adapting silently.
