<!-- template: harness-enforcement.opencode.md v1.1.0 · updated 2026-08-13 -->
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
  // governance-install: harness-enforcement.opencode.md v1.0.1 · updated 2026-08-09
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
verifies the install and its version. The stamp is a `//` comment, **always**.
`opencode.json` is JSONC-tolerant, but opencode validates the config against a **closed
schema** at startup and refuses to boot on an unrecognized top-level key — so the
`"_governance_install"` string-key form the Claude Code variant of this template offers
for strict-JSON settings files is **fatal here**, not an option. Observed 2026-08-09,
opencode 1.18.15: `Configuration is invalid … Unrecognized key: _governance_install`,
TUI never starts. Never use the key form in `opencode.json`.

## Modes: `deny` (default) or `ask` (recorded per-repo downgrade)

The stanza above ships `deny` — the conservative default, correct for a fresh adopter.
Two modes exist, and the choice is per-repo, per path-class:

- **`deny` — always, for secrets paths.** There is no legitimate agent-reads-`.env`
  workflow, so credential paths never run at `ask`.
- **`deny` (default) or `ask` (downgrade on the record) for records paths.** The
  permission layer cannot tell a careful dated amendment from a `cp` over the record —
  it gates paths, not intent. `deny` makes every records edit a human's hands.
  `ask` (action value `"ask"` in place of `"deny"`, same keys, same catch-all-first
  ordering) makes every records edit a human *checkpoint*: the harness prompts, the
  diff is on screen, one keystroke approves. For repos where records maintenance is a
  daily paired activity (a §6 row, a PDR status bump), `ask` is the livable setting.

**`ask` does not weaken unattended runs — demonstrated, not cited** (2026-08-08,
opencode 1.18.15): a headless `opencode run` edit against an `ask`-listed path is
blocked — `permission requested: edit (...); auto-rejecting` — file unchanged. A fleet
worker has nobody to ask, so `ask` is a hard wall exactly where it must be.

A repo running records paths at `ask` records the mode and the reason in
`docs/enforcement-stanzas-register.md`. The assertion lint
(`check-enforcement-stanzas.mjs`) accepts `deny` or `ask` for records rules and
requires `deny` for secrets rules. The downgrade moves a rule from `deny` to
`ask` — it never deletes one.

## Mediated write paths (v1.1.0, issue #81)

The stanza gates paths, not intent — so left alone it cannot tell "agent
creates ADR-063" from "agent `cp`s a blank form over ADR-022", and every
records write becomes human hands (`deny`), a human keystroke (`ask`), or
impossible (headless — `ask` auto-rejects, and a fleet worker has nobody to
ask). "Human writes the ADR" is not a process. The remedy is a **mediated write
path**, and it works *because* this stanza stays at full strength:

- The repo ships a validating, append-only writer script —
  `templates/scripts/write-record.mjs` — run via Bash. A subprocess is not
  bound by `permission` path rules (see the blind-spot limit below); that
  documented gap is, here, the designed gate. `create` publishes a new numbered
  record (number allocation, required-section validation, README registration,
  corpus lints run post-write); `amend` lands status flips, consequences, and
  README rows under section guards (`## Decision` / `## Context` are immutable
  — the blank form's own rule, made mechanical; README rows are editable but
  never deletable).
- **The deny rules stay exactly as shipped.** They close the accident vector —
  the one-shot Edit/Write/`cp` onto an existing record — and they are what
  makes the funnel work: the raw path errors out, the script is the easy path.
  A repo that weakens the deny "because the script exists" has removed the
  reason agents use the script.
- The human checkpoint moves to the PR merge — where it already sits for every
  other artifact, and the only checkpoint that exists for unattended workers.

**This section sanctions exactly one subprocess write path: the registered
script.** Any other scripted write to records paths remains precisely the
violation it was before. Each mediated path is declared in
`docs/enforcement-stanzas-register.md` (`## Mediated write paths`), and
`check-enforcement-stanzas.mjs` asserts the named script exists and stamps the
declared version — a register row claiming a writer that is not on disk is the
same fail-open shape the lint exists to catch.

## Limits, on the record

- **`bash` indirection is a known bypass surface.** Permission patterns match paths and
  parsed commands; the documentation does not state the parse depth for compound
  commands, substitutions, or redirects. This stanza gates the harness's file tools —
  the accidental-overwrite and casual-read cases. Deliberate shell circumvention is a
  sandboxing conversation, deliberately out of scope. **One subprocess path is sanctioned
  by design:** the registered mediated write path (above), which validates and never
  overwrites. Every other scripted write to records paths is circumvention, and the
  register is how CI knows which is which.
- **Presence ≠ binding.** This stanza shipping in a repo proves the config exists. That
  it actually blocks an edit is verified once at install time (the binding demonstration
  pasted in the installing PR) and thereafter by the recurring smoke check — see
  `check-enforcement-stanzas.mjs` (presence lint) and the harness-binding smoke runbook
  (behaviour). Do not skip the binding demonstration: a stanza that installs, stamps
  green, and does not bind is invisible to every structural gate.
