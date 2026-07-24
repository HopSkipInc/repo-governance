# Governance update: agent routing tiers (2026-07-24)

**Applies to:** all governed repos with a GitHub backlog worked by agents
**Templates:** `templates/agent-routing.md`, `templates/skills/routing-triage/SKILL.md`,
`templates/issue-authoring.md` (updated)
**Status of this policy:** candidate — this is its first run anywhere. Report friction rather
than working around it.

## Why

Issues are increasingly implemented by autonomous agents of varying capability, and nothing
in the backlog tells an agent whether an issue is within its competence. The failure mode is
asymmetric: a weak model confidently attempts work it will botch, and the worst botches fail
**silently** — an isolation change that looks green but leaks, a scope change that quietly
returns nothing.

This adds an `impl:` tier to every issue, plus the reason, so a dispatcher can route
mechanical work cheaply and hold the dangerous work back.

**Run this with a frontier-class model.** Triage is a frontier task — the router has to be
smarter than the routed. A standard-class model will systematically under-call the tiers it
is about to be handed.

## Steps

**1. Read the policy.** `~/repos/greg/repo-governance/templates/agent-routing.md`. The two
load-bearing rules are *tier by the failure mode, not the difficulty* and *a spec-limited
escalation is a bug report against the spec*. Everything else follows from those.

**2. Install the policy into this repo — do this before anything else.** The skill is
governed by `docs/agent-routing.md` *in this repo* and refuses to run without it. Anyone
running the skill must be able to read the policy, and not everyone has access to the
governance repo:

```bash
mkdir -p docs
cp ~/repos/greg/repo-governance/templates/agent-routing.md docs/agent-routing.md
```

Then copy the triage skill into this repo's skills directory (wherever the repo's existing
skills live — `.claude/skills/` or equivalent):

```bash
mkdir -p .claude/skills/routing-triage
cp ~/repos/greg/repo-governance/templates/skills/routing-triage/SKILL.md \
   .claude/skills/routing-triage/SKILL.md
```

**3. Create the labels:**

```bash
gh label create "impl:standard" --color 0E8A16 --description "Any capable coding model can implement from the issue as written"
gh label create "impl:frontier" --color D93F0B --description "Frontier model may implement autonomously; non-frontier should not"
gh label create "impl:human"    --color B60205 --description "Needs a human in the loop regardless of model capability"
```

**If this repo has an isolation, tenancy, or credential boundary, create the `gate:` family
now** — the "trivial diff on a boundary" case will arrive in your first triage pass, and
without it those issues file as `impl:human` and strand their mechanical work:

```bash
gh label create "gate:human-approval" --color 5319E7 --description "Agent may prepare; a human owns the irreversible step"
gh label create "gate:human-review"   --color 5319E7 --description "Judgment call no test settles"
gh label create "gate:credentials"    --color 5319E7 --description "Agent structurally cannot hold the keys"
gh label create "gate:decision"       --color 5319E7 --description "Outcome should be recorded as a PDR/ADR by a person first"
```

**4. Run `/routing-triage`** on a **bounded set** — 15–30 issues, `status:ready` first. Do
not attempt the whole backlog. The first run's job is to produce a calibration set and find
out where the taxonomy breaks, and a 200-issue pass produces 200 unexamined guesses.

The skill will stop and ask you about disputed calls and about every `spec` escalation. The
`spec` list is the highest-value output: each one is an issue that would be *mechanical* if
someone wrote one more sentence. Answer the ones you can, and let the skill rewrite the body
and drop the tier **in the same edit** — that ordering is the anti-gaming rule.

**5. Add the routing block to CLAUDE.md.** Template is at the end of `agent-routing.md`. It
tells agents to read the tier before implementing, gives them observable stop conditions, and
states that they may escalate a tier but never downgrade one.

**6. Update this repo's issue-authoring doc** with the new `impl:` label family and the
`## Impl tier` schema block — see the updated `templates/issue-authoring.md`.

**7. Record the application** in this repo's CLAUDE.md under `### Applied governance updates`.
Do not modify files in repo-governance.

## Verifiable outcomes

```bash
# The policy is readable from inside this repo (the skill refuses to run otherwise)
test -f docs/agent-routing.md && echo OK

# Labels exist
gh label list --limit 200 | grep -c '^impl:'                       # → 3

# The skill is installed
test -f .claude/skills/routing-triage/SKILL.md && echo OK

# At least 15 issues carry a tier
gh issue list --state open --limit 300 --json number,labels \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for i in d if any(l['name'].startswith('impl:') for l in i['labels'])))"
# → >= 15

# Every tiered issue above standard declares a kind in its body
gh issue list --state open --limit 300 --label impl:frontier --json number,body \
  | python3 -c "
import sys,json,re
bad=[i['number'] for i in json.load(sys.stdin) if not re.search(r'(spec|inherent)',i.get('body') or '')]
print('missing kind:',bad)"
# → missing kind: []

# The routing record exists with a calibration set
grep -q 'Calibration' docs/agent-routing.md && echo OK

# CLAUDE.md carries the agent contract
grep -q 'impl:' CLAUDE.md && echo OK
```

## Report back

These go to repo-governance as first-run calibration signal:

- **Tier distribution** across the triaged set, **broken down by kind.** `9 frontier` is not
  a reportable number; `9 frontier — 3 spec, 6 inherent` is. The kind split is the whole
  metric.
- **Spec-escalation ratio** — the baseline number. It should trend down in later cycles.
- **Splits performed** — escalated issues you divided into a mechanical half and a residue.
  This is the response most likely to be under-used; if you did none, say whether that is
  because none were divisible or because nobody asked.
- **How many `spec` escalations you fixed-and-downgraded on the spot.** If it was most of
  them, the kind split is earning its keep. If it was none, say so — that is a finding
  against the policy, not against the backlog.
- **Any issue the three tiers could not express.** This is the single most useful thing you
  can send back. The `gate:` family exists because three tiers could not express "small diff,
  human owns the merge" — if you hit another gap of that shape, it is a template bug.
- **Whether the heuristics table produced disputes the calibration set couldn't settle.**
