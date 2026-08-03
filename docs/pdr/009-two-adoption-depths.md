# PDR-009: Two adoption depths — `full` and `core`

**Status:** Accepted
**Date:** 2026-08-03
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-08-03

---

## Context

The infra-ops candidacy (2026-08-03) surfaced that the framework's smallest adoptable
unit was effectively "everything applicable." infra-ops is a solo-maintained IaC repo —
72 files, 3 open issues, no agent-worked backlog — whose highest-risk surfaces are
already governed by mechanisms stronger than anything the templates ship: production-
environment deploy gates, CODEOWNER approval on DNS, weekly Defender and SOC2 drift
checks, a 15-minute DNS watchdog. Advising full adoption there was ceremony around a
3-issue backlog; advising nothing left real gaps — no decision records, no DoD gated at
PR submission, no sync declaration.

What we know and how: the applicability matrix already stratifies *per template* (every
row's "Applicable if" condition), and the downstream-drift lint only ever reads
*declared* rows, so template absence has always been mechanically free. What absence is
not is **legible** — a repo that deliberately skips `agent-routing` is indistinguishable
from a bootstrap that never finished, and this repo's standing rule is that registration
is a decision, not a silence. We also know the shape count from the field: three governed
repos (ai-fleet, analytics-infrastructure, enrichment-pipeline) all run the full surface —
one observed shape. infra-ops is the second. A third class invented before a third shape
walks in the door is speculative generality, the failure `docs/code-conventions.md` §3
exists to record.

## Decision

The framework ships two named **adoption depths**, declared on a `class:` line in the
downstream repo's CLAUDE.md Governance section:

- **`full`** — every applicability-matrix row whose condition is met. What all three
  current governed repos run.
- **`core`** — `definition-of-done.md`, `pull_request_template.md`,
  `governance-sync-claude-section.md`, the ADR corpus (`adr/README.md` +
  `adr/_template.md`), and `scripts/check-adr-readme-sync.mjs` (a corpus without its
  index lint drifts immediately). Decisions still happen in low-traffic repos even when
  backlogs don't; everything else — routing, audits, interviews, lenses, health, DB
  harnesses — is excluded on the record.

Named by **depth**, not repo shape (`ops-infra`, `client-handoff`): depth survives a
repo changing shape. An ops repo that grows an agent-worked backlog upgrades `core` →
`full` by installing the remaining applicable rows and editing one line — the class is
a depth, not an identity. Shape-named classes would force a re-badging at exactly the
moment the repo's needs changed.

## Falsifier

- [ ] Revisit by 2026-11-03 when the first `core` repo (infra-ops) has run `core` for
  90 days — or earlier if any `core`-excluded template gets retro-installed there. A
  retro-install is evidence the bundle boundary was drawn wrong; an exclusion that
  doesn't hold is the boundary telling us where it actually lies.
- [ ] Revisit when a third adoption shape walks in the door — a repo that fits neither
  class retires "two is enough," though not the stratification itself.

## Consequences

Authorizes: this record's registration, the matrix's Class column and classes preamble,
the section template's `class:` line (v1.3.0), the kickoff prompt's class field, and
the GETTING_STARTED class note — one PR. infra-ops dogfoods `core` as a separate
downstream prompt, not in that PR.

Forecloses, until superseded: a third class; class-as-enforceable-contract lints (a
check that installed set ⊆ declared class cannot run in CI — repo-governance cannot see
downstream checkouts from a runner — and this repo already has two hand-run lints
shouting into the void; a third is the failure mode, not the fix); and per-repo
stratification prose invented downstream — the class line carries the declaration, and
the matrix preamble carries the definition.
