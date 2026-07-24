# repo-governance

## Session State Protocol

**At session start (REQUIRED):**
1. Read `~/.claude/global-state.md` — preferences, active projects, memory file manifest
2. Read `.claude/team-state.md` in this repo — shared team context: architecture decisions, conventions, sprint focus, gotchas
3. Read `.claude/personal-state.md` in this repo — your personal context: current focus, working notes, opinions
4. Check the Memory Files table in global-state.md — load any `~/.claude/memory/` files relevant to this session's topic

**At session end (when user says stop/done/pause/tomorrow):**
1. Update `.claude/team-state.md` with shared context: architecture decisions, conventions, gotchas the team should know
2. Update `.claude/personal-state.md` with personal context: your next steps, working notes, opinions
3. Do NOT update `~/.claude/global-state.md` — its Active Projects table is rebuilt automatically by `wayfind status`.
4. If significant new cross-repo context was created (patterns, strategies, decisions), create or update a file in `~/.claude/memory/` and add it to the Memory Files manifest in global-state.md

**Do NOT use ruvector/claude-flow memory CLI for state storage.** Use plain markdown files only.

## Agent routing

Every issue carries an `impl:` label — `standard`, `frontier`, or `human` — declaring the
minimum capability class required, and an `## Impl tier` line giving the kind and the reason.

Kinds: **`spec`** (under-specified — rewrite it and the tier drops), **`inherent`** (silent
failure or load-bearing boundary — no spec fixes it), **`both`** (under-specified *and*
dangerous — rewrite the spec, the tier stays). `both` is the commonest state on a real
boundary and the easiest to mislabel: `inherent` is the flattering call, so a triager forced
to choose drifts toward it.

Before implementing an issue:

1. Read the `impl:` label and the `## Impl tier` line.
2. If the tier exceeds your capability class, do not implement. Comment with what you
   would need, and stop.
3. If the label or the kind is missing, do not implement. Comment and stop.
4. Stop and comment if any of these fire, whatever the tier says: three attempts at the
   same failing test; creating a file type with no precedent here; touching a migration
   that drops or renames; no existing test covers the surface you are changing; the diff
   exceeds [N] files.

You may escalate an issue's tier at any time. You may never downgrade one — least of all
on an issue you are about to implement.

Tier definitions, the model→class mapping, and this repo's calibration examples are in
`docs/agent-routing.md`.
