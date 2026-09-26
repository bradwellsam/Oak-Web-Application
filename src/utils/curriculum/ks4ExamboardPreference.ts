/**
 * Default KS4 option (exam board / core / gcse) per subject, used when a
 * secondary programme URL arrives without a board suffix.
 *
 * Lives in its own dependency-free module so it can be imported from
 * `src/middleware.ts` (edge runtime) as well as from `slugs.ts`.
 * Moved here from `slugs.ts` – see SEO redirect ticket. Every entry must be
 * an exam-board slug the subject actually publishes: `src/middleware.ts` uses
 * it without data to build one-hop destinations.
 */
export const KS4_EXAMBOARD_PREFERENCE: Record<string, string> = {
  "physical-education": "ocr",
  computing: "ocr",
  english: "aqa",
  geography: "aqa",
  spanish: "aqa",
  science: "aqa",
  german: "aqa",
  // `citizenship` is deliberately absent: its KS4 options are the `gcse` and
  // `core` pathways, not exam boards, so a board preference could never match
  // (and would send edge redirects to a non-existent `-aqa` slug). The page
  // resolves it from live data instead.
  music: "edexcel",
  french: "aqa",
  history: "edexcel",
  "religious-education": "aqa",
  "design-technology": "aqa",
};

/**
 * KS4 science child subjects that have their own legacy programme slugs
 * (`biology-secondary-ks4`, `/teachers/programmes/biology-secondary/…`).
 * They are served by the `science-secondary-{board}` programme with a
 * `child_subjects` filter.
 */
export const SCIENCE_CHILD_SUBJECT_SLUGS = new Set([
  "biology",
  "chemistry",
  "physics",
  "combined-science",
]);
