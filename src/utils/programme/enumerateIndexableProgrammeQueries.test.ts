import { canonicaliseProgrammeQuery } from "./canonicalise";
import { enumerateIndexableProgrammeQueries } from "./enumerateIndexableProgrammeQueries";
import {
  englishPrimaryData,
  mathsSecondaryData,
  peCoreData,
  scienceData,
} from "./fixtures";
import { programmeQueryToString } from "./programmeQuery";

import { getDefaultBrowseFilter } from "@/context/BrowseFilters/utils/getDefaultBrowseFilter";

const strings = (
  data: Parameters<typeof enumerateIndexableProgrammeQueries>[0],
) => enumerateIndexableProgrammeQueries(data).map(programmeQueryToString);

describe("enumerateIndexableProgrammeQueries", () => {
  it("lists the base page, key stages, years and the tier variants for maths", () => {
    const out = strings(mathsSecondaryData());
    expect(out).toEqual([
      "",
      "tiers=higher",
      "keystages=ks3",
      "keystages=ks4",
      "keystages=ks4&tiers=higher",
      "years=7",
      "years=8",
      "years=9",
      "years=10",
      "years=10&tiers=higher",
      "years=11",
      "years=11&tiers=higher",
    ]);
  });

  it("never lists a default value, a redundant key stage or a thread", () => {
    const out = strings(scienceData());
    expect(out).not.toContain("keystages=ks4&tiers=foundation");
    expect(out).not.toContain("keystages=ks4&child_subjects=combined-science");
    expect(out.some((s) => s.includes("threads="))).toBe(false);
    expect(
      out.some((s) => s.includes("years=") && s.includes("keystages=")),
    ).toBe(false);
    expect(out).toContain("keystages=ks4&tiers=higher&child_subjects=biology");
    expect(out).toContain("years=11&child_subjects=physics");
  });

  it("lists category pages for English primary", () => {
    const out = strings(englishPrimaryData());
    expect(out).toContain("keystages=ks2&subject_categories=spelling");
    expect(out).toContain("years=3&subject_categories=spelling");
    expect(out).toContain("keystages=ks1&subject_categories=handwriting");
    expect(out).not.toContain("keystages=ks2&subject_categories=handwriting");
    expect(out).not.toContain(
      "keystages=ks2&subject_categories=reading-writing-oracy",
    );
  });

  it("lists only what the page would serve as an indexable, self-canonical URL", () => {
    for (const data of [
      scienceData(),
      englishPrimaryData(),
      mathsSecondaryData(),
      peCoreData(),
    ]) {
      const defaultFilter = getDefaultBrowseFilter(data);
      for (const query of enumerateIndexableProgrammeQueries(data)) {
        const canonical = canonicaliseProgrammeQuery(
          query,
          data,
          defaultFilter,
        );
        expect(canonical.isValid).toBe(true);
        expect(canonical.noindex).toBe(false);
        expect(canonical.query).toEqual(query);
      }
    }
  });

  it("has no duplicates", () => {
    const out = strings(scienceData());
    expect(new Set(out).size).toBe(out.length);
  });
});
