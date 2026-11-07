# Routing: risk labels, the records-held rule, and interactive pickup — ai-fleet (2026-11-07)

**Client:** Hopskip (internal)
**Source:** repo-governance — #135, templates `agent-routing.md` **1.21.0** ·
`agent-routing-records.md` **1.2.0** · `issue-authoring.md` **1.6.0** ·
`scripts/check-issue-routing.mjs` **1.6.0** · `scripts/check-routing-equivalence.mjs` **1.1.0** ·
`skills/routing-triage/` **1.8.0** · `agents/routing-classifier.md` **1.4.0** ·
`skills/pickup/` **1.1.0** · `scripts/pickup-guidance.mjs` **1.1.0** ·
`hooks/pickup-guidance.mjs` **1.0.0** · `hooks/pickup-guidance.opencode.js` **1.1.0** ·
`harness-enforcement.md` **1.4.0** · `harness-enforcement.opencode.md` **1.3.0**.
**Scope:** install the `risk:` vocabulary, the records-held risk→class rule, the equivalence
gate, `/pickup`, and the first-prompt hook; then move ai-fleet's `impl:` consumers to the rule
one at a time. `impl:` is not retired until the equivalence check is zero.

**Verified checkout:** `origin/master` at **`c530ad51021dbaa73c564001e2acad4bfc1277db`** (fetched
2026-11-07). The local working tree has unrelated edits; every grep below reads the fetched ref,
not the working tree.

---

## Why

ai-fleet is the primary reference implementation and the repo with the most `impl:` consumers.
PDR-011 makes the risk facts the record and the tier a derived value, so every consumer that reads
`impl:` today must read the rule instead — in a known order, with the equivalence check proving
each move.

The interactive path is the main road here: 88% of 382 merged PRs came from operator sessions
(ADR-088, citing `docs/merge-path.md`). `/pickup` and the first-prompt hook put the issue's
required class in front of the engineer before the first edit. They advise; they never gate.

## The `impl:` consumers — verified at `c530ad5`

Recorded commands (run from a clean checkout; the fetched ref is the source of truth):

```bash
git -C ~/repos/HopSkipInc/ai-fleet fetch origin
git -C ~/repos/HopSkipInc/ai-fleet rev-parse origin/master
git -C ~/repos/HopSkipInc/ai-fleet grep -n "impl:" origin/master -- \
  AGENTS.md \
  scripts/check-issue-routing.mjs \
  scripts/generate-roadmap.mjs \
  host/src/roadmap/parse.ts \
  web/src/components/fleets/NewFleetRunModal.tsx \
  web/src/components/roadmap/EpicTable.tsx \
  web/src/components/roadmap/types.ts \
  .github/workflows/routing-open-pass.yml \
  docs/adr/088-the-factory-loop-a-fleet-run-is-a-governed-machine-step-its-verdict-is-composed.md
```

Results that matter (line numbers at `c530ad5`):

| Order | Consumer | Path | What it reads | Move to |
|---|---|---|---|---|
| 1 | Routing lint | `scripts/check-issue-routing.mjs:138,277,351-421` | `impl:` labels, `## Impl tier`, the kind | Re-sync to **1.6.0** (byte-identical). Adds R10–R12 and the `## Risk` section; R1–R3 stay until the rule is the only reader. |
| 1 | Open-pass wiring | `.github/workflows/routing-open-pass.yml:7` | Runs the lint on a schedule | No path change; keep it a scheduled probe, never a per-PR gate. |
| 2 | Roadmap generator | `scripts/generate-roadmap.mjs:287-295,309,362,375` | The epic's `impl:` label value for the tier column | Read the rule's output for the epic's `risk:` labels (or the derived `impl:` during transition). The column's meaning does not change. |
| 2 | Roadmap data parser | `host/src/roadmap/parse.ts:78,411` | The generated `impl: tier` value and `impl: tier coverage` line | Keep reading the generated column; update only if the generator's output format changes. |
| 2 | Roadmap UI type | `web/src/components/roadmap/types.ts:71` | The `standard`/`frontier`/`human` tier value | Keep the type; the derived tier is the same value. |
| 2 | Roadmap UI filter | `web/src/components/roadmap/EpicTable.tsx:86,202,204,240` | The distinct tier values and the `impl:` filter label | Keep the filter; relabel it to “risk tier” if the wording should follow the rule. |
| 3 | Fleet issue picker | `web/src/components/fleets/NewFleetRunModal.tsx:219-222,592` | The selected issue's `impl:` label for the budget hint | Read the rule's output (or the derived tier); the hint text must not claim the label is the source once it is derived. |
| 4 | ADR-088 D5 Autopilot selector | `docs/adr/088-...md:116,197`; implementation #3068 | `impl:standard` and a well-formed `## Impl tier` as the selector input | Read the rule's output. D5 is a **planned** consumer; the selector test must accept a derived tier and refuse a missing/above-class one. |
| 4 | #2871 dispatch default | HopSkipInc/ai-fleet#2871 | Whether the issue's tier may set the fleet's `model_strategy` | Decide against the rule, not the label. This is the dispatch default that PDR-011 left downstream. |
| 5 | AGENTS.md routing section | `AGENTS.md:246,257,259` | The instruction contract: read the tier and stop if it exceeds the model | Rewrite to the risk vocabulary, the `## Risk` section, and the `/pickup` stop rule. |
| 6 | ADR-088 merge-yield slices | `docs/adr/088-...md:109,177` | Merged PRs and cost per merged PR sliced by `impl:` tier | Slice by the rule's output class, not the stored label. Update the report definition when the slice moves. |

The order is deliberate: the lint first, the generated roadmap data next (one producer, then its
parser and UI), then the interactive picker, then the planned selectors and reports, then the
instruction text. A consumer moves only after the equivalence check is zero, so a move never
reads a tier the rule cannot reproduce.

No other code in the checkout reads `impl:` as a label. Comments and tests that mention it are
not consumers; `host/src/enrichment/contact-state.ts:13` and
`host/scripts/pull-intake-fixture-corpus.ts:11` are comments, and
`web/src/components/fleets/NewFleetRunModal.test.tsx` / `scripts/roadmap-generator.test.mjs`
are tests for the consumers above.

## What to do

### 1. Re-sync the templates

- `templates/agent-routing.md` **1.21.0** → `docs/agent-routing.md`, byte-identical. The file is a
  registered pair; verify with `diff -q`.
- `templates/agent-routing-records.md` **1.2.0** → **do not overwrite** `docs/agent-routing-records.md`.
  That file is a record: add §8 (the risk→class rule) by hand, using the template's table, and
  record the repo's Rule and version in the review log. Never `cp` over it.
- `templates/issue-authoring.md` **1.6.0** → `docs/issue-authoring.md`.
- `templates/scripts/check-issue-routing.mjs` **1.6.0** → `scripts/check-issue-routing.mjs`, byte-identical.
- `templates/scripts/check-routing-equivalence.mjs` **1.1.0** → `scripts/check-routing-equivalence.mjs`.
- `templates/skills/routing-triage/` **1.8.0** → `.claude/skills/routing-triage/`.
- `templates/agents/routing-classifier.md` **1.4.0** → `.claude/agents/routing-classifier.md`; if the
  team runs opencode v2, install the opencode variant **1.5.0** at
  `~/.config/opencode/agents/routing-classifier.md` instead. The Claude pin and `# routing-class:`
  marker are unchanged; the opencode v2 pin resolves to
  `hopskip-gateway/deepseek-v4-1-flash` (frontier per records §1).
- `templates/skills/pickup/` **1.1.0** → `.claude/skills/pickup/` (Claude Code) and/or
  `.opencode/skills/pickup/` (opencode v2). The skill ID is `pickup`.
- `templates/scripts/pickup-guidance.mjs` **1.1.0** → `scripts/pickup-guidance.mjs`.
- `templates/hooks/pickup-guidance.mjs` **1.0.0** → `.claude/hooks/pickup-guidance.mjs`; add the
  `hooks.UserPromptSubmit` entry from `templates/harness-enforcement.md` **1.4.0**.
- `templates/hooks/pickup-guidance.opencode.js` **1.1.0** → `.opencode/plugins/pickup-guidance.js`;
  opencode v2 discovers it automatically.

**The hook is opt-out per engineer.** In Claude Code, `"pickupGuidance": false` in
`~/.claude/settings.json` (or `"disableAllHooks": true`) turns it off. In opencode v2,
`PICKUP_HOOK=off` or `"-pickup-guidance"` in the user's `~/.config/opencode/opencode.json(c)`
`plugins` array turns it off. `/pickup` stays available in both.

### 2. Create the five risk labels

Use PDR-011 decision 1's descriptions:

```bash
gh label create "risk:silent-failure"  --color FBCA04 --description "A wrong result looks correct"
gh label create "risk:boundary"        --color D93F0B --description "Security, isolation or tenancy boundaries, including credential handling"
gh label create "risk:irreversible"    --color B60205 --description "A wide blast radius, or hard to reverse, including dropping or renaming migrations"
gh label create "risk:new-abstraction" --color 5319E7 --description "Requires inventing an abstraction the codebase does not have"
gh label create "risk:uncovered"       --color C2E0C6 --description "No existing test covers the surface being changed"
```

### 3. Backfill with routing-triage

Run `/routing-triage` through the pinned `routing-classifier`. Every open issue gets its `risk:`
labels, its `## Risk` section, and — during the transition — its `impl:` tier and kind. Show the
disputed risk calls to the owner before applying anything. `risk:uncovered` carries a coverage
record (`Coverage gap: #N` or `Coverage: not testable — <mechanism>`).

### 4. Run the lint

```bash
node scripts/check-issue-routing.mjs
```

No R10/R11/R12 findings. A SKIPPED is not a pass. The existing R7/R8 findings are the backlog's
decomposition and coverage records, not this prompt's work; record them.

### 5. Run the equivalence check, and resolve every difference

```bash
node scripts/check-routing-equivalence.mjs
```

The first run will list differences. Resolve each on the record: either the issue was mis-tiered
(relabel it, with the reason) or the rule was wrong (change §8). Re-run until the command prints
`OK` and exits 0. **Do not retire `impl:` and do not move a consumer while any difference is
unresolved.** Record the counts (mis-tiered / rule-wrong) in the PR.

### 6. Move the consumers in the order above

For each consumer, change the read from the `impl:` label to the rule's output (or the derived
`impl:` during the transition), run its tests, and update the Synced-templates table. Do not
remove the `impl:` label from the backlog until every consumer has moved and the equivalence
check is still zero.

### 7. Demonstrate `/pickup` and the hook

Use one of ai-fleet's own issues (pick a `frontier` one and a `standard` one). In both harnesses:

- `/pickup <issue>` prints the required class and the harness switch command;
- the first prompt naming the issue shows the same guidance once;
- a later prompt in the same session shows nothing;
- `PICKUP_HOOK=off` (opencode v2) or `"pickupGuidance": false` (Claude Code) suppresses it.

Paste the transcripts in the PR. The hook must never block a prompt, rewrite it, or switch the
model.

## Verification — observe the effect, not the file

Run these and paste the output; **do not grep a file this prompt just wrote**:

```bash
node scripts/check-routing-equivalence.mjs   # OK, exit 0, zero unresolved differences
node scripts/check-issue-routing.mjs          # no R10/R11/R12 findings
node --test test/*.test.mjs                   # the repo's own suite stays green
```

The interactive evidence is the `/pickup` and first-prompt transcripts above. For ai-fleet the
route table's opencode column is **v2** (`hopskip-gateway/<model-id>`); a v1 `opencode/...` command
is a failure of this prompt.

## Not in scope

- Retiring `impl:` in repo-governance; that follows its own equivalence run.
- Merging this prompt's changes; the repo opens its own PR and a human merges.
- Re-litigating PDR-011's five labels. A sixth label needs a superseding PDR.

## Definition of Done

- [ ] `docs/agent-routing.md` byte-identical to the template; records §8 added by hand
- [ ] The five risk labels exist; every open issue has `risk:` labels and `## Risk`
- [ ] `check-issue-routing.mjs` reports no R10/R11/R12 findings
- [ ] `check-routing-equivalence.mjs` exits 0 with zero unresolved differences; counts recorded
- [ ] Every consumer in the table is moved, in order, and tested; no consumer still reads the raw label
- [ ] `/pickup` and the first-prompt hook demonstrated in both harnesses; opt-outs documented
- [ ] `Fixes #135` in the PR description
