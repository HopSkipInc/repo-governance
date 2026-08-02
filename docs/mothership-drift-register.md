# Mothership drift register

**What reads this:** `scripts/check-mothership-drift.mjs`. The lint fails closed if this
file is missing, or a table row is malformed — a register that cannot be read proves
nothing.

This repo enforces template sync in every governed repo and, until 2026-08-02, ran no
check on its own installed copies: a routing-sweep preflight found `docs/agent-routing.md`
at 1.9.0 while `templates/` shipped 1.10.0, caught by an agent reading by hand — luck,
not process. This register is the check's input. A `templates/`↔`docs/` name collision
present on disk must appear below — as a registered pair or an exemption with a reason —
or the lint reports it. Registration is a decision, not a silence: this is a register,
not a suppression list (pattern: `scripts/check-analyze-repo-coverage.mjs`).

## Registered pairs (byte-identical required)

| docs/ path | templates/ path | Since | Note |
|---|---|---|---|
| `docs/agent-routing.md` | `templates/agent-routing.md` | 2026-08-02 | The policy is `diff -q`-verified against the template — the records moved out to `docs/agent-routing-records.md` in policy 1.9.0 precisely so this pair could stay byte-identical |

## Exemptions (never compared, reason required)

| docs/ path or prefix | Reason |
|---|---|
| `docs/agent-routing-records.md` | Records file (CLAUDE.md, "Records files — never `cp` over these") — local, dated, exists nowhere else; the blank form lives in `templates/` |
| `docs/code-conventions.md` | Records file — same rule; a byte-identical lint firing here invites `cp` as the remedy, which destroys records with no diff to recover from |
| `docs/testing-strategy.md` | Records file — same rule, same remedy hazard |
| `docs/pdr/` | The PDR corpus is records — the shape syncs, the records never do (the sync firewall, session 11) |
