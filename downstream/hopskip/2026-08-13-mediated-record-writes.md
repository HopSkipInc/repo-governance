# Governance update: mediated write path for decision records — agents author ADRs/PDRs again (2026-08-13)

**Applies to:** all four governed repos — any repo that installed, or is about to install,
the harness-enforcement stanzas from [2026-08-08](2026-08-08-enforcement-stanzas.md).
**Source:** repo-governance issue #81, PR per the hub's own install (same day).
**Sequencing:** if your repo has not yet applied 2026-08-08 (stanza pair) and
[2026-08-11](2026-08-11-harness-stamp-strict-json.md) (stamp form), apply them **first** —
this prompt assumes a binding stanza. The whole design is a funnel: the deny rules are
what makes agents use the script.

## The problem this solves

The stanza gates paths, not intent. It cannot tell "agent creates ADR-063" from "agent
`cp`s a blank form over ADR-022", so every records write became human hands (`deny`), a
human keystroke per file (`ask`), or impossible — headless and fleet runs auto-reject
`ask`, so a fleet worker could not author an ADR at all. "Human writes the ADR" had become
part of the normal process. That is too disruptive, and it prices a *creation* risk (bad
prose, caught by PR review) at a *clobber* risk (destroying dated records, the two
observed incidents the stanza exists for).

## What changed upstream

- **`templates/scripts/write-record.mjs` v1.0.0 — new.** The mediated write path: a
  validating, append-only writer run via Bash, which the stanza documentedly does not
  bind. That blind spot is the designed gate, and it is the *only* sanctioned subprocess
  write into records paths — every other scripted write remains the violation it was.
  Three verbs:
  - `create <adr|pdr> <draft-file>` — allocates the next free number (max of files and
    README links, +1 — gaps are never reclaimed), validates per kind (required sections;
    ADR `Accepted` refuses "not yet built" enforcement; PDR `Accepted` refuses a missing
    or vague falsifier, mirroring `check-pdr-falsifiers` R1/R2; PDR requires a real
    `Confirmed by`; ADR requires the `**Lens:**` line where design-lenses runs), writes
    **append-only** (there is no overwrite code path), registers the README row, and runs
    the corpus's own lints post-write.
  - `amend <adr|pdr> <NNN> <revised-file>` — full-file replace under a section guard:
    `## Context` and `## Decision` byte-identical or it refuses ("never edit a Decision
    in place", made mechanical). The README row's derived cells (Status; Last confirmed
    for PDR) sync automatically.
  - `amend <adr|pdr> readme <revised-file>` — the inventory row path: prose outside the
    table byte-identical, header immutable, **no row deletions** (never-pruned, made
    mechanical), every row's link target on disk. This is how the 90-day `Last confirmed`
    sweep and status flips stop being human typing.
- **`templates/harness-enforcement.md` v1.1.0 → v1.2.0** and
  **`templates/harness-enforcement.opencode.md` v1.0.1 → v1.1.0** — new "Mediated write
  paths" section; the Limits blind-spot bullet now reclassifies this one subprocess path
  as sanctioned. The stanza JSON itself is unchanged — this is a stamp bump plus the
  script install.
- **`scripts/check-enforcement-stanzas.mjs` v1.1.0 → v1.2.0** — the register gains an
  optional `## Mediated write paths` section; each row asserts the named script exists
  and stamps the declared version (`MEDIATED-MISSING` / `MEDIATED-MISMATCH`), a row naming
  an unregistered path fails closed, and a mediated row's script satisfies the
  register-completeness rule (your CLAUDE.md may name the write path without a fake
  exemption).
- **`adr-interview` / `pdr-interview` v1.1.0** — Step 3 publishes through the script;
  Step 4 no longer `cp`s records into the corpus.
- **`agent-routing.md` v1.13.0** — `gate:decision` now says what was always meant: an
  agent drafts the record; a person owns it at merge.

## Steps

**1. Install the script.** Copy `templates/scripts/write-record.mjs` **byte-identical**
into your repo's lint home (the same directory as your `check-adr-readme-sync.mjs`):

| Repo | Lint home | Corpora to register |
|---|---|---|
| HopSkipInc/ai-fleet | `host/scripts/` | `docs/adr/`, `docs/pdr/` |
| HopSkipInc/analytics-infrastructure | `scripts/` | `docs/adr/` |
| HopSkipInc/enrichment-pipeline | `tools/` | `adr/` (root), `docs/pdr/` |
| HopSkipInc/infra-ops | `scripts/` | `docs/adr/` (records census: ADRs only) |

The script discovers the corpus itself (`docs/adr/`, `adr/`, `adrs/`, `decisions/` for
ADRs; `docs/pdr/`, `pdr/` for PDRs) — the table is a census check, not a configuration.
If it discovers a different directory than you expect, that is drift worth a finding, not
a flag to silence.

**2. Register the mediated paths.** Add to `docs/enforcement-stanzas-register.md`, one row
per corpus that exists in your repo:

```markdown
## Mediated write paths

| path | script | version | note |
|---|---|---|---|
| `docs/adr/` | `<lint-home>/write-record.mjs` | `1.0.0` | Installed 2026-08-13 per the mediated-record-writes prompt |
```

The script cell is the repo-relative path **exactly** as your CLAUDE.md line (step 3)
names it — the completeness rule string-matches the two.

**3. Tell the agents.** Add to your CLAUDE.md records-files paragraph (the one the stanza
was filled from):

> Records are written via `<lint-home>/write-record.mjs` — `create` publishes a new
> numbered record append-only, `amend` lands status flips, consequences, and README rows
> under section guards. The harness stanza keeps denying raw edits to records paths; the
> human checkpoint is the PR merge.

**4. Bump the stamps.** The stanza configs' declared versions move with the templates —
`.claude/settings.json`'s `_governance_install` value to `harness-enforcement.md v1.2.0 ·
updated 2026-08-13`, `opencode.json`'s stamp comment to `harness-enforcement.opencode.md
v1.1.0 · updated 2026-08-13`. Change no rules while you are in there. Also re-sync
`check-enforcement-stanzas.mjs` v1.2.0 into your lint home (byte-identical — the two
copies must never disagree) and bump the Synced-templates rows for all four artifacts.

## Verification

```bash
# 1. The assertion lint now covers the mediated rows — expect OK, "N mediated write path(s)"
node <lint-home>/check-enforcement-stanzas.mjs

# 2. The script runs and prints usage
node <lint-home>/write-record.mjs   # expect usage text, exit 1

# 3. Functional demo — in a SCRATCH repo, never against the real corpus:
TMP=$(mktemp -d) && cd "$TMP" && git init -q
mkdir -p scripts && cp <repo-lint-home>/write-record.mjs scripts/
cat > /tmp/draft.md <<'EOF'
# ADR-NNN: Smoke test decision

**Status:** Proposed
**Date:** YYYY-MM-DD

## Context

Scratch-repo verification of the mediated write path.

## Decision

No production corpus is touched by a verification run.

## Enforcement

not yet built — verification artifact

## Consequences

None; the scratch repo is deleted.
EOF
node scripts/write-record.mjs create adr /tmp/draft.md   # expect: created docs/adr/001-..., README row, UNGUARDED note
node scripts/write-record.mjs amend adr 001 /tmp/draft.md  # expect REFUSED (the H1 number changed) — a loud refusal is the guard working
```

Then, in a live session of each harness your repo runs, confirm the funnel both ways: a
direct Edit to a records path is still denied (or prompts, at `ask`), and the script path
succeeds. The full both-directions procedure is `docs/harness-binding-smoke-check.md`
step 7 — it fires at `/review-sync` Step 5.0 on this stanza version change, and it now
includes a desktop-session spot-check, because whether desktop sessions load the stanza
identically to the CLI is an assumption until observed.

## Not done here, owed

- **`_client.md` status rows.** This prompt is unregistered in
  `downstream/hopskip/_client.md`, which had uncommitted changes from the Doorbell pilot
  lane when it was authored — deliberately left untouched rather than merged blind (same
  call as 2026-08-11). Add the rows for this prompt in the same pass that lands those.
- **Fleet authoring, end to end.** The script unblocks fleet workers structurally; the
  first fleet run that authors an ADR through it is the real proof. Watch for it in the
  next fleet retro — a worker that hits the deny and does NOT reach for the script means
  the funnel failed to announce itself, which is a CLAUDE.md problem, not a script
  problem.
