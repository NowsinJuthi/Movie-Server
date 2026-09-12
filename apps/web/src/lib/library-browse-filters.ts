import { VIDEO_RESOLUTIONS, type HomeCard, type VideoResolution } from "@movie-server/shared";

export const LibraryBrowseSort = {
  Title: "title",
  TitleDesc: "title-desc",
  Newest: "newest",
  Oldest: "oldest",
  Rating: "rating",
  Popularity: "popularity",
  Trending: "trending",
  Featured: "featured",
} as const;

export type LibraryBrowseSort = (typeof LibraryBrowseSort)[keyof typeof LibraryBrowseSort];

export const LIBRARY_BROWSE_SORTS: LibraryBrowseSort[] = [
  LibraryBrowseSort.Title,
  LibraryBrowseSort.TitleDesc,
  LibraryBrowseSort.Newest,
  LibraryBrowseSort.Oldest,
  LibraryBrowseSort.Rating,
  LibraryBrowseSort.Popularity,
  LibraryBrowseSort.Trending,
  LibraryBrowseSort.Featured,
];

export type LibraryBrowseFilters = {
  q?: string;
  genre?: string;
  year?: number;
  minRating?: number;
  quality?: VideoResolution;
  sort?: LibraryBrowseSort;
};

const RESOLUTION_RANK: Record<VideoResolution, number> = {
  "480p": 1,
  "720p": 2,
  "1080p": 3,
  "4k": 4,
};

export function genreLabel(genre: string): string {
  if (genre === "scifi") return "Sci-Fi";
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

export function sortLabel(sort: LibraryBrowseSort): string {
  switch (sort) {
    case LibraryBrowseSort.Title:
      return "Title A–Z";
    case LibraryBrowseSort.TitleDesc:
      return "Title Z–A";
    case LibraryBrowseSort.Newest:
      return "Newest";
    case LibraryBrowseSort.Oldest:
      return "Oldest";
    case LibraryBrowseSort.Rating:
      return "Top rated";
    case LibraryBrowseSort.Popularity:
      return "Popular";
    case LibraryBrowseSort.Trending:
      return "Trending";
    case LibraryBrowseSort.Featured:
      return "Featured";
    default:
      return sort;
  }
}

export function readLibraryBrowseFilters(params: URLSearchParams): LibraryBrowseFilters {
  const year = params.get("year");
  const minRating = params.get("minRating");
  const quality = params.get("quality");
  const sort = params.get("sort");
  return {
    q: params.get("q")?.trim() || undefined,
    genre: params.get("genre") || undefined,
    year: year ? Number(year) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    quality: quality && VIDEO_RESOLUTIONS.includes(quality as VideoResolution) ? (quality as VideoResolution) : undefined,
    sort:
      sort && LIBRARY_BROWSE_SORTS.includes(sort as LibraryBrowseSort)
        ? (sort as LibraryBrowseSort)
        : LibraryBrowseSort.Title,
  };
}

export function libraryBrowseFiltersActive(filters: LibraryBrowseFilters): boolean {
  return Boolean(
    filters.q ||
      filters.genre ||
      filters.year ||
      filters.minRating ||
      filters.quality ||
      (filters.sort && filters.sort !== LibraryBrowseSort.Title),
  );
}

export function collectLibraryGenres(items: HomeCard[]): string[] {
  const genres = new Set<string>();
  for (const item of items) {
    for (const genre of item.genres) {
      genres.add(genre);
    }
  }
  return [...genres].sort((a, b) => genreLabel(a).localeCompare(genreLabel(b)));
}

export function collectLibraryYears(items: HomeCard[]): number[] {
  const years = new Set<number>();
  for (const item of items) {
    if (item.year > 0) years.add(item.year);
  }
  return [...years].sort((a, b) => b - a);
}

function cardRating(card: HomeCard): number {
  return card.ratings.imdb ?? card.ratings.tmdb ?? card.ratings.audience ?? card.ratings.critics ?? 0;
}

function resolutionRank(resolution: VideoResolution | null | undefined): number {
  if (!resolution) return 0;
  return RESOLUTION_RANK[resolution] ?? 0;
}

export function filterAndSortLibraryItems(items: HomeCard[], filters: LibraryBrowseFilters): HomeCard[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  let result = items.filter((item) => {
    if (q && !item.title.toLowerCase().includes(q)) return false;
    if (filters.genre && !item.genres.includes(filters.genre)) return false;
    if (filters.year && item.year !== filters.year) return false;
    if (filters.minRating != null && cardRating(item) < filters.minRating) return false;
    if (filters.quality) {
      const minRank = RESOLUTION_RANK[filters.quality];
      if (resolutionRank(item.maxResolution) < minRank) return false;
    }
    return true;
  });

  const sort = filters.sort ?? LibraryBrowseSort.Title;
  result = [...result].sort((a, b) => {
    switch (sort) {
      case LibraryBrowseSort.TitleDesc:
        return b.title.localeCompare(a.title);
      case LibraryBrowseSort.Newest:
        return b.year - a.year || a.title.localeCompare(b.title);
      case LibraryBrowseSort.Oldest:
        return a.year - b.year || a.title.localeCompare(b.title);
      case LibraryBrowseSort.Rating:
        return cardRating(b) - cardRating(a) || a.title.localeCompare(b.title);
      case LibraryBrowseSort.Popularity:
        return Number(b.popular) - Number(a.popular) || a.title.localeCompare(b.title);
      case LibraryBrowseSort.Trending:
        return Number(b.trending) - Number(a.trending) || a.title.localeCompare(b.title);
      case LibraryBrowseSort.Featured:
        return Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title);
      case LibraryBrowseSort.Title:
      default:
        return a.title.localeCompare(b.title);
    }
  });

  return result;
}
