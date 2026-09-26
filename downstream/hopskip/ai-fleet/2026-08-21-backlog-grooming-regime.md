# Backlog grooming: a currency lint, a claim-verification skill, and a generated roadmap (2026-08-21)

**Applies to:** HopSkipInc/ai-fleet (pilot and reporting repo). Other `full`-class repos take
the lint on a later sync; the remediation numbers and the self-test below are ai-fleet's.
**Ships with:** nothing yet — this prompt requests the templates and carries the v1 design
(§3 detection semantics, Layer 3 artifact schema, §8 extraction gate). **Layer 3 revised
v1 → v2 2026-09-20 — see the banner at §3; the v1 text there was never built anywhere.**
Proposed shape:
`templates/scripts/check-backlog-currency.mjs` (new) and
`templates/skills/backlog-groom/SKILL.md` (new). The `blocked-by` half is **not** rebuilt:
`templates/scripts/check-stale-blockers.mjs` v1.0.0 shipped upstream 2026-08-18 and is
installed as step 0 (§2, §5).
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
| #1747 is the last open row of #1112 | closed; every child of #1112 merged | 10 days |
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

One slice of this table stopped being true upstream three days before this prompt.
`templates/scripts/check-stale-blockers.mjs` v1.0.0 shipped from repo-governance on
2026-08-18 and already detects the `blocked-by` half of C2 (its `phantom` class: dependent
open, blocker closed), with the probe-never-gate exit contract and the SKIPPED-not-clean rule
this regime wants. It is **not installed in ai-fleet**, and no downstream prompt carries it
yet. The regime installs it as step 0 (§5) rather than rebuilding it, and the currency lint
below never parses `blocked-by` prose — two detectors sharing one citation grammar is the
two-enumerators hazard PDR-008 names.

**The gap is a missing axis, not a missing rule** — with that one correction registered. What
no installed *or* templated check reaches is the **sub-issue graph**: every existing mechanism
reads citation prose or a single issue; nothing compares an epic to its children. That is the
axis the new lint owns.

## 3. The regime

### Layer 1 — `check-backlog-currency.mjs` (mechanical)

Six of the seven observed classes are detectable from the issue graph alone. No model, no host
DB, no MCP.

| # | Class | Detection | Clears when |
|---|---|---|---|
| C1 | Epic fully delivered, still open | ≥1 sub-issue and `sub_issues_summary.percent_completed == 100` | Closed, or a body line states why it stays open |
| C2 | Body cites a blocker that closed | **`check-stale-blockers.mjs` owns `blocked-by` refs** in `## Dependencies` (step 0); the currency lint owns the observed epic-prose form `Blocked on #N` (semantics below) | Status surface no longer asserts the block — see the clearing rule below |
| C3 | Label contradicts the graph | `status:blocked` with zero open blockers; `status:needs-decision` where a merged ADR carries `Resolves: <repo>#N` for this issue | Label flipped |
| C4 | Declared hierarchy not linked | Parse `child-of #N` / `Parent epic: #N` from the body; diff against the sub-issue graph | Linked, or the prose corrected |
| C5 | Named-but-unfiled work | Scan bodies and ADR Known-Gaps tables for `(unfiled)`, `not yet filed`, `to file`, `no issue exists` | An issue number replaces the marker |
| C6 | Milestone table disagrees with child states | For epics with a phase/milestone table, cross-check each row's cited issues against their states | Table updated |

C3's ADR half is mechanical **only because the record format already carries the link** —
ADR-068's header reads `Resolves: ai-fleet#1425`. If the ADR template does not mandate that
line, add it in the same change; otherwise C3 degrades to the label half alone.

#### Detection semantics — v1 decisions

Everything below reads the GitHub issue graph via `gh` (REST) — no host DB, no MCP. If `gh`
is absent or unauthenticated the lint reports `SKIPPED`, never PASS: a check that fails open
reads as evidence. All section parsing is line-scanned, never a `\Z` regex — JavaScript has no
`\Z` anchor, and that bug already cost the routing lint every correctly-formatted issue in a
live backlog. The parse forms below are the dialects observed in the four self-test issues on
2026-08-21, not an invented grammar.

- **C1.** Do not trust `sub_issues_summary.percent_completed` alone — it counts closed
  sub-issues without partitioning `state_reason`. Fetch the sub-issue list and partition: all
  `completed` → *fully delivered, still open*; any `not_planned` → a different finding
  (*children closed without delivery — verify disposition*), which a percentage conflates.
  Clears when the epic closes or the body carries a `Stays open: <reason>` line.
- **C2.** Ownership is split so no two detectors share a grammar. `check-stale-blockers` owns
  every `blocked-by` form inside a `## Dependencies` section — its dialect already covers the
  `**blocked-by:** #N` emphasis-colon form #1426 uses. The currency lint owns exactly one
  epic-prose form: `Blocked on #N` outside a Dependencies section. Reverse-direction `X gates
  #Y` prose is **out of v1 scope** — it asserts facts about *other* issues' blocker lists, and
  parsing it double-maintains the graph in prose. Documented exclusion, candidate for 1.1.
  **Clearing rule:** a citation line that discloses its own staleness does **not** clear the
  finding while any status surface — label, milestone-table row, `## Status` line — still
  asserts the blocked state. #1922's *"Blocked on #1563, which has landed — this blocker is
  likely stale"* sits beside a milestone row that still reads `| #1569 | blocked |`:
  disclosure without correction is the finding.
- **C3.** Label half: `status:blocked` with zero open blockers per the graph. ADR half:
  line-scan `docs/adr/*.md` headers for `Resolves:.*#N` naming a `status:needs-decision`
  issue. Clears when the label flips.
- **C4.** Declared hierarchy parses the three observed dialects: `children: #a, #b` inline
  lists, `Child issues` bullet lists, and milestone-table rows. The house already uses the
  clearing annotation in the wild (`**closed as superseded:** #1580, #1920` in #1922) — adopt
  it as the lint's clear-condition rather than inventing a second convention. A declared child
  missing from the sub-issue graph is the finding.
- **C5.** Marker scan of open-issue bodies and ADR Known-Gaps tables: `(unfiled)`, `not yet
  filed`, `to file`, `no issue exists`, bare `unfiled`. #1426 carries two live instances
  (*"not yet filed as issues"*, *"unblocked, unfiled, and time-boxed"*). An issue number
  replacing the marker clears it.
- **C6.** Conservative by design: flag a milestone-table row only when **every** cited issue
  in the row is closed while the row still claims pending / blocked / in-progress. Partial
  rows stay silent in v1 — a chatty lint gets ignored, and §7.4 already expects ~36 cold-start
  findings.
- **Trigger (not a finding).** `info #epic TRIGGER children-changed-since-body-update` when a
  child's `closed_at` is newer than the epic's `updated_at`. Layer 2's scheduler consumes
  exactly this line.

Output: one line per finding, `<gate|probe|info> #issue <class> <message>`, consumable by the
existing audit. **Report-only for two cycles** (ADR-026 probe), then C1/C3/C4 promote to
gates. A cold start on ~36 open epics produces a wall, and a wall gets ignored.

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

Two clauses earned during this prompt's own review (2026-08-21):

6. **Read the comments, not just the body.** #1426's Dependencies section was stale from
   2026-08-02 to 2026-08-17 while the correction sat in a comment the whole time — the body
   now carries a note saying exactly that. A correction living in comments is a stale-body
   finding. That is the eighth observed class, and it is judgment, not a parse rule — it
   belongs here, not in Layer 1.
7. For each `unverifiable` claim, name the command or surface that *would* verify it.
   `unverifiable` without a named gap is where claims go to be forgotten.

Trigger: any epic whose children changed since its own `updated_at`, which Layer 1 emits as
its `TRIGGER` line.

**Relationship to the existing `groom-backlog` fleet skill** (local, v1.0.0): that skill is
*prioritization* — now/next/later scoring plus mechanical label fixes. This skill is
*currency* — verifying what bodies assert. The lint's findings are the grooming fleet's input
queue, and a stale claim discovered mid-scoring is a C7 finding, not something the scoring
pass silently works around. One regime, two passes — currency before prioritization, because
a priority computed from a stale body is the incident this prompt exists to retire.

### Layer 3 — the roadmap is generated, not authored

> **Revised v1 → v2, 2026-09-20.** Between 2026-08-20 and 2026-09-12 the ai-fleet roadmap
> was produced **six times by hand**, published as Artifacts, never source-controlled — the
> pilot this layer exists to retire ran long enough to test v1 against reality. v2 keeps the
> five rules (one sharpened), the six-column contract (two columns sharpened), the trust
> model, and the §4 estimation seam unchanged. It adds what six runs taught: the
> data/narrative split, the trust header as a generated field, the versioning model, the
> placement rule, and the schedule classification. Each addition names its evidence in line.
> A same-day second pass (owner-directed, after a census showed **78% of ai-fleet's open
> backlog living outside the epic graph**) added the **debt table and the debt sweep** —
> the unparented bugs and one-offs that an epic-shaped artifact renders invisible.
> Implementation lands in ai-fleet via `2026-09-20-roadmap-layer3-v2.md`; **no `templates/`
> artifact ships from this revision** — PDR-010 Consequences 4 binds, and the template
> extracts after one full ai-fleet cycle of v2, not before.

**The split v1 never named.** v1's schema was *one row per work item, generated* — a table.
Every roadmap actually produced carried sections a table cannot express: a **sequence**
("start next, in this order", each row naming what gates it), a **dependency ordering**
(four horizons), and **cross-cutting observations** ("four things to watch", each a named
mechanism — e.g. *a guard that was green because it could not see the thing it guarded*).
The table is the substrate; the narrative is the product. The owner's requirement —
runnable on demand from any session, with a versioned set of output artifacts — is only
satisfiable if the deterministic half is a file with a stable schema that any session can
regenerate and diff, and the judgment half is a separate pass over it. v2 is therefore two
artifacts and two passes:

- **A data pass** — deterministic, `gh`-only, no model judgment. Emits a committed,
  diffable data artifact. Everything in it is computable: epic enumeration, child counts
  from the sub-issue graph, label reads, declared-blocker resolution against open/closed
  state, PR state, `impl:` tier coverage — and the **unparented population as an
  age-bucketed debt table**, because 412 of 525 open issues (2026-09-20) have no epic and
  an epic-shaped artifact renders them invisible. It **shares its graph loader with the
  Layer 1 currency lint** rather than growing another enumerator — PDR-008's
  two-enumerators hazard is the reason this regime already splits C2 from
  `check-stale-blockers.mjs`, and it applies here. (The stale-blockers copy is a
  byte-identical synced template, so unifying *its* loader is an upstream template
  revision owed at extraction time — a local refactor would drift it off v1.0.0 to save a
  deduplication.)
- **A narrative pass** — a skill, reading the data artifact, verifying load-bearing code
  claims with named commands (the Layer 2 discipline), writing prose into marked sections
  of a committed narrative document. Sequence, horizons, and cross-cutting observations
  live here and nowhere else.

Five rules, each earned from a specific error in the incident. Five held across six runs;
one needed sharpening:

- **Children win over bodies — and the rule governs status assertions.** Every status
  assertion resolves from child state, ADR state, or the tree. Bodies supply *intent* — the
  why, the sequencing rationale, the gate definitions — and nothing else. **Sharpened in
  v2:** the runs found the inverse failure too. An epic body can be *right* about a
  decision while the graph is silently wrong about the shape — #1886's tenancy blocker was
  partly answered by two issues that shipped in a different epic, for a different purpose,
  without referencing it; the graph showed nothing because no link was ever made. So the
  rule scopes itself: it governs *status* claims, and a body's *intent* claims get Layer 2
  verification against code, not against the graph.
- **Every claim carries provenance — and provenance is `file:line@ref`.** v1 said "the
  command, query, or source used". Across six runs the load-bearing provenance was almost
  always a file and a line into code on a named ref — `registry-pricing-table.ts:193`
  raising rather than falling back, `workspaces.ts:55` recording why auto-join was
  rejected, `fleet-dispatch-shared.resolveModel` still applying a role heuristic. Those are
  what turned an epic body's claim from plausible to settled. **The ref is required** — a
  line number without a commit is unfalsifiable a week later. In the v1 pilot, one row
  rendered `stale label` instead of trusting `status:needs-decision`, and that was the only
  reason the contradiction surfaced at all.
- **Point-in-time and forward only.** No session narrative, no "what we decided today", no
  changelog of the document's own revisions. The pilot accumulated all three and needed a
  rewrite. (Unchanged in v2.)
- **Name what expires — and expect almost nothing to.** Distinguish "late if delayed" from
  "impossible if delayed". The v1 pilot found exactly one of the latter and had overstated
  its scope by half. Six runs across ~39 open epics found the same density: **exactly one**
  genuinely perishable item — a pre-cutover baseline capture whose window closes when an
  upstream repo revokes a grant on someone else's schedule. v2 states the expected density:
  **near-zero**. A generated roadmap that marks many rows `expires` is miscalibrated, and
  saying so here is cheaper than discovering it per-repo.
- **Distinguish decision / credential / dependency / deliberate wait.** Four things that
  all present as "blocked" and need entirely different actions. Collapsing them makes a
  credential look like an open question. (Unchanged in v2.)

#### The artifact schema — v2

The v1 column set held; it is preserved, with `provenance` and `expires` sharpened as
above. The column set exists from day one so estimation lands later as **data in an
existing column**, never as a redesign:

| Column | Rule |
|---|---|
| `status` | Derived — child graph, ADR header, or tree check. Never asserted from a body. Children-win governs this column; a body's *intent* claims route to Layer 2, not to the graph |
| `provenance` | `file:line@ref` for code claims — the ref is mandatory. Graph-derived claims carry the command or query and its date. Owner statements carry a date and an attribution |
| `block type` | `decision` / `credential` / `dependency` / `deliberate-wait` |
| `expires` | What invalidates the row — a date or a named trigger. Expected density near-zero (above); a roadmap with many `expires` rows is miscalibrated |
| `intent` | The only body-sourced column: the why, the sequencing rationale, the gate definitions |
| `estimate` | Renders `thin` until the bucket reaches minimum `n` — the PDR-010 seam, §4 |

The schema deliberately does not carry sequence, horizons, or cross-cutting observations.
Those are the narrative document's sections; a table cell that tries to hold them is how
v1's row-per-item schema silently lost the product.

**The debt table and the debt sweep — added 2026-09-20.** The six runs were epic-centric,
and the first draft of this revision inherited the blindness. A census the same day found
412 of 525 open issues (78%) unparented — one-off bugs and chores with no epic, no
children, and no place in an epic-shaped artifact. The age profile is the tech-debt shape:
229 issues in the 30–90d band, 63 older, only 25 carrying `status:deferred` — neither
worked nor consciously deferred, just drifting. The data artifact therefore carries **two
tables**: the roadmap table above, and a **debt table** — the unparented population,
age-bucketed, with the bug/chore mix read from labels. `status:deferred` renders
separately *with its date*: deferred-on-the-record is a decision, aging-by-neglect is
drift, and the table exists to make the two distinguishable. The trust header carries the
>90d count, so a growing debt mass shows up in the committed diff without any new
mechanics.

Detection is not the hard half — disposition is, and §8's measured state says that is
already the binding constraint here. So the debt table has a mandated judgment pass, the
**debt sweep**, with the Layer 2 discipline adapted to work that has no body of claims:

- **Triage** — every item gets its `status:` label and `impl:` tier, or it is routed into
  the routing layer. (17 open bugs carried no status label at all on 2026-09-20.)
- **Reproduce-or-close for bugs** — a bug is verified to still reproduce, with the named
  command or observation, or the sweep proposes closure with the evidence attached. A
  one-off's claims live in its repro steps, not an epic body; that is what verifies.
- **Parenting and re-parenting** — loose issues that an epic owns get a proposed link;
  mis-parented ones get a proposed move. **Proposed, never applied**: a graph write is
  invisible in a PR diff — precisely the unreviewable class — so a human clicks. This is
  the remediation for the children-win inverse: the graph that was silently wrong because
  no link was ever made (#1886) gets a mechanism that makes the missing link visible.
- **A three-way disposition for aged items** — fix (scheduled), defer (with a date), or
  close (with a reason). Batched — the N oldest escalation candidates per run — because
  the cold-start mass (59 issues at 90–180d) cannot be dispositioned in one pass, and a
  wall gets ignored.

The trigger is the data artifact itself: the sweep runs against the freshly regenerated
debt table, on the same weekly cadence and on demand.

**The trust model, stated once.** The substrate is the **backlog**, not the roadmap — and it
is trustworthy only conditionally: the checks pass, and grooming runs on a cadence the repo
owner sets. The roadmap is a **projection** of that substrate plus the product owner's
future-facing statements. In the audiences this estate targets, product owner and repo owner
are usually the same person, so the whole mechanism must stay a one-person job. PDR-010
estimation then layers on the projection for capacity planning. What v1 keys now, so the
layer needs no retrofit, is unchanged: `Issue: #N` join keys on every generated row,
declared-at-dispatch attribution, bucket keys (tier, kind, files, existing test coverage,
work type, model, harness identity), `thin` below minimum `n`, gross and billable as
separate columns, and caps never derived by the estimation pass.

Two consequences of getting the substrate right:

- **Every projection carries the substrate's trust state in its header** — lint last green,
  last groom pass measured against the owner-configured cadence, the census line, and the
  >90d debt count. A lapsed cadence makes
  the projection untrusted by default and the header says so, because a stale roadmap that
  looks fresh is the incident this prompt exists to retire. **v2 makes the header a
  generated field of the data pass.** Not one of the six hand-built roadmaps carried it; a
  header the narrative pass must remember to render is a header that gets forgotten, and
  for "runnable from any session" it is the load-bearing feature — the next session has no
  other way to know whether the substrate under the projection is current.
- **Owner statements are a provenance class, not a free pass.** A future-facing statement
  enters the projection dated and attributed. It asserts intent about the future, so Layer 2
  claim-checking does not apply to it — but it expires like everything else, and if it names
  work, C5's markers pressure it into the backlog. (Unchanged in v2.)

**Versioning — what is versioned, where, and what a diff means.** v1 never asked; the owner
requires a versioned set of output artifacts. The answer, from the runs:

- The **data artifact** is committed, and its git diff is the real signal — it shows what
  changed in the backlog between two dates, mechanically, with no prose in the way.
- The **narrative document** is committed alongside it, and its diff is a human-readable
  record of how the reading changed.
- Anything published — an Artifact, a page — is a **render**, never the source of truth.

A re-run over an unchanged substrate must produce a **byte-identical** data artifact, or
every run is a spurious diff. That forbids wall-clock self-timestamps: the commit is the
timestamp, and every header field is a substrate fact that changes only when the substrate
changes. This is the determinism discipline `docs/system-map.md` imposes with
`PYTHONHASHSEED=0`, for the same reason.

**Placement — deliberately outside the records set.** The data artifact is rewritten
wholesale on every run; the narrative's marked sections likewise. That is the opposite of a
record. ai-fleet treats `docs/adr/`, `docs/pdr/`, `docs/code-conventions.md`,
`docs/testing-strategy.md` and `docs/agent-routing-records.md` as records — harness-denied
to raw edits, written only through `host/scripts/write-record.mjs`. The two artifacts land
at **`docs/roadmap-data.md`** (generated, never hand-edited) and **`docs/roadmap.md`**
(narrative, marked sections) — deliberately outside that set: no write-record involvement,
and the records stanza must not guard these paths.

**Schedule — a probe-class artifact, never a gate.** The owner asked for on-demand *and*
scheduled. A generated roadmap is a projection of live backlog state, not a function of a
diff — the 2026-08-18 erratum's rule applies verbatim: **diff-scoped gates gate;
state-scoped checks probe** (ADR-026). Layer 3 runs on demand from any session and on a
schedule that publishes the artifact; it never blocks a merge, and no downstream repo may
wire it as one.

**Extraction.** No `templates/` artifact for Layer 3 until one full ai-fleet cycle of v2
has run (PDR-010 Consequences 4) — the same discipline §8 applies to Layers 1–2, whose
gate is unaffected by this revision and is separately unmet (state recorded there).

## 4. The PDR-010 seam — keyed now, computed later

PDR-010 is Accepted (2026-08-17). This section aligns the roadmap to it **without** building
estimation: fleet-telemetry coverage of the routing population in ai-fleet is ~15%
(`docs/agent-routing-records.md`, 2026-08-17), so any estimate today would be noise — and
Consequences 4 forbids the template before one window has run regardless.

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

- **Step 0: install `check-stale-blockers.mjs` v1.0.0** (template shipped 2026-08-18 — no new
  build) and wire it per ADR-026 as a scheduled probe using the companion
  `templates/workflows/stale-blocker-probe.yml` (weekly cron, one rolling issue, P1 escalation
  on two consecutive runs). It covers the `blocked-by` half of C2 on day one; #1426's
  `**blocked-by:** #1425` fires on its existing dialect. The one judgment call is the
  `STALE_BLOCKERS_TOKEN` secret: ai-fleet's backlog references analytics-infrastructure, so an
  estate-spanning token is what keeps the cross-repo classes out of SKIPPED.
- Wire the lint per ADR-026 — report-only probe, then C1/C3/C4 as gates — and declare it in the
  lint-coverage manifest so it cannot rot unwired. ai-fleet has a live precedent: a validator
  sat declared-but-invoked-by-nothing for two weeks.
- Amend the DoD **Stale issue sweep**: it catches only closed-work-still-open. Add the inverse —
  *open work whose blockers closed* — and point it at the lint instead of at eyeballing
  `gh issue list`.
- Add one DoD line to the epic work type: **when a child closes, the parent's milestone table is
  updated in the same PR, or the lint's C6 finding stands as the record.**
- Declare the **grooming cadence** as a DoD line owned by the repo owner — in the target
  audiences the product owner and repo owner are usually the same person, so this stays a
  one-person setting. The projection's header renders `last groomed` against it (Layer 3),
  and a lapsed cadence is what untrusts the substrate.
- Make `Resolves: <repo>#N` mandatory in the ADR template (C3 depends on it).

**Why the mechanical half is not a folder in the weekly audit** — four reasons, each earned:

1. The audit is an *authored* document. Transcribing mechanical findings into it builds
   another artifact that decays between issues of itself — one more epic body. The audit cites
   the probe's trend line in its backlog domain, never the findings list.
2. The trigger is per-event: a child closing starts the clock, and #1752 went stale one day
   after its body was written. A weekly batch hides exactly that class.
3. ADR-026 keeps noisy probes off shared status surfaces, and the projection's trust header
   needs the probe's state queryable whether or not the audit ran this week.
4. The DoD's stale-issue sweep was manual and unscheduled — that is why it missed #1097/#1112
   (§2). Routing the mechanical half through a human-invoked ritual re-introduces that
   dependency.

PDR-008 made the same call for the claim enumerator: health metric plus repo-local
enumerator, not a ninth audit domain. The *judgment* half — groom passes, dispositions, the
false-positive review — does ride the audit ritual; that is human time already blocked.

## 6. How the applying repo proves it worked

- The lint runs clean, or every finding carries an accepted disposition.
- **Self-test against the incident.** Reconstruct ai-fleet's state as of 2026-08-20 and assert
  the **regime** — both probes plus the skill — flags: **#1097, #1112** (C1); **#1252, #1426,
  #1922, #1533** (C2 — #1426 via `check-stale-blockers`, the rest via the currency lint's
  prose form); **#1426** (C3); **#989** (C4); **#1454, #1426** (C5). A regime that cannot
  catch the incident that motivated it is not done.
- One `backlog-groom` pass on #1252 reports the RLS claim `stale`, citing
  `isRlsIsolationEnabled()` returning `true` unconditionally.
- A generated roadmap contains no assertion whose only source is an epic body.

## 7. Questions for the governance team

1. **Gate or probe for C2?** — **CONFIRMED 2026-08-21 (Greg):** the pilot's instinct stands.
   C1/C3/C4 promote to gates after the two report-only cycles; C2/C5/C6 stay probes. A body
   citing a closed blocker is always wrong, but the fix is a prose edit, and gating those on
   merge costs more friction than it buys.
2. **Who owns the correction?** — open. The skill proposes, a human merges. At what finding
   volume does that stop scaling, and is a fleet worker behind a review gate the answer?
3. **Per-repo or estate-wide?** — open. The lint is repo-local. The interesting roadmap joins
   several repos' graphs, which is where a cross-repo `Resolves: <repo>#N` form starts
   mattering.
4. **Grandfathering** — **CONFIRMED 2026-08-21 (Greg): none.** A stale body is stale
   regardless of age; the structure linter's date-based grandfathering does not extend to
   currency. The first run takes the hit — expect ~36 findings, every one dispositioned.

## 8. When this becomes a template

Per PDR-010 Consequences 4 the lint and the skill are built in ai-fleet and run one full cycle
before extraction. The extraction gate — all four required:

1. The §6 self-test passes against the reconstructed 2026-08-20 state.
2. Two scheduled probe cycles complete with every finding dispositioned (fixed, accepted, or
   the parse rule adjusted).
3. **False-positive review.** Any class that cried wolf gets its parse rule tightened in
   ai-fleet first — the template inherits the tuned rules, not the naive ones.
4. `backlog-groom` has run on ≥3 epics with the proposed corrections merged by a human.

**Gate state, measured 2026-09-20** — recorded here so the next reader does not re-derive
it. Verified against ai-fleet's rolling issues #2352/#2351 and the public probe run
history; groom-pass disposition is per ai-fleet's CLAUDE.md log and issue comments:

| Condition | State |
|---|---|
| 1. §6 self-test passes | **Met** — 13 fixture tests wired into `run-tests.yml` |
| 2. Two scheduled probe cycles, every finding dispositioned | **Not met.** Three cycles ran (Aug 31, Sep 7, Sep 14). Findings were not worked: the currency census moved from `C1=1 C2=24 C3=6 C4=46 C5=23 C6=4` over 436 open issues at install to `C1=1 C2=25 C3=1 C4=61 C5=38 C6=6` over 498 on Sep 14 — C4 and C5 grew |
| 3. False-positive review | **Substantially done, not recorded** — ai-fleet PR #2558 fixed the C3 cross-repo false positives and the C4 zero-link case; C3 fell 6 → 1, which is the evidence it worked. No discrete review artifact exists |
| 4. `backlog-groom` on ≥3 epics, corrections merged by a human | **Not met.** Passes exist on #1252, #1886, #1888; the proposed corrections were not applied — the skill proposes and does not edit, by design, and nobody closed the loop |

**The binding constraint is disposition, not detection**, and it has been the binding
constraint for three weeks. The Layer 3 v2 revision (§3, 2026-09-20) does not relax this
gate and is not an argument for extracting Layers 1–2.

The templates then ship contract-style, like everything else under `templates/`:
`templates/scripts/check-backlog-currency.mjs` and `templates/skills/backlog-groom/`, each
with a version stamp, an `/analyze-repo` matrix row, and fixture tests that fire on the
known-bad input and clear on the known-good — the self-test issues are the ready-made
fixtures. A `gh`-dependent template has precedent (`check-issue-routing.mjs`); PDR-010's
network foreclosure binds the *estimation* artifacts, which is why §4's column stays
contract-only.
