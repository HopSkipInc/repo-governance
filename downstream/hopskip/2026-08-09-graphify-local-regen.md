# Governance update: system maps move to in-session regeneration (2026-08-09)

**Applies to:** all governed repos, both `full` and `core` adoption class.
**Supersedes:** `2026-08-07-graphify-system-maps.md` — **do not apply the v1 prompt.** Any
repo that installed it takes step 0 below.
**Policy version to install:** `templates/system-map.md` v2.0.0 or later — read the stamp,
do not assume.
**Templates:** `templates/system-map.md`. (The v1 workflow template
`templates/workflows/graphify-report.yml` is deleted. Nothing replaces it in CI — that is
the point.)

## Why the redesign

The v1 install hit a wall in enrichment-pipeline (PRs #474/#475, field report 2026-08-09):
the workflow's commit-back to the default branch is rejected in every repo with required
status checks — direct push blocked (GH006 under classic protection, GH013 under the
ruleset), the Actions bot cannot be added as a ruleset bypass actor via API (422), and a
`GITHUB_TOKEN`-opened auto-PR never triggers the required checks. Every mature governed
repo has required checks, so the v1 workflow could never land its commit. The extraction
pipeline itself was clean — only the commit-back shape was broken.

The redesign deletes the workflow and moves regeneration into the working session: whoever
changes the code regenerates the map in the same commit. That is immune to the whole class
of failure above (a real author pushes; checks run normally), it keeps the graph exactly as
fresh as the code, and it buys something the workflow never could: the agent reads the
graph delta *while working*, which is the map's orientation value in miniature.

Two constraints the design is built around, both measured on the real estate:

- **`PYTHONHASHSEED=0` is required for determinism.** The tool pins its clustering RNG
  seed but leaks CPython hash randomization into the partitioner's input order. Without a
  fixed hash seed, identical code produced a different community assignment every run
  (3,283 of 6,119 nodes flipped run-over-run); with it, repeated cycles are byte-identical.
- **Two artifacts are machine-local** and must be gitignored: `graphify-out/cache/` and
  `graphify-out/.graphify_root` (the latter embeds the absolute checkout path).

---

## Step A — which path are you on?

```bash
ls docs/system-map.md .github/workflows/graphify-report.yml graphify-out/ 2>/dev/null
```

- **Nothing installed** → steps 1–6.
- **v1 installed** (the workflow file exists, enabled or disabled, with or without a
  committed `graphify-out/`) → step 0, then steps 1–6.
- **v2 already installed** (`docs/system-map.md` stamps ≥ v2.0.0) → nothing to do here.

## Steps

**0. (v1 installs only) Remove the CI commit-back.** Delete
`.github/workflows/graphify-report.yml`. If branch protection or the repo ruleset was
modified while attempting the v1 install, confirm it is restored to its pre-install state
(enrichment-pipeline already did). If a bot commit ever landed, leave the history — the
next regeneration normalizes the content. Remove the workflow's row from the
synced-templates table if one was declared.

**1. Install the policy.**

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/system-map.md docs/system-map.md
```

Confirm the stamp reads ≥ v2.0.0 and §Regeneration rule names the current `graphifyy` pin.
Declare (or keep) the `docs/system-map.md` row in the synced-templates table.

**2. Add `.graphifyignore` if needed.** Unchanged from v1: `.gitignore` is respected
automatically. Add `.graphifyignore` with defense-in-depth exclusions for anything
credential-shaped (`.env*`, `*.pem`, `*.key`) plus vendored/generated dirs not already
ignored. `graph.json` is committed — exclusions are cheaper than explanations.

**3. Gitignore the machine-local artifacts.** Add to `.gitignore`:

```gitignore
graphify-out/cache/
graphify-out/.graphify_root
graphify-out/cost.json
```

**4. Install the regeneration block in the repo's agent instructions.** Add to `CLAUDE.md`
— and to `AGENTS.md` as well if the repo's harnesses read it (fleet workers ingest the
target repo's `CLAUDE.md` natively; opencode sessions read `AGENTS.md`):

```markdown
## System map

Before committing any change that touches code files, regenerate the system map and
commit `graphify-out/` with the same change:

    PYTHONHASHSEED=0 uvx --from 'graphifyy==0.9.35' graphify extract . --code-only
    PYTHONHASHSEED=0 uvx --from 'graphifyy==0.9.35' graphify cluster-only . --no-label

Then read the delta (`git diff --stat graphify-out/`) — the shape change is context for
your work. `PYTHONHASHSEED=0` is required: community detection is non-deterministic
without it. Never hand-edit `graphify-out/`; conflicts there are regenerated, never
hand-resolved. Full policy: docs/system-map.md.
```

Do **not** run `graphify claude install` / `graphify opencode install` — the tool's own
platform installers write unmanaged agent-instruction sections and hooks. The block above
is the only sanctioned install.

**5. First regeneration, with the determinism check.** Run the two commands, then prove
byte-stability before committing:

```bash
PYTHONHASHSEED=0 uvx --from 'graphifyy==0.9.35' graphify extract . --code-only
PYTHONHASHSEED=0 uvx --from 'graphifyy==0.9.35' graphify cluster-only . --no-label
cp -r graphify-out /tmp/graphify-verify
PYTHONHASHSEED=0 uvx --from 'graphifyy==0.9.35' graphify extract . --code-only
PYTHONHASHSEED=0 uvx --from 'graphifyy==0.9.35' graphify cluster-only . --no-label
diff -r /tmp/graphify-verify graphify-out   # must be empty
```

Any diff at all: stop and report to repo-governance — the determinism assumption this
policy stands on has broken (tool version, transitive dependency, or platform). Otherwise
commit `graphify-out/` in the PR that applies this prompt, along with the README line:

```markdown
- **System map** (generated): [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md)
```

**6. Record the install.** Append to the Applied-governance list in CLAUDE.md:
`[2026-08-09-graphify-local-regen.md] — applied <date>`.

---

## Explicitly out of scope

- **Any CI workflow for the map.** No scheduled run, no PR check, no commit-back. The
  estate tried it; required status checks make it unlandable, and the scheduled-audit
  freshness probe (policy §Freshness probe) covers the stragglers. If you believe your
  repo needs a gate, that conversation goes through repo-governance's ratchet path, not a
  local workflow.
- **Semantic (LLM) extraction of docs/PDFs.** Unchanged from v1: code-only is the
  installed default; no API keys anywhere in the loop.
- **Web-publishing the map.** Unchanged from v1: `graph.html` is local-open only, never
  anonymous static hosting (policy §Publishing rules).
- **Cross-repo runtime edges.** Unchanged from v1: infra-ops' collector work, governed by
  its own downstream prompt. Repos do not inspect other repos' runtime config.
