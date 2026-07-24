<!-- template: governance-sync-claude-section.md v1.1.0 · updated 2026-07-24 -->
# Governance sync — CLAUDE.md section

When a downstream repo's CLAUDE.md includes this section, the agent can reliably find
and apply governance updates from repo-governance. Without it, the agent has no way to
discover the repo-governance path, the client name, or the prompt convention.

## Template

Add this section to the repo's CLAUDE.md. Replace `<CLIENT>` and `<REPO-SLUG>` with
the actual values (e.g., `hopskip` and `enrichment-pipeline`).

```markdown
## Governance

This repo is governed by repo-governance at `~/repos/greg/repo-governance`.
The client identifier is `<CLIENT>` and the repo slug is `<REPO-SLUG>`.

To check for and apply pending governance updates:

1. Read `~/repos/greg/repo-governance/downstream/<CLIENT>/_client.md`
2. Find rows for `<REPO-SLUG>` with status `pending`
3. Read each pending prompt at the linked file path
4. Apply the changes described in the prompt
5. Record the application in this repo by appending to the `## Applied governance updates` list at the bottom of THIS section. Format:
   ```
   - [prompt-filename] — applied [YYYY-MM-DD]
   ```
   (repo-governance's `_client.md` is the source of truth, NOT this repo — do not modify files in repo-governance)

To check for stale governance layers (run during governance sync, skip if nothing is stale):

1. Read the staleness triggers table in `docs/definition-of-done.md` → Governance layer refresh
2. For each of the five layers, check whether its staleness trigger has fired:
   - **PDRs:** any `Last confirmed` > 90 days? any falsifier condition fired?
   - **ADRs:** lints in CI without corresponding ADRs? ADRs Proposed for 3+ audit cycles? module contradictions in last audit?
   - **Clean code:** lint/formatter config changed since last refresh? new modules violating conventions?
   - **Test coverage:** coverage dropped? new modules with no tests? false-green tests in last audit?
   - **Agent instructions:** do the commands in this CLAUDE.md actually work? do the referenced paths exist? did tooling change?
3. For each stale layer, run the matching refresh skill from `~/repos/greg/repo-governance/templates/skills/`:
   - `pdr-interview refresh` / `adr-interview refresh` / `clean-code-interview refresh` / `test-coverage-interview refresh` / `agent-instructions-interview refresh`
4. Skip layers that are not stale — refresh what's stale, not everything
5. Update the `### Layer refresh log` table below with today's date for each refreshed layer

### Applied governance updates

<!-- append new entries below when you apply a downstream prompt -->

### Layer refresh log

| Layer | Last refreshed | Trigger |
|-------|---------------|---------|
| PDRs | — | — |
| ADRs | — | — |
| Clean code | — | — |
| Test coverage | — | — |
| Agent instructions | — | — |

### Synced templates

Every governance template carries a version stamp. Record what this repo installed, so
both sides can tell when a local copy has fallen behind — without this, a repo is running
some unknown vintage and neither it nor repo-governance can detect the drift.

| Template | Installed version | Synced on |
|---|---|---|
| — | — | — |

Read a template's current version from its stamp:

```bash
# markdown templates carry an HTML comment on line 1; skills use frontmatter
head -1 ~/repos/greg/repo-governance/templates/<name>.md
grep -m2 -E '^version:|^updated:' ~/repos/greg/repo-governance/templates/skills/<name>/SKILL.md
```

Before running any skill that reads a policy doc, compare the installed version against
the template. **A run split across two versions of a policy is not internally consistent,
and the person running it cannot tell from the inside.**

Governance templates live in `~/repos/greg/repo-governance/templates/` and are
the source of truth for ADR format, DoD, issue authoring, audit structure, PR
templates, and watch-list conventions. When in doubt, check the template first.
```

## Design notes

- The section is intentionally small — the agent needs location, convention, and the
  apply-then-record-locally workflow. Everything else it can discover by reading.
- The `Applied governance updates` subsection is where the downstream repo records what
  it has applied. repo-governance reads this during `/review-sync` to reconcile `_client.md`.
  The downstream repo never writes to repo-governance — that's a trust boundary.
- The `Layer refresh log` table tracks when each of the five governance layers was last
  refreshed. The staleness check compares this against the triggers in the DoD. If nothing
  is stale, the agent skips the refresh step entirely — no wasted effort.
- The template path is included so the agent can self-serve on conventions without
  needing a prompt for every question.
- This replaces the pattern of generating detailed per-repo downstream prompts with
  repo-governance knowing every ADR filename. The agent reads the prompt, the prompt
  tells it what to do, and the agent discovers the repo's specifics at runtime.
- **The five layers have independent staleness clocks.** A tooling migration makes agent
  instructions stale but doesn't make PDRs stale. A product pivot makes PDRs stale but
  doesn't make clean code conventions stale. The refresh check tests each layer
  independently and refreshes only what's drifted.
