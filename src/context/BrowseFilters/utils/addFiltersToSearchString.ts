import {
  browseFilterKeys,
  browseFilterQueryParamMap,
  BrowseFilters,
} from "../types";

import {
  programmeQueryFromFilters,
  programmeQueryToString,
} from "@/utils/programme/programmeQuery";

/**
 * Writes `filters` into `search`, leaving every non-filter param (tracking
 * etc.) untouched. The filter part is produced by `programmeQueryFromFilters`,
 * the same rules the server uses for the canonical (SEO programme-template
 * ticket, rules U1/U2/U8): canonical order, a year implies its key stage,
 * values equal to the default filter are omitted so shared URLs stay short.
 */
export function addFiltersToSearchString(
  search: string,
  filters: BrowseFilters,
  defaultFilter: BrowseFilters,
): string {
  const params = new URLSearchParams(search);
  for (const key of browseFilterKeys) {
    params.delete(browseFilterQueryParamMap[key]);
  }
  const filterQuery = programmeQueryToString(
    programmeQueryFromFilters(filters, defaultFilter),
  );
  const rest = params.toString();

  return [filterQuery, rest].filter(Boolean).join("&");
}
