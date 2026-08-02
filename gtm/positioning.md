# vCTO Positioning — Working Notes

Last updated: 2026-08-02

A working doc, not finished collateral. Captures positioning assumptions so they don't have to be re-derived every conversation.

## Buyer

**Primary:** CTO / VP Engineering / technical founder at AI-enabled mid-market companies (roughly post-Series A through ~100-person eng teams).

**Secondary:** Non-technical founders running engineering with a contractor or small team. BModelr (Jeff Bruno) is the prototype here — small, security-relevant product, AI-agent-heavy build, founder feels acute pain but doesn't have the in-house engineering depth to solve it.

**Not:** security buyers (CISO, compliance officer). The compliance angle is available later as a wedge into larger orgs, but the natural opener is engineering leadership feeling pain from AI-velocity outstripping their quality systems. Selling to security buyers requires different channels and a different vocabulary, and Greg is honestly an engineer not a security professional.

## Vocabulary

**Use:** engineering effectiveness, governance, ship faster with confidence, AI-agent oversight, change control, drift detection, audit trail, DORA metrics, change failure rate, MTTR, lead time, deployment frequency.

**Don't use:** quality debt, quality infrastructure (those are JDAQA's terms — adjacent partner, not own lane); compliance, controls, SOC2, NIST CSF (security buyer vocabulary).

## Differentiation

Three things that distinguish this from existing vCTO / engineering-advisory offerings:

1. **Working artifacts, not policy docs.** Most CTO-advisory engagements produce slide decks, frameworks, and roadmaps. This produces files that ship in repos and run in CI. The deliverable is operational from day one.

2. **Compounding dynamic.** "Each audit finding that could have been a lint becomes a lint." The system gets better over time without the operator's attention. That's a quantifiable, demoable ROI story most advisory offerings can't tell. Now backed by live data from the reference repo: failure findings fell by two-thirds within the first week of enforcement, and priority-1 issues resolve in 2–3 days against a 7-day target. When the audit went down for 12 days, drift accumulated at a measured per-commit rate — the outage doubles as the control group. (Per the governance-health spec: report trends to prospects, never raw scores.)

3. **AI-coding-era specific.** Built for teams where 50%+ of new code is AI-generated. Most traditional engineering-governance approaches predate this and break under it — they assume a human-readable PR rate and a human reviewer who reads everything carefully.

   A specific manifestation: **mechanical slop detection** — objective signals for AI-generated cruft that a human reviewer misses or flags inconsistently. Dead code, duplication, false-green stub tests, working files committed to the repo root. Gate the hard ones; run the rest report-only and promote to gates once the baseline is clean. In founder vocabulary: *a "no slop" rule without a detector is just optimism.* Shipping across three reference repos and templatable.

4. **Compounding across repos, not just within one.** When the fastest-moving repo develops a better practice, it flows back to the template set, then out to every other governed repo via targeted maintenance prompts — concrete Claude Code instructions, scoped to each repo's current state. The client doesn't need to read changelogs or recheck the templates; they get told exactly what to add and where. This is what a retainer looks like in practice: not advice, but a continuous upstream of improvements landing in your repo.

5. **Routing work to the cheapest model that can safely do it.** The `impl:` tier taxonomy (`templates/agent-routing.md`) labels every issue with the minimum capability class required, and *why*. The industry vocabulary for this, as of 2026-07, is **hill-climbing the cost-to-outcome frontier** — Microsoft's framing, worth adopting because it is about to be standard and explaining it from scratch is wasted breath in a CTO or partner conversation.

   Use the term with technical buyers and partners. **Never in the founder one-pager** — that document was deliberately stripped of DORA vocabulary for the same reason, and this would reintroduce the problem in new clothes. Founder-facing, the mechanism is: *the cleaner your specs and the better your test coverage, the cheaper your contractor's agents are to run.*

   The differentiated half is not the routing — it's that our tiers key on **loud vs. silent failure**, not difficulty. Cost-to-outcome optimization presumes a trustworthy eval; the dangerous cases in a codebase are exactly the ones where the eval is green and wrong. The `inherent`-tier population is a map of a repo's eval gaps, and coverage is what closes them. See `docs/watch-items/2026-07-24-microsoft-mai-hill-climbing.md`.

   **Commoditization risk, stated plainly:** Microsoft's incentive is to give this layer away (Foundry) to drive model consumption. "Route by task class" will not stay a differentiator. What survives is the per-repo, non-inheritable part — the risk-surface map, the calibration set, and the judgment about which direction of change is dangerous. Position on those, not on the mechanism.

6. **Borrowed-discipline design review, at agent prices (Design Lenses).** Every big design decision claims something a mature discipline has spent a century learning to distrust — "this measurement is trustworthy" (sampling theory), "a human will act on this alert" (human factors), "this boundary holds" (security economics). The policy (`templates/design-lenses.md`) makes that borrowing one required, falsifiable line per architecture decision, checked against the actual code before the decision is accepted.

   **The timing story is the pitch.** This idea is not new — the industry has reinvented "structured interrogation of design claims" roughly once a decade (design-rationale capture in the '90s, ATAM, premortems) and every version died of the same disease: the capture problem. The person who pays the cost at design time is not the person who collects the benefit later, and no tool ever beat that gradient. Agents just inverted the economics: the expensive half — trace the concept into the code, open the files, check the prediction — is now nearly free, and what's left for the human is one sentence of judgment. We are the first generation that can afford a forty-year-old good idea, and the offering operationalizes it before that observation becomes common knowledge.

   Live demo from the reference repo: a human question backed by sampling theory found that the eval harness structurally could not represent a failing tool — every eval ever run was green in a world where nothing failed. Two research agents reading 61 ADRs had missed it; the policy turns that catch from luck into process. Founder-facing phrasing: *a second set of eyes from a century-old discipline, on every big decision, for the cost of one sentence.* Never say "epistemics" or name the disciplines unprompted — the mechanism ("the check asks what your dashboard structurally can't see") lands better than the taxonomy.

   The moat mirrors the routing story: the policy syncs everywhere and will commoditize; the per-repo records file — which lessons this repo bought the expensive way, which claim classes its domain earned, which predictions came back negative — is the non-inheritable part. And the cross-repo promotion sweep (`scripts/check-lens-promotion.mjs`) is a retainer artifact by construction: which extensions generalize across a client's repos is a question only the governance side can answer, because only it sees every records file.

## Sales motion

- **Channels:** engineering leadership networks (other CTOs, VPEs), founder networks, AI/developer-tools community (Wayfind audience), partner-of-partner referrals (JDAQA flavor).
- **Opener:** not "I do governance" but "I built a practice for this specific problem — want to look at it together?" The methodology is the conversation starter.
- **Front door (proposed):** free 1-hour repo audit. Run the staleness audit script over the prospect's repo, manually review findings, share P0/P1 with them. Direct analog of JDAQA's "Quality Debt Call." Low-friction, demonstrates value, surfaces conversion opportunity. The prospect's first audit is their "unwatched weeks" number — frame it as inventory, not grade, and show the reference repo's curve as what week 2 onward looks like.
- **Conversion:** from audit findings to a fixed-fee repo onboarding. The audit shows the problem; the onboarding is the answer. Onboarding includes **decision capture with enforcement** as a named component: extract the 3–5 implicit architecture decisions from the contractor's head into ADRs, each with its lint wired to CI — the rules stop living with the people who happen to know them. (Founder-facing phrasing: "architecture rules written down with an automatic check each" — never "ADR.")

## DORA mapping

Tangible outcome statements for the offering:

- **DoD violations → change failure rate.** Catches "fix without regression test" and "feature without integration test" before merge. Each prevented escape is a CFR avoidance.
- **Audit findings → MTTR.** Stale docs and drifted ADRs make incidents take longer to resolve. Audit catches this before the incident.
- **Lint coverage → lead time.** Auto-rejecting style and structural drift in CI eliminates review-cycle ping-pong on the things that shouldn't need human attention.

## Open positioning questions

- Brand it personally (Greg Leizerowicz Advisory) or under a name (something more brandable)?
- Specific pricing — repo onboarding range, retainer range, embedded vCTO day-rate or monthly?
- Tier the offering or one-size-fits-all?
- Multi-repo / org-level story — partially answered. Three repos now under governance (ai-fleet, analytics-infrastructure, enrichment-pipeline). The delivery mechanism is per-repo maintenance prompts (generated after each sync-review, stored in `downstream/<client>/<repo>/`). This is the concrete shape of the ongoing retainer: the client doesn't maintain templates, they run prompts we give them. What's still missing: org-level audit rollup (single view across all repos) and a templates-pinning pattern so client repos can track a version rather than running freehand prompts.
- First case study — BModelr is the candidate; what does the write-up structure look like?

## Inputs to revisit

- The Anthropic "Claude in Anthropic" feature set may change the offering — newer agent capabilities could make some lint patterns obsolete or change the architecture. Monitor and update positioning quarterly.
- Once 2-3 case studies exist, revisit the "working artifacts" differentiation — competitors will copy the surface; the case studies are what's harder to replicate.
