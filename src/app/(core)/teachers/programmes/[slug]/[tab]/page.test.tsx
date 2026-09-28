/**
 * @jest-environment jsdom
 */
import { getProgrammeData, getSubjectPhaseOptions } from "./getProgrammeData";
import ProgrammePageTabs, { generateMetadata } from "./page";

import getBrowserConfig from "@/browser-lib/getBrowserConfig";
import CMSClient from "@/node-lib/cms";
import { createUnit } from "@/fixtures/curriculum/unit";
import { curriculumOverviewMVFixture } from "@/node-lib/curriculum-api-2023/fixtures/curriculumOverview.fixture";
import curriculumPhaseOptionsFixture from "@/node-lib/curriculum-api-2023/fixtures/curriculumPhaseOptions.fixture";
import { filterValidCurriculumPhaseOptions } from "@/pages-helpers/curriculum/docx/tab-helpers";
import renderWithProviders from "@/__tests__/__helpers__/renderWithProviders";
import { isFeatureFlagEnabledServer } from "@/utils/featureFlagChecks/server";
import { CurriculumSelectionSlugs } from "@/utils/curriculum/slugs";
import { mathsSecondaryUnits } from "@/utils/programme/fixtures";

const defaultParams = new URLSearchParams("");
const mockUseSearchParams = jest.fn(() => defaultParams);
jest.mock("next/navigation", () => {
  return {
    __esModule: true,
    usePathname: () => "/timetabling/maths-primary/units",
    useSearchParams: () => mockUseSearchParams(),
    useRouter: () => ({
      replace: jest.fn(),
      push: jest.fn(),
    }),
    notFound: () => {
      throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    },
    redirect: (url: string) => {
      throw new Error(`NEXT_REDIRECT;${url}`);
    },
    permanentRedirect: (url: string) => {
      throw new Error(`NEXT_PERMANENT_REDIRECT;${url}`);
    },
    unstable_rethrow: jest.fn(),
  };
});

jest.mock("@/utils/featureFlagChecks/server", () => ({
  isFeatureFlagEnabledServer: jest.fn(() => false),
}));

jest.mock("next/headers", () => ({
  draftMode: jest.fn().mockResolvedValue({
    isEnabled: true,
  }),
  cookies: jest.fn(() => ({
    getAll: jest.fn(() => []),
  })),
}));

jest.mock("@/node-lib/cms", () => ({
  __esModule: true,
  default: {
    curriculumOverviewPage: jest.fn().mockResolvedValue({
      id: "curriculum.overview",
      curriculumExplainer: {
        explainerRaw: [],
      },
      subjectPrinciples: [],
      partnerBio: "",
      curriculumPartner: null,
      curriculumPartnerOverviews: [],
      curriculumSeoTextRaw: null,
    }),
    programmePageBySlug: jest.fn(),
    implementationGuides: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock("@/node-lib/curriculum-api-2023", () => ({
  curriculumPhaseOptions: jest.fn().mockResolvedValue([
    {
      tab: "units",
      slug: "maths",
      title: "Maths",
      phases: [
        {
          slug: "primary",
          title: "Primary",
        },
      ],
      ks4_options: [],
    },
  ]),
  refreshedMVTime: jest.fn().mockResolvedValue(0),
}));

jest.mock("@/browser-lib/getBrowserConfig", () => ({
  __esModule: true,
  default: jest.fn((key: string) => {
    if (key === "seoAppUrl") {
      return "https://www.thenational.academy";
    }
    // Return empty string for other keys (matches global mock behavior)
    return "";
  }),
}));

jest.mock("./getProgrammeData", () => ({
  getProgrammeData: jest.fn(),
  getSubjectPhaseOptions: jest.fn(),
  getSubjectOverride: jest.fn(),
  getCachedFileSizes: jest.fn().mockResolvedValue([]),
}));

const mockErrorReporter = jest.fn();
jest.mock("@/common-lib/error-reporter", () => ({
  __esModule: true,
  initialiseBugsnag: jest.fn(),
  initialiseSentry: jest.fn(),
  default:
    () =>
    (...args: []) =>
      mockErrorReporter(...args),
}));

describe("Programme page tabs", () => {
  beforeEach(() => {
    jest.mocked(CMSClient.curriculumOverviewPage).mockClear();
    jest.mocked(getProgrammeData).mockClear();
  });

  it("permanentRedirects legacy programme slug on units tab", async () => {
    await expect(
      ProgrammePageTabs({
        params: Promise.resolve({
          slug: "citizenship-secondary-ks3",
          tab: "units",
        }),
        searchParams: Promise.resolve({
          year: "year-7",
          "learning-theme": "all",
        }),
      }),
    ).rejects.toThrow(/^NEXT_PERMANENT_REDIRECT;/);
    expect(getProgrammeData).not.toHaveBeenCalled();
  });

  it("does not redirect subject phase slug on units tab", async () => {
    jest.mocked(getProgrammeData).mockResolvedValue({
      programmeUnitsData: curriculumOverviewMVFixture({
        subjectTitle: "Maths",
      }),
      curriculumUnitsData: {
        units: [
          createUnit({
            slug: "test",
            year: "5",
            subject_slug: "maths",
            phase_slug: "primary",
          }),
        ],
      },
      ks4OptionFilterDimensions: {},
    });

    jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
      subjects: filterValidCurriculumPhaseOptions(
        curriculumPhaseOptionsFixture().filter((s) => s.slug === "maths"),
      ),
      subjectPhaseKeystageSlugs: {
        subjectSlug: "maths",
        phaseSlug: "primary",
        ks4OptionSlug: null,
      },
    });

    const result = await ProgrammePageTabs({
      params: Promise.resolve({
        slug: "maths-primary",
        tab: "units",
      }),
      searchParams: Promise.resolve({}),
    });

    expect(result).toBeDefined();
  });

  it("skips CMSClient.curriculumOverviewPage and renders when nonCurriculum is true", async () => {
    jest.mocked(getProgrammeData).mockResolvedValue({
      programmeUnitsData: curriculumOverviewMVFixture({
        subjectTitle: "Financial education",
        nonCurriculum: true,
      }),
      curriculumUnitsData: {
        units: [
          createUnit({
            slug: "test",
            year: "5",
            subject_slug: "financial-education",
            phase_slug: "primary",
          }),
        ],
      },
      ks4OptionFilterDimensions: {},
    });

    jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
      subjects: filterValidCurriculumPhaseOptions([
        {
          slug: "financial-education",
          title: "Financial education",
          phases: [{ slug: "primary", title: "Primary" }],
          ks4_options: [],
        },
      ]),
      subjectPhaseKeystageSlugs: {
        subjectSlug: "financial-education",
        phaseSlug: "primary",
        ks4OptionSlug: null,
      },
    });

    const result = await ProgrammePageTabs({
      params: Promise.resolve({
        slug: "financial-education-primary",
        tab: "units",
      }),
      searchParams: Promise.resolve({}),
    });

    expect(result).toBeDefined();
    expect(CMSClient.curriculumOverviewPage).not.toHaveBeenCalled();
  });

  it("returns 404 when nonCurriculum is false and CMSClient.curriculumOverviewPage returns null", async () => {
    jest
      .mocked(CMSClient.curriculumOverviewPage)
      .mockResolvedValueOnce(null as never);

    jest.mocked(getProgrammeData).mockResolvedValue({
      programmeUnitsData: curriculumOverviewMVFixture({
        subjectTitle: "Maths",
        nonCurriculum: false,
      }),
      curriculumUnitsData: {
        units: [
          createUnit({
            slug: "test",
            year: "5",
            subject_slug: "maths",
            phase_slug: "primary",
          }),
        ],
      },
      ks4OptionFilterDimensions: {},
    });

    jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
      subjects: filterValidCurriculumPhaseOptions(
        curriculumPhaseOptionsFixture().filter((s) => s.slug === "maths"),
      ),
      subjectPhaseKeystageSlugs: {
        subjectSlug: "maths",
        phaseSlug: "primary",
        ks4OptionSlug: null,
      },
    });

    await expect(
      ProgrammePageTabs({
        params: Promise.resolve({
          slug: "maths-primary",
          tab: "units",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toEqual(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));

    expect(CMSClient.curriculumOverviewPage).toHaveBeenCalled();
  });

  it("shows info banner if feature flag is enabled", async () => {
    jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
      subjects: filterValidCurriculumPhaseOptions([
        {
          slug: "maths",
          title: "Maths",
          phases: [{ slug: "primary", title: "Primary" }],
          ks4_options: [],
        },
      ]),
      subjectPhaseKeystageSlugs: {
        subjectSlug: "maths",
        phaseSlug: "primary",
        ks4OptionSlug: null,
      },
    });

    jest.mocked(getProgrammeData).mockResolvedValue({
      programmeUnitsData: curriculumOverviewMVFixture({
        subjectTitle: "Maths",
        nonCurriculum: false,
      }),
      curriculumUnitsData: {
        units: [
          createUnit({
            slug: "test",
            year: "5",
            subject_slug: "maths",
            phase_slug: "primary",
          }),
        ],
      },
      ks4OptionFilterDimensions: {},
    });

    (isFeatureFlagEnabledServer as jest.Mock).mockImplementation(
      (_cookies, flag) => {
        return flag === "implementation-guides" ? true : false;
      },
    );

    const { container } = renderWithProviders()(
      (await ProgrammePageTabs({
        params: Promise.resolve({
          slug: "maths",
          tab: "units",
        }),
        searchParams: Promise.resolve({}),
      })) as React.ReactElement,
    );
    expect(container).toHaveTextContent("Download our implementation toolkit.");
  });

  it("returns 404 page if params are invalid", async () => {
    jest.mocked(getProgrammeData).mockResolvedValue(null);

    await expect(
      ProgrammePageTabs({
        params: Promise.resolve({
          slug: "fake-slug",
          tab: "units",
        }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toEqual(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
  });
});

/** Maths primary: years 1–6, one thread ("number"). */
const mathsPrimaryUnits = () =>
  ["1", "2", "3", "4", "5", "6"].map((year, i) =>
    createUnit({
      slug: `place-value-y${year}`,
      year,
      subject_slug: "maths",
      phase_slug: "primary",
      order: i,
      threads: [{ slug: "number", title: "Number", order: 1 }],
    }),
  );

const mockProgramme = (
  slugs: CurriculumSelectionSlugs,
  units: ReturnType<typeof createUnit>[],
) => {
  jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
    subjects: filterValidCurriculumPhaseOptions(
      curriculumPhaseOptionsFixture(),
    ),
    subjectPhaseKeystageSlugs: slugs,
  });
  jest.mocked(getProgrammeData).mockResolvedValue({
    programmeUnitsData: curriculumOverviewMVFixture({ subjectTitle: "Maths" }),
    curriculumUnitsData: { units },
    ks4OptionFilterDimensions: {},
  });
};

const mockMathsPrimary = () =>
  mockProgramme(
    { subjectSlug: "maths", phaseSlug: "primary", ks4OptionSlug: null },
    mathsPrimaryUnits(),
  );

const mockMathsSecondary = () =>
  mockProgramme(
    { subjectSlug: "maths", phaseSlug: "secondary", ks4OptionSlug: null },
    mathsSecondaryUnits(),
  );

const pageFor = (
  searchParams: Record<string, string | string[] | undefined>,
  slug = "maths-primary",
  tab = "units",
) =>
  ProgrammePageTabs({
    params: Promise.resolve({ slug, tab }),
    searchParams: Promise.resolve(searchParams),
  });

const metadataFor = (
  searchParams: Record<string, string | string[] | undefined>,
  slug = "maths-primary",
  tab = "units",
) =>
  generateMetadata({
    params: Promise.resolve({ slug, tab }),
    searchParams: Promise.resolve(searchParams),
  });

const canonicalOf = (path: string) =>
  new URL(path, getBrowserConfig("seoAppUrl")).toString();

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

/**
 * SEO batch 1 – the query-string rule for status codes (rule U6). The
 * canonical and robots rows are under `generateMetadata` below.
 */
describe("Programme page query-string rule: status codes", () => {
  beforeEach(() => {
    mockMathsPrimary();
  });

  it("renders a valid filter combination (200)", async () => {
    expect(await pageFor({ years: "4" })).toBeDefined();
    expect(await pageFor({ keystages: "ks2" })).toBeDefined();
  });

  it("renders a thread URL (200; noindex is set in the metadata)", async () => {
    expect(
      await pageFor({ keystages: "ks2", threads: "number" }),
    ).toBeDefined();
  });

  it("renders a redundant or re-ordered spelling without redirecting (U9)", async () => {
    expect(await pageFor({ keystages: "ks2", years: "4" })).toBeDefined();
  });

  it("renders when only unknown or pre-2026 parameters arrive (U7)", async () => {
    expect(await pageFor({ utm_source: "test", foo: "bar" })).toBeDefined();
    expect(
      await pageFor({ "learning-theme": "number", year: "year-4" }),
    ).toBeDefined();
  });

  it("returns 404 for a known parameter with an invalid value", async () => {
    await expect(pageFor({ years: "99" })).rejects.toEqual(NOT_FOUND);
    await expect(pageFor({ keystages: "ks9" })).rejects.toEqual(NOT_FOUND);
  });

  it("returns 404 for a thread that is not a real thread", async () => {
    await expect(pageFor({ threads: "not-a-real-thread" })).rejects.toEqual(
      NOT_FOUND,
    );
  });

  it("returns 404 for a key stage the year is not in", async () => {
    await expect(pageFor({ years: "4", keystages: "ks1" })).rejects.toEqual(
      NOT_FOUND,
    );
  });

  it("returns 404 for a dependent filter outside the stage it applies to (U3)", async () => {
    mockMathsSecondary();
    await expect(
      pageFor({ years: "7", tiers: "higher" }, "maths-secondary"),
    ).rejects.toEqual(NOT_FOUND);
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    jest.mocked(getProgrammeData).mockClear();
  });

  it("permanentRedirects legacy programme slug on units tab", async () => {
    await expect(
      metadataFor({ year: "year-7" }, "citizenship-secondary-ks3"),
    ).rejects.toThrow(/^NEXT_PERMANENT_REDIRECT;/);
    expect(getProgrammeData).not.toHaveBeenCalled();
  });

  it("returns empty object when no subject data is found", async () => {
    jest.mocked(getSubjectPhaseOptions).mockResolvedValueOnce(null);

    expect(await metadataFor({})).toEqual({});
  });

  it("handles errors gracefully and returns empty object", async () => {
    jest
      .mocked(getSubjectPhaseOptions)
      .mockRejectedValue(new Error("Test error"));

    expect(await metadataFor({})).toEqual({});
  });

  describe("maths primary", () => {
    beforeEach(() => {
      mockMathsPrimary();
    });

    it("generates metadata with title, description, and a self canonical with no trailing ?", async () => {
      const result = await metadataFor({});

      expect(result.title).toBe(
        "Free Primary Maths Lesson & Curriculum Resources",
      );
      expect(result.description).toContain(
        "Get fully sequenced teaching resources and lesson plans for Primary Maths",
      );
      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units"),
      );
      expect(result.robots).toBeUndefined();
      expect(result.openGraph?.title).toBe(
        "Free Primary Maths Lesson & Curriculum Resources",
      );
      expect(result.twitter?.title).toBe(
        "Free Primary Maths Lesson & Curriculum Resources",
      );
    });

    it("keeps a valid filter in the canonical, index follow (U4)", async () => {
      const result = await metadataFor({ years: "4" });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units?years=4"),
      );
      expect(result.robots).toBeUndefined();
      expect(result.title).toBe("Free Y4 Maths Lesson & Curriculum Resources");
    });

    it("drops a key stage implied by the year and fixes the order, without redirecting (U2, U9)", async () => {
      const result = await metadataFor({ keystages: "ks2", years: "4" });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units?years=4"),
      );
      expect(result.robots).toBeUndefined();
    });

    it("keeps a thread in the canonical, sets noindex follow and uses the parent page's title (U5)", async () => {
      const result = await metadataFor({
        threads: "number",
        keystages: "ks2",
        utm_source: "test",
      });

      expect(result.alternates?.canonical).toBe(
        canonicalOf(
          "/teachers/programmes/maths-primary/units?keystages=ks2&threads=number",
        ),
      );
      expect(result.robots).toEqual({ index: false, follow: true });
      expect(result.title).toBe("Free KS2 Maths Lesson & Curriculum Resources");
    });

    it("ignores unknown parameters (U7)", async () => {
      const result = await metadataFor({ utm_source: "test", foo: "bar" });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units"),
      );
      expect(result.robots).toBeUndefined();

      const withFilter = await metadataFor({
        keystages: "ks2",
        gclid: "abc",
      });
      expect(withFilter.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units?keystages=ks2"),
      );
    });

    it("treats a pre-2026 parameter name on a current slug as unknown", async () => {
      const result = await metadataFor({
        "learning-theme": "number",
        year: "year-4",
      });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units"),
      );
      expect(result.robots).toBeUndefined();
    });

    it("returns nothing for an invalid value (the page 404s, U6)", async () => {
      expect(await metadataFor({ years: "99" })).toEqual({});
      expect(await metadataFor({ keystages: "ks9" })).toEqual({});
      expect(await metadataFor({ threads: "not-a-real-thread" })).toEqual({});
    });

    it("includes noindex robots metadata for the download tab", async () => {
      const result = await metadataFor({}, "maths-primary", "download");

      expect(result.robots).toEqual({ index: false, follow: true });
    });
  });

  describe("maths secondary (tiers)", () => {
    beforeEach(() => {
      mockMathsSecondary();
    });

    it("keeps a non-default tier in the canonical", async () => {
      const result = await metadataFor(
        { keystages: "ks4", tiers: "higher" },
        "maths-secondary",
      );

      expect(result.alternates?.canonical).toBe(
        canonicalOf(
          "/teachers/programmes/maths-secondary/units?keystages=ks4&tiers=higher",
        ),
      );
      expect(result.robots).toBeUndefined();
    });

    it("removes a tier equal to the programme default from the canonical and title (U8)", async () => {
      const result = await metadataFor(
        { keystages: "ks4", tiers: "foundation" },
        "maths-secondary",
      );

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-secondary/units?keystages=ks4"),
      );
      expect(result.title).not.toContain("Foundation");
    });

    it("returns nothing for a tier outside KS4 (the page 404s, U3/U6)", async () => {
      expect(
        await metadataFor({ years: "7", tiers: "higher" }, "maths-secondary"),
      ).toEqual({});
    });
  });
});
