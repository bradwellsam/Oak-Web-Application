import { act } from "@testing-library/react";
import { usePathname } from "next/navigation";

import { BrowseFiltersChildSubjects } from "./BrowseFiltersChildSubjects";

import { ks4Setup } from "@/components/CurriculumComponents/CurricVisualiserFilters/CurricFiltersChildSubjects.fixtures";
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

describe("BrowseFiltersChildSubjects", () => {
  beforeEach(() => {
    jest
      .mocked(usePathname)
      .mockReturnValue("/teachers/programmes/science-secondary-aqa/units");
  });

  it("renders every exam subject as a link to its canonical page", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersChildSubjects data={ks4Setup} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(3);
    expect(links[0]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?child_subjects=biology",
    );
    expect(links[1]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?child_subjects=chemistry",
    );
    expect(links[2]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?child_subjects=physics",
    );
  });

  it("selects on click without navigating", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersChildSubjects data={ks4Setup} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];

    act(() => links[1]!.click());
    expect(links[1]).toHaveAttribute("aria-current", "page");
  });
});
