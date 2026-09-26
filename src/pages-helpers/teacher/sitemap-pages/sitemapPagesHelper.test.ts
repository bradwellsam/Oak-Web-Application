import { buildTeachersSitemapEntries } from "./sitemapPagesHelper";

import { CurriculumPhaseOptions } from "@/node-lib/curriculum-api-2023";
import { createUnit } from "@/fixtures/curriculum/unit";
import { scienceUnits } from "@/utils/programme/fixtures";
import curriculumPhaseOptionsFixture from "@/node-lib/curriculum-api-2023/fixtures/curriculumPhaseOptions.fixture";
import { teachersSitemapDataFixtureCamelCase } from "@/node-lib/curriculum-api-2023/fixtures/teachersSiteMap.fixture";

const emptySitemapData = {
  units: [],
  lessons: [],
  programmeFilterUnits: [],
};

describe("teacher sitemaps", () => {
  beforeEach(() => {
    process.env.SITEMAP_BASE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    process.env.SITEMAP_BASE_URL = "";
    jest.resetModules();
  });

  describe("buildTeachersSitemapEntries", () => {
    it("returns integrated programme (units and curriculum explainer), unit, and lesson URLs", async () => {
      const entries = buildTeachersSitemapEntries(
        teachersSitemapDataFixtureCamelCase,
        curriculumPhaseOptionsFixture(),
      );
      const allUrls = entries.map((entry) => entry.url);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]).toHaveProperty("url");
      expect(entries[0]).toHaveProperty("lastModified");

      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/english-primary/units",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/english-primary/curriculum-explainer",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/english-secondary-aqa/units",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/english-secondary-aqa/curriculum-explainer",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/english-secondary-edexcel/units",
      );
      // One explainer per subject-phase: the Edexcel one canonicalises to AQA.
      expect(allUrls).not.toContain(
        "http://localhost:3000/teachers/programmes/english-secondary-edexcel/curriculum-explainer",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/geography-secondary/units",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/geography-secondary/curriculum-explainer",
      );
      expect(allUrls).not.toContain(
        "http://localhost:3000/teachers/programmes/programme-1/units",
      );
      expect(allUrls).not.toContain(
        "http://localhost:3000/teachers/programmes/programme-1/curriculum-explainer",
      );

      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/programme-1/units/unit-1/lessons",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/programme-1/units/unit-1/lessons/lesson-1",
      );
      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/programme-2/units/unit-2/lessons/lesson-2",
      );
    });

    it("omits curriculum explainer URLs for non-curriculum subjects", async () => {
      const entries = buildTeachersSitemapEntries(emptySitemapData, [
        {
          title: "Financial education",
          slug: "financial-education",
          phases: [{ title: "Secondary", slug: "secondary" }],
          ks4_options: [],
          keystages: [{ title: "KS3", slug: "ks3" }],
          non_curriculum: true,
        },
      ]);
      const allUrls = entries.map((entry) => entry.url);

      expect(allUrls).toContain(
        "http://localhost:3000/teachers/programmes/financial-education-secondary/units",
      );
      expect(allUrls).not.toContain(
        "http://localhost:3000/teachers/programmes/financial-education-secondary/curriculum-explainer",
      );
    });

    it("lists every indexable filter combination from the programme's units, never threads", () => {
      const subjects: CurriculumPhaseOptions = [
        {
          title: "Science",
          slug: "science",
          phases: [{ title: "Secondary", slug: "secondary" }],
          ks4_options: [{ title: "AQA", slug: "aqa" }],
          keystages: [
            { title: "KS3", slug: "ks3" },
            { title: "KS4", slug: "ks4" },
          ],
        },
      ];
      const entries = buildTeachersSitemapEntries(emptySitemapData, subjects, {
        "science-secondary-aqa": { units: scienceUnits() },
      });
      const allUrls = entries.map((entry) => entry.url);
      const base =
        "http://localhost:3000/teachers/programmes/science-secondary-aqa/units";

      expect(allUrls).toContain(base);
      expect(allUrls).toContain(`${base}?keystages=ks3`);
      expect(allUrls).toContain(`${base}?years=7`);
      expect(allUrls).toContain(`${base}?keystages=ks4&tiers=higher`);
      expect(allUrls).toContain(
        `${base}?keystages=ks4&tiers=higher&child_subjects=biology`,
      );
      expect(allUrls).toContain(`${base}?years=11&child_subjects=physics`);
      // defaults are implicit, a year replaces its key stage, threads never listed
      expect(allUrls).not.toContain(`${base}?keystages=ks4&tiers=foundation`);
      expect(allUrls).not.toContain(`${base}?years=11&keystages=ks4`);
      expect(allUrls.some((url) => url.includes("threads="))).toBe(false);
      expect(allUrls.some((url) => url.endsWith("?"))).toBe(false);
      expect(allUrls).not.toContain(
        "http://localhost:3000/teachers/programmes/science-secondary-aqa/curriculum-explainer?keystages=ks3",
      );
    });

    it("lists only the base page when a programme's units are not available", () => {
      const subjects = curriculumPhaseOptionsFixture().filter(
        (s) => s.slug === "maths",
      );
      const entries = buildTeachersSitemapEntries(emptySitemapData, subjects);
      const mathsUrls = entries
        .map((entry) => entry.url)
        .filter((url) => url.includes("/maths-primary/units"));
      expect(mathsUrls).toEqual([
        "http://localhost:3000/teachers/programmes/maths-primary/units",
      ]);
    });

    it("omits variants when all units collapse to a single year bucket (cross-keystage)", () => {
      const subjects: CurriculumPhaseOptions = [
        {
          title: "Rule of law",
          slug: "rule-of-law",
          phases: [{ title: "Primary", slug: "primary" }],
          ks4_options: [],
          keystages: [{ title: "KS2", slug: "ks2" }],
          non_curriculum: true,
        },
      ];
      const entries = buildTeachersSitemapEntries(emptySitemapData, subjects, {
        "rule-of-law-primary": {
          units: ["3", "4", "5"].map((year, i) =>
            createUnit({
              slug: `rule-of-law-y${year}`,
              year,
              subject_slug: "rule-of-law",
              order: i,
              actions: {
                programme_field_overrides: { year_slug: "all-years" },
              },
            }),
          ),
        },
      });
      const allUrls = entries.map((entry) => entry.url);

      const ruleOfLawProgrammeUrls = allUrls.filter((url) =>
        url.includes("/teachers/programmes/rule-of-law-primary/units"),
      );

      expect(ruleOfLawProgrammeUrls).toEqual([
        "http://localhost:3000/teachers/programmes/rule-of-law-primary/units",
      ]);
    });

    it("uses SITEMAP_BASE_URL", async () => {
      process.env.SITEMAP_BASE_URL = "https://www.thenational.academy";

      const { buildTeachersSitemapEntries } = await import(
        "./sitemapPagesHelper"
      );
      const entries = buildTeachersSitemapEntries(
        teachersSitemapDataFixtureCamelCase,
        curriculumPhaseOptionsFixture(),
      );

      expect(entries[0]?.url).toMatch(/^https:\/\/www\.thenational\.academy\//);
    });

    it("throws when SITEMAP_BASE_URL is not defined", async () => {
      delete process.env.SITEMAP_BASE_URL;

      const { buildTeachersSitemapEntries } = await import(
        "./sitemapPagesHelper"
      );

      expect(() =>
        buildTeachersSitemapEntries(
          teachersSitemapDataFixtureCamelCase,
          curriculumPhaseOptionsFixture(),
        ),
      ).toThrow(
        "process.env.SITEMAP_BASE_URL not defined. See code in next.config.ts",
      );
    });
  });
});
