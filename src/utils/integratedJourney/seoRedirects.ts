/**
 * Edge-safe (no Node APIs, no data fetching) legacy-URL rewrites run from
 * `src/middleware.ts` (SEO redirect ticket, rule U10: every legacy URL is one
 * permanent hop to the normalised current URL).
 *
 * Why middleware and not `next.config.ts` `redirects()`:
 *  - Static redirects always merge the incoming query string into the
 *    destination (see `prepareDestination` in Next.js), so they cannot drop a
 *    single param such as `threads`.
 *  - The old `/teachers/key-stages/:ks/subjects/:path*` → `/` rule threw away
 *    46 programme-listing URLs; the correct destination depends on the key
 *    stage and subject, which a static rule can't express.
 *
 * Two jobs:
 *  1. `/teachers/curriculum/{slug}/units` → `/teachers/programmes/{slug}/units`
 *     with the thread dropped (a redirect into a noindexed thread page would
 *     waste the legacy URL) and the default KS4 board resolved so the hop is
 *     final. Every other query parameter is carried over.
 *  2. `/teachers/key-stages/{ks}/subjects/{subject}[/programmes]` → the
 *     programme page for that subject/phase with the key stage as a filter
 *     (default board resolved from KS4_EXAMBOARD_PREFERENCE). The listing
 *     without a subject has no successor page and goes to the homepage.
 *
 * Direct `/teachers/programmes/*?threads=` requests are NOT touched: thread
 * URLs stay distinct (shared links, analytics) and are `noindex, follow`.
 */
import {
  KS4_EXAMBOARD_PREFERENCE,
  SCIENCE_CHILD_SUBJECT_SLUGS,
} from "@/utils/curriculum/ks4ExamboardPreference";

/** Parameters that are never carried into a redirect destination. */
export const DROPPED_LEGACY_SEARCH_PARAMS = ["threads", "learning-theme"];

const PROGRAMMES_PREFIX = "/teachers/programmes/";
const SITE_ROOT = "/";

const KEY_STAGE_PHASE: Record<string, "primary" | "secondary"> = {
  ks1: "primary",
  ks2: "primary",
  ks3: "secondary",
  ks4: "secondary",
};

const LEGACY_KEY_STAGE_SUBJECTS_RE =
  /^\/teachers\/key-stages\/([^/]+)\/subjects(?:\/([^/]+))?(?:\/.*)?$/;

const LEGACY_CURRICULUM_UNITS_RE =
  /^\/teachers\/curriculum\/([^/]+)\/units\/?$/;

/**
 * Adds the default KS4 board to a board-less secondary slug
 * (`english-secondary` → `english-secondary-aqa`). Slugs that already carry
 * a board, primary slugs and subjects with no preference are returned as is.
 */
export function withDefaultBoard(subjectPhaseSlug: string): string {
  const match = subjectPhaseSlug.match(/^(.+)-secondary$/);
  if (!match) {
    return subjectPhaseSlug;
  }
  const board = KS4_EXAMBOARD_PREFERENCE[match[1]!];
  return board ? `${subjectPhaseSlug}-${board}` : subjectPhaseSlug;
}

function setSearch(url: URL, params: URLSearchParams): URL {
  // Avoid emitting a bare trailing `?`.
  url.search = params.toString() ? `?${params.toString()}` : "";
  return url;
}

/**
 * `/teachers/curriculum/{slug}/units[?…]` → `/teachers/programmes/{slug}[-board]/units[?…]`
 * with `threads` / `learning-theme` dropped, or `null` if `url` is not one.
 */
export function getLegacyCurriculumUnitsRedirectUrl(url: URL): URL | null {
  const match = url.pathname.match(LEGACY_CURRICULUM_UNITS_RE);
  if (!match) {
    return null;
  }
  const next = new URL(url.toString());
  next.pathname = `${PROGRAMMES_PREFIX}${withDefaultBoard(match[1]!)}/units`;
  const params = new URLSearchParams(url.search);
  for (const key of DROPPED_LEGACY_SEARCH_PARAMS) {
    params.delete(key);
  }
  return setSearch(next, params);
}

/**
 * Builds the `/teachers/programmes/{subject}-{phase}[-{board}]/units?keystages=`
 * URL for a legacy key-stage subject listing, or `null` if `url` is not one.
 */
export function getLegacyKeyStageRedirectUrl(url: URL): URL | null {
  const match = url.pathname.match(LEGACY_KEY_STAGE_SUBJECTS_RE);
  if (!match) {
    return null;
  }
  const [, keyStageSlug, subjectSlug] = match;
  const phase = keyStageSlug ? KEY_STAGE_PHASE[keyStageSlug] : undefined;

  const next = new URL(url.toString());
  next.search = "";

  // Unknown key stage (EYFS is handled by next.config.ts before we get here),
  // or the subject listing itself: there is no successor page, so one hop to
  // the homepage (`/teachers` would only 301 there again).
  if (!phase || !subjectSlug) {
    next.pathname = SITE_ROOT;
    return next;
  }

  const isScienceChild =
    phase === "secondary" && SCIENCE_CHILD_SUBJECT_SLUGS.has(subjectSlug);
  const programmeSubject = isScienceChild ? "science" : subjectSlug;
  const board =
    phase === "secondary" ? KS4_EXAMBOARD_PREFERENCE[programmeSubject] : null;

  next.pathname = `${PROGRAMMES_PREFIX}${[programmeSubject, phase, board]
    .filter(Boolean)
    .join("-")}/units`;
  next.searchParams.set("keystages", keyStageSlug!);
  if (isScienceChild) {
    next.searchParams.set("child_subjects", subjectSlug);
  }
  return next;
}

/** Single entry point for middleware: the URL to 308 to, or `null`. */
export function getSeoRedirectUrl(url: URL): URL | null {
  return (
    getLegacyCurriculumUnitsRedirectUrl(url) ??
    getLegacyKeyStageRedirectUrl(url)
  );
}
