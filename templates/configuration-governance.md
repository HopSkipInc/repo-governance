<!-- template: configuration-governance.md v1.1.0 · updated 2026-09-26 -->
# Configuration Governance

**Status:** Policy — enforcement is a declared floor per repo, plus `check-config-coverage.mjs` and the ninth audit domain, **neither yet shipped** (see §11)
**Related:** [Definition of Done](definition-of-done.md), [Design Lenses](design-lenses.md), [DB Migration Governance](db-migration-governance.md), [Agent Routing](agent-routing.md)
**Paired records file:** `configuration-governance-records.md` (per-repo; this policy is identical everywhere, the records are not)

---

## Purpose

Every running system holds values it did not compile in: endpoints, credentials, flags,
thresholds, per-customer settings. **The question is never "is this a secret?" alone** —
it is two questions that teams habitually collapse into one, and collapsing them is what
produces a `.env` file with a hundred and forty entries that nobody can audit.

This policy answers both, prescribes where the answer is recorded, and states plainly
which half of it a machine can check.

---

## 1. Why this exists — the incident

**A HopSkip operator secrets file, discovered 2026-07-09.** One `.env` under
`~/.config/<org>/` had accreted to 131 variables across roughly ten unrelated concerns.
One of those values contained unescaped parentheses. Bash `source` **died at that line**,
about two-thirds of the way down the file, so every variable below it silently never
loaded in any bash-sourced context. Python and Node dotenv parsers were unaffected.

For an unknown period, **consumers of the same file disagreed about what was in it**, and
the disagreement was masked by `2>/dev/null` on the sourcing line. Nothing failed loudly.
Scripts that needed a late-file variable behaved as though it were unset, which for most
of them meant falling back to a default or skipping a step.

Three separate defects sit in that one sentence, and only one of them is about secrecy:

- **A shape defect.** A value requiring escaping was in a mechanism that has no escaping
  contract — env files are parsed differently by every consumer, and the differences are
  silent.
- **A placement defect.** Ten concerns in one file, because "it's configuration" was
  treated as a sufficient reason to put something there.
- **A cardinality defect.** The file carried `*_DEV`, `*_QA`, `*_DEMO`, and `*_PROD`
  variants of the same endpoints and keys, which means every process that read it held
  credentials for four environments. That is not untidiness. It is a blast radius equal
  to the union of every environment the operator could reach.

By the time the file was inventoried it had grown to 144 variables. **No policy in any of
the governed repos would have flagged any of this**, because every repo's governance
stopped at "don't commit secrets," which this file did not do.

---

## 2. The model — two axes, never one

The common framing is a single spectrum from "public config" to "secret." It cannot
express a per-tenant API key, which is simultaneously a secret and a database row, and
every scheme that forces a choice between those gets it wrong.

They are independent:

| Axis | Question | Determines |
|---|---|---|
| **Sensitivity** | What happens if this is disclosed? | *How it is protected* — which ladder tier (§6) |
| **Placement** | What does this value vary by, and when does it change? | *Where it lives* — code, env, config store, or database (§4) |

> **Sensitivity never changes the home. It changes the protection at that home.**

A secret that varies per tenant still belongs in the database. It belongs there
encrypted, with the envelope key on the ladder. Moving it to an env var to "keep it safe"
converts a solved problem into two unsolved ones.

---

## 3. Axis A — sensitivity

Three values. The test is disclosure harm, not intuition about the name.

| Class | Test | Examples |
|---|---|---|
| **Public** | Safe in a screenshot | Environment name, region, log level, public endpoint hostnames |
| **Internal** | No harm alone; useful for reconnaissance | Resource IDs, managed-identity principal IDs, database names, tenant IDs |
| **Secret** | Grants access, or the disclosure is itself the harm | Passwords, API keys, tokens, private keys, signing keys, webhook shared secrets |

**Over-classification is a real failure, not a safe default.** A principal ID or a
database name marked `secret` costs the same handling as a production credential and
teaches the team that the labels are noise. Once the labels are noise, the real ones stop
being read. Classify internal values as internal.

A useful sensitivity heuristic, borrowed from Factor III: *could this repository be made
public right now without compromising a credential?* Anything that fails is secret.

---

## 4. Axis B — placement

One question does most of the work:

> **What is the highest-cardinality thing this value varies by?**

| Varies by | Changes without a restart | Home |
|---|---|---|
| Nothing — same in every environment, always | — | **Code.** A literal or a named constant. |
| The deployment | No | **Environment variable.** The legitimate core. |
| The deployment | Yes | **Config store.** Needs runtime mutation and an audit trail. |
| Tenant, customer, user, or request | — | **Database.** Always. |

Environment variables are per-process and set once. **Any value whose cardinality exceeds
one-per-deployment is structurally wrong in an env var**, regardless of how convenient the
naming scheme makes it look. This is a property of the mechanism, not a preference.

The mutability row is the one teams skip. The test: *has anyone ever wanted to change this
during an incident without a deploy, or asked who changed it last?* Feature flags, rate
limits, kill switches, and business thresholds all fail it. A repo with no config store
should record that Class-D values have no correct home here rather than quietly filing
them as env vars — a known gap is a decision, an unmarked one is an accident.

---

## 5. Composition

|  | Public / internal | Secret |
|---|---|---|
| **Code** | Literal in source | **Never.** This is the committed-credential incident. |
| **Environment variable** | The value | **A reference only** — the value lives at its ladder tier |
| **Config store** | The value | Store must support a secret type with its own audit trail |
| **Database** | An ordinary column | Encrypted column; the envelope key goes on the ladder |

### 5.1 The reference rule

> **An environment variable may carry a secret *reference*. It may never carry a secret
> *value*.**

```
DB_PASSWORD=vault://app/prod/db#password        ← permitted
DB_PASSWORD=hunter2                              ← prohibited at every tier
```

This rule exists for a mechanical reason as much as a security one. Whether a value *is*
a secret is a judgment no lint can make; whether a variable declared secret *resolves to a
known reference scheme* is a syntactic check. The rule is what converts the load-bearing
half of this policy from human review into a gate (§7).

---

## 6. The credential ladder

Tiers are ordered by **what an attacker who owns the process gets**. Not by how modern the
tooling is, and not by where the secret sits at rest — storage location is a control, not
a tier, and treating it as one is how a team convinces itself that moving a static key
into a vault changed its exposure.

| Tier | What the principal holds | Human developer | Non-human / ephemeral principal |
|---|---|---|---|
| **T0** — No privilege | Nothing real; the credential opens a fake | Local container, emulator, vendor test-mode key. **The happy path belongs here.** | Identical |
| **T1** — Brokered capability | Nothing. A mediator holds the credential and performs the operation | An internal CLI that calls your API rather than the cloud directly | **Default.** Control plane or sidecar executes privileged operations; the principal asks, the broker acts and logs |
| **T2** — Attested short-lived credential | A token it never stored, derived from identity, expiring in hours | SSO session exchanged for a cloud or vault token | Workload identity federation, SPIFFE SVID, task or pod identity, run-scoped token from the dispatcher |
| **T3** — Managed long-lived secret | A durable secret fetched at point of use from a central store | Exec-wrapper injection; SDK fetch at startup | **Dated exception only** |
| **T4** — Local long-lived secret | A durable secret held on the machine | `.env`, encrypted file, OS keychain. **Floor, with controls and an expiry** | **Prohibited. No exception path.** |

**Below the ladder** — committed to version control, pasted into chat, stored in a wiki,
shared between people. Not a tier. An incident with a rotation clock.

### 6.1 Controls that make a tier claim true

| Tier | Required |
|---|---|
| T0 | The fake is the default path **and** CI exercises it. A fake nobody runs is a fiction |
| T1 | The broker authenticates the caller, scopes by run and target, logs every call, **and** rate-limits. The fourth is the one that gets dropped, and without it credential theft becomes unbounded capability abuse |
| T2 | Attestor named, maximum TTL declared as a number, scope declared. "Short-lived" with no number is T3 wearing a badge |
| T3 | Central revocation **exercised**, not merely available; access log actually read |
| T4 | Encrypted at rest; pre-commit scanner **and** server-side push protection **and** a history scan; a rotation runbook with a stated time-to-rotate; a dated expiry on the exception |

**Encryption at rest is a T4 control, not a tier of its own.** It does nothing for process
compromise — the process holds the plaintext either way. It addresses disk, version
control, and backup exposure, which are real and worth the tooling. A team that adopts an
encrypted-secrets file has not moved up the ladder and must not record that it has.

### 6.2 Floors

| Principal class | Happy path | Floor | Exception path |
|---|---|---|---|
| Human developer | T0 | T4 with controls | Dated, in the records file |
| Non-human / ephemeral | T0 or T1 | **T2** | T3 dated, with a named broker roadmap. T4 never |

Each repo **declares its floor per principal class present** in the records file, together
with the reason a higher floor is not reachable. "Capped at T3 — no IdP federation
available" is a legitimate and valuable entry. A floor asserted with no mechanism behind
it is not.

### 6.3 Why the non-human ladder is stricter

Not because such principals are riskier in degree — that would justify only a higher
floor. Two things change in kind:

**Every cheap human control depends on interactive consent, and there is nobody at the
keyboard.** A directory-hook approval prompt, a keychain unlock, an MFA push, an "are you
sure" — the entire bottom half of the human ladder is held up by a person noticing
something. Remove the person and those controls do not degrade; they vanish. That is why
T4 is prohibited outright rather than discouraged: the compensating controls that make T4
survivable for a human have no analogue.

**An agent worker is an untrusted executor.** It runs model-generated code and reads
attacker-influenceable text as its normal mode of operation. Anything reachable from that
process is reachable by anyone who can get words into its context, and reading its own
environment is a one-line shell command. Confidentiality of the process environment is not
a property that can be assumed for such a principal.

Two consequences follow. **Attribution** is a dispatcher responsibility — a shared
principal is acceptable when each run carries a distinguishing claim or session name, and
is lost silently when the dispatcher omits it. **Revocation** rides the run lifecycle:
runs are already created and destroyed per dispatch, so expiry is free and no directory
object is ever provisioned or cleaned up. The common objection — that per-worker identity
is impractical for ephemeral workloads — conflates *identity* with *registration*. Modern
workload identity is attested, not enrolled.

### 6.4 Credentials that cannot be scoped

Some vendor credentials admit no scoping, no short lifetime, and no attestation — model
provider keys are the common case, and many SaaS API keys behave the same way. For these,
T2 is not reachable at all.

> **Where a credential cannot be scoped or made short-lived, T1 is the only tier
> available.**

Route it through a gateway that holds the credential and performs per-caller attribution,
quota, and rate limiting. This converts a stolen key from an unbounded liability into
metered, attributable capability — the difference between an incident and a log line. It
is the only move that reaches containment for this class, which is why it is stated as a
rule rather than an optimization.

---

## 7. What is mechanically enforced, and what is not

Per ADR-022, enforcement ships with the promise. **This policy is scrupulous about the
distinction, because a configuration policy that over-claims enforcement is itself the
defect it exists to catch** — a document dense with rules and backed by nothing reads as
governed and gates nothing.

| Requirement | Enforcement | Kind |
|---|---|---|
| Every variable read or declared in the repo appears in the records inventory | `check-config-coverage.mjs` | **Mechanical** — not yet shipped |
| A variable classified `secret` resolves to a known reference scheme, not a literal | Same lint | **Mechanical** — not yet shipped |
| A declared variable is read somewhere; a read variable is declared | Same lint | **Mechanical** — not yet shipped |
| The declared floor is not silently breached | Ninth audit domain | **Reported** |
| Exceptions have not passed their expiry | Ninth audit domain | **Reported** |
| The classification of any given variable is *correct* | — | **Human review only** |
| The floor declared is the highest one actually reachable | — | **Human review only** |

**The lint checks coverage, not correctness, and the name says so.** No mechanical rule
determines whether a value belongs in a database — that is a judgment about cardinality
that requires knowing the domain. What a lint can determine is whether every variable has
been *dispositioned*: classified, with a home and a sensitivity, by someone. That is the
same contract as the applicability-matrix check, and it is the honest one.

**The lint fails closed.** A repo whose configuration is declared somewhere unparseable —
a cloud portal, a hand-managed deployment slot — has no declaration site, and the lint
reports SKIPPED. It never reports clean. A check that cannot see the corpus and passes is
worse than no check, because it is then cited as evidence.

---

## 8. Detection — the smells, split by what a lint may claim

**Deterministic. Gate-able once the lint ships:**

1. Read in code, absent from the declaration site → **undeclared**
2. Declared, never read → **dead**
3. Identical value in every declared environment → **belongs in code**
4. **Enumerated family** — shared prefix, suffix drawn from a closed set → **cardinality leak**
5. Classified `secret`, holding a literal rather than a reference → **§5.1 violation**

**Heuristic. Report mode, on a promotion clock:**

6. Secret-shaped name (`*_KEY`, `*_TOKEN`, `*_SECRET`, `*_PASSWORD`, `*_PAT`) holding a literal
7. High-entropy value
8. Value requiring escaping, multiline, JSON, or PEM → wrong shape for the mechanism (§1)
9. Composite fusing a target with a credential — a connection string with an embedded password. Split the target into the env var, the credential onto the ladder
10. Read in exactly one place and never varied → constant candidate

**Smell 4 is the highest-yield check and hides two distinct diagnoses.** Role- and
tenant-enumerated families are plain cardinality leaks: the value varies by something that
is not the deployment, so it belongs in a store keyed by that thing. **Environment**-
suffixed families are worse than a taxonomy problem — they mean one process holds
credentials for several environments at once, and the finding to report is the blast
radius, not the naming.

---

## 9. Failure modes

Named because each will happen, and each is recoverable if caught early.

**Inventory theatre.** The records file fills with rows whose classification was guessed
in bulk to clear the gate. *Countermeasure:* the interview classifies by interrogating
cardinality, one question per variable family rather than per variable — families are the
natural unit and there are far fewer of them.

**Over-classification.** Everything is marked secret because it is the safe-looking
answer. *Countermeasure:* §3's three classes with an explicit `internal` tier, and the
statement that over-classification is a failure. Watch for this first; it is the most
likely way the policy becomes noise.

**Tier inflation.** A repo records T2 because it has a vault, when what it has is a
long-lived secret inside a vault. *Countermeasure:* §6.1's control list. A tier claim
without its controls is a lower tier with better branding.

**Split-as-solution.** A sprawling secrets file is reorganized into several tidy ones and
the work is declared done. *Countermeasure:* reorganization changes legibility, not tier.
Every secret is at the same tier after the split as before it. A split is a good *input*
to this policy and is never an instance of it.

**Format blindness.** The lint parses `KEY=value` lines and pronounces a directory clean
while service-account private keys sit beside it in JSON. *Countermeasure:* the records
inventory covers credential-bearing *files*, not only variables. A policy whose check and
whose instruction are mutually consistent and jointly blind is worse than no policy,
because the result is recorded as a pass.

**Escalation to ceremony.** Someone proposes a configuration review board.
*Countermeasure:* this policy is one doc, one records file, one interview, and one lint.
A fifth artifact means something has gone wrong.

---

## 10. Provenance — engineering prior art

These sources ground the reader. **None of them enforces anything here** — an external
citation is neither instruction-backing nor gate-backing, and a policy that cites heavily
while gating nothing is exactly the imitation surface `governance-health.md` names. Each
entry says which of three things it does: **conforms**, **extends**, or **overrules**.

**These are engineering sources — the practice that already solved these problems — not
compliance frameworks.** This policy cites prior art because none of this is invented
here, and it cites it in engineering terms on purpose: no control-framework mapping, no
compliance-audience vocabulary (PDR-007; `gtm/positioning.md`). Credential handling is an
engineering concern and stays firmly in scope; a security questionnaire is not the
audience. Where a standards body appears below, it is cited for the engineering practice it
documents, never as a control.

| Source | Relation | Detail |
|---|---|---|
| **Twelve-Factor App, Factor III** | **Conforms** | Its definition of config — "everything likely to vary between deploys" — is §4's cardinality question in 2011 language. Its exclusion of values that do not vary is §4's first row |
| **Twelve-Factor App, Factor III** | **Extends** | Applying its own definition strictly: a value that must change *without* a deploy was never config by Factor III's standard, which is §4's third row |
| **Twelve-Factor App, Factor III** | **Overrules** | Factor III directs credentials into environment variables. Written when the alternative was a config file in version control, it predates workload identity, OIDC federation, and managed secret stores, and has no answer to child-process inheritance, rotation, TTL, or audit. **Sound on non-secret config; superseded for secret values** (§5.1) |
| **Twelve-Factor App, Factor III** | **Extends** | Its criticism of grouped named environments is the same pattern as §8's smell 4, on weaker grounds — it objects to unmanageability, this policy objects to blast radius |
| **OWASP Secrets Management Cheat Sheet** | Conforms | Lifecycle, rotation, revocation, and the secret-zero / bootstrap problem by name — practitioner guidance, not a control |
| **OWASP Top 10 for LLM Applications** | Conforms | Excessive Agency is §6.3's argument; Prompt Injection is the delivery mechanism and Sensitive Information Disclosure the outcome. The attack classes an untrusted-executor threat model is built from |
| **SPIFFE / SPIRE** | Conforms | Attestation-based identity for workloads too ephemeral to enroll — the mechanism §6.3 relies on |
| **Kubernetes documentation** | Conforms | Secrets mounted as files update in place on rotation; secrets injected as environment variables require a restart. A rotation argument for §5.1 that depends on no threat model at all |
| **NIST SP 800-190** | Conforms | Secrets in container images and environments — engineering guidance behind T4 being prohibited for containerized principals |

---

## 11. Where this binds

**This policy shipped ahead of its companions, and says so rather than implying
otherwise.** None of the four artifacts below exist yet. A policy that describes
its own enforcement in the present tense before the enforcement lands is the imitation
surface §10 warns about, so the state is stated per row.

| Artifact | Role | State at v1.1.0 |
|---|---|---|
| `configuration-governance-records.md` | The inventory, the declared floor per principal class, dated exceptions, and the deliberate non-classified list. Never syncs | **Not shipped** |
| `skills/configuration-interview/` | Produces the records file. It exists because five local facts decide whether any of this is reachable: where configuration is declared, whether a broker exists, which identity primitives exist, which principal classes are present, and whether a runtime config store exists | **Not shipped** |
| `scripts/check-config-coverage.mjs` | Gates coverage, per §7 | **Not shipped** |
| Ninth audit domain | Reports floor breaches, expired exceptions, and the §8 heuristic smells | **Not shipped** |

Until the lint lands, every row in §7's table marked *Mechanical* is **human review
only**. Installing this policy alone buys a shared model and a vocabulary; it buys no
enforcement, and a repo that installs it should record that it has taken the instruction
without the gate.

---

## 12. Adoption — the transition from the current regime

Every governed repo already handles configuration and secrets somehow, and nothing here
says it was doing so wrongly. This section is the path from **what is practiced** to **what
this policy records**, and it is phased on purpose, because three of the four artifacts in
§11 do not exist yet.

### 12.1 What can be adopted, and when

| Phase | Artifacts on disk | Buys | Does not buy |
|---|---|---|---|
| Policy only *(available now)* | this document | a shared model and vocabulary | no records, no lint, no audit domain. A repo that adopts here **records that it took the instruction without the gate** (§11) |
| Policy + records | `configuration-governance-records.md`, `skills/configuration-interview/` | the inventory and the declared floors per principal class | still no mechanical gate; §7's *Mechanical* rows stay human review |
| Full adoption | + `scripts/check-config-coverage.mjs`, audit domain 9 | the per-PR coverage gate and the periodic floor/expiry sweep | — |

**Do not install a partial set and report it as full.** The failure this table exists to
prevent is a repo citing §7's mechanical rows as enforced while only the policy is on disk.

### 12.2 Per-repo steps (full adoption)

1. Copy this policy into the repo's docs directory, version stamp intact.
2. Create `configuration-governance-records.md` from the records form, then run
   `configuration-interview` — classify by **family**, declare the floor per principal
   class present, and record the deliberate non-classified list. Budget the interview by
   family, not per variable (§9).
3. Install `scripts/check-config-coverage.mjs` and wire it into CI. It fails closed: a repo
   whose configuration is declared in a cloud portal reports SKIPPED, and that SKIPPED must
   stay visible, never be suppressed into a clean run.
4. Add audit domain 9 to the repo's audit substrate, per `audit-domains.md`. Until the
   records file exists it reports SKIPPED, which is the intended first-run state, not a
   failure to fix by stubbing the records.
5. Record the install in the repo's **Synced templates** table.

### 12.3 Rollout sequencing

Install into **one** repo first and let it run a review cycle before propagating. The two
failure modes to watch are §9's **inventory theatre** (rows bulk-classified to clear the
gate) and **tier inflation** (T2 recorded for a vault that holds a long-lived secret).
Both are visible only once real variables have passed through, and both are cheap to fix in
the template's required fields before the policy reaches the other repos. This is the same
sequencing `design-lenses.md` §10.3 prescribes, for the same reason.

### 12.4 Relationship to an existing `.env` split

A repo or operator may already be mid-way through splitting a sprawling secrets file.
**The split is an input to this policy, never an instance of it** (§9): it changes
legibility, not tier, and every value sits at the same tier after the split as before. Do
the split for the reasons it was planned — a shape defect, a shell `source` that dies
half-way — and then run this policy against the result. A split is not adoption, and
adoption does not require a split.

### 12.5 Client prompt

The downstream install prompt is written **when the records form and the interview ship**,
not before. A prompt that names a records template the repo cannot fetch, or installs a
lint that does not exist, is the "instruction names a target that isn't live" failure — and
it verifies green. Until then there is deliberately **no `_client.md` row and no prompt**
for this policy: §11 and this section are where the deferral is recorded, so it is not
silent.

### 12.6 Boundaries with adjacent policies

Two existing policies sit close to this one. Neither conflicts with it; both are read
together with it often enough that the boundary is stated.

- **Secrets hygiene (`harness-enforcement.md`) is a different control at a different
  layer.** That stanza denies the *agent* read/edit access to credential *paths*; this
  policy governs a *runtime principal's* credential and its tier. The harness path register
  is populated from the repo's CLAUDE.md records paragraph and enforces the deny; the §11
  records inventory classifies variables and credential-bearing files and records tiers and
  expiries. Where both name the same file they are two different statements about it — one
  an access rule, one a classification — and neither should be regenerated from the other.
  A repo installing both must not let them drift into two rival classifications of the same
  secret: the records inventory is authoritative for *what a thing is*, the harness register
  for *who may touch it*.
- **`agent-routing.md` `gate:credentials` is a commit-time gate, not a runtime tier.** It
  holds that a change handling credentials, or removing a safety invariant, is prepared for
  a human, and that an agent "structurally cannot hold the keys" *within the routing work*.
  This policy's non-human ladder contemplates an agent worker running under an attested
  short-lived credential (T2/T3). They do not conflict — one decides who may author a
  credential-touching change, the other what a running principal may hold — but they are
  read together, so the boundary is stated here rather than rediscovered in review.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.1.0 | 2026-09-26 | §10 reframed to **engineering prior art**: the compliance-framework rows (OWASP ASVS, the OWASP Top 10 misconfiguration/crypto rows, PCI DSS/SOC 2) and their control/audit-evidence framing are removed, the lane is stated (PDR-007, `gtm/positioning.md`), and the engineering sources are kept. Adds §12 — the adoption path from the practiced regime to this one: phased installability, per-repo steps, rollout sequencing, the `.env`-split relationship, the deferred client prompt, and the boundaries with `harness-enforcement` and `agent-routing` |
| 1.0.1 | 2026-09-26 | §11 said "three of the four artifacts below do not exist yet" while all four rows read *Not shipped*, and the Status line named the ninth audit domain as enforcement without marking it unshipped. Both now match the table |
| 1.0.0 | 2026-09-16 | Initial. Two-axis model, placement table, composition matrix, the reference rule, the five-tier ladder with separate floors for human and non-human principals, coverage-not-correctness enforcement contract, ten smells split by claim strength, six failure modes, three-way provenance |
