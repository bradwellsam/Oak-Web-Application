import {
  OakBox,
  OakFlex,
  OakTertiaryButton,
  OakP,
} from "@oaknational/oak-components";
import { useId } from "react";

import {
  FilterOptionLink,
  type FilterOptionColorScheme,
} from "./FilterOptionLink";

import { getYearGroupTitle } from "@/utils/curriculum/formatting";
import type { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import { getKeystageSlug } from "@/fixtures/curriculum/unit";
import { useBrowseFilters } from "@/context/BrowseFilters";
import { FilterType } from "@/browser-lib/avo/Avo";

export type BrowseFiltersYearsProps = {
  data: CurriculumUnitsFormattedData;
  onModalOpen?: () => void;
};

export const getColorSchemeByYear = (year: string): FilterOptionColorScheme => {
  switch (year) {
    case "1":
    case "7":
      return "decorative3";
    case "3":
    case "9":
      return "decorative2";
    case "4":
    case "10":
      return "decorative4";
    case "5":
    case "11":
      return "decorative5";
    case "6":
      return "decorative6";
    default:
      // year 2, 8 and 'all years'
      return "decorative1";
  }
};

/**
 * Year group filter. Every option is a real link to the year page (SEO
 * programme-template ticket, filter UI rule); a year also selects its key
 * stage so the two controls behave as one (rule U2).
 */
export function BrowseFiltersYears(props: Readonly<BrowseFiltersYearsProps>) {
  const { data, onModalOpen } = props;
  const { filters, onChangeFilters } = useBrowseFilters();
  const id = useId();
  const { yearData } = data;

  const ksFilter = filters.keystages[0];
  const yearOptions = data.yearOptions.filter((year) => {
    const ksForYear = getKeystageSlug(year);
    return ksFilter ? ksForYear === ksFilter : true;
  });

  const allSelected = filters.years.length > 1;
  const allYearsFilters = { ...filters, years: data.yearOptions };

  return (
    <OakBox>
      <OakFlex
        role="group"
        aria-labelledby={`years-${id}`}
        $gap="spacing-12"
        $flexDirection="row"
        $flexWrap="wrap"
        $alignItems="center"
        data-testid="year-group-filter-desktop"
      >
        <OakP
          id={`years-${id}`}
          $font="heading-7"
          $mb="spacing-16"
          $width="100%"
        >
          Year group
        </OakP>
        <FilterOptionLink
          nextFilters={allYearsFilters}
          selected={allSelected}
          onSelect={() =>
            onChangeFilters({
              newFilters: allYearsFilters,
              filterType: FilterType.YEAR_FILTER,
              filterValue: "all",
            })
          }
          data-testid="all-years-link"
        >
          All
        </FilterOptionLink>
        {yearOptions.map((year) => {
          const nextFilters = {
            ...filters,
            years: [year],
            keystages: [getKeystageSlug(year)],
          };
          return (
            <FilterOptionLink
              key={year}
              nextFilters={nextFilters}
              selected={!allSelected && filters.years[0] === year}
              onSelect={() =>
                onChangeFilters({
                  newFilters: nextFilters,
                  filterType: FilterType.YEAR_FILTER,
                  filterValue: year,
                })
              }
              colorScheme={getColorSchemeByYear(year)}
              data-testid="year-link"
            >
              {getYearGroupTitle(yearData, year)}
            </FilterOptionLink>
          );
        })}
        {/* Tablet view only */}
        {onModalOpen && (
          <OakBox $display={["none", "block", "none"]}>
            <OakTertiaryButton
              isTrailingIcon
              iconName="filter"
              onClick={onModalOpen}
              data-testid="tablet-all-filters"
            >
              All filters
            </OakTertiaryButton>
          </OakBox>
        )}
      </OakFlex>
    </OakBox>
  );
}
