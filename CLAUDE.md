# repo-governance

**What this repo is.** The methodology, not an application. `templates/` is the product —
everything under it is copied into other people's repositories, so a bug here ships to
clients and a client's first CI run is where it surfaces. `docs/` holds this repo's own
governance records. `downstream/` holds prompts that install or update templates in
governed repos. `gtm/` is go-to-market working notes and never syncs anywhere.

**Read before proposing anything:** `docs/code-conventions.md` §3 lists patterns this repo
has *decided not to codify*. Re-proposing one is the failure that section exists to
prevent. Its §1 lists what is enforced, and by which lint.

---

## Commands

There is no `package.json` — deliberately, since this repo is not a publishable package.
Everything runs directly under Node.

```bash
node --test test/*.test.mjs          # the test suite (79 cases)

node scripts/check-template-versions.mjs --base <ref>   # stamps + bump-on-change
node scripts/check-analyze-repo-coverage.mjs            # every template in the matrix
node scripts/check-blank-form-naming.mjs                # forms are _-prefixed
node scripts/check-adr-readme-sync.mjs                  # records registered in their index
node scripts/check-pdr-falsifiers.mjs                   # accepted PDRs carry a falsifier
node scripts/check-mothership-drift.mjs                 # docs/ copies match templates/ (register-driven)
node scripts/check-issue-routing.mjs                    # backlog sweep; needs gh auth
node scripts/check-downstream-drift.mjs                 # client version drift; run by hand
node scripts/check-lens-promotion.mjs                   # cross-repo lens extensions; run by hand
node scripts/check-claim-coverage.mjs                   # claim-coverage enumerator; health-report input, run by hand
```

**Quote the glob and the tests silently do not run.** `node --test 'test/*.test.mjs'` is
Node 22+; CI pins Node 20, where the quoted form is read as a literal path. Leave it
unquoted so bash expands it.

CI is `.github/workflows/governance-lints.yml` (push to master + every PR) and
`.github/workflows/issue-routing.yml`. Everything above except the last four runs there.
`scripts/check-downstream-drift.mjs` and `scripts/check-lens-promotion.mjs` run **nowhere** —
they read local client checkouts, so they cannot run in CI, and they are currently reporting
findings nobody sees. Bind both to the same governance-sync ritual; two scripts shouting into
the void is becoming its own watch item.

## Working on templates

1. **Every change to a file under `templates/` needs its version stamp bumped in the same
   commit.** `scripts/check-template-versions.mjs` rule 3 gates this. Markdown uses an HTML comment
   on line 1, skills use frontmatter `version:`/`updated:`, scripts and workflows use a
   leading comment after any shebang.
2. **A new template must be added to the `/analyze-repo` applicability matrix**
   (`.claude/commands/analyze-repo.md`) or excluded there on the record. CI fails otherwise.
   A bootstrap that omits a template looks exactly like one that succeeded, which is why
   this is a gate.
3. **Every script in `scripts/` has fixture tests** — it fires on a known-bad input and
   clears on a known-good one. That is this repo's coverage floor; see
   `docs/testing-strategy.md` §1 for why it is a rule rather than a percentage.
4. **A blank form is `_`-prefixed** and never carries a record's number. A form sitting in a
   records directory gets read as a record by both the index lint and the audit sweep — it
   has happened twice here.

## Records files — never `cp` over these

`docs/agent-routing-records.md`, `docs/code-conventions.md`, `docs/testing-strategy.md`,
and everything in `docs/pdr/` are **records**. The blank forms live in `templates/`; the
contents are local, dated, and exist nowhere else. A `cp` from the template destroys work
with no diff to recover from. The same rule applies in every governed repo, and the
migration order matters: move records out first, then copy the policy.

Records are **written via `scripts/write-record.mjs`** — the mediated write path (issue
#81): `create` publishes a new numbered record append-only, `amend` lands status flips,
consequences, and README rows under section guards, and the harness stanza keeps denying
raw edits to records paths so agents are funneled here. The human checkpoint is the PR
merge, not human typing.

## This repo's own governance

| Layer | State |
|---|---|
| Product (PDRs) | `docs/pdr/` — 9 records, falsifiers lint-enforced |
| Architecture (ADRs) | **not run here.** No `docs/adr/`; the lint headers are the record |
| Clean code | `docs/code-conventions.md` |
| Test coverage | `docs/testing-strategy.md` |
| Agent instructions | this file |

**No scheduled audit runs here**, so audit domains 6–8 are not operating. The lints cover
the mechanical checks only.

## Session State Protocol

The write path is the organizational activity ledger (fleet-host MCP), not files in this repo.

**At session start (REQUIRED):** call `session_context(project="HopSkipInc/repo-governance", query="<what this session is about>")`. It returns recent decisions, completions, and blockers plus relevant past context. The first user message is the goal — do not ask for one. Activity records from before the 2026-08-02 transfer into HopSkipInc are keyed under the old slug `leizerowicz/repo-governance`.

**During the session:** call `record_activity` at natural checkpoints — decisions, completions, blockers, discoveries. Don't wait for end-of-session.

**At session end (when user says stop/done/pause/tomorrow):**
1. Record any final completions or decisions with `record_activity`.
2. Optionally write a journal entry to `~/.claude/memory/journal/YYYY-MM-DD.md` for cross-session lessons — retrospective insights, not live work.
3. `.claude/personal-state.md` (gitignored) is optional local scratch. Nothing the team needs goes there — the ledger carries it.

**Do NOT use ruvector/claude-flow memory CLI for state storage.** The ledger for work state, plain markdown for journals.

## Agent routing

Every issue carries an `impl:` label — `standard`, `frontier`, or `human` — declaring the
minimum capability class required, and an `## Impl tier` line giving the kind and the reason.

Kinds: **`spec`** (under-specified — rewrite it and the tier drops), **`inherent`** (silent
failure or load-bearing boundary — no spec fixes it), **`both`** (under-specified *and*
dangerous — rewrite the spec, the tier stays). `both` is the commonest state on a real
boundary and the easiest to mislabel: `inherent` is the flattering call, so a triager forced
to choose drifts toward it.

**Decompose before tiering.** No issue is escalated above `standard` until decomposition is
on the record — either a split proposal or a `Not splittable: <mechanism>` sentence. If the
reason cites an untested surface, a coverage record is required too: `Coverage gap: #N` or
`Coverage: not testable — <mechanism>`.

Before implementing an issue:

1. Read the `impl:` label and the `## Impl tier` line.
2. If the tier exceeds your capability class, do not implement. Comment with what you
   would need, and stop.
3. If the label or the kind is missing, do not implement. Comment and stop.
4. Stop and comment if any of these fire, whatever the tier says: three attempts at the
   same failing test; **coding around a blocker instead of removing it** — a fallback,
   default, retry, cast, or broad catch you would not have written had the call worked;
   **weakening a test, assertion, or matcher to reach green**; creating a file type with
   no precedent here; touching a migration that drops or renames; no existing test covers
   the surface you are changing; the diff exceeds **10 files**; or you are about to
   overwrite a records file listed above.

   **Stopping means the edit does not land and the turn ends.** A question you then answer
   yourself two paragraphs later is not a stop — it is the workaround applied to the stop
   rule, and it is the observed way this condition fails. A degradation that is genuinely
   the right call gets declared and countersigned by a human; it is never merged on your
   own reading of your own question.

Delegating is dispatching. When you hand implementation work on a tiered issue to a
subagent, you become the dispatcher for that unit of work: check the subagent's
capability class against the tier (your own class does not transfer), and put the tier,
kind, reason, stop conditions, and a scope ceiling in the delegation prompt — the
subagent sees nothing of this conversation. Concurrent subagents need disjoint file
surfaces or separate worktree lanes, exactly as concurrent sessions do. Subagents
prepare; you review and merge.

You may escalate an issue's tier at any time. You may never downgrade one — least of all
on an issue you are about to implement.

Tier definitions and the policy are in `docs/agent-routing.md`. **The model→class mapping,
classifier pins, ratio readings, and this repo's calibration examples are in
`docs/agent-routing-records.md`** — they moved out of the policy in version 1.9.0, because
the policy is `diff -q`-verified against the template and the records are not.

## Gotchas

- **GitHub auth is per-org via the `gh` wrapper — plain `git push` and `gh` commands just
  work.** `~/.local/bin/gh` resolves the org from the git remote, maps it to an account via
  `~/.config/gh/org-accounts.json` (HopSkipInc → `greghopskip`, leizerowicz/usemeridian →
  `gleizerowicz`), and injects that account's token. Git-level https auth uses
  `gh-real auth git-credential` under the global active account (`greghopskip`). If a push
  403s, the remote's org is missing from the mapping or expects the other account — fix the
  mapping; never paste tokens into remote URLs. The pre-2026-08-02 inline-token dance (this
  repo lived at `leizerowicz/repo-governance`) is retired.
- **Closing keywords auto-close issues from anywhere in a commit message, including inside
  quoted text.** Never start a subject with `<type>: #N`; put references later or in the
  body; mask them (`#<N>`) when quoting an offending message. This has fired twice, once in
  the very commit documenting it.
- **JavaScript has no `\Z` regex anchor.** `(?=^##\s|\Z)` silently degrades to "followed by
  a literal Z". Line-scan instead. It cost a live lint every correctly-formatted issue in a
  real backlog.
- **A check that fails open reads as evidence.** Report SKIPPED, never pass, when a check
  cannot run — see R6 in `scripts/check-issue-routing.mjs` and rule 3 in `scripts/check-template-versions.mjs`.
- **A detector has to know the house convention.** Two lints here have shipped rules that
  were correct in the abstract and wrong against real records — an acceptance-criteria check
  that did not know about `## Verifiable outcomes`, and a falsifier check that rejected five
  of seven valid falsifiers for containing no digit. Run a new rule against the real corpus
  before gating on it.
- **A prompt that names an install target must establish that the target is live, and its
  verification line must not be the only thing that checks.** The 2026-08-05 ai-fleet prompt
  told the repo to add worker instructions to `runtime/templates/base/` and verified with
  `grep -rl … runtime/templates/base/`. That directory is read by nothing in that repo — not
  `COPY`'d into the image, zero code consumers, and the repo's own `docs/fleet-runtime.md`
  says so outright. The instruction and its check were mutually consistent and jointly
  wrong: applying it as written would have produced a green verification, a clean diff, and
  no behaviour change whatsoever. That is worse than omitting the step, because the ledger
  would then record it as applied.

  A path that looks alive is not evidence: those files had real role names, plausible prompt
  bodies, git history, and a CI path filter pointing at them. Before naming a target, prove
  a consumer reads it (grep for loaders, check the Dockerfile/packaging, look for a
  drift-check or generator that owns the file), and prefer verification that observes the
  *effect* over verification that greps the *file you just wrote*. When the target is
  generated or DB-backed, the prompt owes the downstream repo a warning that the step may
  carry a migration — that one claimed "no schema changes, no new code paths" and its
  correct application required both.
