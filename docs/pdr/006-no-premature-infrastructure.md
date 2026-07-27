# PDR-006: Non-goal — no infrastructure before the practice needs it

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

Issue #4 researched an MCP server for downstream governance-sync and concluded with a
phased recommendation where **every phase is gated on an observable condition**, not on a
date or an appetite. Phase 0 is "stay file-based: three governed repos, all internal, all
sharing a filesystem with repo-governance — nothing is at capacity."

Three approaches were rejected outright: piggybacking the fleet-host MCP server (ownership
and a new auth model in a client's tenant), GitHub Pages (public from a private repo — a
sync-firewall violation), and Actions-as-API (minutes-scale latency).

The research took a day and built nothing, which is the outcome that made it worth doing.

## Decision

Stay file-based. Build no server, no hosted service, and no new auth model until a named
phase trigger in `docs/mcp-governance-sync-research.md` fires. Friction is measured before
it is solved.

## Falsifier

- [ ] Revisit when the Phase 1 trigger fires — polling friction is real: reading
      `_client.md`, checking triggers, and comparing dates has become a repeated cost a
      human is actually paying
- [ ] Revisit when the Phase 2 trigger fires — the first **external** client, at which point
      per-client distribution repos become the answer per
      [PDR-005](005-no-client-read-access.md)

## Consequences

- Manual sync friction is accepted and should be *measured* rather than pre-solved. The
  measurement is the falsifier.
- The five-tool contract from the research is the stable interface across all phases;
  transport swaps underneath it. Designing that contract early was in scope; implementing it
  was not.
- It forecloses building the server because it would be interesting. This record exists
  largely to make that specific temptation expensive.
