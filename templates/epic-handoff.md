<!-- template: epic-handoff.md v1.0.0 · updated 2026-09-26 -->
# Epic handoff — the rolling continuation section

**Status:** Policy — a section convention for epic bodies, enforced by
`scripts/check-epic-handoff.mjs` (a probe, never a gate) and by the session/child-close
rows in `definition-of-done.md`.

**Related:** [Issue Authoring](issue-authoring.md) · [Definition of Done](definition-of-done.md)
· [Agent Routing](agent-routing.md)

## The failure this prevents

An epic is worked across many sessions. Between them, the live state of the work — what
just shipped, what is next and why, which decision was already made, which small
records-gated item is still open, which trap already cost an hour — lives only in the
session that produced it. When that session ends, the state does not transfer:

- the session is **restarted or crashes** mid-epic;
- a **fleet or subagent finishes one child** and the parent never learns;
- a **different worker** picks the epic up in parallel;
- the operator simply **stops for the night**.

The next session re-derives the state from a dozen child issues, a handful of PRs, and
the activity ledger — usually correctly, occasionally wrong in a way nothing flags, and
always at the cost of the first hour. On a gateway epic with ~40 children and a
cross-repo dependency, the re-derivation is the expensive part of the session.

The epic body is the right home for the continuation because it **already aggregates
the children** — it is the one surface that is both about the child state and read by
the next session — and it needs no new tool, store, or ritual. This template is the
discipline that makes that section reliable rather than decorative.

## Template

Add this section to an **epic** body, near the top — after the summary, above any phase
history — so it is the first thing a reader reaches. Keep the stamp comment: it names
the template and version a session is following.

```markdown
## ▶ Pick up here — rolling handoff

<!-- template: epic-handoff.md v1.0.0 · updated 2026-09-26 -->

**Handoff updated:** YYYY-MM-DD
**Read this first — it is current state, not history. Point every new session at this epic and start here.**

**Last session shipped (newest first):**
- #<child> (PR #<n>) — <one line: what changed and the effect it had on the epic>
- …

**Do next, in this order:**
1. <the first move — often operational, e.g. a workflow dispatch a sleeping session would not know to run>
2. #<issue> (`impl:<tier>`, `status:<state>`) — <what and why>
3. …

**Decisions already recorded (do not re-litigate):**
- <decision> — recorded in <ledger / ADR / issue comment>

**Open, small, records-gated (do not lose):** #<a>, #<b> — <what record it edits and why it needs a human>

**Traps that bit this session:**
- <the specific thing that will bite the next session; durable ones graduate to CLAUDE.md>

**Epic-wide, unchanged by this session:** #<x>, #<y> … _(or: nothing — the do-next list is the whole queue)_
```

The heading is the marker; the probe matches `## ▶ Pick up here` and tolerates the glyph
being dropped (`## Pick up here`). The `▶` is there to make the section findable by a
human scanning a long body, not because a parser needs it.

## The rules

**1. The date is mandatory.** `**Handoff updated:** YYYY-MM-DD` is the section's freshness
marker and the only field the probe reads. It is the same discipline as the dated
`## Status` line in `issue-authoring.md`: an undated assertion can never age, which is
exactly how a handoff stays "current" for a month after its do-next order stopped being
true. Re-dating is what a refresh means. (The probe also tolerates the legacy shape
`## ▶ Pick up here — rolling handoff (updated YYYY-MM-DD)` so an existing section is not
broken by adopting this policy, but a new section puts the date on its own line.)

**2. It is a projection, not a source of truth.** The child issues, the merged PRs, and
the activity ledger are the truth. The handoff is a **dated curation** for the next
session. When the handoff and the child graph disagree, **the graph wins** — the same
rule the generated roadmap applies. A handoff that is re-dated without being re-read, or
that asserts a child's status the body cannot see, is drift; re-derive from the graph.

**3. It is bounded — one screen, roughly 40 lines.** It is a pointer, not a log. If it is
growing, the content belongs somewhere else and should be linked, not pasted: durable
traps graduate to `CLAUDE.md`, a settled decision to an ADR or the ledger, a new unit of
work to a child issue. A handoff that mirrors the backlog becomes a second backlog to
maintain, and the second one always loses.

**4. It is current-state, not history.** Overwrite the slots each refresh. The phase
history and closure log live in the sections below the handoff; the handoff never grows a
changelog.

**5. On close, retire it.** When the epic closes, replace the section with a final
"What shipped" summary (no do-next list) or remove it. A rolling handoff left on a closed
epic is a fresh-looking pointer to work that no longer exists.

## When to read and when to write

**Read it first.** At session start, before touching anything in an epic: if
`Handoff updated` predates the newest child close, or is older than the cadence, treat
the do-next order as **untrusted** — verify it against the children, the PRs, and the
ledger before acting on it. A stale handoff is not wrong; it is unverified, and the
cheap move is to re-read the graph rather than trust a month-old ordering.

**Write it at every boundary that changes the epic's state:**

- at **session end**, if the session worked anywhere in the epic;
- the moment a **child closes** (include its PR number in the shipped line, re-date);
- when a **PR into the epic merges**;
- when a **decision is recorded** that constrains the next step;
- when a **blocker is discovered**.

## Single writer when more than one session may run

An epic body is a shared mutable document. Two sessions — or several fleet workers —
editing it concurrently race, and the loser's edit vanishes with no conflict to resolve,
because a GitHub issue body has no merge.

- **The orchestrator owns the epic body.** Workers report their outcome through the
  activity ledger and their own issue/PR; the orchestrator folds each worker's result
  into the handoff once, at the next checkpoint. Workers do not write the epic body.
- **A solo session that owns the epic** writes its own handoff directly. When two
  sessions *might* run, one is named the writer first.
- **If a worker must write with no orchestrator**, it edits only its own line in *Last
  session shipped* and leaves *Do next* for the owner — the ordering is the part that
  needs one reader.

This is the same single-writer discipline the generated system map uses: the artifact
that everyone reads has exactly one writer at a time.

## Relationship to the roadmap / grooming regime

The handoff is not a second status surface. Where the grooming regime (the backlog
currency lint + groom skill + generated roadmap — built in ai-fleet first, template
extraction pending PDR-010 Consequences 4) is installed, the division of labour is
explicit:

- **`check-backlog-currency.mjs` owns the body-versus-graph axis.** It already emits
  `info … TRIGGER children-changed-since-body-update` when a child's `closed_at` is newer
  than the epic's `updated_at` — the graph-level form of "the body missed a change."
- **`check-epic-handoff.mjs` owns the handoff section alone** — presence, the dated
  marker, and its age. It reads only the epic body; it does **not** enumerate children.
  Two detectors sharing one citation grammar is the two-enumerators hazard PDR-008
  names, so this one stays single-axis on purpose.
- **The handoff is the epic-level analogue of the roadmap's trust header.** A stale
  marker renders the do-next order *untrusted*; it does not make it wrong. The
  `Handoff updated` date is a human/session assertion, not a generated field — because an
  issue body is not a committed artifact, the next session is the reader, and the whole
  point is that a *session* did or did not refresh it.
- **The groom pass posts its own machine marker comment on the epic.** The handoff links
  to it; it never reproduces the groom counts.

## Design notes

- **Why a section in the epic, not a tool.** The board already exists and already nests
  the children. A handoff store is a second surface to keep in sync with the same graph,
  and the surface nobody opens is the one that rots. This costs one section and no
  infrastructure.
- **Why the date and the probe.** The failure is silent — a handoff that stopped being
  true looks identical to one that is current. Without a dated marker there is nothing
  to age and nothing for a detector to read; the marker is what converts "we have a
  handoff" into "the handoff is twelve days old, distrust it." See
  `scripts/check-epic-handoff.mjs` and `workflows/epic-handoff-probe.yml`.
- **Probe, never a gate.** A stale handoff is a state of the backlog, not a property of
  a diff (ADR-026; the 2026-08-18 erratum). It is scheduled, ships report-only, and the
  promotion to gate is earned after a false-positive review — not assumed.
- **The four slots are the observed minimum.** They are what the first live application
  (analytics-infrastructure epic #229, 2026-09-25) actually carried and what the next
  session actually needed: what shipped, what is next (with the operational step first),
  which decisions are already made, and which traps cost time. The two extra slots —
  small records-gated items, and the unchanged epic-wide queue — exist because those are
  the two things a session forgets to mention and the next session cannot rediscover
  cheaply.
