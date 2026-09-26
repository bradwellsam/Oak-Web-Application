import {
  notFound,
  permanentRedirect,
  redirect,
  RedirectType,
} from "next/navigation";
import { Metadata } from "next";
import { cache } from "react";
import { cookies, draftMode } from "next/headers";

import { ProgrammePageProps, ProgrammeView } from "./Components/ProgrammeView";
import { isTabSlug, TabSlug } from "./tabSchema";
import {
  getSubjectPhaseOptions,
  getProgrammeData,
  getSubjectOverride,
  getCachedFileSizes,
} from "./getProgrammeData";

import LayoutPreviewControls from "@/components/AppComponents/LayoutPreviewControls";
import { isFeatureFlagEnabledServer } from "@/utils/featureFlagChecks/server";
import {
  createDownloadsData,
  formatCurriculumUnitsData,
} from "@/pages-helpers/curriculum/docx/tab-helpers";
import { getOpenGraphMetadata, getTwitterMetadata } from "@/app/metadata";
import { canonicalUrl } from "@/app/canonical";
import OakError from "@/errors/OakError";
import {
  getDefaultKs4SubjectPhaseSlug,
  isValidSubjectPhaseSlug,
  parseSubjectPhaseSlug,
} from "@/utils/curriculum/slugs";
import { getSubjectPhaseSlug } from "@/components/TeacherComponents/helpers/getSubjectPhaseSlug";
import { SCIENCE_CHILD_SUBJECT_SLUGS } from "@/utils/curriculum/ks4ExamboardPreference";
import errorReporter from "@/common-lib/error-reporter";
import withPageErrorHandling, {
  AppPageProps,
} from "@/hocs/withPageErrorHandling";
import { resolveOakHref } from "@/common-lib/urls";
import { BrowseFiltersProvider } from "@/context/BrowseFilters";
import { redirectProgrammeSlugIfNeeded } from "@/utils/integratedJourney/legacyProgrammeUnitsRedirect";
import { cacheData, CURRICULUM_API_CACHE_TAG } from "@/node-lib/cache";
import CMSClient from "@/node-lib/cms";
import { getMvRefreshTime } from "@/pages-helpers/curriculum/downloads/getMvRefreshTime";
import { TeacherBrowseAnalyticsStoreProvider } from "@/context/TeacherBrowseAnalytics/TeacherBrowseAnalyticsProvider";
import { getProgrammeStateForProgramme } from "@/context/TeacherBrowseAnalytics/utils/getProgrammeState";
import { getActiveCookieFlags } from "@/hooks/useCookieFlag/getActiveCookieFlags";
import { getDefaultBrowseFilter } from "@/context/BrowseFilters/utils/getDefaultBrowseFilter";
import {
  canonicaliseProgrammeQuery,
  type CanonicalProgrammeQuery,
} from "@/utils/programme/canonicalise";
import {
  orderProgrammeQuery,
  readProgrammeQuery,
} from "@/utils/programme/programmeQuery";
import { buildProgrammeMeta } from "@/utils/programme/buildProgrammeMeta";

const reportError = errorReporter("programme-page::app");

type ProgrammePageParams = { slug: string; tab: string };
export type PageSearchParms = { [key: string]: string | string[] | undefined };

const getCachedSubjectOptionData = cache(async (subjectPhaseSlug: string) =>
  getSubjectPhaseOptions(subjectPhaseSlug),
);

// `generateMetadata` and the page both need the programme's units (the
// canonical, robots and 404 decisions are made against them); React `cache`
// dedupes the two calls within one request.
const getCachedProgrammeData = cache(getProgrammeData);

/**
 * Resolves a board-less secondary slug (`english-secondary`) to its
 * default-board slug (`english-secondary-aqa`) so legacy redirects land on
 * the final URL in one hop. Falls back to the input when the slug is already
 * valid or has no default board.
 */
const resolveDefaultKs4SubjectPhaseSlug = async (
  subjectPhaseSlug: string,
): Promise<string> => {
  const data = await getCachedSubjectOptionData(subjectPhaseSlug);
  if (!data) {
    return subjectPhaseSlug;
  }
  return (
    getDefaultKs4SubjectPhaseSlug(data.subjects, subjectPhaseSlug) ??
    subjectPhaseSlug
  );
};

/**
 * `/teachers/programmes/biology-secondary/units` (and the other KS4 science
 * child subjects) used to 404 because `biology` is not a subject-phase. They
 * 308 to the science programme with the child subject selected. Child
 * subjects only exist at KS4, so `keystages=ks4` is set for the URL to be a
 * valid combination (rule U6).
 */
const getScienceChildSubjectRedirect = async (
  subjectPhaseSlug: string,
  tab: string,
  query: PageSearchParms | undefined,
): Promise<string | null> => {
  const slugs = parseSubjectPhaseSlug(subjectPhaseSlug);
  if (
    !slugs ||
    slugs.phaseSlug !== "secondary" ||
    !SCIENCE_CHILD_SUBJECT_SLUGS.has(slugs.subjectSlug)
  ) {
    return null;
  }
  const scienceSlug =
    await resolveDefaultKs4SubjectPhaseSlug("science-secondary");
  const { query: known, unknown } = readProgrammeQuery(query);
  const ordered = orderProgrammeQuery({
    ...known,
    keystages: known.years ? undefined : "ks4",
    child_subjects: slugs.subjectSlug,
  });
  return resolveOakHref({
    page: "teacher-programme",
    subjectPhaseSlug: scienceSlug,
    tab: isTabSlug(tab) ? tab : "units",
    query: { ...ordered, ...unknown },
  });
};

/**
 * The explainer is one page per subject-phase: its content comes from the CMS
 * keyed on subject and phase, so the AQA, Edexcel and OCR programmes of one
 * subject share it. The canonical explainer lives on the programme a
 * board-less URL redirects to (the default KS4 option).
 */
const getCanonicalExplainerSlug = (
  subjects: Parameters<typeof getDefaultKs4SubjectPhaseSlug>[0],
  slugs: {
    subjectSlug: string;
    phaseSlug: string;
    ks4OptionSlug: string | null;
  },
  subjectPhaseSlug: string,
): string => {
  if (!slugs.ks4OptionSlug) {
    return subjectPhaseSlug;
  }
  const boardless = getSubjectPhaseSlug({
    subject: slugs.subjectSlug,
    phaseSlug: slugs.phaseSlug,
  });
  return getDefaultKs4SubjectPhaseSlug(subjects, boardless) ?? subjectPhaseSlug;
};

export type ProgrammeCmsParams = {
  subjectPhaseSlug: string;
  nonCurriculum: boolean;
  subjectTitle: string;
  phaseSlug: string;
  programmePageSlug: string;
  isPreviewModeEnabled: boolean;
};

const getCachedProgrammeCms = cache(
  cacheData(
    async ({
      nonCurriculum,
      subjectTitle,
      phaseSlug,
      programmePageSlug,
      isPreviewModeEnabled,
    }: ProgrammeCmsParams) => {
      const [curriculumCMSInfo, subjectPhaseSanityData, mvRefreshTime] =
        await Promise.all([
          nonCurriculum
            ? null
            : CMSClient.curriculumOverviewPage({
                previewMode: isPreviewModeEnabled,
                subjectTitle,
                phaseSlug,
              }),
          CMSClient.programmePageBySlug(programmePageSlug, {
            previewMode: isPreviewModeEnabled,
          }),
          getMvRefreshTime(),
        ]);

      return {
        curriculumCMSInfo,
        subjectPhaseSanityData,
        mvRefreshTime,
      };
    },
    ["programme-cms"],
  ),
);

const getCachedImplementationGuides = cache(
  cacheData(
    async (opts: { subjectTitle: string; phaseSlug: string }) => {
      return CMSClient.implementationGuides(opts);
    },
    ["programme-implementation-guides"],
    { tags: [CURRICULUM_API_CACHE_TAG] },
  ),
);

/**
 * Loads everything the SEO rules need for a valid programme slug and
 * normalises the request's query string against it. Shared by
 * `generateMetadata` and the page so both make identical decisions.
 */
async function getProgrammePageState(
  subjectPhaseSlug: string,
  searchParams: PageSearchParms,
) {
  const cachedSubjectData = await getCachedSubjectOptionData(subjectPhaseSlug);
  if (!cachedSubjectData) {
    return null;
  }
  const { subjects, subjectPhaseKeystageSlugs } = cachedSubjectData;
  if (!isValidSubjectPhaseSlug(subjects, subjectPhaseKeystageSlugs)) {
    return { cachedSubjectData, programme: null };
  }
  const programme = await getCachedProgrammeData(subjectPhaseSlug, subjects);
  if (!programme) {
    return { cachedSubjectData, programme: null };
  }

  const curriculumUnitsFormattedData = formatCurriculumUnitsData(
    programme.curriculumUnitsData,
  );
  const defaultFilter = getDefaultBrowseFilter(curriculumUnitsFormattedData);
  const canonical = canonicaliseProgrammeQuery(
    searchParams,
    curriculumUnitsFormattedData,
    defaultFilter,
  );

  const ks4Option =
    subjects
      .find((s) => s.slug === subjectPhaseKeystageSlugs.subjectSlug)
      ?.ks4_options?.find(
        (opt) => opt.slug === subjectPhaseKeystageSlugs.ks4OptionSlug,
      ) ?? null;

  return {
    cachedSubjectData,
    programme,
    curriculumUnitsFormattedData,
    defaultFilter,
    canonical,
    ks4Option,
  };
}

function programmeTabHref(
  subjectPhaseSlug: string,
  tab: TabSlug,
  canonical: CanonicalProgrammeQuery,
): string {
  return canonicalUrl(
    resolveOakHref({
      page: "teacher-programme",
      subjectPhaseSlug,
      tab,
      query: tab === "units" ? canonical.query : undefined,
    }),
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<ProgrammePageParams>;
  searchParams: Promise<PageSearchParms>;
}): Promise<Metadata> {
  const { slug, tab } = await params;
  const originalSearchParams = await searchParams;

  await redirectProgrammeSlugIfNeeded(
    slug,
    originalSearchParams,
    resolveDefaultKs4SubjectPhaseSlug,
  );

  try {
    const state = await getProgrammePageState(slug, originalSearchParams);
    if (!state?.programme) {
      // Unknown or board-less slug: the page redirects or 404s.
      return {};
    }
    const {
      cachedSubjectData: { subjects, subjectPhaseKeystageSlugs },
      programme,
      curriculumUnitsFormattedData,
      canonical,
      ks4Option,
    } = state;

    if (!canonical.isValid) {
      // Rule U6: the page returns 404; nothing to describe.
      return {};
    }

    const tabSlug: TabSlug = isTabSlug(tab) ? tab : "units";
    const { title, description } = buildProgrammeMeta({
      subjectTitle: programme.programmeUnitsData.subjectTitle,
      phaseSlug: subjectPhaseKeystageSlugs.phaseSlug,
      ks4Option,
      data: curriculumUnitsFormattedData,
      query: canonical.query,
      filters: canonical.filters,
      tab: tabSlug,
    });

    // Rules U4/U5 (units), explainer and download rules: every tab is
    // self-canonical – the units tab to its normalised query, the explainer
    // to the subject-phase's one explainer, the download tab to itself.
    const canonicalSlug =
      tabSlug === "curriculum-explainer"
        ? getCanonicalExplainerSlug(subjects, subjectPhaseKeystageSlugs, slug)
        : slug;
    const canonicalURL = programmeTabHref(canonicalSlug, tabSlug, canonical);

    const isNoindex =
      tabSlug === "download" || (tabSlug === "units" && canonical.noindex);

    return {
      title,
      description,
      alternates: {
        canonical: canonicalURL,
      },
      ...(isNoindex && {
        robots: {
          index: false,
          follow: true,
        },
      }),
      openGraph: getOpenGraphMetadata({
        title,
        description,
      }),
      twitter: getTwitterMetadata({
        title,
        description,
      }),
    };
  } catch (error) {
    reportError(error);
    // Return and fallback to layout metadata
    return {};
  }
}

const InnerProgrammePage = async (props: AppPageProps<ProgrammePageParams>) => {
  const cookieStore = await cookies();
  const activeFlags = await getActiveCookieFlags();
  const originalSearchParams = await props.searchParams!;
  const { slug: subjectPhaseSlug, tab } = await props.params;

  await redirectProgrammeSlugIfNeeded(
    subjectPhaseSlug,
    originalSearchParams,
    resolveDefaultKs4SubjectPhaseSlug,
  );

  if (!isTabSlug(tab)) {
    return redirect("units");
  }

  const cachedSubjectData = await getCachedSubjectOptionData(subjectPhaseSlug);

  if (!cachedSubjectData) {
    // KS4 science child subjects (`biology-secondary` …) are not
    // subject-phases; send them to the science programme instead of 404.
    const scienceRedirect = await getScienceChildSubjectRedirect(
      subjectPhaseSlug,
      tab,
      originalSearchParams,
    );
    if (scienceRedirect) {
      return permanentRedirect(scienceRedirect, RedirectType.replace);
    }
    return notFound();
  }

  const { subjects, subjectPhaseKeystageSlugs } = cachedSubjectData;

  const isSlugValid = isValidSubjectPhaseSlug(
    subjects,
    subjectPhaseKeystageSlugs,
  );

  if (!isSlugValid) {
    // The exam-board redirect (`english-secondary` → `english-secondary-aqa`)
    // is a 308 (was a temporary 307). Known filters are carried in canonical
    // order and tracking parameters are kept; no trailing `?` (see urls.ts).
    const defaultKs4Slug = getDefaultKs4SubjectPhaseSlug(
      subjects,
      subjectPhaseSlug,
    );

    if (defaultKs4Slug) {
      const { query, unknown } = readProgrammeQuery(originalSearchParams);
      const programmePageHref = resolveOakHref({
        page: "teacher-programme",
        subjectPhaseSlug: defaultKs4Slug,
        tab,
        query: { ...orderProgrammeQuery(query), ...unknown },
      });

      return permanentRedirect(programmePageHref, RedirectType.replace);
    }

    const scienceRedirect = await getScienceChildSubjectRedirect(
      subjectPhaseSlug,
      tab,
      originalSearchParams,
    );
    if (scienceRedirect) {
      return permanentRedirect(scienceRedirect, RedirectType.replace);
    }

    throw new OakError({
      code: "curriculum-api/not-found",
    });
  }

  const state = await getProgrammePageState(
    subjectPhaseSlug,
    originalSearchParams,
  );

  if (!state?.programme) {
    return notFound();
  }

  const {
    programme: cachedProgrammeData,
    curriculumUnitsFormattedData,
    defaultFilter,
    canonical,
  } = state;

  if (!canonical.isValid) {
    // Rule U6: a known filter with a value this programme does not have, or a
    // combination that matches no unit, is not a page.
    return notFound();
  }

  const { programmeUnitsData, curriculumUnitsData, ks4OptionFilterDimensions } =
    cachedProgrammeData;

  const curriculumPhaseOptions = {
    subjects,
    tab: "units" as const,
  };

  const { isEnabled } = await draftMode();

  // The filter state the page renders with: the programme defaults with the
  // normalised query applied (unknown parameters ignored).
  const resolvedFilter = canonical.filters;

  // All KS4 options for subject phase
  const ks4Options =
    curriculumPhaseOptions.subjects.find(
      (s) => s.slug === subjectPhaseKeystageSlugs.subjectSlug,
    )!.ks4_options ?? [];

  // Find examboard title from subject phases
  const ks4Option = curriculumPhaseOptions.subjects
    .flatMap((subject) => subject.ks4_options)
    .find((ks4opt) => ks4opt?.slug === subjectPhaseKeystageSlugs.ks4OptionSlug);

  const curriculumDownloadsTabData = createDownloadsData(
    curriculumUnitsData.units,
  );

  const curriculumSelectionTitles = {
    subjectTitle:
      getSubjectOverride(curriculumUnitsData.units, resolvedFilter) ??
      programmeUnitsData.subjectTitle,
    phaseTitle: programmeUnitsData.phaseTitle,
    examboardTitle: ks4Option?.title,
  };

  // None of these depend on each other's results, so run them concurrently instead of as a waterfall
  const [
    { curriculumCMSInfo, subjectPhaseSanityData, mvRefreshTime },
    isImplementationGuidesEnabled,
    implementationGuides,
    fileSizes,
  ] = await Promise.all([
    getCachedProgrammeCms({
      subjectPhaseSlug,
      nonCurriculum: programmeUnitsData.nonCurriculum,
      subjectTitle: programmeUnitsData.subjectTitle,
      phaseSlug: subjectPhaseKeystageSlugs.phaseSlug,
      programmePageSlug: `${subjectPhaseKeystageSlugs.subjectSlug}-${subjectPhaseKeystageSlugs.phaseSlug}`,
      isPreviewModeEnabled: isEnabled,
    }),
    isFeatureFlagEnabledServer(
      Object.fromEntries(
        cookieStore.getAll().map(({ name, value }) => [name, value]),
      ),
      "implementation-guides",
    ),
    getCachedImplementationGuides({
      subjectTitle: programmeUnitsData.subjectTitle,
      phaseSlug: subjectPhaseKeystageSlugs.phaseSlug,
    }),
    getCachedFileSizes(subjectPhaseKeystageSlugs, curriculumDownloadsTabData),
  ]);

  if (!curriculumCMSInfo && !programmeUnitsData.nonCurriculum) {
    return notFound();
  }

  if (!subjectPhaseSanityData) {
    reportError(
      new OakError({
        code: "cms/missing-programme-page-data",
        meta: { subjectPhaseSlug },
      }),
    );
  }

  const results: ProgrammePageProps = {
    subjectPhaseSlug,
    programmeSubjectTitle: programmeUnitsData.subjectTitle,
    curriculumSelectionSlugs: subjectPhaseKeystageSlugs,
    curriculumSelectionTitles,
    curriculumUnitsFormattedData,
    subjectPhaseSanityData,
    tabSlug: tab,
    curriculumCMSInfo,
    ks4Options,
    ks4OptionFilterDimensions,
    curriculumDownloadsTabData,
    mvRefreshTime,
    fileSizes,
    featureFlags: {
      "implementation-guides": isImplementationGuidesEnabled,
    },
    implementationGuides,
    nonCurriculum: cachedProgrammeData.programmeUnitsData.nonCurriculum,
    activeFlags,
  };

  const programmeState = getProgrammeStateForProgramme({
    programmeSlug: subjectPhaseSlug,
    ...subjectPhaseKeystageSlugs,
    ...curriculumSelectionTitles,
  });

  return (
    <TeacherBrowseAnalyticsStoreProvider
      programmeState={programmeState}
      accessLevel="programme"
    >
      <BrowseFiltersProvider
        defaultFilter={defaultFilter}
        initialFilter={resolvedFilter}
      >
        <ProgrammeView {...results} />
        {isEnabled && <LayoutPreviewControls />}
      </BrowseFiltersProvider>
    </TeacherBrowseAnalyticsStoreProvider>
  );
};

const ProgrammePage = withPageErrorHandling(
  InnerProgrammePage,
  "programme-page::app",
);

export default ProgrammePage;
