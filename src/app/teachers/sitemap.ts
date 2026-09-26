import type { MetadataRoute } from "next";

import errorReporter from "@/common-lib/error-reporter";
import curriculumApi2023 from "@/node-lib/curriculum-api-2023";
import {
  buildTeachersSitemapEntries,
  listProgrammePageSlugs,
  type ProgrammeUnitsBySlug,
} from "@/pages-helpers/teacher/sitemap-pages/sitemapPagesHelper";
import { getProgrammeUnitsData } from "@/app/(core)/teachers/programmes/[slug]/[tab]/getProgrammeData";

export const revalidate = 7200;

const reportError = errorReporter("teachers-sitemap::app");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const [data, subjects] = await Promise.all([
      curriculumApi2023.teachersSitemap(),
      curriculumApi2023.curriculumPhaseOptions({ includeNonCurriculum: true }),
    ]);

    // The filter-page variants are enumerated from each programme's own units
    // with the same rule the page uses (SEO sitemap ticket), so a listed URL
    // is always 200 / index / self-canonical.
    const programmeUnitsBySlug: ProgrammeUnitsBySlug = {};
    await Promise.all(
      listProgrammePageSlugs(subjects).map(async (subjectPhaseSlug) => {
        const units = await getProgrammeUnitsData(subjectPhaseSlug);
        if (units) {
          programmeUnitsBySlug[subjectPhaseSlug] = units;
        }
      }),
    );

    return buildTeachersSitemapEntries(data, subjects, programmeUnitsBySlug);
  } catch (error) {
    await reportError(error, {});
    throw error;
  }
}
