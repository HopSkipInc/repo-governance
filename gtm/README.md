# gtm/

Go-to-market artifacts for the vCTO advisory practice built on the `repo-governance` methodology.

The top-level repo is the **methodology** — open, reusable, applicable to anyone's engineering org. This directory is **Greg Leizerowicz's specific go-to-market** for the vCTO advisory practice that applies the methodology. Treat it as working notes that evolve faster than the methodology itself.

## Structure

```
gtm/
├── README.md              ← you are here
├── one-pager.md           ← the offering description (hand-able to partners/prospects)
├── positioning.md         ← working notes on buyer, vocabulary, differentiation, sales motion
├── partnerships/          ← partner-specific analysis and prep
│   └── jdaqa.md           ← JDAQA (Jay Aigner) — quality infrastructure firm in Philly
└── case-studies/          ← engagement write-ups
    └── bmodelr.md         ← Jeff Bruno / BModelr — in progress, populates post-launch
```

## Update rhythm

These docs evolve faster than the methodology and should be treated as **working notes, not polished marketing collateral.** Rev frequently; let the structure stay loose until engagement volume justifies more discipline.

Suggested cadence:
- **`positioning.md`** — review quarterly; revise when the buyer or competitive landscape shifts
- **`one-pager.md`** — revise when positioning.md does; this is the public-facing crystallization
- **`partnerships/*`** — update after every meaningful conversation with the named partner
- **`case-studies/*`** — populate Outcomes/Lessons sections post-engagement; collect quotes with explicit permission

## Adding new artifacts from Claude conversations

The fastest way to keep this directory current: at the end of any strategy conversation with Claude that produces useful reasoning, ask for **purpose-shaped outputs** rather than dumping raw conversation history. Examples:

- *"Generate a positioning brief from this conversation that I can drop into repo-governance/gtm/positioning.md."*
- *"Produce a partnership analysis doc for [partner] based on this conversation."*
- *"Update case-studies/bmodelr.md with the new findings from this conversation, preserving the existing structure."*

For longer conversations, Claude Code with this repo open in a workspace can take the conversation text as input and place the resulting files directly in the right locations — it sees the existing directory structure and pattern-matches naming and shape.

## What goes here vs. doesn't

**Belongs here:**
- Positioning and messaging artifacts
- Partner prep docs
- Case studies and engagement retrospectives
- Pricing notes (when they exist)
- Sales motion experiments

**Does NOT belong here** (lives elsewhere in the repo or in client repos):
- Methodology documents (those are at repo root and in `templates/`)
- Client-specific deliverables like spec reviews — those belong in the client's repo or in private working files
- Anything client-confidential without explicit consent for inclusion

<!-- fleet smoke test 2026-08-19 — sparse-turning-spire; safe to delete -->
