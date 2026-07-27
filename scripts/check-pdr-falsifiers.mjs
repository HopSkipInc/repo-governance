#!/usr/bin/env node
/**
 * lint:pdr-falsifiers  [repo-governance's own lint — strong template candidate, see below]
 *
 * A decision without a falsifier is a wish. Every Accepted PDR must carry the
 * observable condition that would retire it, and the audit must be able to tell
 * when that condition has come due.
 *
 * Audit domain 6 (PDR coherence) already specifies these checks, but it runs
 * inside a model-driven scheduled audit — and repo-governance does not run one on
 * itself. Two of the domain's checks need no judgment at all, so they belong in a
 * lint that runs on every PR:
 *
 *   R1 falsifier-present  an Accepted PDR has at least one `- [ ] Revisit ...`
 *   R2 falsifier-vague    the condition uses a phrase the PDR template names as
 *                         insufficient — "revisit later", "at next planning"
 *   R3 falsifier-opaque   nothing date-, threshold-, or event-shaped detected
 *                         (WARN — heuristic; domain 6 of the audit adjudicates)
 *   R4 falsifier-due      an unchecked `Revisit by YYYY-MM-DD` whose date has
 *                         passed (report — the bet is not wrong, it is owed a look)
 *
 * R4 is the one that makes the corpus live. Without it a falsifier is a sentence
 * someone wrote once, and the record rots exactly as silently as the undocumented
 * decision it replaced.
 *
 * WHY R2 AND R3 ARE SPLIT, which was not the first design. The first version tried
 * to *positively prove* observability: match a date, a digit threshold, or a verb
 * from a closed list. Run against this repo's own seven records it failed five of
 * them — "three or more inbound conversations", "twice in the same client repo",
 * "more than one quarter behind" are all perfectly checkable and none contain a
 * digit or a listed verb. The records were right and the lint was wrong.
 *
 * Proving a condition IS observable is a judgment call, and this practice's own
 * rule is that judgment calls belong in probes and only deterministic checks belong
 * in gates. So the gate does the deterministic half — the template publishes a
 * closed list of insufficient phrasings, and matching that list is mechanical. The
 * heuristic half reports and never blocks. Loosening it into a gate that passes
 * everything would have been the worse repair: a check that fails open reads as
 * evidence.
 *
 * WHY THIS IS NOT YET A TEMPLATE: it should be, and it applies to any repo with
 * docs/pdr/. It is being run here first because this practice ships templates
 * before dogfooding them more often than it should, and the last two times that
 * happened the bugs were found by a client's CI. Promote it after one refresh
 * cycle proves the rules are right.
 *
 * R1–R2 GATE. R3–R4 report (WARN→FAIL convention).
 *
 * Wiring:  node scripts/check-pdr-falsifiers.mjs
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const PDR_DIR = join(ROOT, 'docs/pdr');

/** A record. `_template.md` is the blank form and is never a record. */
const RECORD = /^\d{3,4}-.+\.md$/;

/** Any falsifier line at all. */
const FALSIFIER = /^\s*[-*]\s*\[( |x|X)\]\s*Revisit\b(.*)$/gm;

/**
 * R2: phrasings the PDR template explicitly calls insufficient. A closed list,
 * published in the form itself, which is what makes matching it a gate rather
 * than an opinion.
 */
const VAGUE = [
  /\brevisit later\b/i,
  /\bat (the )?next (planning|cycle|review|quarter)\b/i,
  /\bwhen (appropriate|convenient|it makes sense|we have time)\b/i,
  /\bif (this )?stops working\b/i,
  /\bperiodically\b/i,
];
/**
 * R3: heuristic only. Counts spelled out in words are as checkable as digits —
 * "three or more inbound conversations" is not vaguer than "3+". Anything this
 * misses is reported, never blocked.
 */
const NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|twice|once)';
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const OBSERVABLE = [
  DATE,
  new RegExp(`\\b(?:\\d+|${NUMBER_WORD})\\b`, 'i'),
  /\b(more|fewer|less|greater|at least|exceeds?|above|below|under|over)\b/i,
  /\b(when|if|once)\b.+\b(closes?|fires?|ships?|publishes?|lands?|arrives?|renews?|churns?|asks?|reports?|fails?|exists?|produces?|opens?|drifts?|generates?|asserts?)\b/i,
];

/** R4: `Revisit by YYYY-MM-DD`, unchecked, in the past. */
const DUE_BY = /^\s*[-*]\s*\[ \]\s*Revisit by\s+(\d{4}-\d{2}-\d{2})\b/gm;

const findings = [];
const warnings = [];
const due = [];

if (!existsSync(PDR_DIR)) {
  console.log('check-pdr-falsifiers: no docs/pdr/ — nothing to check.');
  process.exit(0);
}

const records = readdirSync(PDR_DIR).filter((n) => RECORD.test(n)).sort();
const today = new Date().toISOString().slice(0, 10);

for (const name of records) {
  const body = readFileSync(join(PDR_DIR, name), 'utf8');
  const status = (body.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1] ?? '').trim();
  const accepted = /^Accepted\b/i.test(status);

  const lines = [...body.matchAll(FALSIFIER)];

  if (accepted && lines.length === 0) {
    findings.push({
      rule: 'R1',
      file: name,
      message: 'Status is Accepted with no falsifier line. A decision without a falsifier is a wish — add `- [ ] Revisit by YYYY-MM-DD when <observable condition>`, or drop the status back to Proposed',
    });
    continue;
  }

  for (const [, , conditionRaw] of lines) {
    const condition = conditionRaw.trim();
    if (!accepted) continue;
    if (VAGUE.some((p) => p.test(condition))) {
      findings.push({
        rule: 'R2',
        file: name,
        message: `falsifier uses a phrasing the form rules out ("${condition.slice(0, 70)}") — the sweep cannot tell whether it is due. Name a date, a threshold, or an event someone could check without a meeting`,
      });
      continue;
    }
    if (!OBSERVABLE.some((p) => p.test(condition))) {
      warnings.push({
        rule: 'R3',
        file: name,
        message: `nothing date-, threshold-, or event-shaped detected ("${condition.slice(0, 70)}"). Heuristic, not a verdict — if the condition is genuinely checkable, leave it; domain 6 of the audit adjudicates`,
      });
    }
  }

  for (const [, date] of body.matchAll(DUE_BY)) {
    if (date < today) due.push({ file: name, date });
  }
}

console.log(`check-pdr-falsifiers: ${records.length} record(s) in docs/pdr/.`);

if (due.length) {
  console.log(`\nDUE (${due.length}) — the condition arrived; re-confirm, supersede, or check the line off:`);
  for (const d of due) console.log(`  ${d.file} — revisit date ${d.date} has passed`);
}

if (warnings.length) {
  console.log(`\nWARN (${warnings.length}):`);
  for (const w of warnings.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`  ${w.file} [${w.rule}] ${w.message}`);
  }
}

if (!findings.length) {
  console.log('\nOK: every Accepted record carries a falsifier, and none use a phrasing the form rules out.');
  process.exit(0);
}

console.error(`\nFAILED: ${findings.length} finding(s):`);
for (const f of findings.sort((a, b) => a.file.localeCompare(b.file))) {
  console.error(`  ${f.file} [${f.rule}] ${f.message}`);
}
process.exit(1);
