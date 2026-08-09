<!-- template: harness-enforcement.md v1.0.1 · updated 2026-08-09 -->
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

```json
{
  // governance-install: harness-enforcement.md v1.0.1 · updated 2026-08-09
  "permissions": {
    "deny": [
      "Edit(docs/pdr/**)",              // EDIT_DENY_PATHS: one per records file/dir from CLAUDE.md
      "Edit(docs/adr/**)",              //   (shown here as two examples — replace with the repo's own)
      "Edit(docs/code-conventions.md)",
      "Edit(docs/testing-strategy.md)",
      "Read(./.env)",                   // READ_DENY_PATHS: credential files
      "Read(./.env.*)",
      "Read(**/.env)",
      "Read(**/.env.*)",
      "Edit(./.env)",
      "Edit(./.env.*)"
    ]
  }
}
```

Keep the `governance-install` stamp comment when you install — it is how the drift check
verifies the install and its version. (`settings.json` is JSONC-tolerant in Claude Code;
if your repo's settings file is strict JSON, move the stamp into a `"_governance_install"`
string key carrying the same text. **Claude Code `settings.json` only** — never put the
key in `opencode.json`: opencode validates config against a closed schema at startup and
refuses to boot on an unrecognized key (observed 2026-08-09, opencode 1.18.15). In a repo
running both harnesses, the opencode stamp is always a `//` comment.)

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
