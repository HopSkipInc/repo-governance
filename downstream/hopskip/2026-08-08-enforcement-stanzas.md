# Governance update: harness enforcement stanzas + install-assertion lint (2026-08-08)

**Applies to:** all four governed repos — the stanza pair is the first template that
gates the *agent's own file tools*, so every repo running Claude Code or opencode gets
it, `core` and `full` class alike.
**Source:** repo-governance PRs #64 (stanza pair, issue #36), #65 (assertion lint,
issue #37), #66 (binding smoke check, issue #38) — closing the #33 pre-action
enforcement cluster from the 2026-08-02 recommendation
(`docs/pre-action-enforcement-recommendation.md`).

| Repo | Harness configs | Records paths (verified on disk 2026-08-08) | Records mode | Lint home | CI wiring |
|---|---|---|---|---|---|
| HopSkipInc/ai-fleet | **merge** into existing `.claude/settings.json` (has `hooks`, no `permissions` key) + create `opencode.json` | `docs/code-conventions.md`, `docs/testing-strategy.md`, `docs/agent-routing-records.md`, `docs/adr/` | **ask** — records maintenance is a daily paired activity there; the human is the checkpoint | `host/scripts/` (not `scripts/` — the lint cluster in `run-tests.yml` runs with `working-directory: host`) | `run-tests.yml` lint cluster, beside the `check-adr-readme-sync` step |
| HopSkipInc/analytics-infrastructure | create `.claude/settings.json` + `opencode.json` | same four | deny (default) | `scripts/` | `code-hygiene.yml`, `clutter` job (already runs `node scripts/lint-*.mjs` with setup-node) |
| HopSkipInc/enrichment-pipeline | **merge** into existing `.claude/settings.json` — it has a `permissions.deny` array with 13 live `Bash(...)` rules; **append the new rules, never replace the array** — + create `opencode.json` | `docs/code-conventions.md`, `docs/testing-strategy.md`, `docs/agent-routing-records.md`, **`adr/`** (ADRs live at repo root, not `docs/adr/`) | deny (default) | `tools/` (not `scripts/`) | `code-hygiene.yml`, `clutter` job (runs `node tools/lint-*.mjs`) |
| HopSkipInc/infra-ops | create `.claude/settings.json` + `opencode.json` | `docs/adr/` only — no code-conventions / testing-strategy / routing-records on disk | deny (default) | `scripts/` | `ci.yml`, `governance` job (already runs `node scripts/check-adr-readme-sync.mjs`) |

**Records mode** is per the stanza templates' Modes section: `deny` is the default;
`ask` is a per-repo downgrade recorded in that repo's
`docs/enforcement-stanzas-register.md`, for repos where records edits are a daily
paired activity. `ask` is a human checkpoint interactively and **auto-rejects headless
in both harnesses** (demonstrated 2026-08-08, Claude Code 2.1.226 / opencode 1.18.15)
— a fleet worker has nobody to ask. Secrets paths run at `deny` in every repo, always.

## What changed upstream

- **`harness-enforcement.md` + `harness-enforcement.opencode.md` v1.0.0** — paste-in
  permission-deny stanzas for records-file protection and secrets hygiene (path-level),
  enforced by the harness before the action lands, not by the model and not by
  instructions. The path register is installer-filled from the repo's own records
  census (PDR-004 — no shadow mirror).
- **`scripts/check-enforcement-stanzas.mjs` v1.0.0** — the install-assertion lint. A
  stanza cannot report its own absence; this is the out-of-band detection.
  Register-driven (`docs/enforcement-stanzas-register.md`), fails closed on a missing
  register, blocking UNREGISTERED when a CLAUDE.md-listed records file has no register
  entry, and catches the opencode catch-all-ordering mistake statically (NOT-BINDING).
- **Binding demonstrated before ship** — both harnesses, both directions, versions
  recorded (Claude Code 2.1.226, opencode 1.18.15); transcripts in PR #64. The
  recurring smoke check lives at `docs/harness-binding-smoke-check.md` and fires at
  `/review-sync` Step 5.0 on stanza version changes.

**Stanza and lint ship together, in one PR, per repo.** A stanza without the
assertion lint is exactly the unverifiable install this cluster exists to prevent.

## Steps

**1. Fill the register from the repo's own census — never from this prompt's table
alone.** The table above is the 2026-08-08 census, verified against live checkouts;
re-verify before installing (records corpora grow):

```bash
for f in docs/code-conventions.md docs/testing-strategy.md docs/agent-routing-records.md; do [ -f "$f" ] && echo "HAS $f"; done; ls -d docs/adr adr docs/pdr 2>/dev/null
```

**2. Install the Claude Code stanza** per `templates/harness-enforcement.md`, register
filled from step 1 (directories take the `/**` glob form: `docs/adr/` →
`Edit(docs/adr/**)`), records rules at the repo's **Records mode** from the table
(`deny` array, or `ask` array where the table says ask). Keep the
`governance-install` stamp comment.

- *ai-fleet:* the file exists with a `hooks` key and no `permissions` key — add
  `permissions` alongside, change nothing else.
- *enrichment-pipeline:* the file exists with `permissions.deny` holding 13 live
  `Bash(...)` rules. **Append** the `Edit(...)`/`Read(...)` rules to that array. This
  merge is exactly the clobber hazard the stanza exists to prevent — the installing PR
  must show the 13 Bash denies surviving in the diff. Verify:
  `python3 -c "import json; d=json.load(open('.claude/settings.json')); assert sum(1 for r in d['permissions']['deny'] if r.startswith('Bash(')) == 13"`.

**3. Install the opencode stanza** per `templates/harness-enforcement.opencode.md` —
`opencode.json`, `"*": "allow"` **first**, records rules at the repo's Records mode,
secrets rules always `"deny"` (last-match-wins; a rule listed before the catch-all
reads correctly and does not bind). Keep the stamp comment.

**4. Add the records paragraph to CLAUDE.md if absent** — the lint's completeness rule
reads it as the authoritative source. As of 2026-08-08 none of the four repos carries
one. House form (adjust the list to step 1's census):

```markdown
## Records files — never `cp` over these

`docs/code-conventions.md`, `docs/testing-strategy.md`,
`docs/agent-routing-records.md`, and everything in `docs/adr/` are **records**. The
blank forms live in `templates/` (or upstream in repo-governance); the contents are
local, dated, and exist nowhere else. A `cp` from a template destroys work with no diff
to recover from.
```

**5. Install the lint + register.** Copy
`templates/scripts/check-enforcement-stanzas.mjs` byte-identical to the repo's lint
home (table above), and create `docs/enforcement-stanzas-register.md` naming both
harnesses and step 1's records paths — **with the repo's records mode and its reason
recorded** (the register's Mode paragraph; see repo-governance's own register for the
shape). The lint accepts `ask` or `deny` for records rules and requires `deny` for
secrets, so a repo running `ask` passes only when the register says so. If the repo's
CLAUDE.md paragraph mentions a non-records path (a contrast clause like "forms live in
`templates/`"), carry it in `## Paragraph exemptions` with a reason — a reasonless row
fails closed.

**6. Wire the lint into CI** at the row in the table. Run it locally first:
`node <lint-home>/check-enforcement-stanzas.mjs` must print OK before the PR opens.

**7. Synced-templates table** — add rows for `harness-enforcement.md` v1.0.0,
`harness-enforcement.opencode.md` v1.0.0, and `scripts/check-enforcement-stanzas.mjs`
v1.0.0 (per repo; adjust the lint path for the `tools/`/`host/scripts/` homes — the
drift check reads what the table declares).

## Explicitly out of scope

- **Binding demonstration in the client repo.** The v1.0.0 binding was demonstrated
  upstream before ship (PR #64, both harnesses, both directions). Client runs recur on
  the `/review-sync` Step 5.0 trigger — a *version change* in the stanza or a harness
  upgrade — not on every install.
- **Per-agent opencode permission blocks.** The stanza is the global config; per-agent
  `permission:` frontmatter merges over it and can reopen what it denies. Audit those
  when an agent definition changes, not here.
- **The pending graphify and routing re-sync prompts** — independent; they may ride
  the same session, applied as their own changes. Note for enrichment-pipeline: apply
  the re-sync prompt's governance-section re-install **before** this one (both touch
  CLAUDE.md).

## Verifiable outcomes

Run from the repo root. Each line is an independent check.

- `node <lint-home>/check-enforcement-stanzas.mjs` — the lint green against the repo's
  own install (expect `OK: every registered harness carries a stamped, complete,
  correctly-ordered enforcement stanza.`). This is the check that matters: it observes
  the *effect* (stamped, complete, binding-order config) rather than grepping the files
  the installer just wrote.
- `grep -c "governance-install: harness-enforcement" .claude/settings.json opencode.json`
  — both stanzas stamped (expect 1 per file)
- enrichment-pipeline only: the Bash-deny survival assertion from step 2 (expect no
  output, exit 0)
- CI green on the installing PR with the new step visible in the named job's log

**Estate-level** (run from `~/repos/HopSkipInc/repo-governance` after the PRs merge):

```bash
node scripts/check-downstream-drift.mjs
```

Zero BEHIND rows naming `harness-enforcement` or `check-enforcement-stanzas`.

## Record the install

Append to the repo's applied-governance list in CLAUDE.md:
`[2026-08-08-enforcement-stanzas.md] — applied <date>`.
