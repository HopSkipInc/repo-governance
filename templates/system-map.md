<!-- template: system-map.md v2.1.0 · updated 2026-08-10 -->
# Generated System Maps

**Status:** Policy — conventions verified by audit sweep
**Last updated:** 2026-08-10

## Purpose

Every governed repo ships a **generated system map**: a knowledge graph of the repo's code,
regenerated in the working session that changes the code and committed with that change.
It serves two consumers:

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
- The regeneration rule — who regenerates, when, and how
- Authorship separation (regeneration owns generated files; humans own prose)
- Publishing rules (what may be rendered where)
- Extraction mode and supply-chain pinning discipline
- The freshness probe (scheduled audit, not CI)
- The estate merge contract

Without this structure, generated maps rot in four predictable ways: machine output collides
with human edits, someone publishes an internal architecture map to anonymous static hosting,
an unpinned install becomes the estate's softest supply-chain surface, and freshness
automation silently never runs.

## What ships in each repo

1. `graphify-out/` — committed: `GRAPH_REPORT.md` (human-readable highlights), `graph.json`
   (the machine-consumable graph), `manifest.json` (incremental state),
   `.graphify_analysis.json` (feeds the tool's reflect/memory commands), and `graph.html`
   when the graph is under the viz limit. **Gitignored:** `graphify-out/cache/` and
   `graphify-out/.graphify_root` — machine-local state (`.graphify_root` embeds the
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
4. The regeneration block in the repo's agent instructions (`CLAUDE.md`, and `AGENTS.md`
   too if the repo's harnesses read it), installed by the downstream prompt.

**No CI workflow.** v1 of this policy shipped a push-triggered workflow that committed the
refreshed map back to the default branch. It deadlocks in every repo whose default branch
carries required status checks: the direct push is rejected (GH006/GH013), a
`GITHUB_TOKEN`-opened auto-PR never runs the required checks, and the Actions bot cannot be
added as a ruleset bypass actor via API (field report: enrichment-pipeline, 2026-08-09).
Freshness is a property of the working session plus the audit probe below — there is no
automation that pushes.

## The regeneration rule

**Whoever changes the code regenerates the map, in the same commit — agent or human.**

- **When:** any commit that adds, removes, or edits files the extractor classifies as code
  (in practice: every code-touching PR). Regeneration is idempotent — a docs-only change
  produces no graph diff and nothing is committed.
- **How** (the block the downstream prompt installs into agent instructions):

  ```bash
  PYTHONHASHSEED=0 uvx --from 'graphifyy[sql]==0.9.35' graphify extract . --code-only
  PYTHONHASHSEED=0 uvx --from 'graphifyy[sql]==0.9.35' graphify cluster-only . --no-label
  git add graphify-out/   # the map rides the same commit as the code change
  ```

- **`PYTHONHASHSEED=0` is not optional.** The tool pins its community-detection RNG seed
  but leaks CPython hash randomization into the partitioner's input order: with an unfixed
  hash seed, identical code yields a different community assignment every run (measured
  2026-08-09 on a 6,119-node repo: 3,283 nodes flipped communities run-over-run; with the
  fix, two full extract+cluster cycles were byte-identical). Without it every regeneration
  is diff churn and the delta read below is noise.
- **Read the delta after regenerating** (`git diff --stat graphify-out/`, then the
  node/link/community counts in the run output). The shape change is context for the change
  being made — the read is the point of doing this in-session, not compliance theater.
- A big delta is a prompt to look, not a failure. If a delta magnitude ever earns a gate,
  that is a ratchet-shaped decision (repo-governance issue 51), not a local edit.
- **Never run the tool's own platform installers** (`graphify claude install`,
  `graphify opencode install`, and friends). They write agent-instruction sections and
  hooks outside governance's stamps. The managed block from the downstream prompt is the
  only sanctioned install.

## Authorship separation

**Regeneration owns generated files. Humans own prose. Never mix.**

- `graphify-out/**` is written only by the regeneration commands above. Nobody hand-edits
  it; a hand edit is erased by the next regeneration and guarantees a diff war.
- Merge conflicts in `graphify-out/` are **regenerated, never hand-resolved**: re-run the
  two commands on the merged tree and commit the output.
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

Freshness is a **probe in the scheduled audit**, never a merge gate.

- **Check:** count commits since the last commit that touched `graphify-out/` which
  themselves touch code. More than **5** → audit finding, P2. An approximate count is
  fine — the probe leans toward false positives:

  ```bash
  last=$(git log -1 --format=%H -- graphify-out/)
  git rev-list --count "${last}..HEAD" -- ':!graphify-out' ':!*.md' ':!docs'
  ```

- **Remediation:** an agent session regenerates and opens a refresh PR — a normal
  author-actor PR, no special permissions anywhere.
- **Known hole, accepted on the record:** commits made outside any agent session (web-UI
  edits, quick human fixes, bot PRs) regenerate nothing. That is what the audit is for. If
  findings recur, the escalation is tightening the probe or promoting a gate through the
  ratchet path — never quietly living with a stale map.

## Estate contract

Per-repo `graphify-out/graph.json` is consumed by an estate-level process that merges
repo graphs into a cross-repo map. The contract is **location and format stability**:
extraction output stays at `graphify-out/graph.json`, produced by the pinned toolchain.
If a repo needs a nonstandard layout, say so in its downstream record — do not silently
move the artifact.

Runtime connection edges (which service actually points at which database/endpoint,
proven from Azure runtime config) are **not** produced by local extraction. They arrive
as a separate `edges.json` feed owned by infra-ops under its own guidance and review.
Repos do not inspect other repos' runtime config, ever.
