<!-- template: harness-enforcement.md v1.1.0 · updated 2026-08-11 -->
# Harness enforcement — Claude Code settings stanza

Two invariants, enforced by the harness before the action lands — not by the model, and
not by instructions in CLAUDE.md:

1. **Records-file protection** — the repo's records files (PDRs, ADRs, code-conventions,
   testing-strategy, routing records — whatever the repo's own CLAUDE.md records-files
   paragraph lists) are never overwritten by an agent edit. A `cp` over a records file
   destroys dated, local content with no diff to recover from; it has happened, twice,
   in the repo this template ships from.
2. **Secrets hygiene (path-level)** — credential files are never read or edited by the
   agent. This is hygiene, not a compliance control: the agent does not leak credentials
   into state files, memory, or records.

Claude Code enforces both through `permissions.deny` rules in `.claude/settings.json`.
The semantics that make this work (Claude Code permissions guide, verified 2026-08-08
against Claude Code 2.1.226):

- **Deny evaluates before ask and allow.** A deny rule cannot be overridden by a broader
  allow rule or by a model's argument that the edit is fine.
- **`Edit(path)` covers all file-editing tools** (Edit, Write, MultiEdit, NotebookEdit —
  v2.1.210+). One rule gates them all.
- **`Read(path)` deny also blocks Edit on the path** (v2.1.208+). A secrets path needs
  only the Read rule, but the stanza lists Edit as well so the register reads as the
  invariant, not as an implementation detail.
- Path patterns use **gitignore semantics** (`docs/pdr/**`, `./.env`).
- Enforcement is "by Claude Code, not by the model" — but Read/Edit deny rules apply to
  the built-in file tools and to file commands the harness recognizes in Bash. **They do
  not bind an arbitrary subprocess** (a Python/Node script that opens the file itself).
  OS-level sandboxing is the separate layer for that; this stanza is not it.

## Template

Create or merge into the repo's `.claude/settings.json`. Replace the placeholder paths
in `EDIT_DENY_PATHS` / `READ_DENY_PATHS` with the repo's own records files — **the
authoritative source is the records-files paragraph in the repo's CLAUDE.md** (the one
that says "never `cp` over these"). Every file or directory named there gets an entry.
Do not invent entries for paths this template's home repo happens to have; fill from
the installing repo's own paragraph.

**Paste this verbatim — it contains no comments, by design (see the stamp note below).**

```json
{
  "_governance_install": "governance-install: harness-enforcement.md v1.1.0 · updated 2026-08-11",
  "permissions": {
    "deny": [
      "Edit(docs/pdr/**)",
      "Edit(docs/adr/**)",
      "Edit(docs/code-conventions.md)",
      "Edit(docs/testing-strategy.md)",
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(**/.env)",
      "Read(**/.env.*)",
      "Edit(./.env)",
      "Edit(./.env.*)"
    ]
  }
}
```

Filling the array — the annotations live here rather than inside the block, because a
comment inside the block is the failure this version exists to remove:

- The four `Edit(...)` rules are **EDIT_DENY_PATHS**: one per records file or directory
  from the installing repo's CLAUDE.md. The four above are examples from this template's
  home repo — replace them, do not append to them. Directories take the `/**` glob form
  (`docs/adr/` → `Edit(docs/adr/**)`).
- The six `.env` rules are **READ_DENY_PATHS**: credential files. These are the same in
  every repo. Ship them as-is.

### The stamp: a JSON key in `.claude/settings.json`, a `//` comment in `opencode.json`

Keep the `governance-install` stamp when you install — it is how the drift check verifies
the install and its version. **The form differs per harness, and getting it wrong voids
the whole stanza silently:**

| Config | Stamp form | Why |
|---|---|---|
| `.claude/settings.json` | `"_governance_install"` string key | Claude Code parses this file as **strict JSON** and discards the entire file when it fails to parse. A `//` comment does not degrade the stanza — it deletes it, and the harness reports only a startup line that is easy to miss. Verified against Claude Code 2.1.227, 2026-08-11 |
| `opencode.json` | `//` comment | opencode is JSONC-tolerant but validates config against a **closed schema** at startup and refuses to boot on an unrecognized key. The `_governance_install` key is fatal here (observed 2026-08-09, opencode 1.18.15) |

The key's **value** must carry the full stamp text, including the literal
`governance-install: harness-enforcement` prefix. `check-enforcement-stanzas.mjs` asserts
the stamp with a raw substring match; the underscore key *name* alone does not satisfy it
and the lint reports `UNSTAMPED`.

> **v1.0.1 said the opposite** — it shipped the `//` comment as the default for
> `.claude/settings.json` on the premise that "settings.json is JSONC-tolerant in Claude
> Code," relegating the key form to a parenthetical fallback. Of the two governed repos
> that installed that version, one worked around it and one shipped a stanza that was
> inert for a day with CI green (analytics-infrastructure #437 → #449). Whether the loader
> tightened in a patch release or the premise was never true, the default is now the form
> that works. Installs carrying the comment form must be converted, not left.

## Modes: `deny` (default) or `ask` (recorded per-repo downgrade)

The stanza above ships `deny` — the conservative default, correct for a fresh adopter.
Two modes exist, and the choice is per-repo, per path-class:

- **`deny` — always, for secrets paths.** There is no legitimate agent-reads-`.env`
  workflow, so credential paths never run at `ask`.
- **`deny` (default) or `ask` (downgrade on the record) for records paths.** The
  permission layer cannot tell a careful dated amendment from a `cp` over the record —
  it gates paths, not intent. `deny` makes every records edit a human's hands.
  `ask` (a `permissions.ask` array, same rule strings) makes every records edit a
  human *checkpoint*: the harness prompts, the diff is on screen, one keystroke
  approves. For repos where records maintenance is a daily paired activity (a §6 row,
  a PDR status bump), `ask` is the livable setting.

**`ask` does not weaken unattended runs — demonstrated, not cited** (2026-08-08,
Claude Code 2.1.226): a headless `claude -p` edit against an `ask`-listed path is
blocked with the denial recorded (`permission_denials` carries the Edit call —
"you haven't granted it yet"), file unchanged. A fleet worker has nobody to ask, so
`ask` is a hard wall exactly where it must be.

A repo running records paths at `ask` records the mode and the reason in
`docs/enforcement-stanzas-register.md`. The assertion lint
(`check-enforcement-stanzas.mjs`) accepts `deny` or `ask` for records rules and
requires `deny` for secrets rules. The downgrade moves a rule from `deny` to `ask` —
it never deletes one.

## Limits, on the record

- **Subprocess blind spot** (above): an agent determined to route around the deny through
  a script can. This stanza gates the harness's own tools — the accidental-overwrite and
  casual-read cases, which are the observed incidents. Deliberate circumvention is a
  sandboxing conversation, deliberately out of scope.
- **Presence ≠ binding.** This stanza shipping in a repo proves the config exists. That
  it actually blocks an edit is verified once at install time (the binding demonstration
  pasted in the installing PR) and thereafter by the recurring smoke check — see
  `check-enforcement-stanzas.mjs` (presence lint) and the harness-binding smoke runbook
  (behaviour). Do not skip the binding demonstration: a stanza that installs, stamps
  green, and does not bind is invisible to every structural gate.
- **Parse ≠ presence.** A stanza can be present, complete, correctly ordered, and still
  never reach the harness, because the harness refused to load the file it lives in. This
  is not hypothetical — it is how v1.0.1's comment form failed. The install step therefore
  ends with a parse check in the *harness's* dialect, not a reviewer's eye:
  `python3 -c "import json; json.load(open('.claude/settings.json'))"`. Since lint v1.1.0
  the assertion lint does this for you (strict for `.claude/settings.json`, JSONC for
  `opencode.json`); on v1.0.1 it did not, and a green lint proved nothing about loading.
