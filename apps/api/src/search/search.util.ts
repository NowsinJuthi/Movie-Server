import { MOVIE_GENRES, SearchSort } from '@movie-server/shared';
import { escapeRegex } from '../movies/movie.util';
import { normalizeSearchText } from '../common/search-fields';

export type SearchMongoFilter = Record<string, unknown>;

export function prefixRegex(value: string): RegExp {
  return new RegExp(`^${escapeRegex(normalizeSearchText(value))}`);
}

export function containsRegex(value: string): RegExp {
  return new RegExp(escapeRegex(normalizeSearchText(value)));
}

export function toTextSearch(query: string): string {
  return normalizeSearchText(query)
    .replace(/[+\-~\\()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shouldUseTextSearch(query: string): boolean {
  return toTextSearch(query).length >= 3;
}

export function matchingGenres(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }
  return MOVIE_GENRES.filter(
    (genre) => genre === normalized || genre.startsWith(normalized) || normalized.startsWith(genre),
  );
}

export function matchingTags(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? [normalized] : [];
}

export function titleMatchScore(titleNormalized: string | null | undefined, query: string): number {
  const title = titleNormalized ?? '';
  const needle = normalizeSearchText(query);
  if (!title || !needle) {
    return 0;
  }
  if (title === needle) {
    return 100;
  }
  if (title.startsWith(needle)) {
    return 80;
  }
  if (title.includes(needle)) {
    return 55;
  }
  return 0;
}

export function personMatchScore(people: string[] | undefined, query: string): number {
  const needle = normalizeSearchText(query);
  if (!needle || !people?.length) {
    return 0;
  }
  let best = 0;
  for (const person of people) {
    if (person === needle) {
      best = Math.max(best, 90);
    } else if (person.startsWith(needle)) {
      best = Math.max(best, 70);
    } else if (person.includes(needle)) {
      best = Math.max(best, 45);
    }
  }
  return best;
}

export function relevanceScore(input: {
  titleNormalized?: string | null;
  originalTitleNormalized?: string | null;
  peopleNormalized?: string[];
  genres?: string[];
  tags?: string[];
  query: string;
  textScore?: number;
}): number {
  const { query } = input;
  const title = Math.max(
    titleMatchScore(input.titleNormalized, query),
    Math.round(titleMatchScore(input.originalTitleNormalized, query) * 0.9),
  );
  const people = personMatchScore(input.peopleNormalized, query);
  const genres = matchingGenres(query).some((genre) => input.genres?.includes(genre)) ? 50 : 0;
  const tags = matchingTags(query).some((tag) => input.tags?.includes(tag)) ? 48 : 0;
  const text = input.textScore ? Math.min(40, 20 + input.textScore * 4) : 0;
  return Math.max(title, people, genres, tags, text);
}

export function similarContentScore(input: {
  sourceGenres: string[];
  sourceCast: string[];
  sourceDirectors: string[];
  candidateGenres: string[];
  candidateCast: string[];
  candidateDirectors: string[];
  popular?: boolean;
  trending?: boolean;
  imdb?: number | null;
}): number {
  const genreOverlap = input.candidateGenres.filter((genre) => input.sourceGenres.includes(genre)).length;
  const castOverlap = input.candidateCast.filter((name) => input.sourceCast.includes(name)).length;
  const directorOverlap = input.candidateDirectors.filter((name) => input.sourceDirectors.includes(name)).length;
  return (
    genreOverlap * 5 +
    castOverlap * 3 +
    directorOverlap * 4 +
    (input.popular ? 2 : 0) +
    (input.trending ? 2 : 0) +
    (input.imdb ?? 0)
  );
}

export function buildIndexedQueryClauses(query: string): SearchMongoFilter[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }
  const rx = prefixRegex(normalized);
  const clauses: SearchMongoFilter[] = [
    { titleNormalized: rx },
    { originalTitleNormalized: rx },
    { peopleNormalized: rx },
  ];
  const genres = matchingGenres(normalized);
  if (genres.length) {
    clauses.push({ genres: { $in: genres } });
  }
  clauses.push({ tags: normalized });
  return clauses;
}

export function yearRangeFilter(
  field: 'releaseYear' | 'firstAirYear',
  year?: number,
  yearFrom?: number,
  yearTo?: number,
): SearchMongoFilter | null {
  if (year) {
    return { [field]: year };
  }
  if (yearFrom || yearTo) {
    const range: Record<string, number> = {};
    if (yearFrom) range.$gte = yearFrom;
    if (yearTo) range.$lte = yearTo;
    return { [field]: range };
  }
  return null;
}

export function ratingFilter(minRating?: number): SearchMongoFilter | null {
  if (minRating == null) {
    return null;
  }
  return {
    $or: [{ 'ratings.imdb': { $gte: minRating } }, { 'ratings.tmdb': { $gte: minRating } }],
  };
}

export function catalogSort(sort: SearchSort, yearField: 'releaseYear' | 'firstAirYear'): Record<string, 1 | -1> {
  switch (sort) {
    case SearchSort.Newest:
      return { createdAt: -1 };
    case SearchSort.Rating:
      return { 'ratings.imdb': -1, 'ratings.tmdb': -1, createdAt: -1 };
    case SearchSort.Popularity:
      return { popular: -1, trending: -1, featured: -1, 'ratings.imdb': -1, createdAt: -1 };
    default:
      return { [yearField]: -1, createdAt: -1 };
  }
}

export function emptyGroup<T>(page: number, limit: number): {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextPage: number | null;
} {
  return { items: [], total: 0, page, limit, totalPages: 1, nextPage: null };
}

export function paginateMeta(total: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    page,
    limit,
    totalPages,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

export function intersectIds(sets: string[][]): string[] {
  if (sets.length === 0) {
    return [];
  }
  return sets.reduce((acc, current) => acc.filter((id) => current.includes(id)));
}
