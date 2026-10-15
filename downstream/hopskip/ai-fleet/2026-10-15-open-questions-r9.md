# The `## Open questions` / `## Not in scope` sections, routing-lint R9 and the pickup stop condition — ai-fleet (2026-10-15)

**Client:** Hopskip (internal)
**Source:** repo-governance — `templates/issue-authoring.md` v1.5.0, `templates/scripts/check-issue-routing.mjs` v1.5.0 (R9), `templates/agent-routing.md` v1.18.0, `templates/definition-of-done.md` v1.8.0. Shipped upstream in PR #121 (issue #118) and PR #124 (issue #123).
**Scope:** ai-fleet only, per PDR-010 Consequences 4 ("ai-fleet first, the other governed repos after one clean weekly sweep"). Delivers the `## Open questions` and `## Not in scope` schema sections, the routing-lint rule that catches an issue saying ready while it lists open questions, and the pickup stop condition that makes the same contradiction stop an agent at pickup rather than mid-implementation. **One downstream prompt for ai-fleet; do not fan out to the other repos here.**

> **This is the delivery end of HopSkipInc/ai-fleet#3746.** Its pre-commit lifecycle defines
> Ready as "nothing open under `## Open questions`", and the spec-interview skill (#119)
> writes into those two sections. Both halves need this install behind them first.
>
> **Read the template stamps, don't trust the numbers in this header.** `agent-routing.md`
> was **1.17.0** when this prompt was specified; issue #123 (the `capability class` rename,
> merged 2026-10-15) bumped it to **1.18.0**. Install whatever the template stamps *today*,
> byte-identical — never an older named version.

---

## 1. Corpus check first — before anything is installed

A detector has to know the house convention (repo-governance CLAUDE.md gotcha). Line-scan
ai-fleet's **open and closed** backlog before installing, and adjust this prompt if the house
convention differs from the one R9 assumes.

```bash
gh issue list --repo HopSkipInc/ai-fleet --state all --limit 2000 \
  --json number,title,state,labels,body > /tmp/ai-fleet-backlog.json

node -e '
const issues = JSON.parse(require("fs").readFileSync("/tmp/ai-fleet-backlog.json","utf8"));
// R9 heading regex (check-issue-routing.mjs v1.5.0): singular/plural, optional trailing "(N)"
const heading = /^##[ \t]*Open questions?(?:[ \t]*\([^)]*\))?[ \t]*$/im;
const nearMiss = /^##.*(question|open item|tbd|TODO).*$/im;
const section = (b) => { const m = b.match(heading); if (!m) return null; const rest = b.slice(m.index + m[0].length); const end = rest.search(/^##\s/m); return end < 0 ? rest : rest.slice(0, end); };
const items = (s) => (s.match(/^[ \t]{0,3}(?:[-*]|\d+\.)[ \t]+\S/gm) || []).length;
const readyByLabel = (l) => l.some(x => x.name === "status:ready");
const readyByText  = (b) => /^##[ \t]*Status[ \t]*\n+ready\b/im.test(b) || /^-{3,}\s*ready\b/im.test(b);
let withSection = 0, open = 0, ready = 0, near = [];
for (const i of issues) {
  const s = section(i.body || "");
  if (s !== null) { withSection++; const n = items(s); if (n) open++; if (n && (readyByLabel(i.labels) || readyByText(i.body))) { ready++; console.log("READY+R9", i.number, i.state, n + " item(s)"); } }
  else if (nearMiss.test(i.body || "")) near.push(i.number);
}
console.log(`issues=${issues.length} withSection=${withSection} withOpenItems=${open} sayingReady=${ready}`);
console.log("near-miss headings (inspect by hand):", near.slice(0, 20).join(", ") || "none");
'
```

**Report the census** in the PR body — counts, the headers that are near-misses, the list
shapes used (bullet vs numbered), and whether ready is asserted by label or by `## Status`
text. **If the house convention differs from what R9 assumes** (a different heading, a
different list shape, ready asserted a third way), **stop and adjust this prompt before
installing** — do not narrow the lint to fit, and do not install and hope. The three facts
that set R9's regex (2026-10-08 census of repo-governance's own 40 issues) are: nobody had
ever ticked a `- [x]` box, so the rule counts *presence* of items, not checkbox state; one
real section was a numbered list, so numbered items count; and an `## Open questions (2)`
suffix must be seen, or the rule silently passes.

## 2. Synced installs (byte-identical — do not adapt)

- **`scripts/check-issue-routing.mjs` → v1.5.0**, byte-identical into the declared install
  path (`scripts/`). It is cumulative — this install subsumes the declared 1.4.0.
  **Do not re-wire the open pass.** It already probes weekly in
  `.github/workflows/routing-open-pass.yml` (Monday 08:15 ET, probe, never a PR gate); R9
  rides that existing sweep. The closed pass (`routing-closed-pass.yml`) is unchanged.
  **Do not copy the upstream fixture suite** — `docs/testing-strategy.md` declares root
  `scripts/` synced governance tooling "verified upstream by repo-governance's own fixture
  tests" (same stance as `check-epic-handoff.mjs`); a local duplicate is a second artifact to
  drift, not coverage.
- **`docs/agent-routing.md` → the current template stamp** (1.18.0 as of 2026-10-15;
  1.17.0 when specified), byte-identical into the declared path. Read the installed
  version first, then the template, and confirm the template is not behind. This install
  delivers the **pickup stop condition** (1.17.0) *and* the **`capability class` rename**
  (1.18.0) — see the overlap note in step 4.

## 3. Hand-ports into the Adapted files (do **not** `cp`)

`docs/issue-authoring.md` and `docs/definition-of-done.md` are Adapted here, not synced — port
the deltas by hand from the current templates (`issue-authoring.md` v1.5.0, `definition-of-done.md` v1.8.0).

- **`docs/issue-authoring.md`** — add the two schema sections to the canonical schema block,
  verbatim:

  ```
  ## Not in scope
  <optional — what this issue deliberately excludes, one line each with the reason>

  ## Open questions
  <optional — one list item per undecided decision or unverified fact. Resolve one by
   moving its answer into the body; an issue that says ready lists nothing here.>
  ```

  Add the rules bullet that makes ready and open-questions mutually exclusive ("An issue
  that says it is ready lists nothing open under `## Open questions`…"), and add the R9 row
  to the validator-rules table:

  > | Says ready (`status:ready`, or `## Status` beginning `ready`) + an open item under
  > `## Open questions` | contradiction — ready to be *decided*, not worked (R9) |
- **`docs/definition-of-done.md`** — add the *Structure at creation* row:

  > - [ ] If it **says ready** (`status:ready`, or a `## Status` line beginning `ready`):
  > nothing listed under `## Open questions` — an open question is a `status:needs-decision`
  > gate; resolve it by moving the answer into the body

## 4. The stop condition — CLAUDE.md **and** AGENTS.md

- **`CLAUDE.md` §Agent routing, item 4.** Add the new stop bullet, from the installed
  `agent-routing.md` §*Observable stop conditions*:

  > - The issue lists anything open under `## Open questions` — it is undecided, whatever its
  >   status says.

  **While you are there:** item 4 in this repo's CLAUDE.md is also missing the two 1.12.0
  bullets ("coding around a blocker instead of removing it"; "weakening a test, assertion,
  or matcher to reach green") that never landed. Reconcile item 4 to the installed template's
  own `## CLAUDE.md / AGENTS.md section` block rather than adding one bullet to an already-stale
  list — it is the same edit site.
- **`AGENTS.md`.** opencode reads `AGENTS.md`, and this repo has no `## Agent routing` section
  there today (it defers wholesale to CLAUDE.md). Add a compact `## Agent routing` note carrying
  the same stop-condition list (or at minimum the new bullet), pointing to CLAUDE.md §Agent
  routing for the rest — the same shape AGENTS.md already uses for System map and the closing
  contract (authoritative source named, the must-not-be-missed rule repeated).
- **Overlap (record, do not expand):** installing `agent-routing.md` 1.18.0 settles the term
  rename of **#2571** — the mirrored text you take from the template's block is already
  `tier` / `model capability`. If the CLAUDE.md mirror still says "capability class", that is
  this step doing its job. The *#2571* glossary "Known drift" paragraph is retired on the
  ai-fleet side separately; it is not part of this prompt's file set.

## 5. Declare and record

In `CLAUDE.md`:
- Bump the Synced-templates rows: `scripts/check-issue-routing.mjs` → **1.5.0**,
  `docs/agent-routing.md` → the installed stamp. Leave the probe-wiring note on the
  `check-issue-routing.mjs` row (it rides `routing-open-pass.yml`).
- Append an `## Applied governance updates` entry naming: the step-1 census numbers, the
  two hand-ported Adapted files, the R9 rule now live, the stop condition in both harness
  files, and the #2571 overlap if the rename rode along.

## Not in scope

- Prompts for analytics-infrastructure and enrichment-pipeline — after ai-fleet runs one
  weekly sweep with R9 and no false positives (PDR-010 Consequences 4).
- Promoting R9 from WARN to ERROR — #118's own rule: after a sweep with no false positives.
- Applying this in ai-fleet from here — that happens in an ai-fleet child of #3746.

## Verification (observe the effect, not the file)

1. **The census line, on the live backlog.** `node scripts/check-issue-routing.mjs` prints
   the R9 census line:
   `Open-questions census: N issue(s) carry an ## Open questions section — M with open items #…, K of them saying ready #….`
   and an `R9 …` finding per issue that says ready with open items. **A grep of the files
   this prompt wrote does not count.** The census must come off the installed v1.5.0 script
   against ai-fleet's own GitHub backlog.
2. **R9 can fail.** Construct — on a scratch issue you then close — an issue carrying
   `status:ready` and one bullet under `## Open questions`; confirm R9 fires on it with the
   `says ready (…) with N open item(s)` text. A rule that cannot fail is the failure this
   whole framework exists to catch; do not promote R9 to ERROR until a real sweep is clean.
3. **The stop condition is live in both harness files.** `grep -n "Open questions" CLAUDE.md
   AGENTS.md` shows the bullet in each; the mirrored §Agent routing text reads `tier` /
   `model capability`, not `capability class`.
4. **Byte-identity held.** `diff` the installed `scripts/check-issue-routing.mjs` and
   `docs/agent-routing.md` against the templates — identical, with the installed stamps.
