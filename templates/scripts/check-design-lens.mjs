// template: scripts/check-design-lens.mjs v1.0.0 · updated 2026-08-02
/**
 * lint:design-lens  [governance template — copy to the target repo's scripts/]
 *
 * Every ADR carries a **Lens:** line (docs/design-lenses.md §5.1) declaring the
 * claim class it asserts, the discipline borrowed, a falsifiable prediction, where
 * it was checked, and the result. This lint is the mechanical floor under that
 * policy — the honest subset of §5.2's enforcement table:
 *
 *   R1 (gate)  every non-grandfathered docs/adr/NNN-*.md has a **Lens:** line
 *   R2 (gate)  the line names a claim class from the policy §3 table, a
 *              records-file §3 extension, or the `none — <reason>` form
 *   R3 (gate)  every path-shaped token in `checked:` resolves to a real file —
 *              a fabricated Lens line whose paths must exist costs nearly as
 *              much to fake as to write honestly
 *   R4 (gate)  a `result:` segment is present and starts with confirmed / not found
 *   R5 (WARN)  `result: confirmed` carries no consequence — no issue reference
 *              and no trailing detail. Reported, never gated: whether a
 *              consequence is adequate is a judgment call, and a lint that
 *              gates on judgment converts it into ritual (§5.2)
 *
 * What this lint deliberately does NOT check: that the prediction is genuinely
 * falsifiable, that the check was performed honestly, that the right lens was
 * chosen. Those are human review, and pretending otherwise would be worse than
 * no lint — a green check on `predicted: it's fine` teaches the team the line
 * is ceremony.
 *
 * Grandfathering: pre-existing ADRs go in GRANDFATHERED below, with a tracking
 * issue for the backfill. Do not bulk-backfill (policy §10.1) — a retrofit pass
 * produces exactly the ritual compliance the policy warns about.
 *
 * Wiring (ai-fleet pattern):
 *   package.json:  "lint:design-lens": "node scripts/check-design-lens.mjs"
 *   check script:  && npm run lint:design-lens
 *   CI: add a step running it, same as the other governance lints.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import { execSync } from 'child_process';

function repoRoot() {
  try { return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
  catch { return process.cwd(); }
}

const ROOT = repoRoot();
const ADR_DIR = join(ROOT, 'docs/adr');
const RECORDS = join(ROOT, 'docs/design-lenses-records.md');

/**
 * Pre-existing ADRs exempt from R1, by filename. Every entry needs the tracking
 * issue for its backfill. Tests may extend this via DESIGN_LENS_GRANDFATHER
 * (comma-separated filenames); the in-repo list is the one that counts.
 */
const GRANDFATHERED = new Set(
  [
    // '001-example.md', // backfill tracked in #NNN
  ].concat((process.env.DESIGN_LENS_GRANDFATHER ?? '').split(',').map((s) => s.trim()).filter(Boolean))
);

/**
 * The policy §3 claim classes, matched by stem so "measurement trustworthiness"
 * and "a measurement is trustworthy" both resolve. Extensions come from the
 * records file — declaring one there is what makes it lint-valid.
 */
const CLASS_STEMS = [
  'measurement', 'judgment', 'judgement', 'feedback', 'human', 'boundary',
  'economic', 'distributed', 'estimate', 'plan',
];

/** Claim classes declared in the records file §3 (first table cell per row). */
function recordsExtensions() {
  if (!existsSync(RECORDS)) return [];
  const src = readFileSync(RECORDS, 'utf8');
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^##\s*3\./.test(l));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    const m = lines[i].match(/^\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const cell = m[1].trim();
    if (!cell || /^-+$/.test(cell) || /^claim class$/i.test(cell)) continue;
    out.push(cell.toLowerCase());
  }
  return out;
}

/** Every file in the repo, for resolving checked: tokens. Filesystem walk, not
 *  git ls-files — the lint must also see files not yet staged. */
function repoFiles(dir = ROOT, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) repoFiles(p, acc);
    else acc.push(relative(ROOT, p));
  }
  return acc;
}

const violations = [];
const warnings = [];

if (!existsSync(ADR_DIR)) {
  console.log('OK — no docs/adr/ directory; nothing to check.');
  process.exit(0);
}

const adrs = readdirSync(ADR_DIR).filter((f) => /^\d{3}-.*\.md$/.test(f)).sort();
const extensions = recordsExtensions();
let files = null; // lazy — only walked if some Lens line names a path

for (const adr of adrs) {
  if (GRANDFATHERED.has(adr)) continue;
  const src = readFileSync(join(ADR_DIR, adr), 'utf8');
  // The line may wrap — the policy's own §5.1 worked example does. Join
  // continuation lines until a blank line or the next front-matter/heading line.
  const srcLines = src.split('\n');
  const at = srcLines.findIndex((l) => /^\*\*Lens:\*\*/.test(l.trim()));
  let line = null;
  if (at !== -1) {
    const parts = [srcLines[at].trim()];
    for (let i = at + 1; i < srcLines.length; i++) {
      const t = srcLines[i].trim();
      if (!t || /^(\*\*|#|```|\||-)/.test(t)) break;
      parts.push(t);
    }
    line = parts.join(' ');
  }

  if (!line) {
    violations.push(`R1 ${adr}: no **Lens:** line. Every ADR declares its claim class at Proposed (docs/design-lenses.md §5.1); add the line, or grandfather this ADR in the script with a tracking issue.`);
    continue;
  }

  const body = line.trim().replace(/^\*\*Lens:\*\*\s*/, '');

  // `none — <reason>` is a complete, challengeable entry.
  if (/^none\b/i.test(body)) {
    if (!/^none\s*[—-]\s*\S/.test(body)) {
      violations.push(`R2 ${adr}: \`Lens: none\` needs a reason — write \`none — <why this ADR makes no external claim>\`.`);
    }
    continue;
  }

  const classSegment = body.split(/[→·]/)[0].trim().toLowerCase();
  const known = CLASS_STEMS.some((s) => classSegment.includes(s)) || extensions.some((e) => classSegment.includes(e) || e.includes(classSegment));
  if (!known) {
    violations.push(`R2 ${adr}: claim class "${classSegment}" is not in the policy §3 table or the records file §3 extensions. Use a real class, or declare the extension (with evidence) in docs/design-lenses-records.md first.`);
  }

  const checked = body.match(/checked:\s*([^·]+)/i)?.[1]?.trim();
  if (!checked) {
    violations.push(`R3 ${adr}: no \`checked:\` segment — the line must state where the prediction was checked.`);
  } else {
    // Path-shaped tokens: contain a slash or a file extension. Prose ("the
    // EvalCase schema") is legitimate and skipped — R3 gates fabricated paths,
    // not loose descriptions.
    const tokens = checked.split(/[,;]/).map((t) => t.replace(/[`"'()]/g, '').trim())
      .filter((t) => /^[\w./-]+\.\w{1,10}$/.test(t) || (t.includes('/') && /^[\w./-]+$/.test(t)));
    for (const tok of tokens) {
      files ??= repoFiles();
      const hit = files.some((f) => f === tok || f.endsWith('/' + tok) || basename(f) === basename(tok));
      if (!hit) {
        violations.push(`R3 ${adr}: checked path "${tok}" does not exist in this repo. A Lens line naming files that are not there is the cheapest form of ritual compliance, and it is the one this rule closes.`);
      }
    }
  }

  const result = body.match(/result:\s*(.+)$/i)?.[1]?.trim();
  if (!result || !/^(confirmed|not found)/i.test(result)) {
    violations.push(`R4 ${adr}: \`result:\` must be present and start with \`confirmed\` or \`not found\`. \`not found\` is a complete, valid entry — record it.`);
  } else if (/^confirmed/i.test(result) && !/#\d+/.test(result) && !/^confirmed\s*[—-]\s*\S/.test(result)) {
    warnings.push(`R5 ${adr}: \`result: confirmed\` with no consequence — no issue reference and no detail. A confirmed prediction that changed nothing is worth a sentence about why.`);
  }
}

for (const w of warnings) console.log(`WARN ${w}`);
if (violations.length) {
  for (const v of violations) console.error(`DESIGN-LENS VIOLATION: ${v}`);
  console.error(`\n${violations.length} violation(s). Policy: docs/design-lenses.md §5.`);
  process.exit(1);
}

console.log(`OK: ${adrs.length} ADR(s) checked, ${GRANDFATHERED.size} grandfathered, ${extensions.length} local extension(s) honoured${warnings.length ? `, ${warnings.length} warning(s)` : ''}.`);
