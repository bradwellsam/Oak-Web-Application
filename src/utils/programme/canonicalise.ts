/**
 * `canonicaliseProgrammeQuery()` – the one function that turns whatever query
 * string reaches a programme `/units` page into the page's identity.
 *
 * SEO programme-template ticket, rules U1–U9:
 *   U1  fixed parameter order; the address bar and the canonical agree
 *   U2  a year replaces its key stage
 *   U3  dependent filters (tier, child subject, category) only where they apply
 *   U4  every valid combination is a page: index, self-canonical
 *   U5  `threads` is the exception: kept in the URL, `noindex, follow`
 *   U6  a known parameter with an invalid value → 404 (`isValid === false`)
 *   U7  unknown parameters are ignored and never reach the canonical
 *   U8  a value equal to the programme default is implicit and never written
 *   U9  the route never redirects: an old spelling renders with the canonical
 *       pointing at the normalised URL
 *
 * Validity mirrors the filter UI exactly: a combination is a page only if the
 * UI could produce it (`shouldDisplayFilter`, `getFilterData`) and it matches
 * at least one unit.
 */
import {
  keystageForYear,
  orderProgrammeQuery,
  programmeQueryToString,
  readProgrammeQuery,
  type ProgrammeFilterParam,
  type ProgrammeQuery,
  type RawSearchParams,
} from "./programmeQuery";

import type { BrowseFilters } from "@/context/BrowseFilters/types";
import type { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import {
  getFilterData,
  getNumberOfSelectedUnits,
  highlightedUnitCount,
  scopeYearsToKeystageFilter,
  shouldDisplayFilter,
} from "@/utils/curriculum/filtering";

export type ProgrammeQueryProblem = {
  param: ProgrammeFilterParam | "combination";
  value?: string;
  reason: string;
};

export type CanonicalProgrammeQuery = {
  /** Normalised query: known params only, canonical order, defaults removed. */
  query: ProgrammeQuery;
  /** `query` serialised (`years=8&tiers=higher`), `""` for the base page. */
  queryString: string;
  /** False when the request must 404 (rule U6). */
  isValid: boolean;
  problems: ProgrammeQueryProblem[];
  /** True when `threads` is present (rule U5). */
  noindex: boolean;
  /** The filter state the page renders with (defaults + query). */
  filters: BrowseFilters;
  /** Non-filter parameters that arrived with the request (`utm_source`…). */
  unknown: Record<string, string | string[]>;
};

/**
 * Normalises and validates `raw` against the programme's own data.
 *
 * @param raw            the request's search params (any shape, any order)
 * @param data           `formatCurriculumUnitsData(curriculumUnitsData)`
 * @param defaultFilter  `getDefaultBrowseFilter(data)`
 */
export function canonicaliseProgrammeQuery(
  raw: RawSearchParams | undefined,
  data: CurriculumUnitsFormattedData,
  defaultFilter: BrowseFilters,
): CanonicalProgrammeQuery {
  const { query: requested, multiValued, unknown } = readProgrammeQuery(raw);
  const problems: ProgrammeQueryProblem[] = [];
  const query: ProgrammeQuery = {};

  for (const param of multiValued) {
    problems.push({
      param,
      value: requested[param],
      reason: "only one value per filter",
    });
  }

  // --- years / keystages (U2) -------------------------------------------------
  const years = requested.years;
  if (years) {
    if (data.yearOptions.length <= 1) {
      // A single year bucket: the year filter does not exist on this page.
    } else if (!data.yearOptions.includes(years)) {
      problems.push({
        param: "years",
        value: years,
        reason: "not a year of this programme",
      });
    } else {
      query.years = years;
    }
  }

  const keystages = requested.keystages;
  if (keystages) {
    const known = (data.keystages as string[]).includes(keystages);
    if (!known) {
      problems.push({
        param: "keystages",
        value: keystages,
        reason: "not a key stage of this programme",
      });
    } else if (query.years) {
      if (keystageForYear(query.years) !== keystages) {
        problems.push({
          param: "keystages",
          value: keystages,
          reason: `year ${query.years} is not in ${keystages}`,
        });
      }
      // else: redundant with the year – implied, not written (U2)
    } else if (data.keystages.length > 1) {
      query.keystages = keystages;
    }
    // A single key stage: the filter does not exist on this page – implicit.
  }

  // --- resolved filter state --------------------------------------------------
  const impliedKeystage = query.years
    ? keystageForYear(query.years)
    : undefined;
  const filters: BrowseFilters = {
    ...defaultFilter,
    years: query.years ? [query.years] : defaultFilter.years,
    keystages: query.keystages
      ? [query.keystages]
      : impliedKeystage
        ? [impliedKeystage]
        : [],
    threads: [],
  };
  const effectiveYears = scopeYearsToKeystageFilter(filters);
  const options = getFilterData(data.yearData, effectiveYears);

  // --- dependent filters (U3, U8) ----------------------------------------------
  const tiers = requested.tiers;
  if (tiers) {
    const shown = shouldDisplayFilter(data, filters, "tiers");
    const valid = shown && options.tiers.some((t) => t.tier_slug === tiers);
    if (!valid) {
      problems.push({
        param: "tiers",
        value: tiers,
        reason: "no tier option for this selection",
      });
    } else {
      filters.tiers = [tiers as BrowseFilters["tiers"][number]];
      if (tiers !== defaultFilter.tiers[0]) {
        query.tiers = tiers;
      }
    }
  }

  const childSubjects = requested.child_subjects;
  if (childSubjects) {
    const shown = shouldDisplayFilter(data, filters, "childSubjects");
    const valid =
      shown &&
      options.childSubjects.some((c) => c.subject_slug === childSubjects);
    if (!valid) {
      problems.push({
        param: "child_subjects",
        value: childSubjects,
        reason: "no child subject option for this selection",
      });
    } else {
      filters.childSubjects = [
        childSubjects as BrowseFilters["childSubjects"][number],
      ];
      if (childSubjects !== defaultFilter.childSubjects[0]) {
        query.child_subjects = childSubjects;
      }
    }
  }

  const subjectCategories = requested.subject_categories;
  if (subjectCategories) {
    const shown = shouldDisplayFilter(data, filters, "subjectCategories");
    const valid =
      shown &&
      options.subjectCategories.some(
        (c) => String(c.slug) === subjectCategories,
      );
    if (!valid) {
      problems.push({
        param: "subject_categories",
        value: subjectCategories,
        reason: "no category option for this selection",
      });
    } else {
      filters.subjectCategories = [subjectCategories];
      if (subjectCategories !== defaultFilter.subjectCategories[0]) {
        query.subject_categories = subjectCategories;
      }
    }
  }

  // --- threads (U5) ------------------------------------------------------------
  const threads = requested.threads;
  if (threads) {
    const known = data.threadOptions.some((t) => t.slug === threads);
    const matches =
      known && highlightedUnitCount(data.yearData, filters, [threads]) > 0;
    if (!matches) {
      problems.push({
        param: "threads",
        value: threads,
        reason: "no unit in this selection belongs to the thread",
      });
    } else {
      filters.threads = [threads];
      query.threads = threads;
    }
  }

  // --- the combination must show something (U6) --------------------------------
  if (
    problems.length === 0 &&
    getNumberOfSelectedUnits(data.yearData, filters) === 0
  ) {
    problems.push({
      param: "combination",
      reason: "no unit matches this combination",
    });
  }

  const ordered = orderProgrammeQuery(query);

  return {
    query: ordered,
    queryString: programmeQueryToString(ordered),
    isValid: problems.length === 0,
    problems,
    noindex: Boolean(ordered.threads),
    filters,
    unknown,
  };
}
