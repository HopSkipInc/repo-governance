# AI Growth Story — Excavation Evidence

The receipted per-repo dossiers behind [`spine.md`](spine.md). Built 2026-07-23 from
full git history (repos unshallowed for the dig) via parallel per-repo archaeology;
extended 2026-08-02 with the `repo-governance` dossier, dug the day of its transfer
into HopSkipInc. Each dossier is spot-checkable via the commit SHAs, migration numbers,
and dated artifacts it cites (paths are relative to the repo each dossier covers).
Confidence is HIGH on dates/counts/receipts, MEDIUM on a few migration-number
attributions where sources disagree (dates are consistent).

Placement ladder (see `spine.md` §2): **L0** experimenting · **L1** AI-augmented
bolt-on · **L2** AI-enabled foundation · **L3** AI-native operations · **L4** born-native.

---

## enrichment-pipeline — L1 (the origin, born 2025-06-27, 1,442 commits)

### 1. Timeline & velocity
- **Commit #1 is empty of AI.** `867a0953` (2025-06-27) is a 2-line `README.md`. Then ~2 months dormant.
- **Seeded, not born.** `41239b33` (2025-08-24) "migration from wanderlust repo" — 786 files, +177,838 lines, dumping in a Python pipeline **plus** a `claude-flow`/SPARC "swarm" agent scaffold. Every generic LLM term (`llm`, `prompt`, `embedding`, `openai`, `anthropic`, `vertex`, `gpt`, `claude`) first appears here — overwhelmingly in build-tooling markdown, not product code.
- **Real product AI enters 2025-09-09** (`1e2b74e3`, "Add autonomous hotel attribute enrichment system") — first `gemini` appearance, first working Gemini call, `hotel_attributes` with JSONB per-attribute provenance. Itself "Generated with Claude Code."
- **Velocity (commits/month):** 08/25 148 → 09 208 → 10 281 → 11 **443 (peak)** → 12 86 → 01/26 150 → 02 2 → 03 17 → 04 57 → 05 30 → 06 10 → 07 9. Front-loaded burst; Nov-2025 peak is the Python→.NET rewrite; 2026 collapses to maintenance.

### 2. Pivotal bets (dated)
1. **2025-09-09** (`1e2b74e3`) — Autonomous Gemini enrichment pipeline in Python. AI enters the product.
2. **2025-10-22/23** — Full rewrite to .NET 8 isolated worker (`90c4b658` .NET scaffold; `83bc4bdb` Gemini client one day later; ADR-0001). Gemini ported on day one of the rewrite.
3. **Gemini Flex/Batch** (ADR-0014) — route async enrichment through the Batch API for ~50% cost cut ($1,000→$500/mo at 800 venues/day). Genuine cost engineering.
4. **Governance retrofit** — ADRs 0001-0006 (2026-01-11), 0008-0019 (2026-06-13); DoD (ADR-0008), staleness audit (ADR-0009).

### 3. Graveyard (dated)
- **Entire Python `/functions` tree** — built Aug–Oct 2025, deleted 2025-10-30 → **2025-11-08** (`3a04c45f` "clean out obsolete files"). Includes the original 2025-09-09 Gemini system, rebuilt in .NET within ~6 weeks.
- **claude-flow/SPARC/swarm scaffold** — the 786-file hype import; consensus/hive-mind agents removed by 2026-01-11 (`f5c21bd4`).
- **Honesty marker:** `d5e70dfa` (2025-10-21) "totally screwed up codebase compliments of claude code" — immediately before the rewrite.
- **Read:** high conviction (rewrite executed fast; dead code actually deleted) with real early thrash.

### 4. Architecture honesty
- **222 `.cs` files; 24 (~11%) touch `gemini`/`vertex`.** Gemini is 1 of ~15 Infrastructure services (ServiceBus, Webhook, AzureSearch, Geocoding, Overpass/OSM, ConsumerValidation, CircuitBreaker, SignalR, VenueIngestion, GCS…).
- **The Gemini client is real** (HTTP to `generativelanguage.googleapis.com/v1beta`, Search + Maps grounding, `SubmitBatchJobAsync`), not a stub.
- **"AgentEnrichment" is a misnomer.** `ConfigurableAttributeExtractor` is explicitly *"agent-agnostic,"* config-driven JSON extraction. **Zero** tool-calling/agentic code. It's prompt→JSON-parse.
- **No vector/semantic AI in prod** (embedding never survived the import; Azure Search is keyword/faceted). Data model is mildly AI-aware (JSONB provenance + confidence + quality scoring).
- **Placement: L1, top of the band.** Gemini is the value core, but structurally one LLM call wrapped in a classic ETL pipeline. Not L2 — the data foundation wasn't rebuilt to make AI first-class; that's the sibling `analytics-infrastructure` repo.

### 5. The tells
- **549/1,442 commits (38%) authored by `copilot-swe-agent[bot]` or Claude** — the software is substantially built *by* AI (external tools).
- Cost math you only write at real volume (ADR-0014 per-venue accounting, 800/day cap, grounding free-tier arithmetic).
- Concrete extraction result ("Sunnyside Hotel enriched with 29 guest rooms") + JSONB provenance — real, not demo.

### 6. The warts
- Governance is **retrofitted** — all 19 ADRs backfilled in two 2026 batches; DoD/audit added 2026-06.
- Aspirational naming ("AgentEnrichment"); leftover claude-flow scaffolding in CLAUDE.md ("concurrent execution golden rule") that isn't the .NET reality.
- **Velocity flatlined** — 2 commits Feb-2026, single digits Jun/Jul; recent work is race-condition bug fixes.
- **Single-provider, single-human** — Gemini-only; one human author (Greg across 4 emails) + bots ≈ bus factor 1.

### 7. Credibility metrics + receipts
- **1,442 commits**, 2025-06-27 → 2026-07-16. **19 ADRs** (retrospective, 2026-01-11 → 2026-06-13). 82 SQL migrations.
- **Contributors:** ~1 human (Greg, ~892 across 4 emails) + `copilot-swe-agent` (508) + Claude (41). **38% AI-authored.**
- Receipts: `867a0953` (AI absent at birth) · `1e2b74e3` (first Gemini) · `83bc4bdb` (.NET GeminiClient) · `3a04c45f` (Python deletion) / `d5e70dfa` (the "screwed up" wart) · `adr/0014-gemini-flex-batch-enrichment.md` vs `ConfigurableAttributeExtractor.cs` (the anti-agent tell).

---

## analytics-infrastructure — L2 floor (the foundation, born 2026-02-19, 450 commits)

### 1. Timeline & velocity
First commit `d904764` (2026-02-19, "Initial commit: Omni Analytics infrastructure as code"). 450 commits to 2026-07-23. Per-month: Feb 41, Mar 81, Apr 71, **May 119 (peak)**, Jun 91, Jul 47. First AI/semantic code lands **day 8**: `462bffd` (2026-02-27, "Add vector embedding pipeline for semantic hotel/RFP search").

### 2. Pivotal bets (dated)
- **Change-feed replaces ADF** — ADF retired `4b92935` (2026-02-23, 4 days in). ADR-001 backfilled 2026-06-10.
- **Semantic search via SQL VECTOR columns** — `462bffd` (2026-02-27).
- **Pivot to managed Azure AI Search** — `527c5e4` (2026-03-03): deleted `EmbeddingService.cs` / `FillEmbeddingsFunction.cs` / `210_add_vector_columns.sql`; added `search-service.bicep`, `SearchReindexTrigger.cs`, `setup-search.sh`. Integrated vectorization (`text-embedding-3-small`, HNSW, `openai-vectorizer` skillset) deployed to `hs-data-search-prod`.
- **"Omni → data platform" reframe** — `76aa27e` (2026-03-23, #16): `docs/data-platform-design.md` (236 lines) + schema enrichment; rename executed in `e6cfa6e` (2026-03-30).
- **ai-fleet wiring** — `c7b4368` (2026-03-26) grants the AI-fleet container-app MI read access; `c1f782b` (2026-04-24) adds the search-reader auth pipeline.
- **Event bus** — ADR-010 (2026-06-10); EventRelay + AuthEngine land `4acbdb3` (2026-07-09, #161). **DbUp** replaces raw sqlcmd — `515876b` (2026-07-05, #155).

### 3. Graveyard (dated)
- **Microsoft Fabric** — pre-repo original (Cosmos→Fabric Mirror→Lakehouse→Omni, ~$1,050/mo); superseded before day 1.
- **Azure Data Factory** — Phase-1 (Jan 2026) hourly pipeline; retired 2026-02-23 (`4b92935`); `adf/` kept read-only.
- **SQL VECTOR columns** — 5-day lifespan (Feb 27 → Mar 3). A genuine false start, killed fast.
- **Read: conviction, not churn** — retirements are decisive and documented; the one misfire was reversed in days.

### 4. Architecture honesty
Footprint: 16.0K LOC SQL (208 files), 8.3K LOC C# (62 files), 11 Bicep modules, 9.3K lines docs. Rough split: **~70% conventional data-warehouse** (gold tables, staging-swap, change tracking, Omni BI views), ~20% AI-serving retrieval layer (vectorized Azure AI Search, 9 indexes, concept docs), ~10% newer event-bus plumbing. **Placement: L2, at the floor** — the foundation was deliberately rebuilt so AI can be first-class (embeddings/HNSW are core infra → not L1), and the AI platform consumes it in prod. Not L3: it is IaC/data, not an agent host.

### 5. The tells
1. **Cross-repo MI wiring, dated 2026-03-26** (`c7b4368`): the data platform grants ai-fleet's MI SQL read access — 5 weeks in.
2. **Tenant-safe concept docs for the sourcing agent** (ADR-015, 2026-07-03; `1f80cc1`, #176, 2026-07-21): the `cosmos:` ref namespace exists specifically so the ai-fleet sourcing agent receives Cosmos-anchored business rules. Bidirectional, purpose-built wiring.
3. **Production vectorization**: `Microsoft.Skills.Text.AzureOpenAIEmbeddingSkill`, MI-authed, deployed (spot-checkable in `sql/search/setup-search.sh`, CI `search-setup.yml`).

### 6. The warts
- **It's a warehouse with a retrieval layer.** Strip embeddings and you have a competent, conventional Cosmos→SQL→BI pipeline. "Semantic search" is accurate but off-the-shelf.
- **The reframe was partly cosmetic.** `e6cfa6e` (2026-03-30) is largely a `hs-omni`→`hs-data` find-replace; the real rebuild predates the "platform" label.
- **Near-solo repo.** Greg ~437/450 commits (97%); Nicholas Weber 12; Copilot 1. 16 ADRs + DoD + weekly audits for ~1.2 devs risks **governance theater** — and the framework was ported wholesale from ai-fleet on 2026-06-10 (`8f4bd1c`).
- **Event bus is aspirational-leaning** — the most "platform" bet (ADR-010) is the newest and least proven.

### 7. Credibility metrics + receipts
- **450 commits** (2026-02-19 → 2026-07-23). Contributors: ~1 human (Greg 97%) + N. Weber (12) + 1 Copilot. **16 ADRs** (backfilled ADR-001 2026-06-10 → ADR-016).
- Receipts: `527c5e4` (VECTOR→Azure AI Search pivot) · `c7b4368` (`sql/auth/09_ai_fleet_mi_roles.sql`, ai-fleet MI grant) · `76aa27e` (`docs/data-platform-design.md` reframe) · ADR-015 + `1f80cc1` (sourcing-agent wiring) · `515876b` (DbUp adoption).

---

## ai-fleet — L3 qualified (the platform, born 2026-03-15, 1,505 commits in ~4.4 months)

### 1. Timeline & velocity
First commit `adf74b94` (2026-03-15, "Seed from research repo prototype"); latest at dig time `f47783f1` (2026-07-22, ADR-058). **Commits/month:** Mar 91, **Apr 514, May 499 (peak)**, Jun 244, Jul 157. **Migrations 0001 → 0347, 282 files present** (dir created `b1d5cf63` 2026-04-11; squash #320 2026-05-05 collapsed ~74 early files into `0001_schema.sql`) ≈ **~80 migrations/month**. **ADRs: 56 files, ADR-001 → ADR-058** (005/006 never issued; core batch 002–012 landed together `2954a7d7` 2026-05-14). Note: real migration path is `db/dbmigrations/scripts/migrations/`, not the `db/migrations/host/` the CLAUDE.md claimed at dig time (drift; since corrected).

### 2. Pivotal bets (dated)
- **MCP surface** `73f4bc17` (2026-04-04, #88).
- **Event bus / CloudEvents** `a896b05e` (2026-04-19, #167).
- **CostLedger + advisory-lock cap enforcement** `6b8bf87b` (2026-04-21, #190); Slack channel→agent routing same day (#193).
- **"Agents are data" (ADR-002)** documented 2026-05-14 — ~2 months in, *not* day-one.
- **Operational business machines (mid-May):** `hotel-won-mql-digest` (#377), `proposal-outlier-monitor` (#376) both 05-08; event-driven `alert-triage` (Azure Monitor → ops agent) 05-15 (#465).
- **Fleet worker runtime** ADR-029 (2026-05-24); **Activity ledger** ADR-035 (05-27); **self-tune loop** ADR-040 (05-31).
- **The audit machines:** audit-fleet 05-29, audit-data-platform 06-10, audit-enrichment-pipeline 06-13.
- **Durable dispatch substrate** ADR-052 (2026-07-02); queue retired 07-05 (#1168).
- **Safety L1/L3** (content-tagging + output-guard) `b78ac401` (2026-07-17, #899); **RLS load-bearing** #1253 `f46516ad` (07-18, #1264); **L2 input-guard** #1254 (07-19); **customer B2C MCP OAuth** (07-19, #1271).

### 3. Graveyard (dated)
- **Rust executor:** built `c5845153` (2026-04-26) → retired sweep `678f6b14` (**2026-05-19**, ~3-week life), replaced by TS `host-tools/`. (The CLAUDE.md's "retired in migration 0138" is imprecise — 0138 is `credential_system_fixes.sql`; the retirement was a code sweep.)
- **`captains-log` agent** — the pre-agents-are-data pattern (per-agent folder + IaC + CI/CD), scaffolded `4b33fe96` (2026-04-24), fully decommissioned `255d921c` (**2026-06-15**, #1004). `agents/` folder now gone.
- **Queue-based fleet dispatch** retired for the durable orchestrator 2026-07-05 (#1168).
- Other reversals: Haiku classifier killed 04-06 ("Sonnet is the single brain," #95); manifest-driven backend removed 05-05 (#334); `ops-triage` folded into `ops`; ADR-052→055 renumbered.
- **Read:** high churn = **conviction with correction**, not thrash — each reversal has an ADR or PR rationale.

### 4. Architecture honesty
Genuinely AI-native: the inference path is **singular** (GenericRunner); tools/agents/skills/machines are **DB rows** (agents-are-data holds in current code — no `agents/` folder); governance primitives (state machines, cost caps, event bus) are load-bearing. Scaffolding/aspiration: customer multi-tenancy (RLS, safety guards, B2C) is ~2 weeks old; internal workspaces deliberately fail-open. **Placement: L3 (AI-native operations), qualified** — the company's own governance and some sales/ops work demonstrably run on the platform (§5), clearing the L3 bar. But it's *internal* dogfooding; customer-facing production is L1/demo-stage.

### 5. The tells (verified)
**ai-fleet's own agent platform audits all three HopSkip AI-era repos weekly — confirmed real, deployed cron state machines, not just docs.** audit-fleet (05-29, #578/#723, replacing a broken `scheduled-audit.yml`), audit-data-platform (06-10, #937, audits `analytics-infrastructure`), audit-enrichment-pipeline (06-13, #985). Each fires weekdays, dispatches a fleet into the target repo, and opens a PR. **Real runs with real spend** (per `audit-2026-07-20-investigation.md`): #941 $47.13 (06-11), #975 $45.27 (06-12), #1118 $70.87 (06-24), #1131 $43.57 (06-26), #1154 $61.03 (07-04). Dated audit artifacts in `docs/audits/`. Secondary: operational machines doing HopSkip business work; **~44% of commits AI-agent-authored** (NanoClaw 623 + Claude/bots 33 of 1,505); 27 migrations wire cron triggers.

### 6. The warts
- **Bus factor 1.** "1,505 commits" is essentially one human — Greg (`greghopskip` 661 + `Greg Leizerowicz` 184 = 845) — plus his AI agents.
- **Dogfooding is real but *fragile*.** All three audit machines **silently failed for 16 days** (07-04 → 07-20): cost cap set to $3 vs real $40–70 (migration 0295), *and* a hardcoded `master` branch default that breaks the two `main` sister repos. Caught by manual investigation, **not** by the `audit-deadman` probe that supposedly guards it. Fixed 07-21 (0337 caps → $80; 0338 cheaper model); audits resumed 07-22. Orchestrator observability is a known gap (App Insights unwired; `died` runs logged nothing).
- **Safety/isolation is brand-new** — L1/L2/L3 guards, RLS, B2C all landed 07-17 → 07-19 (the week before the dig). Customer-facing safety is unproven; design predates impl by ~6 weeks.
- **agents-are-data adopted mid-stream**, not born-in (ADR-002 doc 05-14; captains-log per-agent-code lingered to 06-15).
- **Velocity decaying** (Jul 157 vs Apr 514) as work pivots to a customer demo/POC (#1181).

### 7. Credibility metrics + receipts
- **1,505 commits** (2026-03-15 → 07-22 dig window); monthly 91/514/499/244/157. **282 migrations** (0001→0347, ~80/month). **56 ADRs** (001→058, 005/006 skipped).
- Contributors: **845 human (one person, two identities)** + **656 AI-agent-authored** (NanoClaw 623, Claude 20, bots 13) + eng1 3, N. Weber 1.
- Receipts: `0c45ce9d` (2026-05-29, audit-fleet, first dogfooding) · `1e06121e` (2026-06-10, audit-data-platform auditing `analytics-infrastructure`) · `db/dbmigrations/scripts/migrations/0337_raise_audit_fleet_cost_caps.sql` (five real audit runs with $ + PRs) · `docs/audits/audit-2026-07-20-investigation.md` (the honest 16-day-outage post-mortem) · `678f6b14` (2026-05-19, Rust executor retirement) · `255d921c` (2026-06-15, captains-log decommission) · `b78ac401` (2026-07-17, safety L1/L3).

---

## repo-governance — standards layer (the hub, born 2026-05-20, 102 commits)

*Added 2026-08-02 — excavated the day the repo transferred from the founder's personal
account (`leizerowicz`) into HopSkipInc. Not a rung on the ladder: this is the standards
layer of the L3 claim.*

### 1. Timeline & velocity
102 commits, 2026-05-20 → 2026-08-02 (~2.5 months). Monthly: May 4, Jun 9, Jul 60, Aug 29 — but Aug is **one day** (29 commits on transfer day). Bursty session-work, not daily practice: 25 commits 07-24, 11 on 07-27, 29 on 08-02, with 3-week silences between (06-15 → 07-05). Born **six days after ai-fleet's ADR batch** (`2954a7d7`, 05-14). One human (2 emails, 102/102 by Greg) with 28/102 commits carrying Claude co-author trailers.

### 2. Pivotal bets (dated)
- **2026-05-20** (`2f02c9e`) — initial commit ships DoD, PR template, scheduled-audit workflow, and `templates/adr/022-definition-of-done.md` — **ai-fleet's own ADR number preserved in the template path**: the templates are copies of live artifacts, not blank forms. Same day (`2c222fd`), `gtm/` born — productization (vCTO advisory) is a day-one intent, not an afterthought.
- **2026-06-10** (`3ccb073`) — first formal upstream sync: "sync: from HopSkipInc/ai-fleet … 35 [PROPOSED] markers"; reviewed 06-15 (`68ad9c6`), "accepted 36/36 proposals." A propose/review skill pair makes extraction a governed ritual.
- **2026-06-14** (`f193140`) — hub-and-spoke distribution born: `downstream/` prompts, `_kickoff-prompt.md`, the `_client.md` ledger.
- **2026-07-16 → 27** — the hub grows its own governance: PDRs + falsifier lint, CI lints, routing-policy dogfood.
- **2026-08-02** — self-verification burst on transfer day: mothership drift lint, fail-closed downstream-drift lint, claim-coverage enumerator (PDR-008).

### 3. Graveyard (dated)
Small but real: **ICP whiplash** (day-one pivot to "non-technical founders," `2c222fd`; technical buyer reinstated by 07-27, PDR-001) · competitive-intel → generic watch-items reframe (`c627809` 07-06 → `e917fd6` 07-16) · `.claude/team-state.md` dropped 08-02 ("ledger is the state protocol") · the 2026-07-07 sync-protocol bug shipped and same-day fixed in the hub — but see §6 for how the fix (didn't) distribute.

### 4. Architecture honesty
Not software — no package.json, no app, deliberately. 44 versioned template artifacts (14 policy docs, ADR/PDR forms, 10 lint scripts, 8 skills, 4 workflows, 2 classifier agents), 10 hub-side check scripts, a 79-case test suite, a 31-row prompt-distribution ledger. **The standards layer of the L3 claim, and it strengthens that claim in one specific way: direction of flow is provably extraction, not imposition** — initial templates carry ai-fleet's ADR numbering; `_client.md` names ai-fleet "Primary reference implementation; source for most template improvements"; syncs pull proposals *from* the platform with per-proposal disposition. The loop "standards as code → platform as data → enforcement as agents → drift-watch as probes" is ~three-quarters real: standards versioned and lint-checked, prompts agent-executed, drift detectable — but **distribution is hand-cranked** (prompts pasted into Claude Code per repo) and two of its drift lints "run **nowhere** … currently reporting findings nobody sees" (hub CLAUDE.md's own words).

### 5. The tells
- **Extraction receipts** — `2f02c9e` ships `adr/022-…` under ai-fleet's number; `3ccb073`/`68ad9c6` run a marker/disposition sync pulling 35 proposals from the platform.
- **Agent-executable prompts** — `_kickoff-prompt.md` opens "Paste this into Claude Code in the target repo"; the ownership-fix prompt ships the exact corrected markdown, the git command, and grep-able "Verifiable outcomes." These are programs for agents.
- **Tests for governance** — the rarest artifact: 79 fixture tests, re-run live for this dossier (79/79 in 3s), motivated by two real shipped lint bugs documented in the test header ("a passing lint and a broken lint produce identical CI output").
- **Ledger honesty (mostly)** — `_client.md` rows 58–59 record the DbUp failure verbatim ("step 7 (doc-sync) missing from original; retroactively added 2026-07-16 after doc-drift caused stuck migrations"); statuses include `partial` with owed backfills itemized.
- **Self-indicting registers** — `docs/mothership-drift-register.md`: "until 2026-08-02, [this repo] ran no check on its own installed copies … caught by an agent reading by hand — luck, not process."

### 6. The warts
- **A false "applied" that stood for 16 days — until the loop's other layer caught it.** `_client.md` marks the 2026-07-07 ownership fix "applied 2026-07-07" for `enrichment-pipeline`; enrichment's history shows it actually landed **2026-07-23** (`a0e7bd11`) — applied by **audit remediation on the first post-outage audit run**, not by the sync process. The ledger row was never corrected (hub HEAD 08-02); the new fail-closed drift lint flags enrichment merely "unverifiable." Distribution failed silently; enforcement healed it — both facts belong in the story. *(Verified against enrichment `origin/main` HEAD 07-28 during synthesis; an earlier read against a stale 07-16 clone had this as "never applied.")*
- **Nobody audits the auditor** — the hub ships `scheduled-audit.yml` + `audit-deadman.yml` to every spoke and runs neither on itself; no ai-fleet audit machine covers it; push-time lints only. "Architecture (ADRs) — **not run here**" (its own CLAUDE.md).
- **Single client, single human, self-merged** — `downstream/` holds only `hopskip`; all 17 PRs authored and merged by the same person; multi-client design is one directory deep into aspiration (PDR-005/006 at least make the deferral explicit).
- **`gtm/` is a parking lot with a self-aware sign** — case study "in progress" since May, outcomes empty; PDR-002 (07-27) concedes "Zero work has touched packaging, pricing, client-acquisition," declares the repo "deliberately pre-commercial," falsifier expiring **2026-10-31**; the one external engagement is pro-bono.
- **Backlog of its own medicine** — 7 of 31 ledger rows pending (incl. a 07-27 quality-coverage prompt pending for all three repos), 2 partial with owed backfills.

### 7. Credibility metrics + receipts
102 commits · 1 human (2 emails) · 28/102 Claude-co-authored · 17 self-merged PRs · 44 template artifacts · 21 downstream prompt files · 31 ledger rows (22 applied, 2 partial, 7 pending) · 79/79 tests (run live) · lag spectrum: same-day (small prompts) → 15–21 days (DbUp standard) → 16-day false-applied (enrichment fix).
- Receipts: `2f02c9e` (2026-05-20 initial, ai-fleet ADR numbering in template path) · `3ccb073` + `68ad9c6` (06-10/15 extraction sync, 36/36) · `f193140` (06-14 `downstream/` born) · `downstream/hopskip/_client.md` rows 58–59 (retroactive DbUp note) and the enrichment ownership-fix row vs enrichment `a0e7bd11` (the 16-day false-applied) · `docs/mothership-drift-register.md` ("luck, not process") · `docs/pdr/002-pre-commercial.md` (falsifier 2026-10-31) · `da567db` (08-02, PR merge on transfer day).
