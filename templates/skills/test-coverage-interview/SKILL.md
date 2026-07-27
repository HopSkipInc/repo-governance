---
name: test-coverage-interview
description: >
  Bootstrap or refresh a repo's testing strategy. Probes the codebase for test coverage
  patterns, test structure, naming conventions, and false-green traps — mapping what's
  tested vs what's not and where the gaps are intentional vs accidental. Interviews the
  team to surface the testing strategy (what should be tested, what doesn't need to be,
  what the coverage expectation is). Produces testing standard ADRs with enforcement
  (coverage gates, test-presence checks), plus a PR.
version: 1.1.0
updated: 2026-07-27
triggers:
  - /test-coverage-interview
  - test coverage interview
  - testing strategy
  - test conventions
  - bootstrap tests
  - testing standard
---

# Test Coverage Interview

Capture how code is verified in this repo — what gets tested, how, and what the testing
strategy is — as ADRs with enforcement, and surface the gaps that need closing.

**This skill probes a different layer than `adr-interview` or `clean-code-interview`.**
ADRs capture how the system is shaped. Clean code captures how the code is written. Test
coverage captures how the code is *verified* — and the strategy behind it is the piece
that's almost never written down. Tests exist in the codebase; the *strategy* (what
should be tested at what level, what's deliberately untested, what the coverage
expectation is for new code) exists only in someone's head.

**The evidence maps what exists. The interview fills in what should exist.** The evidence
agent can tell you that module A has 90% coverage and module B has 0%. It cannot tell you
whether module B's missing tests are a gap or a deliberate choice. The interview resolves
that — and the resolution becomes the testing standard.

**Testing standards need the same enforcement as any other ADR.** A coverage threshold
that isn't wired into CI is a suggestion. A "all new code needs tests" rule without a
test-presence check is a hope. The enforcement shapes differ — coverage gates, test-
presence checks, mutation testing thresholds — but the rule is the same: enforcement
ships with the promise.

**Usage:**
- `/test-coverage-interview` — bootstrap a testing strategy from scratch
- `/test-coverage-interview refresh` — re-audit testing against current codebase state

---

## Step 0: Discover the repo

Do all of these in parallel:

1. **Read `docs/testing-strategy.md` first if it exists** — this repo's records file and, on a
   refresh, the baseline you are checking for drift. Its §3 (Deliberately untested) is binding:
   those are decisions, not gaps, and re-reporting them is how this layer loses its reader. If
   the file does not exist, this is a bootstrap run and `templates/testing-strategy.md` is the
   blank form.

2. **Read `docs/agent-routing-records.md` §6 if it exists** — the repo's risk surfaces with a
   `Covered by tests?` column, written by triage. Every surface marked uncovered there is a
   coverage gap someone is already paying frontier rates for, which makes it the highest-value
   input this skill gets and the one place the coverage layer has a price attached.

3. **Check for other testing docs.** `docs/testing.md`, `docs/test-strategy.md`, `CONTRIBUTING.md` testing section. Read whatever exists.

4. **Read existing ADRs.** They may already encode testing decisions (e.g., "we test at the integration level, not unit level"). Don't duplicate.

5. **Find test directories and files.**
   ```bash
   # Discover where tests live
   find . -name '*.test.*' -o -name '*.spec.*' -o -name 'test_*' -o -name '*_test.*' | head -50
   find . -type d -name 'test*' -o -type d -name '__tests__' -o -type d -name 'spec*'
   ```

6. **Read test framework config.**
   - JS/TS: `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`, `package.json` scripts
   - Python: `pytest.ini`, `pyproject.toml [tool.pytest]`, `conftest.py`, `tox.ini`
   - Go: `go test` config, `Makefile` test targets
   - C#: `.runsettings`, `xunit` config, test project structure
   - All: CI workflow files — what test commands run, what gates exist

7. **Check coverage configuration.**
   ```bash
   # Is coverage configured?
   grep -r "coverage" jest.config.* vitest.config.* pyproject.toml .github/workflows/ package.json 2>/dev/null
   ```
   - Is there a coverage threshold? What is it?
   - Is it enforced (CI fails below threshold) or advisory (report only)?
   - What's the actual coverage? (Run the coverage report if possible, or check CI output)

8. **Read the DoD.** `docs/definition-of-done.md` — its Feature and Bug fix sections should have test requirements. Are they enforced?

9. **Sample test files.** Read 5-10 test files across different modules. Note:
   - Test naming patterns (`describe/it`, `test()`, `func TestXxx`, `def test_xxx`)
   - Test structure (arrange-act-assert, given-when-then, flat assertions)
   - Mocking/stub patterns (how are dependencies isolated?)
   - Test data patterns (fixtures, factories, inline data, parameterized tests)
   - Are there integration tests? E2E tests? Or only unit tests?

10. **Check for false-green tests.** Look for:
   - Tests with `expect(true).toBe(true)` or equivalent no-op assertions
   - Tests that are skipped/pendinng (`it.skip`, `pytest.mark.skip`, `t.Skip`)
   - Test scripts that are stubs (`echo "not implemented" && exit 0`)
   - Tests that catch exceptions and pass regardless

---

## Step 1: Spawn the evidence agent

Send with `run_in_background: true`. Do not poll — you'll be notified.

```
Read this codebase and inventory its testing strategy — what's tested, how, where the
gaps are, and whether the strategy is consistent. You are building the evidence base for
a conversation about what the testing strategy SHOULD be. You are NOT writing the
strategy; you are mapping what exists so a human can identify what's intentional, what's
a gap, and what needs to change.

Repo root: {PWD}

## What to read
- docs/testing-strategy.md if it exists — the existing records file. Report drift against it:
  modules whose status changed, exemptions in §3 that no longer hold, §6 properties that have
  since gained a test. Never re-report a §3 exemption as a gap.
- docs/agent-routing-records.md §6 if it exists — risk surfaces and whether tests cover them.
- docs/testing.md, docs/test-strategy.md, CONTRIBUTING.md testing section (if they exist)
- ALL existing ADRs (they may encode testing decisions already)
- Test framework config: jest.config, vitest.config, playwright.config, pytest.ini, etc.
- Coverage config: thresholds, reporting, CI gates
- CI workflows: .github/workflows/ — what test commands run, what gates exist
- docs/definition-of-done.md if it exists — its test requirements
- Test files: sample 10-20 across different modules and test types
- The source tree: which directories have tests, which don't
- package.json scripts or Makefile: what test targets exist
- Any custom test scripts in scripts/ or tools/

## What to produce

### 1. Coverage map
For each major source directory, report:
- Does it have tests? (yes/no/partial)
- If yes: what type? (unit, integration, e2e, smoke)
- If yes: rough coverage level (high/medium/low/can't tell from reading)
- If no: is this likely intentional or a gap? (e.g., a `types/` dir with no tests is
  probably intentional; a `services/` dir with no tests is probably a gap)

Present as a table. The gaps are the interview questions.

### 2. Test structure patterns (max 5 candidates)
- Naming convention: how are tests named? Is it consistent?
- Structure: arrange-act-assert? given-when-then? flat? Is it consistent across modules?
- Test data: fixtures, factories, inline, parameterized? Consistent?
- Mocking/stubbing: how are dependencies isolated? Is the pattern consistent?
- Test levels: how many levels exist (unit, integration, e2e)? How are they separated?

For each: is the pattern consistent? is it documented? is it enforced?

### 3. Coverage threshold status
- Is a threshold configured? What is it?
- Is it enforced (CI fails) or advisory (report only)?
- What's the actual coverage? (if you can run the report, do so; otherwise check CI logs
  or note "unknown — report not run")
- If the threshold is lower than actual coverage, it's not catching anything — it's a
  floor that nobody is near. Flag this.
- If there's no threshold, flag it — "we have coverage reports but no gate" is the same
  shape as "we have an ADR with no lint"

### 4. False-green traps
List any tests that pass without actually testing anything:
- No-op assertions (`expect(true).toBe(true)`)
- Skipped/pending tests that don't have a tracking issue
- Stub test scripts (`echo "not implemented" && exit 0`)
- Tests that catch-all exceptions and pass
- Tests with no assertions (just "it doesn't throw")

Each false-green test is a finding — CI is green but the code isn't verified.

### 5. Test speed and separation
- Are there slow tests that block the fast feedback loop?
- Is there a separation between fast (unit) and slow (integration/e2e) tests?
- Can a developer run just the fast tests locally?
- Is the CI pipeline optimized (parallelized, cached, split fast/slow)?

### 6. CONTRADICTIONS
- DoD says "all new code needs tests" but CI doesn't enforce test presence
- Coverage threshold is 80% but actual is 55% and CI is green (threshold not enforced)
- Tests follow one naming pattern in module A, a different one in module B
- Integration tests exist for module A but not module B despite similar complexity
- README claims "comprehensive test suite" but coverage is 30%

For each: state both sides, cite both. DO NOT resolve — these become interview questions.

### 7. What the repo cannot tell you
The testing STRATEGY is absent from the codebase. The tests show what was tested, not
why, not what was deliberately not tested, and not what the expectation is for new code.
Name what is genuinely absent so the interviewer knows which questions require the human.

Write ONLY to /tmp/test-coverage-evidence.md. No other files.
```

---

## Step 2: Wait, then interview

Read `/tmp/test-coverage-evidence.md`.

**Interview discipline:**

- **Use `AskUserQuestion`. One question at a time.**
- **Lead with the coverage map.** Show the gaps first: *"Your services/ directory has 12 source files and 0 test files. Is that a deliberate choice or a gap?"*
- **Open with contradictions.** *"Your DoD says all new code needs tests, but CI doesn't check for test presence. Is that enforced in review, or is it a rule that's not wired?"*
- **The strategy question is the key question:** *"What's your testing strategy? What should be tested at what level, and what's deliberately not tested?"* The evidence agent mapped what exists; the human fills in what should exist. The gap between the two is where the work is.
- **Push on coverage thresholds.** If a threshold exists but isn't enforced: *"Your threshold is 80% but CI is green at 55%. Should we wire the gate, or lower the threshold to what's achievable, or is this a report-only metric?"* An unenforced threshold is worse than no threshold — it creates the illusion of a gate.
- **For gaps, ask the triage question:** *"Module B has no tests. Is that:*
  *a) A gap we should close (file a tracking issue)*
  *b) Deliberately untested (it's a thin wrapper / generated code / going to be replaced)*
  *c) Untested because it's hard to test (needs infrastructure we don't have)"*
- **Push on enforcement for new rules.** If the human says "all new code needs tests," ask: *"Can we wire a test-presence check? Or is this a review-time rule?"* A review-time rule is better than nothing, but it's not enforcement.

**For each testing standard, get:**

| | |
|---|---|
| **Standard** | one sentence (e.g., "All new source files in src/ must have a corresponding test file") |
| **Context** | what failure mode it prevents, or what incident drove it |
| **Enforcement** | coverage gate, test-presence check, CI rule, or "review-time only" (be honest) |
| **Status** | Accepted (enforcement wired) or Proposed (enforcement pending) |

---

## Step 3: Write the output

**`docs/testing-strategy.md` is the deliverable.** The ADRs, the coverage gate, and the gap
issues below are how its rows get enforced; the file itself is what the DoD points at, what
audit domain 8 measures against, and what a triager reads instead of guessing at coverage.

### `docs/testing-strategy.md` (the records file)

Copy `templates/testing-strategy.md` if the repo has no records file yet, then fill it in:

- **§1 Coverage floor** — the number, where it is configured, and honestly whether it is a
  required check or a report. A floor far below actual is not a gate; say so in the row.
- **§2 Coverage map** — every source directory gets a row and a status. `gap` and
  `hard to test` require tracking issues; `deliberate` requires an entry in §3.
- **§3 Deliberately untested** — with the "would we notice if it broke?" answer filled in.
  An empty answer there is a gap wearing a decision's clothes, and the audit will say so.
- **§5 False-green register** — everything found, with its disposition.
- **§6 Properties no test verifies at any level** — cross-tenant scoping, ordering under
  concurrency, idempotency claims, rate limits that exist only in schema. **This section is
  read by triage**: each line is a reason issues on that surface route above `standard`, and
  closing one lowers the tier of every future issue touching it. Cross-check it against
  `docs/agent-routing-records.md` §6 and note the issue numbers currently paying for each.

**The file never syncs back to repo-governance** — blank form upstream, contents local. Add a
Review log row every run, including a refresh that changed nothing.

### Testing standard ADRs (for enforced rules)

Write `docs/adr/NNN-<slug>.md` following `templates/adr/_template.md`. Testing standards
are ADRs — same format, same enforcement requirement.

Common testing ADRs:
- **Test structure:** "Unit tests live alongside source files; integration tests live in `tests/integration/`"
- **Coverage gate:** "New code must maintain or improve coverage; CI fails if coverage drops below X%"
- **Test levels:** "We test at the integration level for API endpoints and unit level for pure functions; no e2e tests without a tracking issue"
- **Test naming:** "Tests are named `describe('Thing', () => { it('does X when Y') })` — the `it` string is a full sentence"

Each must name its enforcement: the CI gate, coverage threshold, or custom check.

### DoD updates (for test requirements)

If the DoD's Feature or Bug fix section doesn't have test requirements, add them:
- "Tests covering the new behavior"
- "Tests covering the regression (for bug fixes)"
- "Coverage does not decrease"

Wire enforcement (CI gate or check script) in the same PR if possible.

### Coverage gate configuration

If the team agrees on a coverage threshold:
- Configure it in the test framework (jest `--coverageThreshold`, vitest `coverage.thresholds`, pytest `--cov-fail-under`)
- Wire it as a required CI check
- If no threshold exists yet, start with the *current* coverage as the floor — don't set a target the codebase can't meet on day one. Raise it incrementally.

### Gap tracking

For each identified gap (module with missing tests that the human confirmed is a real gap):
```bash
gh issue create --title "Test coverage gap: <module>" --label "tech-debt,testing" \
  --body "Module <path> has <N> source files and 0 test files. Identified during test coverage interview on ${DATE}."
```

### False-green remediation

For each false-green test found:
- If it's a stub: either implement the test or delete it (a stub test is worse than no test — it creates the impression of coverage)
- If it's skipped: add a tracking issue or delete it
- If it's a no-op assertion: rewrite with a real assertion or delete it

Note all false-green remediation in the PR body.

---

## Step 4: Branch, commit, open PR

```bash
DATE=$(date +%Y-%m-%d)
BRANCH="test-coverage/${DATE}"

git fetch origin
BASE=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's|.*/||')
git worktree add ../test-coverage-${DATE} -b "${BRANCH}" "origin/${BASE}"

cd ../test-coverage-${DATE}
cp <written ADRs, DoD updates, coverage config, test fixes> <appropriate locations>

git add docs/testing-strategy.md docs/adr/ docs/definition-of-done.md jest.config.* vitest.config.* pyproject.toml .github/workflows/ scripts/
git commit -m "docs: testing strategy + coverage enforcement (${DATE})

Testing standard ADRs with enforcement. Coverage gate wired. False-green
tests remediated. Gaps filed as tracking issues. Confirmed by <name> on ${DATE}."
git push -u origin "${BRANCH}"

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh pr create --repo "${REPO}" --base "${BASE}" \
  --title "docs: testing strategy + coverage enforcement (${DATE})" \
  --body "..."
```

PR body must include:
- The `docs/testing-strategy.md` diff summarised: floor, N covered / N gaps / N deliberate, N false-green
- Each testing ADR with its standard and enforcement
- Coverage threshold configured and whether it's wired as a CI gate
- False-green tests found and remediated (or filed as issues)
- Coverage gaps identified, with tracking issue numbers for confirmed gaps
- DoD updates (if any test requirements were added)
- Contradictions the interview resolved

---

## Step 5: Present

1. Print each testing ADR: number, title, standard, enforcement, status.
2. Print the coverage map with gaps highlighted — mark each as "gap (issue #N)" or "deliberate" or "hard to test (issue #N)".
3. **Report false-green tests.** These are findings regardless of what the interview decided — CI was green but the code wasn't verified.
4. **Report the coverage threshold status.** If the threshold was unenforced and is now wired, say so. If the team chose "report only," flag that the gate is still advisory.
5. **Report unresolved contradictions.** A repo that says "comprehensive test suite" with 30% coverage has a messaging problem that the testing standard alone doesn't fix.
6. **Report §6 against the routing records.** For each property nothing verifies, name the
   open escalations that cite it. "Three frontier issues are waiting on one integration test"
   is the sentence that gets a coverage gap prioritised; "coverage is at 61%" is not.
7. Ask: *"What bug would have been caught if we had a test for X?"* — that's the highest-value test to write next, and possibly an ADR if the gap is structural.

---

## Tips

- **The strategy is the gap, not the tests.** The evidence agent maps what exists. The valuable output is the strategy — what should be tested, at what level, and what's deliberately untested. If you're just listing test files, you're doing inventory, not strategy.
- **Start with the current coverage as the floor.** If the team wants an 80% threshold but actual is 55%, set the gate at 55% and raise it incrementally. A threshold the codebase can't meet on day one gets disabled, and a disabled gate is worse than no gate — it normalizes the idea that gates are advisory.
- **False-green tests are the most dangerous finding.** CI is green, coverage reports show the file as tested, but the code isn't actually verified. Always surface these — they're worse than missing tests because they create the illusion of verification.
- **Don't confuse test count with test quality.** A repo with 500 tests that all assert `expect(result).toBeDefined()` has worse coverage than a repo with 50 tests that assert actual behavior. Sample test files, don't just count them.
- **The testing strategy should name what's deliberately untested.** "We don't test generated code" or "we don't test the ORM layer directly, we test through the repository" are legitimate strategic choices. Writing them down prevents the audit from flagging them as gaps every cycle.
- **Enforcement shapes for testing:** coverage threshold (CI fails below X%), test-presence check (CI fails if a source file has no corresponding test file), mutation testing (CI fails if mutations survive), and DoD checklist (review-time, not deterministic). The first two are gates; the third is a gate but expensive; the fourth is a rule, not enforcement. Be honest about which you're shipping.
