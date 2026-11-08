#!/usr/bin/env node
// template: hooks/pickup-guidance.mjs v1.0.0 · updated 2026-11-07
/**
 * First-prompt pickup hook — Claude Code `UserPromptSubmit` command.
 *
 * Reads the hook JSON on stdin, acts only on the session's first prompt, and
 * writes the pickup guidance to stdout (which Claude Code adds as context).
 *
 * FAIL-OPEN, ALWAYS. No gh, no network, an unknown issue, malformed labels, a
 * missing rule, bad stdin, a missing resolver, an unwritable state dir — every
 * one exits 0 with no stdout. It never exits 2, so it cannot block a prompt.
 * It never rewrites the prompt and never switches the model.
 *
 * Install: .claude/hooks/pickup-guidance.mjs (+ scripts/pickup-guidance.mjs)
 * Settings: hooks.UserPromptSubmit in .claude/settings.json
 * Opt out: "pickupGuidance": false or "disableAllHooks": true in ~/.claude/settings.json,
 *          or PICKUP_HOOK=off.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

function userDisabled() {
  if (process.env.PICKUP_HOOK === 'off') return true;
  try {
    const settings = JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8'));
    return settings.pickupGuidance === false || settings.disableAllHooks === true;
  } catch {
    return false;
  }
}

async function main() {
  if (userDisabled()) return;

  let input = '';
  try {
    input = readFileSync(0, 'utf8');
  } catch {
    return;
  }

  let event;
  try {
    event = JSON.parse(input);
  } catch {
    return;
  }
  if (event?.hook_event_name !== 'UserPromptSubmit') return;

  const sessionID = event.session_id;
  if (!sessionID) return;

  // First prompt only. Mark the session before resolving: a resolution failure
  // must not make a later prompt eligible.
  const stateDir = process.env.PICKUP_HOOK_STATE || join(tmpdir(), 'repo-governance-pickup');
  const marker = join(stateDir, `seen-${sessionID}`);
  try {
    if (existsSync(marker)) return;
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(marker, '1', { flag: 'wx' });
  } catch {
    return;
  }

  let mod;
  try {
    mod = await import('../../scripts/pickup-guidance.mjs');
  } catch {
    return;
  }

  const repo = process.env.ROUTING_REPO || mod.detectRepo();
  if (!repo) return;
  const state = mod.resolveForPrompt(event.prompt ?? '', { repo, harness: 'claude' });
  if (!state) return;
  process.stdout.write(mod.formatGuidance(state, mod.claudeCurrentModel(), { prefix: '[pickup] ', harness: 'claude' }) + '\n');
}

main().catch(() => {
  // A hook that throws can surface a non-blocking error; this one adds nothing.
  process.exit(0);
});
