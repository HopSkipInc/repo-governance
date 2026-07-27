# Code Conventions — Records for repo-governance

**Last refreshed:** 2026-07-27 by Greg (`clean-code-interview`, dogfood run)
**Refresh trigger that fired:** bootstrap

> **This file never syncs.** It is a *records* file, like `docs/agent-routing-records.md`.
> The blank form is `templates/code-conventions.md`; everything here is local and dated.
> A `cp` from the template must never touch this file.

> **What this repo is.** 69 markdown files, 13 `.mjs` files, no application code. The
> "code" being governed is the template corpus and the lints that check it. Several
> conventions below would be unremarkable in a service repo and are load-bearing here
> precisely because the artifacts *are* the product.

---

## How to read this page

Every convention lands in exactly one of three sections, and **§3 is as load-bearing as
§1**. A dropped convention with a written reason is a decision; a dropped convention with
no record is indistinguishable from an oversight, and the next refresh re-proposes it.

The audit (domain 8) files findings against §1 and §4 only. It never files against §2, and
it never proposes anything in §3.

---

## 1. Enforced conventions

| # | Convention | ADR | Enforcement (rule or script) | Gate or report | Since |
|---|---|---|---|---|---|
| 1 | Every file under `templates/` carries a version stamp naming its own path — HTML comment on line 1 (`.md`), frontmatter `version:`/`updated:` (skills), leading comment after any shebang (`.mjs`, `.yml`) | — | `scripts/check-template-versions.mjs` R1–R2 | gate | 2026-07-24 |
| 2 | A template changed in a commit has its version bumped in the same commit | — | `check-template-versions.mjs` R3 (`--base`) | gate | 2026-07-24 |
| 3 | Every file under `templates/` is named in the `/analyze-repo` applicability matrix or excluded there on the record | — | `scripts/check-analyze-repo-coverage.mjs` | gate | 2026-07-24 |
| 4 | A blank form is `_`-prefixed and never carries a record's number; a records corpus holds only records, `README.md`, and `_`-prefixed forms | — | `scripts/check-blank-form-naming.mjs` R1–R3 | gate | 2026-07-27 |
| 5 | Every script in `scripts/` has a fixture test asserting it fires on a known-bad input and clears on a known-good one | — | `test/lints.test.mjs`, run in CI | gate | 2026-07-27 |
| 6 | Every record in `docs/adr/` and `docs/pdr/` is registered in its README index | — | `scripts/check-adr-readme-sync.mjs` | gate | 2026-07-27 |
| 7 | An Accepted PDR carries a falsifier, and not one of the phrasings the form rules out | [PDR corpus](pdr/README.md) | `scripts/check-pdr-falsifiers.mjs` R1–R2 (R3–R4 report) | gate + report | 2026-07-27 |

**Row 7 is the first with anything in the ADR column** — pointing at the PDR corpus rather than an ADR, because the decision it enforces is a product-layer one. Rows 1–6 remain empty for the reason below.

**No ADR column entries on rows 1–6, and that is not an omission.** This repo has no `docs/adr/`. It
governs an ADR *practice* without running one on itself, because its own load-bearing
decisions are recorded in `templates/agent-routing.md`'s changelog, in `.claude/team-state.md`,
and in the lint headers — every lint here opens with the incident that caused it. Whether
that is sufficient or whether this repo owes itself an ADR corpus is an open question for
`adr-interview`, which has not been run here.

**Consequence worth stating:** `clean-code-interview` assumes "enforce" means "ADR + lint".
In a repo with no ADR corpus the lint *is* the record, and the skill's §1 has to tolerate an
empty ADR column. Recorded in the template.

## 2. Documented conventions

Real and intentional; a violation is not a defect and never blocks a PR.

- Lint scripts open with a header block naming the **incident that caused them**, not just
  the rule. Every one of the five reads as a short post-mortem. `[repo-governance's own
  lint — NOT a downstream template]` on the first line of the repo's own lints, so a
  future sync does not harvest them into `templates/`.
- Downstream prompts are `downstream/<client>/[<repo>/]YYYY-MM-DD-<slug>.md` — 17/17 follow it.
- Templates and docs are kebab-case `.md`; lint scripts are `check-<thing>.mjs`.
- Prose voice: rules state the failure mode they prevent, in the past tense where it
  actually happened. "A migration that drops a column must have zero remaining references"
  beats "be careful with migrations".
- Records files carry a "never syncs" banner in the same shape, so the boundary is visible
  from inside the file rather than only in the policy that created it.

> Mirrored into `CLAUDE.md` for agents. This page is the source; the mirror is a copy.

## 3. Not codified (deliberate)

| Pattern | Why it is not a standard |
|---|---|
| Section-numbered docs (`## 1.`, `## 2.`) in some templates and not others | Correlates with whether a file is cross-referenced by section (`testing-strategy.md` §6, `agent-routing-records.md` §6). Numbering the rest would add churn with no reader |
| Em-dash-heavy prose | House voice, not a rule. Nothing depends on it and no reviewer should raise it |
| Table-vs-list choice | Follows the content. Codifying it would mean arguing about tables |
| No `package.json` | Deliberate: this repo is not a package, and adding one to get a test runner would imply publishable artifacts. `node --test` needs no manifest |
| Directory depth under `templates/` | `scripts/`, `skills/`, `workflows/`, `adr/`, `pdr/`, `agents/` grew by kind as kinds appeared. There is no rule about when a new subdirectory is warranted, and inventing one now would be codifying an accident |

## 4. Enforcement without a record

| Check | Where wired | Convention it implies | Disposition |
|---|---|---|---|
| `scripts/check-downstream-drift.mjs` | **nowhere** — runs on no trigger | Downstream repos' declared template versions must match their files, and must not lag the templates | See §5 — it reports 10 blocking findings today and nothing surfaces them |

## 5. Contradictions on the record

| Contradiction | Side A | Side B | Tracking |
|---|---|---|---|
| `check-downstream-drift.mjs` exits non-zero on 10 MISMATCH findings and is wired to no trigger. It cannot run in CI — it reads local client checkouts — so it is a gate with no gate | The script: "MISMATCH always blocks: a wrong declaration is worse than a stale one" | No workflow, no hook, and no skill step invokes it | unfiled — needs a home in `/review-sync` Step 5.0, which is where a human already has the client checkouts open |
| `.github/workflows/issue-routing.yml` ran `templates/scripts/check-issue-routing.mjs` in place while every client copies it to `scripts/` | The template's own header: "CONFIGURE BEFORE USE" | This repo never configured it and could not, without editing what ships | **resolved 2026-07-27** — copied to `scripts/`, workflow repointed |

## Review log

| Date | Trigger | What changed |
|---|---|---|
| 2026-07-27 | bootstrap | 5 enforced (2 new: blank-form naming, lint fixture tests), 5 documented, 5 dropped. One §5 contradiction resolved in the same pass, one left open. Recorded that this repo has no ADR corpus, so the lint is the record |
| 2026-07-27 | agent-instructions refresh | CLAUDE.md reconciled: `[N]` placeholder in the diff-size stop condition filled (10 files), the `docs/agent-routing.md` reference corrected for the 1.9.0 records split, and commands / records-file rules / gotchas added. All paths and commands verified to resolve |
| 2026-07-27 | PDR bootstrap | Rows 6–7 added — record-index sync and PDR falsifier enforcement, both gates. The PDR corpus now exists (`docs/pdr/`), so this repo runs 4 of the 5 layers on itself; the ADR layer is still the outstanding one |
