<!-- template: pull_request_template.md v1.1.0 · updated 2026-08-12 -->
## What this PR does

<!-- One sentence. -->

## Closes

<!-- If this fixes a GitHub issue, write "Fixes #N" here — GitHub closes it automatically on merge. Delete if not applicable. -->

<!-- Delete this section if your repo has no docs/pdr/ -->
## Serves

<!-- Features and epics only. Which bet does this advance? Write "Serves: PDR-NNN".
     If it advances none of them, write "Serves: none — <one-line reason>". That is a
     legitimate answer; saying nothing is not. Delete for bug fixes and chores. -->

## Degradation

<!-- Every fallback, default, retry, swallowed error, widened type, or disabled test this PR
     adds — one line each: what condition triggers it, and what observes it firing.

     Write "Degradation: none" if there are none. That is the common answer and a legitimate
     one; saying nothing is not, because a blank section is indistinguishable from a section
     nobody read.

     If you cannot state a domain condition that triggers it, you do not have a fallback —
     you have a workaround, and the trigger is "I could not get this to work." Stop and ask
     before merging. -->

## Type

<!-- Check the one that applies. Multiple types = multiple PRs (usually). -->

- [ ] ADR
- [ ] Product decision (PDR)
- [ ] Feature
- [ ] Bug fix
- [ ] Migration
- [ ] Scheduled automation / job definition change
- [ ] Documentation
- [ ] Audit remediation
- [ ] Chore / housekeeping

---

## Checklist

**Read [`docs/definition-of-done.md`](../docs/definition-of-done.md) for the full rules. Check every box that applies to your type.**

### All PRs
- [ ] CI passes locally
- [ ] The **Degradation** section above is filled in — every fallback names its trigger and its observer, or it reads `Degradation: none`
- [ ] No verification was weakened to reach green — no assertion removed, matcher loosened, test skipped, or `.only` left behind. If verification did decrease legitimately: a `docs/testing-strategy.md` §6 row names the property that stopped being verified, or the diff carries a `VERIFICATION-DELTA: <reason>` line
- [ ] `CLAUDE.md` updated if it describes something this PR changes
- [ ] No doc section contradicts another in this PR or in linked docs
- [ ] If a CI workflow was added or modified: it is correctly a **gate** (deterministic, blocks merge) or a **probe** (monitors reality, never blocks) — steps sensitive to transient upstream failures belong in probes, not merge gates

### ADR
- [ ] Every lint this ADR promises is wired into CI and passes
- [ ] Existing violations are fixed or explicitly grandfathered with a named tracking issue
- [ ] Status is **Proposed** in the file; moves to **Accepted** only after the above (reviewer confirms)
- [ ] If completing work described in an existing ADR's Consequences: that bullet rewritten in past tense in this PR
- [ ] Any Consequences bullet with forward-looking language ("will be," "future," "pending") has a tracking issue **or** an explicit `WONT-FIX: <rationale>`

<!-- Delete this section if your repo has no docs/pdr/ -->
### Product decision (PDR)
- [ ] Falsifier line present and observable — a date, a named event, or a checkable threshold; not "revisit later"
- [ ] `Confirmed by` names a person, not a role
- [ ] Registered in `docs/pdr/README.md`; `lint:adr-readme-sync` passes
- [ ] Status is **Proposed** unless the falsifier exists and the record is indexed (reviewer confirms)
- [ ] If this supersedes an existing PDR: the old record's Status is flipped in **this PR**, its Context is left intact, and its Decision is not edited in place

### Feature
- [ ] Integration test exists if the path touches a data store
- [ ] Any new "Known Gaps" entry has a severity label and a tracking issue number
- [ ] If this closes a tracked issue: `Fixes #N` is in the **Closes** section above
- [ ] If this PR closes an issue: searched the docs for `#N` and updated any stale references pointing to it
- [ ] <!-- delete if no docs/pdr/ --> `Serves: PDR-NNN` is in the description — or `Serves: none` with a one-line reason

### Bug fix
- [ ] Regression test at the same level the bug manifested (unit or integration)
- [ ] Root cause in commit message — what assumption was wrong, not just what changed
- [ ] If bug exposed a missing lint: lint ships here OR a P0 issue is filed and linked
- [ ] `Fixes #N` is in the **Closes** section above

### Migration
- [ ] Post-migration integrity check if the SQL is data-manipulating
- [ ] If a new schema pattern is introduced: consuming code path has an integration test, or a P0 issue is filed
- [ ] If an enforcement-bearing schema element is added (access policy, rate-limit/lifecycle column, tenancy flag): consuming code ships here, or the element is registered as dormant with a tracking issue

<!-- Delete this section if your repo has no scheduled automation -->
### Scheduled automation / job definition change
- [ ] Every tool, command, or resource the definition references exists and is active
- [ ] Schedule expression written in the timezone the scheduler parses it in; any description states the same schedule
- [ ] Job is idempotent per period; produced artifacts are verified to exist before the job reports success

### Documentation
- [ ] Every file path, function name, command, and issue number cited verified to exist
- [ ] No contradictions with other sections in the same doc or linked docs
- [ ] Planned features marked `(planned)`, not present-tense
- [ ] If adding a watch-item doc (`docs/watch-items/`): every **Watch list** line includes a specific revisit condition or date, not just "revisit later"

### Audit remediation
- [ ] Checked out the audit branch (`audit/YYYY-MM-DD`), not master/main
- [ ] Every P0 finding from the audit doc is fixed in this PR
- [ ] Every P1 finding has a filed tracking issue cited inline in the audit doc, or is fixed in this PR
- [ ] Every P2 finding has a WONT-FIX rationale inline in the audit doc, or is fixed
- [ ] Audit doc updated — each finding has a `**Disposition:**` line (RESOLVED / FILED #N / WONT-FIX)
- [ ] Stale issue sweep run — open issues fixed by merged PRs are closed
- [ ] All changes are on the same branch as the audit doc (single PR)

### Issue close (if this PR closes one)
- [ ] `Fixes #N` or `Closes #N` is in the **Closes** section above — GitHub closes the issue automatically on merge
- [ ] All deliverables in the issue are done, or remaining items are filed with severity and linked in a comment
