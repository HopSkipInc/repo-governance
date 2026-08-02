# Research: pre-action enforcement — recommendation

**Issue:** #15 · **Date:** 2026-08-02 · **Status:** research complete — recommendation with adoption triggers

**Builds on:** `docs/pre-action-enforcement-inventory.md` (#22) — the factual half.
Every harness capability claim below cites that table; the notation **[INV: r1–CC]** means
"inventory, invariant row 1, Claude Code cell," whose own citations (harness docs or
working local configs) are the evidence. Nothing here asserts a capability the inventory
marks `unverified`.

---

## Recommendation (summary)

Adopt **two** pre-action enforcements now, per harness, as one template pair plus a
follow-up issue; defer two with observable triggers; recommend nothing on any
`unverified` capability.

| Invariant | Verdict | Shape |
|---|---|---|
| Records-file protection | **Adopt now** | Path-deny rules in each harness's config, plus an install-assertion lint |
| Secrets hygiene | **Adopt now** | Path-deny rules (opencode partly defaults already); no content-scanning |
| Migration stop-conditions | **Defer — trigger below** | Post-hoc PR-time lint holds; pre-action payload hook is the most fragile mechanism in the inventory |
| Tier-gate resolved-model verification | **Defer — unverified capability** | The deployed pin + fail-closed confirmation holds; nothing new is verifiable to recommend |

## 1. Adopt now: records-file protection (both harnesses)

**Claim:** both harnesses can deny edits to enumerated paths before the edit lands,
with the deny enforced by the harness rather than the model [INV: r1–CC, r1–OC].

- Claude Code: `Edit(path)` deny rules cover all file-editing tools [INV: r1–CC —
  CC-PERMS]. Deny rules evaluate before ask and allow, and are "enforced by Claude Code,
  not by the model" — the harness's own words.
- opencode: `permission.edit` path rules, last-match-wins, with per-agent overrides
  [INV: r1–OC — OC-PERMS, OC-AGENT-LOCAL].

**Why now:** the hazard is paid for. The routing policy's records-destruction incident
(policy 1.9.0 changelog) and this repo's two blank-form-as-record incidents are the
observed need; the mechanism is a config stanza, not infrastructure (PDR-006
respected); and the routing practice's own lesson stands — the only stop-rule that has
held in the wild held at the permission layer [INV: r2–OC — OC-AGENT-LOCAL].

**Limits carried from the inventory:** Claude Code's Read/Edit deny does not bind
arbitrary subprocesses [INV note 2]; the hook `if`-filter fails open on unparseable
input, so the deny belongs in the permission system, not a hook `if` [INV note 3].

## 2. Adopt now: secrets hygiene, path-level (both harnesses)

**Claim:** both harnesses can deny reads/edits on credential paths pre-action
[INV: r3–CC, r3–OC]. opencode denies `.env` reads **by default** [INV: r3–OC —
OC-PERMS Defaults].

**Why now:** the marginal cost is a stanza per harness, and the subject matter is the
highest blast radius in the routing stop-conditions (credentials). This is the
*hygiene* half only — the agent does not leak credentials into state files, memory, or
records. **No content-scanning hooks:** scanning write payloads for secret-shaped
strings is documented for Claude Code hooks but has no working local config
[INV: r3–CC and note 4], and is `unverified` for opencode [INV note 6] — recommending
either would assert what the evidence does not show.

## 3. Defer: migration stop-conditions (content-inspecting pre-action hook)

**Claim:** Claude Code can inspect an edit payload for DROP/RENAME before the edit
lands [INV: r4–CC]; opencode's equivalent content-aware check is `unverified`
[INV: r4–OC, note 6].

**Why defer:** the post-hoc gate already holds — `check-breaking-migrations` (PR-time,
CI) covers the merge boundary, which is where the 2026-07-15 incident actually
escaped. The pre-action hook buys the task-time window at the price of the most
fragile mechanism in the inventory: a hook `if`-filter that fails open on unparseable
input [INV note 3] and a documented subprocess blind spot [INV note 2]. A gate that
can silently not-fire is worse than a later gate that always fires.

**Observable trigger to adopt:** a governed repo ships a PreToolUse payload-inspecting
hook for *any* purpose and it survives one audit cycle with the failure modes measured
— or a second drop/rename incident lands despite the PR-time lint. Either converts
this row to adopt with evidence behind it.

## 4. Defer: tier-gate resolved-model verification

**Claim:** no fetched doc or local config demonstrates verifying a spawned subagent's
*resolved* model before the task proceeds, in either harness [INV: r2 cells, note 5 —
`unverified`]. Claude Code's `Agent(model:…)` parameter matching gates only
explicitly-parameterized calls, compared literally [INV note 4 — CC-PERMS].

**Why defer:** the constraint is absolute — nothing is recommended on an unverified
capability. The deployed stack (spawn-time pin + the skill's fail-closed confirmation
[INV: r2–CC, r2–OC — TRIAGE-SKILL]) is the enforcement that exists and it held.

**Observable trigger to adopt:** harness documentation publishes a hook field or
permission parameter matching the resolved model, or a working config demonstrates the
check — at which point this becomes a one-cell inventory update plus a stanza.

## Reject/defer list — what stays post-hoc, and the mechanism that holds it

| Candidate | Verdict | Post-hoc mechanism that stays |
|---|---|---|
| Migration content-inspection hook | Defer (trigger §3) | `check-breaking-migrations` at PR time |
| Secrets content-scanning hook | Reject for now — `unverified`/undemonstrated | Instruction rule + opencode `.env` default deny + audit sweep |
| Resolved-model verification | Defer (trigger §4) | routing-triage fail-closed confirmation + routing lints R5/R6 |
| A cross-harness shared mechanism | Reject | None exists; per the session-15 lesson, each harness enforces at its own permission layer, and a "shared" layer would be a third thing to keep honest |

## Honest-degradation design — a hook that isn't installed must be detectable

A hook cannot report its own absence: the fail-open shape here is an agent that
believes it is gated and is not. Detection therefore lives out-of-band, in two places:

1. **An install-assertion lint.** The enforcement template ships paired with a
   `check-*.mjs` that reads the repo's harness configs (`.claude/settings.json`,
   `opencode.json` / agent frontmatter) and fails CI when a required stanza is absent
   or malformed — register-driven, the same shape as `check-mothership-drift.mjs` and
   `check-analyze-repo-coverage.mjs`: the required stanzas are on the record, an
   unlisted drift is reported, and a missing register fails closed.
2. **A fail-closed confirmation at the relying ritual.** Any skill whose procedure
   assumes the enforcement (as routing-triage assumes the classifier delegation)
   confirms it at step 0 and stops when it cannot [INV: r2 — TRIAGE-SKILL] — the
   confirmation checks the outcome, not the config file, because a config that exists
   and does not bind is the second failure shape.

The two are complementary: the lint catches never-installed and drifted-away; the
ritual confirmation catches installed-but-not-binding. Neither trusts the mechanism to
watch itself.

## PDR-007 boundary statement

PDR-007's recorded non-goal is the **buyer and the positioning** — not sold to
security/compliance buyers, not positioned on SOC 2, NIST CSF, or control frameworks —
with security reasoning inside an engineering engagement explicitly kept in scope.
This recommendation lands **inside** that line: it enforces engineering invariants
(records integrity, credential hygiene as agent hygiene, migration discipline) for the
repos already governed, ships no security baseline, maps to no framework, and is sold
to no one. The closest cell to the line is secrets hygiene; it is framed and scoped as
hygiene (the agent does not leak credentials into state), not as a compliance control.
Per the routing sweep's flag, this boundary call is surfaced for review rather than
settled by the implementer alone — the review of this note is the second pair of eyes.

## Follow-ups (filed, not bundled)

- **Template issue #33:** the per-harness enforcement config pair (Claude Code
  settings stanza + opencode permission stanza for records-file and secrets paths),
  the install-assertion lint, and the register of required stanzas. Filed as a
  follow-up issue per #15's outcome 4 — the issue body carries the template spec.

## What would change this recommendation

- The §3 or §4 triggers firing (each converts a defer to an adopt, with evidence).
- A harness deprecating its permission layer — both adopt-now rows rest on documented
  config surfaces [INV: CC-PERMS, OC-PERMS, dated 2026-08-02] and would need
  re-inventory.
- A governed repo incident where an installed enforcement did not bind — that is the
  installed-but-not-binding shape the ritual confirmation exists for, and one
  observation of it moves that confirmation from "at relying rituals" to "at every
  session start," stated here as the pre-committed response.
