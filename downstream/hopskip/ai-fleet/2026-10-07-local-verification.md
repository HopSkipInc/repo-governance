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

What it runs, and why each choice:

- **Changed set:** `git diff --name-only --diff-filter=d <merge-base(HEAD, origin/master)>`
  plus untracked files. If no merge-base resolves, it runs the **whole unit suite** and says
  so (D5). A shallow worker clone lands here, and it must not be reported as a clean
  selection of nothing.
- **Typecheck:** host-tools first, then host, **in sequence**. host's `tsconfig` references
  `../host-tools`, so host reads host-tools' *emitted* declarations. Running the two in
  parallel races the emit, and on a fresh clone with no `host-tools/dist` it fails outright.
  host's pass is `--incremental` with its buildinfo under `node_modules/.cache` (21s cold,
  about 5s warm, about 10s after an edit, measured).
- **Unit tests:** `vitest related` over changed files under `host/src`, `host/setup` and
  `host-tools` only. Every `related` call pays about 10s to walk the graph, even when it
  selects nothing, so scripts and config files are not passed. Changed
  `*.integration.test.ts` files are listed as SKIPPED, with where they run.
- **Lints:** every `lint:*` named in the `check` composite, **read from the composite at run
  time** (D4: one list, so a lint added to the composite is in the fast tier with no second
  edit), run directly with `sh -c` and `node_modules/.bin` on PATH, in parallel. A lint
  whose command invokes `az` is SKIPPED when `az` is absent. Match on the command, not the
  name: `lint:az-tsv-crlf` must still run.
- **Web:** `tsc --noEmit` plus `vitest related` in `web/` when `web/` or `web-external/`
  changed, and SKIPPED if `web/node_modules` is absent.

Give its selection logic fixture tests (`host/scripts/fast-check.test.mjs`, run by
`tests/test-fast-check.sh` with an `ADR-026: GATE` header, matrix suite `fast-check` in
`run-tests.yml`). The failure a fast tier is prone to is quietly checking less than it
claims, so test that: the real composite parses end to end, an undefined composite entry
throws, `requiredTool` does not match `az-` in a lint name, and the path mapping covers
every included tree and excludes the rest.

## 3. The commit tier — `.githooks/pre-commit`

Remove sections 1–3 of the current hook (`npm run check`, the web build, and the
"dev-pg must be running" plus integration-tier block). What stays applies only when a
numbered migration is staged:

1. `node host/scripts/check-adr008-migrations.mjs` and `check-migration-immutability.mjs`,
   with git's hook env stripped (`env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_WORK_TREE -u
   GIT_PREFIX`, the #2853/#2872 lesson). They are sub-second and offline.
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
nothing; staging host/, host-tools/, web/ or web-external/ code runs no suite. **Prove the
cases discriminate**: run them against the old hook, and they must fail.

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
