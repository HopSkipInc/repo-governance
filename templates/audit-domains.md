<!-- template: audit-domains.md v1.0.0 · updated 2026-09-16 -->
# Audit Domains

**Status:** Policy — the single definition of what a staleness audit checks
**Installed as:** `docs/audit-domains.md` in each governed repo
**Consumers:** `workflows/scheduled-audit.yml`, and any in-platform audit skill that replaces it
**Related:** [Definition of Done](definition-of-done.md), [Configuration Governance](configuration-governance.md), [Governance Health](governance-health.md)

---

## Why this file exists — the incident

Until v1.0.0 of this file, the domain definitions lived **inside the prompt of
`scheduled-audit.yml`**. That works exactly as long as every governed repo runs the audit
as a GitHub Actions workflow.

They don't. A repo that moves its audit in-platform — into a scheduler, a skill, a fleet
dispatch — has to hand-port each domain, and nothing reconciles the two sets afterward. By
2026-09-16 the divergence was already live and already invisible: one repo's audit skill
spawned **six** agents against the template's **eight** domains, and the one domain it had
ported carried its provenance as a comment naming a template version, which is the only
record anywhere that the port ever happened.

**An audit that omits a domain looks exactly like an audit that ran it and found nothing.**
The omission does not surface at audit time. It surfaces months later as "why did the audit
never flag this."

This is the same failure `check-analyze-repo-coverage.mjs` exists to close for templates,
and the same remedy: one definition, version-stamped, that every consumer reads rather than
copies.

---

## How a consumer uses this file

1. **Read it at run time.** Do not transcribe the domains into the consumer. A copy is a
   fork with a delay.
2. **Run every domain listed.** A consumer that runs a subset declares which and why, in
   its own text, where a reader will see it.
3. **Fail loudly when this file is absent.** A consumer that cannot find it must stop and
   say so. It must never substitute a domain list of its own invention — that produces a
   report indistinguishable from a real one, which is worse than no audit.
4. **Record the version.** Echo this file's stamp into the run log, so a report can be
   traced to the domain set that produced it.

Domains are **probes, not gates.** No domain here blocks a merge. Several read intent from
prose and will produce false positives; the correct response to uncertainty is a lower
severity, not a confident guess.

---

## The domains

1. **ADR coherence** — if ADRs exist in docs/adr/, are they internally consistent,
   reflected in the code, and do they have the enforcement they promised?
   Flag ADRs whose status says Accepted but whose promised lints don't exist.

2. **Docs vs reality drift** — do files in docs/ describe the system that actually
   exists? Flag: present-tense claims for things that are planned or deleted,
   internal contradictions, file paths and function names that don't exist,
   issue/PR numbers that point nowhere.

3. **Codebase discipline** — dead code still imported, retired patterns still in use,
   TODO/FIXME comments without tracking issues, migration naming violations,
   Bicep/IaC referencing deleted resources.

4. **GitHub backlog** — open issues with no activity in >30 days, open issues whose
   fix is likely already merged (look for related PR titles), PRs open >7 days with
   green CI and no review activity.

5. **Watch-list sweep** — scan docs/watch-items/*.md for unchecked watch-list
   lines (grep pattern: `- [ ] **Watch list`) AND docs/pdr/*.md for unchecked
   falsifier lines (grep pattern: `- [ ] Revisit by`). A product bet with a
   check condition is structurally a watch item; sweep both the same way.
   **Skip any file whose name starts with `_` (e.g. `_template.md`) and any
   README.md** — those are blank forms and indexes, not records. The form's
   own placeholder falsifier ("Revisit by YYYY-MM-DD when <condition>") will
   otherwise be reported as a real Future item on every single run.
   List each hit under a `## Future items` section in the audit report: the
   item text, source doc path, doc date, and stated revisit condition. Do NOT
   file issues for items whose revisit condition has not arrived. If a
   condition has arrived (date passed, named external event occurred), raise
   it as a P2 finding ("watch item due — re-evaluate or check it off in the
   source doc"); normal P2 carry rules apply. A checked-off line is resolved
   — never report it.

6. **PDR coherence** — if docs/pdr/ exists, check the product decision corpus.
   This domain reads intent from prose and will produce false positives; that
   is why it is a probe and never a merge gate. When unsure, report at lower
   severity rather than guessing confidently.

   **A record is a file matching `NNN-*.md`. Nothing else in the directory is
   a record** — `_template.md` is the blank form and `README.md` is the index.
   The form lists every Status value on one line ("Proposed | Accepted | ...")
   and carries a placeholder falsifier; read it as a record and you will report
   findings against a document nobody wrote.

   - Any PDR with Status **Accepted** and no `- [ ] Revisit by` falsifier line
     → P1. A decision without a falsifier is a wish; Accepted requires one.
   - Any PDR whose falsifier condition is not observable (no date, no named
     event, no threshold — e.g. "revisit later", "revisit at next planning")
     → P2. The sweep cannot tell whether it is due.
   - Any PDR whose `Last confirmed` date is more than 90 days old → P2
     ("bet unconfirmed for a quarter — re-confirm or supersede"). Nobody
     having looked at it is the condition under which stale bets survive.
   - **Orphan check:** for feature PRs merged since the prior audit, and open
     issues labelled epic, check for a `Serves: PDR-NNN` reference. Report the
     count and list orphans as a single P2, not one finding each. `Serves:
     none` with a stated reason is a legitimate answer and is NOT an orphan —
     but if the `Serves: none` rate is above half, raise that as the finding
     instead: it means the corpus does not describe what the team is building.
   - **Non-goal violation:** for each PDR whose Decision states something the
     project will deliberately NOT do, check whether work shipped since the
     prior audit contradicts it → P1. This is the highest-signal check in the
     domain. Cite the PDR number and the specific PR or file. If the non-goal
     was genuinely reconsidered, the fix is a superseding PDR, not silence.
   - Any PDR file not registered in docs/pdr/README.md → P1, and note that
     lint:adr-readme-sync should have caught it (the lint is missing or not
     wired into CI).

7. **Governance layer staleness** — check whether any of the five governance
   layers (PDRs, ADRs, clean code, test coverage, agent instructions) have
   drifted from the codebase and need a refresh. Read the `### Layer refresh
   log` in CLAUDE.md (or AGENTS.md) for the last-refreshed date of each layer.
   For each layer, check its staleness trigger (see `docs/definition-of-done.md`
   → Governance layer refresh for the trigger table):

   - **PDRs:** any `Last confirmed` > 90 days? any falsifier fired since last
     audit? → recommend `pdr-interview refresh`
   - **ADRs:** any lints in CI or scripts/ without a corresponding ADR? any
     ADRs stuck in Proposed for 3+ audit cycles? any module contradictions
     found in this audit's codebase discipline domain? → recommend
     `adr-interview refresh`
   - **Clean code:** has lint/formatter config changed since the last refresh
     (check git log for .eslintrc, .prettierrc, pyproject.toml [tool.ruff],
     .editorconfig)? did domain 8 raise any QUALITY finding? is
     `docs/code-conventions.md` §4 (enforcement without a record) non-empty?
     → recommend `clean-code-interview refresh`
   - **Test coverage:** did domain 8 raise any COVERAGE finding? has actual
     coverage dropped since the last audit? are there source directories with
     no row in the coverage map? → recommend `test-coverage-interview refresh`

   **Domains 7 and 8 are a pair: 8 measures, 7 decides what to do about it.**
   Do not report a layer stale on a trigger domain 8 did not actually produce
   evidence for — a staleness recommendation with no finding behind it trains
   the reader to skip this section.
   - **Agent instructions:** do the commands in CLAUDE.md/AGENTS.md actually
     exist in package.json/Makefile? do referenced paths exist? has tooling
     changed (check git log for package.json dependency changes, config file
     renames)? → recommend `agent-instructions-interview refresh`

   Report each stale layer as a P2 finding with the trigger that fired and the
   recommended refresh skill. Layers that are not stale are not reported — this
   domain is informational, not a gate. A layer that has never been refreshed
   (log shows `—`) is not stale; it was bootstrapped at onboarding and the
   staleness clock starts from that date.

8. **Code quality and coverage** — audit the codebase *against* the two records
   files, `docs/code-conventions.md` and `docs/testing-strategy.md`. Skip the
   half whose file does not exist and say so; do not infer a strategy from the
   tests. Finding IDs: `QUALITY` for conventions, `COVERAGE` for tests.

   **Conventions (`docs/code-conventions.md`):**
   - §1 row whose Enforcement cell is empty, aspirational ("to be wired",
     "planned"), or names a rule/script that does not exist or is not wired
     into CI → **P1**. Same shape as an ADR that reached Accepted without its
     lint: the record claims enforcement the repo does not have.
   - §1 report-mode row whose promotion condition is met (violation count
     reached the stated number) → **P2** "promote to gate".
   - Any lint or formatter rule wired in CI that appears nowhere in §1, §2 or
     §4 → **P2**, disposition "add to §4". These are conventions the team
     already paid to enforce and never wrote down.
   - §5 contradiction with no tracking issue, carried across three audits →
     **P2**, escalate per the aging rule.
   - **Never file a finding against §2 (Documented)** — those are preferences,
     and a preference with an audit finding attached is a rule nobody agreed to.
   - **Never propose anything listed in §3 (Not codified).** That section exists
     to be read before proposing, and re-proposing a recorded drop is the
     failure it was written to prevent. If §3 looks wrong, that is a refresh
     trigger for domain 7, not a finding here.

   **Coverage (`docs/testing-strategy.md`):**
   - Actual coverage below the §1 floor → **P1**. If §1 claims the floor is a
     required check and CI is nonetheless green, → **P0**: the gate is not
     wired, and every PR since it was claimed merged past a check that does
     not exist.
   - Floor set far below actual (more than ~15 points) → **P2**. A floor
     nothing is near is a report wearing a gate's clothes.
   - Any source directory with no row in the §2 coverage map → **P1**. A module
     absent from the map is invisible to every later measurement, including the
     routing coverage lever.
   - §2 row marked `gap` or `hard to test` with no tracking issue, or whose
     tracking issue is closed while the row still says gap → **P1**.
   - §3 exemption whose "Would we notice if it broke?" cell is empty or answers
     no → **P2**. That is a gap recorded as a decision.
   - **False-green scan** — this is the domain that produces the evidence
     domain 7 asks about. Search the test suite for: no-op assertions
     (`expect(true).toBe(true)` and equivalents), skipped or pending tests with
     no tracking issue, stub test scripts (`echo "not implemented" && exit 0`),
     catch-all handlers that pass regardless, and tests with no assertions.
     Each is **P1** — CI is green and the code is not verified. Any hit absent
     from the §5 register means the register is stale; say so once rather than
     per hit.
   - §6 line (properties no test verifies) whose surface has since gained a
     test → **P2** "record is stale in the good direction, and the routing
     coverage lever is reading an out-of-date map".

   Report the two numbers domain 7 consumes even when there is no finding:
   **actual coverage and its delta since the prior audit**, and the
   **false-green count**. A domain that reports nothing is indistinguishable
   from one that did not run.

9. **Configuration and secrets** — audit the configuration surface *against*
   `docs/configuration-governance-records.md`, the way domain 8 audits code against its
   two records files. If that file does not exist, report the domain SKIPPED and say so;
   do not infer a classification scheme from the `.env` file. Finding IDs: `CONFIG` for
   placement, `SECRET` for ladder and tier findings.

   **This domain carries only what a per-PR gate structurally cannot see.**
   `check-config-coverage.mjs` already gates undeclared variables, dead variables, and
   secrets held as literals on every pull request. Repeating those here is noise. What is
   left is everything that is triggered by the passage of time or by a change outside the
   repository:

   - **Floor breach.** Any variable at a tier below the floor its principal class declares
     → **P1**. A non-human principal holding a T4 local long-lived secret → **P0**: that
     tier has no exception path, so its presence means either the floor was breached or the
     records file is describing a repo that no longer exists.
   - **Environment drift into a breach.** A tier claim that was true when written and is
     not now — a decommissioned vault, a retired broker, an expired federation trust →
     **P1**, and note that no PR caused it, which is why only this domain can find it.
   - **Capability drift on a justified cap.** A floor capped with a stated reason ("no IdP
     federation available") where that reason has since become false → **P2**. Nobody
     revisits a cap once it is written down; this check is the only thing that does.
   - **Inventory staleness.** Variables added to the declaration sites since the prior
     audit with no corresponding rows in the records file → **P2**, naming the count. If
     `check-config-coverage.mjs` is not wired in this repo, → **P1** instead: the
     inventory is then the only record and it is already wrong.
   - **Credential-bearing files.** Sweep the tree for credential *files* the lint does not
     parse — `*.pem`, `*.pfx`, `*.p12`, `id_rsa`, service-account and client-secret JSON.
     Any such file absent from the records inventory → **P1**. Any such file tracked in
     version control → **P0**. This check exists because a policy whose lint reads only
     `KEY=value` lines will pronounce a directory clean while private keys sit beside it.
   - **Heuristic smells** — the report-mode half of the policy's detection list:
     secret-shaped names holding literals, high-entropy values, values requiring escaping
     or carrying JSON/PEM, composites fusing a target with a credential, and single-read
     never-varied constants → **P2** each, and cap the section at the ten highest-value
     hits rather than enumerating a long tail.

   **Dated exceptions are swept by domain 5, not here.** An exception line written in the
   watch-item shape (`- [ ] Revisit by YYYY-MM-DD when …`) is structurally a watch item and
   the existing sweep already reports it when its condition arrives. File here only when an
   expiry has passed **and** the variable it covers is below floor — that combination is a
   live breach, not a future item, and it is **P1**.

   **Never file against the records file's deliberate non-classified list.** That section
   is the §3 analogue: it exists to be read before proposing, and re-proposing a recorded
   drop is the failure it was written to prevent. If the list looks wrong, that is a
   refresh trigger for domain 7, not a finding here.

   Report the two numbers even when there is no finding: **variables inventoried and the
   delta since the prior audit**, and the **count at or below the declared floor**. A
   domain that reports nothing is indistinguishable from one that did not run.

---

## Severity guidance

- **P0:** actively misleading a new contributor right now, or a live regression risk
- **P1:** will cost hours when discovered next sprint
- **P2:** cosmetic, dead links, nice-to-have

**P2 aging rule:** any P2 carried across three consecutive audits must be either filed as
a tracked issue (and removed from the audit) or closed WONT-FIX with rationale.

---

## Finding-ID convention

```
AUDIT-YYYY-MM-DD-<DOMAIN>-NN
```

`NN` is a zero-padded sequence within the domain. Domain tokens:

| Domain | Token |
|---|---|
| 1 ADR coherence | `ADR` |
| 2 Docs vs reality | `DOCS` |
| 3 Codebase discipline | `CODE` |
| 4 GitHub backlog | `BACKLOG` |
| 5 Watch-list sweep | `STALE` |
| 6 PDR coherence | `PDR` |
| 7 Governance layer staleness | `LAYER` |
| 8 Code quality and coverage | `QUALITY`, `COVERAGE` |
| 9 Configuration and secrets | `CONFIG`, `SECRET` |

A new domain adds a token here in the same change that adds the domain. A token invented
at report time is a domain nobody registered.

---

## What stays with the consumer

This file defines *what to check* and *how to rate it*. Everything else belongs to
whichever consumer is running the audit, because it differs by substrate:

- Output document path, structure, and section list
- How the prior audit is located and carried forward
- Branch, commit, and pull-request mechanics
- Agent fan-out and synthesis strategy
- Remediation-phase workflow and close-out gates

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-09-16 | Extracted from `workflows/scheduled-audit.yml` v1.1.0, which held domains 1–8 inline in its prompt and was therefore reachable only by repos running the Actions workflow. Domains 1–8 carried over verbatim. Adds domain 9 (configuration and secrets), the `LAYER` token for domain 7 (previously unregistered), and the consumer contract in "How a consumer uses this file" |
