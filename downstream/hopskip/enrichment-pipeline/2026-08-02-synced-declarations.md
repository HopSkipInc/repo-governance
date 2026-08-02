# Governance Maintenance — HopSkipInc/enrichment-pipeline — 2026-08-02

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
  MISMATCH findings against you and ai-fleet for months.
- Sections installed from templates now carry an **inline stamp comment** so the drift
  check can verify them. Your `governance-sync-claude-section.md` row is NOSTAMP today —
  this is its fix.
- The drift lint (`scripts/check-downstream-drift.mjs` in repo-governance) now fails
  closed: a declaration it cannot verify reports NOSTAMP and blocks.

## What to do in this repo

1. **Rewrite the Synced templates table's first column to repo-relative paths:**

   | Current first column | Becomes |
   |---|---|
   | `agent-routing.md` | `docs/agent-routing.md` |
   | `agent-routing-records.md` | `docs/agent-routing-records.md` |
   | `skills/routing-triage/SKILL.md` | `.claude/skills/routing-triage/SKILL.md` |
   | `agents/routing-classifier.md` | `.claude/agents/routing-classifier.md` |
   | `agents/routing-classifier.opencode.md` | `~/.config/opencode/agents/routing-classifier.md` |
   | `scripts/check-issue-routing.mjs` | *(unchanged — already repo-relative)* |

2. **Keep `governance-sync-claude-section.md` declared by template name** — it is the
   one sanctioned exception (its location is CLAUDE.md by definition) — and make it
   verifiable: add the inline stamp under the `## Governance` heading (top of the
   governance-sync section), and update the row's declared version to `1.2.0`:

   ```html
   <!-- template: governance-sync-claude-section.md v1.2.0 · updated 2026-08-02 -->
   ```

3. **`docs/personas.md` note:** there is no `templates/personas.md` in repo-governance,
   so this row declares something the drift check can never verify. Keep it as
   informational or move it under an Adapted note — your call; it produces no finding
   either way.

## Already present — skip

- The routing re-sync to 1.10.0 / 1.6.0 / 1.2.0 (your five BEHIND findings) is carried
  by the pending `2026-07-27-quality-coverage-layers` prompt. This prompt does not
  duplicate it — apply that prompt separately.

## Not applicable — skip

- No Adapted-note moves needed — unlike ai-fleet, your declared files carry stamps that
  match their declarations.

## Verifiable outcomes

Run from the repo root. Each line is an independent check.

- `grep -A12 "### Synced templates" CLAUDE.md | grep -c "docs/agent-routing.md"` — first column is repo-relative (expect ≥ 2: policy + records)
- `grep -c "<!-- template: governance-sync-claude-section.md v1.2.0" CLAUDE.md` — inline stamp present (expect 1)
- `grep -A12 "### Synced templates" CLAUDE.md | grep "governance-sync-claude-section.md" | grep -c "1.2.0"` — section declared at 1.2.0 (expect 1)
- `grep -A12 "### Synced templates" CLAUDE.md | grep -cE "^\| (agent-routing|skills/|agents/)"` — no template-relative declarations remain (expect 0)
