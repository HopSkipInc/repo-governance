---
name: adr-interview
description: >
  Bootstrap or refresh a repo's Architecture Decision Records. Probes the codebase for
  load-bearing patterns — consistent conventions that would be expensive to break —
  drafts candidate ADRs from that evidence, surfaces where the code contradicts itself
  and where enforcement is missing, then confirms with the person who holds the
  architecture. Produces numbered records in docs/adr/ with enforcement (lints or checks),
  plus a PR.
version: 1.1.0
updated: 2026-08-13
triggers:
  - /adr-interview
  - adr interview
  - architecture decision records
  - capture architecture decisions
  - bootstrap adrs
  - seed adr library
---

# Architecture Decision Record Interview

Capture how the code is shaped — load-bearing patterns, conventions, and invariants that
would be expensive to break — as numbered records in `docs/adr/`, each with the lint or
check that enforces it.

**This skill is the mirror of `pdr-interview`, and the difference is the whole design.**
The PDR skill must ask because purpose is not in the codebase. This skill can *probe*
because architecture is. Consistent patterns that would be expensive to break are
decisions, whether or not anyone wrote them down. The evidence agent does the heavy
lifting; the human confirms, corrects, and fills in the "why" — which alternatives were
considered, what incident drove the decision, whether a discovered pattern is intentional
or accidental.

**An ADR without enforcement is a suggestion.** Every ADR ships with its lint, check, or
CI gate in the same PR. If the enforcement is genuinely expensive to build now, the ADR
stays **Proposed** with a tracking issue, and the audit holds the gap. This is the
architecture-layer form of the DoD's core rule — enforcement ships with the promise.

**Usage:**
- `/adr-interview` — bootstrap a corpus from scratch
- `/adr-interview refresh` — re-confirm existing ADRs, catch drift since the last sweep

---

## Step 0: Discover the repo

Do all of these in parallel:

1. **Check for an existing corpus.** `ls docs/adr/` — if records exist, read them all. This is a **refresh**: the job is finding drift (ADRs whose enforcement is stale, patterns that changed without a superseding ADR), not duplicating existing records. Note every Status and every enforcement mechanism cited.

2. **Find the ADR directory.** Check `docs/adr/`, `adr/`, `adrs/`, `decisions/`. If records exist in a non-standard location, note it — the skill writes to wherever the repo already keeps them.

3. **Read the framing docs.** `README.md`, `CLAUDE.md`, `AGENTS.md`, and any `docs/*architecture*`, `docs/*design*`, `docs/*conventions*`.

4. **Discover the GitHub slug:** `gh repo view --json nameWithOwner,description --jq '.'`

5. **Pull open issues and recent PRs:**
   ```bash
   gh issue list --state open --limit 100 --json number,title,labels | \
     jq -r '.[] | "#\(.number) \(.title)"'
   gh pr list --state merged --limit 50 --json number,title,mergedAt | \
     jq -r '.[] | "\(.mergedAt[0:10]) #\(.number) \(.title)"'
   ```

6. **List the source tree** top-level and one level deep in the major directories. Note the directory structure — it reveals organization decisions.

7. **Read CI config and lint scripts.** `.github/workflows/`, `package.json` scripts, `Makefile`, `scripts/` or `tools/` directory. What gates already exist? What lints are wired in? Every existing lint is an ADR without a record — or an ADR that needs to be checked against its record.

8. **Read the DoD if it exists.** `docs/definition-of-done.md` — its rules are ADRs in policy form. Each "why this rule exists" callout is a decision with an incident behind it.

---

## Step 1: Spawn the evidence agent

Send with `run_in_background: true`. Do not poll — you'll be notified.

```
Read this codebase and infer the load-bearing architectural decisions — the patterns,
conventions, and invariants that would be expensive to break. You are building the
evidence base for confirming decisions with the person who holds the architecture. You
are NOT writing the decisions; you are assembling what the codebase implies so a human
can confirm, correct, or reject each one.

Repo root: {PWD}

## What to read
- ALL existing ADRs (discover the directory: docs/adr/, adr/, adrs/, decisions/)
- README.md, CLAUDE.md, AGENTS.md, any docs/*architecture*, docs/*design*, docs/*conventions*
- docs/definition-of-done.md if it exists — its rules are ADRs in policy form
- The source tree: top-level dirs, one level deep in each major dir
- CI config: .github/workflows/, package.json scripts, Makefile, scripts/ or tools/
- Open issues (gh issue list --state open --limit 100)
- Last 50 merged PRs (gh pr list --state merged --limit 50)
- Any lint or check scripts already in the repo

## What to produce

### 1. Candidate ADRs (max 8)
For each, propose: a title, a draft Decision (one sentence, specific enough to be
violated), the evidence (cited by file path, pattern, or PR), and the enforcement status.

Distinguish sharply between:
- **Discovered** — the codebase does this consistently; nobody may have decided it
  deliberatively. Cite the pattern and where it holds.
- **Decided** — someone wrote it down (ADR, doc, README, CLAUDE.md). Cite the file.
- **Enforced** — a lint or CI gate already catches violations. Cite the script/gate.
- **Unenforced** — no lint exists; violations would be silent. Flag this explicitly.

For each candidate, state the enforcement status:
- **Enforced:** name the lint/check/gate that already enforces it
- **Unenforced, lint feasible:** suggest what a lint would check (the invariant is
  mechanical enough to script)
- **Unenforced, lint infeasible:** explain why (the invariant requires judgment — this
  ADR would stay Proposed or rely on audit probes, not gates)

Rank by how load-bearing the decision is: which of these, if silently violated by a
contractor, would waste the most work or cause the hardest-to-debug failure?

### 2. Lints without ADRs
List every existing lint, check, or CI gate that enforces a decision not documented in
any ADR. Each one is an ADR waiting to be written — the enforcement already exists, the
record just needs to catch up. These are the highest-confidence candidates because the
team already invested in enforcement.

### 3. CONTRADICTIONS — the most important section
Where does the codebase disagree with itself? Examples of the shape:
- Module A uses the repository pattern; module B queries the DB directly
- The README says "all configuration via environment variables" but 3 files hardcode
  values
- An ADR says "append-only migrations" but a recent migration alters an existing file
- A lint enforces X in CI but 20 files are grandfathered with an allowlist

For each: state both sides, cite both, and DO NOT resolve it. These become the interview
questions — a contradiction is the one question a human cannot answer with a platitude.

### 4. Discovered patterns that might be accidental
List consistent patterns that could be intentional conventions or could just be how the
first engineer happened to do it. These need human triage: "is this a standard we should
enforce, or just how it was written?" Accidental patterns codified as ADRs add friction
without value.

### 5. What the repo cannot tell you
Name what is genuinely absent from the evidence: why a decision was made over alternatives,
what incident drove a convention, what was considered and rejected. Be explicit — the
interviewer needs to know which questions have no evidence behind them.

Write ONLY to /tmp/adr-evidence.md. No other files.
```

---

## Step 2: Wait, then interview

Read `/tmp/adr-evidence.md`.

**Interview discipline:**

- **Use `AskUserQuestion`. One question at a time.** This is a conversation, not a form.
- **Lead with the evidence.** Never "what are your architectural decisions?" — always *"your codebase routes all DB access through src/repositories/ except module B which queries directly — is the repository pattern the standard, and is module B a violation or an exception?"*
- **Open with the contradictions.** They're the highest-yield questions and they establish immediately that you read the repo.
- **For discovered patterns, ask the triage question:** *"Your codebase consistently does X. Is this a deliberate standard we should enforce, or is it just how it happened to be written?"* If the human says "that's just how it was written" and it's not load-bearing, drop it — not every consistent pattern is a decision.
- **For lints without ADRs, ask for the story:** *"You have a lint enforcing X but no ADR. What drove this — was there an incident?"* The incident is the Context section; the lint is the Enforcement section; the ADR writes itself from the answer.
- **Push on enforcement for unenforced candidates.** If the human confirms a decision but there's no lint, ask: *"What would catch a violation? Can we write a check for this?"* If yes, the ADR + lint ship together. If no, the ADR stays Proposed with a tracking issue — and that's a legitimate outcome, not a failure.
- **Cap at 5 records.** Fewer, real, and enforced beats a complete-looking corpus of suggestions. Cover what a contractor could violate silently; everything else emerges from audit findings later.

**For each candidate, get four things:**

| | |
|---|---|
| **Decision** | one sentence, specific enough to be violated |
| **Context** | what problem this solves, what alternatives were considered, what incident drove it (or "discovered, not decided") |
| **Enforcement** | the lint/check/gate that enforces it, or "not yet built" + what it would check |
| **Status** | Accepted (enforcement wired) or Proposed (enforcement pending, tracking issue needed) |

**Enforcement triage** — for each unenforced candidate:

| They say | Response |
|---|---|
| "code review catches it" | *"Reviewers aren't deterministic. Can we write a check?"* |
| "it's obvious" | *"To you. A new contractor or AI agent won't know. Can we lint it?"* |
| "we don't need to enforce this" | *"Then it's documentation, not an ADR. Should it be a convention note instead?"* |
| "the lint would be too complex" | *"Then the ADR stays Proposed with a tracking issue. The audit will hold the gap. Is that OK?"* |

---

## Step 3: Write the records

Records are published through the repo's **mediated write path** — the harness
stanza denies raw edits to the records directory, and the script is the
sanctioned way in. For each confirmed decision, compose the full record at a
scratch path (`/tmp/adr-<slug>.md` is fine) following `templates/adr/_template.md`,
then publish:

```bash
node scripts/write-record.mjs create adr /tmp/adr-<slug>.md
```

The script allocates the number (never reuse a superseded record's number —
the script's max+1 allocation is what makes that hold), validates the record
(required sections, status rules, the Lens line where design-lenses runs),
writes it append-only, registers the `docs/adr/README.md` row, and runs the
corpus lints. A refusal names the rule that fired — fix the draft and
re-publish. Create `docs/adr/` if absent happens inside the script, with the
gap said out loud.

- **Status:** `Accepted` only if enforcement is wired and passing — the script
  refuses `Accepted` whose Enforcement section still says "not yet built".
  Otherwise `Proposed`, with the missing enforcement named and a tracking issue
  filed (below).
- **Context:** if the decision was discovered (not made deliberatively), say so.
  "The codebase has done this consistently since the first commit" is valid
  context. The interview's job was to confirm it's intentional — that
  confirmation is the Context.
- **Supersession (refresh only):** if an existing ADR's decision has changed,
  `create` a NEW ADR citing the old one, then flip the old one's Status without
  touching its Decision or Context — the script's amend guard refuses those
  sections outright:

  ```bash
  # old record, full text, with only the Status line changed:
  node scripts/write-record.mjs amend adr <NNN> /tmp/adr-<NNN>-superseded.md
  # and its README row: copy docs/adr/README.md to /tmp, edit the row, then
  node scripts/write-record.mjs amend adr readme /tmp/README.md
  ```

  A status flip and its README row are two invocations in one commit — the
  derived Status cell syncs automatically on `amend`; curated cells (Title,
  Enforcement) move only through `amend readme`.

If the repo has no `scripts/write-record.mjs` yet (governance baseline older
than 2026-08-13), STOP and say so: the records directory is gated and there is
no mediated path. The fix is the repo-governance sync that ships the script —
do not hand-edit `docs/adr/` around the stanza, and do not ask the human to
type the records. If the repo has the script but no `check-adr-readme-sync`
lint, the script says UNGUARDED — report that in the PR body.

**For each Proposed ADR**, file a tracking issue for the missing enforcement:

```bash
gh issue create --title "Lint for ADR-NNN: <title>" --label "governance,tech-debt" \
  --body "ADR-NNN (<link>) is Proposed because enforcement is not yet wired. The lint should check: <invariant>. Blocks ADR-NNN from reaching Accepted."
```

---

## Step 4: Branch, commit, open PR

```bash
DATE=$(date +%Y-%m-%d)
BRANCH="adr/${DATE}-corpus"

git fetch origin
BASE=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|.*/||')
git worktree add ../adr-${DATE} -b "${BRANCH}" "origin/${BASE}"

cd ../adr-${DATE}
# Records land via the write path, IN the worktree — never cp into docs/adr/:
#   node scripts/write-record.mjs create adr /tmp/adr-<slug>.md
# (the script discovers the corpus relative to the worktree root)

# If any lints were written, include them
git add docs/adr/ scripts/ .github/workflows/
git commit -m "docs: architecture decision records (${DATE})

Records the load-bearing patterns this project depends on, each with its
enforcement mechanism. Confirmed by <name> on ${DATE}."
git push -u origin "${BRANCH}"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh pr create --repo "${REPO}" --base "${BASE}" \
  --title "docs: architecture decision records (${DATE})" \
  --body "..."
```

PR body must include: each record with its Decision and Enforcement one-liner; who confirmed them; anything left **Proposed** and what enforcement it's waiting on; and the contradictions surfaced in Step 1 that the interview *resolved* — that's the part a reviewer can check.

---

## Step 5: Present

1. Print each record: number, title, Decision, Enforcement, Status.
2. Name anything left **Proposed** and what enforcement it's blocked on (cite the tracking issue).
3. **Report the contradictions the interview did NOT resolve.** These are real findings — a codebase that disagrees with itself about its architecture has a problem no ADR fixes.
4. **Report discovered patterns that were triaged as accidental.** The human said "that's just how it was written" — if it's not load-bearing, it's not an ADR. But if it keeps showing up in audit findings, it may become one later.
5. Ask: *"What would a new contractor get wrong on day one that isn't covered here?"* — that's a missing ADR, and the answer is usually the highest-value record in the set.

---

## Tips

- **Architecture is in the codebase.** This is the key difference from PDRs. The evidence agent should find most of the candidates — the interview is confirmation, not origination. If you're asking the human to *invent* decisions rather than *confirm* them, the evidence agent didn't read enough code.
- **Lints without ADRs are the highest-confidence candidates.** The team already invested in enforcement. The record just needs to catch up. Always surface these first in the interview.
- **Not every consistent pattern is a decision.** "Every function returns a Promise" might be a deliberate async architecture or might be because the first engineer used async/await and everyone copied. Ask. If the answer is "that's just how we write it" and there's no incident behind it, it might not need an ADR — a convention note in the README or CLAUDE.md is cheaper and sufficient.
- **Enforcement is the gate, not the Decision.** A beautifully written ADR with no lint is a suggestion. An ugly one-liner ADR with a working lint is governance. Prioritize the enforcement over the prose.
- **On refresh, the boring outcome is the good one.** Most decisions should survive re-confirmation. If most don't, the architecture is unstable — which is a finding in itself, not a failure of the skill.
