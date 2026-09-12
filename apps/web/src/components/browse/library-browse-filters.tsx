"use client";

import { VIDEO_RESOLUTIONS } from "@movie-server/shared";
import { useMemo, useState } from "react";
import {
  FilterActions,
  FilterChip,
  FilterClearButton,
  FilterFooter,
  FilterGrid,
  FilterMobileToggle,
  FilterPanel,
  FilterSearch,
  FilterSelect,
  FilterSummaryCount,
  FilterToolbar,
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

export function LibraryBrowseFilters({
  items,
  isTvLibrary,
  filters,
  onChange,
  onClear,
  filteredCount,
  totalCount,
}: {
  items: HomeCard[];
  isTvLibrary: boolean;
  filters: LibraryBrowseFilters;
  onChange: (next: Partial<LibraryBrowseFilters>) => void;
  onClear: () => void;
  filteredCount: number;
  totalCount: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const genres = useMemo(() => collectLibraryGenres(items), [items]);
  const years = useMemo(() => collectLibraryYears(items), [items]);
  const hasActive = libraryBrowseFiltersActive(filters);

  return (
    <FilterPanel>
      <div className="flex flex-col gap-4">
        <FilterToolbar>
          <FilterSearch
            id="library-search"
            label="Search titles"
            value={filters.q ?? ""}
            onChange={(q) => onChange({ q: q || undefined })}
            placeholder={isTvLibrary ? "Search TV shows..." : "Search movies..."}
            className="min-w-0 flex-1"
          />

          <FilterSelect
            id="library-sort"
            label="Sort by"
            value={filters.sort ?? Sort.Title}
            onChange={(sort) => onChange({ sort: sort as LibraryBrowseSort })}
            options={LIBRARY_BROWSE_SORTS.map((sort) => ({ value: sort, label: sortLabel(sort) }))}
            className="w-full lg:w-44"
          />

          <FilterActions className="lg:pb-0">
            <FilterMobileToggle open={mobileOpen} onClick={() => setMobileOpen((open) => !open)} />
            {hasActive ? <FilterClearButton onClick={onClear} /> : null}
          </FilterActions>
        </FilterToolbar>

        <FilterGrid open={mobileOpen ? true : false}>
          <FilterSelect
            id="library-genre"
            label="Genre"
            value={filters.genre ?? ""}
            onChange={(genre) => onChange({ genre: genre || undefined })}
            options={[
              { value: "", label: "All genres" },
              ...genres.map((genre) => ({ value: genre, label: genreLabel(genre) })),
            ]}
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
          />
          {!isTvLibrary ? (
            <FilterSelect
              id="library-quality"
              label="Quality"
              value={filters.quality ?? ""}
              onChange={(quality) =>
                onChange({
                  quality: quality ? (quality as LibraryBrowseFilters["quality"]) : undefined,
                })
              }
              options={[
                { value: "", label: "Any quality" },
                ...VIDEO_RESOLUTIONS.map((quality) => ({
                  value: quality,
                  label: quality === "4k" ? "4K UHD" : quality.toUpperCase(),
                })),
              ]}
            />
          ) : null}
        </FilterGrid>

        <FilterFooter
          summary={
            <FilterSummaryCount
              filtered={filteredCount}
              total={totalCount}
              noun={isTvLibrary ? "shows" : "movies"}
            />
          }
          chips={
            hasActive ? (
              <>
                {filters.q ? <FilterChip label={`“${filters.q}”`} onRemove={() => onChange({ q: undefined })} /> : null}
                {filters.genre ? (
                  <FilterChip label={genreLabel(filters.genre)} onRemove={() => onChange({ genre: undefined })} />
                ) : null}
                {filters.year ? <FilterChip label={String(filters.year)} onRemove={() => onChange({ year: undefined })} /> : null}
                {filters.minRating != null ? (
                  <FilterChip label={`${filters.minRating}+ rating`} onRemove={() => onChange({ minRating: undefined })} />
                ) : null}
                {filters.quality ? (
                  <FilterChip label={filters.quality.toUpperCase()} onRemove={() => onChange({ quality: undefined })} />
                ) : null}
              </>
            ) : null
          }
        />
      </div>
    </FilterPanel>
  );
}
