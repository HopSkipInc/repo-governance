---
name: pdr-interview
description: >
  Bootstrap or refresh a repo's Product Decision Records. Probes the codebase for what it
  reveals about who it serves and what it bets on, drafts candidate PDRs from that evidence,
  then interviews the person who actually holds the thesis to confirm, correct, or reject
  each one. Produces numbered records in docs/pdr/ with observable falsifiers, plus a PR.
  The evidence is the interview's leverage — this skill never asks a blank-slate question.
version: 1.1.0
updated: 2026-08-13
triggers:
  - /pdr-interview
  - pdr interview
  - product decision records
  - why are we building this
  - capture the thesis
  - bootstrap pdrs
---

# Product Decision Record Interview

Capture why this software exists — who it serves, what bet it makes, what it deliberately will not do — as numbered, falsifiable records in `docs/pdr/`.

**This skill is different from every other skill in this repo, and the difference is the whole design.** Every other skill discovers by probing: read the ADRs, walk the source, infer the primitives. That works because architecture is *in the codebase* — consistent patterns that would be expensive to break are decisions, whether or not anyone wrote them down.

Purpose is not in the codebase. It exists only in a human's head. So this skill must ask.

But asking blind produces mush. "What's your thesis?" gets you a mission statement. The repo's evidence is the **leverage**, not a substitute for the interview:

> *"Your README says you serve X. Your last 20 merged PRs are all Y. Your ADRs optimize for Z. Which of these is the actual bet?"*

That question can only be asked by something that read the repo first. **Probe, then ask.**

**Usage:**
- `/pdr-interview` — bootstrap a corpus from scratch
- `/pdr-interview refresh` — re-confirm existing PDRs whose `Last confirmed` has aged out

---

## Step 0: Discover the repo

Do all of these in parallel:

1. **Check for an existing corpus.** `ls docs/pdr/` — if records exist, read them all. This is a **refresh**, not a bootstrap: the job is re-confirming or superseding what's there, not duplicating it. Note every `Last confirmed` date and every falsifier condition.

2. **Find the ADR directory.** Check `docs/adr/`, `adr/`, `adrs/`, `decisions/`. Read every `.md` file. ADRs encode what the team optimized for — that's a strong signal about the implicit bet.

3. **Read the framing docs.** `README.md`, `CLAUDE.md`, `AGENTS.md`, and any `docs/*architecture*`, `docs/*product*`, `docs/*roadmap*`.

4. **Discover the GitHub slug:** `gh repo view --json nameWithOwner,description --jq '.'`

5. **Pull open issues:**
   ```bash
   gh issue list --state open --limit 200 --json number,title,labels | \
     jq -r '.[] | "#\(.number) \(.title)"'
   ```

6. **Read what actually shipped** — the most honest signal in the repo. Stated intent lives in the README; revealed intent lives in the merge log.
   ```bash
   gh pr list --state merged --limit 50 --json number,title,mergedAt | \
     jq -r '.[] | "\(.mergedAt[0:10]) #\(.number) \(.title)"'
   ```

7. **List the source tree** top-level and one level deep in the major directories.

---

## Step 1: Spawn the evidence agent

Send with `run_in_background: true`. Do not poll — you'll be notified.

```
Read this codebase and infer what it reveals about WHY it exists — who it serves, what
bet it makes, what it appears to have decided not to do. You are building the evidence
base for an interview with the person who actually holds the product thesis. You are NOT
writing the thesis; you are assembling what the repo implies so a human can confirm or
correct it.

Repo root: {PWD}

## What to read
- ALL ADRs (discover the directory: docs/adr/, adr/, adrs/, decisions/)
- README.md, CLAUDE.md, AGENTS.md, any docs/*product*, docs/*roadmap*, docs/*architecture*
- Existing docs/pdr/ records if any
- Open issues (gh issue list --state open --limit 200)
- Last 50 merged PRs (gh pr list --state merged --limit 50)
- Landing page / marketing copy if the README links one
- Top-level source tree, one level deep in major dirs

## What to produce

### 1. Candidate PDRs (max 6)
For each, propose: a title, a draft Decision (one sentence, specific enough to be wrong),
and — critically — THE EVIDENCE, cited by file path, PR number, or issue number.

Distinguish sharply between:
- **Stated** — someone wrote it down (README, docs). Cite the file and line.
- **Revealed** — the merge log and issue backlog imply it. Cite the PRs/issues.
- **Inferred** — you are guessing from architecture. Say so explicitly.

Rank by how load-bearing the decision is: which of these, if silently violated by a
contractor, would waste the most work?

### 2. Candidate non-goals (max 4)
What does this repo appear to have decided NOT to do? Look for: features conspicuously
absent given the domain, ADRs that reject an approach, issues closed WONT-FIX, scope
explicitly bounded in docs. Non-goals are the highest-value records and the least likely
to be written down anywhere.

### 3. CONTRADICTIONS — the most important section
Where does the repo disagree with itself about its purpose? Examples of the shape:
- README claims audience X; the last 20 PRs all serve audience Y
- An ADR optimizes for scale the issue backlog shows no demand for
- Marketing copy promises a capability with no code behind it
- A stated non-goal that shipped anyway

For each: state both sides, cite both, and DO NOT resolve it. These become the interview
questions — a contradiction is the one question a human cannot answer with a platitude.

### 4. What the repo cannot tell you
Name what is genuinely absent from the evidence: pricing, competitive positioning,
customer commitments, why-now, what would make the founder quit. Be explicit — the
interviewer needs to know which questions have no evidence behind them, so it doesn't
lead the witness with a guess dressed as a finding.

Write ONLY to /tmp/pdr-evidence.md. No other files.
```

---

## Step 2: Wait, then interview

Read `/tmp/pdr-evidence.md`.

**Interview discipline:**

- **Use `AskUserQuestion`. One question at a time.** This is a conversation, not a form.
- **Always lead with the evidence.** Never "who do you serve?" — always *"your last 20 PRs are all enrichment features but the README leads with reporting; which is the actual bet?"* The evidence is what makes the answer specific.
- **Open with the contradictions.** They're the highest-yield questions and they establish immediately that you read the repo.
- **Push hardest on falsifiers.** This is the hardest question and the most valuable, and people will resist it — a falsifier is a commitment to being checkable. Expect "I'll know it when I see it" and don't accept it. Ask instead: *"What would you have to see to stop? Give me a date or an event I could put in a calendar."*
- **Ask for non-goals explicitly.** *"What have you already decided you're NOT building?"* Founders answer this fast and well; it's rarely written anywhere.
- **Cap at 5 records.** Fewer, real, and falsifiable beats a complete-looking corpus. GETTING_STARTED's rule for ADRs applies here: cover what a contractor could violate silently; everything else emerges later.
- **Do not write a PDR the human did not decide.** If they're unsure, the record is **Proposed** with the open question in Context — or it doesn't get written. A PDR you talked them into is worse than no PDR: it will be cited in review as though someone believed it.
- **When they change an answer mid-interview, keep both.** What they said first and why they revised it is exactly the Context a future reader needs.

**For each candidate, get four things:**

| | |
|---|---|
| **Decision** | one sentence, specific enough to be wrong |
| **Context** | what they know and how they know it — push for the actual evidence, not the belief |
| **Falsifier** | an observable condition: a date, a named event, a threshold |
| **Confirmed by** | their name. Not "Product". If they won't sign it, it isn't a decision yet |

**Falsifier triage** — reject and re-ask on anything unobservable:

| They say | Response |
|---|---|
| "revisit later" | *"By when? Pick a date you'd actually honor."* |
| "if it stops working" | *"What does 'working' look like as a number or an event?"* |
| "at the next planning cycle" | *"That's a calendar entry. What would make you change your mind?"* |
| "when customers tell us" | *"How many? The second one? The fifth?"* |

---

## Step 3: Write the records

Records are published through the repo's **mediated write path** — the harness
stanza denies raw edits to the records directory, and the script is the
sanctioned way in. For each confirmed decision, compose the full record at a
scratch path (`/tmp/pdr-<slug>.md` is fine) following `templates/pdr/_template.md`,
then publish:

```bash
node scripts/write-record.mjs create pdr /tmp/pdr-<slug>.md
```

The script allocates the number (never reuse a superseded record's number),
validates the record (required sections, `Confirmed by` is a real name, an
`Accepted` record carries a non-vague falsifier), fills `Last confirmed` with
today, writes append-only, registers the `docs/pdr/README.md` row, and runs the
corpus lints. A refusal names the rule that fired — fix the draft and
re-publish.

- **Non-goals get their own numbers** — never a bullet inside another record.
- **Status:** `Accepted` only if the falsifier is present and observable — the
  script enforces this mechanically. Otherwise `Proposed`, with the missing
  piece named in Context.
- **Supersession (refresh only):** if an existing record's bet changed, `create`
  a NEW record citing the old one, then flip the old one's Status — the amend
  guard refuses any change to its Context or Decision:

  ```bash
  node scripts/write-record.mjs amend pdr <NNN> /tmp/pdr-<NNN>-superseded.md
  ```

- **`Last confirmed`:** today's date, for every record the human just confirmed
  — including ones that didn't change. Re-confirmation is the point of a
  refresh. Bump it with `amend pdr <NNN> <revised-file>`; the README's Last
  confirmed cell syncs automatically.

If the repo has no `scripts/write-record.mjs` yet (governance baseline older
than 2026-08-13), STOP and say so: the records directory is gated and there is
no mediated path. The fix is the repo-governance sync that ships the script —
do not hand-edit `docs/pdr/` around the stanza, and do not ask the human to
type the records. If the repo has the script but no `check-adr-readme-sync`
lint, the script says UNGUARDED — report that in the PR body.

---

## Step 4: Branch, commit, open PR

```bash
DATE=$(date +%Y-%m-%d)
BRANCH="pdr/${DATE}-corpus"

git fetch origin
BASE=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|.*/||')
git worktree add ../pdr-${DATE} -b "${BRANCH}" "origin/${BASE}"

cd ../pdr-${DATE}
# Records land via the write path, IN the worktree — never cp into docs/pdr/:
#   node scripts/write-record.mjs create pdr /tmp/pdr-<slug>.md

git add docs/pdr/
git commit -m "docs: product decision records (${DATE})

Records the bets this project is making, each with the observable condition
that would retire it. Confirmed by <name> on ${DATE}."
git push -u origin "${BRANCH}"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh pr create --repo "${REPO}" --base "${BASE}" \
  --title "docs: product decision records (${DATE})" \
  --body "..."
```

PR body must include: each record with its Decision and Falsifier one-liner; who confirmed them; anything left **Proposed** and what it's waiting on; and the contradictions surfaced in Step 1 that the interview *resolved* — that's the part a reviewer can check.

---

## Step 5: Present

1. Print each record: number, title, Decision, Falsifier, Status.
2. Name anything left **Proposed** and what it's blocked on.
3. **Report the contradictions the interview did NOT resolve.** These are real findings — a repo that disagrees with itself about its purpose has a problem no PDR fixes.
4. Print the next falsifier due, with its date. That's the first thing the audit will surface.
5. Ask: *"Anything here you'd argue with in three months?"* — if yes, that's a missing falsifier, not a disagreement.

---

## Tips

- **The person matters more than the repo.** Get the actual decision-maker. A PDR corpus interviewed out of an engineer who's guessing at the founder's intent is fiction with line numbers.
- **Resistance to falsifiers is the signal, not the obstacle.** People resist because a falsifier means the bet can be settled against them. That discomfort is the artifact doing its job. Sit in it.
- **"We haven't decided" is a legitimate answer** — record it as Proposed with the open question in Context. An honest gap beats a manufactured decision.
- **Don't harmonize the contradictions.** Your job is to surface them and let the human pick. If you resolve them yourself you've written a strategy doc, and this repo has a word for those.
- **On refresh, the boring outcome is the good one.** Most bets should survive re-confirmation. If most don't, the problem isn't the corpus — it's that nobody was looking, which is exactly what the 90-day check exists to catch.
