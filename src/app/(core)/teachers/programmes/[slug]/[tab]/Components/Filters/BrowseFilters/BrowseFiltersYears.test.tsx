import { act } from "@testing-library/react";
import { usePathname } from "next/navigation";

import { BrowseFiltersYears } from "./BrowseFiltersYears";

import { basicSetup } from "@/components/CurriculumComponents/CurricVisualiserFilters/CurricFiltersYears.fixtures";
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

describe("BrowseFiltersYears", () => {
  beforeEach(() => {
    jest
      .mocked(usePathname)
      .mockReturnValue("/teachers/programmes/science-secondary-aqa/units");
  });

  it("renders every option as a link to its canonical page, without Core/GCSE duplication", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersYears data={basicSetup} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAccessibleName("All");
    expect(links[1]).toHaveAccessibleName("Year 10");
    expect(links[2]).toHaveAccessibleName("Year 11");
    // A year implies its key stage: `?years=10`, never `?years=10&keystages=ks4`
    expect(links[1]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?years=10",
    );
    expect(links[2]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?years=11",
    );
    expect(links[0]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units",
    );
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("selects on click without navigating", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersYears data={basicSetup} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];

    // 10
    act(() => links[1]!.click());
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(links[0]).not.toHaveAttribute("aria-current");

    // 11
    act(() => links[2]!.click());
    expect(links[2]).toHaveAttribute("aria-current", "page");

    // All
    act(() => links[0]!.click());
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("renders the tablet 'All filters' button when onModalOpen is provided", () => {
    const onModalOpen = jest.fn();
    const { getByTestId } = renderWithStore(
      <BrowseFiltersYears data={basicSetup} onModalOpen={onModalOpen} />,
    );

    act(() => getByTestId("tablet-all-filters").click());
    expect(onModalOpen).toHaveBeenCalled();
  });
});
