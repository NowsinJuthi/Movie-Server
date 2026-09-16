"use client";

import { useMemo } from "react";
import {
  FilterChip,
  FilterClearButton,
  FilterPanel,
  FilterSelect,
} from "@/components/filters/filter-ui";
import {
  collectLibraryGenres,
  collectLibraryYears,
  genreLabel,
  libraryBrowseFiltersActive,
  sortLabel,
  type LibraryBrowseFilters,
  type LibraryBrowseSort,
  LIBRARY_BROWSE_SORTS,
  LibraryBrowseSort as Sort,
} from "@/lib/library-browse-filters";
import type { HomeCard } from "@movie-server/shared";

const filterFieldClass = "min-w-[8.5rem] shrink-0 flex-1 basis-0 sm:min-w-[9.5rem]";

export function LibraryBrowseFilters({
  items,
  filters,
  onChange,
  onClear,
}: {
  items: HomeCard[];
  filters: LibraryBrowseFilters;
  onChange: (next: Partial<LibraryBrowseFilters>) => void;
  onClear: () => void;
}) {
  const genres = useMemo(() => collectLibraryGenres(items), [items]);
  const years = useMemo(() => collectLibraryYears(items), [items]);
  const hasActive = libraryBrowseFiltersActive(filters);

  return (
    <FilterPanel>
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3 overflow-x-auto pb-1 brand-scrollbar">
          <FilterSelect
            id="library-sort"
            label="Sort by"
            value={filters.sort ?? Sort.Title}
            onChange={(sort) => onChange({ sort: sort as LibraryBrowseSort })}
            options={LIBRARY_BROWSE_SORTS.map((sort) => ({ value: sort, label: sortLabel(sort) }))}
            className={filterFieldClass}
          />
          <FilterSelect
            id="library-genre"
            label="Genre"
            value={filters.genre ?? ""}
            onChange={(genre) => onChange({ genre: genre || undefined })}
            options={[
              { value: "", label: "All genres" },
              ...genres.map((genre) => ({ value: genre, label: genreLabel(genre) })),
            ]}
            className={filterFieldClass}
          />
          <FilterSelect
            id="library-year"
            label="Year"
            value={filters.year ? String(filters.year) : ""}
            onChange={(year) => onChange({ year: year ? Number(year) : undefined })}
            options={[
              { value: "", label: "All years" },
              ...years.map((year) => ({ value: String(year), label: String(year) })),
            ]}
            className={filterFieldClass}
          />
          <FilterSelect
            id="library-rating"
            label="Min rating"
            value={filters.minRating != null ? String(filters.minRating) : ""}
            onChange={(minRating) => onChange({ minRating: minRating ? Number(minRating) : undefined })}
            options={[
              { value: "", label: "Any rating" },
              ...[9, 8, 7, 6, 5].map((value) => ({ value: String(value), label: `${value}+` })),
            ]}
            className={filterFieldClass}
          />
          {hasActive ? (
            <div className="shrink-0 pb-0.5">
              <FilterClearButton onClick={onClear} />
            </div>
          ) : null}
        </div>

        {hasActive ? (
          <div className="flex flex-wrap gap-1.5">
            {filters.genre ? (
              <FilterChip label={genreLabel(filters.genre)} onRemove={() => onChange({ genre: undefined })} />
            ) : null}
            {filters.year ? <FilterChip label={String(filters.year)} onRemove={() => onChange({ year: undefined })} /> : null}
            {filters.minRating != null ? (
              <FilterChip label={`${filters.minRating}+ rating`} onRemove={() => onChange({ minRating: undefined })} />
            ) : null}
          </div>
        ) : null}
      </div>
    </FilterPanel>
  );
}
