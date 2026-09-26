"use client";

import { OakMaxWidth, OakTabs } from "@oaknational/oak-components";
import { useEffect, useMemo, useState } from "react";
import { notFound, usePathname, useSearchParams } from "next/navigation";

import {
  TabName,
  TAB_NAMES,
  TabSlug,
  tabNameToSlug,
  tabSlugToName,
  isTabSlug,
} from "../tabSchema";
import type { Ks4OptionFilterDimension } from "../buildKs4OptionFilterDimensions";

import { ProgrammeHeader } from "./ProgrammeHeader/ProgrammeHeader";
import {
  UnitSequenceView,
  UnitSequenceViewProps,
} from "./UnitSequence/UnitSequenceView";
import { SubjectHeroImageName } from "./ProgrammeHeader/getSubjectHeroImageUrl";
import { ProgrammeOverview } from "./ProgrammeOverview/ProgrammeOverview";
import {
  ProgrammeDownloadsProps,
  ProgrammeDownloads,
} from "./ProgrammeDownloads/ProgrammeDownloads";
import { ImplementationGuideCallout } from "./ImplementationGuideCallout";

import {
  CurriculumDownloadsTierSubjectProps,
  CurriculumUnitsFormattedData,
} from "@/pages-helpers/curriculum/docx/tab-helpers";
import {
  CurriculumSelectionSlugs,
  CurriculumSelectionTitles,
} from "@/utils/curriculum/slugs";
import { ProgrammePageHeaderCMS } from "@/common-lib/cms-types/programmePage";
import {
  CurriculumOverviewSanityData,
  ImplementationGuides,
} from "@/common-lib/cms-types";
import type { Ks4Option } from "@/node-lib/curriculum-api-2023/queries/curriculumPhaseOptions/curriculumPhaseOptions.schema";
import { resolveOakHref } from "@/common-lib/urls";
import { validateSearchParams } from "@/utils/validateProgrammePageSearchParams";
import {
  useBrowseFilters,
  useBrowseFiltersStore,
} from "@/context/BrowseFilters";
import { buildProgrammeMeta } from "@/utils/programme/buildProgrammeMeta";
import { programmeQueryFromFilters } from "@/utils/programme/programmeQuery";
import { canonicaliseProgrammeQuery } from "@/utils/programme/canonicalise";
import { useTeacherBrowseAnalytics } from "@/context/TeacherBrowseAnalytics/TeacherBrowseAnalyticsProvider";
import { ComponentType } from "@/browser-lib/avo/Avo";

export type ProgrammePageProps = {
  subjectPhaseSlug: string;
  /** The programme subject title before any unit-level override. */
  programmeSubjectTitle: string;
  curriculumSelectionSlugs: CurriculumSelectionSlugs;
  curriculumSelectionTitles: CurriculumSelectionTitles;
  curriculumUnitsFormattedData: CurriculumUnitsFormattedData;
  subjectPhaseSanityData: ProgrammePageHeaderCMS | null;
  curriculumCMSInfo: CurriculumOverviewSanityData | null;
  nonCurriculum: boolean;
  curriculumDownloadsTabData: CurriculumDownloadsTierSubjectProps;
  mvRefreshTime: number;
  tabSlug: TabSlug;
  ks4Options: Ks4Option[];
  ks4OptionFilterDimensions: Record<string, Ks4OptionFilterDimension>;
  featureFlags: Record<string, boolean>;
  implementationGuides: ImplementationGuides | null;
  fileSizes: ProgrammeDownloadsProps["fileSizes"];
  activeFlags: string[];
};

export const ProgrammeView = ({
  curriculumSelectionSlugs,
  curriculumSelectionTitles,
  curriculumUnitsFormattedData,
  programmeSubjectTitle,
  subjectPhaseSanityData,
  curriculumCMSInfo,
  nonCurriculum,
  curriculumDownloadsTabData,
  mvRefreshTime,
  tabSlug,
  subjectPhaseSlug,
  ks4Options,
  ks4OptionFilterDimensions,
  featureFlags,
  implementationGuides,
  fileSizes,
  activeFlags,
}: ProgrammePageProps) => {
  const searchParams = useSearchParams();

  const validatedParams = validateSearchParams(searchParams);

  const [activeTab, setActiveTab] = useState<TabSlug>(tabSlug);

  const { subjectSlug } = curriculumSelectionSlugs;
  const { subjectTitle, phaseTitle, examboardTitle } =
    curriculumSelectionTitles;

  const { filters } = useBrowseFilters();
  const { curriculumResourcesAccessed } = useTeacherBrowseAnalytics(
    (store) => store.track,
  );

  const defaultFilter = useBrowseFiltersStore((store) => store.defaultFilter);

  // The H1 comes from the same builder as the <title> (rules T1–T7): the
  // current filter state is turned into the query the server would see for
  // it and normalised with the same function, so the two can never drift.
  const heading = useMemo(() => {
    const canonical = canonicaliseProgrammeQuery(
      programmeQueryFromFilters(filters, defaultFilter),
      curriculumUnitsFormattedData,
      defaultFilter,
    );
    return buildProgrammeMeta({
      subjectTitle: programmeSubjectTitle,
      phaseSlug: curriculumSelectionSlugs.phaseSlug,
      ks4Option: curriculumSelectionSlugs.ks4OptionSlug
        ? {
            slug: curriculumSelectionSlugs.ks4OptionSlug,
            title: examboardTitle ?? curriculumSelectionSlugs.ks4OptionSlug,
          }
        : null,
      data: curriculumUnitsFormattedData,
      query: canonical.query,
      filters: canonical.filters,
      tab: activeTab,
    }).h1;
  }, [
    filters,
    defaultFilter,
    curriculumUnitsFormattedData,
    programmeSubjectTitle,
    curriculumSelectionSlugs,
    examboardTitle,
    activeTab,
  ]);

  // Ensure the active tab matches the one in the latest pathname
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) {
      const tab = pathname.split("/").pop();
      if (isTabSlug(tab)) {
        setActiveTab(tab);
      }
    }
  }, [pathname]);

  const preserveKeystagesParamInUrl = (url: string) => {
    return validatedParams?.keystages
      ? `${url}?keystages=${validatedParams?.keystages}`
      : url;
  };

  return (
    <>
      <ProgrammeHeader
        layoutVariant="large"
        subject={subjectSlug as SubjectHeroImageName}
        heading={heading}
        summary={subjectPhaseSanityData?.bodyCopy}
        bullets={subjectPhaseSanityData?.bullets}
      />
      {nonCurriculum ? null : (
        <OakMaxWidth
          as="nav"
          aria-label="Programme page tabs"
          $ph={["spacing-20", "spacing-20", "spacing-0"]}
          $mb={["spacing-0", "spacing-48", "spacing-48"]}
          data-testid="programme-tabs"
        >
          <OakTabs<TabName>
            sizeVariant={["compact", "default"]}
            colorVariant="black"
            activeTab={tabSlugToName[activeTab]}
            onTabClick={(tabName, event) => {
              const tabSlug = tabNameToSlug[tabName];
              // Prevents a full page reload using client side nav
              event.preventDefault();
              if (tabSlug === "download") {
                curriculumResourcesAccessed({
                  componentType: ComponentType.DOWNLOAD_TAB,
                });
              }
              const url = preserveKeystagesParamInUrl(tabSlug);
              globalThis.history.pushState(null, "", url);
            }}
            tabs={TAB_NAMES.map((tab) => ({
              label: tab,
              type: "link",
              showPromo:
                featureFlags["implementation-guides"] &&
                tabNameToSlug[tab] === "download",
              href: resolveOakHref({
                page: "teacher-programme",
                subjectPhaseSlug,
                tab: tabNameToSlug[tab],
                query: {
                  keystages: validatedParams?.keystages,
                },
              }),
            }))}
          />
          {["units", "curriculum-explainer"].includes(activeTab) &&
            featureFlags["implementation-guides"] && (
              <ImplementationGuideCallout
                subject={curriculumSelectionSlugs.subjectSlug}
                subjectTitle={subjectTitle}
                phase={curriculumSelectionSlugs.phaseSlug}
                phaseTitle={phaseTitle}
                activeFlags={activeFlags}
                onClick={() =>
                  curriculumResourcesAccessed({
                    componentType: ComponentType.IMPLEMENTATION_GUIDE_CALLOUT,
                  })
                }
              />
            )}
        </OakMaxWidth>
      )}
      <TabContent
        tabSlug={activeTab}
        curriculumSelectionSlugs={curriculumSelectionSlugs}
        curriculumUnitsFormattedData={curriculumUnitsFormattedData}
        curriculumCMSInfo={curriculumCMSInfo}
        curriculumDownloadsTabData={curriculumDownloadsTabData}
        mvRefreshTime={mvRefreshTime}
        ks4Options={ks4Options}
        ks4OptionFilterDimensions={ks4OptionFilterDimensions}
        implementationGuides={implementationGuides}
        featureFlags={featureFlags}
        fileSizes={fileSizes}
      />
    </>
  );
};

const TabContent = ({
  tabSlug,
  curriculumSelectionSlugs,
  curriculumUnitsFormattedData,
  curriculumCMSInfo,
  curriculumDownloadsTabData,
  mvRefreshTime,
  ks4Options,
  ks4OptionFilterDimensions,
  implementationGuides,
  featureFlags,
  fileSizes,
}: {
  tabSlug: TabSlug;
  featureFlags: Record<string, boolean>;
} & UnitSequenceViewProps & {
    curriculumCMSInfo: CurriculumOverviewSanityData | null;
    implementationGuides: ImplementationGuides | null;
  } & ProgrammeDownloadsProps) => {
  if (tabSlug === "units") {
    return (
      <UnitSequenceView
        curriculumSelectionSlugs={curriculumSelectionSlugs}
        curriculumUnitsFormattedData={curriculumUnitsFormattedData}
        ks4Options={ks4Options}
        ks4OptionFilterDimensions={ks4OptionFilterDimensions}
      />
    );
  } else if (tabSlug === "curriculum-explainer") {
    if (!curriculumCMSInfo) {
      notFound();
    }
    return <ProgrammeOverview curriculumCMSInfo={curriculumCMSInfo} />;
  } else if (tabSlug === "download") {
    return (
      <ProgrammeDownloads
        mvRefreshTime={mvRefreshTime}
        curriculumSelectionSlugs={curriculumSelectionSlugs}
        curriculumDownloadsTabData={curriculumDownloadsTabData}
        curriculumUnitsFormattedData={curriculumUnitsFormattedData}
        implementationGuides={implementationGuides}
        featureFlags={featureFlags}
        fileSizes={fileSizes}
      />
    );
  }
  return notFound();
};
