# Agent instructions: one canonical AGENTS.md, logs out of the always-loaded file, and a size gate — infra-ops (2026-11-05)

**Client:** Hopskip (internal)
**Source:** repo-governance — issue #130, templates `governance-sync-claude-section.md` **2.0.0** ·
`closing-contract.md` **1.1.0** · `scripts/lib/instructions.mjs` **1.0.0** ·
`scripts/check-instructions-budget.mjs` **1.0.0**.
**Scope:** make `AGENTS.md` the canonical instruction file and `CLAUDE.md` its one-line import;
move the three governance-sync logs to `docs/governance-sync-state.md`; install the
import-following reader and the budget gate.

This repo is **within budget**: `CLAUDE.md` is **5,179 bytes** (measured 2026-11-05), so the gate
goes in green in the same PR. No trim prerequisite.

## Before you write anything

1. Read `templates/governance-sync-claude-section.md` v2.0.0 in repo-governance. The logs no
   longer live in the section; the state-doc skeleton is in the same template.
2. **The install targets are live in this checkout** (verified 2026-11-05):
   - `CLAUDE.md` — exists. `AGENTS.md` — **absent**; create it in step 1.
   - `scripts/` — exists. `scripts/check-instructions-budget.mjs` and `scripts/lib/instructions.mjs`
     are **absent**; install them in step 3.
   - `.github/workflows/ci.yml` — exists; its `governance` job is the per-PR lint home.
   - `docs/governance-sync-state.md` — **absent**; create it in step 2.
3. This repo has **no** enforcement stanza, no `docs/enforcement-stanzas-register.md`, and no
   root-clutter lint (class: `core`). Do not install those here; the only new script is the
   budget lint.

## What to do

### 1. Flip to one canonical AGENTS.md

- Create `AGENTS.md` with the full current content of `CLAUDE.md`.
- Replace `CLAUDE.md` with exactly one line: `@AGENTS.md`.
- The `## Closing contract` section (if present) moves with the content; it must appear once,
  in `AGENTS.md`.

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
- Update the moved Synced-templates rows for `governance-sync-claude-section.md` → **2.0.0**,
  `closing-contract.md` → **1.1.0** (if declared), `scripts/check-instructions-budget.mjs` →
  **1.0.0** (new row), and `scripts/lib/instructions.mjs` → **1.0.0** (new row).

### 3. Install the reader and the budget lint

| Template | Install to |
|---|---|
| `scripts/lib/instructions.mjs` 1.0.0 | `scripts/lib/instructions.mjs` |
| `scripts/check-instructions-budget.mjs` 1.0.0 | `scripts/check-instructions-budget.mjs` |

The budget lint imports `./lib/instructions.mjs`, so `scripts/lib/` must exist.

Run `node scripts/check-instructions-budget.mjs` before wiring the gate. It must print `OK` with
a total near 5,200 bytes. A SKIPPED means `AGENTS.md`/`CLAUDE.md` are not visible where it runs —
fix that, do not ship the skip.

### 4. Bring the state doc current

Add the applied entry for this prompt to `docs/governance-sync-state.md`:
`- [2026-11-05-agent-instructions-agents-md.md] — applied <YYYY-MM-DD>`.

### 5. The budget gate — LAST

- Add a step to the `governance` job in `.github/workflows/ci.yml`:

  ```yaml
      - name: Instruction budget check
        run: node scripts/check-instructions-budget.mjs
  ```

- The gate goes in this PR and must be green. It is a function of the diff, so it belongs on the
  per-PR gate, not a scheduled probe (ADR-026).

## Verification

```bash
test "$(cat CLAUDE.md)" = "@AGENTS.md" && echo "CLAUDE.md is the import"
grep -c '^## Closing contract' AGENTS.md          # exactly 1 (if the section exists)
grep -c '^### Synced templates' AGENTS.md         # exactly 0
grep -c '^## Synced templates' docs/governance-sync-state.md   # exactly 1

node scripts/check-instructions-budget.mjs        # OK, total <= 32000
```

## Record it

- `docs/governance-sync-state.md` — the applied entry and the Synced-templates rows.
- `_client.md` is updated in repo-governance only; do not edit it from here.

## Not in scope

- Installing an enforcement stanza or a root-clutter lint — this repo does not run them (core
  class).
- Other instruction files (`.cursorrules`, Copilot) — `agent-instructions-interview` covers them.
- Making `docs/governance-sync-state.md` a records file (owner decision, 2026-11-05).
