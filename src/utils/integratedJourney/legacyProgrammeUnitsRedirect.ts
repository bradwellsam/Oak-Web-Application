/**
 * Redirects programme slugs (e.g. `citizenship-secondary-ks3`) to the
 * integrated teacher programme units page, with filters expressed as query params.
 *
 * SEO redirect ticket – what changed and why:
 *  - `learning-theme` is NO LONGER mapped to `threads`. That mapping was the
 *    discovery route Google used for the indexed `?threads=` URLs (every legacy
 *    `?learning-theme=` URL in the index 308'd straight to a self-canonical thread
 *    page). Legacy theme links now land on the clean key-stage page.
 *  - The redirect can resolve the default KS4 board at redirect time (via
 *    `resolveSubjectPhaseSlug`), so `english-secondary-ks3` goes to
 *    `english-secondary-aqa/units?keystages=ks3` in ONE hop instead of
 *    308 → `english-secondary/…` → 307 → `english-secondary-aqa/…`.
 *  - `year` → `years` and `category` → `subject_categories` are kept as before.
 *    Any other incoming param (including a modern `threads=`) is dropped, as before.
 *  - The destination query is written in canonical order and a year replaces
 *    its key stage, so the redirect lands on the URL the page canonicalises to.
 */
import { permanentRedirect } from "next/navigation";

import { resolveOakHref } from "@/common-lib/urls";
import type { UrlQueryObject } from "@/common-lib/urls/createQueryStringFromObject";
import { SCIENCE_CHILD_SUBJECT_SLUGS } from "@/utils/curriculum/ks4ExamboardPreference";
import {
  getTeacherSubjectPhaseSlug,
  parseProgrammeSlug,
  type ParsedProgrammeSlug,
} from "@/utils/curriculum/slugs";
import { orderProgrammeQuery } from "@/utils/programme/programmeQuery";

function firstSearchParamValue(
  value: string | string[] | null | undefined,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Maps legacy URL search params (`year`, `category`) to filter keys.
 *
 * `learning-theme` is intentionally ignored: thread views are UI state, not
 * indexable pages, and must never be a redirect destination.
 */
function mapLegacySearchParams(
  out: UrlQueryObject,
  searchParams: UrlQueryObject,
): void {
  const year = firstSearchParamValue(searchParams.year);
  if (year) {
    out.years = year.replace(/^year-/, "");
  }

  const category = firstSearchParamValue(searchParams.category);
  if (category) {
    out.subject_categories = category;
  }
}

export type LegacyProgrammeRedirectTarget = {
  /** Subject-phase slug *without* board resolution, e.g. `english-secondary`. */
  subjectPhaseSlug: string;
  query: UrlQueryObject;
};

/** Builds the IJ programme target (slug + query) for a parsed programme slug. */
export function buildIntegratedProgrammeUnitsTarget(
  parsed: ParsedProgrammeSlug,
  searchParams: UrlQueryObject = {},
): LegacyProgrammeRedirectTarget {
  // KS4 science slugs use biology/chemistry/etc. as subject; redirect maps to `science`
  const scienceChildSubjectSlug = SCIENCE_CHILD_SUBJECT_SLUGS.has(
    parsed.subjectSlug,
  )
    ? parsed.subjectSlug
    : null;

  const subjectPhaseSlug = getTeacherSubjectPhaseSlug({
    subjectSlug: scienceChildSubjectSlug ? "science" : parsed.subjectSlug,
    phaseSlug: parsed.phaseSlug,
    examboardSlug: parsed.examboardSlug,
    pathwaySlug: parsed.pathwaySlug,
  });

  const query: UrlQueryObject = {};

  if (parsed.keystageSlug) {
    query.keystages = parsed.keystageSlug;
  }

  if (parsed.yearSlug) {
    query.years = parsed.yearSlug.replace(/^year-/, "");
  }

  if (parsed.tierSlug) {
    query.tiers = parsed.tierSlug;
  }

  // Apply child subject filter for KS4 science slugs.
  if (scienceChildSubjectSlug) {
    query.child_subjects = scienceChildSubjectSlug;
  }

  mapLegacySearchParams(query, searchParams);

  // Destination in canonical order; a year replaces its key stage (rule U2),
  // so `…-ks2/units?year=year-4` lands on `?years=4`, not `?keystages=ks2&years=4`.
  return {
    subjectPhaseSlug,
    query: orderProgrammeQuery(query as Record<string, string>),
  };
}

/** Builds the IJ programme URL for a programme slug (no board resolution). */
export function buildIntegratedProgrammeUnitsUrl(
  parsed: ParsedProgrammeSlug,
  searchParams: UrlQueryObject = {},
): string {
  const { subjectPhaseSlug, query } = buildIntegratedProgrammeUnitsTarget(
    parsed,
    searchParams,
  );
  return resolveOakHref({
    page: "teacher-programme",
    subjectPhaseSlug,
    tab: "units",
    query,
  });
}

/**
 * Returns the redirect target for a programme slug, or `null` if the
 * slug is already a subject phase slug or invalid.
 */
export function getLegacyProgrammeRedirectTarget(
  slug: string,
  searchParams: UrlQueryObject,
): LegacyProgrammeRedirectTarget | null {
  const parsed = parseProgrammeSlug(slug);
  if (!parsed) {
    return null;
  }
  return buildIntegratedProgrammeUnitsTarget(parsed, searchParams);
}

/**
 * Returns the redirect destination URL for a programme slug, or `null` if the
 * slug is already a subject phase slug or invalid.
 */
export function getProgrammeSlugRedirectDestination(
  slug: string,
  searchParams: UrlQueryObject,
): string | null {
  const parsed = parseProgrammeSlug(slug);
  if (!parsed) {
    return null;
  }
  return buildIntegratedProgrammeUnitsUrl(parsed, searchParams);
}

/**
 * Permanently redirects when `slug` is a legacy programme slug.
 *
 * `resolveSubjectPhaseSlug` (optional) lets the caller turn a board-less
 * secondary slug into its default-board slug (`english-secondary` →
 * `english-secondary-aqa`) using curriculum data, so the redirect lands on the
 * final URL in one hop. Without it the page-level exam-board redirect adds a
 * second hop.
 */
export async function redirectProgrammeSlugIfNeeded(
  slug: string,
  searchParams: UrlQueryObject,
  resolveSubjectPhaseSlug?: (subjectPhaseSlug: string) => Promise<string>,
): Promise<void> {
  const target = getLegacyProgrammeRedirectTarget(slug, searchParams);
  if (!target) {
    return;
  }

  const subjectPhaseSlug = resolveSubjectPhaseSlug
    ? await resolveSubjectPhaseSlug(target.subjectPhaseSlug)
    : target.subjectPhaseSlug;

  permanentRedirect(
    resolveOakHref({
      page: "teacher-programme",
      subjectPhaseSlug,
      tab: "units",
      query: target.query,
    }),
  );
}
