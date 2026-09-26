/**
 * Builds teacher sitemap entries from `teachersSitemap` browse data,
 * `curriculumPhaseOptions` and each programme's units.
 *
 * ## URL types emitted (SEO sitemap ticket)
 *
 * - **Base programme pages** — `/units` for every subject phase (and KS4 exam
 *   board/pathway slug where applicable), clean URL, no trailing `?`.
 * - **Curriculum explainer** — ONE per subject-phase, on the programme a
 *   board-less URL redirects to (its content is per subject and phase, so the
 *   board variants canonicalise to it). Omitted for non-curriculum subjects.
 * - **Filter variant programme pages** — every indexable combination of
 *   `years`, `keystages`, `tiers`, `child_subjects` and `subject_categories`,
 *   enumerated by `enumerateIndexableProgrammeQueries()` from the programme's
 *   units with the same rule the page applies. Never `threads`.
 * - **Unit and lesson overview pages** — from browse-data unit/lesson slugs.
 */
import type { MetadataRoute } from "next";

import { resolveOakHref } from "@/common-lib/urls";
import {
  type CurriculumPhaseOptions,
  type CurriculumUnitsTabData,
} from "@/node-lib/curriculum-api-2023";
import { TeachersSitemapBrowseData } from "@/node-lib/curriculum-api-2023/queries/teachersSitemap/teacherSitemap.schema";
import {
  filterValidCurriculumPhaseOptions,
  formatCurriculumUnitsData,
} from "@/pages-helpers/curriculum/docx/tab-helpers";
import { mapKs4OptionSlugs } from "@/pages-helpers/teacher/sitemap-pages/groupProgrammeFilterUnits";
import { enumerateIndexableProgrammeQueries } from "@/utils/programme/enumerateIndexableProgrammeQueries";
import { getDefaultKs4SubjectPhaseSlug } from "@/utils/curriculum/slugs";
import { getSubjectPhaseSlug } from "@/components/TeacherComponents/helpers/getSubjectPhaseSlug";

export type ProgrammeUnitsBySlug = Record<string, CurriculumUnitsTabData>;

// SITEMAP_BASE_URL is written to the .env file during next.config.ts execution.
function getSitemapBaseUrl(): string {
  const sitemapBaseUrl = process.env.SITEMAP_BASE_URL;

  if (!sitemapBaseUrl || sitemapBaseUrl === "undefined") {
    throw new TypeError(
      "process.env.SITEMAP_BASE_URL not defined. See code in next.config.ts",
    );
  }

  return sitemapBaseUrl;
}

/** Every programme page slug (`maths-primary`, `science-secondary-aqa` …). */
export function listProgrammePageSlugs(
  subjects: CurriculumPhaseOptions,
): string[] {
  return filterValidCurriculumPhaseOptions(subjects).flatMap((subject) =>
    subject.phases.flatMap((phase) =>
      mapKs4OptionSlugs(subject, phase).map((p) => p.subjectPhaseSlug),
    ),
  );
}

/**
 * The programme whose explainer is the canonical one for a subject-phase:
 * the default KS4 option (the same one a board-less URL redirects to).
 */
function getCanonicalExplainerSlug(
  subjects: CurriculumPhaseOptions,
  subject: CurriculumPhaseOptions[number],
  phase: CurriculumPhaseOptions[number]["phases"][number],
  programmePageSlugs: string[],
): string | undefined {
  const boardless = getSubjectPhaseSlug({
    subject: subject.slug,
    phaseSlug: phase.slug,
  });
  const preferred = getDefaultKs4SubjectPhaseSlug(subjects, boardless);
  if (preferred && programmePageSlugs.includes(preferred)) {
    return preferred;
  }
  return programmePageSlugs.includes(boardless)
    ? boardless
    : programmePageSlugs[0];
}

/**
 * Builds the URLs for the programme pages: the clean `/units` page and its
 * indexable filter variants for every programme, plus one explainer per
 * subject-phase.
 */
function buildProgrammeUrls(
  subjects: CurriculumPhaseOptions,
  programmeUnitsBySlug: ProgrammeUnitsBySlug,
): string[] {
  const baseUrl = getSitemapBaseUrl();
  const href = (
    subjectPhaseSlug: string,
    tab: "units" | "curriculum-explainer",
    query?: Record<string, string>,
  ) =>
    new URL(
      resolveOakHref({
        page: "teacher-programme",
        subjectPhaseSlug,
        tab,
        query: query && Object.keys(query).length > 0 ? query : undefined,
      }),
      baseUrl,
    ).toString();

  return subjects.flatMap((subject) =>
    subject.phases.flatMap((phase) => {
      const programmePageSlugs = mapKs4OptionSlugs(subject, phase).map(
        (p) => p.subjectPhaseSlug,
      );

      const unitUrls = programmePageSlugs.flatMap((subjectPhaseSlug) => {
        const units = programmeUnitsBySlug[subjectPhaseSlug];
        const queries = units
          ? enumerateIndexableProgrammeQueries(formatCurriculumUnitsData(units))
          : [{}];
        // The base page is listed even when its units could not be loaded.
        const withBase = queries.some((q) => Object.keys(q).length === 0)
          ? queries
          : [{}, ...queries];
        return withBase.map((query) =>
          href(subjectPhaseSlug, "units", query as Record<string, string>),
        );
      });

      // If the subject is non-curriculum there is no curriculum explainer
      if (subject.non_curriculum) {
        return unitUrls;
      }

      const explainerSlug = getCanonicalExplainerSlug(
        subjects,
        subject,
        phase,
        programmePageSlugs,
      );
      return explainerSlug
        ? [...unitUrls, href(explainerSlug, "curriculum-explainer")]
        : unitUrls;
    }),
  );
}

function buildAllUrls(
  data: TeachersSitemapBrowseData,
  subjects: CurriculumPhaseOptions,
  programmeUnitsBySlug: ProgrammeUnitsBySlug,
): string[] {
  const { units, lessons } = data;
  const validSubjects = filterValidCurriculumPhaseOptions(subjects);
  const programmeUrls = buildProgrammeUrls(validSubjects, programmeUnitsBySlug);
  const url = new URL(getSitemapBaseUrl());

  // Build the URLs for the unit pages
  const unitUrls = units.map((unit) => {
    url.pathname = resolveOakHref({
      page: "unit-overview",
      programmeSlug: unit.programmeSlug,
      unitSlug: unit.unitSlug,
    });

    return url.toString();
  });

  // Build the URLs for the lesson pages
  const lessonUrls = lessons.map((lesson) => {
    url.pathname = resolveOakHref({
      page: "lesson-overview",
      programmeSlug: lesson.programmeSlug,
      unitSlug: lesson.unitSlug,
      lessonSlug: lesson.lessonSlug,
    });

    return url.toString();
  });

  return [...programmeUrls, ...unitUrls, ...lessonUrls];
}

export function buildTeachersSitemapEntries(
  data: TeachersSitemapBrowseData,
  subjects: CurriculumPhaseOptions,
  programmeUnitsBySlug: ProgrammeUnitsBySlug = {},
): MetadataRoute.Sitemap {
  const allUrls = buildAllUrls(data, subjects, programmeUnitsBySlug);
  const lastModified = new Date();

  return allUrls.map((url) => ({
    url,
    lastModified,
  }));
}
