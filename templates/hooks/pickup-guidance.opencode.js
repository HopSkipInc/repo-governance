// template: hooks/pickup-guidance.opencode.js v1.1.0 · updated 2026-11-07
/**
 * First-prompt pickup hook — opencode v2 plugin.
 *
 * v2 exposes a `session.hook("prompt")` admission hook and a
 * `session.hook("context")` model-request hook. This plugin uses the first only
 * to observe the session's first prompt, and the second to add the pickup
 * guidance to the assembled system context on that session's first model call.
 * It never rewrites the prompt, blocks admission, or switches the model.
 *
 * FAIL-OPEN. Every path is wrapped; a resolver error, missing gh, missing rule,
 * malformed labels, or an unknown issue leaves the system context untouched.
 *
 * Install: .opencode/plugins/pickup-guidance.js (+ scripts/pickup-guidance.mjs)
 * Opt out: PICKUP_HOOK=off, or "plugins": ["-pickup-guidance"] in the user's
 *          ~/.config/opencode/opencode.json(c).
 */

import { Plugin } from "@opencode/plugin";
import { detectRepo, formatGuidance, makeHookState, resolveForPrompt } from "../../scripts/pickup-guidance.mjs";

export default Plugin.define({
  id: "pickup-guidance",
  async setup(ctx) {
    if (process.env.PICKUP_HOOK === "off") return;

    let repo;
    try {
      repo = process.env.ROUTING_REPO || detectRepo();
    } catch {
      return;
    }
    if (!repo) return;

    const state = makeHookState();
    const seenKey = (sessionID) => `pickup-seen:${sessionID}`;
    try {
      await ctx.session.hook("prompt", async (event) => {
        try {
          if (!event?.sessionID) return;
          if (await ctx.storage.get(seenKey(event.sessionID))) return;
          await ctx.storage.set(seenKey(event.sessionID), true);
          state.onPrompt(event.sessionID, event.prompt?.text ?? "", {
            repo,
            harness: "opencode",
            recordsPath: process.env.ROUTING_RECORDS,
          });
        } catch {}
      });

      await ctx.session.hook("context", async (event) => {
        try {
          const model = event.model ? `${event.model.providerID}/${event.model.id}` : null;
          const text = state.onContext(event.sessionID, model);
          if (text) event.system.push({ type: "text", text });
        } catch {}
      });
    } catch {
      // A hook registration failure must not affect prompts.
    }
  },
});
