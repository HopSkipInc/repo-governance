<!-- template: harness-enforcement.md v1.0.0 · updated 2026-08-08 -->
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
  // governance-install: harness-enforcement.md v1.0.0 · updated 2026-08-08
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
string key carrying the same text.)

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
