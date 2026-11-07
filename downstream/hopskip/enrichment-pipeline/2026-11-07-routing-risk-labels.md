# Routing: risk labels, the records-held rule, and interactive pickup — enrichment-pipeline (2026-11-07)

**Client:** Hopskip (internal)
**Source:** repo-governance — #135, templates `agent-routing.md` **1.21.0** ·
`agent-routing-records.md` **1.2.0** · `issue-authoring.md` **1.6.0** ·
`scripts/check-issue-routing.mjs` **1.6.0** · `scripts/check-routing-equivalence.mjs` **1.1.0** ·
`skills/routing-triage/` **1.8.0** · `agents/routing-classifier.md` **1.4.0** ·
`skills/pickup/` **1.1.0** · `scripts/pickup-guidance.mjs` **1.1.0** ·
`hooks/pickup-guidance.mjs` **1.0.0** · `hooks/pickup-guidance.opencode.js` **1.1.0** ·
`harness-enforcement.md` **1.4.0** · `harness-enforcement.opencode.md` **1.3.0**.
**Scope:** install the `risk:` vocabulary, the records-held risk→class rule, the equivalence
gate, `/pickup`, and the first-prompt hook; move the repo's producer prompts to the new output;
wire the open-pass lint. `impl:` is not retired until the equivalence check is zero.

**Verified checkout:** `origin/main` at **`12a2fb8ef4602264a329a271c910c32440d9eaf2`** (fetched
2026-11-07). The greps read the fetched ref, not the working tree.

---

## Why

This repo already carries the routing policy and a routing lint, but the skill and classifier
still propose a bare `impl:` tier, and the open-pass lint is not wired anywhere. PDR-011 puts the
risk facts in the labels and the rule in records, so the triage run must produce facts, the
equivalence check must prove the tiers, and the interactive engineer must see the class before
the first edit.

## The `impl:` consumers — verified at `12a2fb8`

```bash
git -C ~/repos/HopSkipInc/enrichment-pipeline fetch origin
git -C ~/repos/HopSkipInc/enrichment-pipeline rev-parse origin/main
git -C ~/repos/HopSkipInc/enrichment-pipeline grep -n "impl:" origin/main -- \
  CLAUDE.md scripts/check-issue-routing.mjs .github/workflows/
```

Results that matter (line numbers at `12a2fb8`):

| Order | Consumer / producer | Path | What it does | Move to |
|---|---|---|---|---|
| 1 | Routing lint | `scripts/check-issue-routing.mjs:138,277,341-431` | Reads `impl:` labels and `## Impl tier`, validates the rules | Re-sync to **1.6.0**; adds R10–R12 and `## Risk`. |
| 1 | Open-pass wiring | none found under `.github/workflows/` at this commit | The lint runs nowhere | Add the scheduled open pass from `templates/workflows/issue-routing-probe.yml`. A lint nothing runs is the failure this prompt is meant to prevent; wire it before declaring the install done. |
| 2 | Instruction contract | `CLAUDE.md:534,545` | Tells agents to read the tier and stop | Rewrite to the risk vocabulary, `## Risk`, and `/pickup`. This repo has no `AGENTS.md`; update the existing instruction file. Do not create a second canonical file. |
| 3 | Classifier / triage (**producers**) | `.claude/agents/routing-classifier.md`, `.claude/skills/routing-triage/` | Propose and apply tiers | Re-sync to **1.4.0** / **1.8.0**; they propose risk labels with reasons and still propose `impl:` during the transition. |

No other code in the checkout reads `impl:` as a routing label. The mentions in
`docs/agent-routing.md` and `docs/agent-routing-records.md` are policy and records, not consumers.
No workflow creates issues with an `impl:` label here.

The order is: the validator and its missing wiring, the instruction contract, then the producer
prompts. The newly installed lint still reads `impl:` (R1–R3) and requires it whenever an
`## Impl tier` block remains, so **do not stop writing `impl:` yet**. Record the retirement as
owed; it needs a lint that derives the tier from the rule. Keep `impl:` until that lands.

## What to do

### 1. Re-sync the templates

- `templates/agent-routing.md` **1.21.0** → `docs/agent-routing.md`, byte-identical.
- `templates/agent-routing-records.md` **1.2.0** → **add §8 by hand** to
  `docs/agent-routing-records.md`; never `cp` over the records file.
- `templates/issue-authoring.md` **1.6.0** → `docs/issue-authoring.md`.
- `templates/scripts/check-issue-routing.mjs` **1.6.0** → `scripts/check-issue-routing.mjs`, byte-identical.
- `templates/scripts/check-routing-equivalence.mjs` **1.1.0** → `scripts/check-routing-equivalence.mjs`.
- `templates/skills/routing-triage/` **1.8.0** → `.claude/skills/routing-triage/`.
- `templates/agents/routing-classifier.md` **1.4.0** → `.claude/agents/routing-classifier.md`; for
  opencode v2, install the opencode variant **1.5.0** globally instead.
- `templates/skills/pickup/` **1.1.0** → `.claude/skills/pickup/` and/or `.opencode/skills/pickup/`.
- `templates/scripts/pickup-guidance.mjs` **1.1.0** → `scripts/pickup-guidance.mjs`.
- `templates/hooks/pickup-guidance.mjs` **1.0.0** → `.claude/hooks/pickup-guidance.mjs`; add the
  `hooks.UserPromptSubmit` entry from `templates/harness-enforcement.md` **1.4.0**.
- `templates/hooks/pickup-guidance.opencode.js` **1.1.0** → `.opencode/plugins/pickup-guidance.js`.
- `templates/workflows/issue-routing-probe.yml` → `.github/workflows/issue-routing-probe.yml`
  (the missing wiring above).

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

No R10/R11/R12 findings. A SKIPPED is not a pass.

### 5. Run the equivalence check and resolve every difference

```bash
node scripts/check-routing-equivalence.mjs
```

Resolve each difference on the record — issue mis-tiered (relabel with the reason) or rule wrong
(change §8) — and re-run until it prints `OK` and exits 0. Record the counts. Do not retire
`impl:` before zero.

### 6. Move the instruction contract and producers, and wire the lint

Update `CLAUDE.md` to the risk vocabulary and the `/pickup` stop rule; re-sync the classifier and
triage skill. Add the scheduled open pass. The routing lint still reads `impl:` (R1–R3); do not stop writing it until a lint derives the
tier from the rule. Record the retirement as owed.

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

Do not grep a file this prompt just wrote. The open pass is proven by a scheduled run producing a
result (not by the workflow file's existence); the interactive guidance by the transcripts. The
route table's opencode column is **v2** (`hopskip-gateway/<model-id>`); a v1 `opencode/...`
command is a failure.

## Not in scope

- Retiring `impl:` in repo-governance.
- Flipping this repo to `AGENTS.md`; that is the #130 prompt's work. Update the existing
  instruction file and leave the flip to its own prompt.
- Merging this prompt's changes.

## Definition of Done

- [ ] `docs/agent-routing.md` byte-identical; records §8 added by hand
- [ ] The five risk labels exist; every open issue has `risk:` labels and `## Risk`
- [ ] The routing lint has a scheduled open-pass wiring
- [ ] `check-issue-routing.mjs` reports no R10/R11/R12 findings
- [ ] `check-routing-equivalence.mjs` exits 0; counts recorded
- [ ] `CLAUDE.md` and the producer prompts moved; `impl:` retirement recorded as owed (the lint still reads it)
- [ ] `/pickup` and the hook demonstrated in both harnesses; opt-outs documented
- [ ] `Fixes #135` in the PR description
