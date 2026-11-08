---
name: pickup
description: >
  Reads an issue's risk: and gate: labels, resolves the minimum capability class
  through the repo's risk→class rule, and prints the exact model-switch command
  for the current harness. Advisory only: it never blocks, refuses a prompt,
  switches the model, or nags. Where the harness cannot expose the session's
  current model, it prints the required class without a comparison.
version: 1.1.0
updated: 2026-11-07
triggers:
  - /pickup
---

# Pickup — which model does this issue need?

**This is advice, not a gate.** It never blocks a session, refuses a prompt, rewrites
anything, or switches the model. The engineer keeps the choice. Proceeding on a below-class
model takes no acknowledgement from this skill; a warning is informational and is never
repeated for the same issue in the same session.

Read `docs/agent-routing.md` and `docs/agent-routing-records.md` before running. The rule is
in the records file, not here.

## Procedure

**Run the resolver. The resolver is the skill.** Do not classify the issue yourself, do not
paraphrase its output, and never say you are switching the model. The engineer runs the
switch command; this skill only prints it.

1. **Get the issue number** from the invocation: the first `#N`, bare `N`, or issue URL.
   If there is none, say "pickup needs an issue number: `/pickup <issue>`" and stop.
2. **Run exactly** `node scripts/pickup-guidance.mjs <issue>`.
3. **Print the resolver's stdout verbatim as your entire response.** Do not add an
   acknowledgement prompt, do not ask the engineer to confirm, do not execute a model-switch
   command, and do not claim the model changed.

The resolver is the same code the first-prompt hooks use, so `/pickup` and the hooks can never
disagree. It is read-only and always exits 0.

## What the output means

- **Required class** is the rule's output for this issue's `risk:` labels. It is a class, never
  a model name; the switch command is resolved through the records route table.
- **A human finishes this** names any `gate:` labels. The skill does not enforce them.
- **Below class** is advice. The engineer may proceed; there is no acknowledgement to give.
- **Above class** is a cost note only.
- **No current model** means the harness did not expose it. The skill prints the required class
  and command without comparing — it never guesses.

## Harness notes

- **Claude Code** installs the skill at `.claude/skills/pickup/SKILL.md` (per-repo).
- **opencode v2** installs at `.opencode/skills/pickup/SKILL.md` (project) or
  `~/.config/opencode/skills/pickup/SKILL.md` (global) — the same `SKILL.md` file type, with
  skill ID `pickup`. v2 also reads the `.claude/skills` and `.agents/skills` compatibility
  paths. Invoke it by name/`@pickup`; the `/pickup` trigger is the Claude Code slash form.
- Claude Code's session transcript carries the current model and the resolver reads it
  best-effort. opencode v2 exposes the model to the first-prompt plugin through `event.model`,
  but not to a skill; `/pickup` therefore uses the no-comparison path.
