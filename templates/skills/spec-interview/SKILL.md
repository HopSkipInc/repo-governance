---
name: spec-interview
description: >
  Interview an issue's author at creation or when rewriting a spec-limited escalation.
  Look up facts, work the decision tree in numbered rounds, and obtain human confirmation
  before writing the canonical issue body. Withhold recommendations on boundary decisions.
  Supports readable-repo and no-repo modes, without mandatory tools or subagents.
version: 1.0.0
updated: 2026-11-09
triggers:
  - /spec-interview
  - spec interview
  - specify this issue
  - rewrite this spec
---

# Spec Interview

Find the missing sentences before an implementer has to invent them. Facts are the agent's
job; decisions are the human's. A well-formed issue containing decisions nobody made is
worse than an honest open question: structural checks pass it and dispatchers trust it.

**Usage:** interview an author creating an issue, or run the **Rewrite it** response on an
existing issue with a `spec` component. This procedure writes issues, not governance records
or implementation code. It never tiers its own output or certifies it as agent-ready.

## Step 0: Discover the mode and the issue

1. **Declare the mode first:** `Readable-repo mode — <repo and accessible sources>` or
   `No-repo mode — I cannot verify repository facts; unknowns will remain open.` Partial
   access must name its limits; an inaccessible source is not evidence of absence. If access
   changes during the run, announce it before relying on new evidence.
2. Read the request and, for a rewrite, the complete issue including its tier reason,
   outcomes, exclusions, questions and available comments. Discover the target's issue
   authoring policy, routing policy and Definition of Done where readable. Do not ask the
   human to restate information already provided.
3. Identify the human author and who owns each decision; ask when ownership is unknown.
   The person answering must hold the decision, not guess on someone else's behalf.
4. Use available file readers, repository connectors or search directly. No subagent or
   CLI is required. Without a repository connector, work from the supplied issue and
   records as attributed evidence, never pretend those excerpts are a code inspection.

Distribution is the same SKILL.md in `.claude/skills/` or the harness's equivalent. In chat
apps, an org-provisioned skill or the pasted procedure is sufficient. No MCP surface or
server, per-harness variant, or fleet-host skill store is required.

## Step 1: Gather evidence and build the decision tree

**Probe, then ask.** Look up paths, callers, tests, commands and existing behaviour wherever
the repo is readable. Verify that a proposed install target has a live consumer; a file's
existence is not enough. Cite each fact by `file:line`, named record or issue. Separate
observed behaviour from recorded intent, and surface contradictions without resolving them.
Never ask a human a factual question the accessible code or records can answer.

For boundary detection, read the target's `docs/testing-strategy.md` §6 (or equivalent),
the calibration set in `docs/agent-routing-records.md`, and surfaces named by accessible
open `inherent`/`both` issues. Note sources you could not inspect. A human can flag any
question as a boundary decision; that overrides your read. **In no-repo mode the human's
flag is the only boundary source. When unsure, withhold the recommendation.** Do not spawn
a routing-classifier risk-surface probe as a prerequisite for interviewing.

Build a working tree/list with stable question IDs, prerequisites, evidence, decision owner
and state: unanswered, answered, excluded branch, or unresolved. On a Rewrite-it run,
**seed round one with the gaps named in the tier reason**. Do not replace the named gap
with an unrelated generic product questionnaire. If gaps depend on each other, ask the
root gap first and explicitly list the dependent gaps waiting for it.

Cover behaviour, failure/partial-failure semantics, verification, scope and dependencies
as relevant to the issue. **Ask the converse:** for every outcome that refuses something,
ask for the matching admission outcome and its proof. “Only with the right password” is
satisfied by refusing everyone unless admitting the right password is specified too.
Do not invent a positive case or assume the converse follows from a negative test.

## Step 2: Interview in numbered rounds

Each round contains **every currently independent question whose prerequisites are settled**,
together and numbered. A question depending on another still open in that round waits for
a later round. Use the harness's question tool where available (`AskUserQuestion` only
where available and able to preserve the cards); otherwise post the numbered round in chat.
Do not reduce cards to option labels to fit a tool. Plain Markdown is always a valid path.

**Each question is a card:**

```markdown
1. Q-<id> — <question>
   Context: <plain-language explanation of relevant code or records; cite every fact>
   Options and costs:
   - A: <answer> — <what it costs or sacrifices>
   - B: <answer> — <what it costs or sacrifices>
   - Other / don't know: <may leave the question open; never a guessed default>
   Recommendation: <answer and reason, worded so “yes” accepts it>
     OR None — <boundary decision, human flag, or uncertainty; no implicit preferred option>
   Who decides: <named human, or ownership question if not yet known>
```

An unavailable fact is stated as unknown, citing the supplied request or the access limit,
not dressed up as code context. Option costs are predictions, not observed facts; label
them as such and cite any factual premise. No recommendation, leading wording, preferred
ordering or “yes accepts” shortcut on an `inherent` surface, a human-flagged boundary,
or an uncertain boundary. Require an explicit answer there. An unqualified “yes” to a
multi-card round is ambiguous: ask which recommendations it accepts, never fill the rest.

Keep answers **apart from the issue prose**, as a decisions list:

```markdown
- Q-<id>: <question> → <answer or unresolved> → <who answered>, <when>
  Source: <message/record reference>; supersedes <earlier answer, if any> because <reason>.
```

Use the actual respondent and answer time (or the dated source for a previously recorded
human decision). Never fabricate a name, timestamp or confirmation. Keep changed answers
and their reasons; a later prose rewrite must not silently change what was decided.
An agent recommendation is not an answer. Human confirmation of a draft is recorded
separately from the individual answers.

“I don't know — check the code” is valid. With access, inspect the code; without it,
retain the fact under `## Open questions`, with what must be checked and by whom if known.
Do not interpret “don't know” as consent to the recommendation. An unanswered prerequisite
blocks its dependent questions; do not traverse that branch on an invented assumption.

After each round, reconcile answers with evidence, record branches explicitly cut with their
reasons, and ask the next enabled round. **Complete means every branch has been visited or
explicitly excluded and nothing remains open or silently assumed.** If the human pauses or
cannot answer, call the run incomplete; do not keep asking forever or call it ready.

## Step 3: Check splits, confirm, then write

Before writing, apply the split tells from Issue Authoring: **“and” in the title**, or
**outcomes that change character partway down** (plumbing first, the entire risk later).
If either fires, propose separate issues, their scope and dependencies for human confirmation.
Do not assign their tiers; decomposition precedes independent classification. Retain a
mechanism-specific non-splittability statement where the scope is genuinely inseparable.

Present a preview of the proposed body/bodies and the separate decisions list. Cross-check
every outcome against an answer or cited existing decision; include refusal and admission
proofs. Proof-of-failure criteria name the exact rule and expected failure text, not merely
“make CI red.” Preserve useful file paths, test names and commands; do not replace binary
outcomes with long user-story lists.

**Nothing is persisted or filed until the human explicitly confirms the preview.** Complete
runs ask for final confirmation. Incomplete runs can offer an explicitly incomplete draft
for confirmation, but unresolved items stay under `## Open questions` and status is dated
`needs-decision` (or `blocked` if another blocker comes first), never `ready`. A preview in
chat is not permission to edit an existing issue, write files or apply labels.

Use the target's canonical Issue Authoring schema: Work type; Serves where required; Impl
tier (independently supplied, otherwise explicitly pending triage); Risk (independently
supplied, otherwise pending triage); binary Verifiable outcomes; exact Verification;
Not in scope with one reason per cut branch; Open questions for every unresolved decision
or fact; applicable Definition of Done including the PR closing reference; Dependencies
with resolvable refs or `none`; and dated Status. Omit optional empty sections where allowed.
An untiered output is an authoring handoff, **not an exception to the target's triage
requirement** and not eligible for automated pickup. Disclose mode/access limits alongside
the output and deliver the decisions list separately from the issue body (for example in
the handoff or an issue comment), so prose edits cannot replace the answer history.

**Independent triage:** where the properly pinned `routing-classifier` can run, delegate
classification of the confirmed draft to it, under the target's routing procedure. Otherwise
hand over/file it untiered for the next triage, expressly pending classification. Do not
assign `impl:`, risk verdicts or agent-ready markers yourself. Preserve an existing tier
until an independent authorized triage decision changes it; interview completion alone
does not authorize changing the kind or lowering the tier.

On a Rewrite-it run, hand the confirmed body and independent classification to the authorized
editor **as one edit**: any spec-based label downgrade and the body edit removing its reason
land together (Agent Routing → *Downgrades*, R6). A resolved `both` spec component leaves
`inherent`; the tier stays. No agent downgrades an issue it is about to implement. If
classification or the combined edit is unavailable, leave the live issue untouched and
hand over the proposed edit; never apply just the label change.

Use the available issue connector only with confirmation and the target's creation checks.
`gh` is optional; without a filing tool deliver the confirmed body and decisions list for
the human to file. No repo access, no classifier and no filing tool are disclosed limits,
not successful checks. Report structural validation as SKIPPED if it could not run.

## Step 4: Present the handoff

Return the issue link(s), or body/bodies to file, plus the separate attributed decisions
list and confirmation. State complete or incomplete, mode and access limits, independent
triage result or pending triage, and verification actually performed. Name open questions
and the next owner/action when incomplete. Never claim a dry run or a structural pass
proves the human made a decision you did not record.
