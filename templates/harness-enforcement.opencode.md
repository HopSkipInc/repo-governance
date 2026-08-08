<!-- template: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08 -->
# Harness enforcement — opencode settings stanza

Two invariants, enforced by the harness before the action lands — not by the model, and
not by instructions in AGENTS.md / CLAUDE.md:

1. **Records-file protection** — the repo's records files (PDRs, ADRs, code-conventions,
   testing-strategy, routing records — whatever the repo's own records-files paragraph
   lists) are never overwritten by an agent edit. A `cp` over a records file destroys
   dated, local content with no diff to recover from; it has happened, twice, in the
   repo this template ships from.
2. **Secrets hygiene (path-level)** — credential files are never read or edited by the
   agent. This is hygiene, not a compliance control: the agent does not leak credentials
   into state files, memory, or records.

opencode enforces both through `permission` path rules in `opencode.json`. The semantics
that make this work (opencode permissions documentation, verified 2026-08-08 against
opencode 1.18.15):

- **Last matching rule wins.** List the catch-all `"*": "allow"` **first**, specific
  denies **after** it. A deny listed before the catch-all is silently overwritten by it
  — this ordering is the single easiest way to install a stanza that reads correctly
  and does not bind.
- Path rules accept wildcards (`docs/pdr/**`, `*.env`).
- **opencode already denies `.env` reads by default** (`*.env`, `*.env.*` deny;
  `*.env.example` allow). The stanza lists the rules anyway: an explicit rule survives
  a future default change, and the install-assertion lint checks what the file says,
  not what the default promises.
- Per-agent `permission:` blocks (agent frontmatter) **merge over** the global config
  with agent rules taking precedence — a per-agent grant can reopen what this stanza
  denies. The assertion lint registers the global stanza; audit per-agent blocks
  separately when you add them.

## Template

Create or merge into the repo's `opencode.json`. Replace the placeholder paths with the
repo's own records files — **the authoritative source is the records-files paragraph in
the repo's CLAUDE.md / AGENTS.md** (the one that says "never `cp` over these"). Every
file or directory named there gets a `"deny"` entry. Do not invent entries for paths
this template's home repo happens to have; fill from the installing repo's own
paragraph.

```json
{
  // governance-install: harness-enforcement.opencode.md v1.0.0 · updated 2026-08-08
  "permission": {
    "edit": {
      "*": "allow",
      "docs/pdr/**": "deny",              // one per records file/dir from CLAUDE.md
      "docs/adr/**": "deny",              //   (shown here as two examples — replace)
      "docs/code-conventions.md": "deny",
      "docs/testing-strategy.md": "deny",
      ".env": "deny",
      ".env.*": "deny",
      "**/.env": "deny",
      "**/.env.*": "deny"
    },
    "read": {
      "*": "allow",
      ".env": "deny",
      ".env.*": "deny",
      "**/.env": "deny",
      "**/.env.*": "deny"
    }
  }
}
```

Keep the `governance-install` stamp comment when you install — it is how the drift check
verifies the install and its version. (`opencode.json` is JSONC-tolerant; if your repo's
file is strict JSON, move the stamp into a `"_governance_install"` string key carrying
the same text.)

## Limits, on the record

- **`bash` indirection is a known bypass surface.** Permission patterns match paths and
  parsed commands; the documentation does not state the parse depth for compound
  commands, substitutions, or redirects. This stanza gates the harness's file tools —
  the accidental-overwrite and casual-read cases. Deliberate shell circumvention is a
  sandboxing conversation, deliberately out of scope.
- **Presence ≠ binding.** This stanza shipping in a repo proves the config exists. That
  it actually blocks an edit is verified once at install time (the binding demonstration
  pasted in the installing PR) and thereafter by the recurring smoke check — see
  `check-enforcement-stanzas.mjs` (presence lint) and the harness-binding smoke runbook
  (behaviour). Do not skip the binding demonstration: a stanza that installs, stamps
  green, and does not bind is invisible to every structural gate.
