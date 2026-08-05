# Governance Maintenance — HopSkipInc/ai-fleet — 2026-08-05

**Client:** hopskip
**Source:** greg/repo-governance agent-routing v1.11.0 (repo-governance PR #47, merged 2026-08-05)

> **CORRECTED 2026-08-05 after application.** Three errors in the enforcement half, found
> while applying it in ai-fleet (PR #1653). Steps 5 and 6 below are amended in place and the
> `## Verifiable outcomes` lines are updated to match. Read the amended text, not the
> original intent, if you are applying this now.
>
> 1. **Step 6 named a dead directory.** `runtime/templates/base/` is read by nothing in
>    ai-fleet, and step 6's verification line grepped that same dead path — so applying it
>    as written passed verification while delivering no behaviour change to any worker. The
>    live worker prompt is `docs/fleet-worker-doctrine.md`, inlined into `.claude/agents/*.md`
>    and a DB migration by `host/scripts/generate-fleet-prompts.mjs`.
> 2. **"No schema changes" was wrong.** Applied in the right place, step 6 necessarily ships
>    a migration, because the doctrine reaches DB-backed roles as `agents.system_prompt`.
> 3. **Step 6's last bullet contradicted the doctrine it sat beside.** It forbade workers to
>    push; that doctrine's §7 tells them to get the smallest correct change "committed and
>    pushed" and §4 tells them to verify "Branch pushed, PR open". Workers push; they do not
>    merge.
>
> The generalized lesson is now a gotcha in this repo's `CLAUDE.md`.

Two halves: a policy re-sync (mechanical) and the first enforcement of the fleet-dispatch
contract in the platform itself. The sync half is byte copies and one paragraph; the
enforcement half is contract text in the dispatch tools and worker rules in the live worker
prompt — no new fields and no new code paths, but the worker-prompt half does ship a
migration wherever that prompt is DB-backed.

## What changed in the templates (this sync-review)

- `agent-routing.md` v1.10.0 → **v1.11.0** — *delegation is dispatch*:
  - Three dispatch shapes: a human launching, an agent driver delegating to subagents, a
    fleet dispatcher. A fleet run today is the first shape — a human writes the goal and
    the fleet is the execution arm. A fleet *worker* is never a dispatcher of issues; its
    routing decision was made at launch.
  - A driver that delegates implementation work on a tiered issue becomes the Layer-1
    dispatcher for that unit of work. The delegation prompt is the launch and carries the
    capability budget: issue + tier, the reason verbatim, stop conditions, a scope
    ceiling, and a class check run before spawning. The driver's class does not transfer.
  - Subtask delegation is the split response one level down: mechanical subtasks may
    route below the issue's tier; the boundary residue may not.
  - Fleet dispatch rules: the goal enumerates rows, not ambitions; the claim-of-record
    lives on the issue; waves come from the epic tier table with completion gating the
    next wave; deploy gates are wave boundaries; a `Not splittable:` statement is a
    dispatch constraint (one worker, whole).
  - The CLAUDE.md section block gains the "Delegating is dispatching" paragraph, and
    anti-pattern 12 names delegating below tier because the driver is frontier.
- `governance-sync-claude-section.md` v1.2.0 → **v1.3.1** (two hops): v1.3.0 added the
  adoption-class sentence (PDR-009); v1.3.1 swept stale `~/repos/greg/repo-governance`
  paths to `~/repos/HopSkipInc/repo-governance`. Your installed section is v1.2.0, and
  the `_client.md` ledger already names this bump as owed via the sync ritual. This
  section is the loop that tells your agents how to find and apply pending prompts —
  the stale path breaks the delivery mechanism this prompt arrives by.

## What to do in this repo

### Sync half

1. **Re-sync `docs/agent-routing.md` to v1.11.0.** Byte-identical copy from
   `~/repos/HopSkipInc/repo-governance/templates/agent-routing.md`, stamp header intact.
   `diff -q` against the template must clear.
2. **CLAUDE.md agent-routing section: add the delegation paragraph**, immediately before
   the "You may escalate an issue's tier at any time…" sentence:

   ```markdown
   Delegating is dispatching. When you hand implementation work on a tiered issue to a
   subagent, you become the dispatcher for that unit of work: check the subagent's
   capability class against the tier (your own class does not transfer), and put the tier,
   kind, reason, stop conditions, and a scope ceiling in the delegation prompt — the
   subagent sees nothing of this conversation. Concurrent subagents need disjoint file
   surfaces or separate worktree lanes, exactly as concurrent sessions do. Subagents
   prepare; you review and merge.
   ```

3. **`### Synced templates` table:** bump the `docs/agent-routing.md` row's version cell
   to `1.11.0`, dated 2026-08-05.
4. **Re-install the `## Governance` section from `governance-sync-claude-section.md`
   v1.3.1.** Your stamp reads v1.2.0. Replace the section body with the template's
   current markdown block (filling `<CLIENT>` = `hopskip`, `<REPO-SLUG>` = `ai-fleet`,
   `<CLASS>` = your declared adoption class) and update the inline stamp comment. The
   load-bearing change is v1.3.1's path sweep — every `~/repos/greg/repo-governance`
   reference becomes `~/repos/HopSkipInc/repo-governance`; without it the pending-prompt
   loop points at a path that no longer exists.

### Enforcement half

5. **The goal contract — on every dispatch surface.** Extend the goal parameter description
   (and the tool description, if there is a natural home) with the manifest contract.
   ai-fleet has **two** live dispatch surfaces and both need it — the original prompt named
   only the first:
   - `host/src/mcp-server/tools/spawn-fleet-tool.ts` — the `goal` parameter (MCP surface)
   - `host/src/registry/tools/impl-dispatch-fleet.ts` — the `description` parameter (the
     in-platform surface an assistant calls; it is the path in the architecture diagram)

   Before you start, enumerate the dispatch entry points rather than trusting this list:
   `grep -rln "dispatch_fleet\|spawn_fleet" host/src/` . A contract on one of two surfaces
   is not a contract. Adapt to each file's voice, but keep the five rules intact:

   > The goal enumerates issue rows, not ambitions ("implement these issues and nothing
   > else"). A worker that finishes its rows reports completion and stops; it does not
   > pick up new work from the backlog. Workers claim each row on its issue (comment or
   > assignment) before starting — run-scoped coordination is invisible outside the run.
   > Dispatch only rows whose dependencies are merged; an epic that names waves is a
   > dispatch plan, and the next wave waits on the previous wave's completion. Deploy
   > gates in the target repo (schema on push, append-only files, dispatch-only
   > workflows, infrastructure parameters) are wave boundaries — read the target repo's
   > CLAUDE.md. An issue declared "Not splittable" goes to exactly one worker, whole —
   > never divided across workers or PRs.

   `spawn-fleet-tool.test.ts` may snapshot the description — update fixtures to match,
   and keep the host test suite green.
6. **Worker instructions — add a scope-and-delegation block to the LIVE worker prompt.**

   In ai-fleet that is `docs/fleet-worker-doctrine.md`, as a new numbered section. Its
   §1–§7 are inlined into every role prompt by `host/scripts/generate-fleet-prompts.mjs`,
   which writes both `.claude/agents/<slug>.md` and a migration setting
   `agents.system_prompt` for DB-backed roles; `host/scripts/check-fleet-worker-context.mjs`
   gates the outputs against drift. So the step is: edit the doctrine, bump its
   `<!-- doctrine-version: -->` stamp, bump `MIGRATION_NAME` **at the generator** to the next
   free number, and re-run it. Do not hand-edit the generated files — the drift check
   re-runs the generator and reverts them — and do not reuse the previous migration name: it
   is already journaled in production, so DbUp never re-runs it and the new prompt silently
   never arrives.

   ~~`runtime/templates/base/`~~ — **do not use.** Those files are read by nothing in this
   repo: not `COPY`'d in the Dockerfile, zero code consumers, and `docs/fleet-runtime.md`
   states it. They are convincing (real role names, plausible bodies, a `cd-runtime.yml`
   path filter), which is why the original prompt named them.

   There is no orchestrator role coordinating workers: the worker's main agent delegates to
   subagents by prompting, and these duties are what make that safe:

   ```markdown
   ## Scope and delegation

   - Work only the rows your fleet was dispatched on. Finishing your list means
     reporting completion and stopping — never pulling new work from the backlog.
   - Claim each row on its issue (comment or assignment) before you start it.
   - "Done" means the issue's acceptance criteria passed. Emit `worker.completed`
     after that, never before.
   - Delegating to a subagent is dispatching: check the subagent's capability class
     against the tier of the work you hand it (your class does not transfer), and put
     the tier, kind, reason, stop conditions, and a scope ceiling in the delegation
     prompt — the subagent sees nothing of your session. Mechanical subtasks may route
     below the issue's tier; the boundary residue may not. Concurrent subagents need
     disjoint file surfaces.
   - You prepare changes; you never merge and never run deploy-gated steps. Pushing the
     branch and opening the PR *is* the deliverable — check the receiving doctrine before
     restating this, because forbidding the push contradicts it.
   ```

7. **File the follow-up issue for the structural fence.** Today's contract is text; the
   real fence is a structured manifest. File an issue in HopSkipInc/ai-fleet: add an
   `issues:` array to `spawn_fleet` and have the host write the claim-of-record comments
   itself at spawn time — worker claims stop being something workers remember and become
   something the platform did. Run it through routing-triage for its `impl:` label like
   any other issue.

## Already present — skip

- `docs/agent-routing-records.md` and the routing-classifier pins — v1.11.0 changes no
  records files.
- `routing-triage` — this repo is current (1.6.1, 2026-08-03). enrichment-pipeline is
  the one behind.

## Not applicable — skip

- **The `fleet-dispatch` skill** (`~/.claude/skills/fleet-dispatch`, user-level) is not
  production code and is not installed from this repo. How it honors the manifest
  contract is left to this repo's own catch-up.
- **enrichment-pipeline** carries the same governance-section bump owed via the sync
  ritual (v1.3.1), plus routing-triage 1.6.0 → 1.6.1. They ride the next enrichment
  prompt, not this one.
- **infra-ops** is core-class (PDR-009) and intentionally does not install
  agent-routing.

## Verifiable outcomes

Run from the repo root. Each line is an independent check.

- `head -1 docs/agent-routing.md | grep -c "v1.11.0"` — policy re-synced (expect 1)
- `diff -q docs/agent-routing.md ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md >/dev/null && echo OK` — byte-identical to the template (expect OK)
- `grep -c "Delegating is dispatching" CLAUDE.md` — delegation paragraph present (expect 1)
- `awk '/### Synced templates/,0' CLAUDE.md | grep "docs/agent-routing.md" | grep -c "1.11.0"` — table row bumped (expect 1). Scans to EOF rather than a fixed `-A12` window: v1.3.1 of the governance section inserts a paragraph between that heading and the table, which pushes the row out of a 12-line window and reports 0 on a correctly-applied repo.
- `grep -c "<!-- template: governance-sync-claude-section.md v1.3.1" CLAUDE.md` — governance section re-installed (expect 1)
- `grep -c "enumerates issue rows" host/src/mcp-server/tools/spawn-fleet-tool.ts` — goal contract on the MCP surface (expect ≥1)
- `grep -c "enumerates issue rows" host/src/registry/tools/impl-dispatch-fleet.ts` — goal contract on the in-platform surface (expect ≥1)
- `grep -c "Delegating to a subagent is dispatching" docs/fleet-worker-doctrine.md` — block in the live worker prompt (expect 1)
- `node host/scripts/generate-fleet-prompts.mjs --check` — generated role prompts regenerated, not stale (expect exit 0)
- `grep -rl "Delegating to a subagent is dispatching" .claude/agents/ | wc -l` — the block actually reached the generated subagent prompts (expect ≥1). This is the check that matters: it observes the *effect* of the edit rather than the file the edit was typed into.
- Host test suite green after the description change (`spawn-fleet-tool.test.ts` fixtures updated if snapshotted)
- `gh issue list --repo HopSkipInc/ai-fleet --search "spawn_fleet issues array claim" --limit 5 | grep -c .` — follow-up issue filed (expect ≥1)
