# Governance Maintenance — HopSkipInc/ai-fleet — 2026-09-24

**Client:** hopskip
**Source:** repo-governance `agent-routing` v1.15.0, `agent-routing-records`
v1.1.0, `agents/routing-classifier*` v1.3.0; new template
`scripts/check-classifier-pin-drift.mjs` v1.0.0
**Closes:** ai-fleet #3097 (the classifier-pin half of the 2026-09-24 model-name cleanup)
**Design record:** `repo-governance/docs/classifier-class-binding.md`

This is the upstream half of #3097. #3098 removed model names from the routing docs and
worker roles; the classifier pin was left because deleting it is a behaviour change — the
pin is what makes triage un-self-certifiable. This sync does not delete it. It **rebinds** it
to a capability class and adds the gate that was missing.

The rule the whole change rests on: **a concrete model name may appear in a repo only when a
resolution step produced it from the class map — never hand-typed.** The design's end state is
the gateway resolving classes (your in-flight chokepoint work), at which point no repo names a
model at all; until then a generated bridge carries the slug, and the new lint gates it.

## 1. Re-sync the classifier template (both harnesses)

- `templates/agents/routing-classifier.md` → `.claude/agents/routing-classifier.md`
  (v1.2.0 → **v1.3.0**).
- `templates/agents/routing-classifier.opencode.md` →
  `~/.config/opencode/agents/routing-classifier.md` (v1.2.1 → **v1.3.0**).

The v1.3.0 delta is a `# routing-class:` marker in the frontmatter plus a docstring change.
**Adapt the class token to this repo's vocabulary.** The template ships
`# routing-class: frontier` (repo-governance's triage class); ai-fleet's triage-grade
capability class is `deep-reasoning`, so both installed pins carry:

```
# routing-class: deep-reasoning
```

Preserve the local deviations already on record (`hidden: false` on the opencode global
agent; the `hopskip-gateway/*` provider prefix). The marker is the only new line.

## 2. Resolve the pin's `model:` from the registry — do not hand-type it

The template's `model:` is a *resolved binding*, and ai-fleet's class→model map is registry
data, not a records table. Wire the resolution so the slug is produced, not typed:

- Generate the pin's `model:` slug from the current `deep-reasoning` deployment
  (`SELECT … FROM model_deployments` / the class's live binding — whatever the registry
  exposes), **not** from a remembered name. The Claude Code pin's slug is whatever that
  harness reaches the deployment through; the opencode pin uses the `hopskip-gateway/…`
  route already established by the gateway cutover.
- The generated slug is the bridge the design names — a value the resolution produced, not a
  claim about the model.

## 3. Give the drift lint its map, and wire it

Install `templates/scripts/check-classifier-pin-drift.mjs` (v1.0.0) as
`scripts/check-classifier-pin-drift.mjs`, byte-identical, and wire it beside the existing
repo lints (a per-PR step, or into `check-fleet-worker-context.mjs`'s CI — your call; it is
deterministic, no credentials, no network).

The lint reads a **map** with two tables — `## 1.` class→models, `## 2.` model→harness
routes — via `--records <path>` (default `docs/agent-routing-records.md`). ai-fleet's §1 is
now tier→class and its class→model binding is the registry, so **generate the map file from
the registry** (e.g. `docs/agent-routing-class-map.md`, the §1/§2 shape, produced by a small
script the way `pricing.json` and the seed migrations are) and point `--records` at it. That
keeps the single source of truth in data and the repo copy generated.

Then the lint:
- resolves the pin's `model:` slug through the map's §2 to a model,
- asserts the map's §1 lists that model under the pin's declared class,
- and **fails closed** on a missing `# routing-class:` marker, a class absent from §1, a slug
  absent from §2, or drift.

Expect it to **fail on first run** — the pin still says `opus` while `deep-reasoning` is
`gpt-6-sol`. That failure is the point; fix the pin (or the map) until it is green.

## 4. Records §3

`docs/agent-routing-records.md` §3 moves from "Resolves to (model) | Class | Reviewed" to
"Class | Resolved via | Reviewed". Record both harness pins binding `deep-reasoning`,
resolved via the registry map, and note that the Claude Code pin is lint-gated while the
opencode global pin (outside the repo) is reviewed at re-sync. Add the 2026-09-24 row to
your sync log.

## Verifiable outcomes

- [ ] `.claude/agents/routing-classifier.md` and
      `~/.config/opencode/agents/routing-classifier.md` carry `# routing-class: deep-reasoning`
      and a `model:` slug produced from the registry, not typed from memory.
- [ ] `scripts/check-classifier-pin-drift.mjs` is installed byte-identical to the template and
      runs in CI.
- [ ] The class→model map the lint reads is generated from the registry (a provenance line
      says so), and the lint is green against it.
- [ ] The lint **fails closed**: with the pin's class cleared, it exits non-zero and names the
      missing marker (run that probe, include the output).
- [ ] `docs/agent-routing-records.md` §3 carries the class binding for both pins.

## Verification (how an agent proves it)

- `diff templates/agents/routing-classifier.md .claude/agents/routing-classifier.md` — expect
  only the class token to differ (`frontier` → `deep-reasoning`).
- `node scripts/check-classifier-pin-drift.mjs` — expect `OK:`.
- Clear the `# routing-class:` line in a scratch copy and re-run — expect exit 1 naming the
  marker (the fail-closed probe).
- `SELECT model_id, deployment_id, status FROM model_deployments WHERE model_id` matches the
  slug written into the pin.

## What this is not

Not the gateway resolution — that is your chokepoint work, and when it lands the bridge and
the map retire: the pin names the class and the gateway resolves it. The lint does not
disappear then; it narrows to asserting the class is triage-grade. Record that convergence in
§3 when it happens.
