"use client";

import {
  LANGUAGE_LABELS,
  MOVIE_GENRES,
  PROFILE_LANGUAGES,
  SEARCH_SORTS,
  VIDEO_RESOLUTIONS,
  type SearchKind,
  type SearchQuery,
  type SearchSort,
} from "@movie-server/shared";
import { useMemo, useState } from "react";
import {
  FilterActions,
  FilterChip,
  FilterClearButton,
  FilterFooter,
  FilterGrid,
  FilterMobileToggle,
  FilterPanel,
  FilterSelect,
  FilterToolbar,
} from "@/components/filters/filter-ui";

const YEARS = Array.from({ length: 40 }, (_, index) => new Date().getFullYear() - index);

function genreLabel(genre: string): string {
  if (genre === "scifi") return "Sci-Fi";
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

function sortLabel(sort: SearchSort): string {
  return sort.charAt(0).toUpperCase() + sort.slice(1);
}

function qualityLabel(quality: string): string {
  return quality === "4k" ? "4K UHD" : quality.toUpperCase();
}

export function searchFiltersActive(query: SearchQuery): boolean {
  const defaultSort = query.q ? "relevance" : "popularity";
  return Boolean(
    (query.kind && query.kind !== "all") ||
      query.genre ||
      query.year ||
      query.minRating ||
      query.language ||
      query.audio ||
      query.quality ||
      (query.sort && query.sort !== defaultSort),
  );
}

export function SearchFilters({
  query,
  onChange,
  onClear,
}: {
  query: SearchQuery;
  onChange: (next: Partial<SearchQuery>) => void;
  onClear?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const defaultSort = query.q ? "relevance" : "popularity";
  const hasActive = searchFiltersActive(query);

  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string; clear: Partial<SearchQuery> }> = [];
    if (query.kind && query.kind !== "all") {
      items.push({ key: "kind", label: query.kind, clear: { kind: "all" as SearchKind } });
    }
    if (query.genre) items.push({ key: "genre", label: genreLabel(query.genre), clear: { genre: undefined } });
    if (query.year) items.push({ key: "year", label: String(query.year), clear: { year: undefined } });
    if (query.minRating != null) {
      items.push({ key: "rating", label: `${query.minRating}+ rating`, clear: { minRating: undefined } });
    }
    if (query.language) {
      items.push({
        key: "language",
        label: LANGUAGE_LABELS[query.language as keyof typeof LANGUAGE_LABELS] ?? query.language,
        clear: { language: undefined },
      });
    }
    if (query.audio) {
      items.push({
        key: "audio",
        label: `Audio: ${LANGUAGE_LABELS[query.audio as keyof typeof LANGUAGE_LABELS] ?? query.audio}`,
        clear: { audio: undefined },
      });
    }
    if (query.quality) {
      items.push({ key: "quality", label: qualityLabel(query.quality), clear: { quality: undefined } });
    }
    if (query.sort && query.sort !== defaultSort) {
      items.push({ key: "sort", label: sortLabel(query.sort), clear: { sort: defaultSort as SearchSort } });
    }
    return items;
  }, [defaultSort, query]);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onChange({
      kind: "all",
      genre: undefined,
      year: undefined,
      minRating: undefined,
      language: undefined,
      audio: undefined,
      quality: undefined,
      sort: defaultSort as SearchSort,
    });
  };

  return (
    <FilterPanel>
      <div className="flex flex-col gap-4">
        <FilterToolbar>
          <FilterSelect
            id="search-sort"
            label="Sort by"
            value={query.sort ?? defaultSort}
            onChange={(sort) => onChange({ sort: sort as SearchSort })}
            options={SEARCH_SORTS.map((sort) => ({ value: sort, label: sortLabel(sort) }))}
            className="w-full sm:w-44"
          />
          <FilterActions className="ms-auto lg:pb-0">
            <FilterMobileToggle open={mobileOpen} onClick={() => setMobileOpen((open) => !open)} />
            {hasActive ? <FilterClearButton onClick={handleClear} /> : null}
          </FilterActions>
        </FilterToolbar>

        <FilterGrid open={mobileOpen ? true : false}>
          <FilterSelect
            id="search-kind"
            label="Type"
            value={query.kind ?? "all"}
            onChange={(kind) => onChange({ kind: kind as SearchKind })}
            options={[
              { value: "all", label: "All types" },
              { value: "movie", label: "Movies" },
              { value: "series", label: "Series" },
              { value: "episode", label: "Episodes" },
            ]}
          />
          <FilterSelect
            id="search-genre"
            label="Genre"
            value={query.genre ?? ""}
            onChange={(genre) => onChange({ genre: genre || undefined })}
            options={[
              { value: "", label: "All genres" },
              ...MOVIE_GENRES.map((genre) => ({ value: genre, label: genreLabel(genre) })),
            ]}
          />
          <FilterSelect
            id="search-year"
            label="Year"
            value={query.year ? String(query.year) : ""}
            onChange={(year) => onChange({ year: year ? Number(year) : undefined })}
            options={[
              { value: "", label: "All years" },
              ...YEARS.map((year) => ({ value: String(year), label: String(year) })),
            ]}
          />
          <FilterSelect
            id="search-rating"
            label="Min rating"
            value={query.minRating != null ? String(query.minRating) : ""}
            onChange={(minRating) => onChange({ minRating: minRating ? Number(minRating) : undefined })}
            options={[
              { value: "", label: "Any rating" },
              ...[9, 8, 7, 6, 5].map((value) => ({ value: String(value), label: `${value}+` })),
            ]}
          />
          <FilterSelect
            id="search-language"
            label="Language"
            value={query.language ?? ""}
            onChange={(language) => onChange({ language: language || undefined })}
            options={[
              { value: "", label: "Any language" },
              ...PROFILE_LANGUAGES.map((code) => ({
                value: code,
                label: LANGUAGE_LABELS[code] ?? code,
              })),
            ]}
          />
          <FilterSelect
            id="search-audio"
            label="Audio"
            value={query.audio ?? ""}
            onChange={(audio) => onChange({ audio: audio || undefined })}
            options={[
              { value: "", label: "Any audio" },
              ...PROFILE_LANGUAGES.map((code) => ({
                value: code,
                label: LANGUAGE_LABELS[code] ?? code,
              })),
            ]}
          />
          <FilterSelect
            id="search-quality"
            label="Quality"
            value={query.quality ?? ""}
            onChange={(quality) => onChange({ quality: quality || undefined })}
            options={[
              { value: "", label: "Any quality" },
              ...VIDEO_RESOLUTIONS.map((quality) => ({
                value: quality,
                label: qualityLabel(quality),
              })),
            ]}
          />
        </FilterGrid>

        {hasActive ? (
          <FilterFooter
            summary="Refine your results with the filters above."
            chips={
              <>
                {chips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    onRemove={() => onChange(chip.clear)}
                  />
                ))}
              </>
            }
          />
        ) : null}
      </div>
    </FilterPanel>
  );
}
