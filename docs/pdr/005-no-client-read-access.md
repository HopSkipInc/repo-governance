# PDR-005: Non-goal — clients never get read access to this repo

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

repo-governance holds every client's `downstream/` slice, `gtm/`, and all engagement state.
It is the whole book of business in one repository, so a repo-level grant to any one client
is a cross-client leak **by construction** — not by misconfiguration.

Version 1 of the MCP governance-sync research recommended a fine-grained `contents:read` PAT
on this repo. Fine-grained scopes to the repo, and the repo is everything. Review caught it;
the note was substantially rewritten (issue #4, `8b06285`). The constraint reorganized the
entire research: it is why per-client distribution repos became the Phase 2 answer and why
the hosted Worker was demoted to Phase 3 — under this constraint the Worker would *be* the
confidentiality boundary, making request-time path scoping security-critical code.

The failure is silent in the worst way: **the client who receives too much has no reason to
report it.**

## Decision

No client ever receives read access to repo-governance, including read-only, including
"just for the templates." Distribution happens by explicit allowlisted copy or by prompts a
human hands over.

## Falsifier

- [ ] Revisit only when a distribution mechanism exists that scopes **below** repo level and
      a lint asserts the publish manifest references only that client's path prefixes — that
      is, Phase 2 of `docs/mcp-governance-sync-research.md` shipped and verified

Note the asymmetry: this falsifier cannot be satisfied by a market event, only by building
something. That is deliberate. A confidentiality boundary should not relax because business
conditions changed.

## Consequences

- **The distribution mechanism is also the confidentiality boundary between clients.** Every
  distribution design is constrained by this record first and convenience second.
- Sync friction is accepted as the cost. See [PDR-006](006-no-premature-infrastructure.md).
- It forecloses the obvious conveniences: a public templates mirror carved out of this repo,
  a shared read token, GitHub Pages, or inviting a client as a read-only collaborator "just
  to look at something."
