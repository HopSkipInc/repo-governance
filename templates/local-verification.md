<!-- template: local-verification.md v1.0.0 · updated 2026-10-07 -->
# Local verification

What runs on a contributor's machine, when, and how long it may take, for human and
agent contributors alike.

The subject is narrow: the commit hooks, the local check commands, and the sentences
in agent instructions that tell a contributor to run them. It does not decide what CI
runs or what makes a change good — those are CI's and the Definition of Done's. It
decides how much of CI a contributor reproduces locally, and at which boundary.

## 1. The failure this prevents

**A local gate that runs the whole suite on every commit stops being run.** It is not a
stricter gate. It is the same gate as CI, paid for twice, at the boundary where it costs
the most, and the person at the keyboard learns to skip it.

The observed case (ai-fleet, measured 2026-10-07 on a 4-core container):

- The commit hook ran the repo's full local composite (`npm run check`) on any commit
  touching the service, then the integration tier. The composite alone took **4m07s**:
  about 197s of unit suite, 28s of typechecks and 23s for its 89 lints. One lint shells
  out to a cloud CLI, so the composite **could not pass at all** on a machine without
  that CLI. The integration tier then ran 156 files sequentially against a local
  database container, which the hook required to be running before it would allow any
  commit.
- CI ran the same work in about 4.5 minutes of wall-clock time on every push to a pull
  request, in parallel on runners nobody waits on. CI's checks were the required ones.
  The hook gated nothing that CI did not also gate.
- The agent instructions said "always run `npm run check` before committing", and the
  fleet's worker doctrine says to push after every commit. So every commit by an
  unattended agent paid the full suite. That cost grows with the number of commits, and
  the push-early rule exists to make commits frequent.
- The end state: the operator landed a two-line test-config change with `--no-verify`,
  because the hook could not pass on their own laptop. A gate the person at the keyboard
  routinely walks around is a bypass habit, the same lesson `merge-path.md` §1 draws for
  approvals.

There is a second piece of evidence, and it is the stronger one. A shell precedence bug
(ai-fleet#2853) had made the hook's typecheck, unit-test and web-build steps silent
no-ops from 2026-05-09 until 2026-09-18. Four months passed with that local gate doing
nothing, and CI caught the defects; the bug itself was found because CI's unit shard
caught a break the hook had waved through. The heavy local gate worked for nineteen
days in total, and those were the days it became unmanageable.

## 2. Decisions

**D1. CI is the gate. Local verification is feedback.** A check that must hold before
merge is a required CI check. Nothing local is the only enforcement of anything, so no
local tier needs to be exhaustive, and none may block for longer than its budget below.
A check that exists only as a local hook is wired into CI, or it is not a gate.

**D2. Three local tiers, each with a trigger and a budget.**

| Tier | Trigger | Scope | Budget (a contributor laptop) |
|---|---|---|---|
| **Commit**: the pre-commit hook, plus any harness hook that wraps `git commit` | every commit | staged files only; offline; the classes that are expensive to undo (a migration's immutability and naming, a secret in the diff) | seconds — **≤ 5s** |
| **Push**: the repo's fast command (`check:fast` or its equivalent) | before opening a PR, marking it ready, asking for review, or reporting work done | the diff against the merge-base: typecheck, the unit tests whose import graph reaches the changed files, and every lint | **about a minute; two at most** |
| **Full**: the repo's full composite (`check`) | on demand: chasing a CI failure, or a change whose blast radius selection cannot see (build or test configuration, shared tooling) | what CI runs, minus what needs CI's services | whatever it costs, since nobody is made to wait on it |

The push tier is not a pre-push hook. Agents push after every commit as a durability
rule, and a hook on that boundary would pay the push tier per commit, which is the
failure in §1. The push tier is run by the contributor, at a review boundary.

**D3. No local tier may need a container, a cloud CLI, credentials or the network in
order to pass.** A step that cannot run where it is invoked reports `SKIPPED`, with the
reason and where it does run (normally CI). It never blocks, and it never reports a
pass. A local database is welcome when it is up. A tier that cannot commit without one
is not.

**D4. The fast tier derives from the full tier. There is one list.** A lint is added
once: to the full composite and to CI, as the Definition of Done already requires. The
push tier reads its lint list from the full composite at run time. A second,
hand-maintained "fast lints" list goes stale silently, and the lint it drops is the one
whose absence nobody notices. Lints run in the push tier unselected, because they scan
repo-wide surfaces and are cheap when run in parallel (in the §1 case, 88 lints took
23s serially through `npm run`, about half of it `npm` start-up, and 4s run directly
with four in parallel).

**D5. Selection never fails open.** When the changed set cannot be computed (a shallow
clone, no remote, no merge-base), the push tier runs the unselected unit suite and says
that it did. It does not report a clean selection of nothing. When changed files have
no selectable tests (integration tests, SQL, configuration), the tier says so and names
where they run.

**D6. Agent instructions name tiers by their trigger, never "the full suite before
every commit".** The per-commit cost for an agent is the commit tier and nothing else.
Before an unattended agent marks a PR ready or reports done, it runs the push tier and
puts the result in the PR body. The full tier is a tool for an agent chasing a CI
failure, not a ritual. Instructions that predate this policy and still say "always run
`<full command>` before committing" are the defect this decision removes.

**D7. Budgets are measured, recorded and re-measured.** Record each tier's measured
wall-clock time in the testing-strategy records (the per-tier table and the fast/slow
separation entry, `testing-strategy.md` §4), with the machine it was measured on. A tier
over its budget is a defect in that tier: move work out of it, toward CI. The budget is
not a reason to skip the tier. Re-measure when the suite's size or the tier's contents
change materially.

## 3. What this does not change

- **CI.** Required checks, their wiring, and the rule that every lint runs in CI are
  untouched. This policy moves work *out of* local hooks and never out of CI.
- **The full composite.** It stays complete. The Definition of Done's rule that a new
  lint is wired into both the local check command and CI still holds. That command is
  the full tier, and the push tier inherits from it under D4.
- **Anyone may run more.** The tiers set minimums at each boundary and do not cap what
  a contributor runs.

## 4. Adopting it

1. **Inventory.** List every commit hook, every harness hook that wraps a git command,
   and every sentence in agent instructions (`CLAUDE.md`, `AGENTS.md`, worker doctrine)
   that tells a contributor to run a check, with its trigger. Time each command once on
   a contributor-class machine, not a CI runner.
2. **Build the push tier.** Diff against the merge-base, typecheck, selected unit tests,
   and every lint read from the full composite and run in parallel. Missing tools report
   `SKIPPED`. Give its selection logic fixture tests: a tier that quietly checks less
   than it claims is its likeliest failure.
3. **Slim the hooks to the commit tier.** Move everything that is not offline,
   staged-only and seconds-long out of them. Keep the opportunistic forms (for example,
   "is this migration applied to the local database, if one is running") and make their
   skip visible.
4. **Rewrite the instructions** so each check is named by its trigger (D6).
5. **Record the timings** (D7), and record any ADR or records entry that named the old
   hook as an enforcement point as superseded by the CI check that already enforced it.
