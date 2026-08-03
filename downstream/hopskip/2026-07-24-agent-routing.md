# Governance update: agent routing tiers (2026-07-24)

**Applies to:** all governed repos with a GitHub backlog worked by agents
**Policy version to install:** whatever `templates/agent-routing.md` currently stamps — read it,
do not assume. This prompt deliberately does not name a version: a prompt that hardcodes one
goes stale the moment the policy moves, which is the same drift the version stamps exist to
prevent, one level up.
**Templates:** `templates/agent-routing.md`, `templates/agent-routing-records.md`, `templates/skills/routing-triage/SKILL.md`,
`templates/agents/routing-classifier.md` (Claude Code), `templates/agents/routing-classifier.opencode.md` (opencode),
`templates/routing-calibration-protocol.md`, `templates/issue-authoring.md` (updated)
**Status of this policy:** candidate, revised twice on its first day from two live runs. Report
friction rather than working around it.

## Why

Issues are increasingly implemented by autonomous agents of varying capability, and nothing in
the backlog tells an agent whether an issue is within its competence. The failure mode is
asymmetric: a weak model confidently attempts work it will botch, and the worst botches fail
**silently** — an isolation change that looks green but leaks, a scope change that quietly
returns nothing.

This adds an `impl:` tier to every issue, plus the reason, so a dispatcher can route mechanical
work cheaply and hold the dangerous work back.

**Run this with a frontier-class model.** Triage is a frontier task — the router has to be
smarter than the routed. A standard-class model will systematically under-call the tiers it is
about to be handed.

---

## Step A — which path are you on?

```bash
ls docs/agent-routing.md 2>/dev/null && grep -m1 '^\*\*Version:' docs/agent-routing.md
```

Compare it against the template's stamp:

```bash
head -1 ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md
```

- **No file** → you are **bootstrapping**. Do steps 1–8.
- **Installed version behind the template** → you are **re-syncing**. Do steps 1, 2, then jump
  to *Re-sync backfill* at the bottom. The policy changed under the first two runs; some of
  your existing tiers were made against rules that no longer exist.
- **Installed version equals the template** → nothing to do here.

---

## Steps

**1. Install the policy first.** The skill is governed by `docs/agent-routing.md` *in this
repo* and reads it at Step 0. Copy it fresh — do not trust a copy already sitting there:

```bash
mkdir -p docs
cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md docs/agent-routing.md
grep -m2 -E '^\*\*Version:|^\*\*Last updated' docs/agent-routing.md
```

Record that version wherever you write up the run. A run split across two policy versions is
not internally consistent, and a triager cannot tell from the inside.

**2. Install the triage skill, its classifier agent, and the records form.** The first two, or neither works.
The classifier agent definition is **harness-specific** — install the one matching your
primary harness. If your team uses both harnesses, install both (they do not conflict —
different paths, same body):

```bash
# Skill (per-repo, both harnesses)
mkdir -p .claude/skills/routing-triage .claude/agents
cp ~/repos/HopSkipInc/repo-governance/templates/skills/routing-triage/SKILL.md \
   .claude/skills/routing-triage/SKILL.md

# Claude Code classifier (per-repo)
cp ~/repos/HopSkipInc/repo-governance/templates/agents/routing-classifier.md \
   .claude/agents/routing-classifier.md

# opencode classifier (global — one agent serves every repo on the machine)
mkdir -p ~/.config/opencode/agents
cp ~/repos/HopSkipInc/repo-governance/templates/agents/routing-classifier.opencode.md \
   ~/.config/opencode/agents/routing-classifier.md

# Records form (per-repo, never syncs after this — it is where YOUR records go)
cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing-records.md \
   docs/agent-routing-records.md
```

**`docs/agent-routing-records.md` is the one file here you own.** The policy is byte-identical
in every governed repo and gets overwritten on every re-sync; the records file is yours, never
synced, and holds your calibration set, model→class mapping, pin resolutions, and ratio
readings. Nothing upstream can reconstruct it.

**If your team runs opencode as the primary harness, the per-repo `.claude/agents/` install
is unnecessary** — opencode does not read Claude Code agent definitions, and the global agent
at `~/.config/opencode/agents/` is the one that binds. Install only the opencode variant.
The repo still needs `docs/agent-routing.md` (Step 1) — the policy is per-repo even when the
classifier is global.

**Restart opencode after installing the agent** — agent config is loaded at startup, not
hot-reloaded.

The skill runs at any model class; the **classification** is delegated to
`routing-classifier`, which pins its model in frontmatter so the harness resolves it at spawn.
That pin is the enforcement — asking a model to certify its own class does not work, because
the instruction is read by the thing it is meant to bind. The skill stops if the agent file is
missing rather than classifying inline, since an inline fallback would be invisible in the
output: the tiers would look identical.

In opencode, invoke the classifier with `@routing-classifier` or ask the primary agent to
delegate. The `mode: subagent` + `hidden: true` frontmatter means it is only ever spawned for
triage, never a primary agent.

Record the pinned model in `docs/agent-routing-records.md` — specifically **which model the
pin resolves to**, so a reviewer can check it against your class table without reading a
harness's model catalogue. Every pin must resolve to a model you list as `frontier`.

**3. Create the labels:**

```bash
gh label create "impl:standard" --color 0E8A16 --description "Any capable coding model can implement from the issue as written"
gh label create "impl:frontier" --color D93F0B --description "Frontier model may implement autonomously; non-frontier should not"
gh label create "impl:human"    --color B60205 --description "Needs a human in the loop regardless of model capability"
```

**If this repo has an isolation, tenancy, or credential boundary — create the `gate:` family
now.** Do not defer it. The trivial-diff-on-a-boundary case arrives in the first triage pass,
and without these labels every one of those issues files as `impl:human` and strands its
mechanical work:

```bash
gh label create "gate:human-approval" --color 5319E7 --description "Agent may prepare; a human owns the irreversible step"
gh label create "gate:human-review"   --color 5319E7 --description "Judgment call no test settles"
gh label create "gate:credentials"    --color 5319E7 --description "Agent structurally cannot hold the keys"
gh label create "gate:decision"       --color 5319E7 --description "Outcome should be recorded as a PDR/ADR by a person first"
```

**4. Choose the sample deliberately — this is where the first run went wrong.**

A bounded set drawn mostly from one recently-authored or recently-reviewed epic produces a
flattering spec ratio and a worthless baseline, because design review is exactly the process
that removes spec debt. Both first runs hit this.

- 15–30 issues, spanning **several `area:`/`theme:` families**, not one epic.
- If more than half traces to a single epic, either widen it or **refuse to report a spec
  ratio** and say the sample was curated.
- **Deliberately include issues carrying `needs-structure`.** Excluding them guarantees a low
  ratio and hides the exact population the metric exists to measure.
- Write the sample's composition into the run notes. A ratio without its sample is not a number.

**5. Run `/routing-triage`.** It will stop and ask about disputed calls, every `spec`/`both`
escalation, and split candidates.

Apply the results **from a reviewed batch file, not an ad-hoc shell loop.** Both live runs
produced scripting damage across live issues — a mangled label, a doubled heading — and neither
was a policy bug. Write the intended changes to a file, read it, then execute, then spot-check
three issues.

**6. Add the routing block to CLAUDE.md.** Template is at the end of `agent-routing.md`.
Note it points readers at `docs/agent-routing-records.md` for the mapping and calibration
examples, and at `docs/agent-routing.md` for the tier definitions.

**7. Install the routing validator.** The six Layer 2 rules now have a reference
implementation. It queries the GitHub API rather than parsing source, so it drops into this
repo unchanged regardless of language:

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-issue-routing.mjs scripts/
node scripts/check-issue-routing.mjs
```

Structural rules (one `impl:` label, a tier line, a declared kind) fail the build.
Contradiction rules (`status:ready` + spec-component, `needs-structure` + no spec component,
tier lowered with no body edit) warn — promote them to error once your backlog is clean, per
the WARN→FAIL convention. Wire it on a schedule, not per-PR: it is a backlog sweep, not a
diff check.

**7b. Record what you installed.** Add the `### Synced templates` table from
`templates/governance-sync-claude-section.md` to your CLAUDE.md and fill in the version of
every governance template this repo now carries. Without it neither side can tell when a
local copy has fallen behind — which is exactly what bit both runs on 2026-07-24.

**8. Record the application** in this repo's CLAUDE.md under `### Applied governance updates`,
including the policy version. Do not modify files in repo-governance.

---

## Re-sync backfill (repos that already triaged under 1.0.x–1.7.x)

Your existing tiers were assigned under rules that have since changed. Four passes:

1. **Backfill `both`.** The `both` kind did not exist. Any issue tiered `inherent` that also
   carries `needs-structure` is almost certainly `both` — your validator says it is
   under-specified and your triage said specification wouldn't help. Re-examine each:

   ```bash
   gh issue list --state open --limit 300 --label needs-structure --json number,labels \
     --jq '.[] | select([.labels[].name] | any(startswith("impl:"))) | .number'
   ```

2. **Backfill the decomposition record (new in 1.8.0).** Every escalation now carries either
   a split reference or a `Not splittable: <mechanism>` sentence in its tier line. Yours
   predate the rule and have neither, so the audit's decomposition signal reads zero for a
   backlog that may well have split issues in it — a split nobody wrote down is invisible to
   every downstream measurement.

   ```bash
   # Every escalation lacking a decomposition record
   node scripts/check-issue-routing.mjs 2>&1 | grep -E '\[R7\]|Decomposition census'
   ```

   Work the R7 findings first — those are the escalations that conceded a mechanical majority
   in their own tier line, and they are your highest-yield split candidates. Then sweep the
   rest: for each, either propose the split or write the sentence. **Do not bulk-append
   `Not splittable:` to clear the lint.** That converts a real finding into a rubber stamp,
   and it is the exact failure the `inherent`-is-the-flattering-call warning describes one
   level up. If you cannot name the mechanism in a sentence, the issue splits.

   Escalations already split under an earlier run need their *parent* tier lines edited to say
   so (`Split into #NNN, #NNN`) — the children carry `impl:standard` and are not the record.

3. **Split your records out of the policy file (new in 1.9.0) — do this FIRST, before any
   `cp`.** Through policy 1.8.0 your calibration set and model→class mapping lived inside
   `docs/agent-routing.md`, which the adoption check verifies is byte-identical to the
   template. Those instructions contradicted each other and yours has been failing that check
   ever since. **A `cp` over the combined file destroys your records with no diff to recover
   them from, and the calibration set has no upstream copy.**

   ```bash
   # Insurance first — cheap, and the records are unreconstructible.
   cp docs/agent-routing.md /tmp/agent-routing-combined.md

   # Find your record blocks.
   grep -n '^### Calibration set\|^| Class | Approved models' docs/agent-routing.md

   # Install the records form, move the blocks into it verbatim, THEN overwrite the policy.
   cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing-records.md docs/agent-routing-records.md
   # ... move blocks by hand ...
   cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md docs/agent-routing.md
   diff -q docs/agent-routing.md ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md
   ```

   Read `/tmp/agent-routing-combined.md` once more before deleting it. Anything in it that is
   neither template text nor a record you moved is a **local edit somebody made to the policy**
   — surface it rather than silently discarding it.

   While filling the records form, split your old mapping table in two: **class←model** (what a
   model is) and **model→harness route** (how each harness addresses it). And record what each
   classifier pin *resolves to*, then check it against the class table — a pin must resolve to a
   model you list as `frontier`, and verifying that shouldn't require reading a harness's model
   catalogue.

4. **Re-baseline the spec ratio.** If your first sample was a single epic, the number is not a
   baseline. Run a second pass over a general-backlog sample and report that one instead, and
   mark the original as sample-limited rather than deleting it.

   Report the **frontier ratio and decomposition debt** (escalations ÷ distinct surfaces they
   name) alongside it. If more than half your set escalates, lead with that: the finding is
   decomposition, not risk. A repo does not have thirty dangerous surfaces — it has three,
   sliced into thirty component-shaped issues. Your ratio target is per-repo and lives in the
   client governance record, not in the policy.

5. **Mark the calibration set provisional** if it was built from open issues — head it
   `Calibration set (provisional — built from open issues on the bootstrap run, YYYY-MM-DD)`.
   Promote rows to confirmed as issues close and outcomes confirm the call.

---

## Verifiable outcomes

```bash
# Policy is present and byte-identical to the template. This check is only meaningful
# from policy 1.9.0 on — before that, records lived in this file and it could never pass.
diff -q docs/agent-routing.md ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md && echo OK

# Records live in their own file and carry no template text
test -f docs/agent-routing-records.md && echo OK
grep -q 'Policy version these records were written against' docs/agent-routing-records.md && echo OK

# Every classifier pin resolves to a model the class table calls frontier
grep -A6 '^| Harness | Pin file' docs/agent-routing-records.md

# Labels exist
gh label list --limit 200 | grep -c '^impl:'                       # → 3

# Skill AND classifier agent installed — the skill refuses to run without the agent
test -f .claude/skills/routing-triage/SKILL.md && echo OK

# Claude Code classifier (per-repo) — skip if your team runs opencode only
test -f .claude/agents/routing-classifier.md && grep -q '^model:' .claude/agents/routing-classifier.md && echo OK
head -1 .claude/agents/routing-classifier.md | grep -q '^---$' && echo "OK frontmatter is first line"

# opencode classifier (global) — skip if your team runs Claude Code only
test -f ~/.config/opencode/agents/routing-classifier.md && grep -q '^model:' ~/.config/opencode/agents/routing-classifier.md && echo OK
grep -q '^mode: subagent' ~/.config/opencode/agents/routing-classifier.md && echo "OK subagent mode"

# At least 15 issues carry a tier
gh issue list --state open --limit 300 --json number,labels \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for i in d if any(l['name'].startswith('impl:') for l in i['labels'])))"
# → >= 15

# Every escalated issue declares a kind
gh issue list --state open --limit 300 --label impl:frontier --json number,body \
  | python3 -c "
import sys,json,re
bad=[i['number'] for i in json.load(sys.stdin) if not re.search(r'\b(spec|inherent|both)\b',i.get('body') or '')]
print('missing kind:',bad)"
# → missing kind: []

# Every escalation carries a decomposition record (policy 1.8.0+)
node scripts/check-issue-routing.mjs 2>&1 | grep 'Decomposition census'
# → "undeclared" should be 0; any non-zero count is the backfill still owed

# Contradiction check: under-structured but tiered without a spec component
gh issue list --state open --limit 300 --label needs-structure --json number,body,labels \
  | python3 -c "
import sys,json,re
d=json.load(sys.stdin)
bad=[i['number'] for i in d
     if any(l['name'].startswith('impl:') for l in i['labels'])
     and not re.search(r'\b(spec|both)\b', i.get('body') or '')]
print('contradictions:',bad)"
# → contradictions: []   (or each one re-examined and justified)

# Calibration set exists and declares whether it is provisional
grep -qi 'calibration set' docs/agent-routing.md && echo OK

# CLAUDE.md carries the agent contract
grep -q 'impl:' CLAUDE.md && echo OK
```

## Report back

- **Policy version** you installed and ran against.
- **Sample composition** — how many issues, spanning how many areas, what fraction from a
  single epic, and how many carried `needs-structure`. Report this *before* the ratio.
- **Tier distribution broken down by kind.** `9 frontier` is not a reportable number;
  `9 frontier — 3 spec, 4 inherent, 2 both` is.
- **Spec-escalation ratio**, measured on the classification, before responses. Three numbers:
  classified `spec`-component, resolved by rewrite, resolved by split.
- **Frontier ratio against your repo's target**, plus **decomposition debt** (escalations ÷
  distinct surfaces). Report the ratio *after* the sample composition, never before it.
- **Splits: proposed, accepted, declined** — and the count of escalations carrying a
  `Not splittable:` statement. A run where nothing split and everything was declared
  inseparable is either a genuinely indivisible backlog or a rule that wasn't applied; say
  which you believe. Also note whether the tells (`and` in the title, a mechanical-majority
  hedge, AC changing character partway down) would have caught the splits at authoring time
  instead of at triage.
- **Anything the tiers, kinds, or `gate:` family could not express.** Highest-value item you
  can send back; two template revisions on day one both came from exactly this.
- **Scripting damage**, if any. It is not a policy bug and it is still worth reporting — it is
  why the batch-file instruction exists.
