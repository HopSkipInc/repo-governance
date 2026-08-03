# infra-ops — Core-class governance onboarding (2026-08-03)

**First `core`-class adoption (PDR-009 dogfood).** The 90-day falsifier clock starts
when this lands: revisit by 2026-11-03, or earlier if any `core`-excluded template gets
retro-installed — a retro-install is evidence the bundle boundary was drawn wrong.

Paste the prompt below into Claude Code in `~/repos/HopSkipInc/infra-ops`. Run as-is.

---

We're adopting the governance framework from `~/repos/HopSkipInc/repo-governance` at
the **`core`** adoption class (PDR-009). Your job is to set up `core` governance for
this repo by following GETTING_STARTED step 0 there — not the full guide.

**Before starting:**
1. Read `~/repos/HopSkipInc/repo-governance/GETTING_STARTED.md` step 0 (the class
   definitions) and the adoption-classes preamble in
   `~/repos/HopSkipInc/repo-governance/.claude/commands/analyze-repo.md`.
2. Read this repo's current state: `docs/`, `.github/workflows/`, `CLAUDE.md` (currently
   a one-line stub), and the conventions section of `README.md`.

**Repo context:**
- Client / owner: Hopskip (internal)
- Repo purpose: Azure infrastructure-as-code — Bicep templates, deploy workflows, and
  operational scripts; source of truth for security configuration, DNS, alerting, and
  platform monitoring
- Stack: Bicep, GitHub Actions (10 workflows), bash/Python ops scripts, OIDC auth
- Existing CI: GitHub Actions — deploy-on-push per bicep path, `production` /
  `prod-rbac` environment gates, CODEOWNER approval on `bicep/dns/`, weekly Defender +
  SOC2 drift checks, 15-minute DNS watchdog
- Existing docs: `docs/` has 3 operational docs (Defender cost analysis, SSL runbook,
  DNS incident + cutover runbooks)
- Existing ADRs: none — this adoption seeds the corpus
- Adoption class: **`core`** — single maintainer, no agent-worked backlog (3 open
  issues). Apply steps 1, 2, and 6 from the kickoff list plus the CLAUDE.md Governance
  section; everything else is excluded on the record, not deferred.

**What to apply (in order):**

1. `docs/definition-of-done.md` — copy from
   `~/repos/HopSkipInc/repo-governance/templates/definition-of-done.md`, then adapt to
   infra work types (bicep changes, workflow changes, ops scripts, runbooks). Remove
   rows that don't apply (there is no application test suite here — do not invent one).
   Fill "Why this rule exists" callouts with real incidents — this repo has them: the
   Feb 2026 DNS incident (GoDaddy/Proofpoint overwrote MX + SPF 6 times with no audit
   trail, `docs/dns/incident-2026-02-dns-records.md`), the April 2026 EventPlansTrigger
   6-day stall, the Defender 14→8 plan reduction. Likely gates: `az bicep build` clean,
   what-if reviewed before deploy, drift checks green after deploy, README structure
   section updated when components change.

2. `.github/pull_request_template.md` — copy from
   `~/repos/HopSkipInc/repo-governance/templates/pull_request_template.md`, adapt work
   types to match the DoD.

3. The ADR corpus — `docs/adr/README.md` and `docs/adr/_template.md` from
   `~/repos/HopSkipInc/repo-governance/templates/adr/`, plus
   `scripts/check-adr-readme-sync.mjs` from `templates/scripts/` wired into CI (add a
   step to an existing workflow or a small new one — the repo has Actions already).
   Then write **ADR-001: adopting core-class governance** — what is being adopted
   (this prompt's list), why (decisions happen here even when backlogs don't; the
   deploy gates already exceed what the full framework would add), what the
   consequences are (the excluded list below, the 2026-11-03 falsifier revisit).
   Status: Accepted once the DoD gate is wired.
   Optional but encouraged: ADR-002 and ADR-003 retroactively recording the DNS-merge
   decision and the Defender plan reduction — both are ADR-shaped and currently live
   in one-off docs.

4. The CLAUDE.md Governance section — install from
   `~/repos/HopSkipInc/repo-governance/templates/governance-sync-claude-section.md`
   (v1.3.1). Client: `hopskip`, repo slug: `infra-ops`, class: `core`. Keep the inline
   stamp comment — the drift check verifies against it. Declare the installed templates
   in the Synced-templates table (repo-relative paths, installed versions from each
   template's stamp). This replaces the current one-line CLAUDE.md stub — keep the stub's
   line as a title line above the section.

**Excluded on the record (class: core):** scheduled-audit + deadman workflows,
issue-authoring, agent-routing + records + triage skill + classifiers, the five-layer
interview skills, design lenses, governance-health, watch-items, DB migration
governance and harnesses, all P2 scripts. Do not install any of these — the class line
is the record of their exclusion, and installing one early is the PDR-009 falsifier
firing.

**After applying:**
- Verify each DoD row has a gating CI step, not just a manual checkbox — enforcement
  ships with the promise. Where the gate already exists (environment approvals,
  CODEOWNER, drift checks), the DoD row *cites* it rather than duplicating it.
- Confirm the Synced-templates table matches what was actually installed — it is what
  `check-downstream-drift.mjs` reads.
- No `ANTHROPIC_API_KEY`, no first audit — `core` installs no audit workflow.

**Reference files (in `~/repos/HopSkipInc/repo-governance`):**
- `GETTING_STARTED.md` step 0 — class definitions
- `docs/pdr/009-two-adoption-depths.md` — the decision this dogfoods, falsifiers included
- `templates/` — all template files
