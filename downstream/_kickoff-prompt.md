# Governance Kickoff — Boilerplate Prompt

Paste this into Claude Code in the target repo. Fill in the [FILL IN] placeholders before running. The prompt is written as a direct instruction — run it as-is once you've filled in the context block.

---

We're adopting the governance framework from `~/repos/greg/repo-governance`. Your job is to set up governance for this repo by following GETTING_STARTED there.

**Before starting:**
1. Read `~/repos/greg/repo-governance/GETTING_STARTED.md` in full.
2. Read this repo's current state: check what's in `docs/`, `.github/workflows/`, and `CLAUDE.md` (or whatever session instruction file this repo uses).

**Repo context:**
- Client / owner: [FILL IN — e.g., "Hopskip (internal)" or "BModelr / Jeff Bruno"]
- Repo purpose: [FILL IN — one sentence]
- Stack: [FILL IN — primary language, framework, key infra]
- Existing CI: [FILL IN — GitHub Actions / Azure Pipelines / none]
- Existing docs: [FILL IN — summarize what's in docs/ already, or "none"]
- Existing ADRs: [FILL IN — highest existing ADR number, or "none"]
- Adoption class: [FILL IN — `full` or `core` (PDR-009). `core` = single maintainer, no agent-worked backlog: apply steps 1, 2, and 6 only, plus the CLAUDE.md Governance section from `templates/governance-sync-claude-section.md`; steps 3–5 are excluded on the record, not deferred. Definitions live in the adoption-classes preamble of `.claude/commands/analyze-repo.md`]

**What to apply (in order):**

1. `docs/definition-of-done.md` — copy from `~/repos/greg/repo-governance/templates/definition-of-done.md`, then adapt: remove work-type rows that don't apply, add rows for types this repo has that aren't listed, fill in every "Why this rule exists" callout with a real incident or finding if one exists.

2. `.github/pull_request_template.md` — copy from `~/repos/greg/repo-governance/templates/pull_request_template.md`, add any work types this repo uses that aren't in the template.

3. `.github/workflows/scheduled-audit.yml` — copy from `~/repos/greg/repo-governance/templates/workflows/scheduled-audit.yml`. Set the cron schedule to fit the team's cadence. Add repo-specific audit domains to the prompt if the repo has patterns worth watching (a particular directory convention, a known recurring drift type, a custom schema).

4. `.github/workflows/audit-deadman.yml` — copy from `~/repos/greg/repo-governance/templates/workflows/audit-deadman.yml`. Set the cron to fire after the audit's window (e.g., if audit runs Monday 09:00, set the deadman to Tuesday 09:00 with a 9-day lookback).

5. `docs/issue-authoring.md` — copy from `~/repos/greg/repo-governance/templates/issue-authoring.md` if the backlog needs structure (most do). Adapt label taxonomy to match the repo's existing labels, or propose a label set if none exists.

6. A governance ADR — write fresh, don't copy. Document: what is being adopted, why, what the consequences are (audit cadence, DoD gates, PR template). Status: Accepted once enforcement is wired. Number from the next slot after the current highest ADR.

**Adaptation rules:**
- Replace all placeholder CI commands (`[project CI check command]`, `npm run check`, etc.) with this repo's actual commands
- Replace `[project source directories]` with real paths
- Drop "Why this rule exists" placeholders only if there is genuinely no incident to cite — never invent one
- Don't add DoD rules without an enforcement plan — every rule is a promise, and an unenforced promise erodes the whole doc

**After applying:**
- Confirm `ANTHROPIC_API_KEY` is set as a GitHub Actions secret (the audit workflow needs it)
- Verify each DoD row has a gating CI step, not just a manual checkbox — enforcement ships with the promise
- Run the first audit: `gh workflow run scheduled-audit.yml` (or wait for the next scheduled run)
- Treat the first audit as inventory, not a grade — work P0s this week, P1s next sprint, track P2s

**Reference files (in `~/repos/greg/repo-governance`):**
- `GETTING_STARTED.md` — full step-by-step guide with context
- `templates/` — all template files
- `docs/governance-health-spec.md` — add health metrics tracking after 3+ audit cycles
- `downstream/hopskip/_client.md` — example of the client context file format for this repo's folder
