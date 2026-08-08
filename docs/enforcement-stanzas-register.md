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
| `claude-code` | `.claude/settings.json` | 2026-08-08 | Stanza from `templates/harness-enforcement.md` v1.0.0 |
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

**Operational consequence, on the record:** a hard `deny` gates amendment as well as
destruction — an agent session in this repo cannot edit these files (a §6 row
addition, a PDR status bump) without a human making the edit or granting a local
override. That is the design intent (the permission layer is the only stop-rule that
has held in the wild), and the pain point is the signal: if amendment flow here is too
frequent for the gate, the remedy is moving this repo's rules from `deny` to `ask` —
recorded in this register — never deleting the rules.
