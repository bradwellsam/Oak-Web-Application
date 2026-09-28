import {
  orderProgrammeQuery,
  programmeQueryFromFilters,
  programmeQueryToString,
  readProgrammeQuery,
} from "./programmeQuery";

import type { BrowseFilters } from "@/context/BrowseFilters/types";

describe("readProgrammeQuery", () => {
  it("separates known parameters from everything else", () => {
    const out = readProgrammeQuery({
      keystages: "ks3",
      utm_source: "newsletter",
      foo: ["a", "b"],
    });
    expect(out.query).toEqual({ keystages: "ks3" });
    expect(out.unknown).toEqual({ utm_source: "newsletter", foo: ["a", "b"] });
    expect(out.multiValued).toEqual([]);
  });

  it("treats pre-2026 parameter names as unknown (they only mean something on old slugs)", () => {
    const out = readProgrammeQuery({
      "learning-theme": "algebra",
      year: "year-8",
      category: "spelling",
    });
    expect(out.query).toEqual({});
    expect(Object.keys(out.unknown)).toEqual(["learning-theme", "year", "category"]);
  });

  it("reports multi-valued filters and ignores empty values", () => {
    const out = readProgrammeQuery({ years: "7,8", keystages: "", tiers: [] });
    expect(out.query).toEqual({ years: "7" });
    expect(out.multiValued).toEqual(["years"]);
  });
});

describe("orderProgrammeQuery / programmeQueryToString", () => {
  it("writes the fixed order and drops a key stage implied by the year", () => {
    const ordered = orderProgrammeQuery({
      threads: "t",
      keystages: "ks3",
      tiers: "higher",
      years: "8",
    });
    expect(programmeQueryToString(ordered)).toBe(
      "years=8&tiers=higher&threads=t",
    );
  });

  it("keeps a key stage that the year is not in (the validator rejects it)", () => {
    expect(
      programmeQueryToString(
        orderProgrammeQuery({ years: "8", keystages: "ks4" }),
      ),
    ).toBe("years=8&keystages=ks4");
  });
});

describe("programmeQueryFromFilters", () => {
  const defaultFilter: BrowseFilters = {
    childSubjects: ["combined-science"],
    subjectCategories: [],
    tiers: ["foundation"],
    years: ["7", "8", "9", "10", "11"],
    threads: [],
    pathways: [],
    keystages: [],
  };

  it("omits defaults and implied key stages, orders the rest", () => {
    expect(
      programmeQueryFromFilters(
        {
          ...defaultFilter,
          years: ["11"],
          keystages: ["ks4"],
          tiers: ["higher"],
          childSubjects: ["biology"],
          threads: ["bq-cells"],
        },
        defaultFilter,
      ),
    ).toEqual({
      years: "11",
      tiers: "higher",
      child_subjects: "biology",
      threads: "bq-cells",
    });
  });

  it("writes a key stage on its own when all its years are selected", () => {
    expect(
      programmeQueryFromFilters(
        { ...defaultFilter, keystages: ["ks3"] },
        defaultFilter,
      ),
    ).toEqual({ keystages: "ks3" });
  });

  it("writes nothing for the default state", () => {
    expect(programmeQueryFromFilters(defaultFilter, defaultFilter)).toEqual({});
  });
});
