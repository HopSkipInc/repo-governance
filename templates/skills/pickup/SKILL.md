---
name: pickup
description: >
  Reads an issue's risk: and gate: labels, resolves the minimum capability class
  through the repo's risk→class rule, and prints the exact model-switch command
  for the current harness. Advisory only: it never blocks, refuses a prompt,
  switches the model, or nags. Where the harness cannot expose the session's
  current model, it prints the required class without a comparison.
version: 1.0.0
updated: 2026-11-07
triggers:
  - /pickup
---

# Pickup — which model does this issue need?

**This is advice, not a gate.** It never blocks a session, refuses a prompt, rewrites
anything, or switches the model. The engineer keeps the choice. Proceeding on a below-class
model takes no acknowledgement from this skill; a warning is informational and is never
repeated for the same issue in the same session.

Read `docs/agent-routing.md` and `docs/agent-routing-records.md` before running. The rule is
in the records file, not here.

## Procedure

**Run the resolution block. The block is the skill.** Do not classify the issue yourself, do
not paraphrase its output, and never say you are switching the model. The engineer runs the
switch command; this skill only prints it.

1. **Get the issue number** from the invocation: the first `#N`, bare `N`, or issue URL.
   If there is none, say "pickup needs an issue number: `/pickup <issue>`" and stop.
2. **Run the exact block below**, substituting the issue number for `$ISSUE`:
3. **Print the block's stdout verbatim as your entire response.** Do not add an
   acknowledgement prompt, do not ask the engineer to confirm, do not execute a model-switch
   command, and do not claim the model changed. If the block says the current model is not
   readable, say so — do not guess the class of the session.

```bash
python3 - "$ISSUE" <<'PY'
import glob, json, os, re, subprocess, sys

issue_arg = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
m = re.search(r'(\d+)', issue_arg)
if not m:
    print("pickup: no issue number in the invocation.")
    sys.exit(0)
number = m.group(1)

root = os.getcwd()
records = os.environ.get("ROUTING_RECORDS") or os.path.join(root, "docs", "agent-routing-records.md")
repo = os.environ.get("ROUTING_REPO")

def run(args):
    return subprocess.run(args, capture_output=True, text=True)

if not repo:
    r = run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
    if r.returncode != 0:
        print("pickup: cannot resolve the repo; set ROUTING_REPO=<owner/repo>.")
        sys.exit(0)
    repo = r.stdout.strip()

if not os.path.exists(records):
    print(f"pickup: no records file at {records}; cannot resolve the rule.")
    sys.exit(0)

text = open(records, encoding="utf-8").read()
lines = text.splitlines()

def table_after(pattern):
    start = next((i for i, l in enumerate(lines) if re.match(pattern, l, re.I)), None)
    if start is None:
        return None
    rows = []
    for l in lines[start + 1:]:
        if re.match(r'^##[ \t]', l):
            break
        if not l.strip().startswith("|"):
            continue
        cells = [c.strip().replace("`", "").replace("*", "") for c in l.split("|")[1:-1]]
        if not cells or all(re.fullmatch(r'-+', c or '-') for c in cells):
            continue
        rows.append(cells)
    return rows

rule_rows = table_after(r'^##[ \t]*\d*\.?[ \t]*Risk.*class rule')
if not rule_rows:
    print("pickup: the records file has no §8 risk→class rule.")
    sys.exit(0)

rule = {}
for row in rule_rows:
    if len(row) < 2 or re.match(r'^risk (label|set)$', row[0], re.I) or re.match(r'^minimum class$', row[1], re.I):
        continue
    rule[row[0].lower()] = row[1].lower()

class_rows = table_after(r'^##[ \t]*\d*\.?[ \t]*Model.*class') or []
route_rows = table_after(r'^##[ \t]*\d*\.?[ \t]*Model.*harness route') or []

def split_names(s):
    return [x.strip() for x in s.split(",") if x.strip() and x.strip() != "—"]

classes = {}
for row in class_rows:
    if len(row) >= 2 and row[0].lower() in ("standard", "frontier"):
        classes[row[0].lower()] = split_names(row[1])

routes = {}
for row in route_rows:
    if len(row) >= 2 and row[0] and row[0].lower() != "model":
        cols = {}
        if len(row) > 1: cols["claude"] = row[1]
        if len(row) > 2: cols["opencode"] = row[2]
        routes[row[0]] = cols

r = run(["gh", "issue", "view", number, "--repo", repo, "--json", "number,title,labels"])
if r.returncode != 0:
    print(f"pickup: cannot read issue #{number} ({r.stderr.strip().splitlines()[:1]}).")
    sys.exit(0)
issue = json.loads(r.stdout)
labels = [l["name"] for l in issue.get("labels", [])]
risks = [l for l in labels if l.startswith("risk:")]
gates = [l for l in labels if l.startswith("gate:")]

rank = {"standard": 1, "frontier": 2}
if risks:
    derived = None
    missing = []
    for label in risks:
        cls = rule.get(label)
        if not cls:
            missing.append(label)
            continue
        if not derived or rank.get(cls, 0) > rank.get(derived, 0):
            derived = cls
    if missing or not derived:
        print(f"Issue #{number}: {issue['title']}")
        print(f"pickup: the rule has no class for {', '.join(missing) or 'these labels'}.")
        sys.exit(0)
else:
    derived = rule.get("(none)", "standard")

harness = "claude" if os.environ.get("CLAUDECODE") else "opencode" if os.environ.get("OPENCODE") else None

route = None
route_model = None
for model in classes.get(derived, []):
    cols = routes.get(model, {})
    if harness and cols.get(harness) and cols[harness] != "—":
        route, route_model = cols[harness], model
        break
    if not harness:
        for h in ("claude", "opencode"):
            if cols.get(h) and cols[h] != "—":
                route, route_model = cols[h], model
                break
        if route:
            break

print(f"Issue #{number}: {issue['title']}")
print(f"Risk: {', '.join(risks) if risks else '(zero risk labels)'}")
print(f"Required class: {derived}")
if gates:
    print(f"A human finishes this: {', '.join(gates)}")

if route:
    if harness == "claude":
        print(f"Switch in this session: /model {route}  (new session: claude --model {route})")
    elif harness == "opencode":
        print(f"Start a session with: opencode run -m {route}")
    else:
        print(f"Recorded routes: Claude Code `{routes.get(route_model, {}).get('claude', '—')}`, opencode `{routes.get(route_model, {}).get('opencode', '—')}`")
else:
    print(f"No {'Claude Code' if harness == 'claude' else 'opencode' if harness == 'opencode' else 'harness'} route is recorded for the {derived} class.")

# Current model: only where the harness exposes it. Claude Code keeps the session
# transcript at ~/.claude/projects/<cwd-slug>/<session>.jsonl; OpenCode exposes no
# stable per-session model variable, so it gets the no-comparison path.
current = os.environ.get("CLAUDE_MODEL") or os.environ.get("ANTHROPIC_MODEL") or os.environ.get("OPENCODE_MODEL")
if not current and os.environ.get("CLAUDECODE") and os.environ.get("CLAUDE_CODE_SESSION_ID"):
    sid = os.environ["CLAUDE_CODE_SESSION_ID"]
    slug = os.getcwd().replace("/", "-")
    candidates = [os.path.expanduser(f"~/.claude/projects/{slug}/{sid}.jsonl")]
    candidates += glob.glob(os.path.expanduser(f"~/.claude/projects/*/{sid}.jsonl"))
    for path in candidates:
        if os.path.exists(path):
            try:
                models = re.findall(r'"model"\s*:\s*"([^"]+)"', open(path, encoding="utf-8", errors="ignore").read())
                models = [x for x in models if x and x != "<synthetic>"]
                if models:
                    current = models[-1]
                    break
            except OSError:
                pass

def model_class(model):
    if not model:
        return None
    n = re.sub(r'[^a-z0-9]', '', model.lower())
    # Route slugs first (haiku, sonnet, opus, opencode/deepseek-...), then
    # distinctive name tokens. Vendor words alone ("claude", "gpt") match every
    # model in the family and would make the answer ambiguous.
    stop = {"claude", "gpt", "model", "vendor"}
    route_hits, token_hits = set(), set()
    for cls, names in classes.items():
        for name in names:
            for slug in [s for s in routes.get(name, {}).values() if s and s != "—"]:
                sn = re.sub(r'[^a-z0-9]', '', slug.lower())
                if len(sn) >= 4 and (sn in n or n in sn):
                    route_hits.add(cls)
            for token in re.split(r'[^A-Za-z0-9]+', name):
                tn = re.sub(r'[^a-z0-9]', '', token.lower())
                if len(tn) >= 4 and tn not in stop and tn in n:
                    token_hits.add(cls)
    hits = route_hits or token_hits
    return hits.pop() if len(hits) == 1 else None

if current:
    cls = model_class(current)
    if cls:
        print(f"Current model: {current} ({cls}).")
        if rank.get(cls, 0) < rank.get(derived, 0):
            print("This session is below the required class. Switch when ready; this guidance never blocks the session.")
            print("Advice only: the engineer runs the switch; this skill never changes the model.")
        elif rank.get(cls, 0) > rank.get(derived, 0):
            print("This session is above the required class. Cost note: a lower-class issue in a frontier session pays the frontier rate; switching is optional.")
        else:
            print("This session matches the required class.")
    else:
        print(f"Current model: {current} (class not in the map) — showing the required class without a comparison.")
else:
    print("Current model: not readable in this harness — showing the required class and switch command without a comparison.")
print("Advice only: the engineer runs the switch; this skill never changes the model.")
PY
```

## What the output means

- **Required class** is the rule's output for this issue's `risk:` labels. It is a class, never
  a model name; the switch command is resolved through the records route table.
- **A human finishes this** names any `gate:` labels. The skill does not enforce them.
- **Below class** is advice. The engineer may proceed; there is no acknowledgement to give.
- **Above class** is a cost note only.
- **No current model** means the harness did not expose it. The skill prints the required class
  and command without comparing — it never guesses.

## Harness notes

- **Claude Code** installs the skill at `.claude/skills/pickup/SKILL.md` (per-repo).
- **opencode v2** installs at `.opencode/skills/pickup/SKILL.md` (project) or
  `~/.config/opencode/skills/pickup/SKILL.md` (global) — the same `SKILL.md` file type, with
  skill ID `pickup`. v2 also reads the `.claude/skills` and `.agents/skills` compatibility
  paths. Invoke it by name/`@pickup`; the `/pickup` trigger is the Claude Code slash form.
- Neither harness exposes the current model as a documented environment variable. Claude Code's
  session transcript carries it and the block reads it best-effort; opencode uses the
  no-comparison path.
