# Governance Maintenance — DeepSeek V4.1 Flash across every tier — 2026-09-24

**Applies to:** HopSkipInc/analytics-infrastructure, HopSkipInc/enrichment-pipeline
**Client:** hopskip
**Source:** repo-governance `agent-routing` v1.16.0, `agent-routing-records` v1.1.0
**Kind:** owner-directed routing calibration — DeepSeek V4.1 Flash across every tier

Owner direction, 2026-09-24: DeepSeek V4.1 Flash (`deepseek-v4-1-flash`, opencode route
`deepseek/deepseek-flash`) runs against **all tiers** for a bounded period. Neither repo's
records list it, so the advisory gate stops it at `impl:frontier`. This change places it on
`frontier` and carries the policy 1.16.0 clarification that `impl:human` gates **completion,
not preparation**.

**This is a calibration run, not a capability reassessment.** There is no outcome evidence for
deepseek at frontier grade — the placement sits beside the kimi-k3 / gpt-6-sol unevidenced rows
in the portfolio. The falsifier is a botched silent-boundary implementation. Record it as
revisitable.

---

## 1. Records §1 — model→class

Add `DeepSeek V4.1 Flash` to the `frontier` row in `docs/agent-routing-records.md`, dated
2026-09-24 (leave every standard-row model where it is):

- **analytics-infrastructure** — `| frontier | claude-opus-5, kimi-k3 | 2026-08-01 |` →
  `| frontier | claude-opus-5, kimi-k3, DeepSeek V4.1 Flash | 2026-09-24 |`
- **enrichment-pipeline** — the `frontier` row (currently
  `Claude Opus 5 · Claude Opus 4.x · Gemini 2.5 Pro (Deep Think)`, 2026-07-27) gains
  `DeepSeek V4.1 Flash`, dated 2026-09-24.

Then add a contested-call note beneath the table, and a review-log row:

> - **DeepSeek V4.1 Flash placed on `frontier`, 2026-09-24 — owner call, no outcome evidence.**
>   Greg's bounded calibration run across every tier; placed on judgment, not observed outcomes,
>   same posture as the kimi-k3 row. Falsifier: a botched silent-boundary implementation.
>   Revisit at the next triage re-sync; do not let it become the permanent default without
>   evidence.

## 2. Records §2 — model→harness route

Add one row to the route table:

```
| DeepSeek V4.1 Flash | — | `deepseek/deepseek-flash` |
```

(`—` in the Claude Code column: the harness does not reach it.)

## 3. CLAUDE.md routing section — step 2

In the `## Agent routing` section of `CLAUDE.md`, find the equivalent of:

```
2. If the tier exceeds your capability class, do not implement. Comment with what you
   would need, and stop.
```

and replace it with:

```
2. If the tier exceeds your capability class (`standard` / `frontier`), do not implement.
   Comment with what you would need, and stop. `impl:human` is not a capability gate: any
   class may prepare the change, but no agent completes it unilaterally — a human owns the
   irreversible step and the merge.
```

## Verifiable outcomes

- [ ] §1 lists `DeepSeek V4.1 Flash` under `frontier`, dated 2026-09-24, with the contested-call
      note and a review-log row.
- [ ] §2 carries the `deepseek/deepseek-flash` route row.
- [ ] `CLAUDE.md` step 2 carries the `standard` / `frontier` vs `impl:human` split.

## Scope note — the policy file

Both repos are behind on the synced policy (analytics 1.9.0, enrichment 1.14.0), and the
1.10.0–1.16.0 re-sync is already owed as a pending routing re-sync row in the governance
ledger. **This change carries only the step-2 clarification into `CLAUDE.md`** and leaves the
`docs/agent-routing.md` re-sync to that ledger row — do not bundle a full policy re-sync here.
When the re-sync lands, the records' stated policy version catches up.

## What this is not

- Not a capability reassessment — an owner-directed calibration run, recorded as revisitable.
- Not a `human`-tier removal: any class may **prepare** human-tier work; a human still owns the
  merge and the irreversible step, and the agent stops where the work needs human hands.
