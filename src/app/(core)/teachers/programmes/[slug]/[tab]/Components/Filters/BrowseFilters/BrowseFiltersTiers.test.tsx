import { act } from "@testing-library/react";
import { usePathname } from "next/navigation";

import { BrowseFiltersTiers } from "./BrowseFiltersTiers";
import { ks4Setup } from "./BrowseFiltersTiers.fixtures";

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

describe("BrowseFiltersTiers", () => {
  beforeEach(() => {
    jest
      .mocked(usePathname)
      .mockReturnValue("/teachers/programmes/science-secondary-aqa/units");
  });

  it("renders every tier as a link to its canonical page", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersTiers data={ks4Setup} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];
    expect(links).toHaveLength(2);
    expect(links[0]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?tiers=foundation",
    );
    expect(links[1]!.getAttribute("href")).toBe(
      "/teachers/programmes/science-secondary-aqa/units?tiers=higher",
    );
  });

  it("selects on click without navigating", () => {
    const { getAllByRole } = renderWithStore(
      <BrowseFiltersTiers data={ks4Setup} />,
    );

    const links = getAllByRole("link") as HTMLAnchorElement[];

    act(() => links[0]!.click());
    expect(links[0]).toHaveAttribute("aria-current", "page");

    act(() => links[1]!.click());
    expect(links[1]).toHaveAttribute("aria-current", "page");
    expect(links[0]).not.toHaveAttribute("aria-current");
  });
});
