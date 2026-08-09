<!-- template: closing-contract.md v1.0.0 · updated 2026-08-09 -->
# Closing contract — CLAUDE.md section

RLHF-trained assistants end responses with a formulaic caveat paragraph — "one last
thing", "worth flagging", "here's what I left broken" — because alignment training
rewards completeness signals and caution-surfacing, and the habit compounds over a
session (measured tic-rate growth of ~110% across 20 turns, arXiv:2604.19139). In an
agentic coding session the closer is doubly bad: it trains the operator to brace for a
surprise at the end of every reply, and it double-parks state that already has a proper
home — the activity ledger, the issue, the PR body.

The fix is a contract, not a ban on surfacing loose ends: loose ends are recorded the
moment they arise, in a durable store; a response ends with the result. The one
exception — something that blocks the goal or loses work if forgotten — is *led with*,
not appended. Same information, no suspense.

## Template

Add this section to the repo's `CLAUDE.md` (and to `AGENTS.md` as well if the repo's
harnesses read it). Keep the stamp comment inside the section when you install — it is
how the drift check verifies the section.

```markdown
## Closing contract

<!-- template: closing-contract.md v1.0.0 · updated 2026-08-09 -->

End responses with the result, not a caveat ledger. Loose ends, risks, and follow-ups
are recorded the moment they arise — `record_activity` for work state when the
fleet-host MCP is available, an issue or the PR body otherwise — never saved up for a
closing paragraph. Surface one in prose only if it blocks the stated goal or loses work
if forgotten, and when you do, LEAD with it — first sentence, not last. Banned
openers/closers: "one last thing", "one thing to note", "worth flagging", "needs your
eyes", "heads up". If everything is done, say so plainly and stop.
```

## Design notes

- **The section is small and absolute on purpose.** Nuanced versions ("avoid
  unnecessary closers") leave the model a judgement call it will reliably make the
  RLHF-shaped way. A short banned-phrase list plus a positive rule ("end with the
  result") is enforceable by inspection.
- **Lead, don't close, is the load-bearing half.** The failure being fixed is not the
  information — it is the *suspense*: the operator sits through a whole reply waiting
  to learn what broke. A blocking loose end as the first sentence carries the same
  content with none of the ambush.
- **The ledger reference degrades gracefully.** Repos without the fleet-host MCP swap
  in an issue or PR body; the rule is "durable store at the moment it arises", not a
  specific tool.
- **Suppression, not elimination — set operator expectations.** Instructions lean on a
  trained-in tic; expect near-compliance early in a session and drift in long ones
  (the accumulation finding above). Re-stating the contract mid-session is a
  legitimate operator move, not a workaround.
- **Verification is the drift check, not the install grep.** The section carries its
  stamp inline (precedent: `governance-sync-claude-section.md` v1.2.0), and
  `check-downstream-drift.mjs` re-verifies presence and version on every sync — the
  install-time grep is never the only thing that checks. The consumer is the harness
  itself: both Claude Code and opencode read the repo's `CLAUDE.md` (opencode
  additionally reads `AGENTS.md`), so a section in those files is in the read path by
  construction — no separate liveness proof applies to a prose norm, and the template
  does not pretend one exists.
- **Declared by template name** in the Synced templates table, like the sync section —
  its location is `CLAUDE.md` by definition.
