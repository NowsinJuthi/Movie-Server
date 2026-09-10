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
import { Label } from "@/components/ui/label";

const YEARS = Array.from({ length: 40 }, (_, index) => new Date().getFullYear() - index);

function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-black/60 px-2 text-sm text-foreground"
      >
        {children}
      </select>
    </label>
  );
}

export function SearchFilters({
  query,
  onChange,
}: {
  query: SearchQuery;
  onChange: (next: Partial<SearchQuery>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select id="kind" label="Type" value={query.kind ?? "all"} onChange={(kind) => onChange({ kind: kind as SearchKind })}>
        <option value="all">All</option>
        <option value="movie">Movies</option>
        <option value="series">Series</option>
        <option value="episode">Episodes</option>
      </Select>
      <Select id="genre" label="Genre" value={query.genre ?? ""} onChange={(genre) => onChange({ genre: genre || undefined })}>
        <option value="">Any genre</option>
        {MOVIE_GENRES.map((genre) => (
          <option key={genre} value={genre}>
            {genre === "scifi" ? "Sci-Fi" : genre.charAt(0).toUpperCase() + genre.slice(1)}
          </option>
        ))}
      </Select>
      <Select
        id="year"
        label="Year"
        value={query.year ? String(query.year) : ""}
        onChange={(year) => onChange({ year: year ? Number(year) : undefined })}
      >
        <option value="">Any year</option>
        {YEARS.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
      <Select
        id="rating"
        label="Min rating"
        value={query.minRating != null ? String(query.minRating) : ""}
        onChange={(minRating) => onChange({ minRating: minRating ? Number(minRating) : undefined })}
      >
        <option value="">Any rating</option>
        {[9, 8, 7, 6, 5].map((value) => (
          <option key={value} value={value}>
            {value}+
          </option>
        ))}
      </Select>
      <Select
        id="language"
        label="Language"
        value={query.language ?? ""}
        onChange={(language) => onChange({ language: language || undefined })}
      >
        <option value="">Any language</option>
        {PROFILE_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_LABELS[code] ?? code}
          </option>
        ))}
      </Select>
      <Select
        id="audio"
        label="Audio"
        value={query.audio ?? ""}
        onChange={(audio) => onChange({ audio: audio || undefined })}
      >
        <option value="">Any audio</option>
        {PROFILE_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_LABELS[code] ?? code}
          </option>
        ))}
      </Select>
      <Select
        id="quality"
        label="Quality"
        value={query.quality ?? ""}
        onChange={(quality) => onChange({ quality: quality || undefined })}
      >
        <option value="">Any quality</option>
        {VIDEO_RESOLUTIONS.map((quality) => (
          <option key={quality} value={quality}>
            {quality}
          </option>
        ))}
      </Select>
      <Select
        id="sort"
        label="Sort"
        value={query.sort ?? (query.q ? "relevance" : "popularity")}
        onChange={(sort) => onChange({ sort: sort as SearchSort })}
      >
        {SEARCH_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {sort.charAt(0).toUpperCase() + sort.slice(1)}
          </option>
        ))}
      </Select>
      <Label className="sr-only" htmlFor="kind">
        Search filters
      </Label>
    </div>
  );
}
