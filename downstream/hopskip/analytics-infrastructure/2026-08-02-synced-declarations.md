# Governance Maintenance — HopSkipInc/analytics-infrastructure — 2026-08-02

**Client:** hopskip
**Source:** greg/repo-governance downstream-drift disposition (issue #14, template `governance-sync-claude-section.md` v1.2.0)

You are making two small declaration-hygiene fixes. Your Synced templates table already
uses what became the canonical dialect — this prompt ratifies that and repairs one
unparseable row.

## What changed in the templates (this sync-review)

- `governance-sync-claude-section.md` v1.1.0 → **v1.2.0**: the canonical first-column
  dialect for `### Synced templates` is now **repo-relative installed paths** — the
  convention you have used all along. ai-fleet and enrichment-pipeline are rewriting
  their tables to match.
- Sections installed from templates now carry an **inline stamp comment** so the drift
  check can verify them.

## What to do in this repo

1. **Fix the opencode classifier row's version cell.** Your row declares
   `~/.config/opencode/agents/routing-classifier.md` with version
   `v1.1.0 (hidden: false local deviation)` — the parenthetical makes the whole row
   unparseable to the drift check, so it has been silently skipped since July. The
   version cell holds only the version:

   | Template | Installed version | Synced on |
   |---|---|---|
   | `~/.config/opencode/agents/routing-classifier.md` | v1.1.0 | 2026-07-27 (`hidden: false` local deviation preserved) |

2. **Add the section's inline stamp** under the `## Governance` heading (top of the
   governance-sync section):

   ```html
   <!-- template: governance-sync-claude-section.md v1.2.0 · updated 2026-08-02 -->
   ```

   If you want the section tracked, declare it by template name at `1.2.0` (the one
   sanctioned exception to repo-relative). Optional — you do not declare it today.

3. **`docs/personas.md` note:** there is no `templates/personas.md` in repo-governance,
   so this row declares something the drift check can never verify (and its date-shaped
   version is unparseable as one). Keep it as informational or move it under your
   Adapted note — your call; it produces no finding either way.

## Already present — skip

- Your first-column dialect — repo-relative since July. The canonical decision ratifies it.
- The routing re-sync to 1.10.0 / 1.6.0 / 1.2.0 (your three BEHIND findings) is carried
  by the pending `2026-07-27-quality-coverage-layers` prompt. This prompt does not
  duplicate it — apply that prompt separately.

## Not applicable — skip

- No NOSTAMP findings against you — every declared file carries a readable stamp.

## Verifiable outcomes

Run from the repo root. Each line is an independent check.

- `grep "opencode/agents/routing-classifier" CLAUDE.md | grep -cE "\| v1\.1\.0 \|"` — version cell holds only the version (expect 1)
- `grep "opencode/agents/routing-classifier" CLAUDE.md | grep -c "hidden: false"` — the deviation note survives outside the version cell (expect 1)
- `grep -c "<!-- template: governance-sync-claude-section.md v1.2.0" CLAUDE.md` — inline stamp present (expect 1)
