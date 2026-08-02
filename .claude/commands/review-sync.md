---
name: review-sync
description: Review pass over a sync-from-repo run — walk every [PROPOSED] marker file by file, accept/adapt/reject each, verify the templates are clean, and commit with the sync commit conventions
---

# Review a Sync Run

Companion to `/sync-from-repo`. That skill *applies* `[PROPOSED]` markers; this one *disposes* of them. Run it in a later session, with fresh eyes — the point of the marker format is that proposing and accepting are separate acts.

---

## Step 1: Inventory the markers

```bash
grep -rn 'PROPOSED' templates/ docs/ | grep -v '.claude/'
```

Report the count per file. If zero, check `git log --grep '^sync: from' -1` — either the sync was never run, or a previous review already cleaned up.

---

## Step 2: Walk the markers, one file at a time

For each file with markers, present every marker to the user as a numbered list: the proposed text, and a one-line recommendation — **accept**, **adapt** (with the suggested change), or **reject** (with why it doesn't generalize). Wait for the user's dispositions before editing, then move to the next file.

Disposition mechanics:

- **Accept a new item/section:** delete the `[PROPOSED from source repo]` marker text or the `<!-- [PROPOSED ...] -->` comment line; keep the content.
- **Accept a revision:** delete the comment line above it *and* the trailing `(was: ...)` parenthetical.
- **Accept a "Why" example pattern:** decide whether to keep it as an example pattern (fine for templates) or it has already been replaced with a real incident.
- **Reject a new item/section:** delete it entirely. If it was a revision, restore the `(was: ...)` text.
- **Reject a new template file:** `git rm` (or delete) the file — then see Step 3.
- **Adapt:** make the agreed edit, then strip the marker.

---

## Step 3: Re-verify cross-file consistency

Rejections can orphan references. After all dispositions:

- If a new template file was rejected: remove its row from README's "What you get" table and its `cp` line from GETTING_STARTED Step 1.
- If a path/convention proposal was rejected (e.g., `docs/audits/`): make sure README, GETTING_STARTED, and the other templates all still agree on the old convention.
- Confirm clean: `grep -rn 'PROPOSED' templates/ docs/ | grep -v '.claude/'` returns nothing.

---

## Step 4: Commit

Two commit-message conventions, both load-bearing:

- **The sync run** commits as `sync: from <source-repo> <YYYY-MM-DD>` — `/sync-from-repo` Step 0 finds the last sync date via `git log --grep '^sync: from' -1`. (Normally already committed before this skill runs.)
- **The review pass** commits as `sync-review: <source-repo> <YYYY-MM-DD> — accepted N/M proposals`. The N/M ratio is a calibration signal: if most proposals get rejected over a few cycles, `/sync-from-repo`'s abstraction rules need tightening — feed the rejection reasons back into that skill's Step 3 table.

---

## Step 5: Per-repo maintenance prompts

### 5.0 Pre-flight: check pending prompts from prior sync-reviews

**Run both hand-run lints first — this step is their trigger.** They read local client checkouts, so they cannot run in CI, and this pre-flight is the one ritual where the operator already has those checkouts open. CLAUDE.md's "two scripts shouting into the void" note binds them here.

```bash
node scripts/check-downstream-drift.mjs
node scripts/check-lens-promotion.mjs
```

Dispositions for `check-downstream-drift` findings:

- **MISMATCH and NOSTAMP block the sync review.** Do not generate prompts until each is accounted for: a human reads the finding against the client tree and decides what it is (stale declaration, missing install, unstamped copy). Prompting on top of an unaccounted finding ships the disagreement it reports. What to *do* with real findings is deliberately not decided in this step.
- **BEHIND generates or refreshes the client's maintenance prompt** under `downstream/<client>/<repo>/` — a BEHIND finding is exactly the drift a sync-review exists to fix, so it feeds Step 5.1 rather than blocking.
- **UNDECLARED** is reported, not blocking — if the repo is in scope for this review, note it in the new prompt.
- **SKIPPED** (no client checkout reachable) is reported, never read as a pass.

`check-lens-promotion` is a sweep, not a gate: report its findings to the operator. **PROMOTE** findings are cross-repo lens extensions — candidates for the sync review's proposal list; **RESIDUALS** and **NO-RECORDS** are noted for the client's next audit.

Then open `downstream/<client>/_client.md` and read the Maintenance Log table. For each repo with status `pending` or `partial`:

1. Note the prior prompt path and its `## Verifiable outcomes` section.
2. If the repo is accessible locally (path is in the Governed Repos table), run each verification command. Report what has landed and what hasn't.
3. Update the row in `_client.md`:
   - All outcomes satisfied → `applied YYYY-MM-DD`
   - Some satisfied → `partial — <brief note on what's missing>`
   - None satisfied → leave `pending`, note in the new prompt that it supersedes the prior one
4. If the prior prompt is still `pending`, fold any still-needed steps into the new prompt (don't generate a duplicate).

---

### 5.1 Generate prompts

Generate a maintenance prompt for each governed repo that had markers in this sync run. Store each as `downstream/<client>/<repo>/YYYY-MM-DD-maintenance.md` (see `downstream/hopskip/_client.md` for the client/repo directory map).

Each prompt is a self-contained Claude Code instruction — paste it into the target repo and run it. Write it as a direct instruction, not documentation.

**Prompt structure:**

```markdown
# Governance Maintenance — <repo> — <date>

**Client:** <client name>
**Source:** greg/repo-governance sync-review <date>

You are updating this repo's governance to match the latest template improvements from `~/repos/greg/repo-governance`.

## What changed in the templates (this sync-review)
[For each accepted proposal: one sentence on what changed and why it matters]

## What to do in this repo

[Concrete ordered steps. For each:
 - Name the file to edit
 - Say what to add/change (quote the new text or describe precisely)
 - Note any adaptation needed for this repo's stack or conventions]

## Already present — skip
[Artifacts this repo already has that don't need re-applying]

## Not applicable — skip
[Proposals that don't apply to this repo's stack, with one-line reason]

## Verifiable outcomes
[Shell-runnable one-liners that confirm the prompt's key artifacts landed.
 Run from the repo root. Each line is an independent check.]
- `<command>` — <what it confirms>
- `<command>` — <what it confirms>
```

**Scoping rules:**
- Tailor each prompt to the repo's *current state* — don't re-propose things the repo already has
- If a proposal touches an artifact the repo doesn't have yet (e.g., no `code-hygiene.md`), include the bootstrap step, not just the delta
- If a repo is early-stage, note what to defer and when to revisit (e.g., "add code-hygiene after the first audit cycle completes")
- If no accepted proposals affect a given repo, skip generating a prompt for it
- **PDR corpus (`docs/pdr/`) — do not generate a bootstrap prompt for it.** A prompt is a thing an agent runs alone in a repo, and a PDR corpus cannot be produced that way: purpose isn't in the codebase, so an agent working alone will either invent a thesis or write a mission statement. Both are worse than an empty directory, because a fabricated PDR gets cited in review as though someone believed it. Bootstrapping requires the `pdr-interview` skill and the actual decision-maker's time. What a prompt *can* legitimately do: install `templates/pdr/_template.md`, the README index, ADR-023, wire the lint, and tell the repo to book the interview. Never draft the records.
- **PDR templates are not propagating yet (as of 2026-07-16).** They're being proven in ai-fleet first. Do not include them in prompts for analytics-infrastructure or enrichment-pipeline until ai-fleet has run 3 audit cycles with a live corpus and the pattern has produced at least one real finding.
- **Verifiable outcomes must be shell-runnable from the repo root** — use `test -f`, `grep -q`, or similar; one outcome per key artifact; cover the 3–5 most important deliverables, not every line changed
- **`.gitignore` outcomes: check the exception, not the glob** — `grep -q '!docs/audits/' .gitignore` (verifies the whitelist is present) is correct; `! grep -q 'docs/*' .gitignore` is a false positive whenever the glob exists for other reasons with a proper exception already in place

---

### 5.2 Update the maintenance log

After generating prompts, add a row to the Maintenance Log table in `downstream/<client>/_client.md` for each new prompt, with status `pending`. If a prior pending prompt was folded into the new one, update the prior row to `superseded by YYYY-MM-DD`.

---

## Notes

- **Don't rubber-stamp.** The sync skill abstracts aggressively, but "generalizes to any repo" is a judgment call only the review can make. The most common rejection reason: the rule encodes the source repo's *scale* (daily audits, label taxonomies) rather than its *lesson*.
- **Rejections are data.** Record recurring rejection patterns in this file or in `/sync-from-repo`'s abstraction table so the next sync proposes better.
- **GTM is out of scope here** — `/sync-from-repo` Step 6 already gates GTM edits behind user feedback, so there are no GTM markers to review.
