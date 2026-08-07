# infra-ops — Runtime connection-edge collector: design guidance (2026-08-07)

**Special guidance, not a standard install.** This accompanies the estate-wide
generated-system-maps update (see `../2026-08-07-graphify-system-maps.md`). Per-repo
maps show *intended* connections from in-repo config; this collector would prove
*actual* connections from Azure runtime config. ai-fleet's estate-map machine is the
consumer; infra-ops owns the producer. Design first, implement later — do not build
against production in the same pass you adopt this.

Paste the prompt below into Claude Code in `~/repos/HopSkipInc/infra-ops`. Run as-is.

---

We're adopting the runtime connection-edge collector guidance from
`~/repos/HopSkipInc/repo-governance`. Your job is **design only**: draft an ADR and file
the implementation issue(s) for a runtime connection-edge collector, per the contract
below. Do not implement against live Azure resources in this pass.

**Before starting:**

1. Read `~/repos/HopSkipInc/repo-governance/templates/system-map.md` — especially
   *Estate contract* — for why this feed exists and who consumes it.
2. Read this repo's existing deploy/monitoring workflows to see what identity and RBAC
   patterns are already in use (OIDC, environment gates).

**Context:**

Per-repo system maps (graphify, committed `graphify-out/graph.json`) capture *intended*
connections from in-repo config — appsettings, env examples, Bicep params, workflow env
blocks. The estate map's missing layer is *actual* runtime connections: which deployed
service is really pointed at which database, endpoint, Key Vault secret, or namespace.
That layer can only come from inspecting Azure runtime configuration, which is why it
belongs in this repo and not in per-repo CI.

**The consumer contract.** The collector emits `edges.json`:

```json
{
  "version": 1,
  "generated_at": "<ISO-8601>",
  "edges": [
    {
      "from": "<repo-or-service slug>",
      "to": "<hostname or Azure resource name>",
      "kind": "url | kv-ref | sql | servicebus | storage",
      "evidence": "<config key name, e.g. FLEET_HOST_URL — never the value>",
      "observed_at": "<ISO-8601>"
    }
  ]
}
```

Format and delivery location are the contract — the consumer merges this file verbatim.
Everything else is your design freedom.

**Non-negotiable safety rules (the ADR must restate these verbatim):**

1. **Allowlist extraction, never values.** Keep only: config key names; values that
   parse as bare URLs/hostnames (scheme + host + port — anything containing userinfo,
   query strings, or password-shaped segments is dropped, not redacted); Key Vault
   reference URIs (metadata only — a KV reference proves the dependency without
   exposing the secret); Azure resource names (SQL server/database, Service Bus
   namespace, storage account).
2. **Never persist raw Azure CLI output.** App-settings listing returns secret values
   inline. Raw output is piped through the redactor in memory; only the redacted
   `edges.json` is ever written to disk. No temp files, no logs, no CI artifacts with
   raw output.
3. **The redactor is a security boundary.** Single-purpose module, unit-tested with
   fixture configs containing fake connection strings, human-reviewed before its first
   run against any real environment.
4. **Least privilege, recorded.** Prefer read-only roles; where a list-action
   permission is required (e.g. `Microsoft.Web/sites/config/action`), grant it
   per-scope and record each grant in the ADR. No broad Contributor handouts.
5. **Where it lands** is part of the design — candidate: a scheduled workflow in this
   repo committing `edges.json` here, since this repo already holds the estate's
   security-config source of truth.

**Deliverables for this pass:**

- `docs/adr/` — one ADR covering the contract, the five safety rules, the RBAC grants
  the implementation will need, and the delivery location decision.
- GitHub issue(s) for the implementation work: collector, redactor + fixtures, SP/RBAC
  setup, scheduled workflow. Sized so the redactor lands and is reviewed before any
  grant is issued.
