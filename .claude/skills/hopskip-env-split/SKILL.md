---
name: "hopskip-env-split"
description: "Runbook for splitting ~/.config/hopskip/.env into seven per-concern env files and migrating every reference proactively. Use when resuming, revising, or executing the HopSkip secrets split — bucket map, reference inventory, execution order, verification."
---

# hopskip-env-split

Decision record + executable runbook for splitting `~/.config/hopskip/.env` (131 vars across
~10 concerns) into seven per-concern files and migrating all references.

**Decided 2026-08-05 (Greg): option C** — per-concern files with proactive reference migration.
No compatibility shim, no generated union file. Confirmed: **no off-machine readers** of the
file, so the final delete is safe. Decision is in the activity ledger under
`HopSkipInc/repo-governance`.

Resume work from the Progress log at the bottom. Revise bucket assignments by editing the
Bucket map — it is the source of truth.

## Why

- One file had become ~10 concerns in a trench coat; skills and scripts across every repo
  reference the single path, so the longer it waits the more references accrete.
- `HARNESS_SA_PASSWORD` carries unquoted parens. Bash `source` **dies at that line** (~169),
  so every var below it silently never loads in bash-sourced contexts — masked by
  `2>/dev/null`, visible in session transcripts since 2026-07-09. Python/Node dotenv parsers
  are unaffected, so consumers currently **disagree about what is loaded**. Fixed during the
  move regardless of anything else.

## Rules (non-negotiable)

- Never print values — var names and paths only. Never commit any env file. Perms stay `600`.
- **One var, one home.** A consumer needing two concerns sources two files — that is the
  declared-dependency feature, not a bug.
- Any value with shell-active chars `( ) $ & # ; | < >` or spaces gets **single quotes** in
  the new files. The files must parse under bash `source` *and* python/Node dotenv.
  (`HARNESS_SA_PASSWORD` is the known case — double quotes are wrong, `$` would expand.)
- Historical/log surfaces are never edited: session `.jsonl` transcripts, `~/.claude/memory/*`,
  `~/.claude/projects/*/memory/*`, the team-context content-store index. Leave them.
- Repo changes ride per-repo PRs, each in its own worktree; `record_activity` at every
  checkpoint. This skill's checkboxes get marked as items land.

## Bucket map (131 vars, 7 files)

| File | Count | Vars |
|---|---|---|
| `hopskip-api.env` | 21 | `CLAUDE_CODE_HOPSKIP_API_KEY`, `HOPSKIP_API_KEY_DEV_ADMIN`, `HOPSKIP_API_KEY_DEV_PLANNER`, `HOPSKIP_API_KEY_DEV_HOTELIER`, `HOPSKIP_API_KEY_DEV_AFFILIATE`, `HOPSKIP_API_KEY_DEV_SUPPLIER`, `HOPSKIP_API_KEY_DEV_DESTINATIONMANAGER`, `HOPSKIP_API_KEY_QA`, `HOPSKIP_API_KEY_DEMO`, `HOPSKIP_API_KEY_PROD`, `HOPSKIP_API_KEY_PROD_HUBSPOT`, `HOPSKIP_API_KEY_QA_HUBSPOT`, `HOPSKIP_API_KEY_PROD_ENRICHMENT`, `HOPSKIP_API_KEY_QA_ENRICHMENT`, `HOPSKIP_PLANNER_API_KEY_DEV`, `HOPSKIP_PLANNER_API_KEY_QA`, `HOPSKIP_PLANNER_API_KEY_PROD`, `HOPSKIP_PLANNER_LOGIN_ID`, `HOPSKIP_PLANNER_LOGIN_PW`, `HOPSKIP_ADMIN_USER_ID`, `HOPSKIP_ADMIN_PASSWORD` |
| `data-platform.env` | 36 | `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_KEY_RW`, `COSMOS_DATABASE`, `COSMOS_CONTAINER_RFP_ROOT`, `COSMOS_CONTAINER_VENUE_ROOT`, `COSMOS_CONTAINER_USERPROFILE_ROOT`, `COSMOS_PARTITION_KEY_EVENT_PLANS`, `COSMOS_PARTITION_KEY_VENUES`, `COSMOS_PARTITION_KEY_USER_PROFILES`, `COSMOS_ENDPOINT_DEV`, `COSMOS_KEY_DEV`, `COSMOS_DATABASE_DEV`, `COSMOS_ENDPOINT_QA`, `COSMOS_KEY_QA`, `COSMOS_DATABASE_QA`, `COSMOS_ENDPOINT_DEMO`, `COSMOS_KEY_DEMO`, `COSMOS_DATABASE_DEMO`, `FABRIC_SQL_SERVER`, `FABRIC_SQL_DATABASE`, `FABRIC_TENANT_ID`, `FABRIC_CLIENT_ID`, `FABRIC_CLIENT_SECRET`, `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `SEMANTIC_SEARCH_SERVICE_PROD`, `SEMANTIC_SEARCH_QUERY_KEY_PROD`, `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_OPENAI_EMBEDDING_ENDPOINT`, `AZURE_OPENAI_EMBEDDING_KEY` |
| `fleet.env` | 28 | `FLEET_HOST_CLIENT_ID`, `FLEET_HOST_CLIENT_SECRET`, `FLEET_HOST_HOPSKIP_B2C_CLIENT_ID`, `FLEET_HOST_HOPSKIP_B2C_CLIENT_SECRET`, `B2C_TENANT_ID`, `B2C_USER_FLOW`, `B2C_AUDIENCE`, `FLEET_ORCHESTRATOR_HOST_TOKEN`, `FLEET_MCP_SECRET`, `AI_FLEET_POSTGRES_HOST`, `AI_FLEET_POSTGRES_PORT`, `AI_FLEET_POSTGRES_DATABASE`, `AI_FLEET_POSTGRES_ADMIN_UID`, `AI_FLEET_POSTGRES_ADMIN_PWD`, `AI_FLEET_HOPSKIP_ADMIN_API_KEY`, `SLACK_FLEETBOT_APP_TOKEN`, `SLACK_FLEETBOT_BOT_TOKEN`, `WEBHOOK_HMAC_SECRET_HOPSKIP_SOURCING_DEMO`, `WEBHOOK_HMAC_SECRET_HOPSKIP_SOURCING_PROD`, `ENTRA_TENANT_ID`, `MCP_AUDIENCE`, `POSTHOG_API_KEY_AGENTS`, `POSTHOG_CLIENT_KEY_AGENTS`, `POSTHOG_PROJECT_ID_AGENTS`, `POSTHOG_INTERNAL_AGENTS_API_KEY`, `TAVILY_AGENTS_PROD`, `ANTHROPIC_API_KEY_AI_HOST`, `ANTHROPIC_API_KEY_ADMIN` |
| `enrichment.env` | 11 | `ENRP_FUNCTION_APP`, `ENRP_RESOURCE_GROUP`, `ENRP_SB_NAMESPACE`, `ENRP_SB_FQNS`, `ENRP_MI_PRINCIPAL_ID`, `ENRP_POSTGRES_HOST`, `ENRP_POSTGRES_PORT`, `ENRP_POSTGRES_DATABASE`, `ENRP_POSTGRES_USER`, `ENRP_POSTGRES_PASSWORD`, `FULLENRICH_API_KEY` |
| `analytics.env` | 9 | `INTERCOM_API_TOKEN`, `POSTHOG_API_KEY_HOPSKIP`, `POSTHOG_API_KEY_HOPSKIP_CI_CD_ONLY`, `POSTHOG_PROJECT_ID_HOPSKIP`, `POSTHOG_HOST`, `PENDO_API_KEY`, `HUBSPOT_API_KEY_PROD_5266489`, `HUBSPOT_API_KEY_QA_7149372`, `OMNI_APP_API_KEY` |
| `saas.env` | 20 | `ANTHROPIC_API_KEY`, `NOTION_API_KEY`, `NOTION_AGENT_KNOWLEDGE`, `NOTION_AGENT_MARKETING`, `NOTION_AGENT_SALES`, `NOTION_AGENT_ENGINEERING`, `NOTION_AGENT_FINANCE`, `NOTION_AGENT_EXECUTIVE`, `NOTION_AGENT_SUPPORT`, `NOTION_AGENT_SUCCESS`, `NOTION_AGENT_OPS`, `NOTION_AGENT_PRODUCT`, `STRIPE_SECRET_KEY`, `RAMP_OAUTH_CLIENT_ID`, `RAMP_OAUTH_CLIENT_SECRET`, `VANTA_APP_OAUTH_CLIENT_ID`, `VANTA_APP_OAUTH_CLIENT_SECRET`, `AHA_API_KEY_AI_FLEET_TOOLS`, `FIGMA_PERSONAL_ACCESS_TOKEN`, `GOOGLE_API_KEY` |
| `devops.env` | 6 | `AZDO_PAT_FULL`, `AZDO_PAT_READ`, `SDR_BOT_API_KEY`, `HARNESS_SA_PASSWORD`, `GITHUB_PAT_PACKAGE_PUBLISH`, `CD_GRAPH_CLIENT_SECRET` |

### Known seams (revisit candidates)

- `ANTHROPIC_API_KEY` lives in `saas.env` but ai-fleet workers consume it
  (`run-local.sh` sources `saas.env` + `fleet.env`). Weakest placement in the map.
- `POSTHOG_HOST` lives in `analytics.env`; the agents-project PostHog keys live in
  `fleet.env`. A fleet consumer needing `POSTHOG_HOST` sources both files.
- `SDR_BOT_API_KEY` is a service key parked in `devops.env`, not a personal devops cred.
- `ANTHROPIC_API_KEY_AI_HOST` / `ANTHROPIC_API_KEY_ADMIN` are fleet-host LLM access,
  so `fleet.env`, not `saas.env`.

## Consumption patterns → migration shape

| Pattern | Example | After |
|---|---|---|
| bash `set -a && source <file> && set +a` | omni-* skills, ai-fleet scripts | source the specific file(s) |
| python `load_dotenv(path)` | research-qa1 `env.py`, purge script | load the specific file(s) |
| surgical `grep '^VAR=' file \| cut -d= -f2-` | watch-release | point at the specific file; note quoted values now need quote-stripping |
| Node file-parse default | `in-memory-secret-store.ts` `DEFAULT_ENV_FILE` | code change: default becomes `fleet.env` |
| union loader | `demo-up.sh` ("load ALL vars") | explicit file list, or `~/.config/hopskip/*.env` glob — decide in the PR. The glob never matches the dotfile `.env`, which is handy during transition |

## Reference inventory (the fix list)

### Machine-local, no PR needed
- [ ] `~/.config/hopskip/*.py` tools (`cosmos-query.py`, `fabric-query.py`, `sql-query.py`,
      `figma-query.py`) — verify how each loads env; point at `data-platform.env` / `analytics.env` / `saas.env`
- [ ] Global skills: `watch-release` → `devops.env`; `ramp-ai-spend` → `saas.env`;
      `aha-read` → `saas.env`; `ado-branch-gates` → `devops.env`; `sql-auth-grants` →
      `data-platform.env`; `update-sql-firewall`, `fix-mcp-remote-auth`, `fleet-dispatch` →
      check each, likely `devops.env` / `fleet.env`

### Repo PRs (one worktree + PR each, in this order)
- [ ] **research-qa1**: `CLAUDE.md`, `nps-detractors/sources/{env,hubspot,pendo,intercom,posthog,assembler}.py`,
      notebook doc → `analytics.env`
- [ ] **analytics-infrastructure**: `scripts/purge-hotel-duplicates.py` → `data-platform.env`;
      `tools/gateway-mcp-acceptance/conftest.py` → `hopskip-api.env`;
      `.claude/skills/omni-{dashboard,audit}.md` → `analytics.env`; `CLAUDE.md` + docs mentions
- [ ] **ai-fleet**: `runtime/worker/run-local.sh` → `saas.env` + `fleet.env`;
      `tools/run-worker-local.sh` → same; `host/scripts/slack-thread.sh` → `fleet.env`;
      `host/scripts/send-proposal-event.sh` → `fleet.env`; `host/scripts/demo-up.sh` →
      union loader (see pattern table); `host/src/credentials/in-memory-secret-store.ts` →
      code default becomes `fleet.env`; `host-tools/pendo` live-test doc → `analytics.env`.
      Worktree copies under `ai-fleet-worktrees/` inherit via merge — do not edit them directly.

### Fleet-host memory
- [ ] `memory_recall "config/hopskip/.env"` → `memory_forget` stale path facts, re-teach with
      new locations. Known live facts: HMAC webhook secrets location; "env vars from
      ~/.config/hopskip/.env for import"; Cosmos/dev credential location.

### Leave alone (historical)
- Session `.jsonl` transcripts, `~/.claude/memory/*`, `~/.claude/projects/*/memory/*`,
  team-context content-store index.

## Execution runbook

0. **Lanes**: one worktree per repo; `record_activity` for each lane open/close.
1. **Snapshot**: `cp -p ~/.config/hopskip/.env ~/.config/hopskip/.env.bak && chmod 600 ~/.config/hopskip/.env.bak`
2. **Write the seven files** per the bucket map, `chmod 600`, single-quote shell-active
   values. `.env` stays untouched — nothing breaks yet.
3. **Parity check** (both commands must print nothing):
   ```bash
   cd ~/.config/hopskip
   sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env | sort -u > /tmp/env-before.txt
   cat hopskip-api.env data-platform.env fleet.env enrichment.env analytics.env saas.env devops.env \
     | sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' | sort > /tmp/env-after.txt
   uniq -d /tmp/env-after.txt                      # dupes = double-homed var
   comm -3 /tmp/env-before.txt /tmp/env-after.txt  # missing or extra vars
   ```
4. **Machine-local updates** (tools + global skills) — then smoke one consumer per pattern.
5. **Repo PRs** in the inventory order (research-qa1 → analytics-infrastructure → ai-fleet).
6. **Fleet-host memory** re-teach.
7. **Sweep**: `grep -rl 'config/hopskip/\.env' ~/repos ~/.claude/skills ~/.claude/CLAUDE.md`
   should match only logs/retired files and worktree copies pending merge.
8. **Spot-test all four patterns** (below).
9. **Delete** `~/.config/hopskip/.env`. Keep `.env.bak` until all PRs are merged plus one
   week of burn-in, then shred it.

## Verification (spot tests, step 8)

- **bash source**: `set -a && source ~/.config/hopskip/devops.env && set +a && test -n "$AZDO_PAT_FULL" && echo ok`
- **python dotenv**: load `analytics.env` in a REPL, assert a key is present (never print it)
- **grep|cut**: run `watch-release` against an active ADO release
- **Node parse**: boot the ai-fleet local dev host — `in-memory-secret-store` reads `fleet.env`
- **union**: `demo-up.sh` start, confirm containers get their injected env

## Revising the buckets

Edit the Bucket map table directly. Invariants that keep it honest: one var one home; the
parity check in step 3 must still pass; update Known seams if a move creates or resolves one;
`record_activity` the revision.

## Progress log

- 2026-08-05 — Plan recorded. Option C decided; no off-machine readers confirmed. Bucket map
  (131 vars / 7 files) and reference inventory captured from a live redacted dump + grep
  sweep. Nothing executed yet.
