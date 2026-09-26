import { applySearchParamsToFilter } from "./applySearchParamsToFilter";

import type { BrowseFilters } from "@/context/BrowseFilters/types";

const defaultFilter: BrowseFilters = {
  childSubjects: [],
  subjectCategories: ["reading-writing-oracy"],
  tiers: [],
  years: ["1", "2", "3", "4", "5", "6"],
  threads: [],
  pathways: [],
  keystages: [],
};

describe("applySearchParamsToFilter", () => {
  it("applies the filters present in the URL over the defaults", () => {
    const out = applySearchParamsToFilter(
      defaultFilter,
      new URLSearchParams("keystages=ks2&subject_categories=spelling"),
    );
    expect(out.keystages).toEqual(["ks2"]);
    expect(out.subjectCategories).toEqual(["spelling"]);
    expect(out.years).toEqual(defaultFilter.years);
  });

  it("selects the key stage a single year implies (U2)", () => {
    const out = applySearchParamsToFilter(
      defaultFilter,
      new URLSearchParams("years=3"),
    );
    expect(out.years).toEqual(["3"]);
    expect(out.keystages).toEqual(["ks2"]);
  });

  it("ignores parameters that are not filters", () => {
    const out = applySearchParamsToFilter(
      defaultFilter,
      new URLSearchParams("learning-theme=poetry&utm_source=x"),
    );
    expect(out.threads).toEqual([]);
  });
});
