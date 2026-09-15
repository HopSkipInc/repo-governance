# write-record 1.4.0: append-row for testing-strategy.md / code-conventions.md (2026-09-15)

**Applies to:** HopSkipInc/ai-fleet, HopSkipInc/analytics-infrastructure,
HopSkipInc/enrichment-pipeline — the three governed repos that already run
`write-record.mjs` and carry both `docs/testing-strategy.md` and
`docs/code-conventions.md`. HopSkipInc/infra-ops has neither (core class, ADR-only
records census) — nothing to do there.
**Ships with:** repo-governance issue #104 — `templates/scripts/write-record.mjs`
**1.4.0**, `templates/harness-enforcement.md` → **1.3.0**,
`templates/harness-enforcement.opencode.md` → **1.2.0**.
**Trigger:** analytics-infrastructure agents reported being "not allowed" to update
`docs/testing-strategy.md` for routine mechanical edits (append a coverage-map row,
bump the review log). That repo runs the path at hard `deny` with no scripted escape
hatch — `create`/`amend` only ever covered the two numbered corpora.

## Installed-version reality check (2026-09-15, read from each checkout)

Your repo took `write-record.mjs` at a different version depending on when it last
synced, and none are current — copy the file byte-identical regardless of which
delta paragraph below applies to you; you get everything since your last sync in
one step, not just `append-row`.

| Repo | Lint home | Installed today | Catches up on |
|---|---|---|---|
| ai-fleet | `host/scripts/` | 1.3.0 | just #104 (append-row) |
| analytics-infrastructure | `scripts/` | 1.1.0 | #91 (MADR dialect), #97 (section-matching hardening — read that prompt's install rule below before you skip straight to 1.4.0), #104 (append-row) |
| enrichment-pipeline | `tools/` | 1.2.0 | #97 (section-matching hardening), #104 (append-row) |

**If you are jumping from ≤1.2.0 (analytics-infrastructure, enrichment-pipeline):**
read `ai-fleet/2026-08-19-write-record-section-matching.md` section "0. Install
rule" first — 1.2.0's relaxed guard is a real hazard for a corpus with
variant-heading Decisions, and 1.3.0 (bundled in this sync) is what closes it. Run
`node <lint-home>/census-record-sections.mjs` against your ADR/PDR corpus after
installing and read its buckets before amending anything — do not assume your
corpus looks like ai-fleet's.

## What's new in 1.4.0 (on top of whatever you're catching up on)

A second mediated verb, `append-row`, alongside `create`/`amend`. It covers the two
singleton living-document records — `docs/testing-strategy.md`,
`docs/code-conventions.md` — which `create`/`amend` cannot reach (they only know
numbered corpora). It locates one named table by its **exact header-cell
fingerprint** (not by heading — testing-strategy §1 carries a fixed spec table
*and* a growing dated log under the same heading) and inserts exactly one row. The
caller supplies only the new row's cell values as a JSON array; the script performs
all the file surgery, so there is nothing for a guard to diff.

```
node <lint-home>/write-record.mjs append-row <testing-strategy|code-conventions> <table-key> <row-file.json>
```

Built-in table keys — testing-strategy: `coverage-floor-log`, `coverage-map`,
`deliberately-untested`, `test-levels`, `false-green`, `not-verified`,
`review-log`. code-conventions: `enforced-conventions`, `promotion-clock`,
`not-codified`, `enforcement-without-record`, `contradictions`, `review-log`.
`docs/agent-routing-records.md` is deliberately not covered — its calibration set
stays a by-hand edit, everywhere.

**Registering this is opt-in, unlike the corpus rows.** Nothing about your existing
`create`/`amend` registration changes, and nothing forces your harness mode to
move. Register the two new rows only if you want agents making these two files'
mechanical edits through the script instead of by hand (or instead of a flat
`deny` with nobody to ask).

## Steps

**1. Install the script byte-identical**, same lint home as your existing
`write-record.mjs`:

```
<lint-home>/write-record.mjs → 1.4.0 (byte-identical from repo-governance templates/)
```

**2. Bump the harness-enforcement stamps** the same way the 2026-08-13 prompt had
you do it — `.claude/settings.json`'s `_governance_install` value to
`harness-enforcement.md v1.3.0 · updated 2026-09-15`, `opencode.json`'s stamp
comment to `harness-enforcement.opencode.md v1.2.0 · updated 2026-09-15`. Change no
rules while you're in there — this bump is prose-only (the "Mediated write paths"
section grew a paragraph; the stanza JSON is unchanged).

**3. If you want append-row registered**, add to
`docs/enforcement-stanzas-register.md`'s `## Mediated write paths` table:

```markdown
| `docs/testing-strategy.md` | `<lint-home>/write-record.mjs` | `1.4.0` | Installed <date> per the append-row prompt (repo-governance #104) — append-row only; table keys: coverage-floor-log, coverage-map, deliberately-untested, test-levels, false-green, not-verified, review-log |
| `docs/code-conventions.md` | `<lint-home>/write-record.mjs` | `1.4.0` | Installed <date> per the append-row prompt (repo-governance #104) — append-row only; table keys: enforced-conventions, promotion-clock, not-codified, enforcement-without-record, contradictions, review-log |
```

Bump your existing corpus row(s)' version cell to `1.4.0` too — one script, one
version, three possible register rows.

**4. Tell the agents.** Add a sentence to your CLAUDE.md records paragraph:

> `docs/testing-strategy.md` and `docs/code-conventions.md` are singleton records —
> `create`/`amend` cannot reach them, so they go through `<lint-home>/write-record.mjs
> append-row` instead: one row into one named table, never a whole revised file.

## Specifically for analytics-infrastructure

This is the repo the gap was found in. Registering the two rows above is what
actually closes the reported problem — your harness mode for these two paths stays
at `deny` (no change needed or suggested; deny is what the whole design funnels
around, same as your existing ADR corpus). After this sync, an agent that needs to
append a coverage-map row or bump a review log runs the script instead of hitting
the flat refusal with no scripted alternative.

## Verification

```bash
# 1. assertion lint still green, now reporting the new row count if you registered
node <lint-home>/check-enforcement-stanzas.mjs

# 2. functional demo — SCRATCH repo, never the real corpus:
TMP=$(mktemp -d) && cd "$TMP" && git init -q
mkdir -p docs scripts && cp <repo-lint-home>/write-record.mjs scripts/
cp <your-repo>/docs/testing-strategy.md docs/testing-strategy.md   # a real copy, to get a real table
echo '["demo/module", "unit", "covered", "no", "—"]' > /tmp/row.json
node scripts/write-record.mjs append-row testing-strategy coverage-map /tmp/row.json
git diff --stat docs/testing-strategy.md   # expect: 1 insertion, 0 deletions
```

Then, in a live session, confirm the funnel both ways on one of the two files: a
direct Edit is still denied (or prompts, at `ask`), and `append-row` succeeds.

## Not done here, owed

- **`_client.md` status rows** for this prompt — add when applying, per repo (see
  the row template used by every other prompt in this ledger).
- **infra-ops** gets nothing from this prompt today. If it grows a testing-strategy
  or code-conventions record later, this prompt (or its successor) is the one to
  reach for.
