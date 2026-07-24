<!-- template: watch-items.md v1.0.0 · updated 2026-07-24 -->
# Watch Items

**Status:** Policy — enforced by periodic audit sweep
**Last updated:** [DATE]

## Purpose

Analysis produces decisions. But not every decision requires immediate action. **Watch items** are findings that are worth tracking but not worth filing as backlog issues — their revisit condition hasn't arrived yet.

The mechanism is **format-based, not topic-locked**. Anything deferred on a condition is a watch item:

- Competitor or adjacent-product findings ("revisit when they reach GA")
- Vendor deprecations ("revisit when the v2 API sunsets, 2027-03-01")
- Regulatory timelines ("revisit when the rule takes effect")
- Scaling thresholds ("revisit when we exceed 100 agents")
- Any decision explicitly deferred rather than made

This template defines:
- Where watch-item docs live
- The watch-list format with required revisit conditions
- How the periodic audit sweeps watch items and renders them as Future items
- When a watch item escalates to a P2 finding

Without this structure, deferred findings either clog the issue backlog with "someday" items or get lost entirely — the analysis is done, the doc is written, and the watch items are never re-evaluated.

---

## Directory convention

Watch-item docs live in `docs/watch-items/`:

```
docs/watch-items/
  YYYY-MM-DD-<slug>.md    ← one per analysis or deferred decision
```

Each file is the output of an analysis session — a competitive analysis (see `templates/skills/competitive-analysis/`), a vendor review, or manual research.

---

## Watch-list format

Every watch-item doc ends with a **Proposed next steps** section. Watch-list items use this format:

```markdown
- [ ] **Watch list:** revisit in [N months] when [condition]
```

**Every watch-list line must include a specific revisit condition or date.** The audit sweep reads these lines to determine whether the item is still on hold or has come due.

Examples:
```markdown
- [ ] **Watch list:** revisit in 3 months when LangGraph reaches GA
- [ ] **Watch list:** revisit in 6 months (2027-01-05)
- [ ] **Watch list:** revisit when we have >100 fleet agents (condition: agent_count > 100)
```

A watch-list line without a condition or date is not actionable — the audit sweep cannot determine if it's due.

A checked-off watch-list line (`- [x] **Watch list:**`) is resolved — the audit never reports it.

---

## Audit sweep behavior

The periodic staleness audit includes a **watch-list sweep** domain that:

1. Scans `docs/watch-items/*.md` for unchecked watch-list lines (grep pattern: `- [ ] **Watch list`)
2. Lists each hit under a `## Future items` section in the audit report, including:
   - The item text
   - Source doc path and date
   - Stated revisit condition
3. Does NOT file issues for items whose revisit condition has not arrived

The `## Future items` section is informational — it keeps watch items visible without cluttering the backlog.

The same sweep also reads PDR falsifier lines from `docs/pdr/*.md` (`- [ ] Revisit by ...`) — a product bet with a check condition is structurally a watch item. See `templates/pdr/`.

---

## Escalation rule

If a watch item's revisit condition **has arrived** (date passed, named external event occurred), the audit raises it as a P2 finding:

> **watch item due — re-evaluate or check it off in the source doc**

Normal P2 carry rules apply: a P2 finding that carries across three consecutive audits without action must be either filed as a tracked issue (assigned, labeled, removed from the audit) or closed as WONT-FIX with explicit written rationale.

---

## Getting started

1. Create `docs/watch-items/` in your repo
2. Add your first watch-item doc following the format above
3. Wire the watch-list sweep into your audit mechanism (see `templates/workflows/scheduled-audit.yml` — add the sweep as a step or append it to the audit prompt)
4. Update `docs/definition-of-done.md` — add the Future items section (see `templates/definition-of-done.md` Audit section)

> **Why the directory is generic:** this started as `docs/competitive-intel/`. The name outlived its accuracy the first time someone wanted to defer a vendor deprecation on a condition — the sweep mechanism didn't care what the topic was, only that the line had a condition the audit could evaluate. Naming a mechanism after its first use case cost a rename across every governed repo.
