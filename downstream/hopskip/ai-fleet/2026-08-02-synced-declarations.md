# Governance Maintenance — HopSkipInc/ai-fleet — 2026-08-02

**Client:** hopskip
**Source:** greg/repo-governance downstream-drift disposition (issue #14, template `governance-sync-claude-section.md` v1.2.0)

You are reconciling this repo's `### Synced templates` declarations with reality, under
the newly named canonical dialect. No governance artifact's *content* changes in this
prompt — this is declaration hygiene.

## What changed in the templates (this sync-review)

- `governance-sync-claude-section.md` v1.1.0 → **v1.2.0**: the canonical first-column
  dialect for `### Synced templates` is now **repo-relative installed paths**
  (`docs/agent-routing.md`, not `agent-routing.md`). Template-relative declarations
  forced the drift check to infer install locations — that inference produced 10 false
  MISMATCH findings against this repo and enrichment-pipeline for months.
- Sections installed from templates now carry an **inline stamp comment** so the drift
  check can verify them.
- The drift lint (`scripts/check-downstream-drift.mjs` in repo-governance) now fails
  closed: a declaration it cannot verify (no readable stamp) reports NOSTAMP and blocks.
  Two of your rows are NOSTAMP today.

## What to do in this repo

1. **Rewrite the Synced templates table's first column to repo-relative paths**, and
   drop the parenthetical harness notes from the first column (the version cell holds
   only the version):

   | Current first column | Becomes |
   |---|---|
   | `agent-routing.md` | `docs/agent-routing.md` |
   | `agent-routing-records.md` | `docs/agent-routing-records.md` |
   | `routing-triage/SKILL.md` | `.claude/skills/routing-triage/SKILL.md` |
   | `routing-classifier.md (Claude Code)` | `.claude/agents/routing-classifier.md` |
   | `routing-classifier.opencode.md (opencode)` | `~/.config/opencode/agents/routing-classifier.md` |
   | `check-issue-routing.mjs` | `scripts/check-issue-routing.mjs` |

2. **Move two rows out of the table — they are adapted files, not synced copies**
   (owner decision, 2026-08-02). `docs/definition-of-done.md` and
   `docs/issue-authoring.md` both diverge materially from the current templates (the
   two-phase audit work among other local edits) and carry no version stamp. Remove both
   rows and add an "Adapted" note below the table, the pattern analytics-infrastructure
   already uses:

   ```
   Adapted (not direct copies — customized for this repo, not auto-synced):
   `docs/definition-of-done.md`, `docs/issue-authoring.md`
   ```

   Do not edit the files themselves. If a future sync intentionally re-baselines either
   file on the template, it re-enters the table with a stamp then.

3. **Add the section's inline stamp.** Under the `## Governance` heading (top of the
   governance-sync section this template installed), add:

   ```html
   <!-- template: governance-sync-claude-section.md v1.2.0 · updated 2026-08-02 -->
   ```

4. **`personas.md` note:** there is no `templates/personas.md` in repo-governance, so
   this row declares something the drift check can never verify. Keep it as
   informational or move it under the Adapted note — your call; it produces no finding
   either way.

## Already present — skip

- The routing re-sync to 1.10.0 / 1.6.0 / 1.2.0 (your five BEHIND findings) is carried
  by the pending `2026-07-27-quality-coverage-layers` prompt. This prompt does not
  duplicate it — apply that prompt separately.

## Not applicable — skip

- No dialect rewrite is needed for `governance-sync-claude-section.md` — you do not
  declare it. If you want the section tracked after step 3, declare it by template name
  (the one sanctioned exception to repo-relative — its location is CLAUDE.md by
  definition).

## Verifiable outcomes

Run from the repo root. Each line is an independent check.

- `grep -A12 "### Synced templates" CLAUDE.md | grep -c "docs/agent-routing.md"` — first column is repo-relative (expect ≥ 2: policy + records)
- `grep -A15 "### Synced templates" CLAUDE.md | grep "Adapted" | grep -c "definition-of-done.md"` — DoD moved to the Adapted note (expect 1)
- `grep -c "<!-- template: governance-sync-claude-section.md v1.2.0" CLAUDE.md` — inline stamp present (expect 1)
- `grep -A12 "### Synced templates" CLAUDE.md | grep -cE "^\| (agent-routing|routing-triage|routing-classifier|check-issue-routing)"` — no template-relative declarations remain (expect 0)
