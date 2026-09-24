# Design: the routing-classifier binds a capability class, not a model

**Trigger:** ai-fleet #3097 (upstream half) · **Date:** 2026-09-24 · **Status:** design
agreed — implemented (policy 1.15.0, `check-classifier-pin-drift.mjs` v1.0.0; the downstream
step for ai-fleet is in `downstream/hopskip/ai-fleet/2026-09-24-classifier-class-binding.md`)
**Supersedes:** policy 1.4.0/1.7.0's rule that the pin "has to name something concrete"
(`docs/agent-routing.md` §*One exception*)

---

## The problem

The `routing-classifier` agent pins its model in frontmatter. That pin is the mechanism
that makes triage un-self-certifiable: the harness resolves the model at spawn, so the
classifier never votes on its own model (`docs/agent-routing.md` §*One exception*). It is
also the one place the practice permits a model name in an authored artifact.

Owner direction, 2026-09-24: the platform is model-flexible — a capability class resolves
to the current registry binding (ai-fleet ADR-066) — so no authored artifact should name a
concrete model. ai-fleet's #3098 removed model names from the routing docs, the worker
roles, and its records §1. It left the classifier pin deliberately: deleting it is a
behaviour change, not a rename.

**Deleting the pin is not an option.** Without it the subagent inherits the session/worker
model, so a `general`-class session triages frontier work — the exact under-call the pin
prevents. And neither harness can bind a class natively: Claude Code and opencode resolve
`model:` as a concrete slug, and neither can verify a spawned subagent's *resolved* model
(`docs/pre-action-enforcement-inventory.md`, cell-note 5). The dispatcher-side "check my
own class" alternative is already ruled out by the policy's own text — a model that wants
to be helpful finds a reading of "frontier" that includes itself.

## The design

**1. The invariant is stated in class terms.** The classifier runs at capability class
`deep-reasoning` — the triage-grade class. That is a property of the model, not a name;
the class→deployment binding is registry data.

**2. Resolution belongs at the gateway.** The gateway is the inference egress chokepoint
every caller — host, fleet workers, interactive harnesses — is moving toward (ai-fleet
ADR-067, ADR-087). It sits outside the agent, so class resolution there preserves
un-self-certifiability for free. The intended end state: the pin names the class and the
gateway resolves it, and no concrete name exists in any repo. This is an ai-fleet feature
and does not exist yet — the gateway resolves model *aliases* today (`model_aliases`,
alias→model_id), but class→*deployment* resolution is a separate host layer
(`resolveModelByClass`).

**3. Until it does, a concrete name in a repo is a generated bridge, never authored.** The
template names the class. The install/sync step resolves it to the harness slug against
the target repo's declared class→model map and writes the concrete `model:` line into the
installed file. A repo may carry a model name only when that step produced it; a
hand-typed name is the defect. This is the same shape as ai-fleet's own generated
`.claude/agents/*` (generated from `runtime/roles/*`, staleness-gated) — the house pattern
for "a file the harness needs to name a concrete thing."

**4. Drift is caught by a fail-closed lint, not by a re-sync.** Two adjacent comparisons,
so no check is self-referential:

- registry → the repo's declared class map — gated in ai-fleet by the pricing/seed-drift
  lint family;
- the declared class map → the installed pin — gated by `check-classifier-pin-drift.mjs`
  (new), which fails **closed** when the class is unclassified or the binding is absent.

The chain is: the pin names the class; the map names the class→model; the registry is the
source. Each link is checked against its neighbour, and the link that can genuinely fail
is map-vs-pin, because the map is data and the pin is a file. Today §3's "every pin must
resolve to a model this file lists as `frontier`" is a human re-sync step; this lint is
that check, mechanized.

**5. The check must be able to fail.** A class binding that resolves through the registry
alone makes §3 circular — `deep-reasoning` resolves to whatever the registry bound it to,
and the class table says `deep-reasoning` is triage-grade, so the check passes by
construction. That is the repo's documented failure mode ("a check that fails open reads
as evidence"). The map-vs-pin comparison is what breaks the circle: the map is a concrete
claim in data, the pin is a concrete claim in a file, and they are allowed to disagree.

## What the rule means in practice

- **Authored artifacts** (policy, templates, records, issue bodies, roles, docs) name
  classes, never models.
- **Machine-resolved artifacts** (the installed pin) may carry a concrete name only when
  generated/resolved from the class map.
- **The class map is data.** A model name there is a *binding*; capability is the *class
  assessment*. The two are not interchangeable, and the map is not a place to argue
  capability.

## What would change this

- **The gateway resolves classes** (the ai-fleet work). Then the bridge retires: the pin
  names `deep-reasoning`, no concrete name exists in any repo, and
  `check-classifier-pin-drift.mjs` narrows to asserting the pin's class is triage-grade.
  The lint does not disappear; it changes what it compares.
- **A harness gains a native class-binding or resolved-model-verification surface**
  (inventory cell-note 5 closes). Same convergence, one layer lower.

Both are convergence, not divergence: each removes a place a concrete name could live and
leaves the class invariant checked.

## Enforcement to build

- `check-classifier-pin-drift.mjs` — fail-closed; fixture tests per the coverage floor
  (`docs/testing-strategy.md` §1).
- Policy text (`docs/agent-routing.md` §*One exception*, synced to
  `templates/agent-routing.md`) rewritten to state the class binding, the bridge rule, and
  the gateway direction.
- Records §3 (`docs/agent-routing-records.md` and its blank form) records the pin's
  **class** and the class→model map, not a reviewed model name as a capability claim.
