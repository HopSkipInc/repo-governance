# PDR-011: Route on risk labels; guide interactive model choice, never gate it

**Status:** Accepted
**Date:** 2026-11-07
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-11-07

---


## Context

**`impl:` stores a verdict, not the facts behind it.** One label mixes three things:

- **Risk facts about the issue.** The assignment-heuristics table in `templates/agent-routing.md` lists them: silent failure, a security/isolation/tenancy boundary, a new abstraction, a wide or hard-to-reverse blast radius, an uncovered surface, a product or policy decision, external coordination, and credentials or a removed safety invariant.
- **A spec state.** The `spec` kind means "under-specified", and a rewrite fixes it. It is not a risk.
- **A routing verdict.** "Assign by the highest signal" collapses the facts into one tier, and only the tier is stored.

Because only the verdict survives, a routing change can be applied only by relabelling the backlog by hand. That includes a new model class, a cheaper model that handles a boundary well, and a cost ceiling. Nothing can ask "which open issues touch a credential path" without parsing prose.

**Routing to models is already an open decision downstream.** HopSkipInc/ai-fleet#2871 asks whether an issue's `impl:` label may set the fleet's default model strategy. It notes that doing so crosses a line ai-fleet drew on purpose: tiers describe the issue's risk, and capability classes describe the kind of thinking a role needs. ai-fleet's ADR-088 D5 already selects Autopilot work by `impl:standard`. Both are routing policy reading a label that holds a verdict.

**The interactive path has no routing, and it carries most of the work.**

- The policy calls self-identification "the fallback for interactive sessions, where a human is present and already knows" (§Self-identification).
- In an interactive harness the engineer chooses the model, usually by leaving their default in place. Nothing tells them which class an issue needs.
- The only guard is the AGENTS.md stop rule, which fires after the session has started and relies on the model judging its own capability. The policy calls that guard "advisory and it always will be".
- In ai-fleet, 88% of 382 merged PRs came from interactive operator sessions (ADR-088, citing `docs/merge-path.md`).
- Cost runs both ways. ai-fleet's records measured a median $6.69 per `standard` run against $28.26 per `frontier` run (2026-08-14 cohort, n=13 and n=4; small samples). A standard issue worked in a frontier session pays the frontier price.

**The constraint on any fix (Greg Leizerowicz, 2026-11-07).** Engineers must keep the choice of model, "or there will be a revolt." Guidance that blocks, nags or second-guesses an engineer gets switched off, and then it guides nobody.

The direction was raised 2026-11-06 while reviewing ai-fleet#2871 and was decided 2026-11-07 on HopSkipInc/repo-governance#135, whose five open questions this record answers.

## Decision

**1. Issues record risk facts as labels.** Five `risk:` labels, each a fact about the issue:

| Label | Covers (heuristics rows merged) |
| --- | --- |
| `risk:silent-failure` | A wrong result looks correct. |
| `risk:boundary` | Security, isolation or tenancy boundaries, including credential handling. |
| `risk:irreversible` | A wide blast radius, or hard to reverse, including dropping or renaming migrations. |
| `risk:new-abstraction` | Requires inventing an abstraction the codebase does not have. |
| `risk:uncovered` | No existing test covers the surface being changed. |

- An issue carries zero or more. Zero means loud, contained work.
- The `## Impl tier` section becomes `## Risk`: each label with a one-sentence reason.
- `risk:uncovered` carries the same coverage record lint rule R8 requires today, on its own line: `Coverage gap: #N` or `Coverage: not testable — <mechanism>`. When the gap issue closes, the label comes off in the same edit.

**2. Human completion lives in `gate:` labels, not in the rule.** `impl:human` was a completion gate, not a capability. It becomes `gate:human-approval`, `gate:decision` or `gate:human-review`, which already exist. That covers the heuristics rows for a product or policy decision, external coordination, and credentials or a removed safety invariant.

**3. The spec state leaves the risk vocabulary.** "Under-specified" is carried by the repo's under-structure marker (`needs-structure`, or `needs-spec`). The R4 and R5 contradictions are restated against that marker.

**4. Routing is a rule kept in records.**

- Each repo's `agent-routing-records.md` holds a rule mapping a set of risks to a minimum capability class.
- The rule outputs a class only, never a model name. It resolves to a model through the existing class and route tables.
- The default rule is today's heuristics table read as a function: the highest signal wins.
- A repo may change its rule, and changing it never touches an issue.

**5. The frontier ratio stays, derived.** It becomes the share of open issues whose rule output is the frontier class. Its decomposition reading (§The frontier ratio) is unchanged.

**6. Interactive engineers are guided to a model before they start, through two surfaces, in Claude Code and OpenCode:**

- a **pickup command** (`/pickup <issue>`): reads the labels, resolves the rule, and prints the required class plus the exact command to select it in that harness, generated from the route table, never hand-typed;
- a **first-prompt hook**: when the first prompt names an issue, it shows the same guidance.

**7. The engineer keeps the choice. This is a requirement, not a preference.**

- Guidance advises. It never blocks a session, refuses a prompt, or switches the model itself.
- Proceeding on a below-class model takes no more than one acknowledgement. Once dismissed for an issue in a session, a warning does not repeat.
- A note that the session is above the class is informational only.
- Each engineer can turn the hook off in their own user-level settings, without a repo change. The pickup command stays available.
- Overrides are observable only in aggregate, to calibrate the rule (see Falsifier). They are never a per-person compliance measure.
- The only hard fence stays where the policy already puts it: automated dispatchers (Layer 1). Interactive enforcement stays advisory (Layer 2).

**8. `impl:` is derived first and retired last.**

- During transition, `impl:` is generated from the risk labels and the rule, so every existing consumer keeps working.
- Before a repo stops writing `impl:`, an equivalence check runs the rule over that repo's labelled backlog. Every difference from the current tiers is resolved on the record: either the issue was mis-tiered, or the rule is wrong.
- Consumers move to the rule one at a time.

## Falsifier

- [ ] Revisit by 2027-02-07, when the equivalence check has run over HopSkipInc/ai-fleet's labelled backlog. If more than 10% of the differences resolve as "the rule is wrong" rather than "the issue was mis-tiered", the five labels do not capture what triagers were tiering on.
- [ ] Revisit when engineers ask, twice within a quarter, to remove or bypass the interactive guidance (an issue, a PR, or a recorded request). That means requirement 7 failed in practice.

## Consequences

- **Authorizes** HopSkipInc/repo-governance#135's four split children, filed after this record is accepted:
  - (a) the `risk:` vocabulary, the spec marker and the lint rules restated, with fixtures;
  - (b) the routing rule and the equivalence check, run on this repo's backlog first;
  - (c) the pickup command and the first-prompt hook in both harnesses, plus the AGENTS.md section text, all built to requirement 7;
  - (d) the routing-classifier and routing-triage changes, then downstream prompts for each governed repo.
- **Forecloses**, without superseding this record:
  - a hard gate on model choice in interactive sessions;
  - dropping `impl:` in any repo before its equivalence check passes;
  - writing a model name into a label or into the rule.
- **Downstream:** ai-fleet's `impl:` consumers move to the rule one at a time: ADR-088 D5's Autopilot selector, the roadmap generator's tier column, ADR-088's merge-yield slices, and HopSkipInc/ai-fleet#2871's dispatch default.
- **Stops:** the routing-classifier stops proposing a tier and proposes risk labels with reasons.
