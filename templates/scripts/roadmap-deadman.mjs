// template: scripts/roadmap-deadman.mjs v1.0.0 · updated 2026-11-04
// roadmap-deadman helper  [governance template — copy to <project>/scripts/]
//
// The decision logic behind workflows/roadmap-deadman.yml, the watchdog of
// the backlog-grooming regime's weekly run (templates/backlog-grooming.md §7).
// A helper the workflow imports, not a lint with a CLI — hence not named
// check-*.mjs. Kept out of the workflow's shell so the forced-stale / fresh
// split and the PR-collection path have hermetic tests (no gh, no network):
// a deadman that never fires is indistinguishable from a healthy system.
// Extracted 2026-11-04 from ai-fleet (#3093); issue numbers here are ai-fleet's.

/** The title prefix the weekly run's PR carries (§4 step 4 of the policy):
 *  `chore(roadmap): roadmap-groom (data + narrative)`. It names no cadence, so
 *  an on-demand run titled the same way also counts. */
export const WEEKLY_PR_TITLE = 'chore(roadmap): roadmap-groom';

/** The generated artifact whose presence in a PR's diff proves the weekly run ran. */
export const GENERATED_FILE = 'docs/roadmap-data.md';

/**
 * The `gh pr list --search` expression: the bare 'roadmap-groom' substring —
 * which also matches any design or tracking PR that mentions the run. The precise-title + generated-
 * file guard in selectArtifactPrs is what excludes those; the search alone is
 * only a candidate filter.
 */
export function weeklyPrSearch() {
  return '"roadmap-groom" in:title';
}

/**
 * Keep only PRs that are genuinely the weekly run's output: the exact title
 * (`chore(roadmap): roadmap-groom …`) AND the generated file in the diff.
 * `prs` is the parsed `gh pr list --json number,title,createdAt,files` array.
 * A title match without the file (a draft opened before the run died, or a
 * design/tracking PR that merely mentions the substring) is not evidence.
 */
export function selectArtifactPrs(prs) {
  if (!Array.isArray(prs)) return [];
  return prs.filter(
    (pr) =>
      pr &&
      typeof pr.title === 'string' &&
      pr.title.includes(WEEKLY_PR_TITLE) &&
      Array.isArray(pr.files) &&
      pr.files.some((f) => (typeof f === 'string' ? f : f?.path) === GENERATED_FILE),
  );
}

/** Newest createdAt (YYYY-MM-DD) among qualifying PRs, or '' when none. */
export function newestArtifactPrDate(prs) {
  const dates = selectArtifactPrs(prs)
    .map((pr) => (typeof pr.createdAt === 'string' ? pr.createdAt.slice(0, 10) : ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  return dates.sort().at(-1) ?? '';
}
//
// Kind: PROBE support. The workflow runs this against repo artifacts only and
// never touches prod credentials; this module does no I/O of its own.

/** Days since a YYYY-MM-DD date, against a `today` YYYY-MM-DD. Floor division. */
export function ageInDays(newest, today) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${newest}T00:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

/**
 * The newest artifact date from the two sources the probe reads.
 * `commitDate`  — `git log -1 --format=%cs -- docs/roadmap-data.md` (empty when
 *                 the file has no history yet — the cold start).
 * `prDate`      — the newest `roadmap-groom` PR's createdAt date (empty when none).
 * Both empty ⇒ the epoch, so a cold start reads as maximally stale and fires.
 */
export function newestArtifact(commitDate, prDate) {
  const dates = [commitDate, prDate].filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dates.length === 0) return '1970-01-01';
  return dates.sort().at(-1);
}

/**
 * The probe's verdict. `stale` is `AGE_DAYS >= MAX_AGE_DAYS`. On the weekly
 * cadence the workflow sets MAX_AGE_DAYS = 8: Monday's artifact is 7 days old
 * the next Monday, so a missed Monday run fires on Tuesday — one day of grace
 * for a late or hand-rerun pass, never a second missed week.
 *
 * Strictly-greater (`>`) fired one day late, so a run that stopped producing
 * went unreported on exactly the day its outage first became observable
 * (ai-fleet #3728). The boundary is `>=`, and the tests pin it.
 */
export function classifyFreshness({ commitDate, prDate, today, maxAgeDays }) {
  const newest = newestArtifact(commitDate, prDate);
  const ageDays = ageInDays(newest, today);
  return { newest, ageDays, stale: ageDays >= maxAgeDays };
}
