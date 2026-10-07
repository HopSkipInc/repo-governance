# Local verification tiers: commit hook to seconds, `check:fast` before review, CI as the gate — ai-fleet (2026-10-07)

**Client:** Hopskip (internal)
**Source:** repo-governance — `templates/local-verification.md` v1.0.0 (new).
**Scope:** stop running the whole suite on every commit. Slim `.githooks/pre-commit` to the
commit tier (staged, offline, seconds), build the push tier (`npm run check:fast`), rewrite
the agent instructions that say "always run `npm run check` before committing", and record
where the old hook was named as an enforcement point. **CI is not touched**: every required
check, lint wiring and the full `check` composite stay exactly as they are.

> **Measure before you cut, and cut toward CI.** The policy's §1 numbers are this repo's,
> taken 2026-10-07 on a 4-core container: full `npm run check` 4m07s (unit suite 197s,
> typechecks 28s, 89 lints 23s). It **cannot pass without `az`**, because `lint:bicep`
> shells out to it and exits 127. The hook then ran the integration tier with
> `fileParallelism: false` (156 files), and needed dev-pg running to allow any commit at
> all. The same work runs on every PR push as required CI (`host-unit-test` 1..4,
> `integration / db-tier|http-tier`) in about 4.5 minutes. Nothing in this prompt removes
> a CI step.

---

## 1. Install the policy doc

Copy `templates/local-verification.md` to `docs/local-verification.md`, byte-identical
(stamp `local-verification.md v1.0.0` on line 1). It is a policy doc, not a records file.
Make no stanza change and do **not** add it to `docs/enforcement-stanzas-register.md`.

## 2. The push tier — `npm run check:fast`

Write `host/scripts/fast-check.mjs`, wired as `check:fast` in `host/package.json` and in
the root `package.json`. The root one mirrors the root `check`: the gateway-hardening
`node --test`, then the host command. **Do not name it `check-*.mjs`.**
`check-lint-ci-coverage.mjs` treats every `check-*.mjs` in a lint home as a lint that must
be wired into `run-tests.yml` and the composite.

What it runs, and why each choice. The first version had three of these wrong; the
review that caught them is quoted at each one.

- **Changed set:** `git diff --name-only --no-renames <merge-base(HEAD, origin/master)>`
  plus untracked files, **with deletions kept** for deciding which areas are touched. Only
  the files still on disk are handed to the test runner. *(The first version used
  `--diff-filter=d`, so a diff that only deleted a module four files import reported
  `0 changed`, skipped the typecheck, and said clean.)* If no merge-base resolves, every
  area runs unselected and the output says so (D5). A shallow worker clone lands here, and
  it must not be reported as a clean selection of nothing.
- **Barrier: build host-tools before anything else starts.** Several things read
  host-tools' emitted output:
  - host's typecheck, through the project reference;
  - host/src's imports, which go through `dist/` (`lint:host-tools-dist-imports`);
  - `check-required-credentials.mjs`, which statically imports `host-tools/dist/index.js`.

  *(The first version ordered only the two `tsc` passes. On a fresh clone (every fleet
  worker) a docs-only diff then failed `lint:required-credentials` with
  ERR_MODULE_NOT_FOUND, and a code diff failed its related tests the same way.)* The build
  takes about 2s warm and 6s cold. Then, in parallel:
- **Typecheck host:** `--incremental`, with its buildinfo under `node_modules/.cache`
  (21s cold, about 5s warm, about 10s after an edit, measured).
- **Unit tests:** `vitest related` over changed files under `host/src`, `host/setup` and
  `host-tools`. **Pass each host-tools source together with its `dist/…js` twin.** host/src
  consumers import the emitted file, so the source alone selects only host-tools' own
  tests. *(Measured: `sql-pool.ts` alone selected 16 files; with its twin it selects
  112.)* Three more routes:
  - A changed `host/scripts` file selects the unit tests that name it (`git grep -F
    <basename>`), because those tests spawn the script or import a computed path that
    `related` cannot follow. A sibling `*.test.mjs` also runs under `node --test`.
  - A change to `host/package.json`, the lockfile, `vitest.config.ts` or either
    `tsconfig.json` runs the whole suite.
  - Anything left that selects no test is **named**, as are changed integration tests.

  Do not pass other scripts or config: every `related` call pays about 10s to walk the
  graph, even when it selects nothing.
- **Lints:** every `lint:*` the composite names with `run lint:X`, matching
  `check-lint-ci-coverage.mjs`'s acceptance so the two cannot disagree. The list is
  **read from the composite at run time** (D4). Run them directly with `sh -c` and
  `node_modules/.bin` on PATH, in parallel, **with `DATABASE_URL` withheld**: the README
  and the DoD fleet row both export it, and the DB-backed lints fail when dev-pg is down
  (D3). The output names the DB-backed lints whose database half therefore did not run.
  Three lints are SKIPPED, with a reason, when they cannot run:
  - a lint whose command invokes `az`, when `az` is absent (match the command, not the
    name, so `lint:az-tsv-crlf` still runs);
  - `lint:worker-sdk-cli-pin-coupling`, when `runtime/worker/node_modules` is absent,
    because it would otherwise fetch from the registry.
- **Web:** `tsc --noEmit` plus `vitest related` in `web/` when `web/` or `web-external/`
  changed, or the whole web suite when the run is unselected. SKIPPED if `web/node_modules`
  is absent.

Give its selection logic fixture tests (`host/scripts/fast-check.test.mjs`, run by
`tests/test-fast-check.sh` with an `ADR-026: GATE` header, matrix suite `fast-check` in
`run-tests.yml`). The failure a fast tier is prone to is quietly checking less than it
claims, so test that: the real composite parses end to end, an undefined composite entry
throws, `requiredTool` does not match `az-` in a lint name, and the routing pairs each
host-tools source with its `dist/` twin. In a scratch git repo, also test that a deletion
counts as a change, that a deletion-only diff still touches its area, that an
unresolvable base is `null` and not an empty list, and that a script selects the unit
tests that name it but not its integration tests. Use an oracle for the composite parse
that does not share the parser's regex.

## 3. The commit tier — `.githooks/pre-commit`

Remove sections 1–3 of the current hook (`npm run check`, the web build, and the
"dev-pg must be running" plus integration-tier block). What stays applies only when a
numbered migration is staged:

1. `node host/scripts/check-adr008-migrations.mjs` and `check-migration-immutability.mjs`,
   with git's hook env stripped (`env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_WORK_TREE -u
   GIT_PREFIX`, the #2853/#2872 lesson). They are sub-second and offline. A missing script
   or a missing `node` prints a `SKIPPED` line, never a silent `continue`: a step that
   never runs but reads like a gate is the #1627 failure.
2. The existing "applied to dev-pg?" query against `schemaversions`, **only when dev-pg
   answers**. When it does not, print a `SKIPPED` line naming CI's harness as the gate,
   and exit 0.

Keep `lint:githooks-migration-path` green: the hook still selects
`db/dbmigrations/scripts/migrations/` and still queries `schemaversions`.
`.githooks/claude-pre-commit` needs no change. It still fires pre-commit on migration
commits, which is now cheap.

Rewrite `host/src/githooks/githooks.test.ts` so it no longer depends on whether the machine
running it has dev-pg up. Put a stub `psql` first on PATH: `exit 2` for "down", or `exit 0`
with no journal row for "up and not applied". Cases: up-and-not-applied blocks and names
the file; down reports SKIPPED and exits 0; non-migration and `TEMPLATE_*` changes do
nothing; staging host/, host-tools/, web/ or web-external/ code runs no suite. Stub lints
at `host/scripts/` cover three cases: a failing lint blocks before the dev-pg question;
passing lints reach it; absent scripts print `SKIPPED`. **Prove the cases discriminate**:
run them against the old hook, and against a hook whose lint loop never runs. Both must
fail.

## 4. Rewrite the instructions (D6)

- `CLAUDE.md` §Development: replace "**Before committing any host/ change:** always run
  `npm run check`" and the web line with the three tiers by trigger. The commit tier needs
  nothing run. Run `check:fast` before opening a PR, marking it ready or reporting done,
  with its result line in the PR body. Run `check` (plus `test:integration`) to chase a CI
  failure, or when the diff is test or build config that `related` cannot trace. Keep
  "vitest doesn't enforce types". Reword the azure-data live-test line's trigger to "before
  opening a PR".
- `CLAUDE.md` §System map and `AGENTS.md`: "before committing any change that touches code
  files" becomes once per working session, before the PR. That is what
  `docs/system-map.md` v3's own *When* already says. The per-commit wording was this repo's.
- `README.md` (`npm run check  # REQUIRED before every commit`, the exact sentence D6
  removes) and `orchestrator/SPEC.md` ("required before every commit here").
- `docs/local-dev.md` (the dev-pg URL bullet says the hook runs integration tests),
  `.claude/skills/fleet-dispatch/SKILL.md` (dispatch economics names in-container
  `npm run check`): match the new tiers.
- `.github/pull_request_template.md` "All PRs": "`npm run check` passes locally" becomes
  "`npm run check:fast` passes locally, and CI is green on the head". The upstream
  `pull_request_template.md` 1.2.0 makes the same change to its "CI passes locally" line.
  ai-fleet's template is its own adaptation, so port the line by hand and do not copy the
  file.
- **Do not edit `docs/fleet-worker-doctrine.md`.** Workers load `CLAUDE.md` natively, so the
  §Development rewrite reaches them, and a doctrine change regenerates `.claude/agents/*.md`
  plus a migration for no behavioural gain here.

## 5. Records

Both through `host/scripts/write-record.mjs amend`. Decisions stay byte-identical, and the
guard verifies it.

- **ADR-008** names "Pre-commit migration verification (`.githooks/pre-commit`) + the
  Migration harness" as one Gate row. Split it: the gate is CI's harness
  (`start-pg-with-migration` in db-tier, plus `db-migration-harness.yml`), and pre-commit's
  dev-pg check is Advisory. Add a dated Consequences note.
- **ADR-020**'s Decision tier table says tiers 1–2 run "`npm test` pre-commit". That
  sentence is guard-locked. Add a dated Consequences note saying the run moved to CI's
  `host-unit-test` shards plus `check:fast`, and that what each tool owes is unchanged.
- **`docs/code-conventions.md` §1 row 8** lists "pre-commit verification" as part of a
  gate. It is a records file (`ask`) with no mediated path at write-record 1.3.0, so the
  edit is owed by hand.
- **D7** wants the tier timings in `docs/testing-strategy.md` §4. That is a records file at
  `ask`, and write-record here is 1.3.0, without `append-row` (the 2026-09-15 prompt is
  still pending). Record it as owed, by hand at the PR checkpoint. Don't edit it through a
  raw write.

## 6. Declare and record

Add a Synced-templates row for `docs/local-verification.md` 1.0.0, and an Applied governance
updates entry that names the measured numbers, the deviations, and what is owed.

## Verification (observe the effect, not the file)

1. Stage a host/ `.ts` change and run `.githooks/pre-commit`: exit 0, well under a second, no
   suite output.
2. Stage a lint-clean probe migration with dev-pg down: SKIPPED line, exit 0. Stage a
   probe missing its integrity block: the ADR-008 lint blocks it. Unstage and delete both.
3. Inject a type error into a leaf host file and a failing assertion into its test, then
   run `npm run check:fast --base HEAD`: both are reported FAIL with the TS error and the
   failing test name, and the exit is non-zero. Revert both.
4. `npm run check:fast` on the applying branch reports clean, with its wall-clock time.
   Record that time.
5. `lint:lint-ci-coverage`, `lint:shell-suite-wiring` and `lint:githooks-migration-path`
   are green, and `bash tests/test-fast-check.sh` passes.
