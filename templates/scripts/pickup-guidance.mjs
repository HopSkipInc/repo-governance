#!/usr/bin/env node
// template: scripts/pickup-guidance.mjs v1.1.0 · updated 2026-11-07
/**
 * pickup-guidance  [governance template — copy to <project>/scripts/]
 *
 * The one resolver behind `/pickup`, the Claude Code first-prompt hook, and the
 * opencode v2 first-prompt plugin (PDR-011 decision 6). It reads an issue's
 * `risk:` labels, applies the records-held risk→class rule, resolves the class
 * to a model through the records §2 route table, and formats the advisory.
 *
 * It never blocks, never switches the model, and never writes. Every failure
 * path returns null (or prints a one-line explanation in command mode) — the
 * hooks are required to let the prompt through on any error.
 *
 * Command mode (the /pickup skill):
 *   node scripts/pickup-guidance.mjs <issue> [--harness claude|opencode]
 *        [--current-model <model>] [--repo owner/repo] [--records <path>]
 *
 * Exit 0 always. The output is the guidance; an unresolved issue prints a
 * short explanation, not a stack trace.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const NONE = '(none)';
const RANK = { standard: 1, frontier: 2 };
const RULE_HEADING = /^##[ \t]*\d*\.?[ \t]*Risk.*class rule/i;
const CLASS_HEADING = /^##[ \t]*\d*\.?[ \t]*Model.*class/i;
const ROUTE_HEADING = /^##[ \t]*\d*\.?[ \t]*Model.*harness route/i;

function rowsAfter(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return null;
  const rows = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##[ \t]/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim().replace(/[`*]/g, ''));
    if (!cells.length || cells.every((c) => /^-+$/.test(c || '-'))) continue;
    rows.push(cells);
  }
  return rows;
}

/** Parse §1, §2 and §8 from a records file. Throws when the rule is unreadable. */
export function readRecords(path) {
  const text = readFileSync(path, 'utf8');
  const ruleRows = rowsAfter(text, RULE_HEADING);
  if (!ruleRows) throw new Error('no Risk → class rule section');
  const rule = {};
  for (const row of ruleRows) {
    if (row.length < 2 || /^risk (label|set)$/i.test(row[0]) || /^minimum class$/i.test(row[1])) continue;
    const label = row[0].toLowerCase();
    const cls = row[1].toLowerCase();
    if (label !== NONE && !label.startsWith('risk:')) throw new Error(`bad rule label ${label}`);
    if (!(cls in RANK)) throw new Error(`rule maps ${label} to non-class ${cls}`);
    rule[label] = cls;
  }
  if (!rule[NONE]) throw new Error(`no ${NONE} row`);
  const classes = {};
  for (const row of (rowsAfter(text, CLASS_HEADING) ?? [])) {
    if (row.length >= 2 && row[0].toLowerCase() in RANK) {
      classes[row[0].toLowerCase()] = row[1].split(',').map((s) => s.trim()).filter((s) => s && s !== '—');
    }
  }
  const routes = {};
  for (const row of (rowsAfter(text, ROUTE_HEADING) ?? [])) {
    if (!row[0] || /^model$/i.test(row[0])) continue;
    routes[row[0]] = { claude: row[1] ?? '—', opencode: row[2] ?? '—' };
  }
  return { rule, classes, routes };
}

/** `#N` or a GitHub issue URL for this repo. Returns { number, repo } or null. */
export function parseIssueRef(text, repo) {
  if (!text) return null;
  const url = String(text).match(/https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)/i);
  if (url) {
    const slug = `${url[1]}/${url[2]}`.toLowerCase();
    if (repo && slug !== repo.toLowerCase()) return null;
    return { number: url[3], repo: slug };
  }
  const hash = String(text).match(/(?:^|[^\w])#(\d+)\b/);
  if (hash) return { number: hash[1], repo: repo ? repo.toLowerCase() : null };
  return null;
}

export function detectRepo(exec = execFileSync) {
  if (process.env.ROUTING_REPO) return process.env.ROUTING_REPO;
  const out = exec('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' });
  return String(out).trim();
}

export function readIssue(number, repo, exec = execFileSync) {
  const out = exec('gh', ['issue', 'view', String(number), '--repo', repo, '--json', 'number,title,labels'], { encoding: 'utf8' });
  return JSON.parse(out);
}

function routeFor(records, cls, harness) {
  if (!harness) return null;
  for (const model of records.classes[cls] ?? []) {
    const slug = records.routes[model]?.[harness];
    if (slug && slug !== '—') return { model, slug };
  }
  return null;
}

function modelClass(model, records) {
  if (!model) return null;
  const n = String(model).toLowerCase().replace(/[^a-z0-9]/g, '');
  const stop = new Set(['claude', 'gpt', 'model', 'vendor', 'hopskip', 'gateway']);
  const routeHits = new Set();
  const tokenHits = new Set();
  for (const [cls, models] of Object.entries(records.classes)) {
    for (const name of models) {
      for (const slug of Object.values(records.routes[name] ?? {})) {
        const sn = String(slug).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (sn && sn !== '' && sn.length >= 4 && (sn.includes(n) || n.includes(sn))) routeHits.add(cls);
      }
      for (const token of String(name).split(/[^A-Za-z0-9]+/)) {
        const tn = token.toLowerCase();
        if (tn.length >= 4 && !stop.has(tn) && n.includes(tn)) tokenHits.add(cls);
      }
    }
  }
  const hits = routeHits.size ? routeHits : tokenHits;
  return hits.size === 1 ? [...hits][0] : null;
}

/**
 * Resolve a prompt (or an issue number string) to the advisory state, or null
 * when the hook must add nothing. Never throws.
 */
export function resolveForPrompt(text, opts = {}) {
  try {
    const exec = opts.exec ?? execFileSync;
    const repo = opts.repo ?? detectRepo(exec);
    if (!repo) return null;
    const ref = parseIssueRef(text, repo);
    if (!ref) return null;
    const recordsPath = opts.recordsPath ?? join(process.cwd(), 'docs', 'agent-routing-records.md');
    if (!existsSync(recordsPath)) return null;
    const records = readRecords(recordsPath);
    const issue = readIssue(ref.number, repo, exec);
    // A malformed label entry is a fail-open case, not a silent drop: an
    // issue whose labels cannot be read must not be classified as standard.
    if (!Array.isArray(issue?.labels)) return null;
    const labels = [];
    for (const entry of issue.labels) {
      const name = typeof entry === 'string' ? entry : entry?.name;
      if (typeof name !== 'string' || !name.trim()) return null;
      labels.push(name);
    }
    const risks = labels.filter((l) => l.startsWith('risk:'));
    if (risks.some((r) => !records.rule[r])) return null;
    // The (none) row applies only when the issue carries zero risk labels; an
    // issue with labels takes the highest class among those rows. This is the
    // same semantics the equivalence check applies.
    let requiredClass;
    if (!risks.length) {
      requiredClass = records.rule[NONE];
    } else {
      requiredClass = null;
      for (const risk of risks) {
        if (!requiredClass || RANK[records.rule[risk]] > RANK[requiredClass]) requiredClass = records.rule[risk];
      }
    }
    if (!requiredClass) return null;
    return {
      number: issue.number ?? ref.number,
      title: issue.title ?? `Issue #${ref.number}`,
      risks,
      gates: labels.filter((l) => l.startsWith('gate:')),
      requiredClass,
      route: routeFor(records, requiredClass, opts.harness),
      records,
    };
  } catch {
    return null;
  }
}

function commandFor(state, harness) {
  if (!state.route) return null;
  if (harness === 'claude') return `/model ${state.route.slug}  (new session: claude --model ${state.route.slug})`;
  if (harness === 'opencode') return `opencode run -m ${state.route.slug}`;
  const routes = Object.entries(state.records.routes[state.route.model] ?? {})
    .filter(([, v]) => v && v !== '—')
    .map(([h, v]) => `${h}: \`${v}\``);
  return routes.join(' · ');
}

/** The advisory text. `prefix` is used by the hooks so injected context is identifiable. */
export function formatGuidance(state, currentModel = null, opts = {}) {
  const p = opts.prefix ?? '';
  const harness = opts.harness ?? (process.env.CLAUDECODE ? 'claude' : process.env.OPENCODE ? 'opencode' : null);
  const lines = [
    `${p}Issue #${state.number}: ${state.title}`,
    `${p}Risk: ${state.risks.length ? state.risks.join(', ') : '(zero risk labels)'}`,
    `${p}Required class: ${state.requiredClass}`,
  ];
  if (state.gates.length) lines.push(`${p}A human finishes this: ${state.gates.join(', ')}`);
  const cmd = commandFor(state, harness);
  if (cmd) lines.push(`${p}${harness === 'claude' ? 'Switch in this session: ' : harness === 'opencode' ? 'Start a session with: ' : 'Recorded routes: '}${cmd}`);
  else lines.push(`${p}No ${harness ?? 'harness'} route is recorded for the ${state.requiredClass} class.`);

  const cls = modelClass(currentModel, state.records);
  if (!currentModel) {
    lines.push(`${p}Current model: not readable in this harness — showing the required class without a comparison.`);
  } else if (!cls) {
    lines.push(`${p}Current model: ${currentModel} (class not in the map) — showing the required class without a comparison.`);
  } else {
    lines.push(`${p}Current model: ${currentModel} (${cls}).`);
    if (RANK[cls] < RANK[state.requiredClass]) {
      lines.push(`${p}This session is below the required class. Switch when ready; this guidance never blocks the session.`);
    } else if (RANK[cls] > RANK[state.requiredClass]) {
      lines.push(`${p}This session is above the required class. Cost note: a lower-class issue in a frontier session pays the frontier rate; switching is optional.`);
    } else {
      lines.push(`${p}This session matches the required class.`);
    }
  }
  lines.push(`${p}Advice only: the engineer runs the switch; this skill never changes the model.`);
  return lines.join('\n');
}

/** Best-effort current model for a Claude Code session. */
export function claudeCurrentModel() {
  const env = process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL || process.env.OPENCODE_MODEL;
  if (env) return env;
  try {
    const sid = process.env.CLAUDE_CODE_SESSION_ID;
    if (!sid) return null;
    const slug = process.cwd().replace(/\//g, '-');
    const candidates = [
      join(homedir(), '.claude', 'projects', slug, `${sid}.jsonl`),
      ...safeGlob(join(homedir(), '.claude', 'projects'), sid),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      const models = [...readFileSync(path, 'utf8').matchAll(/"model"\s*:\s*"([^"]+)"/g)]
        .map((m) => m[1])
        .filter((m) => m && m !== '<synthetic>');
      if (models.length) return models[models.length - 1];
    }
  } catch {}
  return null;
}

function safeGlob(dir, sid) {
  try {
    return readdirSync(dir).map((name) => join(dir, name, `${sid}.jsonl`));
  } catch {
    return [];
  }
}


/**
 * First-prompt-only state for the opencode v2 plugin. `onPrompt` computes once
 * per session; `onContext` consumes the guidance on the first model request.
 * Both swallow every error — a hook that throws can break a prompt.
 */
export function makeHookState() {
  const seen = new Set();
  const pending = new Map();
  return {
    onPrompt(sessionID, text, opts) {
      try {
        if (!sessionID || seen.has(sessionID)) return;
        seen.add(sessionID);
        const state = resolveForPrompt(text, opts);
        if (state) pending.set(sessionID, state);
      } catch {}
    },
    onContext(sessionID, model) {
      try {
        const state = pending.get(sessionID);
        if (!state) return null;
        pending.delete(sessionID);
        return formatGuidance(state, model, { prefix: '[pickup] ' });
      } catch {
        return null;
      }
    },
  };
}

// ---------------------------------------------------------------- CLI
// Command mode is the /pickup skill. It is not the hook path; a missing record
// prints an explanation instead of failing silently.

function cli(argv) {
  const args = [...argv];
  const value = (flag) => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    const v = args[i + 1] ?? null;
    args.splice(i, 2);
    return v;
  };
  const harness = value('--harness') ?? (process.env.CLAUDECODE ? 'claude' : process.env.OPENCODE ? 'opencode' : null);
  const current = value('--current-model');
  const repo = value('--repo');
  const records = value('--records');
  const number = args.find((a) => /^\d+$/.test(a));
  if (!number) {
    console.log('pickup needs an issue number: /pickup <issue>');
    return;
  }
  const state = resolveForPrompt(`#${number}`, {
    repo: repo ?? process.env.ROUTING_REPO,
    recordsPath: records,
    harness,
  });
  if (!state) {
    console.log(`pickup: could not resolve issue #${number} (no gh access, unknown issue, malformed labels, or no rule).`);
    return;
  }
  console.log(formatGuidance(state, current ?? claudeCurrentModel(), { harness }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    cli(process.argv.slice(2));
  } catch {
    // command mode still exits 0; the caller sees the message, not a stack.
  }
  process.exit(0);
}
