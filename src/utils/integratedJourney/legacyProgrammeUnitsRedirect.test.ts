import {
  buildIntegratedProgrammeUnitsUrl,
  getLegacyProgrammeRedirectTarget,
  getProgrammeSlugRedirectDestination,
  redirectProgrammeSlugIfNeeded,
} from "./legacyProgrammeUnitsRedirect";

import { parseProgrammeSlug } from "@/utils/curriculum/slugs";

jest.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT;${url}`);
  },
}));

describe("buildIntegratedProgrammeUnitsUrl", () => {
  it("redirects citizenship ks3 with year and learning-theme query params", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("citizenship-secondary-ks3")!,
      {
        year: "year-7",
        "learning-theme": "all",
      },
    );

    expect(url).toBe(
      "/teachers/programmes/citizenship-secondary/units?years=7",
    );
  });

  it("redirects ks4 computing with examboard in subject phase slug", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("computing-secondary-ks4-gcse-aqa")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/computing-secondary-aqa/units?keystages=ks4",
    );
  });

  it("redirects ks4 maths with tier query param", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("maths-secondary-ks4-foundation")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/maths-secondary/units?keystages=ks4&tiers=foundation",
    );
  });

  it("redirects primary ks1 slug", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("computing-primary-ks1")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/computing-primary/units?keystages=ks1",
    );
  });

  it("redirects biology to science with child subject and tier", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("biology-secondary-ks4-higher-aqa")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/science-secondary-aqa/units?keystages=ks4&tiers=higher&child_subjects=biology",
    );
  });

  it("redirects chemistry to science with child subject", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("chemistry-secondary-ks4-aqa")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/science-secondary-aqa/units?keystages=ks4&child_subjects=chemistry",
    );
  });

  it("redirects combined science with tier and examboard", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("combined-science-secondary-ks4-foundation-edexcel")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/science-secondary-edexcel/units?keystages=ks4&tiers=foundation&child_subjects=combined-science",
    );
  });

  it("redirects pathway-only gcse slug", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("citizenship-secondary-ks4-gcse")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/citizenship-secondary-gcse/units?keystages=ks4",
    );
  });

  it("redirects core pathway slug", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("computing-secondary-ks4-core")!,
      {},
    );

    expect(url).toBe(
      "/teachers/programmes/computing-secondary-core/units?keystages=ks4",
    );
  });

  it("maps category but drops learning-theme (thread views are not redirect targets)", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("english-secondary-ks3")!,
      {
        "learning-theme": "theme-1",
        category: "grammar",
      },
    );

    expect(url).toBe(
      "/teachers/programmes/english-secondary/units?keystages=ks3&subject_categories=grammar",
    );
  });

  it("drops a modern threads param and unknown params on a legacy slug", () => {
    const url = buildIntegratedProgrammeUnitsUrl(
      parseProgrammeSlug("maths-primary-ks2")!,
      {
        threads: "algebra",
        utm_source: "newsletter",
        year: "year-4",
      },
    );

    expect(url).toBe("/teachers/programmes/maths-primary/units?years=4");
  });
});

describe("getProgrammeSlugRedirectDestination", () => {
  it("does not redirect subjectPhaseSlug unit listing", () => {
    expect(
      getProgrammeSlugRedirectDestination("citizenship-secondary", {}),
    ).toBeNull();
  });

  it("returns destination for legacy programme slug", () => {
    expect(
      getProgrammeSlugRedirectDestination("citizenship-secondary-ks3", {
        year: "year-7",
        "learning-theme": "all",
      }),
    ).toBe("/teachers/programmes/citizenship-secondary/units?years=7");
  });

  it("maps array search param values", () => {
    expect(
      getProgrammeSlugRedirectDestination("english-secondary-ks3", {
        "learning-theme": ["theme-1"],
        category: ["grammar"],
      }),
    ).toBe(
      "/teachers/programmes/english-secondary/units?keystages=ks3&subject_categories=grammar",
    );
  });

  it("returns null for invalid programme slug", () => {
    expect(
      getProgrammeSlugRedirectDestination("invalid-programme-slug", {}),
    ).toBeNull();
  });
});

describe("getLegacyProgrammeRedirectTarget", () => {
  it("returns slug and query separately so the caller can resolve the board", () => {
    expect(
      getLegacyProgrammeRedirectTarget("english-secondary-ks3", {
        "learning-theme": "theme-1",
      }),
    ).toEqual({
      subjectPhaseSlug: "english-secondary",
      query: { keystages: "ks3" },
    });
  });

  it("returns null for a current subject-phase slug", () => {
    expect(
      getLegacyProgrammeRedirectTarget("english-secondary", {}),
    ).toBeNull();
  });
});

describe("redirectProgrammeSlugIfNeeded", () => {
  it("redirects to the board-resolved slug in one hop", async () => {
    await expect(
      redirectProgrammeSlugIfNeeded(
        "english-secondary-ks3",
        { "learning-theme": "theme-1" },
        async (subjectPhaseSlug) => `${subjectPhaseSlug}-aqa`,
      ),
    ).rejects.toThrow(
      "NEXT_PERMANENT_REDIRECT;/teachers/programmes/english-secondary-aqa/units?keystages=ks3",
    );
  });

  it("does nothing for a current subject-phase slug", async () => {
    await expect(
      redirectProgrammeSlugIfNeeded("english-secondary", {}),
    ).resolves.toBeUndefined();
  });
});
