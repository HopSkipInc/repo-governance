# Governance update: closing contract — end the caveat-closer tic (2026-08-09)

**Applies to:** all governed repos, both `full` and `core` adoption class.
**Template:** `templates/closing-contract.md` v1.0.0 or later — read the stamp, do not assume.
**Effort:** one section + one table row per repo. Minutes.

## Why

Every model in the estate ends responses with a formulaic caveat paragraph — "one last
thing", "worth flagging", "here's what I left broken". It is a trained-in verbal tic
(RLHF rewards completeness signals and caution-surfacing; measured tic-rate growth of
~110% across a 20-turn session, arXiv:2604.19139), and in agentic sessions it has a real
cost: the operator braces for a surprise at the end of every reply, and the loose end is
double-parked in prose when it already has a durable home — the activity ledger, an
issue, the PR body.

The contract does not ban surfacing loose ends. It moves them: recorded the moment they
arise, and the rare one that blocks the goal or loses work if forgotten is **led with**,
not appended. Same information, no suspense.

## Steps

**1. Install the section.** Copy the section from `templates/closing-contract.md`
verbatim — stamp comment included — into the repo's `CLAUDE.md` as a top-level `##`
section. Placement is free; near the repo's tone/session-protocol material reads best.

If the repo also maintains an `AGENTS.md` that its harnesses read (ai-fleet does —
opencode sessions read `AGENTS.md`; fleet workers and Claude Code read `CLAUDE.md`),
install the section there too. One declaration covers both copies.

**2. Declare it.** Add to the `### Synced templates` table in `CLAUDE.md`:

```markdown
| closing-contract.md | v1.0.0 | <today> |
```

Declared by template name, not path — this template installs as a section of
`CLAUDE.md`, so its location is fixed by definition (precedent:
`governance-sync-claude-section.md`). The drift check verifies the section's presence
and inline stamp, so the declaration is what makes the install checkable.

**3. Record the application.** Append to the Applied-governance list in `CLAUDE.md`:
`[2026-08-09-closing-contract.md] — applied <date>`.

## Verification

```bash
grep -A2 '## Closing contract' CLAUDE.md   # shows the section + inline stamp
grep 'closing-contract.md' CLAUDE.md       # shows the Synced-templates row
```

Two honest notes on what this verification is and is not:

- **It is not the only thing that checks.** `check-downstream-drift.mjs` re-verifies
  section presence and stamp version on every drift run (the `SECTION_INSTALLED`
  gate) — the grep above is the install-time confirmation, the lint is the standing one.
- **There is no effect-check, and this prompt does not fake one.** The artifact is a
  prose norm; nothing mechanical can prove a model ended its last reply cleanly. The
  liveness question the governance gotchas demand is answered by construction: both
  harnesses in the estate read the repo's `CLAUDE.md` (and opencode reads `AGENTS.md`),
  so a section in those files is in the read path. Behavioural compliance is an
  operator observation — if the tic persists in a long session, re-state the contract
  mid-session (the template's design notes set that expectation).

## Explicitly out of scope

- **Rewriting existing tone/voice sections.** The contract sits alongside house style;
  it does not replace it.
- **Policing phrasing in historical documents.** The rule binds agent responses going
  forward, not the written record.
