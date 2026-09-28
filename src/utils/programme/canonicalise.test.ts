import { canonicaliseProgrammeQuery } from "./canonicalise";
import {
  englishPrimaryData,
  mathsSecondaryData,
  peCoreData,
  scienceData,
} from "./fixtures";

import { getDefaultBrowseFilter } from "@/context/BrowseFilters/utils/getDefaultBrowseFilter";

const run = (
  raw: Record<string, string | string[] | undefined>,
  data = mathsSecondaryData(),
) => canonicaliseProgrammeQuery(raw, data, getDefaultBrowseFilter(data));

describe("canonicaliseProgrammeQuery", () => {
  describe("valid combinations are pages (U4)", () => {
    it("base page", () => {
      const out = run({});
      expect(out.isValid).toBe(true);
      expect(out.queryString).toBe("");
      expect(out.noindex).toBe(false);
    });

    it("key stage, year, tier", () => {
      expect(run({ keystages: "ks3" }).queryString).toBe("keystages=ks3");
      expect(run({ years: "8" }).queryString).toBe("years=8");
      expect(run({ keystages: "ks4", tiers: "higher" }).queryString).toBe(
        "keystages=ks4&tiers=higher",
      );
      expect(run({ years: "11", tiers: "higher" }).queryString).toBe(
        "years=11&tiers=higher",
      );
    });

    it("child subject and category", () => {
      const science = scienceData();
      expect(
        run({ keystages: "ks4", child_subjects: "biology" }, science)
          .queryString,
      ).toBe("keystages=ks4&child_subjects=biology");
      expect(
        run(
          { years: "11", tiers: "higher", child_subjects: "biology" },
          science,
        ).queryString,
      ).toBe("years=11&tiers=higher&child_subjects=biology");

      const english = englishPrimaryData();
      expect(
        run({ keystages: "ks2", subject_categories: "spelling" }, english)
          .queryString,
      ).toBe("keystages=ks2&subject_categories=spelling");
      expect(
        run({ years: "3", subject_categories: "spelling" }, english)
          .queryString,
      ).toBe("years=3&subject_categories=spelling");
    });
  });

  describe("order and redundancy (U1, U2)", () => {
    it("writes parameters in canonical order whatever order they arrive in", () => {
      expect(run({ tiers: "higher", keystages: "ks4" }).queryString).toBe(
        "keystages=ks4&tiers=higher",
      );
      expect(run({ threads: "algebra", keystages: "ks3" }).queryString).toBe(
        "keystages=ks3&threads=algebra",
      );
    });

    it("drops a key stage implied by the year", () => {
      const out = run({ years: "8", keystages: "ks3" });
      expect(out.isValid).toBe(true);
      expect(out.queryString).toBe("years=8");
      expect(out.filters.keystages).toEqual(["ks3"]);
    });

    it("rejects a key stage the year is not in", () => {
      expect(run({ years: "8", keystages: "ks4" }).isValid).toBe(false);
    });
  });

  describe("defaults are implicit (U8)", () => {
    it("drops a tier / child subject / category equal to the default", () => {
      expect(run({ keystages: "ks4", tiers: "foundation" }).queryString).toBe(
        "keystages=ks4",
      );
      expect(
        run(
          { keystages: "ks4", child_subjects: "combined-science" },
          scienceData(),
        ).queryString,
      ).toBe("keystages=ks4");
      expect(
        run(
          { keystages: "ks2", subject_categories: "reading-writing-oracy" },
          englishPrimaryData(),
        ).queryString,
      ).toBe("keystages=ks2");
    });
  });

  describe("threads (U5)", () => {
    it("keeps a real thread in the URL and marks the page noindex", () => {
      const out = run({ keystages: "ks3", threads: "algebra" });
      expect(out.isValid).toBe(true);
      expect(out.queryString).toBe("keystages=ks3&threads=algebra");
      expect(out.noindex).toBe(true);
      expect(out.filters.threads).toEqual(["algebra"]);
    });

    it("404s a thread that does not exist or matches nothing in the selection", () => {
      expect(run({ threads: "not-a-real-thread" }).isValid).toBe(false);
      // bq-forces has no KS4 chemistry units
      expect(
        run(
          {
            keystages: "ks4",
            child_subjects: "chemistry",
            threads: "bq-forces",
          },
          scienceData(),
        ).isValid,
      ).toBe(false);
    });
  });

  describe("invalid values (U6)", () => {
    it("404s unknown values of known parameters", () => {
      expect(run({ years: "99" }).isValid).toBe(false);
      expect(run({ keystages: "ks9" }).isValid).toBe(false);
      expect(run({ tiers: "middle", keystages: "ks4" }).isValid).toBe(false);
      expect(run({ keystages: "ks4", child_subjects: "biology" }).isValid).toBe(
        false,
      ); // maths has no child subjects
      expect(
        run(
          { keystages: "ks2", subject_categories: "19" },
          englishPrimaryData(),
        ).isValid,
      ).toBe(false);
      // "all" is only a value where the programme offers an "All" category
      expect(
        run(
          { keystages: "ks2", subject_categories: "all" },
          englishPrimaryData(),
        ).isValid,
      ).toBe(false);
      const withAll = run(
        { keystages: "ks2", subject_categories: "all" },
        englishPrimaryData(true),
      );
      expect(withAll.isValid).toBe(true);
      expect(withAll.queryString).toBe("keystages=ks2&subject_categories=all");
    });

    it("404s dependent filters outside the stage they apply to (U3)", () => {
      expect(run({ years: "7", tiers: "higher" }).isValid).toBe(false);
      expect(run({ keystages: "ks3", tiers: "foundation" }).isValid).toBe(
        false,
      );
      expect(
        run({ keystages: "ks3", child_subjects: "biology" }, scienceData())
          .isValid,
      ).toBe(false);
      // handwriting only exists at KS1 in the fixture
      expect(
        run(
          { years: "5", subject_categories: "handwriting" },
          englishPrimaryData(),
        ).isValid,
      ).toBe(false);
    });

    it("404s multi-valued filters", () => {
      expect(run({ years: "7,8" }).isValid).toBe(false);
      expect(run({ years: ["7", "8"] }).isValid).toBe(false);
    });
  });

  describe("unknown and legacy parameters (U7, U9)", () => {
    it("ignores unknown parameters and keeps them out of the canonical", () => {
      const out = run({ keystages: "ks3", utm_source: "test", foo: "bar" });
      expect(out.isValid).toBe(true);
      expect(out.queryString).toBe("keystages=ks3");
      expect(out.unknown).toEqual({ utm_source: "test", foo: "bar" });
    });

    it("ignores pre-2026 parameter names on a current slug (they are unknown parameters)", () => {
      const out = run({ "learning-theme": "algebra", keystages: "ks3" });
      expect(out.isValid).toBe(true);
      expect(out.queryString).toBe("keystages=ks3");
      expect(out.noindex).toBe(false);
      expect(run({ year: "year-8" }).queryString).toBe("");
    });

    it("never redirects: an old spelling is normalised, not rejected", () => {
      const out = run({ threads: "algebra", years: "8", keystages: "ks3" });
      expect(out.isValid).toBe(true);
      expect(out.queryString).toBe("years=8&threads=algebra");
    });
  });

  it("treats a single-bucket programme's stage filters as implicit", () => {
    const pe = peCoreData();
    const out = run({ keystages: "ks4" }, pe);
    expect(out.isValid).toBe(true);
    expect(out.queryString).toBe("keystages=ks4");
  });
});
