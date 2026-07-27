<!-- template: code-conventions.md v1.0.0 · updated 2026-07-27 -->
# Code Conventions — Records for [repo]

**Last refreshed:** [YYYY-MM-DD] by [name] (`clean-code-interview`)
**Refresh trigger that fired:** [bootstrap | lint config changed | audit finding AUDIT-…-QUALITY-NN | new modules violate conventions]

> **This file never syncs.** It is a *records* file, like `docs/agent-routing-records.md`.
> The blank form ships from repo-governance; everything written into it is local, dated, and
> unreconstructible from upstream. A `cp` from the governance repo must never touch this file.
>
> It is the output of `clean-code-interview`, not a substitute for it. The interview decides;
> this page records what was decided so the next audit, the next contractor, and the next
> triage pass all read the same answer.

---

## How to read this page

Every convention the interview considered lands in exactly one of three sections, and
**the "Not codified" section is as load-bearing as the "Enforced" one.** Without it, every
refresh rediscovers the same accidental patterns, re-proposes them, and someone re-argues
the same decision from scratch. A dropped convention with a written reason is a decision;
a dropped convention with no record is an omission that looks identical to an oversight.

| Bucket | Test | What it gets |
|---|---|---|
| **Enforced** | A violation could cause a bug or waste work | An ADR **and** a named lint |
| **Documented** | Intentional, but a violation is not dangerous | One line here; no ADR, no lint, no audit finding |
| **Not codified** | Accidental — a language default, a framework convention, or how the first engineer typed | A line in §3 so nobody proposes it again |

**An enforced convention with no lint is a documented one wearing a badge.** The audit
treats a row in §1 whose Enforcement cell is empty or aspirational as a P1 — the same
shape as an ADR that reached Accepted without the lint it promised.

---

## 1. Enforced conventions

Load-bearing. Each has an ADR and a mechanical check. Off-the-shelf enforcement counts and
is preferred — a configured `eslint`/`ruff`/`golangci-lint` rule is enforcement; a custom
script is what you write when nothing off-the-shelf fits.

| # | Convention | ADR | Enforcement (rule or script) | Gate or report | Since |
|---|---|---|---|---|---|
| 1 | [one sentence, specific enough to be violated] | [ADR-NNN] | [`@typescript-eslint/no-explicit-any` \| `scripts/check-x.mjs`] | gate \| report | [YYYY-MM-DD] |

**Report-mode rows are on a promotion clock.** A convention shipped in report mode (WARN,
not FAIL) is a gate that has not landed yet. Record the promotion condition, or it never
promotes:

| # | Report since | Promotes to gate when | Current violation count |
|---|---|---|---|
| [N] | [YYYY-MM-DD] | [e.g. "count reaches 0"] | [N] |

## 2. Documented conventions

Preferences. Real, intentional, and worth telling a newcomer — but a violation is not a
defect, and **the audit never files a finding against this section.** If you find yourself
wanting one to be enforced, that is a refresh trigger, not a note edit.

- [convention, one line]

> These are mirrored into `CLAUDE.md` / `CONTRIBUTING.md` so agents and contributors read
> them where they work. This page is the source; that copy is the mirror. If they disagree,
> this page wins and the mirror is stale.

## 3. Not codified (deliberate)

Patterns that are consistent in the codebase and are **not** standards. Recording them is
what stops the next refresh from proposing them again.

| Pattern | Why it is not a standard |
|---|---|
| [e.g. camelCase identifiers] | Language default — the formatter owns it; a violation is cosmetic and self-correcting |

## 4. Enforcement without a record

Lints and formatter rules that are wired in CI but appear nowhere above. **Each one is a
convention the team already paid to enforce** — the record is what is missing, which makes
these the highest-confidence candidates at the next refresh, not the lowest.

| Check | Where wired | Convention it implies | Disposition |
|---|---|---|---|
| [rule or script] | [CI job / config file] | [what it actually enforces] | promote to §1 \| drop the lint \| pending |

## 5. Contradictions on the record

Where the codebase disagrees with itself and the interview did **not** resolve it. An
unresolved contradiction is a finding, not a gap in this document — it usually means a
convention changed and nobody wrote the superseding ADR.

| Contradiction | Side A (cite) | Side B (cite) | Tracking |
|---|---|---|---|
| [what disagrees] | [path / rule] | [path / rule] | [#N or "unfiled"] |

## Review log

| Date | Trigger | What changed |
|---|---|---|
| [YYYY-MM-DD] | bootstrap | [e.g. "5 enforced, 6 documented, 4 dropped; 2 lints promoted from §4"] |
