# Governance update: harness stamp form — `.claude/settings.json` is strict JSON (2026-08-11)

**Applies to:** all four governed repos, `core` and `full` class alike — every repo that
runs Claude Code.
**Supersedes the stamp instruction in:** [2026-08-08 enforcement stanzas](2026-08-08-enforcement-stanzas.md),
step 2 ("Keep the `governance-install` stamp comment"). That instruction produces an
**inert stanza** on Claude Code. Apply this prompt with, or instead of, that step — do not
apply 08-08 step 2 as written.
**Source:** repo-governance `fix/harness-stamp-strict-json` — found live in
analytics-infrastructure (PR #449), where the stanza had enforced nothing for a day.

## The defect

Claude Code parses `.claude/settings.json` as **strict JSON**. A `//` comment does not
degrade the file — the loader discards it **whole**, so every rule in `permissions.deny`
is silently absent. The only signal is one startup line that is easy to miss:

```
Settings (…/.claude/settings.json): Invalid or malformed JSON
```

`harness-enforcement.md` v1.0.1 shipped the comment form as the default for that file, on
the premise that "settings.json is JSONC-tolerant in Claude Code." Verified false against
Claude Code 2.1.227 on 2026-08-11. The 08-08 prompt's binding demonstration was recorded
against 2.1.226 and exercised permission *behaviour*, which does not exercise comment
parsing — so the premise went unchallenged. Whether the loader tightened in a patch or was
never tolerant, the observable behaviour now is: comment ⇒ no enforcement.

**The lint did not catch it.** `check-enforcement-stanzas.mjs` v1.0.1 read both configs
through its own JSONC-tolerant parser, stripping `//` before `JSON.parse` — it validated a
file the harness refuses to load, and reported the stanza present, complete, and correctly
ordered while nothing was enforced. That is precisely the fail-open the enforcement pair
exists to detect, so the lint is fixed in the same change.

## Estate census (read-only, 2026-08-11)

| Repo | `.claude/settings.json` | State | Action |
|---|---|---|---|
| HopSkipInc/analytics-infrastructure | `//` comment | **was inert** — 10 deny rules, including `Read(**/.env)`, unenforced 2026-08-10 → 08-11 | Fixed in analytics PR #449; re-sync template versions per step 4 |
| HopSkipInc/enrichment-pipeline | `_governance_install` key | **already correct** — installed the key form | Step 4 only (version bump); verify with step 5 |
| HopSkipInc/ai-fleet | valid, `hooks` only — **no `permissions` key** | stanza never installed | Install per 08-08 with **this** prompt's stamp form |
| HopSkipInc/infra-ops | file absent | stanza never installed | Install per 08-08 with **this** prompt's stamp form |
| HopSkipInc/repo-governance (mothership) | `//` comment, v1.0.0 | **was inert** — `ask` records rules + 6 secrets denies unenforced 2026-08-08 → 08-11 | Fixed in this PR |

Two of five installs were inert; one repo had already worked around it without the
template changing. That asymmetry — a silent workaround in one repo and a silent failure in
another — is why this is a template default change and not five local patches.

## What changed upstream

- **`harness-enforcement.md` v1.0.1 → v1.1.0** — the `"_governance_install"` string key is
  now the shipped default for `.claude/settings.json`, with a per-harness stamp table and
  the reason on the record. The paste-in JSON block **no longer contains any comments at
  all**: v1.0.1's block also carried trailing `//` annotations on the deny lines, so a
  verbatim paste broke the file in five places, not one. Those annotations are now prose
  beneath the block. New "Parse ≠ presence" entry under Limits.
- **`scripts/check-enforcement-stanzas.mjs` v1.0.1 → v1.1.0** — parses each config in its
  own harness's dialect: **strict JSON** for `.claude/settings.json`, **JSONC** for
  `opencode.json`. A `//` comment in the Claude Code config is now a blocking `MALFORMED`
  whose message names the cause, the consequence, and the fix. Two regression tests lock
  both directions (comment fails for Claude Code, comment still clears for opencode).
- **`opencode.json` is unchanged and must stay a `//` comment.** opencode tolerates JSONC
  but validates config against a closed schema at startup and refuses to boot on an
  unrecognized key — `_governance_install` is fatal there (opencode 1.18.15). In a repo
  running both harnesses the two configs deliberately carry different stamp forms.

## Steps

**1. Determine your repo's state.** This is the whole diagnosis:

```bash
python3 -c "import json; json.load(open('.claude/settings.json'))" && echo "LOADS" || echo "INERT — every rule below is absent"
```

**2. If the file exists and does not parse, convert the stamp** (do not delete it):

```diff
-  // governance-install: harness-enforcement.md v1.0.1 · updated 2026-08-09
+  "_governance_install": "governance-install: harness-enforcement.md v1.1.0 · updated 2026-08-11",
```

The key's **value** must carry the full stamp text including the literal
`governance-install: harness-enforcement` prefix — both the assertion lint and
`check-downstream-drift.mjs` match that substring, and the key *name* alone does not
satisfy either. Remove any other `//` comments in the file too (the mothership carried a
four-line mode note as comments; its authoritative home is the register's mode paragraph,
where it already was). **Change no rules while you are in there** — this is a stamp-form
fix; rule counts before and after must match.

**3. If the file does not exist or has no `permissions` key** (ai-fleet, infra-ops):
install the stanza per [2026-08-08](2026-08-08-enforcement-stanzas.md) — records paths,
mode, lint home, and CI wiring all per that prompt's table — but take the stamp form from
**this** prompt. For ai-fleet, that means *merging* into a `hooks`-only settings file:
add the `_governance_install` key and the `permissions` object, touch nothing else.

**4. Re-sync both templates and update your declarations.** Copy
`templates/scripts/check-enforcement-stanzas.mjs` v1.1.0 into the repo's lint home
(byte-identical — the two lints must never disagree), then bump the Synced-templates rows
for `harness-enforcement.md` → v1.1.0 and `scripts/check-enforcement-stanzas.mjs` →
v1.1.0. If your row carries a local "stamp as a key" deviation note from before this
prompt (analytics-infrastructure has one), **delete the note** — the deviation is now the
template default and no longer needs preserving on re-sync.

**5. Verify — all four, and do not substitute the lint for the parse check:**

```bash
python3 -c "import json; json.load(open('.claude/settings.json'))" && echo "parses"
node <lint-home>/check-enforcement-stanzas.mjs        # expect OK, stamp still detected
git diff --stat .claude/settings.json                  # expect 1 file, stamp line only
grep -c '"' .claude/settings.json                      # rule count unchanged vs HEAD
```

Then confirm in a live Claude Code session that the startup warning is gone. A green lint
is necessary and no longer sufficient on its own for a *pre-v1.1.0* lint; once v1.1.0 is
installed the lint does cover the parse, and the standalone check becomes belt-and-braces.

**6. Record the mode paragraph, not just the row.** If step 2 removed comments that carried
records-mode information, confirm that information survives in
`docs/enforcement-stanzas-register.md` before you commit. A mode that existed only as a
comment in a file the harness discarded was never enforced and never recorded.

## Not done here, owed

- **`_client.md` status rows.** This prompt is unregistered in
  `downstream/hopskip/_client.md`, and the 08-08 enforcement rows still read `pending` for
  all four repos although at least two applied it. That file had uncommitted changes from
  another working lane when this PR was authored, so it was deliberately left untouched
  rather than merged blind. Add the rows for this prompt and correct the 08-08 rows in the
  same pass.
- **Binding smoke check.** `docs/harness-binding-smoke-check.md` fires at `/review-sync`
  Step 5.0 on stanza version changes; v1.0.1 → v1.1.0 is such a change. The check should
  gain a parse step — the 08-08 demonstration proved deny semantics against a file that
  loaded, which is not the same as proving the installed file loads.
