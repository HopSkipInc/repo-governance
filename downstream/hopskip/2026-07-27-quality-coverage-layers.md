# Governance update: clean code + test coverage layers (2026-07-27)

**Applies to:** all governed repos
**Templates:** `templates/code-conventions.md`, `templates/testing-strategy.md` (both new),
`templates/skills/clean-code-interview/SKILL.md` (1.1.0), `templates/skills/test-coverage-interview/SKILL.md` (1.1.0),
`templates/definition-of-done.md` (1.1.0), `templates/workflows/scheduled-audit.yml` (1.1.0),
`templates/agent-routing.md` (1.10.0), `templates/agents/routing-classifier*.md` (1.2.0),
`templates/skills/routing-triage/SKILL.md` (1.6.0), `templates/scripts/check-issue-routing.mjs` (1.2.0)
**Versions:** read the stamps, do not trust this list — a prompt that hardcodes versions goes
stale the moment a template moves.

## Why

Layers 3 and 4 of the five-layer sweep shipped in session 13 as skills only. Their output
dispersed into ADRs, a `## Code Conventions` block in `CLAUDE.md`, and lint config — so the
DoD had nothing to point a checkbox at, the audit had nothing to diff, and triage answered
"is this surface covered?" by impression rather than by reading anything.

Two things change:

1. **Each layer gets a records file**, on the `docs/agent-routing-records.md` precedent —
   blank form upstream, contents local, never synced back.
2. **Coverage becomes a routing lever, not just a heuristic row.** An escalation citing an
   uncovered surface now carries a coverage record. Splitting divides one issue; covering a
   surface lowers the tier of every future issue that touches it.

This also fixes a defect: audit domain 7's staleness triggers cited coverage drops and
false-green tests that **no domain produced**. They could never fire. Domain 8 is what
measures; 7 decides what to do about it.

---

## Step A — which path are you on?

```bash
ls docs/code-conventions.md docs/testing-strategy.md 2>/dev/null
grep -m1 '^\*\*Version:' docs/agent-routing.md 2>/dev/null
head -1 ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md
```

- **Neither records file** → bootstrapping. Do steps 1–6.
- **Routing policy behind 1.10.0** → also do step 5. It is additive; nothing you already
  wrote becomes invalid.

---

## Steps

**1. Install the two blank forms and the two skills.**

```bash
mkdir -p docs .claude/skills
cp ~/repos/HopSkipInc/repo-governance/templates/code-conventions.md docs/code-conventions.md
cp ~/repos/HopSkipInc/repo-governance/templates/testing-strategy.md docs/testing-strategy.md
cp -r ~/repos/HopSkipInc/repo-governance/templates/skills/clean-code-interview .claude/skills/
cp -r ~/repos/HopSkipInc/repo-governance/templates/skills/test-coverage-interview .claude/skills/
```

> **`cp` these two files exactly once.** They are records files. Once an interview has filled
> one in, a `cp` from the template destroys work that exists nowhere else and leaves no diff
> to recover from — the same hazard as the `agent-routing.md` records migration in 1.9.0. If
> a later prompt updates the *form*, migrate the content by hand.

**2. Update the DoD.** Copy `templates/definition-of-done.md` if yours is otherwise unmodified;
otherwise merge these rows by hand. New in the **Feature** section:

- coverage does not decrease on the files the PR changes, and the floor in
  `docs/testing-strategy.md` §1 still passes;
- a new source directory or module gets a row in the §2 coverage map;
- no convention in `docs/code-conventions.md` §1 is violated (lint-gated — the row points at
  where the rules live rather than asking for a manual check).

New in **Bug fix**: if the bug lived on a surface listed in §6 (properties no test verifies),
the regression test closes that line or the line is updated with why it still stands.

The `<!-- delete if no docs/testing-strategy.md -->` markers are there so a repo that skips a
layer can strip the rows cleanly. **Delete them rather than leaving unenforceable checkboxes** —
an unenforceable row erodes the whole document faster than a missing one.

**3. Update the audit workflow** to `templates/workflows/scheduled-audit.yml` 1.1.0 — domain 8
(code quality and coverage) plus the domain 7 rewire. Two rules in domain 8 matter more than
the rest, and both are about *not* generating noise:

- it never files a finding against §2 of the conventions file (those are preferences), and
- it never proposes anything listed in §3 (Not codified) — that section exists to be read
  before proposing, and re-proposing a recorded drop is the failure it was written to prevent.

If your audit runs in-platform rather than in Actions, port the domain-8 prompt text into the
audit machine's definition; do not skip it because the workflow file is not the live artifact.

**4. Run the two interviews — with a human in the room.**

```
/clean-code-interview
/test-coverage-interview
```

Unlike PDRs, both layers can be *drafted* from the codebase, so an agent working alone will
produce something plausible. That is the risk. The evidence agent maps what exists; only a
human can say whether a consistent pattern is a standard or just how the first engineer typed,
and whether an untested module is a gap or a decision. **An agent alone will record every gap
as deliberate**, because that is the answer that closes the file fastest.

Two questions carry most of the value:

- *"Is this a standard we should enforce, intentional but cosmetic, or just how it was
  written?"* — the clean-code triage.
- *"Is this module untested because it is a gap, because it is deliberately untested, or
  because it is hard to test?"* — and for the third, the blocker gets named. "We should test
  this" is not a blocker.

**Set the coverage floor at current actual, not at the aspiration.** A threshold the codebase
cannot meet on day one gets disabled, and a disabled gate teaches the team that gates are
advisory.

**5. Re-sync routing to 1.10.0** (skip if this repo has no `docs/agent-routing.md`):

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/agent-routing.md docs/agent-routing.md
cp ~/repos/HopSkipInc/repo-governance/templates/skills/routing-triage/SKILL.md .claude/skills/routing-triage/SKILL.md
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-issue-routing.mjs scripts/check-issue-routing.mjs
# whichever classifier variant this repo's harness uses:
cp ~/repos/HopSkipInc/repo-governance/templates/agents/routing-classifier.md .claude/agents/routing-classifier.md
# opencode teams instead: ~/.config/opencode/agents/routing-classifier.md (global; restart after)
```

**Do not `cp` over `docs/agent-routing-records.md`.** Same rule as step 1.

**6. Backfill coverage records on existing escalations.** Run the lint and read R8:

```bash
node scripts/check-issue-routing.mjs
```

Every escalation whose tier line blames an untested surface needs one of:

- `Coverage gap: #NNN` — the issue that would close it, filed and linked, or
- `Coverage: not testable — <mechanism>` — and the mechanism has to be real.

> **Do not bulk-append `Coverage: not testable` to clear the lint.** It is the cheapest
> sentence available and it is usually wrong — the honest answer is far more often "no fixture
> exists yet", which is a gap. This is the same flattering-call failure as reaching for
> `inherent` over `both`, one level down, and doing it converts a finding into a rubber stamp.
> A `not testable` record that does not also appear in `docs/testing-strategy.md` §6 is a
> triager's opinion that never met the coverage layer.

Note that a coverage record retires **one signal**, not necessarily the tier. If a lock order
or a boundary independently holds the escalation, file the gap anyway and say the tier stands.

---

## Verifiable outcomes

```bash
# 1. Both records files exist and are not still blank forms
test -f docs/code-conventions.md && test -f docs/testing-strategy.md && echo "OK: records files present"
! grep -q '^\*\*Last refreshed:\*\* \[YYYY-MM-DD\]' docs/code-conventions.md && echo "OK: conventions filled in"
! grep -q '^\*\*Last refreshed:\*\* \[YYYY-MM-DD\]' docs/testing-strategy.md && echo "OK: strategy filled in"

# 2. The coverage map has real rows, not the form's examples
grep -c '^| `' docs/testing-strategy.md   # expect >= one row per source directory

# 3. Every §2 row marked gap or hard-to-test carries an issue number
grep -E '\*\*gap\*\*|\*\*hard to test\*\*' docs/testing-strategy.md | grep -cv '#[0-9]'   # expect 0

# 4. Both skills installed
test -f .claude/skills/clean-code-interview/SKILL.md && test -f .claude/skills/test-coverage-interview/SKILL.md && echo "OK: skills"

# 5. DoD carries the new rows (or the markers were deleted deliberately)
grep -c 'testing-strategy.md' docs/definition-of-done.md   # expect >= 3, or 0 if the layer was skipped

# 6. Audit has domain 8
grep -q 'Code quality and coverage' .github/workflows/scheduled-audit.yml && echo "OK: domain 8"
grep -q 'eight domains' .github/workflows/scheduled-audit.yml && echo "OK: domain count updated"

# 7. Routing: no escalation blames coverage without a record
node scripts/check-issue-routing.mjs 2>&1 | grep -c 'R8'   # expect 0

# 8. The coverage census prints (it is audit signal 6)
node scripts/check-issue-routing.mjs 2>&1 | grep -q 'Coverage census' && echo "OK: census" || echo "none cited — fine"
```

**Check 3 is the one that catches a rushed run.** A coverage map where every gap is recorded
without a tracking issue is a map that will be identical at the next refresh.

---

## Report back

In the PR body, and in your `### Applied governance updates` section:

- Conventions: how many enforced / documented / not codified, and how many rows landed in §4
  (lints enforcing something nobody wrote down). A large §4 is a good sign, not a bad one — it
  means the team was already paying for enforcement it never recorded.
- Coverage: the floor, whether it is a required check or advisory, and the count of gaps,
  deliberate exemptions, and false-green tests found.
- §6 — properties nothing verifies at any level — with the open issue numbers currently
  citing each. *"Three frontier issues are waiting on one integration test"* is the sentence
  that gets a coverage gap prioritised. *"Coverage is at 61%"* is not.
- Anything in the two skills that fought you. Both were dogfooded once, in a repo with no
  application code and no test suite, which is a strong test of the conventions interview and
  a weak test of the coverage one. Yours is the first real exercise of the coverage half.
