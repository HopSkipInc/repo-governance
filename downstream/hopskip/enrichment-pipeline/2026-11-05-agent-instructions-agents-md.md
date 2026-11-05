# Agent instructions: one canonical AGENTS.md, logs out of the always-loaded file, and a size gate — enrichment-pipeline (2026-11-05)

**Client:** Hopskip (internal)
**Source:** repo-governance — issue #130, templates `governance-sync-claude-section.md` **2.0.0** ·
`closing-contract.md` **1.1.0** · `scripts/lib/instructions.mjs` **1.0.0** ·
`scripts/check-enforcement-stanzas.mjs` **1.3.0** · `scripts/check-instructions-budget.mjs` **1.0.0**.
**Scope:** make `AGENTS.md` the canonical instruction file and `CLAUDE.md` its one-line import;
move the three governance-sync logs to `docs/governance-sync-state.md`; install the
import-following reader and the budget gate.

> **Prerequisite: trim the always-loaded file.** This repo has no `AGENTS.md`; the text is
> `CLAUDE.md` alone at **41,250 bytes** (measured 2026-11-05), 1.29× the 32,000-byte budget.
> No trim issue is open for it — file one (or attach this prompt to an existing hygiene issue)
> and trim first. Do steps 1–5 now; do **step 6 (the gate) only after**
> `node tools/check-instructions-budget.mjs` reports ≤32,000. Do not lower the budget to pass and
> do not gate on a SKIPPED.

## Before you write anything

1. Read `templates/governance-sync-claude-section.md` v2.0.0 in repo-governance. The logs no
   longer live in the section; the state-doc skeleton is in the same template.
2. **The install targets are live in this checkout** (verified 2026-11-05):
   - `CLAUDE.md` — exists. `AGENTS.md` — **absent**; create it in step 1.
   - `tools/check-enforcement-stanzas.mjs` — exists, declared at v1.2.0.
   - `tools/lint-root-clutter.mjs` — exists (local filename, not the template's `check-` form);
     its `ALLOWED` set lists `CLAUDE.md` but not `AGENTS.md`.
   - `.github/workflows/code-hygiene.yml` — exists; runs both lints above.
   - `docs/enforcement-stanzas-register.md` — exists.
   - `docs/governance-sync-state.md` — **absent**; create it in step 2.
3. `tools/` is the governance-lint home here (declared in the Synced-templates table).

## What to do

### 1. Flip to one canonical AGENTS.md

- Create `AGENTS.md` with the full current content of `CLAUDE.md`.
- Replace `CLAUDE.md` with exactly one line: `@AGENTS.md`.
- The `## Closing contract` section moves with the content; it must appear once, in `AGENTS.md`.

### 2. Move the three governance-sync logs out

In the `## Governance` section:

- Remove `### Applied governance updates`, `### Layer refresh log`, and `### Synced templates`,
  including their explanatory paragraphs.
- Point step 5 at `docs/governance-sync-state.md`'s `## Applied governance updates`, and the
  layer-refresh step at its `## Layer refresh log`. Point the Synced-templates paragraph at
  `## Synced templates` in that doc.
- Update the inline section stamp to `governance-sync-claude-section.md v2.0.0 · updated 2026-11-05`.
- Create `docs/governance-sync-state.md` from the template's **State doc** skeleton with `##`
  headings, and move the existing log entries/table rows into it unchanged. It is a plain doc:
  **not** a records file — no stanza deny, no `write-record.mjs` verb, no register entry.
- Update `closing-contract.md`'s installed stamp to v1.1.0.
- In the moved Synced-templates table, update:
  - `tools/check-enforcement-stanzas.mjs` → **1.3.0**
  - `tools/check-instructions-budget.mjs` → **1.0.0** (new row)
  - `tools/lib/instructions.mjs` → **1.0.0** (new row)
  - `governance-sync-claude-section.md` → **2.0.0**
  - `closing-contract.md` → **1.1.0**

### 3. Install the reader and the re-synced scripts

| Template | Install to |
|---|---|
| `scripts/lib/instructions.mjs` 1.0.0 | `tools/lib/instructions.mjs` |
| `scripts/check-enforcement-stanzas.mjs` 1.3.0 | `tools/check-enforcement-stanzas.mjs` |
| `scripts/check-instructions-budget.mjs` 1.0.0 | `tools/check-instructions-budget.mjs` |

The reader sits beside its consumer; `check-instructions-budget.mjs` imports
`./lib/instructions.mjs`, so `tools/lib/` must exist.

Run `node tools/check-enforcement-stanzas.mjs`. It must report a paragraph-path count, **not**
`completeness SKIPPED` — that is the fail-open shape #130 removes. If it skips, stop.

### 4. The root-clutter allowlist

`tools/lint-root-clutter.mjs` is a local variant (not the template's `check-root-clutter.mjs`), so
the template's default set does not reach it. Add `'AGENTS.md'` to its `ALLOWED` set in the same
PR that creates the file — otherwise `code-hygiene.yml` fails on the flip. This is a one-line
local adaptation, not a re-sync of the template.

### 5. Bring the state doc current

Add the applied entry for this prompt to `docs/governance-sync-state.md`:
`- [2026-11-05-agent-instructions-agents-md.md] — applied <YYYY-MM-DD>`.

### 6. The budget gate — LAST

Only after the trim has landed and `node tools/check-instructions-budget.mjs` reports ≤32,000
bytes:

- Add a step to `.github/workflows/code-hygiene.yml` (next to the enforcement-stanzas step):

  ```yaml
      - name: Instruction budget check
        run: node tools/check-instructions-budget.mjs
  ```

- Run it locally first. It must print `OK`. A SKIPPED means the files are not visible where the
  step runs — fix that, do not ship the skip.
- If the trim has not landed, **stop before this step** and record that the gate is owed.

## Verification

```bash
test "$(cat CLAUDE.md)" = "@AGENTS.md" && echo "CLAUDE.md is the import"
grep -c '^## Closing contract' AGENTS.md          # exactly 1
grep -c '^### Synced templates' AGENTS.md         # exactly 0
grep -c '^## Synced templates' docs/governance-sync-state.md   # exactly 1

node tools/check-enforcement-stanzas.mjs          # path count, no completeness SKIPPED
node tools/lint-root-clutter.mjs                  # OK, AGENTS.md allowed
node tools/check-instructions-budget.mjs          # OK after the trim
```

## Record it

- `docs/governance-sync-state.md` — the applied entry and the Synced-templates rows.
- `_client.md` is updated in repo-governance only; do not edit it from here.

## Not in scope

- The prose trim itself (file the issue if none exists).
- Other instruction files (`.cursorrules`, Copilot) — `agent-instructions-interview` covers them.
- Making `docs/governance-sync-state.md` a records file (owner decision, 2026-11-05).
