import { OakBox, OakFlex, OakP } from "@oaknational/oak-components";
import { useId } from "react";

import { FilterOptionLink } from "./FilterOptionLink";

import { Unit } from "@/utils/curriculum/types";
import { getValidSubjectIconName } from "@/utils/getValidSubjectIconName";
import { getFilterData } from "@/utils/curriculum/filtering";
import { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import { useBrowseFilters } from "@/context/BrowseFilters";
import { useKeyStagePresence } from "@/context/BrowseFilters/hooks/useKeyStagePresence";
import { FilterType } from "@/browser-lib/avo/Avo";
import type { BrowseFilters } from "@/context/BrowseFilters/types";

export type BrowseFiltersChildSubjectsProps = {
  data: CurriculumUnitsFormattedData<Unit>;
};

/** Exam subject filter: every option is a real link to the child-subject page. */
export function BrowseFiltersChildSubjects({
  data,
}: Readonly<BrowseFiltersChildSubjectsProps>) {
  const { filters, onChangeFilters, yearsForKeystage } = useBrowseFilters();
  const id = useId();

  const { childSubjects } = getFilterData(data.yearData, yearsForKeystage);

  const { childSubjectsAt } = useKeyStagePresence(data);

  if (childSubjects.length === 0) {
    return <OakBox />;
  }

  return (
    <OakBox>
      <OakFlex
        role="group"
        aria-labelledby={`childSubjects-${id}`}
        $flexDirection="row"
        $flexWrap="wrap"
        $gap="spacing-8"
      >
        <OakP
          id={`childSubjects-${id}`}
          $font="heading-7"
          $mt="spacing-0"
          $mb={["spacing-24", "spacing-16"]}
          $width="100%"
        >
          Exam subject
          {childSubjectsAt.length === 1
            ? ` (${childSubjectsAt[0]?.toUpperCase()})`
            : ""}
        </OakP>
        {childSubjects.map((childSubject) => {
          const nextFilters = {
            ...filters,
            childSubjects: [
              childSubject.subject_slug as BrowseFilters["childSubjects"][number],
            ],
          };
          return (
            <FilterOptionLink
              key={childSubject.subject_slug}
              nextFilters={nextFilters}
              selected={filters.childSubjects[0] === childSubject.subject_slug}
              onSelect={() =>
                onChangeFilters({
                  newFilters: nextFilters,
                  filterType: FilterType.SUBJECT_FILTER,
                  filterValue: childSubject.subject_slug,
                })
              }
              icon={getValidSubjectIconName(childSubject.subject_slug)}
              data-testid="child-subject-link"
            >
              {childSubject.subject}
            </FilterOptionLink>
          );
        })}
      </OakFlex>
    </OakBox>
  );
}
