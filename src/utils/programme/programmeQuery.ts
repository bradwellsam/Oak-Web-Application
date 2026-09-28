/**
 * The query-string vocabulary of the programme `/units` page.
 *
 * Dependency-free on purpose: this file is imported by the server (canonical,
 * robots, sitemap), by the client filter store (address bar, link hrefs) and by
 * tests, so the site can only ever emit one spelling of a filter URL.
 *
 * Rules (SEO programme-template ticket, rule U1/U2):
 *   - known parameters are written in `PROGRAMME_FILTER_PARAMS` order;
 *   - a year replaces its key stage (`?years=8`, never `?years=8&keystages=ks3`);
 *   - anything else (tracking parameters, junk, and the pre-2026 parameter
 *     names `learning-theme`, `category`, `year`) is not a filter: it is
 *     ignored, never written, never in the canonical. Old names only mean
 *     something on old slugs, where the legacy redirect maps them (U10).
 */
import type { BrowseFilters } from "@/context/BrowseFilters/types";
import type { KeyStageSlug } from "@/utils/curriculum/types";
import { keystageYearMappings } from "@/utils/curriculum/keystage";

export const PROGRAMME_FILTER_PARAMS = [
  "years",
  "keystages",
  "tiers",
  "child_subjects",
  "subject_categories",
  "threads",
] as const;

export type ProgrammeFilterParam = (typeof PROGRAMME_FILTER_PARAMS)[number];

/** A normalised programme query: at most one value per known parameter. */
export type ProgrammeQuery = Partial<Record<ProgrammeFilterParam, string>>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const isProgrammeFilterParam = (
  key: string,
): key is ProgrammeFilterParam =>
  (PROGRAMME_FILTER_PARAMS as readonly string[]).includes(key);

export type ReadProgrammeQueryResult = {
  /** First value of each known parameter. */
  query: ProgrammeQuery;
  /** Known parameters that arrived with more than one value (`a,b` or `?x=1&x=2`). */
  multiValued: ProgrammeFilterParam[];
  /** Everything that is not a filter (tracking, junk), left untouched. */
  unknown: Record<string, string | string[]>;
};

/**
 * Reads the filter parameters out of a raw query object. Unknown keys are
 * separated out rather than dropped so callers can decide what to do with
 * them (the canonical ignores them; a redirect keeps them for attribution).
 */
export function readProgrammeQuery(
  raw: RawSearchParams | undefined,
): ReadProgrammeQueryResult {
  const query: ProgrammeQuery = {};
  const multiValued: ProgrammeFilterParam[] = [];
  const unknown: Record<string, string | string[]> = {};

  for (const [rawKey, rawValue] of Object.entries(raw ?? {})) {
    if (rawValue === undefined) {
      continue;
    }
    if (!isProgrammeFilterParam(rawKey)) {
      unknown[rawKey] = rawValue;
      continue;
    }
    const key = rawKey;

    const values = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean);

    if (values.length === 0) {
      continue;
    }
    if (values.length > 1) {
      multiValued.push(key);
    }
    query[key] = values[0];
  }

  return { query, multiValued, unknown };
}

export function keystageForYear(year: string): KeyStageSlug | undefined {
  for (const [keystage, years] of Object.entries(keystageYearMappings)) {
    if (years.includes(year)) {
      return keystage as KeyStageSlug;
    }
  }
  return undefined;
}

/**
 * Puts a query into canonical order and removes a key stage that is implied
 * by the year. Does not validate values – see `canonicaliseProgrammeQuery`.
 */
export function orderProgrammeQuery(query: ProgrammeQuery): ProgrammeQuery {
  const out: ProgrammeQuery = {};
  for (const key of PROGRAMME_FILTER_PARAMS) {
    const value = query[key];
    if (value) {
      out[key] = value;
    }
  }
  if (
    out.years &&
    out.keystages &&
    keystageForYear(out.years) === out.keystages
  ) {
    delete out.keystages;
  }
  return out;
}

/** `years=8&tiers=higher` (no leading `?`), or `""`. */
export function programmeQueryToString(query: ProgrammeQuery): string {
  const params = new URLSearchParams();
  for (const key of PROGRAMME_FILTER_PARAMS) {
    const value = query[key];
    if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

export const filterKeyToParam: Record<keyof BrowseFilters, string> = {
  childSubjects: "child_subjects",
  subjectCategories: "subject_categories",
  tiers: "tiers",
  years: "years",
  threads: "threads",
  pathways: "pathways",
  keystages: "keystages",
};

/**
 * The query the client writes for a filter state: values equal to the
 * programme default are omitted (a default is implicit), a year implies its
 * key stage, keys are in canonical order. `pathways` is UI-only state and is
 * never written.
 */
export function programmeQueryFromFilters(
  filters: BrowseFilters,
  defaultFilter: BrowseFilters,
): ProgrammeQuery {
  const query: ProgrammeQuery = {};
  const same = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const single = (key: keyof BrowseFilters): string | undefined => {
    const value = filters[key];
    if (value.length === 0 || same(value, defaultFilter[key])) {
      return undefined;
    }
    return value.join(",");
  };

  const years = single("years");
  if (years) query.years = years;
  const keystages = single("keystages");
  if (keystages) query.keystages = keystages;
  const tiers = single("tiers");
  if (tiers) query.tiers = tiers;
  const childSubjects = single("childSubjects");
  if (childSubjects) query.child_subjects = childSubjects;
  const subjectCategories = single("subjectCategories");
  if (subjectCategories) query.subject_categories = subjectCategories;
  const threads = single("threads");
  if (threads) query.threads = threads;

  return orderProgrammeQuery(query);
}
