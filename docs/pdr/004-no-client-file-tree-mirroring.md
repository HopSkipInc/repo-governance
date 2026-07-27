# PDR-004: Non-goal — never mirror a client's file tree

**Status:** Accepted
**Date:** 2026-07-27
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-07-27

---

## Context

In session 10 (2026-07-07) two downstream prompts were written that encoded exact ADR
filenames, source paths, and primitive names for specific client repos. Both were reverted.
The reasoning recorded at the time: *"repo-governance should teach patterns and discovery
methods, not maintain a shadow mirror of each client's file tree. Skills that say 'read all
ADRs, read the architecture docs, discover the primitives' scale infinitely — skills that
list `adr/0017-enrichment-prioritization.md` don't survive the next ADR write."*

The pull toward mirroring is constant, because a hardcoded path is always the faster way to
make one client's run work today.

## Decision

Templates and skills teach **discovery methods**, never a copy of a client's structure. A
skill says "find the ADR directory, read every record, synthesize the primitives." It never
enumerates a client's filenames, directory layout, or domain nouns.

## Falsifier

- [ ] Revisit when a discovery-based skill produces a wrong answer **twice in the same
      client repo**, and a repo-specific variant demonstrably fixes what discovery could not

## Consequences

- Skills cost more to write. Every one carries a discovery step that a hardcoded version
  would not need.
- A client asking to "just hardcode it for us" gets refused, and this record is the citation
  rather than an argument reconstructed from scratch.
- It forecloses per-client skill forks, which is the obvious shortcut when a client's layout
  is unusual. The unusual layout is the test of the discovery step, not an exception to it.
- Related and narrower: `downstream/` holds prompts that install, update, or apply a
  governance template — never cross-repo product work. That rule was proposed in session 14
  and still is not written down anywhere as a record.
