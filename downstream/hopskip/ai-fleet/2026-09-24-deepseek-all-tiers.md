# Governance Maintenance — HopSkipInc/ai-fleet — 2026-09-24

**Client:** hopskip
**Source:** repo-governance `agent-routing` v1.16.0, `agent-routing-records` v1.1.0
**Kind:** owner-directed routing calibration — DeepSeek V4.1 Flash across every tier
**Carries a migration:** yes (registry rebind + eligibility + ranked grants)
**Related:** `downstream/hopskip/ai-fleet/2026-09-24-classifier-class-binding.md` (the class
binding this builds on)

Owner direction, 2026-09-24: DeepSeek V4.1 Flash (`deepseek-v4-1-flash`) is to run against
**all tiers** for a bounded period. Two halves, both required to unblock it:

1. **The capability map** — add `deepseek-v4-1-flash` to the `deep-reasoning` class so the
   interactive/advisory gate stops refusing `impl:frontier`.
2. **The registry** — make `deep-reasoning` actually **resolve** to `deepseek-v4-1-flash@deepseek`
   so a fleet dispatched onto deep-reasoning work runs deepseek. Today `general` and
   `engineering` resolve to it (#3081 / 0518, #3056 / 0517); `deep-reasoning` still resolves to
   `gpt-6-sol@azure` (#3079 / 0519). This prompt adds deep-reasoning **as well**.

**This is a calibration run, not a capability reassessment.** There is no outcome evidence for
deepseek at frontier grade — the placement sits beside the kimi-k3 / gpt-6-sol unevidenced rows.
The falsifier is a botched silent-boundary implementation. Record it as revisitable.

---

## 1. Add deepseek to the `deep-reasoning` class (the map)

`docs/agent-routing-class-map.json` is the source; `docs/agent-routing-class-map.md` is
generated from it. Two edits, then regenerate:

- add `deepseek-v4-1-flash` to `deep-reasoning.models` (leave `gpt-6-sol` and `claude-opus-5`
  in place — the map's `models` is the accepted set, not a single choice);
- set `deep-reasoning.live_binding` to `deepseek-v4-1-flash@deepseek`, and update that class's
  `note` — the note is what the generator renders into the `.md`, so leave it and the map prose
  will still say the binding is `gpt-6-sol@azure` (step 2 makes the registry agree).

```bash
node host/scripts/gen-agent-routing-class-map.mjs
node host/scripts/check-model-class-map-drift.mjs
node host/scripts/check-classifier-pin-drift.mjs
```

All three green. **The pin does not move** — it still binds `deep-reasoning` and resolves
through `opus` / `claude-opus-5`, which stays listed. A model added to the class is not a re-pin.

## 2. Registry — make `deep-reasoning` resolve to `deepseek-v4-1-flash@deepseek`

**This is a data migration, not a config edit, and it is the load-bearing half.** Runtime
resolution is `capability_grants ∩ live model_class_eligibility ∩ blessed`
(`host/src/model-registry/class-resolver.ts`) — **`model_class_bindings` is history, not the
resolver.** So moving the class is the same all-three-legs replace-set transaction as 0517 /
0518 / 0519; those three migrations are the template. Generate it with the repo's own tooling
(`generate-migration`), give it the next number, and satisfy the ADR-008 integrity block.

1. **Rebind (append-only).** Supersede the live platform-wide `deep-reasoning` binding
   (`gpt-6-sol@azure`), insert `deepseek-v4-1-flash@deepseek`. Order is load-bearing: the
   rebind runs before any deprecation, because `model_class_bindings_blessed_gate` (0476)
   fires on the supersede `UPDATE`.
2. **Grandfathered eligibility.** Admit `deepseek-v4-1-flash@deepseek` to `deep-reasoning` via
   the 0513 `source_binding_bound_at` grandfather marker (the 0517/0518/0519 directed branch).
   This is a **recorded violation of ADR-066 decision 5** by owner direction, no eval/cost
   evidence; record it in ADR-066's Consequences and owe the importable evidence via #3048 —
   exactly as 0517/0518/0519 did. It is not a carve-out or a precedent.
3. **Re-rank the effective grants — this is what changes the resolution.** The ranked resolver
   takes the **lowest** rank. Every effective `deep-reasoning` `capability_grants` row that
   names `gpt-6-sol@azure` must move: insert `deepseek-v4-1-flash@deepseek` at **rank 1** and
   demote `gpt-6-sol@azure` to **rank 2** (the unique index is per
   subject/class/rank — 0514). Enumerate every subject 0519 step 4 did: the workspace-class
   defaults **and** any workspace-scoped override.
4. **Keep `gpt-6-sol@azure` blessed and eligible as the rank-2 fallback — do not deprecate it.**
   The 0519 move was deprecate-when-unused; here we want deepseek primary and gpt-6-sol a
   reversible escape hatch, and it avoids re-reversing a two-day-old blessing. If the owner
   instead wants it deprecated, mirror 0519 exactly and say so — but the default is keep.

0514's deferred gates (`capability_grants_deployment_resolvable_gate`,
`model_class_eligibility_removal_resolvable_gate`,
`model_deployments_blessing_removal_resolvable_gate`) judge only the transaction-final state,
which is exactly why this is one replace-set transaction. Deploy prerequisite: none new —
`deepseek-v4-1-flash@deepseek` is already blessed + gateway-opted-in (0517) and already serves
`general`/`engineering`, so `INFERENCE_GATEWAY_DEEPSEEK_CREDENTIAL` is live.

**Consequence to state, not discover:** this moves the roles classed `deep-reasoning` —
including `code-critic` and `investigator` — off `gpt-6-sol` and onto deepseek for the duration.
That is the point of the run, but it is a behaviour change on the review/hypothesis roles, so
say it in the PR body.

## 3. Records note + review-log row

`docs/agent-routing-records.md` §1 is tier→capability class (no models). Add a contested-call
note:

> - **`deep-reasoning` resolves to DeepSeek V4.1 Flash, 2026-09-24 — owner call, no outcome
>   evidence.** Greg's bounded calibration run across every tier. The class's live selection
>   moves `gpt-6-sol@azure` → `deepseek-v4-1-flash@deepseek` (append-only rebind; `gpt-6-sol`
>   kept blessed + eligible at rank 2 as a fallback), admitted via the 0513 grandfather as a
>   recorded ADR-066 decision-5 violation (evidence owed #3048). Falsifier: a botched
>   silent-boundary implementation, or a `code-critic` / `investigator` regression. Revisit at
>   the next triage re-sync; revert is the mirror replace-set back to `gpt-6-sol@azure`.

Add the matching review-log row.

## 4. Re-sync the policy (1.15.0 → 1.16.0)

`templates/agent-routing.md` → `docs/agent-routing.md`, byte-identical (`diff -q` clean). The
delta is the `impl:human` clarification plus a changelog row. Your policy has been class-based
since #3098, so nothing else moves.

## 5. CLAUDE.md routing section — step 2

In the `## Agent routing` section of `CLAUDE.md`, replace:

```
2. If the tier exceeds your capability class, do not implement. Comment with what you
   would need, and stop.
```

with:

```
2. If the tier exceeds your capability class (`standard` / `frontier`), do not implement.
   Comment with what you would need, and stop. `impl:human` is not a capability gate: any
   class may prepare the change, but no agent completes it unilaterally — a human owns the
   irreversible step and the merge.
```

## Verifiable outcomes

- [ ] `docs/agent-routing-class-map.json` lists `deepseek-v4-1-flash` under `deep-reasoning`
      with `live_binding: deepseek-v4-1-flash@deepseek`; the `.md` is regenerated and
      `check-model-class-map-drift.mjs` is green.
- [ ] `node scripts/check-classifier-pin-drift.mjs` is green (pin unchanged, still `deep-reasoning`).
- [ ] **The registry resolves the class to deepseek** — verified by effect, not by grep:
      - SQL shows deep-reasoning's effective candidate set with `deepseek-v4-1-flash@deepseek`
        at rank 1 and `gpt-6-sol@azure` at rank 2;
      - a dispatch of a `deep-reasoning`-classed role (or `model_strategy: all-deep-reasoning`)
        resolves to `deepseek-v4-1-flash@deepseek` — observe the resolved `deployment_id`.
- [ ] The migration applied with ADR-008's integrity block passing and 0514's deferred gates
      not firing; ADR-066 Consequences carries the 2026-09-24 decision-5 violation.
- [ ] `diff -q templates/agent-routing.md docs/agent-routing.md` is clean at v1.16.0.
- [ ] `CLAUDE.md` step 2 carries the `standard` / `frontier` vs `impl:human` split.

## What this is not

- Not a capability reassessment — an owner-directed calibration run, recorded as revisitable.
- Not a `human`-tier removal: any class may **prepare** human-tier work; a human still owns the
  merge and the irreversible step, and the agent stops where the work needs human hands.
- Not permanent: the class's selection is append-only history, so reverting is the mirror
  replace-set (`deep-reasoning` back to `gpt-6-sol@azure`) with no evidence loss.
