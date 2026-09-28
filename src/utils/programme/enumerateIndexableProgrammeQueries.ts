/**
 * Enumerates every indexable filter combination of a programme `/units` page –
 * the set of URLs the sitemap lists (rule U4). Built on
 * `canonicaliseProgrammeQuery()` so the sitemap and the pages cannot drift:
 * a URL is listed only if the page would serve it as 200 / index / self-canonical.
 *
 * Threads are never listed (rule U5).
 */
import { canonicaliseProgrammeQuery } from "./canonicalise";
import type { ProgrammeQuery } from "./programmeQuery";
import { keystageForYear } from "./programmeQuery";

import type { BrowseFilters } from "@/context/BrowseFilters/types";
import type { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import { getDefaultBrowseFilter } from "@/context/BrowseFilters/utils/getDefaultBrowseFilter";
import {
  getFilterData,
  scopeYearsToKeystageFilter,
  shouldDisplayFilter,
} from "@/utils/curriculum/filtering";

function stageCandidates(data: CurriculumUnitsFormattedData): ProgrammeQuery[] {
  const stages: ProgrammeQuery[] = [{}];
  if (data.keystages.length > 1) {
    for (const keystage of data.keystages) {
      stages.push({ keystages: keystage });
    }
  }
  if (data.yearOptions.length > 1) {
    for (const year of data.yearOptions) {
      stages.push({ years: year });
    }
  }
  return stages;
}

/**
 * Returns the normalised queries (canonical order, `{}` for the base page) of
 * every indexable page of the programme, in a stable order.
 */
export function enumerateIndexableProgrammeQueries(
  data: CurriculumUnitsFormattedData,
  defaultFilter: BrowseFilters = getDefaultBrowseFilter(data),
): ProgrammeQuery[] {
  const seen = new Map<string, ProgrammeQuery>();

  for (const stage of stageCandidates(data)) {
    const impliedKeystage = stage.years
      ? keystageForYear(stage.years)
      : undefined;
    const stageFilters: BrowseFilters = {
      ...defaultFilter,
      years: stage.years ? [stage.years] : defaultFilter.years,
      keystages: stage.keystages
        ? [stage.keystages]
        : impliedKeystage
          ? [impliedKeystage]
          : [],
      threads: [],
    };
    const options = getFilterData(
      data.yearData,
      scopeYearsToKeystageFilter(stageFilters),
    );

    const tierOptions: (string | undefined)[] = [undefined];
    if (shouldDisplayFilter(data, stageFilters, "tiers")) {
      tierOptions.push(...options.tiers.map((t) => t.tier_slug));
    }
    const childSubjectOptions: (string | undefined)[] = [undefined];
    if (shouldDisplayFilter(data, stageFilters, "childSubjects")) {
      childSubjectOptions.push(
        ...options.childSubjects.map((c) => c.subject_slug),
      );
    }
    const categoryOptions: (string | undefined)[] = [undefined];
    if (shouldDisplayFilter(data, stageFilters, "subjectCategories")) {
      categoryOptions.push(
        ...options.subjectCategories.map((c) => String(c.slug)),
      );
    }

    for (const tiers of tierOptions) {
      for (const child_subjects of childSubjectOptions) {
        for (const subject_categories of categoryOptions) {
          const candidate: ProgrammeQuery = {
            ...stage,
            ...(tiers && { tiers }),
            ...(child_subjects && { child_subjects }),
            ...(subject_categories && { subject_categories }),
          };
          const canonical = canonicaliseProgrammeQuery(
            candidate,
            data,
            defaultFilter,
          );
          if (canonical.isValid && !canonical.noindex) {
            seen.set(canonical.queryString, canonical.query);
          }
        }
      }
    }
  }

  return [...seen.values()];
}
