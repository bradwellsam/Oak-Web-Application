import { ReadonlyURLSearchParams } from "next/navigation";

import {
  browseFilterQueryParamMap,
  BrowseFilters,
  browseFilterKeys,
  filterValueSchemas,
} from "../types";

import { keystageForYear } from "@/utils/programme/programmeQuery";

type MaybeSearchParams = ReadonlyURLSearchParams | URLSearchParams | null;

export function applySearchParamsToFilter(
  filter: BrowseFilters,
  params?: MaybeSearchParams,
): BrowseFilters;
export function applySearchParamsToFilter(
  filter: Partial<BrowseFilters>,
  params?: MaybeSearchParams,
): Partial<BrowseFilters>;

export function applySearchParamsToFilter(
  filter: Partial<BrowseFilters>,
  params?: MaybeSearchParams,
): Partial<BrowseFilters> {
  const out = { ...filter };
  if (params) {
    for (const key of browseFilterKeys) {
      if (!(key in filter)) {
        continue;
      }

      const paramsValue = params.get(browseFilterQueryParamMap[key]);
      if (paramsValue && paramsValue !== "") {
        const result = filterValueSchemas
          .partial()
          .safeParse({ [key]: paramsValue.split(",") });

        if (result.success) {
          Object.assign(out, result.data);
        }
      }
    }
  }
  // A year implies its key stage (rule U2): `?years=8` selects KS3 in the UI
  // exactly as `?years=8&keystages=ks3` did before.
  if (
    "keystages" in filter &&
    out.years?.length === 1 &&
    (!out.keystages || out.keystages.length === 0)
  ) {
    const implied = keystageForYear(out.years[0]!);
    if (implied) {
      out.keystages = [implied];
    }
  }
  return out;
}

