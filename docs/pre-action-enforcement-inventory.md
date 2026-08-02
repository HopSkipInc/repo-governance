# Inventory: pre-action enforcement mechanisms per harness

**Issue:** #22 (split from #15) · **Date:** 2026-08-02 · **Status:** inventory only

**Harness versions checked:** Claude Code 2.1.220 (`claude --version`), opencode 1.18.11
(`opencode --version`). Capability claims about harnesses go stale silently — re-verify
against current versions before reuse.

**Documentation as of:** Claude Code hooks reference and permissions guide
(code.claude.com/docs/en/hooks, /docs/en/permissions, fetched 2026-08-02); opencode
permissions (opencode.ai/docs/permissions/, page footer "Last updated: Aug 2, 2026").

Scope rule from the issue: every cell cites the harness's own documentation or a working
local config; a cell with neither says `unverified` — a permitted, complete answer. The
recommendation, adoption triggers, and reject/defer list are the parent issue's residue
and appear nowhere in this note.

## The 4×2 table

| Invariant | Claude Code 2.1.220 | opencode 1.18.11 |
|---|---|---|
| **Records-file protection** (a listed records file is never overwritten) | `Edit(path)` deny rules — cover all file-editing tools, e.g. `Edit(docs/pdr/**)` [CC-PERMS]; or a `PreToolUse` hook blocking edits to protected paths — the hooks guide's own worked example is this case ("Block edits to protected files") [CC-HOOKS]; hook wiring in the wild [CC-HOOK-LOCAL] | `permission.edit` path rules, last matching rule wins, e.g. `"docs/pdr/**": "deny"` [OC-PERMS]; per-agent permission blocks merge over the global config, agent rules taking precedence [OC-PERMS; OC-AGENT-LOCAL] |
| **Tier-gate delegation** (classification runs on the pinned model before implementation starts) | `model:` frontmatter pin on the classifier subagent, resolved by the harness at spawn [CC-AGENT-LOCAL]; deny/ask rules can match the Agent tool's `model` input parameter — `Agent(model:opus)` [CC-PERMS]; the invoking skill fails closed when it cannot confirm the delegation occurred [TRIAGE-SKILL] | `model:` frontmatter pin on the global agent (`model: opencode/claude-opus-5`) with `mode: subagent` [OC-AGENT-LOCAL]; `permission.task` matches the subagent type, so task launches can be scoped per agent [OC-PERMS] |
| **Secrets hygiene** (credentials never written to memory, state, or records) | `Read(path)` / `Edit(path)` deny rules over credential paths — `Read(./.env)` is the permissions guide's own syntax example [CC-PERMS]; a `PreToolUse` hook receives the full tool input as JSON on stdin and can inspect content before the call executes [CC-HOOKS] | `permission.read` denies `.env` files **by default** (`*.env`, `*.env.*` deny; `*.env.example` allow) [OC-PERMS]; path-scoped `read`/`edit` deny rules and `bash` command patterns, e.g. the `"*": deny` + allowlist shape [OC-PERMS; OC-AGENT-LOCAL] |
| **Migration stop-conditions** (halt before a migration that drops or renames) | `PreToolUse` hook, matcher `Edit\|Write` with an `if` path pattern over migration directories (e.g. `Edit(**/migrations/**)`); the hook script inspects the edit payload and returns `permissionDecision: "deny"` — it fires before the edit lands [CC-HOOKS] | `permission.edit` path rules setting migration paths to `"ask"` — a human approval prompt fires before the edit lands [OC-PERMS]; `bash` patterns can gate the migration runner command itself (e.g. deny/ask on the runner's command shape) [OC-PERMS] |

## Citations

- **[CC-HOOKS]** Claude Code hooks reference — https://code.claude.com/docs/en/hooks
  (fetched 2026-08-02). Facts drawn: `PreToolUse` "Before a tool call executes. Can block
  it"; matcher/`if` filtering including `Edit(**/src/**)` path semantics; JSON
  `hookSpecificOutput.permissionDecision: "deny"`; the `if` filter's fail-open caveat.
- **[CC-PERMS]** Claude Code permissions guide — https://code.claude.com/docs/en/permissions
  (fetched 2026-08-02). Facts drawn: deny→ask→allow evaluation order; "Permission rules
  are enforced by Claude Code, not by the model"; `Edit(path)` rules cover all
  file-editing tools (v2.1.210+); `Read(path)` deny also blocks Edit on the path
  (v2.1.208+); `Agent(model:opus)` input-parameter matching; the subprocess limitation
  warning; gitignore path-pattern semantics.
- **[CC-HOOK-LOCAL]** Working `PreToolUse` hook —
  `/home/greg/repos/HopSkipInc/ai-fleet/.claude/settings.json` (Bash matcher → command
  hook running `.githooks/claude-pre-commit`).
- **[CC-AGENT-LOCAL]** Working subagent model pin —
  `templates/agents/routing-classifier.md` (`model:` frontmatter); installed copy at
  `/home/greg/repos/HopSkipInc/ai-fleet/.claude/agents/routing-classifier.md`. Path-scoped
  permission rules in the wild: `/home/greg/.claude/settings.json`
  (`permissions.allow` with `Write(...)` / `Edit(...)` path patterns; deny rules share the
  syntax per [CC-PERMS]).
- **[TRIAGE-SKILL]** `templates/skills/routing-triage/SKILL.md` v1.3.0 — the skill fails
  closed when it cannot confirm the classifier delegation occurred.
- **[OC-PERMS]** opencode permissions documentation — https://opencode.ai/docs/permissions/
  (fetched 2026-08-02; footer "Last updated: Aug 2, 2026"). Facts drawn: allow/ask/deny
  actions; granular object syntax with wildcards and last-match-wins; permission keys
  (`read`, `edit`, `bash`, `task`, …); the `.env` default deny; per-agent merge
  precedence; the Markdown agent-frontmatter `permission:` block shape.
- **[OC-AGENT-LOCAL]** Working agent permission block —
  `/home/greg/.config/opencode/agents/routing-classifier.md` (`edit: deny`, bash allowlist
  ending `"*": deny`, `task: deny`, `model: opencode/claude-opus-5`).

## Cell notes and limitations

1. **Harness-enforced vs. instruction-shaped.** [CC-PERMS] states permission rules are
   enforced by Claude Code, not by the model, and that prompt/CLAUDE.md instructions do
   not change what is allowed. opencode's permission layer resolves allow/ask/deny before
   the action runs [OC-PERMS]. Both harnesses' mechanisms in the table operate on tool
   name, path, command text, agent type, or tool-input parameters.
2. **Subprocess limitation (Claude Code).** Read/Edit deny rules apply to built-in file
   tools and to file commands Claude Code recognizes in Bash; they do not apply to
   arbitrary subprocesses that open files themselves (a Python/Node script). OS-level
   enforcement is the separate sandboxing layer [CC-PERMS warning].
3. **`if`-filter caveat (Claude Code hooks).** The `if` filter fails open — it runs the
   hook regardless of pattern when a Bash command cannot be parsed — and [CC-HOOKS]
   directs hard allow/deny to the permission system rather than hooks. A records-file
   gate wired only as a hook `if` inherits that caveat; `Edit(path)` deny rules do not.
4. **`Agent(model:…)` matching limits (Claude Code).** The value is compared against the
   literal input the model sends (the alias `opus`, not a full model ID), and a call that
   omits the `model` parameter is never matched [CC-PERMS]. An `Agent(model:…)` rule
   therefore gates explicitly-parameterized Agent calls only.
5. **Tier-gate cells — `unverified` remainder.** No local config or fetched doc
   demonstrates a hook/permission verifying a spawned subagent's *resolved* model before
   the task proceeds (either harness). The existing gate is the spawn-time pin plus the
   skill's fail-closed confirmation [CC-AGENT-LOCAL; OC-AGENT-LOCAL; TRIAGE-SKILL].
6. **Content-aware detection (opencode).** `permission` patterns match paths and parsed
   commands, not file content [OC-PERMS]. DROP/RENAME detection *inside* a migration
   file's text has no documented permission-rule mechanism — `unverified` (opencode
   plugins were not evaluated for this note).
7. **Shell indirection depth (opencode).** `bash` rules match parsed commands; the
   documentation does not state the parse depth for compound commands, substitutions, or
   redirects, so a pattern like `"cat *.env*": "deny"` has an undocumented bypass surface
   via indirection — `unverified`.

## What this note deliberately does not contain

- No adoption judgment, trigger conditions, or reject/defer list — those are #15's
  residue, and writing one here pre-empts the judgment the tier split exists to protect.
- No mechanism without a citation — `unverified` appears five times above and is a
  complete answer per the issue.
