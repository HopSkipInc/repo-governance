# Enforcement stanzas register

**What reads this:** `scripts/check-enforcement-stanzas.mjs` (self-installed copy of
`templates/scripts/check-enforcement-stanzas.mjs`, kept byte-identical — the fixture
suite asserts it). The lint fails closed if this file is missing or a row is malformed —
a register that cannot be read proves nothing.

This is the install-assertion half of the pre-action enforcement pair (issue #37, split
from #33; design: `docs/pre-action-enforcement-recommendation.md`, "Honest-degradation
design"). The stanza gates the harness's own file tools; this register is how CI knows
the gate is still there. A records file named in CLAUDE.md but absent below is a
blocking UNREGISTERED — registration is a decision, not a silence.

## Harnesses

| harness | config path | Since | Note |
|---|---|---|---|
| `claude-code` | `.claude/settings.json` | 2026-08-08 | Stanza from `templates/harness-enforcement.md` v1.1.0 — stamp is a `"_governance_install"` string key, **not** a `//` comment: Claude Code parses this file as strict JSON and discards it entirely on a comment. This repo's own config carried the comment form from 2026-08-08 to 2026-08-11 and enforced nothing (v1.0.0 install; see the v1.1.0 template's stamp table). The `ask`/`deny` mode note that used to ride as a comment here lives in the mode paragraph at the bottom of this file, which was always its authoritative home |
| `opencode` | `opencode.json` | 2026-08-08 | Stanza from `templates/harness-enforcement.opencode.md` v1.0.0 — catch-all `"*": "allow"` first, denies after (last-match-wins) |

## Records paths

Exactly the paths named in CLAUDE.md, "Records files — never `cp` over these".
Directories carry a trailing slash; the lint requires the `**` glob form in the stanza.

| path | Since | Note |
|---|---|---|
| `docs/agent-routing-records.md` | 2026-08-08 | Records — model→class mapping, calibration set |
| `docs/code-conventions.md` | 2026-08-08 | Records — enforced / documented / not codified |
| `docs/testing-strategy.md` | 2026-08-08 | Records — coverage floor, §6 properties |
| `docs/pdr/` | 2026-08-08 | The PDR corpus — the shape syncs, the records never do |

## Paragraph exemptions

Paths the CLAUDE.md records paragraph mentions that are **not** records — the
completeness rule reads every backticked path in the section, including the contrast
clause. Reason required per row; a reasonless row fails closed.

| path | Reason |
|---|---|
| `templates/` | The paragraph's contrast clause — "The blank forms live in `templates/`". Forms are the product, not records; gating them is check-template-versions' job, not this stanza's |

**Mode, on the record:** this repo runs its records paths at **`ask`**, not `deny`
(decision 2026-08-08, review feedback on PR #64). Records maintenance here is a daily
paired activity — a §6 row, a PDR status bump, a calibration append — and a hard deny
hands every one of those edits to the human to type. `ask` keeps the human as the
checkpoint (the harness prompts, the diff is on screen) while remaining a hard wall
unattended: a headless run against an `ask`-listed path auto-rejects in both harnesses
(demonstrated 2026-08-08, Claude Code 2.1.226 / opencode 1.18.15 — runbook:
`docs/harness-binding-smoke-check.md`). Secrets paths run at `deny`, always. The
downgrade moves a rule from `deny` to `ask` — it never deletes one. If the checkpoint
proves noisy in practice, the remedy is recorded here before the mode moves back.
