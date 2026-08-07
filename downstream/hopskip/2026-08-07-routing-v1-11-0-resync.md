# Governance update: agent-routing v1.11.0 re-sync — analytics-infrastructure + enrichment-pipeline (2026-08-07)

**Applies to:** the two `full`-class routing adopters still on policy v1.10.0 — steps
differ per repo, see the table.
**Source:** repo-governance PR #47 (agent-routing v1.11.0, merged 2026-08-05). ai-fleet
already received this bump inside `ai-fleet/2026-08-05-agent-routing-v1-11-0.md` — this
prompt is the policy re-sync for the remaining adopters. There is **no enforcement
half** here: v1.11.0's contract text lands on fleet dispatch surfaces, and these repos
dispatch nothing.

| Repo | Steps | Carried |
|---|---|---|
| HopSkipInc/analytics-infrastructure | 1–3 | routing policy 1.10.0 → 1.11.0. Governance section (v1.3.1) and routing-triage (1.6.1) already current. |
| HopSkipInc/enrichment-pipeline | 1–5 | routing policy 1.10.0 → 1.11.0, routing-triage 1.6.0 → 1.6.1, governance section v1.2.0 → v1.3.1 |
| HopSkipInc/ai-fleet | — | already carried by the 2026-08-05 prompt |
| HopSkipInc/infra-ops | — | `core` class (PDR-009); agent-routing intentionally not installed |

## What changed upstream

- **`agent-routing.md` v1.10.0 → v1.11.0 — "delegation is dispatch."** Three dispatch
  shapes (human launch, agent-driver delegation, fleet dispatcher); a driver that
  delegates implementation work on a tiered issue becomes the dispatcher for that unit
  of work — the delegation prompt carries the tier, kind, reason verbatim, stop
  conditions, and a scope ceiling, and the driver's class does not transfer. Subtask
  delegation may route mechanical subtasks below the issue's tier; the boundary residue
  may not. Anti-pattern 12 names delegating below tier because the driver is frontier.
- **`routing-triage` SKILL v1.6.0 → v1.6.1** — one line: the opencode classifier
  install path swept from `~/repos/greg/repo-governance` to
  `~/repos/HopSkipInc/repo-governance` (org-transfer sweep, 2026-08-03).
- **`governance-sync-claude-section.md` v1.2.0 → v1.3.1** (two hops): v1.3.0 added the
  adoption-class sentence (PDR-009); v1.3.1 was the same path sweep. This section is the
  loop that tells the repo's agents where pending prompts live — the stale path breaks
  the delivery mechanism prompts arrive by.

## Steps

**1. Re-sync `docs/agent-routing.md` to v1.11.0.**

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md docs/agent-routing.md
diff -q docs/agent-routing.md ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md
```

Byte-identical, stamp header intact. `diff -q` must clear.

**2. CLAUDE.md agent-routing section: add the delegation paragraph**, immediately
before the "You may escalate an issue's tier at any time…" sentence. Pre-check the
anchor first — if it is absent, **stop and report** rather than improvising placement:

```bash
grep -c "You may escalate an issue's tier" CLAUDE.md   # expect 1
```

```markdown
Delegating is dispatching. When you hand implementation work on a tiered issue to a
subagent, you become the dispatcher for that unit of work: check the subagent's
capability class against the tier (your own class does not transfer), and put the tier,
kind, reason, stop conditions, and a scope ceiling in the delegation prompt — the
subagent sees nothing of this conversation. Concurrent subagents need disjoint file
surfaces or separate worktree lanes, exactly as concurrent sessions do. Subagents
prepare; you review and merge.
```

**3. `### Synced templates` table:** bump the `docs/agent-routing.md` row's version
cell to `1.11.0`, dated 2026-08-07.

**4. (enrichment-pipeline only) Re-install the `## Governance` section** from
`templates/governance-sync-claude-section.md` v1.3.1. Replace the section body with the
template's current markdown block, filling `<CLIENT>` = `hopskip`, `<REPO-SLUG>` =
`enrichment-pipeline`, `<CLASS>` = `full`, and update the inline stamp comment to
`<!-- template: governance-sync-claude-section.md v1.3.1 · updated 2026-08-03 -->`.

**5. (enrichment-pipeline only) routing-triage v1.6.0 → v1.6.1.**

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/skills/routing-triage/SKILL.md .claude/skills/routing-triage/SKILL.md
```

Content change is the single install-path line; the stamp moves to `version: 1.6.1`.
Bump the skill's row in the `### Synced templates` table to `1.6.1`, dated 2026-08-07.

## Already present — skip

- `docs/agent-routing-records.md` — v1.11.0 changes no records files.
- The routing-classifier agents and `check-issue-routing.mjs` — current in both repos.
- analytics-infrastructure's queued GLM-5.2 calibration run — a separate experiment,
  not this prompt.

## Explicitly out of scope

- **The v1.11.0 enforcement half** (goal contract on dispatch surfaces, worker
  scope-and-delegation block) is ai-fleet-only. If either repo ever grows a dispatch
  surface, that contract arrives with it.
- **The graphify system-map install** (`2026-08-07-graphify-system-maps.md`) —
  independent of this prompt. It may ride the same session; apply it as its own change.

## Verifiable outcomes

Run from the repo root. Each line is an independent check.

- `head -1 docs/agent-routing.md | grep -c "v1.11.0"` — policy re-synced (expect 1)
- `diff -q docs/agent-routing.md ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md >/dev/null && echo OK` — byte-identical (expect OK)
- `grep -c "Delegating is dispatching" CLAUDE.md` — delegation paragraph present (expect 1)
- `awk '/### Synced templates/,0' CLAUDE.md | grep "docs/agent-routing.md" | grep -c "1.11.0"` — table row bumped (expect 1). Scans to EOF, not a fixed window: v1.3.1 of the governance section inserts a paragraph between the heading and the table.
- enrichment only: `grep -c "<!-- template: governance-sync-claude-section.md v1.3.1" CLAUDE.md` — section re-installed (expect 1)
- enrichment only: `grep -c "version: 1.6.1" .claude/skills/routing-triage/SKILL.md` — triage re-installed (expect 1)

**The check that matters** (run from `~/repos/HopSkipInc/repo-governance`):

```bash
node scripts/check-downstream-drift.mjs
```

Zero BEHIND rows for the repo you just synced. This observes the estate's declared-vs-
installed state — the effect of the edit, not the files the edit was typed into.

## Record the install

Append to the repo's applied-governance list in CLAUDE.md:
`[2026-08-07-routing-v1-11-0-resync.md] — applied <date>`.
