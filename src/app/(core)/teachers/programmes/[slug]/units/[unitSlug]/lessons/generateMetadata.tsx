import { Metadata } from "next";

import { getCachedUnitData } from "./getCachedUnitData";
import { getLessonResourcesMetaTitle } from "./getLessonResourcesMetaTitle";

import { getOpenGraphMetadata, getTwitterMetadata } from "@/app/metadata";
import { AppPageProps } from "@/hocs/withPageErrorHandling";
import { resolveOakHref } from "@/common-lib/urls";
import { canonicalUrl } from "@/app/canonical";

type LessonsPageParams = { slug: string; unitSlug: string };

export const dynamic = "force-static";

export async function generateMetadata(
  props: AppPageProps<LessonsPageParams>,
): Promise<Metadata> {
  const { slug: programmeSlug, unitSlug } = await props.params;

  try {
    const data = await getCachedUnitData(programmeSlug, unitSlug);
    const {
      unitTitle,
      keyStageSlug,
      year,
      subjectTitle,
      examBoardTitle,
      tierTitle,
      pathwayTitle,
    } = data;

    const title = getLessonResourcesMetaTitle({
      contentTitle: unitTitle,
      keyStageSlug,
      year,
      subjectTitle,
      tierTitle,
      examBoardTitle,
      pathwayTitle,
    });
    const description = `Free lessons and teaching resources about ${unitTitle.toLowerCase()}`;

    // Self-referencing canonical to the clean unit URL, so tracking-parameter
    // variants (`?sid-…&sm=0&src=3`, `?utm_…`) are never indexed as duplicates.
    const canonical = canonicalUrl(
      resolveOakHref({
        page: "unit-overview",
        programmeSlug,
        unitSlug,
      }),
    );

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: getOpenGraphMetadata({ title, description }),
      twitter: getTwitterMetadata({ title, description }),
    };
  } catch {
    return {};
  }
}
