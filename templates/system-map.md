<!-- template: system-map.md v3.0.0 · updated 2026-08-12 -->
# Generated System Maps

**Status:** Policy — conventions verified by audit sweep
**Last updated:** 2026-08-12

## Purpose

Every governed repo ships a **generated system map**: a knowledge graph of the repo's code.
It is regenerated locally in the working session that changes the code — so the session can
read the delta while it works — and the committed copy on the default branch is refreshed
through a single serialized lane, the `chore/graphify-refresh` PR. It serves two consumers:

- **Humans (onboarding).** A new contributor's first real question is never "what is this
  file" — it is "what breaks if I change this." The map answers orientation questions before
  a senior engineer has to. `graphify-out/GRAPH_REPORT.md` renders natively on GitHub and is
  linked from the README; `graphify-out/graph.html` is the interactive view, opened locally
  from the clone (the tool skips generating it above its 5,000-node viz limit).
- **Agents (context).** A fresh clone is pre-briefed: coding assistants read the committed
  `graphify-out/` on day one instead of grepping cold. Per-repo graphs are also the feed
  stock for the estate-level map (see *Estate contract* below).

Tooling: [graphify](https://github.com/Graphify-Labs/graphify) (`graphifyy` on PyPI) —
local tree-sitter AST extraction, no LLM in the code path. This policy is about the
**conventions**, not the tool. If the tool is replaced, the conventions stay.

This template defines:

- What ships in each repo
- The in-session rule — who regenerates, when, and what they do with the output
- The refresh lane — the only writer of the committed map
- The lane gate that keeps every other branch from writing it
- Authorship separation (regeneration owns generated files; humans own prose)
- Publishing rules (what may be rendered where)
- Extraction mode and supply-chain pinning discipline
- The freshness probe (scheduled audit, not CI) that drives refreshes
- The estate merge contract

Without this structure, generated maps rot in predictable ways: machine output collides
with human edits, concurrent branches collide with each other, someone publishes an
internal architecture map to anonymous static hosting, an unpinned install becomes the
estate's softest supply-chain surface, and freshness automation silently never runs.

## What ships in each repo

1. `graphify-out/` — committed on the default branch: `GRAPH_REPORT.md` (human-readable
   highlights), `graph.json` (the machine-consumable graph), `manifest.json` (incremental
   state), `.graphify_analysis.json` (feeds the tool's reflect/memory commands), and
   `graph.html` when the graph is under the viz limit. **Gitignored:** `graphify-out/cache/`
   and `graphify-out/.graphify_root` — machine-local state (`.graphify_root` embeds the
   absolute checkout path, so committing it churns every other machine's diffs) — plus
   `graphify-out/cost.json`, per graphify's team setup.
2. One human-written line in `README.md`, e.g.:

   ```markdown
   - **System map** (generated): [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md)
   ```

3. A `.graphifyignore` if the repo needs exclusions beyond `.gitignore` (which graphify
   respects automatically). Because `graph.json` is committed, treat exclusions as
   defense in depth: `.env*`, `*.pem`, `*.key`, credential-shaped config, and vendored
   dependency dirs belong in `.graphifyignore` even when extraction is code-only.
4. The in-session block in the repo's agent instructions (`CLAUDE.md`, and `AGENTS.md`
   too if the repo's harnesses read it), installed by the downstream prompt.
5. The lane gate: `scripts/check-system-map-lane.mjs` wired into PR CI (see *The lane
   gate* below).

## No automation writes the map — the history of why

**v1 (CI commit-back)** shipped a push-triggered workflow that committed the refreshed map
to the default branch. It deadlocks in every repo whose default branch carries required
status checks: the direct push is rejected (GH006/GH013), a `GITHUB_TOKEN`-opened auto-PR
never runs the required checks, and the Actions bot cannot be added as a ruleset bypass
actor via API (field report: enrichment-pipeline, 2026-08-09).

**v2 (ride every commit)** moved regeneration into the working session and committed the
map with each code change. That made the map a whole-tree derived artifact written on
every concurrent branch: any two code-touching PRs regenerate different bytes into the
same files, so every pair of concurrent code PRs conflicts in `graphify-out/**`. With
fleet workers and interactive sessions holding several PRs open at once, every merge
window serialized into rebase → regen → push → CI-rerun cycles (field reports 2026-08-10
through 2026-08-12, enrichment-pipeline and ai-fleet). The conflicts were resolvable —
v2 said regenerate, never hand-resolve — but never avoidable.

**v3 (this policy)** separates the two things v2 fused. In-session regeneration keeps its
value — the delta read while working — and loses its cost by never being committed on a
working branch. Freshness moves to a single serialized lane, so two writers of the
committed map cannot exist. There is still no automation that pushes: refreshes are
ordinary agent-or-human PRs driven by the audit probe below.

## The in-session rule

**Whoever changes the code regenerates the map locally, reads the delta, and commits none
of it.**

- **When:** any working session that adds, removes, or edits files the extractor
  classifies as code. Regeneration is idempotent — a docs-only change produces no graph
  diff and the read takes seconds.
- **How** (the block the downstream prompt installs into agent instructions):

  ```bash
  PYTHONHASHSEED=0 uvx --from 'graphifyy[sql]==0.9.35' graphify extract . --code-only
  PYTHONHASHSEED=0 uvx --from 'graphifyy[sql]==0.9.35' graphify cluster-only . --no-label
  git diff --stat graphify-out/     # the delta read — the point of doing this in-session
  git restore graphify-out/         # the map is a lens, not a deliverable
  ```

- **`PYTHONHASHSEED=0` is not optional.** The tool pins its community-detection RNG seed
  but leaks CPython hash randomization into the partitioner's input order: with an unfixed
  hash seed, identical code yields a different community assignment every run (measured
  2026-08-09 on a 6,119-node repo: 3,283 nodes flipped communities run-over-run; with the
  fix, two full extract+cluster cycles were byte-identical). Without it the delta read is
  noise.
- **Read the delta against the committed baseline.** The diff is your change's shape
  measured against the last refresh of master. Close to a refresh that is exact; inside
  the probe window it may include a few commits' shape change that is not yours. A big
  delta is a prompt to look, not a failure. If a delta magnitude ever earns a gate, that
  is a ratchet-shaped decision (repo-governance issue 51), not a local edit.
- **Never commit `graphify-out/` on a working branch.** The lane gate below fails the PR
  if you do — forgetting is a CI failure, not a merge conflict.
- **Never run the tool's own platform installers** (`graphify claude install`,
  `graphify opencode install`, and friends). They write agent-instruction sections and
  hooks outside governance's stamps. The managed block from the downstream prompt is the
  only sanctioned install.

## The refresh lane — the only writer of the committed map

The committed map on the default branch is updated **only** by pull requests from
`chore/graphify-refresh*` branches.

- **Trigger:** the freshness probe below (scheduled audit, not CI). When the probe fires,
  an agent or human session regenerates and opens the refresh PR — a normal author-actor
  PR, checks run, no special permissions anywhere.
- **One lane at a time.** Before opening a refresh PR, check for an open one
  (`gh pr list --head chore/graphify-refresh --state open`). If one exists, regenerate
  onto that branch instead of stacking a second refresh PR — two open refresh PRs are
  the only remaining way to produce a `graphify-out/` conflict, and the check removes it.
- **Contents:** a refresh PR touches `graphify-out/**` and nothing else (the gate's R2
  enforces this). Merge it promptly; it never conflicts with ordinary PRs, so it is
  never the PR that has to wait.
- **Merge conflicts on the lane itself** (a refresh PR open while another refresh
  merges) are regenerated, never hand-resolved: re-run the two extraction commands on
  the rebased tree and push.
- **Bootstrap:** the one-time install PR uses the branch name `chore/graphify-install`
  and may carry the first committed map alongside its README, `.gitignore`, and
  agent-instruction edits. After install, the steady-state lane takes over.

## The lane gate

`scripts/check-system-map-lane.mjs` runs on every PR and keeps the single-writer
invariant:

- **R1:** a PR whose diff touches `graphify-out/**` must be on a `chore/graphify-refresh*`
  or `chore/graphify-install` branch.
- **R2:** a `chore/graphify-refresh*` branch may touch only `graphify-out/**` — the lane
  never becomes a way to smuggle code changes past review.
- **Fails closed.** If the change set or the branch name cannot be determined, the check
  reports SKIPPED and fails rather than passing — a gate that cannot see its input is
  not a gate.

This is a **provenance gate** — it constrains *who may write the artifact*, not how large
the change is — so it is orthogonal to the ratchet question (repo-governance issue 51)
and does not wait on it. It is a gate rather than a CLAUDE.md convention because
`CLAUDE.md` does not bind humans pushing from web UIs or interactive sessions; a
committed map edited outside the lane is exactly the conflict source this policy exists
to remove.

## Authorship separation

**Regeneration owns generated files. Humans own prose. Never mix.**

- `graphify-out/**` is written only by the regeneration commands, and committed only on
  the lanes named above. Nobody hand-edits it; a hand edit is erased by the next
  regeneration and guarantees a diff war.
- `README.md` is written only by humans. The system-map link line is added once, by a
  human, at install time. No automation edits the README.
- Any machine-maintained derived doc (e.g. a Mermaid architecture page) lives in its own
  file under `docs/`, never inside human-authored prose.

## Publishing rules

- `GRAPH_REPORT.md` — committed markdown; renders natively on GitHub. This is the
  canonical shared view.
- `graph.html` — **local-open only** (`open graphify-out/graph.html` from a clone).
  GitHub does not render committed HTML; GitHub Pages on private repos is publicly
  readable unless the org pays for Enterprise access control.
- **Never deploy graph artifacts to anonymous static hosting.** A knowledge graph of an
  internal repo is internal data — file names, architecture, doc contents. Static files
  on Azure Static Web Apps are served anonymously unless route auth is configured, so
  "just upload it to the admin site" is a data leak with extra steps. If a web-published
  map is ever wanted, it goes through an authenticated host route — that is a separate,
  gated decision.

## Extraction mode

`--code-only` is the default and the only mode installed by the downstream prompt:
tree-sitter AST, deterministic under a fixed hash seed, zero LLM cost, **no API keys
anywhere in the loop**. Semantic extraction of docs/PDFs/images requires a model key and
is opt-in per repo via a future governance prompt — never by local edit. Community naming
is the one LLM call in the toolchain; `--no-label` keeps it out, so placeholder names
(`Community N`) in the report are expected, not a defect.

**SQL coverage is file-level inventory only — the symbol layer is untrusted.** The pinned
install carries the `[sql]` extra so that `.sql` files enter the graph as file nodes
(estate survey, 2026-08-10: every governed repo but infra-ops holds a SQL corpus, and
analytics-infrastructure's is its center of gravity). What the grammar
(derekstride/tree-sitter-sql) cannot do is parse the estate's dialects: T-SQL bracketed
identifiers and `CREATE OR ALTER` parse through ERROR nodes (0.4% of one repo's corpus
parses clean), and Postgres `DO $$` / `ON CONFLICT` fare little better (16% clean). The
consequences, accepted on the record: SQL **symbol** nodes are mostly mangled labels
(`sourcing].[affiliates`), SQL-sourced `reads_from` edges dangle to never-created nodes,
and occasional `references` edges are name-collision noise. File nodes are sound —
inventory, community membership, freshness signal. Do not answer dependency questions
("what reads this table") from SQL symbols or edges. If the grammar improves, the
unfloored dependency floats the fix in on the next regeneration and this note gets
revisited.

## Supply chain

The pinned install is `uvx --from 'graphifyy[sql]==<pinned>'` — an exact version with the
SQL extra, managed by this template's stamp. Bumps arrive via repo-governance downstream
sync, not local edits, so the estate upgrades in one move instead of drifting into N
versions. Never float `latest`. Three accepted properties, on the record: `uvx` resolves
transitive dependencies at run time, so a transitive bump can reshuffle community
assignments once (a one-time delta, then it restabilizes — a per-repo lockfile costs more
than that noise); the extra's one added dependency, `tree-sitter-sql`, is declared
**unfloored** upstream, so a grammar release can shift SQL parse shape between runs with
no pin bump (the same mechanism floats grammar *fixes* in free — accepted, because the
alternative is pinning a grammar whose T-SQL support we want to improve underneath us);
and any version bump re-verifies determinism with the double-run diff from the downstream
prompt before rolling out. (2026-08 Shai-Hulud: the estate survived an npm worm because
every CI install was lockfile-bound. The pin is that discipline applied to a non-CI
install.)

## Freshness probe (audit, not CI)

Freshness is a **probe in the scheduled audit**, never a merge gate. It is now also the
**only refresh trigger**: when it fires, the remediation is the refresh lane above.

- **Check:** count commits since the last commit that touched `graphify-out/` which
  themselves touch code. More than **5** → audit finding, P2. An approximate count is
  fine — the probe leans toward false positives:

  ```bash
  last=$(git log -1 --format=%H -- graphify-out/)
  git rev-list --count "${last}..HEAD" -- ':!graphify-out' ':!*.md' ':!docs'
  ```

- **Remediation:** an agent or human session opens a `chore/graphify-refresh` PR (after
  checking none is open already). That PR is the only permitted writer of the committed
  map — a staleness finding is never fixed by committing a regen from whatever branch
  you happen to be on.
- **Accepted staleness window.** Between refreshes the committed map trails master by at
  most the probe threshold (~5 code commits). Onboarding reads, day-one agent context,
  and the estate feed all tolerate this; the in-session delta read is exact near a
  refresh and approximate inside the window.
- **Known hole, accepted on the record:** commits made outside any agent session (web-UI
  edits, quick human fixes, bot PRs) regenerate nothing, and now cannot commit the map
  at all — the lane gate sees to that. That is what the audit is for. If findings recur,
  the escalation is tightening the probe or adding automation through the ratchet path —
  never quietly living with a stale map, and never re-opening write access to every
  branch.

## Estate contract

Per-repo `graphify-out/graph.json` is consumed by an estate-level process that merges
repo graphs into a cross-repo map. The contract is **location and format stability**:
extraction output stays at `graphify-out/graph.json` on the default branch, produced by
the pinned toolchain. If a repo needs a nonstandard layout, say so in its downstream
record — do not silently move the artifact.

Runtime connection edges (which service actually points at which database/endpoint,
proven from Azure runtime config) are **not** produced by local extraction. They arrive
as a separate `edges.json` feed owned by infra-ops under its own guidance and review.
Repos do not inspect other repos' runtime config, ever.
