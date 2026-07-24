# Research: MCP server for downstream governance-sync

**Issue:** #4 · **Date:** 2026-07-24 · **Status:** research complete — no code, per acceptance criteria

**Revisions:**
- 2026-07-24 (v1): initial note.
- 2026-07-24 (v2): review surfaced a hard constraint the v1 analysis missed — **downstream
  clients never get read access to repo-governance, not even read-only.** This repo is the
  consultancy's entire book of business: every client's `downstream/` slice, engagement
  trackers, `gtm/`. Any repo-level grant to one client exposes every other client — a
  cross-client leak by construction. v1 under-applied the session-11 sync firewall: it even
  recommended a fine-grained PAT with `contents:read` "on the one repo", which scopes to the
  *repo* and therefore to everything in it. v2 removes GitHub-as-server for external
  clients, replaces the Phase 2 auth model, and reorganizes the options around the idea the
  constraint forces: **the distribution mechanism is also the confidentiality boundary.**

## Summary

The cheapest way to run an MCP server for governance-sync is still to not run one — but
the constraint changes *what* the serverless thing is. The recommendation is a phased
path where each phase is triggered by an observable condition:

- **Phase 0 (now): stay file-based.** Three governed repos, all internal, all sharing a
  filesystem with repo-governance. Nothing is at capacity.
- **Phase 1 (when polling friction is real): a stdio MCP server shipped as a template
  file.** Zero hosting, zero new auth, ~half a day. The five-tool contract is the
  deliverable; transport is an implementation detail.
- **Phase 2 (first external client): per-client distribution repos.** repo-governance CI
  publishes each client's slice — their `downstream/<client>/` prompts plus the shared
  `templates/` — into a private repo only that client can read. GitHub enforces the
  client boundary, so no server code can get it wrong. The Phase 1 stdio server points at
  the dist repo instead of repo-governance; the tool contract does not change. Still $0.
- **Phase 3 (contingency, may never arrive): hosted MCP on Cloudflare Workers free
  tier** — only if a client cannot run local tooling at all, or the write path must
  become live rather than mailbox-reconciled. Demoted from v1's Phase 2 because a hosted
  server would now *be* the confidentiality boundary, and a path-scoping bug in it is a
  silent cross-client leak — the exact failure class this practice exists to avoid
  hand-rolling.

Fleet-host piggybacking remains rejected on ownership grounds. GitHub Pages remains
rejected on confidentiality grounds. Answers to the five research questions are inline;
option evaluations follow.

## What the "server" actually has to do

The issue names four operations; two more emerged on review and both are load-bearing:

1. **Downloading the update itself.** Checking "prompt X is pending" is useless to an
   agent that cannot then read `downstream/<client>/<repo>/YYYY-MM-DD-*.md` — and a
   prompt is not self-contained: it references files in `templates/` the applying agent
   also needs. Today both reads ride on the shared filesystem; for any external client
   they must be explicit, and they are the operations that make the whole question real.
2. **Scoping every read to one client.** Given the no-read-access constraint, whatever
   delivers updates is also what keeps client A from seeing client B. This is not a
   feature of the sync mechanism — it *is* the sync mechanism's security requirement,
   and a scoping failure is silent: the client that receives too much has no reason to
   report it.

| Operation | Direction | Trust profile |
|---|---|---|
| Check pending prompts | read, client-scoped | safe only through the boundary |
| **Download an update** (prompt + referenced templates) | read, client-scoped | prompt is client data; templates are shape, built to ship |
| Check layer staleness | read of shared triggers + local comparison | safe everywhere — trigger tables are templates |
| Get refresh recommendations | read + cross-reference | safe everywhere |
| Record application | **write toward repo-governance** | safe only when mediated |

The download operation carries one design requirement of its own: **version pinning.**
A run split across two versions of a policy is not internally consistent, which is why
templates carry stamps. Delivery must be a consistent snapshot (one commit), reporting
the versions delivered so the downstream `Synced templates` table fills from the
response instead of being re-derived. A distribution repo gets this for free — every
publish is a commit, and the client syncs at a commit.

On the write path, the session-11 trust boundary stands in every phase: downstream
agents never write into repo-governance. The issue's vision ("repo-governance becomes
the source of truth, eliminating the reconciliation step") is achievable only where
writes are mediated — in Phase 2 the mailbox pattern gets most of the way there
(client commits applied-markers to their own dist repo; repo-governance reconciles by
pulling mailboxes, which is mechanical rather than the current read-their-CLAUDE.md
step), and only a Phase 3 hosted server makes the ledger truly live.

## Answers to the five research questions

1. **Cheapest way to run an MCP server 3–5 repos can call?** Don't host one: a stdio MCP
   server distributed as a file in `templates/scripts/`, launched by each downstream
   repo's own harness (`claude mcp add governance-sync -- node <path>`). $0, no deploy,
   no uptime obligation. Cheapest *hosted* option remains Cloudflare Workers free tier
   (100K requests/day against a workload of dozens per week) — but hosting is now a
   Phase 3 contingency, not the destination.
2. **Can the existing GitHub token authenticate?** Yes, but not the way v1 claimed. The
   token cannot prove access to repo-governance, because clients have none. Two models
   survive the constraint, both keeping "no new auth model":
   - **GitHub-enforced (Phase 2, preferred):** the client's existing GitHub identity is
     granted read on *their own* distribution repo and nothing else. Auth and scoping
     are both GitHub's problem — battle-tested, zero code.
   - **Identity-mapped (Phase 3 only):** the client sends their GitHub token; the server
     validates it against `GET /user`, maps identity → client via a server-side
     allowlist, and serves only that client's slice. The token proves *who*, the server
     decides *what* — and that decision is security-critical code we would own.
   The token-passthrough anti-pattern from the MCP spec discussions applies to both:
   the server treats the GitHub check as its own authz step, never as a proxy credential.
3. **Is there a static-file approach that eliminates the server?** Yes — but not the one
   v1 named. The governance repo itself can never be the static file store for clients.
   **Per-client distribution repos are the static-file answer that survives the
   constraint:** a private `governance-dist-<client>` repo per client, populated by a
   publish workflow in repo-governance, readable by that client's identities only.
   GitHub Pages remains dead on arrival (public from private repos without Enterprise).
4. **Migration path?** The stable contract is the MCP tool interface — four read tools
   (check, download, staleness, recommendation) and one record tool. Phase 1 implements
   it over stdio against the local repo-governance checkout; Phase 2 repoints the same
   tools at the client's dist repo (local clone or GitHub API with their own token);
   Phase 3, if it ever arrives, lifts the same schemas to Streamable HTTP. Downstream
   config changes one line per transition. `_client.md` stays the canonical ledger
   throughout, and the client-facing slice of it is *published*, never granted — no
   parallel JSON ledger to drift.
5. **Fleet-host capacity?** Technically yes — the fleet-host MCP server
   (`agents-internal.myhopskip.com/mcp`, Azure Container Apps, Streamable HTTP, working
   OAuth) is running and adding a tool is routine there. Rejected anyway; see Option E.

## Options evaluated

### Option A — GitHub-as-server on repo-governance (v1's baseline — dead for clients)

Reading `_client.md` and prompts via `gh api` against repo-governance requires exactly
the repo read grant the constraint forbids. Survives only as an internal convenience:
Hopskip repos on the same machine already have the checkout, and any internal remote
agent runs under the owner's own identity. **Not a client-facing option, full stop.**

### Option B — stdio MCP server shipped as a template (recommended Phase 1)

A single Node script in `templates/scripts/` (the established delivery mechanism —
eight lint scripts already ship this way) implementing:

- `governance_pending_updates(repo)` → pending rows from `_client.md`, parsed
- `governance_get_update(prompt_id)` → the prompt body **plus every `templates/` file it
  references, at one consistent commit, with their version stamps** — everything the
  agent needs to apply the update with no other access to repo-governance
- `governance_layer_staleness(refresh_log)` → which layers' triggers fired, given the
  repo's Layer refresh log
- `governance_refresh_recommendation(findings)` → cross-reference audit findings
  against the staleness trigger table
- `governance_record_application(prompt, date, versions)` → appends to the *downstream
  repo's own* applied-updates section and `Synced templates` table, recording the
  versions that `governance_get_update` actually delivered

Reads come from the local repo-governance checkout. (v1 proposed a GitHub-API fallback
for remote clients; the constraint kills that — the remote story is Option C, and this
same script gains a dist-repo source there.)

- **Cost:** $0 — no hosting, no uptime, no auth work at all.
- **Effort:** ~half a day including tests; a markdown-table parser and a file bundler
  with five tool schemas around them.
- **Gets you:** the issue's "one call" ergonomics; deterministic parsing of the ledger
  (an agent misreading a table row is a real failure mode the tool eliminates); a frozen
  tool contract that Phases 2 and 3 inherit unchanged.
- **Risk:** a second reader of `_client.md`'s table format — make the parser strict and
  loud on rows it can't parse, so a format change breaks visibly.

### Option C — per-client distribution repos (recommended Phase 2)

A private `governance-dist-<client>` repo per client. A publish workflow in
repo-governance, on push to master, copies an **explicit allowlist** — that client's
`downstream/<client>/` directory and the shared `templates/` tree — into the dist repo
and commits. The client's GitHub identities get read on their dist repo and nothing
else. The Option B stdio server runs client-side against a clone of the dist repo; the
tool contract is unchanged. Write-back uses the mailbox pattern: the client commits
`applied/` markers to their own dist repo, and `/review-sync` reconciles by pulling
mailboxes instead of reading each repo's CLAUDE.md section.

- **Cost:** $0 — private repos and Actions minutes at this scale are free.
- **Effort:** ~a day — the publish workflow, a lint asserting the publish manifest only
  ever references `downstream/<client>/` and `templates/` paths, and the dist-repo
  source mode in the Option B script.
- **Gets you:** the client boundary enforced by GitHub's access control rather than by
  code we write; snapshot consistency for free (a publish is a commit); a write path
  that is mediated without running anything; auth that is literally the client's
  existing GitHub login.
- **Risk, named honestly:** the publish workflow becomes the sync firewall's enforcement
  point — a misconfigured manifest is the new leak surface. It is one reviewable YAML
  file backed by a lint, which is a far smaller trusted surface than a hosted server's
  request-time path scoping, but it is not zero. The firewall rule stays absolute:
  `gtm/`, `docs/`, and every other client's directories never appear in any manifest.

### Option D — hosted Streamable HTTP MCP on Cloudflare Workers (Phase 3 contingency)

Same five tools, hosted; Bearer GitHub token validated via `GET /user` and mapped to a
client scope server-side. Reads proxy repo-governance content; writes commit via a
GitHub App, serializing the ledger and making `_client.md` truly live.

- **Cost:** $0/month on the free tier; $5/month paid floor if ever needed.
- **Effort:** ~2–3 days — tool logic inherited from Phase 1; the new work is auth
  validation, the identity→client mapping, the GitHub App, and deploy plumbing.
- **Why it moved from Phase 2 to Phase 3:** under the no-read-access constraint the
  server is no longer a convenience proxy in front of GitHub-enforced access — it *is*
  the confidentiality boundary. Every request's path scoping is security-critical code,
  and the failure mode (client A receives client B's slice) is silent. Option C buys the
  same capability with the boundary enforced by GitHub instead. Build this only if a
  client cannot run local tooling at all, or live write mediation becomes worth owning
  that risk surface.

### Option E — piggyback on fleet-host MCP (rejected)

Unchanged from v1, and the constraint reinforces it. Rejected on three structural
grounds:

1. **Ownership boundary.** Fleet-host is HopSkipInc infrastructure; repo-governance is
   a leizerowicz consultancy asset. A future client cannot — and must never — call
   `agents-internal.myhopskip.com`.
2. **Auth model mismatch.** Fleet-host auth is Entra ID in the Hopskip tenant; every
   external client would need a guest identity — precisely the new auth model the issue
   forbids, in the tenant of one particular client.
3. **Coupling direction.** repo-governance governs ai-fleet. Making the sync mechanism
   depend on a governed repo inverts the relationship.

### Ruled out without full evaluation

- **GitHub Pages + static JSON** — public by default from private repos; violates the
  sync firewall. Dead on arrival.
- **GitHub Actions as pseudo-API** (workflow_dispatch → artifact) — minutes-scale
  latency per "call", artifact-download dance, complexity of a server with the
  responsiveness of email.
- **Vercel/Netlify functions** — strictly dominated by Workers for the hosted shape.
- **Fly.io / Railway containers** — no meaningful free tier anymore, and more machine
  than five tools over a markdown file justify.

## Phase triggers (observable, not vibes)

| Transition | Trigger |
|---|---|
| Phase 0 → 1 | A reconciliation miss in `_client.md` (row wrong or stale at `/review-sync` time), or an agent misparses the ledger during a sync — either event twice in a quarter. Or: governed repo count reaches 5. |
| Phase 1 → 2 | The first governed repo whose operators are not the owner of repo-governance — the moment a real client exists, publishing their slice is the only compliant delivery path, because granting read never will be. |
| Phase 2 → 3 | A client that cannot run local tooling against a dist repo, or mailbox reconciliation demonstrably losing records. Absent those, Phase 3 never happens. |

Until a trigger fires, the file-based mechanism is the correct amount of infrastructure.

## Sources

- Cloudflare Workers free-tier limits (100K req/day, 10ms CPU; KV/D1/Durable Objects
  allowances): [agentdeals.dev/vendor/cloudflare-workers](https://agentdeals.dev/vendor/cloudflare-workers),
  [eastondev.com Cloudflare free-limits checklist](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/)
- Remote MCP bearer-token practice and the token-passthrough anti-pattern:
  [modelcontextprotocol discussion #1247](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1247)
- GitHub MCP server PAT/OAuth precedent (Bearer + PAT for remote MCP):
  [github/github-mcp-server](https://github.com/github/github-mcp-server)
- Fleet-host MCP architecture and auth history: `~/.claude/memory/mcp-server-setup-playbook.md`,
  ai-fleet `host/src/mcp-server.ts` (live at `agents-internal.myhopskip.com/mcp`)
