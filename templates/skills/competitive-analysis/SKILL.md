---
name: competitive-analysis
description: >
  Research an external product, library, or approach against this repo's architecture.
  Spawns two parallel agents (product research + repo context), synthesizes a gap analysis,
  and produces a concrete decision: integrate, steal ideas, watch, or reject. Output lands
  in docs/watch-items/. The skill is self-discovering — it reads the repo's ADRs, architecture
  docs, and source structure rather than relying on pre-baked knowledge.
version: 1.0.0
updated: 2026-07-24
triggers:
  - /competitive-analysis
  - competitive analysis
  - analyze competitor
  - gap analysis
  - how does this compare to us
---

# Competitive / Adjacent Product Analysis

Evaluate an external product, library, or approach against this codebase. The goal is critical, specific analysis — not a feature checklist. Find the gaps, name the decision, suggest the action.

This skill is **self-discovering** — it reads the repo's actual architecture rather than relying on someone having pre-baked a list of ADRs and primitives. It works in any governed repo without customization.

**Usage:** provide a URL and optionally what to focus on.
- `/competitive-analysis https://github.com/some/project`
- `/competitive-analysis https://some-product.com focus on their event ingestion model`

---

## Step 0: Parse input and discover the repo

From the user's message, extract:
- `URL` — the external product to research
- `FOCUS` — everything after the URL, or "broad sweep" if absent

Discover this repo's shape. Do all of these in parallel:

1. **Find the ADR directory.** Check `docs/adr/`, `adr/`, `adrs/`, `decisions/`. Read every `.md` file in whatever directory you find. If you find a README or index, read it to understand the ADR landscape.

2. **Read architecture overview docs.** Read `CLAUDE.md`, `AGENTS.md`, `README.md`, and any file matching `docs/*architecture*`, `docs/*design*`, `docs/*platform*`.

3. **Discover the GitHub slug** from `gh repo view --json nameWithOwner --jq .nameWithOwner`.

4. **Pull open issues:**
   ```bash
   gh issue list --state open --limit 200 --json number,title,labels | \
     jq -r '.[] | "#\(.number) \(.title)"'
   ```

5. **List the source tree** at the top level and one level deep in key directories (e.g., `src/`, `host/`, `func/`, `lib/`, `functions-dotnet/`). Read a representative source file or two from each major area to understand conventions and primitives.

6. **Check for a migrations or schema directory** — list recent changes there.

---

## Step 1: Spawn two agents in parallel

Send both in ONE message with `run_in_background: true`. Do not poll.

---

### Agent A — Product research

```
Deep-read the product at: {URL}
Optional focus: {FOCUS or "broad sweep"}

Use WebFetch to read the URL and follow every major linked sub-page (architecture docs,
feature pages, GitHub repos, API reference). If WebFetch returns a 403 or empty body on
any page, retry that page using WebSearch (search for the page title or URL). Note which
pages you retrieved directly vs. reconstructed from search — this affects confidence.

Produce a structured brief covering these 12 sections:

1. What it is (2-3 sentences)
2. Core concepts / primitives — name the 4-8 things the product is built around. For each:
   what is it, what does it do, how is it stored/defined?
3. Execution model — streaming vs batch, event-driven vs request-response, multi-step
   workflow handling
4. Extension / customization — plugins, SDKs, custom code, config? Boundary between
   platform and user-built?
5. Credential / connection handling — named connections, OAuth, vault? Isolation?
6. Multi-component / orchestration — how are pieces composed? Fleet/swarm/hierarchical?
7. Scheduling / event-driven — cron? event triggers? webhooks? Describe the actual
   ingestion path, not just "supports events"
8. Deployment model — self-hosted vs managed, stateful vs stateless
9. Maturity signals — stars, contributors, last commit, open issues, notable users,
   GA vs preview
10. What it does NOT do — explicitly punted or out of scope
11. Quotes worth keeping (4-6 verbatim) — from actual docs, not paraphrases. Label with
    source page
12. Coverage confidence — which pages fetched directly vs reconstructed from search.
    Flag any thin sections

Write ONLY to /tmp/competitive-product.md. No other files.
```

---

### Agent B — Repo context

```
Prepare the counterpart brief for competitive analysis of: {URL}
Optional focus: {FOCUS or "broad sweep"}

Read this codebase and produce a structured brief of our current capabilities, known gaps,
and open issue landscape. DISCOVER the architecture — do not rely on pre-baked knowledge.

Repo root: {PWD}

## What to read

- ALL ADR files in the ADR directory (discover it: check docs/adr/, adr/, adrs/, decisions/)
- CLAUDE.md, AGENTS.md, README.md
- Any docs/*architecture*, docs/*design*, docs/*platform* files
- Top-level directory listing, then one level deep in each major source directory
- Skim a representative file from each major area to understand conventions and primitives

Pull open issues:
```bash
gh issue list --state open --limit 200 --json number,title,labels | \
  jq -r '.[] | "#\(.number) \(.title)"'
```

## What to produce

### 1. Our core primitives
Synthesize from the ADRs and source code you read. For each primitive: what is it, how
is it stored/defined, what does it scope? Name the 4-8 things this system is built around.
These emerge from the architecture docs — you are discovering them, not being told them.

### 2. Execution model summary
How does work flow through this system? What triggers it? What processes it? What stores
the result? Be specific about concurrency, batching, and the end-to-end path.

### 3. Credential / identity model
How are external credentials handled? What auth model? What isolation boundaries?

### 4. Scheduling / event-driven capabilities
What triggers exist? Cron, event bus, webhooks, message queues? Describe actual ingestion
paths, not just "supports events."

### 5. Multi-component / orchestration
How do the pieces compose? Is there an event bus, a service mesh, direct calls? What's
the end-to-end latency story?

### 6. Open issue index — grouped by theme
Group ALL open issues by theme. Include issue numbers. This index maps analysis findings
to existing tracked work — completeness matters. Discover themes from the issues themselves.

### 7. What we consciously chose NOT to do
Explicit ADR decisions and constraints a competitor might handle differently. What did we
reject? What tradeoffs did we make that are encoded in ADRs?

### 8. Areas of strength
Where our design is principled and likely stronger than a typical alternative.
For each, cite the ADR that encodes it.

Write ONLY to /tmp/competitive-repo.md. No other files.
```

---

## Step 2: Wait for both agents

Do not poll or sleep. You will be notified when each completes. Once both are in, proceed.

---

## Step 3: Synthesize

Read both `/tmp/competitive-product.md` and `/tmp/competitive-repo.md`.

For each gap you identify, check Agent B's open issue index first: does an existing issue already track this? Reference it. Only propose a new issue if nothing covers it.

**Length discipline: target ~150 lines.** Surface the top 5 gaps by roadmap relevance. Advantages sections: bullets only, no prose per bullet.

Write to `docs/watch-items/YYYY-MM-DD-<product-slug>.md`. If `docs/watch-items/` doesn't exist, create it first.

```markdown
# [Product Name] — Competitive Analysis

**Date:** YYYY-MM-DD
**URL:** {URL}
**Focus:** {FOCUS or "General / architecture sweep"}
**Research coverage:** {pages fetched directly vs. reconstructed from search}

---

## TL;DR

2-3 sentences: what this product is and the one-line verdict.

---

## Overlap map

What they do that we already do. Cite the ADR or code path for each row.

| Their concept | Our equivalent (ADR / file) | Notes |
|---|---|---|
| ... | ... | ... |

---

## Gap analysis (top 5 by roadmap relevance)

**[Gap name]**
> Their approach: ...
> Our current state: ...
> Relevance: HIGH / MEDIUM / LOW — one sentence
> Existing issue: #NNN [title] — OR — no existing issue
> Candidate action: Steal the idea | Integrate | File new issue | Ignore

---

## Their advantages over us

Bulleted. Honest. No rationalization.

---

## Our advantages over them

Bulleted. Cite the ADR.

---

## Decision

**[INTEGRATE | STEAL IDEAS | WATCH | REJECT]**

One paragraph. Why. What specifically changes if we act.

**New ADR needed?** [Yes — [working title] | No — existing ADR-NNN covers this]

---

## Proposed next steps

Prefer existing issues over new ones.

- [ ] **Existing issue to act on:** #NNN — [one line on what to do with it]
- [ ] **New issue to file:** [title] — [one-sentence scope] *(only if no existing issue covers this)*
- [ ] **Watch list:** revisit in [N months] when [condition]
- [ ] **No action** — [brief rationale]

---

## Notes / Quotes worth keeping

Verbatim quotes from primary sources. Label with source page. Include things we're not
adopting — the framing is often useful.
```

---

## Step 4: Branch, commit, and open PR

```bash
SLUG=$(echo <product-name> | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
DATE=$(date +%Y-%m-%d)
BRANCH="competitive-analysis/${DATE}-${SLUG}"

git fetch origin
git worktree add ../competitive-${SLUG} -b "${BRANCH}" origin/master

cp docs/watch-items/${DATE}-${SLUG}.md ../competitive-${SLUG}/docs/watch-items/

cd ../competitive-${SLUG}
git add docs/watch-items/${DATE}-${SLUG}.md
git commit -m "docs: competitive analysis — [Product Name] (${DATE})"
git push -u origin "${BRANCH}"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh pr create \
  --repo "${REPO}" \
  --base master \
  --title "docs: competitive analysis — [Product Name] (${DATE})" \
  --body "Adds competitive analysis doc for [Product Name].

**Verdict:** [INTEGRATE | STEAL IDEAS | WATCH | REJECT]

[One sentence on why and what the actionable takeaways are.]

See \`docs/watch-items/${DATE}-${SLUG}.md\` for full analysis."
```

Return the PR URL.

---

## Step 5: Present

1. Print the **TL;DR** and **Decision** (including "New ADR needed?") verbatim.
2. List **Proposed next steps** as bullets, noting existing issues vs. new.
3. Ask: *"Want to act on any of these now?"*

If yes to a new issue: `gh issue create` following `docs/issue-authoring.md`. Link the analysis doc.

If yes to an ADR: draft it in the ADR directory using the next available number, following the existing ADR format (Status / Context / Decision / Consequences).

---

## Tips

- If the URL is a GitHub repo, read its README, issues, and `docs/` files.
- Focus on the *platform model* the repo's ADRs describe — not feature parity. We are not building a clone.
- Implementation model matters more than capability surface. "They do X" is only useful with *how*.
- The coverage confidence note from Agent A matters: gaps from search-reconstructed pages are lower confidence.
