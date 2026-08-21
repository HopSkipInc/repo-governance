# Backlog grooming: a currency lint, a claim-verification skill, and a generated roadmap (2026-08-21)

**Applies to:** HopSkipInc/ai-fleet (pilot and reporting repo). Other `full`-class repos take
the lint on a later sync; the remediation numbers and the self-test below are ai-fleet's.
**Ships with:** nothing yet — this prompt requests the templates. Proposed shape:
`templates/scripts/check-backlog-currency.mjs` (new) and
`templates/skills/backlog-groom/SKILL.md` (new).
**Source report:** the 2026-08-20 roadmap session in ai-fleet. Every failure class in §2 was
observed in that session, not hypothesised.

## 0. Read first — the two PDR rules that shape this

**PDR-010's contract rule binds the estimation half of this prompt.** *"`templates/` ships a
contract — required fields, units, the fail-closed rule — and never an implementation. No
template may depend on the host DB or on MCP availability."* The lint proposed in §3 reads the
**GitHub issue graph only** (via `gh` or the REST API) and therefore satisfies that rule
unchanged. The estimation column in §4 does not, and must land as a contract with ai-fleet as
its first implementation — exactly as PDR-008 did for the claim enumerator.

**PDR-010 Consequences 4 sets the sequencing:** *"Instrument HopSkip first, template second."*
So: build the lint and the skill in ai-fleet, run them for one cycle, and only then extract the
template. Do not generalize on the first pass.

One collision to avoid up front. §3's C3 check reads an ADR's `Resolves: <repo>#N` header line.
That is a **file** header, not a commit trailer, so it does not collide with PDR-010
Consequences 3's rule that the commit trailer must be `Issue:` and never
`Fixes:`/`Closes:`/`Resolves:`. Keep the two conventions distinct in whatever docs this touches;
the auto-close gotcha has already fired twice in this estate.

## 1. The incident, measured

A roadmap was built by reading all 38 open epic bodies in ai-fleet end to end. The bodies are
unusually good — verifiable outcomes, verification commands, dependency lists, impl tiers. The
roadmap was still wrong in ways that would have misdirected a quarter of planning, and **every
error came from one place: an epic body describing a world its own children had already left.**

Of fourteen decisions the first pass queued as blocking:

| Claimed blocker | Reality | Lag |
|---|---|---|
| #1425 gates the Query Gateway epic | closed by ADR-068 | 2 days |
| #1564 gates pricing M2 | closed and shipped | — |
| #1752 hard-vs-soft delete undecided | decided; migration `0397` merged | 1 day after the body was written |
| #1747 is the last open row of #1112 | closed; every child of #1112 merged | 11 days |
| #1253 / #1254 are the second-tenant blockers | both closed; 4 of 7 children of #1252 done | 1 month |

Two epics (#1097, #1112) had every child merged while still reading as open work.

Worse than a stale row: **a body cited a code fact that had been deleted.** #1252 stated *"RLS
is written but not engaged — the flag defaults off."* In the tree, `isRlsIsolationEnabled()`
returns `true` unconditionally (the flag was removed by #1341) and 80 non-test call sites bind
the workspace connection. The roadmap therefore reported a live cross-tenant hazard that had
been closed a month earlier — the most expensive error class available, because it directs
attention *toward* solved problems and *away* from open ones.

**The generalizable claim:** an epic body is authored once and read for months. Closing a child
updates the child; nothing propagates upward. Epic bodies decay at a rate proportional to their
children's velocity, and the better written the body, the more confidently it misleads.

## 2. What ai-fleet already has, and why none of it caught this

Audited against the tree, 2026-08-21.

| Mechanism | Checks | Why it missed this |
|---|---|---|
| `tools/audit-backlog-structure.mjs` | Body *shape* — a Verifiable-outcomes section with ≥1 checkbox, a Verification section, a Work-type line or type label, label cardinality | Pure shape linter. Its input is `gh issue list --json number,title,body,labels,createdAt`: never fetches sub-issues, does not even request `state` |
| `scripts/check-issue-routing.mjs` R1–R8 | Real contradictions — `status:ready` + spec kind, ungrounded tier downgrade, undecomposed escalation, uncovered-with-no-record | Every rule is **intra-issue**: body against its own labels and tier line. No rule crosses to another issue |
| `.claude/skills/routing-triage` | Assigns `impl:` tiers by failure mode | Classification, not currency |
| `docs/definition-of-done.md` § Stale issue sweep | Two `gh` commands plus eyeballing: issues whose fixing PR omitted `Fixes #N`; "any open issue describing work that is visibly already complete" | Manual, unscheduled, and scoped to the **inverse** failure — closed work still open. #1097 and #1112 sat fully-merged-and-open through it regardless |
| `grep -rl "sub_issues\|child_of" tools/ scripts/ host/scripts/ .claude/skills/` | — | **Zero hits.** Nothing in the repo compares an epic to its children |

**The gap is a missing axis, not a missing rule.** Every existing check looks inside one issue.
Adding a rule to any of them cannot reach this.

## 3. The regime

### Layer 1 — `check-backlog-currency.mjs` (mechanical)

Six of the seven observed classes are detectable from the issue graph alone. No model, no host
DB, no MCP.

| # | Class | Detection | Clears when |
|---|---|---|---|
| C1 | Epic fully delivered, still open | ≥1 sub-issue and `sub_issues_summary.percent_completed == 100` | Closed, or a body line states why it stays open |
| C2 | Body cites a blocker that closed | Parse `blocked-by #N`, `gates`, `blocking child is #N`, `Gate: #N`; report any `N` in state `closed` | Body edited, or the reference reworded to past tense |
| C3 | Label contradicts the graph | `status:blocked` with zero open blockers; `status:needs-decision` where a merged ADR carries `Resolves: <repo>#N` for this issue | Label flipped |
| C4 | Declared hierarchy not linked | Parse `child-of #N` / `Parent epic: #N` from the body; diff against the sub-issue graph | Linked, or the prose corrected |
| C5 | Named-but-unfiled work | Scan bodies and ADR Known-Gaps tables for `(unfiled)`, `not yet filed`, `to file`, `no issue exists` | An issue number replaces the marker |
| C6 | Milestone table disagrees with child states | For epics with a phase/milestone table, cross-check each row's cited issues against their states | Table updated |

C3's ADR half is mechanical **only because the record format already carries the link** —
ADR-068's header reads `Resolves: ai-fleet#1425`. If the ADR template does not mandate that
line, add it in the same change; otherwise C3 degrades to the label half alone.

Output: one line per finding, `severity #issue class message`, consumable by the existing audit.
**Report-only for two cycles**, then promote C1/C3/C4 to gates. A cold start on ~36 open epics
produces a wall, and a wall gets ignored.

### Layer 2 — `backlog-groom` skill (judgment)

C7 — **a body asserting a code fact that has changed** — is not mechanizable. It needs a model
to read "the flag defaults off" and check the tree. It is also the class that produced the
worst error in the incident, so it is not optional.

Contract:

1. One epic per invocation. Reading 36 in one context is how the original error happened.
2. Extract every **falsifiable claim about the code** — file paths, function names, flags,
   "X is not wired", "no handler does Y", row counts.
3. Verify each with a named command. A grep, a test run, a query — not an impression.
4. Emit `claim → verified | stale | unverifiable`, with the command and its output.
5. For each `stale` claim, **propose** the corrected sentence. Do not rewrite the body
   unattended — the body is the author's, and an agent silently editing epics is how intent
   gets laundered. A human or a PR merges.

Trigger: any epic whose children changed since its own `updated_at`, which Layer 1 can emit as
its own finding class.

### Layer 3 — the roadmap is generated, not authored

Five rules, each earned from a specific error in the incident:

- **Children win over bodies.** Every status assertion resolves from child state, ADR state, or
  the tree. Bodies supply *intent* — the why, the sequencing rationale, the gate definitions —
  and nothing else.
- **Every claim carries provenance.** A row saying "blocked on X" names what was read. In the
  pilot, one row rendered `stale label` instead of trusting `status:needs-decision`, and that
  was the only reason the contradiction surfaced at all.
- **Point-in-time and forward only.** No session narrative, no "what we decided today", no
  changelog of the document's own revisions. The pilot accumulated all three and needed a
  rewrite.
- **Name what expires.** Distinguish "late if delayed" from "impossible if delayed". The pilot
  found exactly one of the latter and had overstated its scope by half.
- **Distinguish decision / credential / dependency / deliberate wait.** Four things that all
  present as "blocked" and need entirely different actions. Collapsing them makes a credential
  look like an open question.

## 4. The PDR-010 seam — keyed now, computed later

PDR-010 is Accepted (2026-08-17). This section aligns the roadmap to it **without** building
estimation, because coverage in ai-fleet is 15% against a ≥70% target and any estimate today
would be noise.

What the generator must get right now, because retrofitting it is a rewrite:

- **Attribution is declared at dispatch, never reconstructed.** PDR-010 Decision 2: attribution
  flows through the `spawn-fleet-tool.ts` goal contract, *"not reconstructed from commit
  archaeology later."* A roadmap that infers an issue↔spend link from commit history is
  computing a different number than the practice.
- **The commit-granularity join key is the `Issue: #N` trailer** (Consequences 3), which must
  be `Issue:` — not `Fixes:`/`Closes:`/`Resolves:`. Generate against issue numbers so the
  trailer joins cleanly.
- **Bucket keys include pre-observable features**, not just model and harness: `impl:` tier and
  kind, files touched, whether a test surface already covered it, DoD work type. Harness
  *identity* is keyed; harness *version* is recorded per span but not keyed.
- **Render `thin`, never a number, below minimum `n`.** A thin cell *"derives no estimate and no
  cap."* A roadmap that interpolates across a thin bucket has invented the figure.
- **Never display a stored dollar.** Decision 3: dollars are a derived read-time view over a
  committed price table; storing them as the primitive lets a price change silently re-rank
  buckets.
- **A roadmap estimate is calibration, so it takes gross cost** — retries and dead ends
  included (Decision 4). Billable is the metering view and is a different column. Do not label
  one with the other's number.
- **A cap is not an estimate** and is never derived by the same pass. If the roadmap ever grows
  a budget column, it comes from the percentile-plus-headroom rule and is enforced in tokens.
- **Admission is fail-closed, and exclusions make the baseline slower.** Missing provenance is
  **excluded**; missing span coverage is **SKIPPED**. A generator that quietly counts
  incomplete deliveries ratchets toward faster, which PDR-010 calls broken by construction.
- **Counts, identifiers, durations. Never content.** The generator reads issue metadata and
  span facts. It does not read conversation content to estimate anything.

## 5. Enforcement and DoD changes

- Wire the lint per ADR-026 — report-only probe, then C1/C3/C4 as gates — and declare it in the
  lint-coverage manifest so it cannot rot unwired. ai-fleet has a live precedent: a validator
  sat declared-but-invoked-by-nothing for two weeks.
- Amend the DoD **Stale issue sweep**: it catches only closed-work-still-open. Add the inverse —
  *open work whose blockers closed* — and point it at the lint instead of at eyeballing
  `gh issue list`.
- Add one DoD line to the epic work type: **when a child closes, the parent's milestone table is
  updated in the same PR, or the lint's C6 finding stands as the record.**
- Make `Resolves: <repo>#N` mandatory in the ADR template (C3 depends on it).

## 6. How the applying repo proves it worked

- The lint runs clean, or every finding carries an accepted disposition.
- **Self-test against the incident.** Reconstruct ai-fleet's state as of 2026-08-20 and assert
  the lint flags: **#1097, #1112** (C1); **#1252, #1426, #1922, #1533** (C2); **#1426** (C3);
  **#989** (C4); **#1454, #1426** (C5). A regime that cannot catch the incident that motivated
  it is not done.
- One `backlog-groom` pass on #1252 reports the RLS claim `stale`, citing
  `isRlsIsolationEnabled()` returning `true` unconditionally.
- A generated roadmap contains no assertion whose only source is an epic body.

## 7. Open questions for the governance team

1. **Gate or probe for C2?** A body citing a closed blocker is always wrong, but the fix is a
   prose edit and gating those on merge may cost more friction than it buys. Pilot's instinct:
   C1/C3/C4 gate, C2/C5/C6 probe.
2. **Who owns the correction?** The skill proposes, a human merges. At what finding volume does
   that stop scaling, and is a fleet worker behind a review gate the answer?
3. **Per-repo or estate-wide?** The lint is repo-local. The interesting roadmap joins several
   repos' graphs, which is where a cross-repo `Resolves: <repo>#N` form starts mattering.
4. **Grandfathering.** The structure linter grandfathers pre-schema issues by date. Currency has
   no equivalent — a stale body is stale regardless of age. Confirm that is intended before the
   first run produces ~36 findings.
