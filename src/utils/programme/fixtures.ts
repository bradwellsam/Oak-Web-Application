/**
 * Programme fixtures for the SEO programme-template rules. Each mirrors the
 * shape of a live programme closely enough for the filter helpers
 * (`formatCurriculumUnitsData`, `shouldDisplayFilter`, `getFilterData`).
 */
import { createUnit } from "@/fixtures/curriculum/unit";
import { formatCurriculumUnitsData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import type { Unit } from "@/utils/curriculum/types";

const thread = (slug: string, order: number) => ({
  slug,
  title: slug.replace(/-/g, " "),
  order,
});

/** Science secondary (Edexcel): KS3 plain, KS4 child subjects × tiers. */
export function scienceUnits(): Unit[] {
  const units: Unit[] = [];
  let order = 0;
  for (const year of ["7", "8", "9"]) {
    for (const t of ["cells", "forces"]) {
      units.push(
        createUnit({
          slug: `${t}-y${year}`,
          year,
          subject: "Science",
          subject_slug: "science",
          order: order++,
          threads: [thread(`bq-${t}`, t === "cells" ? 1 : 2)],
        }),
      );
    }
  }
  const childSubjects = [
    ["combined-science", "Combined science"],
    ["biology", "Biology"],
    ["chemistry", "Chemistry"],
    ["physics", "Physics"],
  ] as const;
  for (const year of ["10", "11"]) {
    for (const [slug, title] of childSubjects) {
      for (const tier of ["foundation", "higher"]) {
        units.push(
          createUnit({
            slug: `${slug}-${tier}-y${year}`,
            year,
            subject: title,
            subject_slug: slug,
            subject_parent: "Science",
            subject_parent_slug: "science",
            tier: tier === "higher" ? "Higher" : "Foundation",
            tier_slug: tier,
            order: order++,
            threads: [thread(slug === "physics" ? "bq-forces" : "bq-cells", 1)],
            actions:
              slug === "combined-science"
                ? { programme_field_overrides: { subject: "Combined science" } }
                : {},
          }),
        );
      }
    }
  }
  return units;
}

/**
 * English primary: subject categories at every year; reading-writing-oracy is
 * the default and the "All" pseudo-category is disabled (as on the live
 * programme). Pass `allEnabled` to get the "All" option instead.
 */
export function englishPrimaryUnits(allEnabled = false): Unit[] {
  const categories = [
    { id: 1, slug: "reading-writing-oracy", title: "Reading, writing & oracy" },
    { id: 2, slug: "grammar", title: "Grammar" },
    { id: 3, slug: "spelling", title: "Spelling" },
    { id: 4, slug: "handwriting", title: "Handwriting" },
  ];
  const units: Unit[] = [];
  let order = 0;
  for (const year of ["1", "2", "3", "4", "5", "6"]) {
    for (const category of categories) {
      // Handwriting only exists at KS1.
      if (category.slug === "handwriting" && Number(year) > 2) continue;
      units.push(
        createUnit({
          slug: `${category.slug}-y${year}`,
          year,
          subject: "English",
          subject_slug: "english",
          subjectcategories: [category],
          order: order++,
          threads: [
            thread(
              category.slug === "spelling"
                ? "spelling-patterns"
                : "appreciation-of-poetry",
              1,
            ),
          ],
          features: {
            subjectcategories: { default_category_id: 1 },
            subject_category_actions: { default_category_id: 1 },
          },
          actions: allEnabled
            ? {}
            : {
                subject_category_actions: {
                  all_disabled: true,
                  default_category_id: 1,
                },
              },
        }),
      );
    }
  }
  return units;
}

/** Maths secondary: no KS4 option, tiers at KS4 only. */
export function mathsSecondaryUnits(): Unit[] {
  const units: Unit[] = [];
  let order = 0;
  for (const year of ["7", "8", "9"]) {
    units.push(
      createUnit({
        slug: `algebra-y${year}`,
        year,
        subject: "Maths",
        subject_slug: "maths",
        order: order++,
        threads: [thread("algebra", 1)],
      }),
    );
  }
  for (const year of ["10", "11"]) {
    for (const tier of ["foundation", "higher"]) {
      units.push(
        createUnit({
          slug: `algebra-${tier}-y${year}`,
          year,
          subject: "Maths",
          subject_slug: "maths",
          tier: tier === "higher" ? "Higher" : "Foundation",
          tier_slug: tier,
          order: order++,
          threads: [thread("algebra", 1)],
        }),
      );
    }
  }
  return units;
}

/** PE secondary (core pathway): no tiers, no child subjects. */
export function peCoreUnits(): Unit[] {
  return ["7", "8", "9", "10", "11"].map((year, i) =>
    createUnit({
      slug: `games-y${year}`,
      year,
      subject: "Physical education",
      subject_slug: "physical-education",
      order: i,
      threads: [thread("games", 1)],
    }),
  );
}

export const scienceData = () =>
  formatCurriculumUnitsData({ units: scienceUnits() });
export const englishPrimaryData = (allEnabled = false) =>
  formatCurriculumUnitsData({ units: englishPrimaryUnits(allEnabled) });
export const mathsSecondaryData = () =>
  formatCurriculumUnitsData({ units: mathsSecondaryUnits() });
export const peCoreData = () =>
  formatCurriculumUnitsData({ units: peCoreUnits() });
