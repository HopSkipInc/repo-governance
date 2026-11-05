# Agent instructions: one canonical AGENTS.md, logs out of the always-loaded file, and a size gate — ai-fleet (2026-11-05)

**Client:** Hopskip (internal)
**Source:** repo-governance — issue #130, templates `governance-sync-claude-section.md` **2.0.0** ·
`closing-contract.md` **1.1.0** · `scripts/lib/instructions.mjs` **1.0.0** ·
`scripts/check-enforcement-stanzas.mjs` **1.3.0** ·
`scripts/check-instructions-budget.mjs` **1.0.0**.
**Scope:** make `AGENTS.md` the one instruction file and `CLAUDE.md` its one-line import; move the
three governance-sync logs to `docs/governance-sync-state.md`; install the import-following reader
and the budget gate.

> **This prompt's gate cannot go in green until Part A of HopSkipInc/ai-fleet#4550 has landed.**
> At `origin/master` `b63ab941` the resolved text is **98,948 bytes** (`CLAUDE.md` 94,737 +
> `AGENTS.md` 4,210), 3.1× the 32,000-byte budget. Part A is the non-governance trim.
> Do steps 1–6 now; do **step 7 (the gate) only after** `node scripts/check-instructions-budget.mjs`
> reports ≤32,000 bytes. Do not lower the budget to pass, and do not gate on a SKIPPED.

> **Not in scope:** trimming the prose itself. That is Part A of #4550 (ai-fleet's own work).
> This prompt supplies the measurement and stops the file regrowing after the trim.

---

## Why

`CLAUDE.md` is re-sent on every request of every session. Its `## Governance` section carries an
applied-updates log (35,867 bytes on 2026-11-05) and a synced-templates table (10,592 bytes) —
49% of the file — that no agent needs to do a task. ai-fleet#2863 found this in September and
closed on the local trim; nothing upstream moved the logs out, and the file grew 2.45× in 48 days.

Separately, OpenCode v2 loads `AGENTS.md` and no longer falls back to `CLAUDE.md`. Today
`AGENTS.md` is a 4,210-byte pointer that says "read CLAUDE.md first"; an OpenCode session starts
with the pointer and pays ~24k tokens if the model goes and reads the rest. A one-line
`@AGENTS.md` `CLAUDE.md` gives both harnesses the same canonical text from one file.

## Before you write anything

1. Read `templates/governance-sync-claude-section.md` v2.0.0 in repo-governance. The section it
   installs no longer contains the logs; the skeleton for the state doc is in the same template.
2. **The install targets are live in this checkout** (verified 2026-11-05 against `origin/master`):
   - `AGENTS.md`, `CLAUDE.md` — exist.
   - `host/scripts/check-enforcement-stanzas.mjs` — exists, declared at v1.2.0 in the Synced table.
   - `host/scripts/check-root-clutter.mjs` — exists and is a **local variant**, already configured
     with this repo's root entries (including `AGENTS.md`). Do not replace it with the template.
   - `scripts/` and `host/scripts/` — both exist; root `scripts/` carries the governance lints that are not host-scoped (e.g. `check-issue-routing.mjs`).
   - `.github/workflows/run-tests.yml` — exists; the `host-test` job holds the governance lints (`working-directory: host`).
   - `.github/workflows/fleet-harness-probe.yml` — exists; the canary step is the one that appends to `CLAUDE.md` today.
   - `docs/enforcement-stanzas-register.md` — exists (the stanza lint reads it).
   - `docs/governance-sync-state.md` — **does not exist yet**; create it in step 2.
3. `AGENTS.md` currently holds a pointer plus five rules. Every one of them is already in
   `CLAUDE.md`: `Work in a worktree` (CLAUDE.md:64), `Fleet dispatch runs in prod only`
   (CLAUDE.md:117), `## System map` (CLAUDE.md:88), `## Closing contract` (CLAUDE.md:123),
   `## Reviewing a pull request` (CLAUDE.md:309). So step 1 replaces the pointer; it does not
   need to merge two texts.

## What to do

### 1. Flip to one canonical AGENTS.md

- Replace `AGENTS.md` with the full content of `CLAUDE.md` (the pointer text is redundant — the
  five rules it carries are already in that content; verify with the headings above before
  deleting it).
- Replace `CLAUDE.md` with exactly one line: `@AGENTS.md`.
- Do not leave a second copy of any section in `CLAUDE.md`. There is now one `## Closing contract`,
  in `AGENTS.md`.

### 2. Move the three governance-sync logs out

In `AGENTS.md`'s `## Governance` section:

- Remove `### Applied governance updates`, `### Layer refresh log`, and `### Synced templates`,
  including their explanatory paragraphs.
- Replace the step-5 instruction with "record it in `docs/governance-sync-state.md` under
  `## Applied governance updates`", and the layer-refresh step with "update `## Layer refresh log`
  in that doc". Point the Synced-templates paragraph at the doc.
- Keep the section's instructions and the inline stamp. Update the stamp to
  `governance-sync-claude-section.md v2.0.0 · updated 2026-11-05`.
- Create `docs/governance-sync-state.md` from the template's **State doc** skeleton, with `##`
  headings (`## Applied governance updates`, `## Layer refresh log`, `## Synced templates`).
  Move the existing log entries and table rows into it unchanged. It is a plain doc: **not** a
  records file, no harness-stanza deny, no `write-record.mjs` verb, no register entry.
- Update `closing-contract.md`'s installed stamp to v1.1.0. It is already in the content that
  becomes `AGENTS.md`; check it appears once, not twice (today it is in both files).
- In the moved Synced-templates table, update these rows:
  - `host/scripts/check-enforcement-stanzas.mjs` → **1.3.0**
  - `scripts/check-instructions-budget.mjs` → **1.0.0**
  - `host/scripts/lib/instructions.mjs` → **1.0.0**
  - `scripts/lib/instructions.mjs` → **1.0.0**
  - `governance-sync-claude-section.md` → **2.0.0**
  - `closing-contract.md` → **1.1.0**

### 3. Install the reader and the re-synced scripts

The reader goes **beside every consumer**. This repo has two consumers in two lint homes:

| Template | Install to | Why there |
|---|---|---|
| `scripts/lib/instructions.mjs` 1.0.0 | `host/scripts/lib/instructions.mjs` | imported by `host/scripts/check-enforcement-stanzas.mjs` |
| `scripts/lib/instructions.mjs` 1.0.0 | `scripts/lib/instructions.mjs` | imported by `scripts/check-instructions-budget.mjs` |
| `scripts/check-enforcement-stanzas.mjs` 1.3.0 | `host/scripts/check-enforcement-stanzas.mjs` | declared lint home, run by `run-tests.yml` |
| `scripts/check-instructions-budget.mjs` 1.0.0 | `scripts/check-instructions-budget.mjs` | root governance lint, per-PR gate |

The two `instructions.mjs` copies are byte-identical, but each consumer imports `./lib/instructions.mjs`
relative to itself, so both must exist.

Run the stanza lint now. It must report `completeness` with a path count, **not**
`completeness SKIPPED`: the reader resolves the one-line `CLAUDE.md` to `AGENTS.md` and finds the
records paragraph there. If it prints SKIPPED, stop — the install is the fail-open shape #130 removes.

### 4. The root-clutter allowlist — leave the local variant alone

`host/scripts/check-root-clutter.mjs` is a **configured local variant**, not a copy of the
template: its `ALLOWED` set carries this repo's root entries (`host`, `runtime`, `docs`,
`scripts`, `opencode.json`, `.node-version`, …) and already includes `AGENTS.md`. Replacing it
with the template's minimal default would break CI. Do not re-sync it and do not add a second
entry. Verify the new root file clears with the local lint:

```bash
( cd host && node scripts/check-root-clutter.mjs )
```

### 5. ai-fleet only: move the harness-probe canary to AGENTS.md

In `.github/workflows/fleet-harness-probe.yml`:

- Change the canary step's comment from `CLAUDE.md canary` to `AGENTS.md canary`, and its printf
  redirect from `>> CLAUDE.md` to `>> AGENTS.md`.
- Change `git add .claude/skills/harness-canary/SKILL.md CLAUDE.md` to add `AGENTS.md`.
- Change the commit subject to `probe: harness-canary skill + AGENTS.md canary …`.
- Rename the check key `claude-md-ingestion` to `agents-md-ingestion` in the goal text (check 7),
  in the `for CHECK in …` list, and in the surrounding prose/comments. Check 7 must say the
  canary is in `AGENTS.md` and must require quoting it **from context, without opening the file**.
- **Remove the literal `${CLAUDE_CANARY}` from the goal text.** Today check 7 embeds the exact
  string in the dispatched goal, so a worker can quote it without loading either instruction
  file — the current probe cannot prove ingestion. The goal must say "the `AGENTS.md` on this
  branch carries a canary line containing a PROBE ARTIFACT string; quote it from your own
  context", with no value. The PR-body assertion loop still greps for `$CLAUDE_CANARY`, and the
  only other place the value exists is the line appended to `AGENTS.md`.
- Update the two remaining comments that name `CLAUDE.md` as the ingestion channel.

### 6. Bring the state doc current

- The applied-updates entry for this prompt goes in `docs/governance-sync-state.md`:
  `- [2026-11-05-agent-instructions-agents-md.md] — applied <YYYY-MM-DD>`.
- Keep the file's body under budget; the logs are not exempt from the measurement.

### 7. The budget gate — LAST

Only after the resolved text is ≤32,000 bytes (Part A of #4550 landed, or the trim otherwise
done):

- Add a step to `run-tests.yml`'s `host-test` job:

  ```yaml
      - name: Instruction budget check (governance lint:instructions-budget)
        run: node scripts/check-instructions-budget.mjs
  ```

- Run it locally first. It must print `OK` and a total ≤32,000. A SKIPPED means
  `AGENTS.md`/`CLAUDE.md` are not visible where the step runs — fix that, do not ship the skip.
- If the trim has not landed, **stop before this step** and record that the gate is owed; a red
  gate on green work is not the goal.

## Verification

```bash
# one canonical file, one import line
test "$(cat CLAUDE.md)" = "@AGENTS.md" && echo "CLAUDE.md is the import"
grep -c '^## Closing contract' AGENTS.md          # exactly 1
grep -c '^### Synced templates' AGENTS.md         # exactly 0
grep -c '^## Synced templates' docs/governance-sync-state.md   # exactly 1

# the reader resolves the import; the stanza lint does not skip
node host/scripts/check-enforcement-stanzas.mjs   # "N paragraph path(s) checked", no completeness SKIPPED
( cd host && node scripts/check-root-clutter.mjs ) # OK — local variant, still configured

# the budget (only after the trim)
node scripts/check-instructions-budget.mjs         # OK, total <= 32000

# the canary, from a real dispatched worker — not a grep of the workflow file
gh workflow run fleet-harness-probe.yml --ref <your-branch>
gh run list --workflow=fleet-harness-probe.yml --branch <your-branch> --limit 1
# then read the probe PR body:
#   PROBE-CHECK: agents-md-ingestion PASS
#   and the canary string quoted from context
```

The canary check is the one failure no lint can see: a headless worker that cannot resolve
`AGENTS.md` from its own context will still produce a green-looking PR. Paste the probe run URL
and the `agents-md-ingestion PASS` line into the PR body.

## Record it

- `docs/governance-sync-state.md` — the applied entry, the Synced-templates rows, and (if you
  refreshed the agent-instructions layer) the layer-refresh row.
- `_client.md` is updated in repo-governance only; do not edit it from here.

## Not in scope

- Trimming #4550 Part A's prose. Prerequisite, not this prompt.
- Other instruction files (`.cursorrules`, Copilot). `agent-instructions-interview` covers them.
- Making `docs/governance-sync-state.md` a records file (owner decision, 2026-11-05).
