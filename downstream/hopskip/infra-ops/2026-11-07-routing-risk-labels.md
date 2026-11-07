# Routing: risk labels, the records-held rule, and interactive pickup — infra-ops (2026-11-07)

**Client:** Hopskip (internal)
**Source:** repo-governance — #135, templates `agent-routing.md` **1.21.0** ·
`agent-routing-records.md` **1.2.0** · `issue-authoring.md` **1.6.0** ·
`scripts/check-issue-routing.mjs` **1.6.0** · `scripts/check-routing-equivalence.mjs` **1.0.0** ·
`skills/routing-triage/` **1.8.0** · `agents/routing-classifier.md` **1.4.0** ·
`skills/pickup/` **1.1.0** · `scripts/pickup-guidance.mjs` **1.0.0** ·
`hooks/pickup-guidance.mjs` **1.0.0** · `hooks/pickup-guidance.opencode.js` **1.0.0** ·
`harness-enforcement.md` **1.4.0** · `harness-enforcement.opencode.md` **1.3.0**.
**Scope:** install the routing set from scratch — the `risk:` vocabulary, the records-held
risk→class rule, the equivalence gate, `/pickup`, and the first-prompt hook — then backfill the
backlog and run the transition through to zero differences.

**Verified checkout:** `origin/main` at **`1bd668114a72e8c4ea32cf7936d6f2c009a7ab56`** (fetched
2026-11-07). The greps read the fetched ref, not the working tree.

---

## Why

This repo is a `core`-class adopter: it has `CLAUDE.md` and the deploy gates, but no routing
policy, no `impl:` labels, and no lint. Issue #135 explicitly includes it, so this prompt adds the
routing rows to the repo — a `full`-class slice in a `core` repo, on the record.

There is nothing to migrate: the `impl:` consumer list is empty. The work is installation, a
bounded triage backfill, the equivalence check, and the interactive guidance. With no consumer,
`impl:` can be retired as soon as the equivalence check is zero and the producers stop writing it.

## The `impl:` consumers — verified at `1bd6681`

```bash
git -C ~/repos/HopSkipInc/infra-ops fetch origin
git -C ~/repos/HopSkipInc/infra-ops rev-parse origin/main
git -C ~/repos/HopSkipInc/infra-ops grep -n "impl:" origin/main -- CLAUDE.md
```

**Result: zero hits.** There is no consumer to move. The only read of the routing text after this
prompt is the instruction contract (`CLAUDE.md`), which is updated by the install; the classifier
and triage skill are producers, not consumers.

Because the repo has no `impl:` labels today, the equivalence check will initially see every open
issue as untiered. Step 3 adds the risk labels and the transition `impl:` tier; step 5 then
requires zero differences. A first run that reports untiered issues is the expected starting
state, not a failure — resolve it by triaging, then re-run.

## What to do

### 1. Install the templates

- `templates/agent-routing.md` **1.21.0** → `docs/agent-routing.md`; `templates/agent-routing-records.md`
  **1.2.0** → `docs/agent-routing-records.md` (new file, fill §1–§8 for this repo; never copy another
  repo's records).
- `templates/issue-authoring.md` **1.6.0** → `docs/issue-authoring.md`.
- `templates/scripts/check-issue-routing.mjs` **1.6.0** → `scripts/check-issue-routing.mjs`, byte-identical.
- `templates/scripts/check-routing-equivalence.mjs` **1.0.0** → `scripts/check-routing-equivalence.mjs`.
- `templates/skills/routing-triage/` **1.8.0** → `.claude/skills/routing-triage/`.
- `templates/agents/routing-classifier.md` **1.4.0** → `.claude/agents/routing-classifier.md`; for
  opencode v2, install the opencode variant globally instead.
- `templates/skills/pickup/` **1.1.0** → `.claude/skills/pickup/` and/or `.opencode/skills/pickup/`.
- `templates/scripts/pickup-guidance.mjs` **1.0.0** → `scripts/pickup-guidance.mjs`.
- `templates/hooks/pickup-guidance.mjs` **1.0.0** → `.claude/hooks/pickup-guidance.mjs`; add the
  `hooks.UserPromptSubmit` entry from `templates/harness-enforcement.md` **1.4.0**.
- `templates/hooks/pickup-guidance.opencode.js` **1.0.0** → `.opencode/plugins/pickup-guidance.js`.
- Add the scheduled open pass from `templates/workflows/issue-routing-probe.yml`.

Update `CLAUDE.md` with the risk vocabulary, the `## Risk` section, and the `/pickup` stop rule
(the AGENTS.md section in the policy). This repo has no `AGENTS.md`; update the existing
instruction file and do not create a second canonical file.

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

Run `/routing-triage` through the pinned classifier on a bounded set first (15–30 issues),
then widen. Every open issue gets `risk:` labels, a `## Risk` section, and — during the
transition — an `impl:` tier. Show disputed risk calls before applying them. `risk:uncovered`
carries a coverage record.

### 4. Run the lint

```bash
node scripts/check-issue-routing.mjs
```

No R10/R11/R12 findings; a SKIPPED is not a pass.

### 5. Run the equivalence check and resolve every difference

```bash
node scripts/check-routing-equivalence.mjs
```

On the first run every issue is untiered or differs. Resolve each on the record — issue
mis-tiered (relabel with the reason) or rule wrong (change §8) — and re-run until it prints `OK`
and exits 0. Record the counts. With no consumer, after zero, record the decision to stop writing
`impl:` and remove it from the producer prompts.

### 6. Demonstrate `/pickup` and the hook

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
result, not by the workflow file's existence; the interactive guidance by the transcripts. The
route table's opencode column is **v2** (`hopskip-gateway/<model-id>`); a v1 `opencode/...`
command is a failure.

## Not in scope

- Retiring `impl:` in repo-governance.
- Flipping this repo to `AGENTS.md`; that is the #130 prompt's work.
- Re-deciding the repo's `core` adoption class. This prompt adds a `full`-class routing slice on
  the record because #135 names this repo; the rest of the `core` depth is unchanged.
- Merging this prompt's changes.

## Definition of Done

- [ ] `docs/agent-routing.md` byte-identical; `docs/agent-routing-records.md` filled for this repo
- [ ] The five risk labels exist; every open issue has `risk:` labels and `## Risk`
- [ ] `check-issue-routing.mjs` reports no R10/R11/R12 findings
- [ ] `check-routing-equivalence.mjs` exits 0; counts recorded; `impl:` retirement recorded
- [ ] The scheduled open pass is wired
- [ ] `CLAUDE.md` carries the risk vocabulary and the `/pickup` stop rule
- [ ] `/pickup` and the hook demonstrated in both harnesses; opt-outs documented
- [ ] `Fixes #135` in the PR description
