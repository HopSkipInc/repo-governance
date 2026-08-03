# AI Growth Story — Evidence Spine

**Snapshot:** 2026-07-23 · **Updated:** 2026-08-02 (fourth excavation: `repo-governance`; post-fix audit pulse) · **Status:** spine complete; frame recommended (decision OPEN)

This is the single, audience-blind evidence backbone for HopSkip's AI growth story.
Both intended tellings — an **internal-candor** version and an **investor-trajectory**
version — derive from *this* set of facts. Integrity rule: if the two versions can't
be built from an identical spine, the story isn't honest. Warts are first-class here,
not footnotes.

Receipts (commit SHAs, migration numbers, dated artifacts) are in [`evidence.md`](evidence.md).

---

## 1. Frame (recommended — decision OPEN)

**Thesis:** HopSkip is becoming AI-native in *how it builds and runs the company*, not
(yet) in *what it sells*. **Converted, not born.**

- The **origin claim** ("architected around AI from day one") is false and should be
  conceded openly — HopSkip was founded ~2019; all three AI-era repos are net-new
  (mid-2025 onward) and sit alongside a legacy core product that lives elsewhere.
  Conceding this is a credibility move, not a weakness.
- The **structural claim** ("AI is load-bearing in how we operate") is earnable, and
  the evidence supports it — on the operations/engineering axis more than the product axis.

Three candidate emphases (pick one at the revisit):

| Emphasis | Case | Risk |
|----------|------|------|
| **Operations/engineering-first (RECOMMENDED)** | Lead with the rare, receipted claim that the engineering org runs on its own agents. Concede product-AI is early/off-the-shelf. | Hardest to fake; survives diligence. |
| Balanced three-axis | Weigh product, operational, and engineering AI roughly equally. | Most complete, less punchy, more surface area to defend. |
| Product-first | Lead with semantic search / enrichment / the sourcing agent. | Conventional and expected, but the weakest and earliest evidence — highest diligence risk. |

## 2. The maturity ladder

Placement is *on this ladder*, not a claim to the top. A company can sit at different
rungs on different axes.

- **L0 Experimenting** — demos, no production AI.
- **L1 AI-augmented** — an LLM bolted onto an otherwise-traditional system as a feature/tool.
- **L2 AI-enabled foundation** — data/infra deliberately rebuilt so AI can be first-class.
- **L3 AI-native operations** — the company's own work runs on its agent platform (dogfooding, self-governance).
- **L4 AI-native by birth** — architected around AI from day one. Unreachable for a 2019 company — and that's the honest ceiling.

## 3. Timeline spine

The maturity ladder maps onto the calendar: the three repos were born in L1 → L2 → L3 order.

| When | What the commits show | Receipt |
|------|-----------------------|---------|
| ~2019 | HopSkip founded; core product predates the AI era (outside these repos) | — |
| 2025-06-27 | `enrichment-pipeline` born — commit #1 is a 2-line README; **AI absent at birth** | `867a0953` |
| 2025-08-24 | Imported a 786-file "swarm agent / hive-mind" hype scaffold from a prior repo — almost no working product code | `41239b33` |
| 2025-09-09 | First real product AI: autonomous Gemini venue-attribute enrichment | `1e2b74e3` |
| 2025-10 → 11 | Full Python→.NET rewrite + Gemini Batch cost engineering ($1k→$500/mo); the hype scaffold **deleted** | `90c4b658`, `3a04c45f` |
| 2026-02-19 | `analytics-infrastructure` born as an ADF/Fabric killer | `d904764` |
| 2026-02-27 | Semantic search (vector embeddings) by **day 8** | `462bffd` |
| 2026-03-03 | Pivot to managed Azure AI Search (self-built SQL VECTOR columns killed after a 5-day life) | `527c5e4` |
| 2026-03-15 | `ai-fleet` born (seeded from a research prototype) | `adf74b94` |
| 2026-03-26 | `analytics` grants `ai-fleet`'s managed identity DB read access — **the foundation starts feeding the platform** | `c7b4368` |
| 2026-04 | `ai-fleet` explodes — **514 commits in one month** | — |
| 2026-05-14 | "Agents are data" formalized (ADR-002) — **mid-stream, not day one** | `2954a7d7` |
| 2026-05-20 | `repo-governance` hub born in the founder's personal account — "initial: DoD and audit governance templates," **six days after the ADR batch**, with ai-fleet's own ADR numbering preserved in the template paths (extraction, not imposition); the `gtm/` product-seed folder lands the same day | `2f02c9e`, `2c222fd` |
| 2026-05-29 | `audit-fleet` cron machine — `ai-fleet` begins auditing **itself** | `0c45ce9d` |
| 2026-06-10 | `audit-data-platform` — `ai-fleet` begins auditing **`analytics-infrastructure`** | `1e06121e` |
| 2026-06-10 → 15 | First formal governance sync **from** ai-fleet into the hub (35 proposals extracted; 36/36 accepted on review); hub-and-spoke distribution born 06-14 (`downstream/` prompts + `_client.md` ledger) | `3ccb073`, `68ad9c6`, `f193140` |
| 2026-06-13 | `audit-enrichment-pipeline` — `ai-fleet` begins auditing **`enrichment-pipeline`** | — |
| 2026-06-11 → 07-04 | Audits run with **real spend**: $47.13 (#941), $45.27 (#975), $70.87 (#1118), $43.57 (#1131), $61.03 (#1154) | `audit-2026-07-20-investigation.md` |
| **2026-07-06 → 07-20** | **The 16-day silent outage** — durable-substrate migration 0295 drops the cost cap to $3 (real cost $40–70), and a hardcoded `master` branch default breaks the two `main` repos; the `audit-deadman` watchdog misses it; caught by manual investigation (last good audit 07-04) | `audit-2026-07-20-investigation.md` |
| 2026-07-17 → 19 | Customer-facing safety (L1/L2/L3 guards), RLS isolation (#1253), B2C auth all land — **brand new, unproven** | `b78ac401` |
| 2026-07-21 → 27 | **Audit machines fixed and resumed** (0337/0338; artifacts 07-22/23 in `ai-fleet`, 07-23 in `analytics`, 07-23/27 in `enrichment`); the first post-outage enrichment audit **catches and remediates a 16-day-old governance-sync drift the hub's ledger had marked "applied"**; audit lifecycle reworked to two-phase 07-27 | `docs/audits/`, enrichment `a0e7bd11` |
| 2026-07 | Velocity cooling (157 vs 514/mo) as focus shifts to a customer demo/POC | — |
| 2026-08-02 | `repo-governance` **transferred into HopSkipInc** — the engineering constitution moves inside the company org, 2.5 months after being born personal | GitHub transfer; `da567db` |

## 4. Honest placement

| Repo | Rung | Verdict |
|------|------|---------|
| `enrichment-pipeline` | **L1** (top of band) | Gemini is the value core (no Gemini, no product) but structurally it's one LLM call in a classic ETL (timer→queue→processor→DB→webhook). `ConfigurableAttributeExtractor` is explicitly *"agent-agnostic"* — **zero** tool-calling/agentic code; "AgentEnrichment" is a misnomer. The transformation burst is over (maintenance mode since early 2026). The finished first chapter. |
| `analytics-infrastructure` | **L2** (floor) | Foundation genuinely rebuilt so AI can be first-class — embeddings/HNSW as core infra, prod semantic search on `hs-data-search-prod`, and **dated cross-repo wiring** to the agent platform (2026-03-26 MI grant; tenant-safe concept docs, ADR-015). But ~70% conventional data warehouse; the semantic layer is off-the-shelf (Azure does the embedding); near-solo; governance ported wholesale, heavier than headcount. |
| `ai-fleet` | **L3** (qualified — internal ops only) | Agents-are-data holds in current code (no `agents/` folder; agent rows in seed migrations); single inference path (GenericRunner); governance primitives are load-bearing; and the platform demonstrably governs all three repos via **deployed cron audit machines with real spend**. That clears the L3 bar *for internal operations*. But it's internal dogfooding (customer-facing is L1/demo), it's fragile (the 16-day outage), safety/isolation is ~one week old, and it's essentially one human + AI agents. |
| `repo-governance` | **standards layer** (not a rung) | The governance hub, born 2026-05-20 in the founder's personal account (transferred in 2026-08-02): 44 versioned template artifacts, 21 downstream prompt files, a 31-row distribution ledger, **79 passing tests for its own lint tooling**. Provably **extracted from** ai-fleet's working practice and redistributed as agent-executable prompts ("Paste this into Claude Code…"). Completes the L3 loop — but distribution is hand-cranked, and the hub audits everyone except itself. |

**Company verdict:** *L3 in internal operations, L2 in data foundations, L1 in product —
every rung real, every rung early, all of it essentially one-person-deep. Not L4, never
will be.*

## 5. The four load-bearing receipts (hardest to fake)

1. **Self-governance with a P&L.** `ai-fleet`'s own agents open audit PRs against all
   three repos on a weekly schedule, with real spend ($43–71/run: #941, #975, #1118,
   #1131, #1154) and 17+ dated audit artifacts in each spoke's `docs/audits/` (2026-05-18
   → 07-27, post-outage resumption included). First-hand-verified against
   `audit-2026-07-20-investigation.md`. The company literally governs its own code with
   its own agents.
2. **The org is already substantially AI-run.** AI agents authored **44% of
   `ai-fleet`'s commits** (NanoClaw 623 + Claude/bots) and **38% of
   `enrichment-pipeline`'s**. (`analytics` is the exception — ~97% one human.) This is
   the "we build *with* AI" axis, and it's measurable.
3. **One nervous system, dated.** The 2026-03-26 cross-repo MI grant + tenant-safe
   concept docs prove the three repos are wired together in production, not conceptually.
4. **The loop closes: standards as code → platform as data → enforcement as agents →
   drift-watch as probes.** The standards the audit machines grade against live in
   `repo-governance` as versioned, **tested** templates (79/79 passing, re-run live during
   the 2026-08-02 dig), distributed as agent-executable prompts with grep-able verifiable
   outcomes. End-to-end proof, warts included: the hub's ledger falsely marked
   enrichment's 2026-07-07 sync fix "applied" — and it was the **first post-outage audit
   run (07-23)** that caught and remediated the drift (`a0e7bd11`). Governance is
   affordable at one-person scale *because* it is code operated by agents — the inversion
   of the "governance theater" critique.

## 6. The warts (in both flavors)

- **Bus factor 1.** Effectively one human (`greghopskip` / `Greg Leizerowicz`) + AI
  agents across all three repos (`ai-fleet` ~845 human commits of 1,505; `analytics`
  ~97%; `enrichment` ~one human + bots). Remarkable leverage *and* stark concentration
  — the same fact.
- **The 16-day silent outage**, and the `audit-deadman` watchdog that was supposed to
  catch it didn't. Caught by manual investigation. Orchestrator observability is a known
  gap (App Insights not wired; `died` runs produced zero logs). Dogfooding is real but immature.
  *(Update 2026-08-02: fixed 07-21 — 0337/0338 — and audits resumed 07-22 across all three
  repos; lifecycle reworked to two-phase 07-27. Sustained-cadence verification stays open.)*
- **The distribution ledger held a false "applied" for 16 days.** The hub's `_client.md`
  marked the 2026-07-07 sync-ownership fix "applied 2026-07-07" for `enrichment-pipeline`;
  it actually landed 2026-07-23 (`a0e7bd11`) — via audit remediation, not the sync process —
  and the ledger row was never corrected (hub HEAD 08-02). Bookkeeping drift inside the
  system that exists to prevent bookkeeping drift; the hub's new fail-closed drift lint
  (08-02) flags enrichment as unverifiable rather than fixed.
- **Nobody audits the auditor's rulebook.** The hub ships `scheduled-audit.yml` +
  `audit-deadman.yml` to every spoke and runs neither on itself; no ai-fleet audit machine
  covers it; two of its own drift lints "run **nowhere** … findings nobody sees" (its
  CLAUDE.md's words). Distribution is hand-cranked (prompts pasted per repo). Partly
  self-acknowledged: `docs/mothership-drift-register.md` — "caught by an agent reading
  by hand — luck, not process."
- **Product AI is off-the-shelf and early**; customer safety/isolation is ~one week old and unproven.
- **Governance was retrofitted and ported, not grown** — `enrichment`'s 19 ADRs were
  back-filled in 2026 batches; `analytics`'s framework was copied wholesale from
  `ai-fleet` on 2026-06-10. Heavier than the ~1-person headcount.
- **Even the docs drift from the code** (see §8) — a young/fast tell.
- **Velocity is cooling** as work pivots to a demo.

## 7. The two flavors, one spine

- **Internal (candor):** *"Real prize, fragile grip.* We auto-govern our repos with our
  own agents — and it silently broke for 16 days while a watchdog slept. Priorities:
  fleet-worker reliability, orchestrator observability, bus-factor, and turning internal
  L3 into a customer product."
- **Investor (trajectory):** *"A 7-year-old company converted to AI in ~13 months.* The
  moat isn't a chatbot — it's an engineering org that runs on its own agent fleet
  (receipts: 38–44% AI-authored code; agents that audit our repos weekly with real
  spend). Early and concentrated by design; here's the capital/hiring plan to de-risk
  reliability and turn internal L3 into a customer product."

The 16-day outage appears in **both**: a priority in one, a proof-of-accountability
(with post-mortem) in the other. Same fact, opposite spin, zero contradiction.

## 8. Methodology & confidence

- Built 2026-07-23 from **full git history**. The three working clones were shallow
  (~50 commits) and were unshallowed before analysis: `enrichment` 1,442 commits from
  2025-06-27; `analytics` 450 from 2026-02-19; `ai-fleet` 1,505 from 2026-03-15.
- Excavated per-repo via parallel archaeology (pickaxe term-search for first-AI-code
  dates, first-add dates, per-month velocity, ADR/migration counts). Full dossiers in
  [`evidence.md`](evidence.md).
- **Confidence:** HIGH on dates, counts, and receipts (all spot-checkable). The
  audit-spend climax is first-hand-verified against ai-fleet's
  `docs/audits/audit-2026-07-20-investigation.md`. MEDIUM on a few migration-number
  attributions (sources disagree slightly; the *dates* are consistent).
- **Doc-drift found (part of the story, not corrected here):**
  - ai-fleet's `CLAUDE.md` says the Rust executor "was retired in migration 0138"; the
    excavation places the retirement as a code sweep (`678f6b14`, 2026-05-19) —
    migration 0138 is unrelated.
  - ai-fleet's `CLAUDE.md` referenced `db/migrations/host/` as the migration path; the
    live path is `db/dbmigrations/scripts/migrations/` (per the 0337 fix in the
    investigation doc).
- **Update 2026-08-02:** fourth excavation added — `repo-governance` (102 commits,
  2026-05-20 → 2026-08-02), dug the day the hub was transferred into HopSkipInc, plus a
  post-fix audit pulse across the spokes. The 2026-07-23 baseline is preserved; all
  changes are additive and dated. One candidate finding was corrected during verification
  before publication: enrichment's sync fix *did* land — 16 days late, via audit
  remediation — so the wart is a false-"applied," not a never-applied. Later the same
  day, the story relocated from ai-fleet's `docs/` to this hub, following the transfer.
