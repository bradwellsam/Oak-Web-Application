import { OakBox, OakFlex, OakP } from "@oaknational/oak-components";
import { useId } from "react";

import { FilterOptionLink } from "./FilterOptionLink";

import { getFilterData } from "@/utils/curriculum/filtering";
import { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import { useBrowseFilters } from "@/context/BrowseFilters";
import { useKeyStagePresence } from "@/context/BrowseFilters/hooks/useKeyStagePresence";
import { FilterType } from "@/browser-lib/avo/Avo";
import type { BrowseFilters } from "@/context/BrowseFilters/types";

export type BrowseFiltersTiersProps = {
  data: CurriculumUnitsFormattedData;
};

/** Tier filter: every option is a real link to the tier page. */
export function BrowseFiltersTiers({
  data,
}: Readonly<BrowseFiltersTiersProps>) {
  const { filters, onChangeFilters, yearsForKeystage } = useBrowseFilters();
  const id = useId();

  const { tiers } = getFilterData(data.yearData, yearsForKeystage);

  const { tiersAt } = useKeyStagePresence(data);

  if (tiers.length === 0) {
    return null;
  }

  return (
    <OakBox>
      <OakFlex
        role="group"
        aria-labelledby={`tiers-${id}`}
        $flexDirection="row"
        $flexWrap="wrap"
        $gap="spacing-8"
      >
        <OakP
          id={`tiers-${id}`}
          $font="heading-7"
          $mt="spacing-0"
          $mb={["spacing-24", "spacing-16"]}
          $width="100%"
        >
          Learning tier{" "}
          {tiersAt.length === 1 ? `(${tiersAt[0]?.toUpperCase()})` : ""}
        </OakP>
        {tiers.map((tier) => {
          const nextFilters = {
            ...filters,
            tiers: [tier.tier_slug as BrowseFilters["tiers"][number]],
          };
          return (
            <FilterOptionLink
              key={tier.tier_slug}
              nextFilters={nextFilters}
              selected={filters.tiers[0] === tier.tier_slug}
              onSelect={() =>
                onChangeFilters({
                  newFilters: nextFilters,
                  filterType: FilterType.TIER_FILTER,
                  filterValue: tier.tier_slug,
                })
              }
              data-testid="tier-link"
            >
              {tier.tier}
            </FilterOptionLink>
          );
        })}
      </OakFlex>
    </OakBox>
  );
}
