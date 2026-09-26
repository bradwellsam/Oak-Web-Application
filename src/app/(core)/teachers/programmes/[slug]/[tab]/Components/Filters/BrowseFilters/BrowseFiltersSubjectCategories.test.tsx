import { act } from "@testing-library/react";
import { usePathname } from "next/navigation";

import { BrowseFiltersSubjectCategories } from "./BrowseFiltersSubjectCategories";
import { ks4Setup } from "./BrowseFiltersSubjectCategories.fixtures";

import renderWithProviders from "@/__tests__/__helpers__/renderWithProviders";
import { BrowseFiltersProvider } from "@/context/BrowseFilters";
import { BrowseFilters } from "@/context/BrowseFilters/types";
import { TeacherBrowseAnalyticsStoreProvider } from "@/context/TeacherBrowseAnalytics/TeacherBrowseAnalyticsProvider";

const defaultFilter: BrowseFilters = {
  childSubjects: [],
  subjectCategories: [],
  tiers: [],
  years: ["10", "11"],
  threads: [],
  pathways: [],
  keystages: [],
};

const slugs = {
  subjectSlug: "english" as const,
  phaseSlug: "secondary" as const,
  ks4OptionSlug: null,
};

const renderWithStore = (
  ui: React.ReactElement,
  filter: BrowseFilters = defaultFilter,
) =>
  renderWithProviders()(
    <TeacherBrowseAnalyticsStoreProvider
      programmeState={null}
      accessLevel="programme"
    >
      <BrowseFiltersProvider defaultFilter={filter}>{ui}</BrowseFiltersProvider>
    </TeacherBrowseAnalyticsStoreProvider>,
  );

describe("BrowseFiltersSubjectCategories", () => {
  beforeEach(() => {
    jest
      .mocked(usePathname)
      .mockReturnValue("/teachers/programmes/science-secondary-aqa/units");
  });

  it("renders every category as a link to its canonical page", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersSubjectCategories data={ks4Setup} slugs={slugs} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(3);
    expect(links[0]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?subject_categories=biology",
    );
    expect(links[1]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?subject_categories=chemistry",
    );
    expect(links[2]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?subject_categories=physics",
    );
  });

  it("selects on click without navigating", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersSubjectCategories data={ks4Setup} slugs={slugs} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];

    act(() => links[0]!.click());
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });
});
