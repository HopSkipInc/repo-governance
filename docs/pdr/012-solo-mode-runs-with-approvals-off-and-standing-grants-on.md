# PDR-012: Solo mode runs with approvals off and standing grants on

**Status:** Accepted
**Date:** 2026-11-13
**Confirmed by:** Greg Leizerowicz
**Last confirmed:** 2026-11-13

---


## Context

**The practice is one developer moving quickly.** HopSkipInc has no second engineer with merge
rights, no on-call rotation, and no separation of duties to protect. The approval gates the
governance layer inherited from a team-shaped practice therefore cost a manual step per
production change and buy a second opinion that does not exist. Analytics-infrastructure's
qasbx/demo required-reviewer gate is absent today (ADR-050; #1301 files the absence as a defect
to restore), and ai-fleet's release chain promotes `dev → qa → demo → production` with no
approval stage at all (ADR-097). Both are working as the practice actually operates.

**The policy could not say that.** PDR-011's 2026-11-13 amendment made a gate record *who
decides, never who types*, but it left one reading intact: an approval step that is missing is
a defect, and the next agent should restore it. That reading is wrong for a solo practice, and
it has a concrete failure mode — an agent reads #1301, restores the required reviewers, and
silently adds a step the owner had deliberately removed, or keeps a `gate:human-approval` open
on work whose only human step is an environment approval nobody is required to give.

**Removing an approval is still a decision, and it needs a record.** "No one is available to
approve" is a fact about the practice, not a licence to drop every control. The gates that guard
irreversible or externally binding acts still have a person behind them: the owner. The
question this record answers is which gates the solo posture switches off, which stay, and
where the current answer lives so no one has to infer it from an absent setting.

## Decision

**1. Approval posture is a recorded state, per repo.** Each governed repo records one of
`reviewed` or `solo` under `## Approval posture` in `docs/agent-routing-records.md` — the
repo-local records file that never syncs. The record carries: the posture, who set it, the
date, this PDR as the decision, the re-enable trigger, the hard core, the standing grants, and
the substitute controls. The record is the value; this PDR is the argument. Changing the value
is one owner edit to that section, not a code change.

**2. In `solo`, approvals are off and standing grants replace them.** No GitHub Environment
required reviewers on any environment. An automated deploy or promotion takes no
`gate:human-approval` — it is inside the merge path. Repeatable production operations
(configuration, flags, service-scoped key rotation) are authorized once by a standing grant in
the posture record, and the agent executes them without per-action approval.

**3. The hard core stays gated, even in `solo`:**

- irreversible production data deletion, drop, or rename;
- money movement, external contracts, and legal commitments — and `gate:decision` generally,
  because a PDR/ADR is owned by a person;
- a credential the org deliberately does not delegate to a service identity.

These may be approved asynchronously and need not block a deploy. An agent never removes a
person-set gate on its own; in solo mode the owner may authorize one batch to clear
`gate:human-approval` labels whose only step was an environment approval, and that
authorization is recorded with the batch.

**4. An absent approval in `solo` is expected, not a defect.** The audit, the routing
classifier, and any agent reading the repo must read the posture before filing a missing
required-reviewer gate as a finding. Restoring the gate in a `solo` repo is a posture change,
not a fix.

**5. Removing the approval moves the safety net; it does not remove it.** A `solo` record is
valid only while these controls hold: CI on every change, a post-deploy smoke check that
observes the effect, a tested backup and rollback path for anything reversible, and the
evidence attached to the PR. A repo that turns approvals off without these is not in solo
mode; it is uncontrolled, and that is a finding.

**6. Re-enablement has a trigger, not an expiry.** The record names the condition that ends
solo mode: a second engineer with merge rights, the first paying client live, or a production
incident whose cause a second reviewer would have caught. "Indefinitely" means until one of
those fires, not never.

## Falsifier

- [ ] Revisit by 2027-05-13 when a second engineer has merge rights on any governed repo, the
  first paying client is live, or a production incident occurs whose cause a second reviewer
  would have caught.

## Consequences

- **Authorizes** the posture section in `agent-routing.md` 1.27.0, the blank section in
  `templates/agent-routing-records.md` 1.3.0, and the adoption prompts that record `solo` in
  ai-fleet and analytics-infrastructure first.
- **Forecloses** restoring a required-reviewer gate in a `solo` repo without changing the
  posture on the record; that is a decision, not a maintenance task. It also forecloses a
  `solo` label that drops the hard core or the substitute controls.
- **Downstream:** every governed repo records its own posture; the value is local and never
  syncs. ai-fleet's release chain already matches `solo`; analytics-infrastructure's #1301 is
  superseded by the posture rather than restored.
- **Stops:** the audit and the routing classifier from treating an absent environment approval
  in a `solo` repo as a finding.
