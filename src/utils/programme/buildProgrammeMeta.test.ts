import {
  buildProgrammeMeta,
  sentenceCaseLabel,
  toTitleCase,
} from "./buildProgrammeMeta";
import { canonicaliseProgrammeQuery } from "./canonicalise";
import {
  englishPrimaryData,
  mathsSecondaryData,
  peCoreData,
  scienceData,
} from "./fixtures";

import { getDefaultBrowseFilter } from "@/context/BrowseFilters/utils/getDefaultBrowseFilter";
import type { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";

type Programme = {
  subjectTitle: string;
  phaseSlug: string;
  ks4Option?: { slug: string; title: string } | null;
  data: CurriculumUnitsFormattedData;
};

const science: Programme = {
  subjectTitle: "Science",
  phaseSlug: "secondary",
  ks4Option: { slug: "edexcel", title: "Edexcel" },
  data: scienceData(),
};
const english: Programme = {
  subjectTitle: "English",
  phaseSlug: "primary",
  ks4Option: null,
  data: englishPrimaryData(),
};
const maths: Programme = {
  subjectTitle: "Maths",
  phaseSlug: "secondary",
  ks4Option: null,
  data: mathsSecondaryData(),
};
const pe: Programme = {
  subjectTitle: "Physical education",
  phaseSlug: "secondary",
  ks4Option: { slug: "core", title: "Core" },
  data: peCoreData(),
};

const meta = (
  programme: Programme,
  raw: Record<string, string> = {},
  tab?: "units" | "curriculum-explainer" | "download",
) => {
  const canonical = canonicaliseProgrammeQuery(
    raw,
    programme.data,
    getDefaultBrowseFilter(programme.data),
  );
  if (!canonical.isValid) throw new Error(JSON.stringify(canonical.problems));
  return buildProgrammeMeta({
    ...programme,
    query: canonical.query,
    filters: canonical.filters,
    tab,
  });
};

describe("buildProgrammeMeta", () => {
  // The examples agreed in the filter-spec decisions log (D2–D5).
  it.each([
    [
      science,
      {},
      "Edexcel secondary science",
      "Free Edexcel Secondary Science Lesson Resources",
    ],
    [
      science,
      { keystages: "ks3" },
      "Edexcel KS3 science",
      "Free Edexcel KS3 Science Lesson Resources",
    ],
    [
      science,
      { years: "8" },
      "Edexcel Year 8 science",
      "Free Edexcel Year 8 Science Lesson Resources",
    ],
    [
      science,
      { keystages: "ks4" },
      "Edexcel KS4 GCSE combined science",
      "Free Edexcel KS4 GCSE Combined Science Lesson Resources",
    ],
    [
      science,
      { years: "11", tiers: "higher", child_subjects: "biology" },
      "Edexcel Year 11 GCSE science: biology (higher tier)",
      "Free Edexcel Year 11 GCSE Science: Biology (Higher Tier) Lesson Resources",
    ],
    [english, {}, "Primary English", "Free Primary English Lesson Resources"],
    [
      english,
      { keystages: "ks2", subject_categories: "spelling" },
      "KS2 English: spelling",
      "Free KS2 English: Spelling Lesson Resources",
    ],
    [
      english,
      { years: "3", subject_categories: "spelling" },
      "Year 3 English: spelling",
      "Free Year 3 English: Spelling Lesson Resources",
    ],
    [
      maths,
      { years: "11", tiers: "higher" },
      "Year 11 GCSE maths (higher tier)",
      "Free Year 11 GCSE Maths (Higher Tier) Lesson Resources",
    ],
    [
      maths,
      { years: "11" },
      "Year 11 GCSE maths",
      "Free Year 11 GCSE Maths Lesson Resources",
    ],
    [
      pe,
      { keystages: "ks4" },
      "KS4 physical education (core)",
      "Free KS4 Physical Education (Core) Lesson Resources",
    ],
    [
      pe,
      {},
      "Secondary physical education (core)",
      "Free Secondary Physical Education (Core) Lesson Resources",
    ],
  ])("%#: %s", (programme, raw, h1, title) => {
    const out = meta(programme as Programme, raw as Record<string, string>);
    expect(out.h1).toBe(h1);
    expect(out.title).toBe(title);
  });

  it("uses the shared subject override only when every unit in scope carries one", () => {
    // KS4 with the default child subject: all units in scope are combined science
    expect(meta(science, { keystages: "ks4" }).parts.topic).toBe(
      "combined science",
    );
    // The whole programme: KS3 units have no override
    expect(meta(science, {}).parts.topic).toBe("science");
  });

  it("does not name a default value (rule U8)", () => {
    expect(meta(english, { keystages: "ks2" }).h1).toBe("KS2 English");
    expect(meta(science, { keystages: "ks4", tiers: "foundation" }).h1).toBe(
      "Edexcel KS4 GCSE combined science",
    );
  });

  it("threads change nothing (T7)", () => {
    expect(meta(maths, { keystages: "ks3", threads: "algebra" }).h1).toBe(
      meta(maths, { keystages: "ks3" }).h1,
    );
    expect(meta(maths, { keystages: "ks3", threads: "algebra" }).title).toBe(
      meta(maths, { keystages: "ks3" }).title,
    );
  });

  it("builds the meta description from the same phrase", () => {
    expect(meta(maths, { keystages: "ks3" }).description).toBe(
      "Free KS3 maths lesson resources. Fully sequenced units and lesson plans from Oak National Academy.",
    );
  });

  it("gives the explainer its own title and H1, per subject-phase", () => {
    const out = meta(science, { keystages: "ks3" }, "curriculum-explainer");
    expect(out.h1).toBe("Edexcel secondary science curriculum explained");
    expect(out.title).toBe(
      "Free Edexcel Secondary Science Curriculum Explainer",
    );
  });

  it("gives the download tab a distinct title", () => {
    expect(meta(maths, {}, "download").title).toBe(
      "Download the secondary maths Curriculum",
    );
  });
});

describe("casing helpers", () => {
  it("sentenceCaseLabel keeps proper nouns and acronyms", () => {
    expect(sentenceCaseLabel("Physical education")).toBe("physical education");
    expect(sentenceCaseLabel("English")).toBe("English");
    expect(sentenceCaseLabel("RSHE (PSHE)")).toBe("RSHE (PSHE)");
    expect(sentenceCaseLabel("Reading, writing & oracy")).toBe(
      "reading, writing & oracy",
    );
  });

  it("toTitleCase capitalises words except small ones", () => {
    expect(toTitleCase("KS3 art and design")).toBe("KS3 Art and Design");
    expect(
      toTitleCase(
        "Edexcel Year 11 GCSE combined science: biology (higher tier)",
      ),
    ).toBe("Edexcel Year 11 GCSE Combined Science: Biology (Higher Tier)");
  });
});
