/**
 * One builder for the programme page's H1, `<title>` and meta description.
 *
 * SEO programme-template ticket, rules T1–T7 (filter-spec decisions D2–D5):
 *
 *   T1  six parts, always this order, empty parts skipped:
 *       [Exam board] [Stage] [GCSE] [Topic] [(tier)] [(core)]
 *   T2  Exam board = the programme's board, at every stage.
 *       Stage = `Year 8` / `KS3` / the phase (`secondary`, `primary`).
 *   T3  GCSE whenever the stage is KS4, Year 10 or Year 11, except on
 *       `core`-pathway programmes, which get `(core)` last instead.
 *   T4  Topic = the subject (the units' shared override, e.g. "combined
 *       science", when the units in scope carry one), then `: child subject`
 *       or `: category` when one is selected in the URL. A value equal to the
 *       programme default is implicit and is not named (rule U8).
 *   T5  Tier = `(higher tier)` / `(foundation tier)` when selected.
 *   T6  H1 = parts joined with spaces, sentence case (proper nouns keep their
 *       capitals). Title = `Free ` + Title Case + ` Lesson Resources`; the
 *       ` | Oak National Academy` suffix comes from the root layout template.
 *   T7  Threads change nothing.
 *
 * Both the server (`generateMetadata`) and the client (`ProgrammeView`) call
 * this with the same inputs, so the title and H1 can never drift.
 */
import type { ProgrammeQuery } from "./programmeQuery";

import type { BrowseFilters } from "@/context/BrowseFilters/types";
import type { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import {
  filteringFromYears,
  scopeYearsToKeystageFilter,
} from "@/utils/curriculum/filtering";
import { isVisibleUnit } from "@/utils/curriculum/isVisibleUnit";
import { isExamboardSlug } from "@/pages-helpers/pupil/options-pages/options-pages-helpers";

export type ProgrammeTab = "units" | "curriculum-explainer" | "download";

export type ProgrammeMetaParts = {
  board: string;
  stage: string;
  gcse: string;
  topic: string;
  tier: string;
  core: string;
};

export type ProgrammeMeta = {
  h1: string;
  title: string;
  description: string;
  parts: ProgrammeMetaParts;
};

export type BuildProgrammeMetaArgs = {
  /** The programme subject title, e.g. `Science`. */
  subjectTitle: string;
  phaseSlug: string;
  /** The programme's KS4 option (exam board or pathway), if it has one. */
  ks4Option?: { slug: string; title: string } | null;
  data: CurriculumUnitsFormattedData;
  /** Normalised query (see `canonicaliseProgrammeQuery`). */
  query: ProgrammeQuery;
  /** Resolved filter state for the query (defaults applied). */
  filters: BrowseFilters;
  tab?: ProgrammeTab;
};

/** Words that keep their capitals inside an otherwise sentence-case string. */
const PROPER_NOUNS = new Set([
  "english",
  "french",
  "german",
  "spanish",
  "latin",
  "mandarin",
  "british",
  "shakespeare",
]);

const TITLE_CASE_SMALL_WORDS = new Set([
  "and",
  "of",
  "the",
  "in",
  "for",
  "a",
  "an",
  "to",
  "&",
]);

/** Lower-cases a subject/category label except proper nouns and acronyms. */
export function sentenceCaseLabel(label: string): string {
  return label
    .split(" ")
    .map((word) => {
      const bare = word.replace(/[^a-zA-Z]/g, "");
      const isAcronym = bare.length > 1 && bare === bare.toUpperCase();
      if (isAcronym || PROPER_NOUNS.has(bare.toLowerCase())) {
        return word;
      }
      return word.toLowerCase();
    })
    .join(" ");
}

export function toTitleCase(sentence: string): string {
  return sentence
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_CASE_SMALL_WORDS.has(lower)) {
        return lower;
      }
      // Capitalise the first letter, also after an opening bracket: "(Higher".
      return word.replace(
        /^(\(?)([a-z])/,
        (_m, open, ch) => open + ch.toUpperCase(),
      );
    })
    .join(" ");
}

const upperFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function getScopedYears(
  data: CurriculumUnitsFormattedData,
  filters: BrowseFilters,
) {
  const scoped = scopeYearsToKeystageFilter(filters);
  return scoped.length > 0 ? scoped : data.yearOptions;
}

/**
 * The subject to print: a `group_units_as` title shared by every year in
 * scope (PE swimming), else the `programme_field_overrides.subject` carried
 * by EVERY unit the page shows ("Combined science" on the KS4 science page),
 * else the programme subject (T4).
 */
function resolveSubjectLabel(
  subjectTitle: string,
  data: CurriculumUnitsFormattedData,
  filters: BrowseFilters,
): string {
  const years = getScopedYears(data, filters);

  const groupAs = years.map((year) => data.yearData[year]?.groupAs ?? null);
  if (
    groupAs.length > 0 &&
    groupAs[0] &&
    groupAs.every((value) => value === groupAs[0])
  ) {
    return groupAs[0];
  }

  const overrides = new Set<string | undefined>();
  for (const year of years) {
    const yearData = data.yearData[year];
    if (!yearData) continue;
    const yearFilters = filteringFromYears(yearData, {
      ...filters,
      years,
    });
    for (const unit of yearData.units) {
      if (isVisibleUnit(yearFilters, year, unit)) {
        overrides.add(unit.actions?.programme_field_overrides?.subject);
      }
    }
  }
  const [shared] = [...overrides];
  if (overrides.size === 1 && shared) {
    return shared;
  }

  return subjectTitle;
}

function findChildSubjectTitle(
  data: CurriculumUnitsFormattedData,
  slug: string,
): string | undefined {
  for (const yearData of Object.values(data.yearData)) {
    const match = yearData.childSubjects.find((c) => c.subject_slug === slug);
    if (match) return match.subject;
  }
  return undefined;
}

function findSubjectCategoryTitle(
  data: CurriculumUnitsFormattedData,
  slug: string,
): string | undefined {
  for (const yearData of Object.values(data.yearData)) {
    const match = yearData.subjectCategories.find(
      (c) => String(c.slug) === slug,
    );
    if (match) return match.title;
  }
  return undefined;
}

export function buildProgrammeMetaParts({
  subjectTitle,
  phaseSlug,
  ks4Option,
  data,
  query,
  filters,
}: Omit<BuildProgrammeMetaArgs, "tab">): ProgrammeMetaParts {
  const isCore = ks4Option?.slug === "core";
  const board =
    ks4Option && isExamboardSlug(ks4Option.slug) ? ks4Option.title : "";

  const stage = query.years
    ? `Year ${query.years}`
    : query.keystages
      ? query.keystages.toUpperCase()
      : phaseSlug;

  const isKs4Stage =
    query.keystages === "ks4" || query.years === "10" || query.years === "11";
  const gcse = isKs4Stage && !isCore ? "GCSE" : "";

  const subject = sentenceCaseLabel(
    resolveSubjectLabel(subjectTitle, data, filters),
  );
  const sub = query.child_subjects
    ? findChildSubjectTitle(data, query.child_subjects)
    : query.subject_categories
      ? findSubjectCategoryTitle(data, query.subject_categories)
      : undefined;
  const topic = sub ? `${subject}: ${sentenceCaseLabel(sub)}` : subject;

  const tier = query.tiers ? `(${query.tiers} tier)` : "";
  const core = isCore ? "(core)" : "";

  return { board, stage, gcse, topic, tier, core };
}

export function joinProgrammeMetaParts(parts: ProgrammeMetaParts): string {
  return [
    parts.board,
    parts.stage,
    parts.gcse,
    parts.topic,
    parts.tier,
    parts.core,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildProgrammeMeta(
  args: BuildProgrammeMetaArgs,
): ProgrammeMeta {
  const parts = buildProgrammeMetaParts(args);
  const phrase = joinProgrammeMetaParts(parts);
  const tab = args.tab ?? "units";

  if (tab === "curriculum-explainer") {
    // The explainer is one page per subject-phase (rule: explainer tab). Its
    // title owns the "curriculum" terms the units page no longer uses (D3).
    const explainerPhrase = joinProgrammeMetaParts({
      ...parts,
      stage: args.phaseSlug,
      gcse: "",
      tier: "",
    });
    return {
      parts,
      h1: upperFirst(`${explainerPhrase} curriculum explained`),
      title: `Free ${toTitleCase(explainerPhrase)} Curriculum Explainer`,
      description: `How the ${explainerPhrase} curriculum is organised: threads, sequencing and the thinking behind Oak National Academy's units.`,
    };
  }

  if (tab === "download") {
    return {
      parts,
      h1: upperFirst(phrase),
      title: `Download the ${phrase} Curriculum`,
      description: `Download the ${phrase} unit sequence and curriculum documents from Oak National Academy.`,
    };
  }

  return {
    parts,
    h1: upperFirst(phrase),
    title: `Free ${toTitleCase(phrase)} Lesson Resources`,
    description: `Free ${phrase} lesson resources. Fully sequenced units and lesson plans from Oak National Academy.`,
  };
}
