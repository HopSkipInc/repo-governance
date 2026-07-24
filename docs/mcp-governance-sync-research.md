# Research: MCP server for downstream governance-sync

**Issue:** #4 · **Date:** 2026-07-24 · **Status:** research complete — no code, per acceptance criteria

## Summary

The cheapest way to run an MCP server for governance-sync is to not run one. The
recommendation is a three-phase path where each phase is triggered by an observable
condition rather than built in anticipation:

- **Phase 0 (now): stay file-based.** Three governed repos, all local, syncing roughly
  weekly. Nothing is at capacity.
- **Phase 1 (when polling friction is real): a stdio MCP server shipped as a template
  file.** Zero hosting, zero new auth, ~half a day of work. The MCP tool *contract* is
  the deliverable; the transport is an implementation detail.
- **Phase 2 (when the first remote client exists): the same tool contract on Cloudflare
  Workers free tier**, authenticated with the GitHub token the agent already holds.
  $0/month at this scale, roughly two days including auth hardening.

Fleet-host piggybacking is rejected on ownership grounds despite having technical
capacity. GitHub Pages is rejected on confidentiality grounds. Answers to the five
research questions are inline below; the option evaluations follow.

## What the "server" actually has to do

The issue names four operations; a fifth is missing from it and turns out to be the
load-bearing one — **downloading the update itself**. Checking "prompt X is pending" is
useless to an agent that cannot then read
`downstream/<client>/<repo>/YYYY-MM-DD-*.md`, and a prompt is not self-contained: it
references files in `templates/` that the applying agent also needs. Today both reads
ride on the shared filesystem; over MCP they must be explicit tools.

| Operation | Direction | Trust profile |
|---|---|---|
| Check pending prompts | read from repo-governance | safe everywhere |
| **Download an update** (prompt body + referenced templates) | read from repo-governance | safe everywhere — templates are shape, built to ship |
| Check layer staleness | read + local comparison | safe everywhere |
| Get refresh recommendations | read + cross-reference | safe everywhere |
| Record application | **write toward repo-governance** | safe only when mediated |

The download operation carries one design requirement of its own: **version pinning.**
Every template carries a version stamp precisely because a run split across two versions
of a policy is not internally consistent. The download tool must return the prompt and
its referenced templates as one consistent snapshot (same commit), and report the
versions delivered so the downstream repo can fill its `Synced templates` table from the
response instead of re-deriving it.

The three reads can be served by anything, including a flat file. The write is the
operation the session-11 trust boundary exists for: downstream agents never write to
repo-governance directly, because concurrent unmediated writes to `_client.md` race and
because a client agent editing the consultancy's ledger is backwards. The issue's vision
("repo-governance becomes the source of truth, eliminating the reconciliation step")
is achievable — but **only in Phase 2**, where a server serializes writes and enforces
per-client scope. In Phase 0 and Phase 1 the write must keep landing in the downstream
repo's own `### Applied governance updates` section, with `/review-sync` reconciling.
A stdio tool that wrote directly to repo-governance would re-open the exact bug fixed by
`2026-07-07-fix-governance-sync-ownership.md`.

## Answers to the five research questions

1. **Cheapest way to run an MCP server 3–5 repos can call?** Don't host one: a stdio MCP
   server distributed as a file in `templates/scripts/`, launched by each downstream
   repo's own harness (`claude mcp add governance-sync -- node <path>`). $0, no deploy,
   no uptime obligation. Cheapest *hosted* option: Cloudflare Workers free tier —
   100K requests/day and first-class remote-MCP support, against a workload of maybe
   dozens of requests per week.
2. **Can the existing GitHub token authenticate?** Yes, differently per phase. Locally,
   the agent's `gh` credentials already read the private `leizerowicz/repo-governance`
   repo via the contents API — nothing to build. Remotely, the agent sends its GitHub
   token as a Bearer header and the server validates it by asking GitHub whether that
   token can read repo-governance — the access check *is* the authorization decision.
   One caveat from the MCP spec discussions: naïve token passthrough (relaying the
   client's token downstream without validating it was meant for you) is a named
   anti-pattern; the server must treat the GitHub check as its own authz step, not as
   a proxy credential. For real clients, a fine-grained PAT scoped to contents:read on
   the one repo is the clean grant. Either way: **no new auth model**, which was the
   constraint.
3. **Is there a static-file approach that eliminates the server?** Yes, and it is
   already deployed: the private GitHub repo itself. `gh api` against `_client.md` is an
   authenticated static-file server with 5,000 requests/hour per token. What does *not*
   work is GitHub Pages — Pages sites from private repos are public without an
   Enterprise plan, and `_client.md` names client repos and engagement state. The
   session-11 sync firewall (client records never leave the boundary) rules out any
   public-static option regardless of convenience.
4. **Migration path?** The stable contract is the MCP tool interface — four read tools
   (check, download, staleness, recommendation) and one record tool. Phase 1 implements it over stdio reading the local checkout (or
   GitHub API); Phase 2 lifts the same tool schemas to Streamable HTTP. Downstream
   config changes one line (stdio command → HTTPS URL). Crucially, `_client.md` stays
   the canonical ledger in every phase and the tools parse it — no parallel
   `_client.json` to drift, because a dual-write ledger is exactly the class of bug this
   repo exists to catch.
5. **Fleet-host capacity?** Technically yes — the fleet-host MCP server
   (`agents-internal.myhopskip.com/mcp`, Azure Container Apps, Streamable HTTP, working
   OAuth) is running and adding a tool is routine there. Rejected anyway; see Option D.

## Options evaluated

### Option A — GitHub-as-server (formalize the status quo)

No server. The governance-sync CLAUDE.md section already tells agents where the ledger
is; the only change is teaching remote agents to read it via `gh api` instead of a local
path. Recording stays downstream-side; `/review-sync` reconciles.

- **Cost:** $0. **Effort:** ~1 hour (edit one template section).
- **Gets you:** remote reads with existing auth, today.
- **Doesn't get you:** the single-call ergonomics the issue asks for — the agent still
  reads, parses, compares dates. The read-poll-repeat shape is unchanged; it just
  changes transport. Also does nothing for the write path.
- **Verdict:** viable, and the right *transport* answer for Phase 1's tools — but on its
  own it doesn't retire the friction that motivated the issue.

### Option B — stdio MCP server shipped as a template (recommended Phase 1)

A single Node script in `templates/scripts/` (the established delivery mechanism —
eight lint scripts already ship this way) implementing:

- `governance_pending_updates(repo)` → pending rows from `_client.md`, parsed
- `governance_get_update(prompt_id)` → the prompt body **plus every `templates/` file it
  references, at one consistent commit, with their version stamps** — the delivery
  half of the check; the response is everything the agent needs to apply the update
  without any other access to repo-governance
- `governance_layer_staleness(refresh_log)` → which layers' triggers fired, given the
  repo's Layer refresh log
- `governance_refresh_recommendation(findings)` → cross-reference audit findings
  against the staleness trigger table
- `governance_record_application(prompt, date, versions)` → appends to the *downstream
  repo's own* applied-updates section and `Synced templates` table (trust boundary
  preserved), recording the versions that `governance_get_update` actually delivered

Reads come from the local repo-governance checkout when present, falling back to the
GitHub contents API with the ambient `gh` token — which makes the same script work for
a future client who has repo read access but no local checkout.

- **Cost:** $0 — no hosting, no uptime, no auth work at all.
- **Effort:** ~half a day including tests; it is a markdown-table parser and a file
  bundler with five tool schemas around them.
- **Gets you:** the issue's "one call" ergonomics; deterministic parsing of the ledger
  (an agent misreading a table row is a real failure mode the tool eliminates);
  a frozen tool contract that Phase 2 inherits unchanged.
- **Doesn't get you:** centralized write path — reconciliation in `/review-sync` stays.
- **Risk:** it's a second reader of `_client.md`'s table format — a format change breaks
  it silently unless the script is treated as the format's de-facto schema (fine: make
  the parser strict, fail loudly on rows it can't parse).

### Option C — remote Streamable HTTP MCP on Cloudflare Workers (Phase 2)

Same five tools, hosted. Reads proxy the GitHub contents API; the Worker holds no state
of its own. `governance_get_update` resolves the prompt's template references against a
single commit SHA and returns the bundle — this is the tool that makes Phase 2
*sufficient* for a remote client, not just convenient: without it a client needs repo
read access anyway and the server adds nothing. Auth per research question 2: Bearer GitHub token, validated server-side by
a repo-read check, cached briefly. This is the first phase where
`governance_record_application` may legitimately write to repo-governance — the Worker
serializes writes (commits via a GitHub App scoped to `downstream/<client>/`), which
retires the reconciliation step in `/review-sync` and makes `_client.md` live rather
than eventually-consistent.

- **Cost:** $0/month — free tier is 100K requests/day against a workload of dozens per
  week; the paid floor is $5/month if ever needed.
- **Effort:** ~2 days — the tool logic is inherited from Phase 1; the new work is auth
  validation, the GitHub App for writes, and deploy plumbing.
- **Gets you:** real multi-client shape — clients with no filesystem access, no shared
  machine, no Hopskip anything. Also the only phase where the issue's full vision
  (centralized ledger, no reconciliation) is safe.
- **Why not now:** there is no remote client. Every governed repo shares a filesystem
  with repo-governance. Building this today is infrastructure ahead of the practice —
  the constraint the issue itself set.

### Option D — piggyback on fleet-host MCP (rejected)

The fleet-host MCP server is live, has working OAuth (the Entra wall from the 2026-04
playbook was eventually resolved), and adding a governance-sync tool would be a routine
PR. Rejected on three grounds, all structural rather than technical:

1. **Ownership boundary.** Fleet-host is HopSkipInc infrastructure; repo-governance is
   a leizerowicz consultancy asset intended to serve external clients. A future client
   cannot — and must never — call `agents-internal.myhopskip.com`.
2. **Auth model mismatch.** Fleet-host auth is Entra ID in the Hopskip tenant. Every
   external client would need a guest identity, which is precisely the "new auth model"
   the issue forbids.
3. **Coupling direction.** repo-governance governs ai-fleet. Making repo-governance's
   own sync mechanism *depend on* ai-fleet inverts the relationship — an ai-fleet outage
   or decommission would break governance sync for unrelated clients.

Fine as a thought experiment for the internal Hopskip client only; useless as a
migration path, which is what the issue asks for.

### Ruled out without full evaluation

- **GitHub Pages + static JSON** — public by default from private repos; violates the
  sync firewall. Dead on arrival.
- **GitHub Actions as pseudo-API** (workflow_dispatch → artifact) — minutes-scale
  latency per "call", artifact-download dance on the client, and an ergonomic regression
  from simply reading the file. Complexity of a server, responsiveness of email.
- **Vercel/Netlify functions** — workable but strictly dominated by Workers for this
  shape (no first-class MCP support, more cold-start variance on free tiers).
- **Fly.io / Railway containers** — no meaningful free tier anymore; a container is
  also simply more machine than five tools over a markdown file justify.

## Phase triggers (observable, not vibes)

| Transition | Trigger |
|---|---|
| Phase 0 → 1 | A reconciliation miss in `_client.md` (row wrong or stale at `/review-sync` time), or an agent misparses the ledger during a sync — either event twice in a quarter. Or: governed repo count reaches 5. |
| Phase 1 → 2 | The first governed repo without filesystem access to a repo-governance checkout — at that point Phase 2 stops being an upgrade and becomes the only way that client syncs. |

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
