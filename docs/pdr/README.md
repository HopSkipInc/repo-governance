# Product Decision Records

Why this software exists: who it serves, what bet it makes, what it deliberately will not do.

ADRs record how the code is shaped. PDRs record why there is any code at all. Every accepted PDR carries a falsifier — see `templates/definition-of-done.md` for what "accepted" means and why a decision without a falsifier cannot get there.

Every file in this directory must appear in the table below. `lint:adr-readme-sync` enforces it and fails the build on any unregistered record. `lint:pdr-falsifiers` enforces that every Accepted record carries an observable falsifier, and reports any whose condition has come due.

| # | Title | Status | Last confirmed |
|---|-------|--------|----------------|
| [001](001-two-offerings-one-methodology.md) | Two offerings, one methodology | Accepted | 2026-07-27 |
| [002](002-pre-commercial.md) | Pre-commercial — build the capability before selling it | Accepted | 2026-07-27 |
| [003](003-two-registers.md) | Two vocabularies, one per offering | Accepted | 2026-07-27 |
| [004](004-no-client-file-tree-mirroring.md) | Non-goal — never mirror a client's file tree | Accepted | 2026-07-27 |
| [005](005-no-client-read-access.md) | Non-goal — clients never get read access to this repo | Accepted | 2026-07-27 |
| [006](006-no-premature-infrastructure.md) | Non-goal — no infrastructure before the practice needs it | Accepted | 2026-07-27 |
| [007](007-not-a-security-practice.md) | Non-goal — not a security or compliance practice | Accepted | 2026-07-27 |

## Notes on this corpus

**Seven records, against the template's guidance of five or fewer.** The guidance is about not over-producing, and it is right — but four of these are non-goals, which the same guidance calls the highest-signal artifact in the set and the least likely to be written down anywhere. All seven were drafted from evidence already in the repo and confirmed in a single interview on 2026-07-27; none were invented to fill the corpus. If the count is wrong, the excess is in 001–003, not in the non-goals.

**What this corpus fixed.** Before it existed, the ICP was recorded two contradictory ways in two live files (`.claude/team-state.md` said non-technical founders, `gtm/positioning.md` said CTOs and VPEs) and had been for two months, through several edits to both. Nothing could detect that, because purpose had no counterpart in the repo to be compared against — which is the exact argument that produced PDRs in the first place, applied to the repo that ships them.

**Known gap: no scheduled audit runs here.** repo-governance ships `templates/workflows/scheduled-audit.yml` and does not run one on itself, so audit domain 6 (PDR coherence) — orphan checks, non-goal violation checks, the 90-day `Last confirmed` sweep — is not operating. `lint:pdr-falsifiers` covers the two mechanical checks that need no model: falsifier presence and falsifier due dates. The judgment-shaped checks are unenforced. This repo does not run its own ADR layer either.

<!--
`_template.md` is the blank form, not a record. The underscore prefix is load-bearing:
lint:adr-readme-sync registers every file matching NNN-*.md, so a form named
000-template.md would fail the build on day one. `scripts/check-blank-form-naming.mjs`
now enforces the convention directly.

Status values:
  Proposed             — written, no falsifier yet, or falsifier not yet wired
  Accepted             — live bet, falsifier present and observable
  Superseded by PDR-N  — we changed our mind; the new record cites this one
  Retired              — the falsifier fired and we decided not to replace it

Never edit a Decision in place. Supersede it and leave the old Context intact.
-->
