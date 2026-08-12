# Governance update: system maps move to commit-on-master-only (2026-08-12)

**Applies to:** all governed repos with system maps installed (`docs/system-map.md` stamped
v2.x). Both `full` and `core` adoption class.
**Supersedes:** the regeneration rule in `2026-08-09-graphify-local-regen.md`. Everything
else from that prompt stands — the pin, the determinism requirement, the gitignored
machine-local artifacts, the no-installer rule.
**Policy version to install:** `templates/system-map.md` v3.0.0 or later — read the stamp,
do not assume.
**Templates:** `templates/system-map.md`, `templates/scripts/check-system-map-lane.mjs`.
**Issue:** repo-governance #<79>.

## Why the change

v2 made the map ride every code commit. That put a whole-tree derived artifact on every
concurrent branch: any two code-touching PRs regenerate different bytes into the same
files, so every pair of concurrent PRs conflicted in `graphify-out/**`. With fleet workers
and interactive sessions holding several PRs open at once, every merge window serialized
into rebase → regen → push → CI-rerun cycles. The conflicts were resolvable — v2 said
regenerate, never hand-resolve — but never avoidable.

v3 separates what v2 fused. The in-session regeneration keeps its value — the delta read
while working — and loses its cost by never being committed on a working branch. The
committed map gets a single writer: `chore/graphify-refresh` PRs, driven by the existing
audit freshness probe. **No new automation** — that was a deliberate decision; the probe
and its human/agent remediation already exist.

## Step A — which path are you on?

```bash
head -1 docs/system-map.md; ls scripts/check-system-map-lane.mjs 2>/dev/null
```

- **Stamp ≥ v3.0.0 and the lint present** → nothing to do here.
- **Stamp v2.x** → steps 1–5.
- **No system map installed** → this prompt is not your install path; `/analyze-repo` or
  the v2 prompt's successor covers bootstrap. (Bootstrap branch name is
  `chore/graphify-install` — see policy §The refresh lane.)

## Steps

**1. Install the policy.**

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/system-map.md docs/system-map.md
```

Confirm the stamp reads ≥ v3.0.0. Keep the `docs/system-map.md` row in the
synced-templates table.

**2. Swap the agent-instruction block.** In `CLAUDE.md` (and `AGENTS.md` if the repo's
harnesses read it), replace the v2 `## System map` block — the one that says "commit
`graphify-out/` with the same change" — with:

```markdown
## System map

Before committing any change that touches code files, regenerate the system map locally
and read the delta — then restore it. The map is a lens, not a deliverable: never commit
graphify-out/ on a working branch (the lane lint fails the PR if you do).

    PYTHONHASHSEED=0 uvx --from 'graphifyy[sql]==0.9.35' graphify extract . --code-only
    PYTHONHASHSEED=0 uvx --from 'graphifyy[sql]==0.9.35' graphify cluster-only . --no-label
    git diff --stat graphify-out/   # the delta read — context for your work
    git restore graphify-out/       # commit none of it

The committed map on master is refreshed only by chore/graphify-refresh PRs, triggered by
the audit freshness probe (docs/system-map.md §Freshness probe). To refresh on purpose:
check no refresh PR is open, branch chore/graphify-refresh from master, regenerate, open
the PR touching graphify-out/ only. PYTHONHASHSEED=0 is required: community detection is
non-deterministic without it. Never hand-edit graphify-out/; conflicts there are
regenerated, never hand-resolved. SQL coverage is file-level inventory only — do not
trust SQL symbol nodes or SQL-sourced edges (docs/system-map.md §Extraction mode says
why). Full policy: docs/system-map.md.
```

**3. Install the lane gate.** Copy the lint and wire it into PR CI:

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-system-map-lane.mjs scripts/
```

In the repo's PR workflow (checkout must use `fetch-depth: 0`):

```yaml
- name: System map lane
  run: node scripts/check-system-map-lane.mjs --base "${{ github.event.pull_request.base.sha }}"
```

`GITHUB_HEAD_REF` supplies the branch name automatically in Actions. Verify the gate is
live by opening the PR that applies this prompt and watching the check run — it should
pass, because this PR must not touch `graphify-out/` (see step 4).

**4. Do not regenerate the map in the applying PR.** That is the whole point of v3. The
applying PR touches `docs/system-map.md`, `CLAUDE.md`/`AGENTS.md`, `scripts/`, and CI —
nothing under `graphify-out/`. Open PRs that already carry committed `graphify-out/`
diffs may merge as they are; the next refresh normalizes the content. The audit probe
will schedule the first v3 refresh on its own.

**5. Record the application.** Append to the Applied-governance list in CLAUDE.md:
`[2026-08-12-system-map-v3.md] — applied <date>`. Add `scripts/check-system-map-lane.mjs`
to the synced-templates table.

---

## Explicitly out of scope

- **Any automation that refreshes the map.** The refresh lane is a human-or-agent PR
  driven by the audit probe. If your repo wants scheduled automation, that conversation
  goes through repo-governance's ratchet path — the v1 field report (commit-back
  deadlocks against required status checks) is why.
- **The staleness window.** Between refreshes the committed map trails master by at most
  the probe threshold (~5 code commits). That is accepted on the record in policy
  §Freshness probe; do not "fix" it by committing regens from working branches.
- **Extraction mode, publishing rules, supply chain, estate contract.** Unchanged from
  v2.1.0; see the policy.
