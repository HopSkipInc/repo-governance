---
name: agent-instructions-interview
description: >
  Bootstrap or refresh a repo's agent instruction files (CLAUDE.md, AGENTS.md,
  .cursorrules). Probes the codebase for what an AI agent needs to know to work
  effectively — build/test/lint commands, architecture overview, key files, conventions,
  gotchas — and reconciles what's documented against what's actually true. Interviews the
  team to surface tribal knowledge that isn't written anywhere. Produces a verified,
  complete agent instruction file, plus a PR.
version: 1.0.0
updated: 2026-07-24
triggers:
  - /agent-instructions-interview
  - agent instructions interview
  - CLAUDE.md
  - AGENTS.md
  - agent briefing
  - bootstrap agent instructions
---

# Agent Instructions Interview

Capture what an AI agent needs to know to work effectively in this repo — build commands,
test commands, lint commands, architecture overview, key files, conventions, and gotchas —
as a verified, complete agent instruction file.

**This skill is the meta-layer.** ADRs govern how the code is shaped. Clean code governs
how the code is written. Test coverage governs how the code is verified. Agent
instructions govern *how the agent that writes the code is briefed.* If the briefing is
wrong, every agent that works in the repo makes the same mistakes — wrong commands, stale
architecture assumptions, missing conventions — and those mistakes compound across
sessions.

**The evidence reconciles instructions with reality. The interview fills in tribal
knowledge.** The evidence agent checks what's in CLAUDE.md against what's in the
codebase: do the commands exist? do the paths exist? does the architecture description
match the actual structure? The interview surfaces what isn't written anywhere — the
gotchas, the "don't do X even though it looks like you should," the build quirks that
only the person who set them up knows.

**Enforcement for agent instructions is accuracy.** There's no lint for "CLAUDE.md is
correct" — the enforcement is that a new agent can work in the repo without getting
confused. The closest mechanical check is: do the commands in the file exist? do the
paths referenced exist? does the architecture description match the directory structure?
This skill verifies all three.

**Usage:**
- `/agent-instructions-interview` — bootstrap a CLAUDE.md / AGENTS.md from scratch
- `/agent-instructions-interview refresh` — verify an existing file against current state

---

## Step 0: Discover the repo

Do all of these in parallel:

1. **Read existing agent instruction files.** Check ALL of:
   - `CLAUDE.md` (Claude Code, opencode)
   - `AGENTS.md` (generic agent instruction convention)
   - `.cursorrules` (Cursor)
   - `COPILOT_INSTRUCTIONS.md` (GitHub Copilot)
   - `.claude/` directory (Claude Code skills, commands, settings)
   - `.github/copilot-instructions.md` (GitHub Copilot)
   - Any other instruction file referenced in README or CONTRIBUTING

   If multiple exist, note which is the primary and whether they contradict each other.

2. **Read the DoD.** `docs/definition-of-done.md` — should be referenced from the agent instructions.

3. **Read existing ADRs and convention docs.** `docs/adr/`, `docs/conventions.md`, `CONTRIBUTING.md` — the agent instructions should point to these, not duplicate them.

4. **Discover the actual build/test/lint commands.** This is the most important probe — wrong commands are the #1 agent failure mode:
   ```bash
   # What build/test/lint commands actually exist?
   cat package.json | jq '.scripts' 2>/dev/null
   cat Makefile 2>/dev/null | grep '^[a-z].*:'
   cat Cargo.toml 2>/dev/null | grep -A5 '\[workspace\]'
   cat pyproject.toml 2>/dev/null | grep -A3 '\[tool'
   cat .github/workflows/*.yml | grep -E 'run:|name:' | head -40
   ```

5. **Map the actual directory structure.**
   ```bash
   ls -la
   ls -d */  # top-level directories
   # One level deep in major dirs
   for d in src lib tests docs scripts; do [ -d "$d" ] && echo "=== $d ===" && ls "$d"; done
   ```

6. **Read README.md and architecture docs.** `README.md`, `docs/*architecture*`, `docs/*design*` — the agent instructions should summarize, not contradict, these.

7. **Check for common agent failure modes.** Look for:
   - Commands in CLAUDE.md that don't exist in package.json / Makefile
   - Paths referenced in CLAUDE.md that don't exist
   - Architecture descriptions that don't match the actual directory structure
   - Missing sections: no build commands? no test commands? no lint commands?
   - Stale tooling references (e.g., "use jest" when the repo migrated to vitest)

---

## Step 1: Spawn the evidence agent

Send with `run_in_background: true`. Do not poll — you'll be notified.

```
Read this codebase and audit its agent instruction files (CLAUDE.md, AGENTS.md,
.cursorrules, etc.) for accuracy and completeness. You are building the evidence base
for a conversation about what an AI agent needs to know to work effectively in this repo.
You are checking what's documented against what's actually true, and surfacing what's
missing entirely.

Repo root: {PWD}

## What to read
- ALL agent instruction files: CLAUDE.md, AGENTS.md, .cursorrules, COPILOT_INSTRUCTIONS.md,
  .github/copilot-instructions.md, .claude/ directory
- README.md, CONTRIBUTING.md, docs/*architecture*, docs/*design*
- docs/definition-of-done.md if it exists
- All existing ADRs (docs/adr/, adr/, adrs/, decisions/)
- docs/conventions.md or equivalent
- package.json scripts, Makefile targets, pyproject.toml [tool.*] sections
- .github/workflows/ — what CI actually runs
- The source tree: top-level dirs, one level deep in each major dir
- Any config files that reveal tooling: jest.config, vitest.config, .eslintrc, tsconfig, etc.

## What to produce

### 1. Accuracy audit
For each existing agent instruction file, check every claim against reality:

| Claim in instructions | Reality | Status |
|---|---|---|
| "Run tests with `npm test`" | `package.json` has `test: "vitest"` | STALE — command is `npm test` but framework changed from jest to vitest |
| "Source code is in `src/`" | `src/` exists with 20 files | ACCURATE |
| "All new code needs tests" | DoD says this but no test-presence check in CI | ACCURATE but unenforced (note it) |
| "We use the repository pattern" | No ADR exists, pattern is inconsistent | STALE or aspirational |

Check ALL of: build commands, test commands, lint commands, directory paths, file paths,
architecture descriptions, tooling references, convention references, and workflow
descriptions.

### 2. Completeness audit
What sections are missing that an agent would need? Check for:

- [ ] Build/run commands (how to start the app locally)
- [ ] Test commands (how to run tests, different levels if they exist)
- [ ] Lint/format commands (how to check code quality)
- [ ] CI commands (what runs in CI — agents should know what will gate their PR)
- [ ] Architecture overview (what are the major components and how they relate)
- [ ] Key files table (what files should an agent read before working)
- [ ] Conventions section (naming, structure, patterns — or pointer to conventions doc)
- [ ] Gotchas section (things that would cause an agent to do the wrong thing)
- [ ] DoD reference (pointer to docs/definition-of-done.md)
- [ ] ADR reference (pointer to docs/adr/ and the README index)
- [ ] PDR reference (pointer to docs/pdr/ if it exists)

For each missing section: is the information available elsewhere in the repo (and just
needs to be pointed to), or is it tribal knowledge that needs to be captured?

### 3. Multiple instruction files
If the repo has multiple agent instruction files (e.g., CLAUDE.md + AGENTS.md +
.cursorrules), compare them:
- Do they contradict each other?
- Which is the primary / most up-to-date?
- Should the others be consolidated or deleted?

### 4. CONTRADICTIONS — the most important section
Where do the instructions disagree with reality?
- CLAUDE.md says "use jest" but the repo uses vitest
- CLAUDE.md references `src/models/` but the directory is `src/entities/`
- CLAUDE.md says "all PRs need 2 approvals" but the branch protection rule requires 1
- AGENTS.md describes a monolith but the repo is now a multi-package workspace
- .cursorrules has a "code style" section that contradicts the eslint config

For each: state both sides, cite both. DO NOT resolve — these become interview questions.

### 5. What only a human knows
List the tribal knowledge that isn't written anywhere but would cause an agent to fail:
- "Don't run migrations locally — use the dev database at <url>"
- "The test suite takes 20 minutes; run `npm run test:unit` for fast feedback"
- "Module X is deprecated and being replaced; don't add new code there"
- "The build breaks on Node 18; use Node 20"
- "PRs to the main branch are protected; create PRs against develop"

These are the interview questions — the things an agent would get wrong on day one that
no file in the repo would warn it about.

Write ONLY to /tmp/agent-instructions-evidence.md. No other files.
```

---

## Step 2: Wait, then interview

Read `/tmp/agent-instructions-evidence.md`.

**Interview discipline:**

- **Use `AskUserQuestion`. One question at a time.**
- **Open with the accuracy contradictions.** *"Your CLAUDE.md says to run tests with jest, but the repo uses vitest. When did you switch?"* These are factual corrections — fast, high-confidence, and establish that you checked.
- **Then move to completeness.** For each missing section: *"Your agent instructions don't mention how to run the app locally. What's the command?"*
- **The tribal knowledge section is the highest-value interview.** *"What would a new AI agent get wrong on day one in this repo? What's the thing that would make it do the wrong work?"* This is the question that surfaces gotchas no file in the repo contains. Push for specifics — "it would mess up" is not a gotcha; "it would run migrations against the production database because the connection string is in .env.example" is a gotcha.
- **For architecture, ask for the one-paragraph version.** *"If you had 30 seconds to describe this system's architecture to a new agent, what would you say?"* That paragraph is the architecture overview. Don't let them write a novel — agents need the 30-second version, with pointers to detailed docs.
- **For key files, ask:** *"What files should an agent read before starting work in this repo?"* The answer is the key files table. Usually 3-5 files.
- **For gotchas, push for the painful ones:** *"What has actually gone wrong when an agent (or a new developer) worked in this repo?"* Past failures are the best predictor of future agent mistakes.

**For each section of the agent instructions, get:**

| Section | Source | Status |
|---|---|---|
| Build/run commands | Discovered from package.json/Makefile | Verify with human |
| Test commands | Discovered from CI config | Verify with human |
| Lint/format commands | Discovered from lint configs | Verify with human |
| Architecture overview | Human interview | Capture the 30-second version |
| Key files table | Human interview | 3-5 files |
| Conventions | Pointer to docs/conventions.md or ADR README | Verify it exists |
| Gotchas | Human interview | This is the gold |
| DoD/ADR/PDR references | Discovered from file system | Verify they exist |

---

## Step 3: Write the output

### Agent instruction file

Write or update `CLAUDE.md` (or `AGENTS.md` if that's the repo's convention). The file
should have these sections:

```markdown
# <Repo Name>

<One-sentence description of what this repo does>

## Build & Run

- **Install:** `<command>`
- **Run locally:** `<command>`
- **Build:** `<command>`

## Testing

- **All tests:** `<command>`
- **Unit tests (fast):** `<command>`
- **Integration tests:** `<command>`
- **Coverage report:** `<command>`

## Linting & Formatting

- **Lint:** `<command>`
- **Format:** `<command>`
- **Type check:** `<command>`

## CI

The following checks must pass before merge:
- <list the required CI checks>

## Architecture

<30-second overview — what are the major components, how they relate, where the
important code lives. Point to detailed architecture docs if they exist.>

## Key Files

| File | What it is | Read before |
|------|-----------|-------------|
| `docs/definition-of-done.md` | Done checklist | every PR |
| `docs/adr/README.md` | Architecture decisions index | any architecture work |
| <file> | <description> | <when> |

## Conventions

<Pointer to conventions doc, or 3-5 bullet points of the most important conventions.
Don't duplicate docs/conventions.md — point to it.>

## Gotchas

- <Gotcha 1 — the thing that would make an agent do the wrong work>
- <Gotcha 2>
- <Gotcha 3>

## Before Declaring Any Work Done

Check `docs/definition-of-done.md` — find the row for your work type and satisfy every
item. CI passing is necessary, not sufficient.
```

### Verification

After writing, verify every command and path:

```bash
# Every command in the file should actually work
# Test each one:
<build command> --help 2>/dev/null || echo "BUILD COMMAND FAILED"
<test command> --help 2>/dev/null || echo "TEST COMMAND FAILED"

# Every path referenced should exist
for f in docs/definition-of-done.md docs/adr/README.md <other referenced paths>; do
  [ -f "$f" ] || echo "MISSING: $f"
done
```

Note any failures in the PR body. The agent instructions are only useful if they're
accurate — a wrong command is worse than a missing one.

### Consolidation (if multiple instruction files exist)

If the repo has multiple agent instruction files (CLAUDE.md + AGENTS.md + .cursorrules),
consolidate into one primary file and either:
- Delete the others (if they're stale duplicates)
- Replace them with a pointer to the primary (if the tool requires the file to exist)
- Note the consolidation in the PR body

---

## Step 4: Branch, commit, open PR

```bash
DATE=$(date +%Y-%m-%d)
BRANCH="agent-instructions/${DATE}"

git fetch origin
BASE=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|.*/||')
git worktree add ../agent-instructions-${DATE} -b "${BRANCH}" "origin/${BASE}"

cd ../agent-instructions-${DATE}
cp <written CLAUDE.md or AGENTS.md> <location>

# If consolidating, remove stale instruction files
git add CLAUDE.md AGENTS.md .cursorrules .github/copilot-instructions.md
git commit -m "docs: agent instructions audit and refresh (${DATE})

Verified all commands and paths against codebase. Added missing
sections (architecture, key files, gotchas). Reconciled stale
references. Confirmed by <name> on ${DATE}."
git push -u origin "${BRANCH}"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh pr create --repo "${REPO}" --base "${BASE}" \
  --title "docs: agent instructions audit and refresh (${DATE})" \
  --body "..."
```

PR body must include:
- Accuracy corrections made (stale commands/paths fixed — list them)
- Sections added (what was missing — list them)
- Gotchas captured (list them — these are the highest-value additions)
- Verification results (every command tested, every path checked)
- Files consolidated or deleted (if multiple instruction files existed)
- Contradictions the interview resolved

---

## Step 5: Present

1. Print the completed agent instruction file.
2. **Report every accuracy correction.** "CLAUDE.md said jest, repo uses vitest" — these are the findings that would have caused agent failures.
3. **Report the gotchas.** These are the gold — the tribal knowledge that was in someone's head and is now written down. Highlight them.
4. **Report unresolved contradictions.** If the human couldn't resolve a contradiction ("I'm not sure when we switched frameworks"), flag it — the instructions have a gap that needs a follow-up.
5. **Report verification failures.** If any command or path didn't check out, say so — the PR shouldn't merge until those are fixed.
6. Ask: *"If a new AI agent started working in this repo right now with these instructions, what would it still get wrong?"* — that's a missing gotcha. Keep iterating until the answer is "I think it would be fine."

---

## Tips

- **Wrong commands are the #1 agent failure mode.** An agent that runs `npm test` when the command is `npm run test:unit` wastes a turn, gets confused, and may skip testing entirely. Verify every command by running it.
- **The gotchas section is the highest-value output.** Build commands can be discovered by reading package.json. Gotchas can't — they exist only in the heads of people who learned them the hard way. Spend the most interview time here.
- **Point, don't duplicate.** If `docs/conventions.md` exists, the agent instructions should say "see docs/conventions.md" — not re-list the conventions. Duplicated information drifts; pointed information stays current.
- **The 30-second architecture overview is the right length.** Agents don't need a novel — they need enough context to know where things are and how they relate, with pointers to detailed docs. If the architecture section is longer than the build commands section, it's too long.
- **Multiple instruction files are a problem.** CLAUDE.md + AGENTS.md + .cursorrules with overlapping but slightly different content is a drift factory. Consolidate to one primary and point the others at it.
- **Refresh when tooling changes.** The most common cause of stale agent instructions is a tooling migration (jest → vitest, eslint → biome, npm → pnpm) that didn't update CLAUDE.md. Run this skill after any tooling migration.
- **The enforcement is accuracy.** There's no lint for "CLAUDE.md is correct." The check is running every command and verifying every path. If you skip the verification step, you're shipping unverified instructions, and an agent will follow them into a wall.
