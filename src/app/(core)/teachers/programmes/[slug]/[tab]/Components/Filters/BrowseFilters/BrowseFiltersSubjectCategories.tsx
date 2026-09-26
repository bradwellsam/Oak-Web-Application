import { OakBox, OakFlex, OakP } from "@oaknational/oak-components";
import { useId } from "react";

import { FilterOptionLink } from "./FilterOptionLink";

import { getValidSubjectCategoryIconById } from "@/utils/getValidSubjectCategoryIconById";
import { getFilterData } from "@/utils/curriculum/filtering";
import { CurriculumUnitsFormattedData } from "@/pages-helpers/curriculum/docx/tab-helpers";
import { CurriculumSelectionSlugs } from "@/utils/curriculum/slugs";
import { useBrowseFilters } from "@/context/BrowseFilters";
import { useKeyStagePresence } from "@/context/BrowseFilters/hooks/useKeyStagePresence";
import { FilterType } from "@/browser-lib/avo/Avo";

export type BrowseFiltersSubjectCategoriesProps = {
  data: CurriculumUnitsFormattedData;
  slugs: CurriculumSelectionSlugs;
};

/** Category filter: every option is a real link to the category page. */
export function BrowseFiltersSubjectCategories({
  data,
  slugs,
}: Readonly<BrowseFiltersSubjectCategoriesProps>) {
  const { filters, onChangeFilters, yearsForKeystage } = useBrowseFilters();
  const id = useId();

  const { subjectCategories } = getFilterData(data.yearData, yearsForKeystage);

  const { subjectCategoriesAt } = useKeyStagePresence(data);

  if (subjectCategoriesAt.length === 0) {
    return null;
  }

  const selected = String(filters.subjectCategories[0]);

  return (
    <OakBox>
      <OakFlex
        role="group"
        aria-labelledby={`subject-categories-${id}`}
        $flexDirection="row"
        $flexWrap="wrap"
        $gap="spacing-12"
      >
        <OakP
          id={`subject-categories-${id}`}
          $font="heading-7"
          $mt="spacing-0"
          $mb={["spacing-24", "spacing-16"]}
          $width="100%"
        >
          Category
          {subjectCategoriesAt.length === 1
            ? ` (${subjectCategoriesAt[0]?.toUpperCase()})`
            : ""}
        </OakP>
        {subjectCategories.map((subjectCategory) => {
          const slug = String(subjectCategory.slug);
          const nextFilters = { ...filters, subjectCategories: [slug] };
          return (
            <FilterOptionLink
              key={slug}
              nextFilters={nextFilters}
              selected={selected === slug}
              onSelect={() =>
                onChangeFilters({
                  newFilters: nextFilters,
                  filterType: FilterType.SUBJECT_FILTER,
                  filterValue: slug,
                })
              }
              icon={getValidSubjectCategoryIconById(
                slugs.subjectSlug,
                subjectCategory.slug,
              )}
              data-testid={`subject-category-link-${slug}`}
            >
              {subjectCategory.title}
            </FilterOptionLink>
          );
        })}
      </OakFlex>
    </OakBox>
  );
}
