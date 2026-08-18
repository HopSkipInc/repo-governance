# "The Shift from Writing to Pruning Software" — Vision-Paper Read

**Date:** 2026-08-18
**Source:** Raula Gaikovina Kula (Osaka University) and Christoph Treude (Singapore Management University),
*The Shift from Writing to Pruning Software: A Bonsai-Inspired IDE for Reshaping AI Generated Code*.
arXiv:2503.02833v1 [cs.SE], 4 Mar 2025. Manuscript submitted to ACM.
**Focus:** Does anything in this paper belong in `templates/`, and does its framing help positioning?
**Research coverage:** Full 8-page PDF read directly (supplied as an upload, extracted locally). No
follow-up citation-chasing; the six references were not fetched.

---

## TL;DR

A vision paper with **no implementation, no data, and no artifact**. Two halves of very
different value:

- The **bonsai half** (§3.3 — asymmetry, simplicity, proportion, depth, mapped onto eight
  hypothetical IDE panes) is decoration. There is no mechanism under it. Take nothing.
- The **research-agenda half** (§4 — seven directions) is a genuine independent taxonomy of
  AI-assisted-development problems, produced without sight of this practice's work. Useful as an
  external coverage axis, not as a template.

Three things are worth taking, none of them a template: the title thesis as a **citation**, the
seven directions as an **audit axis**, and one **named failure mode we do not have language for**.

**Nothing here is a competitor.** Two academics arguing that the developer's job is now curation
is the thesis this practice sells, stated by parties with no commercial stake in it.

---

## Claim provenance — read this before quoting anything

The most quotable numbers in the paper are **not the authors' findings**. §2.2 relays GitHub's own
marketing research:

| Claim | Source as printed in the paper | Status |
|---|---|---|
| 85% of developers "felt more confident in their code quality" | github.blog research post, cited at footnote 9 | **Vendor self-reported** |
| Code reviews "completed 15% faster" | same | **Vendor self-reported** |
| 88% reported Copilot Chat helped maintain flow state | same | **Vendor self-reported** |
| "AI is prone to hallucinations" (§1, §2) | Ji et al. 2023 survey, ref [4] | Peer-reviewed, but general-NLG, not code |
| Every §3 IDE feature and every §4 direction | The authors | **Proposal. Nothing built, nothing measured** |

**Do not lift the three Copilot percentages into a deck or a one-pager.** They are the most
liftable content in the paper and they are a vendor grading its own product, relayed one hop. The
MAI watch item (`2026-07-24-microsoft-mai-hill-climbing.md`) established the rule this would
break: an engineering-post number is demonstrated, a framing number is direction. These are
neither — they are marketing with an academic footnote wrapped around them.

Equally: the paper's own contribution is **entirely aspirational**. Cite it for its *framing*.
Never cite it as evidence that an approach works.

---

## Overlap map — the seven research directions against our layers

| Their direction (§4) | Our equivalent | Read |
|---|---|---|
| **1. Provenance and code evolution tracking** — prompt-to-code lineage, "how and why each snippet was generated" | Records via `scripts/write-record.mjs`; ADR/PDR/DoD; PR merge as the human checkpoint | **We answer the same question differently.** They want provenance keyed to the *prompt*; we key it to the *decision record*, and treat the PR diff as the artifact of record. Ours survives a model swap and a tool change; theirs does not. This is a real architectural choice and it is nowhere written down as one |
| **2. Intent-based navigation beyond files** — codebase as an evolving graph, semantic retrieval | `templates/system-map.md`; graphify report workflow; `check-system-map-lane.mjs`; `edges.json` runtime-edge contract | **Ours is strictly more grounded.** We generate the graph *alongside* the files and drift-check it. They propose replacing the file system, which is not a thing a governance template can ask of a client repo |
| **3. Interactive regeneration and constraints** — fine-grained constraints preserving developer control | `templates/harness-enforcement.md`; the mediated write path (issue #81); `check-weakened-verification.mjs`; `docs/pre-action-enforcement-inventory.md` | **We are ahead and shipping.** Their §4.3 challenge — "allowing fine-grained constraints while still preserving developer control" — is the enforcement-stanza design, already deployed |
| **4. Multiple generations and parallel exploration** — decision fatigue, fragmentation across alternatives | Worktree lanes; disjoint file surfaces for concurrent subagents (`CLAUDE.md` agent routing); `templates/agent-routing.md` delegation section | **Partial. See "The one real gap" below** |
| **5. Continuous regeneration pipelines** — keeping generated code current, avoiding regressions on re-generation | `check-mothership-drift.mjs`; `check-downstream-drift.mjs`; `workflows/audit-deadman.yml`; graphify local regen | Direct overlap. Theirs is a research question; **ours runs in CI** |
| **6. AI code sandboxing and safety** — verify before integration | The fail-open rule ("a check that fails open reads as evidence"); `check-breaking-migrations.mjs`; `templates/db-migration-governance.md`; `/security-review` | Overlap. Ours is narrower (verification integrity) and consequently enforceable |
| **7. Human-AI collaboration and cognitive load** — avoiding overload from excessive AI-generated choices | **Nothing.** `grep -ri "cognitive load\|decision fatigue" templates docs` returns zero hits | The one blind spot the paper names that we have never named |

**What the map is worth:** two researchers independently enumerated this problem space and landed
on seven areas, five of which we cover with running mechanisms. That is a reasonable external
check that the template inventory is not idiosyncratic. It is *not* a to-do list — five of the
seven are answered, and two of the remaining gaps are gaps by choice.

---

## The one real gap — branching failure, not repeating failure

§4.4 names two failure modes we have no vocabulary for:

> "preventing decision fatigue for developers and avoiding fragmentation when multiple
> AI-generated versions are tested"

Our stop conditions in `CLAUDE.md` are all about **repetition**: three attempts at the same
failing test, coding around a blocker, weakening a test to reach green. Every one of them fires on
an agent going in circles.

We have nothing that fires on **branching**. The dispatcher who fans four subagents across four
worktree lanes has four plausible diffs and no stated procedure for adjudicating them — and the
delegation rule ("subagents prepare; you review and merge") assumes the review is tractable.
Reviewing four alternative implementations of the same change is a different and harder act than
reviewing one, and the failure is not a visible error: it is merging the wrong lane, or merging
two lanes whose reasoning conflicts, with green CI on both.

That has the shape this practice cares about — **a silent failure on a load-bearing boundary**,
which is the definition of `inherent` in `templates/agent-routing.md`. It is the only idea in the
paper we had not independently reached.

Worth an issue against `templates/agent-routing.md` (delegation section) and possibly
`templates/definition-of-done.md`. Deliberately **not** filed as part of this analysis: the
mechanism is not obvious, and a stop condition that cannot be checked is worse than none.

---

## The citation worth having

The title is the pitch: **the shift from writing to pruning software.** Five words, an academic
venue, and no commercial stake in the claim.

`gtm/positioning.md` differentiation #3 currently asserts on our own authority that traditional
engineering governance "predates this and breaks under it — they assume a human-readable PR rate
and a human reviewer who reads everything carefully." This paper argues the same from the tooling
side: existing IDEs "were built for human-written code" and treat AI output "as static text."

The sharper line, better phrased than we phrase it (§1, abstract):

> AI assistants "can lead developers down decision paths that AI should not have the authority to
> make, sometimes even without the user's consent."

That is the authority frame — not capability, not correctness, **authority** — which is exactly
`templates/harness-enforcement.md` and "the dispatcher is the fence, not the agent's conscience."
Two academics reaching for the consent vocabulary independently is worth a footnote in
`gtm/positioning.md` and in `docs/ai-growth-story/spine.md` if the arc ever needs external support
for the authority argument.

**Attribution, not adoption.** Cite it as third-party framing. Do not present the paper's
proposals as validated practice — see "Claim provenance."

---

## What to leave alone

- **The four bonsai styling principles and their eight IDE features** (§3.3). A metaphor mapped
  post-hoc onto a feature list, sourced to three bonsai gardening books ([2], [3], [5]).
  `templates/watch-items.md` already carries this exact lesson in its closing note: this directory
  started as `docs/competitive-intel/`, and naming a mechanism after its first framing cost a
  rename across every governed repo. Adopting "asymmetry" and "depth" as governance vocabulary
  would repeat that on purpose.
- **Code-as-graph-of-snippets replacing the file system** (§3.1, §4.2). We ship files into other
  people's repositories. Abandoning files is not ours to propose, and their own inspiration
  (Code Bubbles, ICSE 2010, ref [1]) has had fifteen years to displace the file tree and has not.
- **The seven directions as a roadmap.** They are a coverage axis to check ourselves against, not
  work to schedule. Five are already answered; direction 1 is answered *differently on purpose*;
  direction 2 we answer partially and correctly.

---

## Proposed next steps

- [ ] File an issue against `templates/agent-routing.md` for the branching-failure gap
      ("The one real gap" above) — a stop condition or a review procedure for adjudicating
      parallel lanes. Needs a checkable mechanism before it is written; an uncheckable stop
      condition is worse than none. Tier it `standard` unless the mechanism turns out to touch
      the harness stanzas.
- [ ] Add the Kula & Treude citation to `gtm/positioning.md` differentiation #3 and to the
      authority argument wherever it is stated — framing support only, with the vendor-numbers
      warning attached so nobody lifts the Copilot percentages later.
- [ ] **Watch list:** revisit when any of the seven directions produces a *working tool with
      measurements* rather than another vision paper — specifically an IDE or agent harness that
      ships prompt-to-code provenance as a shipped feature. That is the point where direction 1
      stops being a choice we make freely and becomes a client expectation we have to answer.
- [ ] **Watch list:** revisit when a mainstream coding agent ships first-class parallel-alternative
      generation (N implementations presented for selection, not one diff at a time). Today the
      branching-failure gap is a dispatcher discipline problem affecting people who hand-roll
      worktree lanes; at that point it becomes the default workflow in every governed repo and the
      gap needs a template, not an issue.
- [ ] **Watch list:** revisit in 12 months (2027-08-18) regardless — to check whether this paper
      was cited into a real research program or stayed a vision paper. If the former, the seven
      directions become a live external coverage axis worth re-running the overlap map against.
      If the latter, this doc is the whole of its value and can be checked off.
