<!-- template: adr/README.md v1.0.0 · updated 2026-07-24 -->
# Architecture Decision Records

How the code is shaped: load-bearing patterns, conventions, and invariants that would be
expensive to break. Each accepted ADR carries enforcement — a lint, check, or CI gate.

PDRs record why there is any code at all. ADRs record how the code is shaped. Every
accepted ADR must name its enforcement mechanism — see `docs/definition-of-done.md` for
what "accepted" means and why an ADR without enforcement cannot get there.

Every file in this directory must appear in the table below. The `lint:adr-readme-sync`
check enforces it and fails the build on any unregistered record.

| # | Title | Status | Enforcement |
|---|-------|--------|-------------|
| [022](022-definition-of-done.md) | Definition of Done is a First-Class Policy | Accepted | DoD + PR template + audit |
| [023](023-product-decision-records.md) | Product Decisions Are Recorded and Falsifiable | Proposed | lint:adr-readme-sync + audit PDR domain |

<!--
`_template.md` is the blank form, not a record. The underscore prefix is load-bearing:
lint:adr-readme-sync registers every file matching NNN-*.md, so a form named
000-template.md would fail the build on day one, before anyone had written anything.
Same convention as _client.md and _kickoff-prompt.md in repo-governance — underscore
means "meta, not an instance". Do not renumber it.

Replace the rows above with your own. The first two rows (022, 023) are governance ADRs
that ship with the framework — keep them if you adopted the DoD and PDRs, delete them
if you didn't. They are illustrative of the format, not a starter set.

Keep the initial corpus to five or fewer. Cover the decisions a new contractor (human or
AI) could violate silently. Everything else can emerge from audit findings later, which
is the normal path — each audit P1 that could be a lint becomes an ADR waiting to be
written.

Status values:
  Proposed             — written, enforcement not yet wired, or lint not yet built
  Accepted             — live decision, enforcement present and passing
  Superseded by ADR-N  — we changed our mind; the new record cites this one
  Retired              — the enforcement was removed and the decision no longer holds

The Enforcement column names the lint, check, or CI gate that enforces the decision.
If it says "tracking issue #N", the ADR is Proposed — enforcement is not yet shipped.
-->
