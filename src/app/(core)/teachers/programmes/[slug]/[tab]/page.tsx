import { notFound, redirect, RedirectType } from "next/navigation";
import { Metadata } from "next";
import { cache } from "react";
import { cookies, draftMode } from "next/headers";

import { ProgrammePageProps, ProgrammeView } from "./Components/ProgrammeView";
import { isTabSlug } from "./tabSchema";
import { getMetaTitle } from "./getMetaTitle";
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
  isValidSubjectPhaseSlug,
  getKs4RedirectSlug,
} from "@/utils/curriculum/slugs";
import errorReporter from "@/common-lib/error-reporter";
import withPageErrorHandling, {
  AppPageProps,
} from "@/hocs/withPageErrorHandling";
import { resolveOakHref } from "@/common-lib/urls";
import { getSubjectPhaseSlug } from "@/components/TeacherComponents/helpers/getSubjectPhaseSlug";
import { BrowseFiltersProvider } from "@/context/BrowseFilters";
import { redirectProgrammeSlugIfNeeded } from "@/utils/integratedJourney/legacyProgrammeUnitsRedirect";
import { cacheData, CURRICULUM_API_CACHE_TAG } from "@/node-lib/cache";
import CMSClient from "@/node-lib/cms";
import { getMvRefreshTime } from "@/pages-helpers/curriculum/downloads/getMvRefreshTime";
import { validateServerSearchParams } from "@/utils/validateProgrammePageSearchParams";
import { TeacherBrowseAnalyticsStoreProvider } from "@/context/TeacherBrowseAnalytics/TeacherBrowseAnalyticsProvider";
import { getProgrammeStateForProgramme } from "@/context/TeacherBrowseAnalytics/utils/getProgrammeState";
import { getActiveCookieFlags } from "@/hooks/useCookieFlag/getActiveCookieFlags";
import { getDefaultBrowseFilter } from "@/context/BrowseFilters/utils/getDefaultBrowseFilter";
import { canonicaliseProgrammeQuery } from "@/utils/programme/canonicalise";

const reportError = errorReporter("programme-page::app");

type ProgrammePageParams = { slug: string; tab: string };
export type PageSearchParms = { [key: string]: string | string[] | undefined };

const getCachedSubjectOptionData = cache(async (subjectPhaseSlug: string) =>
  getSubjectPhaseOptions(subjectPhaseSlug),
);

// `generateMetadata` and the page both need the programme's units: the
// canonical, the robots tag and the 404 decision are all made against them.
// React `cache` dedupes the two calls within one request.
const getCachedProgrammeData = cache(getProgrammeData);

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
 * Loads the programme for a valid slug and normalises the request's query
 * string against its units (SEO batch 1: status code, canonical, robots).
 * Shared by `generateMetadata` and the page so both make the same decision.
 *
 * Returns `null` when the slug is unknown, `{ programme: null }` when the
 * slug is a board-less or otherwise invalid subject-phase (the page redirects
 * or 404s), and the full state otherwise.
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

  return {
    cachedSubjectData,
    programme,
    curriculumUnitsFormattedData,
    defaultFilter,
    canonical,
  };
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

  redirectProgrammeSlugIfNeeded(slug, originalSearchParams);

  try {
    const state = await getProgrammePageState(slug, originalSearchParams);
    if (!state?.programme) {
      // Unknown, board-less or data-less slug: the page redirects or 404s.
      return {};
    }
    const { cachedSubjectData, canonical } = state;

    if (!canonical.isValid) {
      // Rule U6: a known filter with a value this programme does not have (or
      // a combination that matches no unit) is a 404; nothing to describe.
      return {};
    }

    // Rules U1/U2/U7/U8: the canonical is the normalised query – fixed order,
    // no redundant key stage, no default value, no unknown parameter – so any
    // spelling of one page names the same URL. `resolveOakHref` emits no
    // trailing `?` for an empty query (urls.ts).
    const canonicalURL = canonicalUrl(
      resolveOakHref({
        page: "teacher-programme",
        subjectPhaseSlug: slug,
        tab: "units",
        query: canonical.query,
      }),
    );

    // Title and description: unchanged builder, fed the normalised query
    // without `threads` so a thread view carries its parent page's title
    // (rule U5). Unique titles per combination are a later batch.
    const { threads: _threads, ...titleQuery } = canonical.query;
    const { title, description } = getMetaTitle(cachedSubjectData, titleQuery);

    // Rule U5: any URL containing `threads` is `noindex, follow`; the
    // download tab stays noindex as before.
    const isNoindex = tab === "download" || canonical.noindex;

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
  const searchParams = validateServerSearchParams(originalSearchParams);
  const { slug: subjectPhaseSlug, tab } = await props.params;

  redirectProgrammeSlugIfNeeded(subjectPhaseSlug, searchParams ?? {});

  if (!isTabSlug(tab)) {
    return redirect("units");
  }

  const cachedSubjectData = await getCachedSubjectOptionData(subjectPhaseSlug);

  if (!cachedSubjectData) {
    return notFound();
  }

  const { subjects, subjectPhaseKeystageSlugs } = cachedSubjectData;

  const isSlugValid = isValidSubjectPhaseSlug(
    subjects,
    subjectPhaseKeystageSlugs,
  );

  if (!isSlugValid) {
    const redirectParams = getKs4RedirectSlug(
      subjects,
      subjectPhaseKeystageSlugs,
    );
    if (redirectParams) {
      const { subjectSlug, phaseSlug, ks4OptionSlug } = redirectParams;

      const programmePageHref = resolveOakHref({
        page: "teacher-programme",
        subjectPhaseSlug: getSubjectPhaseSlug({
          subject: subjectSlug,
          phaseSlug,
          examBoardSlug: ks4OptionSlug,
        }),
        tab,
        query: searchParams,
      });

      return redirect(programmePageHref, RedirectType.replace);
    } else {
      throw new OakError({
        code: "curriculum-api/not-found",
      });
    }
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
    // Rule U6: an invalid filter value or an empty combination is not a page.
    // Rendering an empty unit list under an invented title is what made the
    // URL space unbounded; a 404 is the only response with nothing to index.
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
  // normalised query applied (unknown parameters ignored, rule U7).
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
