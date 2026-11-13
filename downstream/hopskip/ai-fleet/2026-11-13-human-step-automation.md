# Human-step records: a gate names who decides, never who types — ai-fleet (2026-11-13)

**Client:** Hopskip (internal)
**Source:** repo-governance — issue #169, merged as PR #170; issue #173, PDR-012. PDR-011
**Amendment (2026-11-13)**. Templates: `agent-routing.md` **1.27.0** · `issue-authoring.md` **1.12.0** ·
`definition-of-done.md` **1.9.0** · `skills/routing-triage/SKILL.md` **1.11.1** ·
`agents/routing-classifier.md` **1.7.0** · `agents/routing-classifier.opencode.md` **1.8.0**.
**Scope:** install the `## Human step` record and the decide-vs-type gate semantics; backfill
a record on every open `gate:` issue; decompose the `impl:human` labels; run the pressure test
and report where the rule does not fit.

**Verified checkout:** `origin/master` at **`32ee2d6e705dc88f3266a0394c334d5a4f4d4a23`**
(read through the GitHub API on 2026-11-13; the local checkout is stale). Re-fetch and
re-verify before you start. Every count below was taken at that SHA and will have drifted.

---

## Why

The 2026-11-08 amendment narrowed the `gate:` family but left the central ambiguity intact:
"prod configuration set by hand" describes **where the checkpoint sits**, not **who performs
it**. Read literally, every repeatable step the agent was capable of doing stayed in human
hands behind a label that looked considered.

This amendment settles it:

- **A gate names who decides, never who types.** A human authorizes and reviews; the agent
  executes every step it is authorized to execute. An approval is recorded and bound to the
  exact plan or command.
- **Every gate carries a `## Human step` record** naming the human role and either
  `Automation: #N` (a repeatable step that should be scripted) or `Not automatable —
  <mechanism>` (a legal signature, a natural-person identity, a judgment no test settles, or
  a named policy).
- **`impl:human` is transitional and malformed alone.** It decomposes into a class, `gate:`
  labels, and the record. It is a claim that something is missing, not a resting state.
- **`gate:credentials` narrows** to identities a natural person must hold. A grantable service
  principal is an automation, not a credential gate.

ai-fleet is the pressure test: it has the most gates and the most `impl:human` labels, and its
deploy path is largely automated. The point of this prompt is to find where the rule is wrong
before it reaches the smaller repos.

## Current state at `32ee2d6` (verified)

| Artifact | Installed | Target |
|---|---|---|
| `docs/agent-routing.md` | 1.25.0 | **1.27.0** |
| `.claude/skills/routing-triage/SKILL.md` | 1.10.1 | **1.11.1** |
| `.claude/agents/routing-classifier.md` | 1.6.0 | **1.7.0** |
| `docs/issue-authoring.md` | adapted (no stamp) | hand-port the rule |
| `docs/definition-of-done.md` | adapted (`Last updated: 2026-06-10`) | hand-port the section |
| `AGENTS.md` routing block | hand-adapted | hand-port items 2 and 5 |
| `scripts/check-issue-routing.mjs` | 1.7.0 | **no change in this prompt** |

Open issues carrying a gate at `32ee2d6`, fetched 2026-11-13 (re-count before applying — the
number moves):

| Label | Open |
|---|---|
| `impl:human` | 22 |
| `gate:human-approval` | 90 |
| `gate:credentials` | 18 |
| `gate:decision` | 89 |
| `gate:human-review` | 36 |

**R16 is not wired.** The lint that checks this rule is repo-governance issue #168 and is not
in the installed script. Do not claim a green run proves the records are present; the
verification in step 5 reads the bodies.

## What ships

| Artifact | Version | Change |
|---|---|---|
| `docs/agent-routing.md` | 1.27.0 | `impl:human` narrowed; `gate:human-approval` and `gate:credentials` rewritten; §*The `## Human step` record*; §*Approval posture*; audit signal 7; AGENTS.md block updated |
| `skills/routing-triage/SKILL.md` | 1.11.1 | Step 3 appends `## Human step` for every applied gate; label descriptions updated |
| `agents/routing-classifier.md` | 1.7.0 | proposes the record and the `automation` / `not_automatable` fields |
| `agents/routing-classifier.opencode.md` | 1.8.0 | same, opencode pin |
| `issue-authoring.md` | 1.12.0 | `## Human step` joins the canonical schema and the rules |
| `definition-of-done.md` | 1.9.0 | a discovered repeatable manual step is scripted or filed in the same change |

No script changes, no migrations. The PDR amendment itself lives in repo-governance and never
syncs.

## Preflight — stop if the target is not live

Run every command below **from the ai-fleet checkout**. Assert it first:

```bash
git rev-parse --show-toplevel   # must be ~/repos/HopSkipInc/ai-fleet, not repo-governance
GOV=~/repos/HopSkipInc/repo-governance
git -C "$GOV" fetch origin
for f in templates/agent-routing.md templates/skills/routing-triage/SKILL.md; do
  git -C "$GOV" show origin/master:$f | grep -m1 -E "template:|^version:"
done
```

Expect `agent-routing.md v1.27.0` and `version: 1.11.1`. If either is behind, stop: the
prompt is being applied against a stale template. The triage skill 1.11.1 lands in the same
repo-governance change as this prompt; merge that first if it is still open.

The install step reads `origin/master` directly, not the repo-governance working tree, so a
dirty or stale checkout cannot ship a different revision than the one the preflight checked.

## What to do

### 1. Re-sync the policy and the producers

```bash
# still in the ai-fleet checkout; GOV points at repo-governance
GOV=~/repos/HopSkipInc/repo-governance
git -C "$GOV" show origin/master:templates/agent-routing.md \
  > docs/agent-routing.md
git -C "$GOV" show origin/master:templates/skills/routing-triage/SKILL.md \
  > .claude/skills/routing-triage/SKILL.md
git -C "$GOV" show origin/master:templates/agents/routing-classifier.md \
  > .claude/agents/routing-classifier.md
git -C "$GOV" show origin/master:templates/agent-routing.md \
  | diff -q - docs/agent-routing.md
```

Bump the Synced-templates rows to 1.27.0 / 1.11.1 / 1.7.0 in the same commit. If you use the
opencode harness, install `agents/routing-classifier.opencode.md` **1.8.0** into the global
`~/.config/opencode/agents/routing-classifier.md` and restart the harness; it is not a
per-repo file.

### 2. Record the approval posture

Read `templates/agent-routing-records.md` **1.3.0** §9 and append that section to
`docs/agent-routing-records.md` — **hand-edit; never `cp` a records file.** This repo is
`solo`:

```markdown
## 9. Approval posture

**Posture:** `solo`
**Set by:** Greg Leizerowicz
**Set on:** <the date you apply this>
**Decision:** repo-governance PDR-012
**Re-enable when:** a second engineer has merge rights on this repo; the first paying client
is live; or a production incident occurs whose cause a second reviewer would have caught.
**Hard core (still gated):** irreversible production data deletion/drop/rename; `gate:decision`
generally; money movement and external contracts or legal commitments; a credential the org
does not delegate to a service identity.
**Standing grants:** agents may run the release chain to every environment after CI and the
pre-deploy test plus the per-stage smokes pass; may flip config/flags and rotate service-scoped
keys the same way. No per-action approval.
**Substitute controls:** CI on every change; the release chain's pre-deploy test and per-stage
smokes (ADR-097); a tested rollback path; the evidence attached to the PR.
```

`solo` means the release chain's no-approval shape is the intended state, not a missing
control. **Do not add required reviewers.** The hard core still needs a `## Human step` record
when it appears on an issue.

### 3. Hand-port the adapted files

`docs/issue-authoring.md` and `docs/definition-of-done.md` are adapted, not byte-identical
copies. Add the rule to each; do not replace either file.

**`docs/issue-authoring.md`** — in the canonical schema, between `## Risk` and
`## Verifiable outcomes`:

```markdown
## Human step
<required when any `gate:` label is present; omit otherwise. One line per gate, naming the
 role the human holds — decides / signs / approves / holds the identity — and exactly one of:
   Automation: #N — the repeatable step this scripts
   Not automatable — <mechanism: legal signature / natural-person identity / no test settles it / named policy>
 A gate with no line is malformed. Never write "a human must do this": a gate names who
 decides, not who types.>
```

Then add this rule beside the existing `## Risk` rule:

> **Every `gate:` label has a `## Human step` line.** One line per gate, naming the human role
> and either `Automation: #N` (the issue that scripts the repeatable step) or
> `Not automatable — <mechanism>`. A gate with no record is malformed. `Not automatable` is
> the flattering call and carries the same burden as `Coverage: not testable` — name the
> mechanism. **A gate names who decides, never who types**; "a human must do this" is not a
> gate, it is an unscripted repeatable step. `impl:human` is transitional and malformed alone:
> it decomposes into `impl:<class>` plus `gate:` labels plus this record.

**`docs/definition-of-done.md`** — add this section after the intro, before `## By work type`:

> ## A manual step is a mitigation, not a permanent gate
>
> When implementation encounters a repeatable step that currently needs a human — a console
> click, a hand-run command, a per-environment switch — the change either scripts it in the
> same PR (when it is small and in scope) or files its `Automation: #N` issue and links it
> under `## Human step`. A merge that leaves a newly-discovered manual step unrecorded is not
> done.
>
> `Not automatable` is valid only when a mechanism the routing policy's `## Human step` rule
> names actually holds: a legal signature, an identity bound to a natural person, a judgment
> no test settles, or a named org policy not to delegate. "There was no time" is an
> `Automation: #N`, not a mechanism.

Bump the file's `Last updated` in the same edit.

**`AGENTS.md`** — in the `## Agent routing` block:

1. After the `risk:` paragraph, add:

```
Every `gate:` label carries a `## Human step` record naming either `Automation: #N` or
`Not automatable — <mechanism>`. **A gate names who decides, never who types**: a human
authorizes and reviews, and an agent executes every step it is authorized to execute.
```

2. Replace item 2 with:

```
2. If the tier exceeds your model capability (`standard` / `frontier`), do not implement.
   Comment with what you would need, and stop. `impl:human` is not a capability gate and
   never stands alone: it decomposes into a class, `gate:` labels, and a `## Human step`
   record. Any class may prepare the change and execute every authorized step; a human owns
   the decision and the merge.
```

3. Add item 5 after item 4's stopping paragraph:

```
5. A repeatable step you find yourself doing by hand — a console click, a hand-run command,
   a per-environment switch — is an automation gap, not a permanent human step. Script it
   in the change when it is small, or file its `Automation: #N` issue in the same change.
   Do not record it under `## Human step` as `Not automatable` unless a mechanism in that
   rule actually holds.
```

### 4. Update the label descriptions

The labels already exist, so `gh label create` in the skill will not change them. Run:

```bash
gh label edit "impl:human"           --description "Transitional; decomposes into a class plus gate: labels plus a ## Human step record"
gh label edit "gate:human-approval"  --description "A human authorizes a step outside the merge path; the agent executes it"
gh label edit "gate:credentials"     --description "Action is bound to a natural person's identity; a grantable service identity is an automation"
```

### 5. Backfill a record on every open gate

Build a reviewed batch file first — one row per issue: number, label, human role, and the
exact `## Human step` line. Have a human read it before applying. Do not run an ad-hoc loop
over 200+ issues; the triage skill's Step 3 batch-file pattern exists for this.

**How to classify a gate you find.** Ask what the human actually does:

| What the human does | Record |
|---|---|
| Performs a repeatable action — a console click, a hand-run command, a portal toggle | `Automation: #N` — file the issue that scripts it, in the same change |
| Approves a step the pipeline already executes | `Not automatable — the approval is the authority; execution is already automated by <workflow path>` |
| Signs as a legal representative | `Not automatable — the signature is the act; <why it cannot be delegated>` |
| Authenticates as a natural person (MFA/passkey/personal login) | `Not automatable — the identity is bound to a natural person; <what was not delegated>` |
| Decides content no test settles (UX, prose, a decision record) | `Not automatable — a value judgment no test settles` |
| Holds a credential the org could grant to a service identity | **Not this gate.** File the grant as `Automation: #N` and reclassify; a grantable identity is an automation |

Worked examples:

```markdown
## Human step
- gate:human-approval — the owner authorizes <the out-of-band prod action>; the agent executes
  it.
  Automation: #<new> — <the checked-in script or command that performs the action>; this gate
  drops to an approval on that command once it lands.
- gate:credentials — the provider key rotate is run under the operator's own login.
  Automation: #<new> — the rotation is scriptable through the provider API; the grant is
  already service-scoped.
```

**Do not cite the release chain as the human step.** At the verified SHA, `.github/workflows/
release.yml` promotes `dev → qa → demo → production` automatically and says in its own header
that "no stage carries an approval gate" (ADR-097). A `gate:human-approval` in this repo is an
out-of-band production action — a feature activation, a key rotation, a data operation — not
a deploy approval. Verify the action's actual command before writing the record; the example
above is deliberately a placeholder for that reason.

```markdown
## Human step
- gate:decision — the human owns the PDR at merge; the agent drafts it.
  Not automatable — the record's content is a value judgment; the merge is the signature.
```

**Do not relabel tiers in this pass.** Keep `impl:` and the `## Impl tier` line as they are.
For an `impl:human` issue, add the decomposing `gate:` label(s) and the record; the tier
relabel is a triage decision that follows the normal process. The consumers still read
`impl:` until the equivalence check is zero.

**In `solo`, an approval-only `gate:human-approval` no longer applies.** Where the only human
step was an environment approval, the owner may authorize one batch to clear the label; record
that authorization. An agent never clears a person-set gate without it, and the hard core keeps
its gate and its `## Human step` record.

**Never write a `## Human step` line that says only "a human must do this".** If that is the
honest answer, the step is an automation gap.

### 6. Verify the effect, not the files you just wrote

R16 is not installed, so the lint cannot see the record. Read the bodies:

```bash
gh issue list --repo HopSkipInc/ai-fleet --state open --limit 1000 \
  --json number,title,body,labels > /tmp/gates.json
jq -r '
  def gate_names: [.labels[].name | select(startswith("gate:"))];
  def record_lines: [.body | scan("(?m)^\\s*- gate:")];
  def form_lines: [.body | scan("(?m)^\\s+(Automation:|Not automatable — )")];
  .[] | select((gate_names | length) > 0)
  | {number,
     gates: (gate_names | length),
     records: (record_lines | length),
     forms: (form_lines | length),
     complete: ((record_lines | length) >= (gate_names | length)
                and (form_lines | length) >= (gate_names | length))}
  | "\(if .complete then "OK  " else "MISS" end) #\(.number) gates=\(.gates) records=\(.records) forms=\(.forms)"
' /tmp/gates.json | tee /tmp/gates-check.txt
grep '^MISS' /tmp/gates-check.txt || echo "all gate issues carry a record line and a form per gate"
grep -c '^OK' /tmp/gates-check.txt
```

A gate issue needs **one `- gate:` line per gate label** and **one form line per gate**
(`Automation:` or `Not automatable — `). This is a census, not a semantic check: a line can
still be wrong. Have a human read the batch file and spot-check three bodies. R16 is what
will make the semantic check mechanical; it is not installed, so do not describe this command
as a lint pass.

Then run what the repo already has:

```bash
node scripts/check-issue-routing.mjs
node scripts/check-routing-equivalence.mjs
```

Record the before/after **unresolved** count from the equivalence check. This prompt changes
no tiers, so the number should be unchanged; if it moved, say why.

### 7. Write the pressure-test report

Record it in this repo's own governance ledger and PR body — **never in repo-governance**.
Answer these:

1. **Gate counts by label, and records added.** Which gates were really approval-on-automated-
   execution, and how many of those did the old wording call "set by hand"?
2. **`Automation: #N` vs `Not automatable`.** How many of each, and for every `Not automatable`
   line, what is the mechanism?
3. **The manual steps you found.** List them with the automation issue filed. This is the
   value the rule is supposed to produce.
4. **Where the rule did not fit.** Any gate the two forms could not express; any gate that is
   really a missing capability rather than a human authority. Say so plainly — the point of
   this pass is to find the rule's defects.
5. **What changed in `impl:human`.** The 22 labels: which decomposed cleanly, which need a
   triage decision first, and which were never human-tier work.

## Done when

- `docs/agent-routing.md` is byte-identical to the 1.27.0 template.
- The triage skill and classifier pins are at 1.11.1 / 1.7.0 (and 1.8.0 for opencode).
- Every open `gate:` issue carries a `## Human step` line with a form and a role.
- Every `Automation: #N` line links an open issue filed in this change or already open.
- Every `impl:human` issue carries at least one decomposing gate and a record.
- `docs/agent-routing-records.md` §9 records `solo` with the trigger, hard core, standing
  grants, and substitute controls; no required-reviewer gate was restored.
- The pressure-test report exists in this repo.
