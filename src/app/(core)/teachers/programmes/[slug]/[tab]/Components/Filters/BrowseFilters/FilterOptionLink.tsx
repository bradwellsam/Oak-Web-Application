"use client";

import {
  OakFlex,
  OakIcon,
  OakP,
  type OakIconName,
} from "@oaknational/oak-components";
import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";

import type { BrowseFilters } from "@/context/BrowseFilters/types";
import { useBrowseFiltersStore } from "@/context/BrowseFilters";
import {
  programmeQueryFromFilters,
  programmeQueryToString,
} from "@/utils/programme/programmeQuery";

/**
 * A filter option rendered as a real link (SEO programme-template ticket,
 * filter UI rule): the `href` is the canonical URL of the page the option
 * leads to, so crawlers discover every indexable filter page from the
 * programme page itself. A click is intercepted and handled by the filter
 * store exactly as the former radio did (no navigation, address bar updated
 * by the store), so the teacher's experience is unchanged.
 */

export type FilterOptionColorScheme =
  | "decorative1"
  | "decorative2"
  | "decorative3"
  | "decorative4"
  | "decorative5"
  | "decorative6"
  | "neutral";

export type FilterOptionLinkProps = {
  /** The filter state this option leads to. */
  nextFilters: BrowseFilters;
  selected: boolean;
  onSelect: () => void;
  colorScheme?: FilterOptionColorScheme;
  icon?: OakIconName;
  children: ReactNode;
  "data-testid"?: string;
};

/**
 * The canonical href for a filter state: the programme page path plus the
 * normalised query (defaults implicit, canonical order, year implies key stage).
 */
export function useFilterOptionHref(nextFilters: BrowseFilters): string {
  const pathname = usePathname() ?? "";
  const defaultFilter = useBrowseFiltersStore((store) => store.defaultFilter);
  const query = programmeQueryToString(
    programmeQueryFromFilters(nextFilters, defaultFilter),
  );
  return query ? `${pathname}?${query}` : pathname;
}

export function FilterOptionLink({
  nextFilters,
  selected,
  onSelect,
  colorScheme = "neutral",
  icon,
  children,
  "data-testid": testId,
}: Readonly<FilterOptionLinkProps>) {
  const href = useFilterOptionHref(nextFilters);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Plain left-click: behave like the radio did. Modified clicks
    // (new tab, etc.) fall through to the browser and load the real page.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onSelect();
  };

  const background = selected
    ? "bg-inverted"
    : colorScheme === "neutral"
      ? "bg-primary"
      : `bg-${colorScheme}-main`;
  const border = selected
    ? "border-inverted"
    : colorScheme === "neutral"
      ? "border-neutral-lighter"
      : `border-${colorScheme}`;

  return (
    <OakFlex
      as="a"
      href={href}
      onClick={handleClick}
      aria-current={selected ? "page" : undefined}
      data-testid={testId}
      $borderRadius="border-radius-s"
      $ba="border-solid-s"
      $pv="spacing-4"
      $ph="spacing-12"
      $gap="spacing-8"
      $alignItems="center"
      $minHeight="spacing-40"
      $width="fit-content"
      $background={background as never}
      $borderColor={border as never}
      $color={selected ? "text-inverted" : "text-primary"}
      style={{ textDecoration: "none" }}
    >
      {icon && (
        <OakIcon
          iconName={icon}
          alt=""
          $width="spacing-24"
          $height="spacing-24"
          $colorFilter={selected ? "text-inverted" : undefined}
        />
      )}
      <OakP $font="heading-7" as="span">
        {children}
      </OakP>
    </OakFlex>
  );
}
