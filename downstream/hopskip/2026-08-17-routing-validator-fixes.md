# Governance update: routing-validator fixes from ai-fleet's upstream outbox + end-of-run stamp re-check (2026-08-17)

**Applies to:** the three repos that have adopted the routing layer — HopSkipInc/ai-fleet,
HopSkipInc/analytics-infrastructure, HopSkipInc/enrichment-pipeline. HopSkipInc/infra-ops
never installed routing (core class): no action, recorded here so the omission is
considered rather than silent.
**Source:** the "Upstream feedback owed to repo-governance" section of ai-fleet's
`docs/agent-routing-records.md` — three defects filed 2026-07-27 against validator
v1.2.0 / policy 1.9.0, verified on 2026-08-17 to still reproduce against v1.2.0 /
1.13.0 before fixing. ai-fleet cannot write here (the trust boundary is deliberate),
so this prompt is the delivery.
**Sequencing:** independent of the pending 08-08/08-11/08-13 stanza prompts — different
files, either order. This prompt does **not** move your `docs/agent-routing.md` copy; all
three repos are independently behind on the policy itself (1.11.0 → 1.13.0), which is owed
through the normal sync ritual, not here.

## The problems these fix

**U1 — R8's `COVERAGE_SIGNAL` missed the commonest phrasing.** Seven patterns, and none
matched "has no test file" — used independently three times in one ai-fleet run (#1306,
#1167, #1294). Those escalations rested entirely on the uncovered-surface signal, escaped
R8, and got no expiry condition: R8 caught 3 of ~6–7 coverage-resting escalations. The
"asserts nothing about <surface>" form escaped too (#762).

**U2 — R1 contradicted the policy on epics.** Policy §Mechanism 3 prescribes an epic
carrying a tier table over its children rather than a single tier — no `impl:` label, the
`## Impl tier` block holds the child table. R1 fired `has an "## Impl tier" section but no
impl: label` on exactly that shape. **Resolved on the validator side** (the policy is
unchanged and no heading renames are required): R1 now stands down when the block contains
the child tier table or the issue carries the `epic` label. ai-fleet's existing workaround —
qualified headings like `## Impl tier (epic — tiered by child, see table)` — remains valid
and needs no rework; it falls outside R1's anchored heading entirely.

**U3 — `declaredKind()` read kind from prose.** It returned the first
`\b(spec|inherent|both)\b` anywhere in the tier block, so "fails closed at **both**
decision points" reported kind=both on a standard issue (observed: ai-fleet #1356, #1354).
Harmless to today's rules (R3/R4/R7 gate on tier, R5 needs the structure label), but the
field was untrustworthy and any future rule reading kind without checking tier would
misfire. Kind is now read only from its declaration site: `<tier> (<kind>)` opening the
block. A kind that appears only in prose is not declared — R3 will say so, loudly.

**Process note — mid-run policy drift.** The policy moved 1.9.0 → 1.10.0 at 08:57 EDT on
2026-07-27, two hours into an ai-fleet triage run conducted under 1.9.0. The stamp caught
it only because a `diff -q` happened to run at the end; a run that never re-checked would
have finished silently split across two policy versions.

## What changed upstream

- **`templates/scripts/check-issue-routing.mjs` v1.2.0 → v1.3.0.**
  - R8 `COVERAGE_SIGNAL` gains three entries: `\bno test files?\b`,
    `\bno \S+\.(test|spec).<ext>\b` (the file-named form, written cross-language —
    `get.test.ts`, `Foo.spec.cs`), and `\basserts? nothing about\b`.
  - R1 is epic-aware: it exempts the zero-label epic shape (child tier table in the block,
    or an `epic` label), at both of its firing sites. An epic carrying *two or more* impl:
    labels is still a violation. The R1 message on the remaining case now points at the
    epic-table convention.
  - `declaredKind()` anchors on `^<tier> (<kind>)` on the block's first line.
  - Eight new fixture cases in repo-governance's suite, each verified to fail against
    v1.2.0 and pass against v1.3.0.
- **`templates/skills/routing-triage/SKILL.md` v1.6.1 → v1.7.0** — Step 5 now re-checks
  the policy stamp at the *end* of the run against the template, with the re-examination
  procedure when they disagree; the Tips epic bullet names the qualified-heading
  convention (`## Impl tier (epic)`) alongside the R1 exemption.
- **`templates/agent-routing.md` unchanged (stays 1.13.0).** U2 was decided script-side on
  purpose: the policy already described the epic shape correctly, the validator failed to
  know the house convention, and one artifact re-syncs instead of two. Do not also rename
  epic headings *because of this prompt* — the qualified form is recommended for new epics
  via the skill, never required by the validator.

## Steps

**1. Re-sync the validator, byte-identical**, into the path your CLAUDE.md's
Synced-templates table declares (that declaration is what `check-downstream-drift`
verifies — re-sync there, not beside it):

| Repo | Declared path (as of 2026-08-17) | Installed |
|---|---|---|
| HopSkipInc/ai-fleet | `scripts/check-issue-routing.mjs` | v1.2.0 |
| HopSkipInc/analytics-infrastructure | `scripts/check-issue-routing.mjs` | v1.2.0 |
| HopSkipInc/enrichment-pipeline | `scripts/check-issue-routing.mjs` | v1.2.0 |

```bash
cp ~/repos/HopSkipInc/repo-governance/templates/scripts/check-issue-routing.mjs \
   <declared path from your table>
```

**2. Re-sync the skill, byte-identical** — `.claude/skills/routing-triage/SKILL.md` in all
three repos (v1.6.1 → v1.7.0).

**3. Bump the Synced-templates rows** in your CLAUDE.md for both artifacts.

## Verification

```bash
# 1. Stamps landed
grep -m1 'template: scripts/check-issue-routing.mjs' <declared path>   # expect v1.3.0 · 2026-08-17
grep -m2 -E '^version:|^updated:' .claude/skills/routing-triage/SKILL.md  # expect 1.7.0 / 2026-08-17

# 2. The validator against your live backlog
node scripts/check-issue-routing.mjs   # your declared path; needs gh auth
```

Read the first post-sync run carefully — it should be *noisier*, in specific ways:

- **New R8 warnings are the fix working.** Escalations whose tier lines use the previously
  invisible phrasings now surface (ai-fleet: expect #1306, #1167, #1294 and #762-shaped
  lines). Remediate by filing and linking the coverage gap (`Coverage gap: #N`), never by
  narrowing the lint.
- **Epics stop erroring.** Any epic that carried a bare `## Impl tier` heading over its
  child table no longer trips R1.
- **Possible new R3 errors** on escalations whose kind was only ever declared in prose —
  restate the first line as `<tier> (<kind>) — …`. Loud and cheap to fix; that is the
  intended behavior.

## Not done here, owed

- **The ai-fleet outbox rows.** The three "Delivered? = no" rows in ai-fleet's
  `docs/agent-routing-records.md` are cleared by an ai-fleet session, and only after this
  change merges upstream — repo-governance must not write there. Until then they read as
  delivered-in-spirit, which is precisely the state the outbox exists to prevent lingering
  in. Owed: flip the three rows to delivered with the repo-governance PR reference.
- **The policy re-sync (1.11.0 → 1.13.0)** all three repos are independently owed — the
  `gate:decision` write path (1.13.0) and the stop conditions (1.12.0) are not in any
  installed copy. That rides the next sync ritual, not this prompt.
