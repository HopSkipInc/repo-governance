# Technical Judgment for Your Build

**Greg Leizerowicz** · Hainesport, NJ · serving Philadelphia / NYC / remote

---

## The situation

You know what you're building. You have a contractor — maybe two. You have a launch date.

What you don't have is someone who can tell you whether the code that just landed is *actually done* — not just "CI is green," but: does the spec and the code match? Is the regression test there? Is there a credential sitting in an env var where an AI agent could leak it? If something breaks while you're away, will the system surface it before a customer does?

You could hire a full-time CTO. Or you could rent the judgment you need for the duration of the build.

---

## What I do

I come in as the technical layer between you and your contractor. I review the spec before Week 1 starts, install a system that holds your contractor accountable to "done" (not just "merged"), and set up an automated check that runs every weekday and surfaces drift before it becomes an incident.

You end the build with working infrastructure, a codebase that matches its own documentation, and a record of what was built and why. No slide decks. No frameworks. Files that ship in your repo.

**For the build:**
- Spec review before contractor code lands — catch structural problems when they're cheap
- The architecture rules your build depends on, written down — with an automatic check wired for each one, so the codebase keeps obeying them after your contractor rolls off
- Definition of Done installed in your repo — makes "done" explicit so you don't have to argue about it after
- PR template that surfaces the checklist at submission time
- CLAUDE.md additions so your AI coding agent knows the rules too
- Every backlog item labeled with what it takes to build it safely — which work a cheap AI agent can finish on its own, which needs the expensive one, and which needs a person. Most work only needs the expensive model because nobody wrote the spec clearly enough. Fixing that is the cheapest thing on this page: the clearer your specs and the better your test coverage, the less your build costs to run.

**Running in CI:**
- Scheduled staleness audit — daily Claude-run check that opens a PR if your docs, specs, and code drift apart
- A watchdog on the watchdog — if the daily check itself silently stops, a tripwire goes red and escalates within days. Silent failure is the kind that finds you through a customer.
- Alert coalescing for AI-agent errors (a flapping agent will DOS your Slack without it)
- Credential handling review — env-var-stored secrets are exfiltratable; vault-backed ones structurally aren't

---

## Engagement shapes

**Pre-launch onboarding** — fixed fee. I review the spec, install the practice in your repo, run the first audit, and hand you a prioritized findings list. Two to three weeks elapsed. Right for teams that haven't started or are early in Week 1.

**Build oversight** — weekly touchpoint through your launch window. I review PRs, flag spec drift, and field the contractor questions you can't answer. You focus on the product; I focus on whether the build is honest.

**Launch window coverage** — for the period when you're unreachable. I'm the technical backstop. Audit PRs get triaged; P0 findings get escalated to whoever you designate on-call. The monitoring layer was built for exactly this period: everything fails loudly, including the monitors themselves.

---

## About

Co-founder and CTO at Hopskip (hospitality SaaS, 15-person engineering org, eight years). I've run AI-assisted development in production since before it had a name. The governance practice behind this engagement was built in `HopSkipInc/ai-fleet` and refined over multiple audit cycles. It's open at [github.com/leizerowicz/repo-governance](https://github.com/leizerowicz/repo-governance).

The BModelr engagement — a non-technical founder shipping an AI-agent product with a contractor, launch target June 2026, two-week founder-unreachable window — is the prototype for this work.

---

## Contact

`[email]` · `[linkedin]` · `[phone]`
