<!-- template: pdr/README.md v1.1.0 · updated 2026-08-08 -->
# Product Decision Records

Why this software exists: who it serves, what bet it makes, what it deliberately will not do.

ADRs record how the code is shaped. PDRs record why there is any code at all. Every accepted PDR carries a falsifier — see `docs/definition-of-done.md` for what "accepted" means and why a decision without a falsifier cannot get there.

Every file in this directory must appear in the table below. The `lint:adr-readme-sync` check enforces it and fails the build on any unregistered record.

| # | Title | Status | Last confirmed |
|---|-------|--------|----------------|
| [001](001-who-we-serve.md) | Who we serve | Accepted | [DATE] |
| [002](002-not-building-mobile.md) | Not building mobile | Accepted | [DATE] |

<!--
`_template.md` is the blank form, not a record. The underscore prefix is load-bearing:
lint:adr-readme-sync registers every file matching NNN-*.md, so a form named
000-template.md would fail the build on day one, before anyone had written anything.
Same convention as _client.md and _kickoff-prompt.md in repo-governance — underscore
means "meta, not an instance". Do not renumber it.

Replace the rows above with your own. They are illustrative, not a starter set —
a PDR you did not decide is worse than no PDR.

Keep it to five or fewer. The corpus should cover the bets a contractor (human or AI)
could violate silently. Everything else can emerge later, which is the normal path.

Status values:
  Proposed             — written, no falsifier yet, or falsifier not yet wired
  Accepted             — live bet, falsifier present and observable
  Rejected             — proposed and argued down; Context and Decision left intact,
                         with a "What would reopen this" condition in place of a falsifier
  Superseded by PDR-N  — we changed our mind; the new record cites this one
  Retired              — the falsifier fired and we decided not to replace it

Rejected and Superseded records stay in this index and are never pruned. A deleted
proposal comes back — the record of what was refused, and why, is what stops the same
idea being re-litigated from scratch every six months.

Non-goals get their own number. "Not building mobile" is a decision with the same
standing as "who we serve", and it is the one the audit can most cheaply check
shipped work against.
-->
