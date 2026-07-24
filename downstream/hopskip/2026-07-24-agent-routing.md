# Governance update: agent routing tiers (2026-07-24)

**Applies to:** all governed repos with a GitHub backlog worked by agents
**Policy version to install:** `agent-routing.md` **1.2.0** — check the header before you start
**Templates:** `templates/agent-routing.md`, `templates/skills/routing-triage/SKILL.md`,
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

- **No file** → you are **bootstrapping**. Do steps 1–8.
- **File present, version < 1.2.0** → you are **re-syncing**. Do steps 1, 2, then jump to
  *Re-sync backfill* at the bottom. The policy changed under the first two runs; some of your
  existing tiers were made against rules that no longer exist.
- **File present at 1.2.0** → nothing to do here.

---

## Steps

**1. Install the policy first.** The skill is governed by `docs/agent-routing.md` *in this
repo* and reads it at Step 0. Copy it fresh — do not trust a copy already sitting there:

```bash
mkdir -p docs
cp ~/repos/greg/repo-governance/templates/agent-routing.md docs/agent-routing.md
grep -m2 -E '^\*\*Version:|^\*\*Last updated' docs/agent-routing.md
```

Record that version wherever you write up the run. A run split across two policy versions is
not internally consistent, and a triager cannot tell from the inside.

**2. Install the triage skill:**

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

**7. Wire the validator rules.** Your issue-structure workflow can mechanically catch what is
currently manual — see the Layer 2 table in `templates/issue-authoring.md`. Wire these two
first, because they catch the two ways the taxonomy quietly stops meaning anything:

- `needs-structure` present **and** tiered without a `spec` component → contradiction.
- `impl:` label changed with no body edit in the same window → ungrounded downgrade.

**8. Record the application** in this repo's CLAUDE.md under `### Applied governance updates`,
including the policy version. Do not modify files in repo-governance.

---

## Re-sync backfill (repos that already triaged under 1.0.x / 1.1.x)

Your existing tiers were assigned under rules that have since changed. Three passes:

1. **Backfill `both`.** The `both` kind did not exist. Any issue tiered `inherent` that also
   carries `needs-structure` is almost certainly `both` — your validator says it is
   under-specified and your triage said specification wouldn't help. Re-examine each:

   ```bash
   gh issue list --state open --limit 300 --label needs-structure --json number,labels \
     --jq '.[] | select([.labels[].name] | any(startswith("impl:"))) | .number'
   ```

2. **Re-baseline the spec ratio.** If your first sample was a single epic, the number is not a
   baseline. Run a second pass over a general-backlog sample and report that one instead, and
   mark the original as sample-limited rather than deleting it.

3. **Mark the calibration set provisional** if it was built from open issues — head it
   `Calibration set (provisional — built from open issues on the bootstrap run, YYYY-MM-DD)`.
   Promote rows to confirmed as issues close and outcomes confirm the call.

---

## Verifiable outcomes

```bash
# Policy is present, readable from inside the repo, and current
test -f docs/agent-routing.md && grep -q 'Version:\*\* 1\.2\.0' docs/agent-routing.md && echo OK

# Labels exist
gh label list --limit 200 | grep -c '^impl:'                       # → 3

# Skill installed
test -f .claude/skills/routing-triage/SKILL.md && echo OK

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
- **Splits performed** — and whether the tells (`and` in the title, AC changing character
  partway down) would have caught them at authoring time instead.
- **Anything the tiers, kinds, or `gate:` family could not express.** Highest-value item you
  can send back; two template revisions on day one both came from exactly this.
- **Scripting damage**, if any. It is not a policy bug and it is still worth reporting — it is
  why the batch-file instruction exists.
