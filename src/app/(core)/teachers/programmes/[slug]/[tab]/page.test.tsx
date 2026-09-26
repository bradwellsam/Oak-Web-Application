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
    RedirectType: { push: "push", replace: "replace" },
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

const mockMathsPrimary = () => {
  jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
    subjects: filterValidCurriculumPhaseOptions(
      curriculumPhaseOptionsFixture(),
    ),
    subjectPhaseKeystageSlugs: {
      subjectSlug: "maths",
      phaseSlug: "primary",
      ks4OptionSlug: null,
    } satisfies CurriculumSelectionSlugs,
  });
  jest.mocked(getProgrammeData).mockResolvedValue({
    programmeUnitsData: curriculumOverviewMVFixture({ subjectTitle: "Maths" }),
    curriculumUnitsData: { units: mathsPrimaryUnits() },
    ks4OptionFilterDimensions: {},
  });
};

const metadataFor = (
  searchParams: Record<string, string | string[] | undefined>,
  tab = "units",
  slug = "maths-primary",
) =>
  generateMetadata({
    params: Promise.resolve({ slug, tab }),
    searchParams: Promise.resolve(searchParams),
  });

const canonicalOf = (path: string) =>
  new URL(path, getBrowserConfig("seoAppUrl")).toString();

describe("Programme page query-string rule (U6)", () => {
  beforeEach(() => {
    mockMathsPrimary();
  });

  it("returns 404 for an invalid filter value", async () => {
    await expect(
      ProgrammePageTabs({
        params: Promise.resolve({ slug: "maths-primary", tab: "units" }),
        searchParams: Promise.resolve({ years: "99" }),
      }),
    ).rejects.toEqual(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
  });

  it("returns 404 for a thread that is not a real thread", async () => {
    await expect(
      ProgrammePageTabs({
        params: Promise.resolve({ slug: "maths-primary", tab: "units" }),
        searchParams: Promise.resolve({ threads: "not-a-real-thread" }),
      }),
    ).rejects.toEqual(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
  });

  it("redirects KS4 science child-subject slugs to the science programme", async () => {
    jest.mocked(getSubjectPhaseOptions).mockResolvedValue(null);
    await expect(
      ProgrammePageTabs({
        params: Promise.resolve({ slug: "biology-secondary", tab: "units" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(
      "NEXT_PERMANENT_REDIRECT;/teachers/programmes/science-secondary/units?keystages=ks4&child_subjects=biology",
    );
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    jest.mocked(getProgrammeData).mockClear();
  });

  it("permanentRedirects legacy programme slug on units tab", async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: "citizenship-secondary-ks3",
          tab: "units",
        }),
        searchParams: Promise.resolve({ year: "year-7" }),
      }),
    ).rejects.toThrow(/^NEXT_PERMANENT_REDIRECT;/);
    expect(getProgrammeData).not.toHaveBeenCalled();
  });

  it("returns empty object when no subject data is found", async () => {
    jest.mocked(getSubjectPhaseOptions).mockResolvedValueOnce(null);

    const result = await metadataFor({});

    expect(result).toEqual({});
  });

  it("handles errors gracefully and returns empty object", async () => {
    jest
      .mocked(getSubjectPhaseOptions)
      .mockRejectedValue(new Error("Test error"));

    expect(await metadataFor({})).toEqual({});
  });

  describe("with programme data", () => {
    beforeEach(() => {
      mockMathsPrimary();
    });

    it("generates title, description and a clean self canonical (no trailing ?)", async () => {
      const result = await metadataFor({});

      expect(result.title).toBe("Free Primary Maths Lesson Resources");
      expect(result.description).toBe(
        "Free primary maths lesson resources. Fully sequenced units and lesson plans from Oak National Academy.",
      );
      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units"),
      );
      expect(result.robots).toBeUndefined();
      expect(result.openGraph?.title).toBe(
        "Free Primary Maths Lesson Resources",
      );
      expect(result.twitter?.title).toBe("Free Primary Maths Lesson Resources");
    });

    it("keeps a valid filter in the canonical and gives the page its own title (U4)", async () => {
      const result = await metadataFor({ years: "4" });

      expect(result.title).toBe("Free Year 4 Maths Lesson Resources");
      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units?years=4"),
      );
      expect(result.robots).toBeUndefined();
    });

    it("normalises order and drops a redundant key stage in the canonical, without redirecting (U2, U9)", async () => {
      const result = await metadataFor({ keystages: "ks2", years: "4" });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units?years=4"),
      );
    });

    it("keeps a thread in the canonical, sets noindex and leaves the title alone (U5, T7)", async () => {
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
      expect(result.title).toBe("Free KS2 Maths Lesson Resources");
    });

    it("ignores unknown parameters (U7)", async () => {
      const result = await metadataFor({ utm_source: "test", foo: "bar" });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units"),
      );
      expect(result.robots).toBeUndefined();
    });

    it("treats a pre-2026 parameter name on a current slug as unknown", async () => {
      const result = await metadataFor({ "learning-theme": "number" });

      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/units"),
      );
      expect(result.robots).toBeUndefined();
    });

    it("returns nothing for an invalid value (the page 404s)", async () => {
      expect(await metadataFor({ years: "99" })).toEqual({});
      expect(await metadataFor({ keystages: "ks9" })).toEqual({});
    });

    it("gives the explainer its own title and a self canonical with no query", async () => {
      const result = await metadataFor(
        { keystages: "ks2" },
        "curriculum-explainer",
      );

      expect(result.title).toBe("Free Primary Maths Curriculum Explainer");
      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/curriculum-explainer"),
      );
      expect(result.robots).toBeUndefined();
    });

    it("keeps the download tab noindex with a self canonical", async () => {
      const result = await metadataFor({}, "download");

      expect(result.robots).toEqual({ index: false, follow: true });
      expect(result.alternates?.canonical).toBe(
        canonicalOf("/teachers/programmes/maths-primary/download"),
      );
    });
  });

  it("canonicalises a board's explainer to the subject-phase's default board", async () => {
    jest.mocked(getSubjectPhaseOptions).mockResolvedValue({
      subjects: filterValidCurriculumPhaseOptions(
        curriculumPhaseOptionsFixture(),
      ),
      subjectPhaseKeystageSlugs: {
        subjectSlug: "english",
        phaseSlug: "secondary",
        ks4OptionSlug: "edexcel",
      } satisfies CurriculumSelectionSlugs,
    });
    jest.mocked(getProgrammeData).mockResolvedValue({
      programmeUnitsData: curriculumOverviewMVFixture({
        subjectTitle: "English",
      }),
      curriculumUnitsData: {
        units: ["7", "8", "9", "10", "11"].map((year, i) =>
          createUnit({
            slug: `unit-y${year}`,
            year,
            subject_slug: "english",
            phase_slug: "secondary",
            order: i,
          }),
        ),
      },
      ks4OptionFilterDimensions: {},
    });

    const result = await metadataFor(
      {},
      "curriculum-explainer",
      "english-secondary-edexcel",
    );

    expect(result.alternates?.canonical).toBe(
      canonicalOf(
        "/teachers/programmes/english-secondary-aqa/curriculum-explainer",
      ),
    );
    expect(result.title).toBe(
      "Free Edexcel Secondary English Curriculum Explainer",
    );
  });
});
