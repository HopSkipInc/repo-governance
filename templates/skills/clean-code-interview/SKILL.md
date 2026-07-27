---
name: clean-code-interview
description: >
  Bootstrap or refresh a repo's code quality conventions. Probes the codebase for naming
  patterns, file organization, dead code, and repeated code smells — distinguishing
  intentional conventions from accidental patterns. Surfaces where conventions are
  followed but not enforced, and where lints exist but aren't documented. Interviews the
  team to triage which conventions are load-bearing enough to enforce. Produces coding
  standard ADRs with lints, plus a PR.
version: 1.1.0
updated: 2026-07-27
triggers:
  - /clean-code-interview
  - clean code interview
  - code conventions
  - coding standards
  - code quality conventions
  - bootstrap code standards
---

# Clean Code Interview

Capture how code should be written in this repo — naming, organization, structure, and
quality conventions — as ADRs with enforcement, or as convention notes where enforcement
isn't warranted.

**This skill probes a different layer than `adr-interview`.** ADRs capture architectural
decisions (how the system is shaped): repository pattern, append-only migrations, all DB
access through a data layer. Clean code conventions capture how the *code itself* is
written: naming, file placement, dead code policy, complexity thresholds, import
ordering. The line is real: "all DB access goes through repositories" is an ADR; "repository
files are named `<Entity>Repository.ts` and live in `src/repositories/`" is a clean code
convention.

**The triage question is the whole design.** Architecture decisions are either
load-bearing or not — the interview confirms. Clean code conventions have a third option:
**intentional but not load-bearing.** "We use camelCase for variables" is intentional, but
a contractor violating it won't cause a bug — the formatter catches it, or it doesn't
matter. The interview's job is to sort every convention into three buckets:

1. **Enforce** — load-bearing enough that a violation could cause a bug or waste work. Gets an ADR + lint.
2. **Document** — intentional but not bug-causing. Gets a convention note, not an ADR.
3. **Drop** — accidental, not load-bearing. Gets nothing. Stop codifying how the first engineer happened to type.

**An ADR without enforcement is a suggestion.** Same rule as adr-interview: every
convention promoted to an ADR ships with its lint in the same PR. The difference is that
clean code conventions often have off-the-shelf enforcement (eslint, ruff, prettier) —
the work is configuration, not writing a custom lint.

**Usage:**
- `/clean-code-interview` — bootstrap conventions from scratch
- `/clean-code-interview refresh` — re-audit conventions against current codebase state

---

## Step 0: Discover the repo

Do all of these in parallel:

1. **Read `docs/code-conventions.md` first if it exists** — this repo's records file, and on a
   refresh it is the baseline you are checking for drift. Its §3 (Not codified) is binding on
   you: do not re-propose anything listed there. If the file does not exist, this is a
   bootstrap run and `templates/code-conventions.md` is the blank form.

2. **Check for other convention docs.** `docs/conventions.md`, `CONTRIBUTING.md`, `docs/coding-standards.md`, `docs/style-guide.md`. Read whatever exists.

3. **Read existing ADRs.** They may already encode some conventions. Don't duplicate — if ADR-005 says "all API responses follow the envelope shape in `src/types/api.ts`", that's already covered.

4. **Read lint/formatter configs.** These are the repo's *enforced* conventions:
   - JS/TS: `.eslintrc.*`, `.prettierrc*`, `biome.json`, `deno.json`
   - Python: `pyproject.toml` ([tool.ruff], [tool.black], [tool.mypy]), `.flake8`, `setup.cfg`
   - Go: `.golangci.yml`, `gofumpt` config
   - Rust: `clippy.toml`, `rustfmt.toml`
   - C#: `.editorconfig`, `Directory.Build.props`, `dotnet-format` config
   - All languages: `.editorconfig`

5. **Read CI config.** `.github/workflows/` — what lint/format gates are wired? Are they required checks or advisory?

6. **Read the DoD.** `docs/definition-of-done.md` — its Feature section may already have code quality rules.

7. **List the source tree** top-level and one level deep. Note:
   - File naming patterns (kebab-case, snake_case, PascalCase?)
   - Directory organization (feature-based? layer-based? hybrid?)
   - Test file placement (alongside source? separate test/ dir? __tests__/?)

8. **Pull recent merged PRs** — they reveal whether conventions are followed in practice:
   ```bash
   gh pr list --state merged --limit 30 --json number,title,mergedAt | \
     jq -r '.[] | "\(.mergedAt[0:10]) #\(.number) \(.title)"'
   ```

---

## Step 1: Spawn the evidence agent

Send with `run_in_background: true`. Do not poll — you'll be notified.

```
Read this codebase and inventory its code quality conventions — naming, file
organization, structural patterns, and quality invariants. You are building the evidence
base for triaging which conventions are load-bearing enough to enforce, which are
intentional but cosmetic, and which are accidental patterns that shouldn't be codified.

Repo root: {PWD}

## What to read
- docs/code-conventions.md if it exists — the existing records file. Report anything in the
  codebase that contradicts it, and treat its §3 (Not codified) as decisions already made:
  list what changed, never re-propose a recorded drop.
- docs/conventions.md, CONTRIBUTING.md, docs/coding-standards.md, docs/style-guide.md (if they exist)
- ALL existing ADRs (they may encode conventions already)
- Lint/formatter configs: .eslintrc, .prettierrc, pyproject.toml [tool.ruff], .golangci.yml, .editorconfig, etc.
- CI workflows: .github/workflows/ — what lint/format gates are wired?
- docs/definition-of-done.md if it exists
- The source tree: top-level dirs, one level deep in each major dir
- 10-20 source files sampled across modules (not just one area)
- Last 30 merged PRs (gh pr list --state merged --limit 30)
- Any existing custom lint scripts in scripts/ or tools/

## What to produce

### 1. Naming conventions (max 6 candidates)
For each, state:
- The convention (e.g., "test files are named `<name>.test.ts` alongside the source file")
- Whether it's consistent across the codebase, or where it breaks
- Whether a formatter/linter already enforces it (cite the rule)
- Whether it's likely intentional or accidental (e.g., camelCase in JS is language
  default — probably accidental; a specific test naming pattern is probably intentional)

### 2. File organization conventions (max 4 candidates)
- Where do specific file types live? (handlers, models, services, utils, tests)
- Is the directory structure feature-based, layer-based, or hybrid?
- Are there conventions about what goes in which directory?
- Is any directory consistently misused (files that don't match the directory's purpose)?

### 3. Quality invariants (max 6 candidates)
Patterns that prevent bugs if followed, cause bugs if violated:
- Error handling patterns (try/catch shape, error propagation, error types)
- Import/export conventions (barrel files? no circular deps? explicit re-exports?)
- Dead code policy (are unused exports removed? is there a tool that checks?)
- Complexity patterns (max function length, max nesting depth — enforced or not?)
- Duplication patterns (is duplicated code flagged? is there a threshold?)
- Dependency boundaries (can modules import across feature boundaries? is it enforced?)

For each: is it followed consistently? is it enforced? what happens when violated?

### 4. Lints without documentation
List every lint/formatter rule that enforces a convention not documented anywhere. Each
one is a convention the team already invested in enforcing — the record just needs to
catch up. These are the highest-confidence candidates.

### 5. CONTRADICTIONS
Where does the codebase disagree with itself?
- Module A uses one error handling pattern; module B uses another
- The lint config enforces X but 15 files have `// eslint-disable` or equivalent
- CONTRIBUTING.md says "name files X" but the codebase uses Y
- The formatter enforces 2-space indent but half the files use 4-space (pre-formatter code?)

For each: state both sides, cite both. DO NOT resolve — these become interview questions.

### 6. What's likely accidental
Patterns that are consistent but probably not deliberate:
- Language defaults (camelCase in JS, snake_case in Python)
- Framework conventions (Next.js page routing, Rails MVC layout)
- Patterns that exist because the first engineer used them and everyone copied

These need human triage: "is this a standard we should enforce, or just how it was written?"

Write ONLY to /tmp/clean-code-evidence.md. No other files.
```

---

## Step 2: Wait, then interview

Read `/tmp/clean-code-evidence.md`.

**Interview discipline:**

- **Use `AskUserQuestion`. One question at a time.**
- **Lead with the evidence.** Never "what are your code conventions?" — always *"your test files are named `<name>.test.ts` in src/ but `<name>_test.py` in scripts/ — is the TypeScript pattern the standard?"*
- **Open with contradictions.** They're the highest-yield and establish you read the code.
- **The triage question is the key question for every candidate:**
  *"Your codebase consistently does X. Is this:*
  *a) A standard we should enforce (violation could cause a bug or waste work)*
  *b) Intentional but cosmetic (we prefer it, but a violation isn't dangerous)*
  *c) Just how it was written (not a standard, don't codify it)"*
- **For lints without documentation:** *"You have an eslint rule enforcing X but no documentation of why. What drove this — was there an incident, or did someone just turn on the recommended ruleset?"*
- **Push on enforcement for "enforce" candidates:** *"Can we wire a lint for this, or does it need a custom check?"* Many clean code conventions have off-the-shelf enforcement — the work is config, not writing a script.
- **Don't over-promote to ADRs.** A convention that's "intentional but cosmetic" gets a note in CLAUDE.md or CONTRIBUTING.md, not an ADR. ADRs are for load-bearing decisions. The interview's job is to sort, not to maximize ADR count.

**For each "enforce" candidate, get:**

| | |
|---|---|
| **Convention** | one sentence, specific enough to be violated |
| **Context** | what failure mode it prevents, or "discovered, team confirms it's intentional" |
| **Enforcement** | the lint rule/check that enforces it (existing or to be wired) |
| **Status** | Accepted (enforcement wired) or Proposed (enforcement pending) |

**For "document" candidates, get:**
- One sentence for a convention note (CLAUDE.md or CONTRIBUTING.md)
- No enforcement needed — these are preferences, not rules

---

## Step 3: Write the output

Four parts. **The records file is the one that must exist** — the other three are how its
rows get enforced, and any of them can be empty on a given run.

### `docs/code-conventions.md` (the records file)

Copy `templates/code-conventions.md` if the repo has no records file yet, then fill it in.
This is where every triage decision lands, in one of three sections: §1 Enforced, §2
Documented, §3 Not codified. **§3 is not a leftovers bin** — it is what stops the next
refresh from re-proposing the same accidental patterns, and it is the section that makes
this file cheaper to maintain than it was to write.

Also fill §4 (lints wired in CI that document nothing) and §5 (contradictions the interview
did not resolve). Both are inputs to the next refresh, and §4 is what the audit reads.

**The file never syncs back to repo-governance.** Same rule as `docs/agent-routing-records.md`
— the blank form is upstream, the contents are local. Never `cp` over an existing one.

Add a Review log row every run, including refresh runs that changed nothing. A refresh with
no log row is indistinguishable from a refresh that never happened.

### ADRs (for "enforce" candidates)

Write `docs/adr/NNN-<slug>.md` following `templates/adr/_template.md`. These are coding-standard ADRs — same format, same enforcement requirement.

- **Status:** `Accepted` only if the lint is wired and passing. Otherwise `Proposed` with a tracking issue.
- **Enforcement:** cite the specific lint rule (e.g., `@typescript-eslint/no-explicit-any`), formatter config, or custom check script.
- **Register in `docs/adr/README.md`** and verify with `check-adr-readme-sync.mjs`.

### Convention notes (for "document" candidates)

Add to `CLAUDE.md` under a `## Code Conventions` section, or to `CONTRIBUTING.md`:

```markdown
## Code Conventions

- Test files are named `<name>.test.ts` and live alongside the source file
- Use named exports, not default exports
- Error responses follow the envelope shape in `src/types/api.ts`
```

These are preferences, not rules — no enforcement, no ADR, no audit finding if violated.

### Lint configuration (for unenforced "enforce" candidates)

Wire the lint in the same PR if possible:
- Configure the rule in the existing linter config (eslint, ruff, golangci-lint, etc.)
- Add to the CI gate if not already wired
- If the lint is custom, write the script in `scripts/` and wire it into `npm run check` (or equivalent)

If wiring is too complex for this PR, file a tracking issue and leave the ADR as Proposed.

---

## Step 4: Branch, commit, open PR

```bash
DATE=$(date +%Y-%m-%d)
BRANCH="clean-code/${DATE}"

git fetch origin
BASE=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|.*/||')
git worktree add ../clean-code-${DATE} -b "${BRANCH}" "origin/${BASE}"

cd ../clean-code-${DATE}
cp <written ADRs, convention notes, lint configs> <appropriate locations>

git add docs/code-conventions.md docs/adr/ CLAUDE.md CONTRIBUTING.md .eslintrc* pyproject.toml scripts/ .github/workflows/
git commit -m "docs: code quality conventions (${DATE})

Load-bearing conventions promoted to ADRs with enforcement. Cosmetic
conventions documented in CLAUDE.md. Confirmed by <name> on ${DATE}."
git push -u origin "${BRANCH}"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh pr create --repo "${REPO}" --base "${BASE}" \
  --title "docs: code quality conventions (${DATE})" \
  --body "..."
```

PR body must include:
- The `docs/code-conventions.md` diff summarised as counts: N enforced, N documented, N dropped
- Each ADR with its convention, enforcement, and status
- Convention notes added to CLAUDE.md or CONTRIBUTING.md (list them)
- Lints wired in this PR (list rules added/configured)
- Anything left Proposed and what enforcement it's waiting on
- Contradictions the interview resolved

---

## Step 5: Present

1. Print the records file's three counts (enforced / documented / not codified) and every
   row in §4 — lints enforcing something nobody wrote down. Those are next run's easiest wins.
2. Print each ADR: number, title, convention, enforcement, status.
3. Print convention notes added to CLAUDE.md / CONTRIBUTING.md.
4. **Report the "drop" decisions** — patterns the human said are accidental and not worth codifying. This is valuable context: the next audit won't flag these as missing ADRs.
5. **Report unresolved contradictions.** A codebase with inconsistent conventions across modules has a problem that conventions alone don't fix.
6. Ask: *"What code quality issue has bitten you more than once?"* — that's a convention that should be an ADR with a lint.

---

## Tips

- **Not every pattern is a convention.** The most important skill is distinguishing intentional conventions from accidental patterns. "Every file has a default export" might be a team standard or might be because the first engineer used default exports and everyone copied. Ask.
- **Off-the-shelf enforcement is the fast path.** Most clean code conventions (naming, import ordering, no-unused-vars, complexity thresholds) have existing linter rules. The work is configuration + documentation, not writing custom scripts. Check eslint, ruff, golangci-lint rule sets before proposing a custom lint.
- **Don't over-promote.** A repo with 20 ADRs about code style is a repo where nobody reads ADRs. Reserve ADRs for conventions where violation causes bugs or wastes work. Everything else is a convention note.
- **The formatter is your best friend.** If a convention is purely cosmetic (indentation, semicolons, quote style), the formatter handles it. Don't write an ADR for what prettier already enforces — the formatter IS the enforcement, and it doesn't need a record.
- **Contradictions often reveal stale conventions.** "Module A uses the old pattern, module B uses the new pattern" usually means the convention changed and nobody wrote the superseding ADR. The interview should surface this, and the fix is a new ADR + a tracking issue to migrate module A.
