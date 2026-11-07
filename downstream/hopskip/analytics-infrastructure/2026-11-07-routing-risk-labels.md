# Routing: risk labels, the records-held rule, and interactive pickup — analytics-infrastructure (2026-11-07)

**Client:** Hopskip (internal)
**Source:** repo-governance — #135, templates `agent-routing.md` **1.21.0** ·
`agent-routing-records.md` **1.2.0** · `issue-authoring.md` **1.6.0** ·
`scripts/check-issue-routing.mjs` **1.6.0** · `scripts/check-routing-equivalence.mjs` **1.1.0** ·
`skills/routing-triage/` **1.8.0** · `agents/routing-classifier.md` **1.4.0** ·
`skills/pickup/` **1.1.0** · `scripts/pickup-guidance.mjs` **1.1.0** ·
`hooks/pickup-guidance.mjs` **1.0.0** · `hooks/pickup-guidance.opencode.js` **1.1.0** ·
`harness-enforcement.md` **1.4.0** · `harness-enforcement.opencode.md` **1.3.0**.
**Scope:** install the `risk:` vocabulary, the records-held risk→class rule, the equivalence
gate, `/pickup`, and the first-prompt hook; then move this repo's `impl:` consumers and its
label-writing probe to the rule. `impl:` is not retired until the equivalence check is zero.

**Verified checkout:** `origin/main` at **`e33294ed3fd7ae0833a793558a88aa76bc915539`** (fetched
2026-11-07). The greps read the fetched ref, not a possibly dirty working tree.

---

## Why

This repo is an early adopter with a high escalation rate driven by one gateway epic. The risk
labels give the backlog a fact vocabulary the rule can read, and the interactive guidance targets
the operator sessions where most work starts. The equivalence check is the only thing that makes
a mis-tiered issue or a wrong rule loud before `impl:` is retired.

## The `impl:` consumers — verified at `e33294e`

```bash
git -C ~/repos/HopSkipInc/analytics-infrastructure fetch origin
git -C ~/repos/HopSkipInc/analytics-infrastructure rev-parse origin/main
git -C ~/repos/HopSkipInc/analytics-infrastructure grep -n "impl:" origin/main -- \
  AGENTS.md \
  scripts/check-issue-routing.mjs \
  .github/workflows/issue-routing-probe.yml \
  .github/workflows/function-load-probe.yml
```

Results that matter (line numbers at `e33294e`):

| Order | Consumer / producer | Path | What it does | Move to |
|---|---|---|---|---|
| 1 | Routing lint | `scripts/check-issue-routing.mjs:158,365,450-540` | Reads `impl:` labels and `## Impl tier`, validates the rules | Re-sync to **1.6.0**; adds R10–R12 and `## Risk`. |
| 1 | Open-pass wiring | `.github/workflows/issue-routing-probe.yml:11` | Runs the lint on a schedule | No path change; keep it a scheduled probe, never a per-PR gate. |
| 2 | Function-load probe (**producer**) | `.github/workflows/function-load-probe.yml:122,181` | Creates issues carrying `impl:frontier` | Replace the hard-coded `impl:frontier` with the `risk:` labels the classifier proposes for that probe template; keep a derived `impl:` only while the transition requires it. A workflow that keeps writing the old verdict is a consumer that never moved. |
| 3 | Instruction contract | `AGENTS.md:93,97,98` | Tells agents to read the tier and stop if it exceeds capability | Rewrite to the risk vocabulary, `## Risk`, and `/pickup`. |
| 4 | Classifier / triage (**producers**) | `.claude/agents/routing-classifier.md`, `.claude/skills/routing-triage/` | Propose tiers and apply them | Re-sync to **1.4.0** / **1.8.0**; they propose risk labels with reasons and still propose `impl:` during the transition. |

No other code in the checkout reads `impl:` as a routing label. The ADR mentions in
`docs/adr/017`, `022`, `040` and `051` are prose references, not consumers; update one only if the
sentence asserts current routing behaviour. `docs/agent-routing.md` is the policy copy, not a
consumer.

The order is: validator and its wiring, the probe that writes labels, the instruction contract,
then the producer prompts. `impl:` retires only after the probe no longer writes it and the
equivalence check is zero.

## What to do

### 1. Re-sync the templates

- `templates/agent-routing.md` **1.21.0** → `docs/agent-routing.md`, byte-identical.
- `templates/agent-routing-records.md` **1.2.0** → **add §8 by hand** to
  `docs/agent-routing-records.md`; never `cp` over the records file. Record the rule and the
  review row.
- `templates/issue-authoring.md` **1.6.0** → `docs/issue-authoring.md`.
- `templates/scripts/check-issue-routing.mjs` **1.6.0** → `scripts/check-issue-routing.mjs`, byte-identical.
- `templates/scripts/check-routing-equivalence.mjs` **1.1.0** → `scripts/check-routing-equivalence.mjs`.
- `templates/skills/routing-triage/` **1.8.0** → `.claude/skills/routing-triage/`.
- `templates/agents/routing-classifier.md` **1.4.0** → `.claude/agents/routing-classifier.md`; for
  opencode v2, install the opencode variant **1.5.0** globally instead. The Claude pin is unchanged; the opencode v2 pin resolves to `hopskip-gateway/deepseek-v4-1-flash` (frontier per records §1).
- `templates/skills/pickup/` **1.1.0** → `.claude/skills/pickup/` (Claude Code) and
  `.opencode/skills/pickup/` (opencode v2).
- `templates/scripts/pickup-guidance.mjs` **1.1.0** → `scripts/pickup-guidance.mjs`.
- `templates/hooks/pickup-guidance.mjs` **1.0.0** → `.claude/hooks/pickup-guidance.mjs`; add the
  `hooks.UserPromptSubmit` entry from `templates/harness-enforcement.md` **1.4.0**.
- `templates/hooks/pickup-guidance.opencode.js` **1.1.0** → `.opencode/plugins/pickup-guidance.js`.

**The hook is opt-out per engineer.** Claude Code: `"pickupGuidance": false` in
`~/.claude/settings.json` (or `"disableAllHooks": true`). opencode v2: `PICKUP_HOOK=off` or
`"-pickup-guidance"` in the user's `~/.config/opencode/opencode.json(c)` `plugins` array.
`/pickup` stays available.

### 2. Create the five risk labels

```bash
gh label create "risk:silent-failure"  --color FBCA04 --description "A wrong result looks correct"
gh label create "risk:boundary"        --color D93F0B --description "Security, isolation or tenancy boundaries, including credential handling"
gh label create "risk:irreversible"    --color B60205 --description "A wide blast radius, or hard to reverse, including dropping or renaming migrations"
gh label create "risk:new-abstraction" --color 5319E7 --description "Requires inventing an abstraction the codebase does not have"
gh label create "risk:uncovered"       --color C2E0C6 --description "No existing test covers the surface being changed"
```

### 3. Backfill with routing-triage

Run `/routing-triage` through the pinned classifier. Every open issue gets `risk:` labels, a
`## Risk` section, and (during the transition) its `impl:` tier. Show disputed risk calls before
applying them. `risk:uncovered` carries a coverage record.

### 4. Run the lint

```bash
node scripts/check-issue-routing.mjs
```

No R10/R11/R12 findings; a SKIPPED is not a pass.

### 5. Run the equivalence check and resolve every difference

```bash
node scripts/check-routing-equivalence.mjs
```

Resolve each difference on the record — issue mis-tiered (relabel with the reason) or rule wrong
(change §8) — and re-run until it prints `OK` and exits 0. Record the counts. Do not retire
`impl:` or move a consumer before zero.

### 6. Move the consumers in the order above

The function-load probe is the one producer here: it must stop writing a hard-coded
`impl:frontier`. Run the classifier on the probe's issue template and use the `risk:` labels it
proposes; keep the derived `impl:` only while the transition requires it. Update the instruction
contract and re-sync the producer prompts. Do not remove the `impl:` label from the backlog
until the probe no longer writes it and the equivalence check is still zero. The routing lint is
also a consumer: while it still requires an `impl:` label for an `## Impl tier` block, keep
writing the label.

### 7. Demonstrate `/pickup` and the hook

Use one frontier issue and one standard issue from this repo. In both harnesses:

- `/pickup <issue>` shows the required class and switch command;
- the first prompt naming the issue shows the guidance once; a later prompt shows nothing;
- `PICKUP_HOOK=off` / `"pickupGuidance": false` suppresses it.

Paste the transcripts. The hook never blocks, rewrites, or switches.

## Verification — observe the effect

```bash
node scripts/check-routing-equivalence.mjs   # OK, exit 0, zero differences
node scripts/check-issue-routing.mjs          # no R10/R11/R12 findings
node --test test/*.test.mjs                   # this repo's suite stays green
```

Do not grep a file this prompt just wrote. The probe's effect is verified by reading the issues it
creates next run (they carry `risk:` labels, not a hard-coded `impl:frontier`), and the
interactive guidance by the transcripts above. The route table's opencode column is **v2**
(`hopskip-gateway/<model-id>`); a v1 `opencode/...` command is a failure.

## Not in scope

- Retiring `impl:` in repo-governance.
- Deciding this repo's frontier target; the ratio reading is recorded, not targeted, until the
  gateway epic is decomposed.
- Merging this prompt's changes.

## Definition of Done

- [ ] `docs/agent-routing.md` byte-identical; records §8 added by hand
- [ ] The five risk labels exist; every open issue has `risk:` labels and `## Risk`
- [ ] The function-load probe no longer writes a hard-coded `impl:frontier`
- [ ] `check-issue-routing.mjs` reports no R10/R11/R12 findings
- [ ] `check-routing-equivalence.mjs` exits 0; counts recorded
- [ ] Consumers moved in order; the instruction contract updated
- [ ] `/pickup` and the hook demonstrated in both harnesses; opt-outs documented
- [ ] `Fixes #135` in the PR description
