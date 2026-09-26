import { OakBox, OakFlex, OakP } from "@oaknational/oak-components";
import { useId } from "react";

import { FilterOptionLink } from "./FilterOptionLink";

import { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import { useBrowseFilters } from "@/context/BrowseFilters";
import { FilterType } from "@/browser-lib/avo/Avo";

export type BrowseFiltersKeystagesProps = {
  data: CurriculumUnitsFormattedData;
};

/**
 * Key stage filter. Every option is a real link to the key-stage page (SEO
 * programme-template ticket, filter UI rule). Choosing a key stage clears
 * the year (rule U2: key stage and year are one control).
 */
export function BrowseFiltersKeystages({
  data,
}: Readonly<BrowseFiltersKeystagesProps>) {
  const { filters, onChangeFilters } = useBrowseFilters();
  const id = useId();

  if (data.keystages.length <= 1) {
    return null;
  }

  const optionFor = (ks: string | null) => ({
    ...filters,
    keystages: ks ? [ks] : [],
    years: data.yearOptions,
  });
  const selectedKeystage = filters.keystages[0] ?? null;

  return (
    <OakBox>
      <OakFlex
        role="group"
        aria-labelledby={`keystages-${id}`}
        $flexDirection="row"
        $flexWrap="wrap"
        $gap="spacing-8"
      >
        <OakP
          id={`keystages-${id}`}
          $font="heading-7"
          $mt="spacing-0"
          $mb={["spacing-24", "spacing-16"]}
          $width="100%"
        >
          Key stages
        </OakP>
        {[null, ...data.keystages.toSorted((a, b) => (a < b ? -1 : 1))].map(
          (ks) => (
            <FilterOptionLink
              key={ks ?? "all"}
              nextFilters={optionFor(ks)}
              selected={selectedKeystage === ks}
              onSelect={() =>
                onChangeFilters({
                  newFilters: optionFor(ks),
                  filterType: FilterType.KEY_STAGE_FILTER,
                  filterValue: ks ?? "all",
                })
              }
              data-testid="keystage-link"
            >
              {ks ? ks.toUpperCase() : "All"}
            </FilterOptionLink>
          ),
        )}
      </OakFlex>
    </OakBox>
  );
}
