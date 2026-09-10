import { MOVIE_GENRES, VIDEO_RESOLUTIONS } from './movie';
import { PROFILE_LANGUAGES } from './profile';
import type { HomeCard } from './home';

export const SearchSort = {
  Relevance: 'relevance',
  Newest: 'newest',
  Rating: 'rating',
  Popularity: 'popularity',
} as const;

export type SearchSort = (typeof SearchSort)[keyof typeof SearchSort];
export const SEARCH_SORTS = [
  SearchSort.Relevance,
  SearchSort.Newest,
  SearchSort.Rating,
  SearchSort.Popularity,
] as const;

export const SearchKind = {
  All: 'all',
  Movie: 'movie',
  Series: 'series',
  Episode: 'episode',
} as const;

export type SearchKind = (typeof SearchKind)[keyof typeof SearchKind];
export const SEARCH_KINDS = [
  SearchKind.All,
  SearchKind.Movie,
  SearchKind.Series,
  SearchKind.Episode,
] as const;

export const SEARCH_HISTORY_LIMIT = 20;
export const SEARCH_SUGGEST_MIN_CHARS = 1;
export const SEARCH_COMMIT_MIN_CHARS = 2;

export const SEARCH_LANGUAGES = PROFILE_LANGUAGES;
export const SEARCH_QUALITIES = VIDEO_RESOLUTIONS;
export const SEARCH_GENRES = MOVIE_GENRES;

export type SearchGroupPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextPage: number | null;
};

export type SearchEpisodeHit = {
  kind: 'episode';
  id: string;
  seriesId: string;
  seasonId: string;
  title: string;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  year: number | null;
  description: string;
  posterUrl: string | null;
  href: string;
  watchHref: string | null;
  score: number;
};

export type SearchPersonHit = {
  name: string;
  roles: Array<'actor' | 'director' | 'writer'>;
  titles: Array<{ id: string; kind: 'movie' | 'series'; title: string; href: string }>;
};

export type SearchSuggestItem = {
  kind: 'title' | 'person' | 'genre' | 'tag';
  label: string;
  query: string;
  href?: string;
  id?: string;
  mediaKind?: 'movie' | 'series';
};

export type SearchHistoryItem = {
  id: string;
  query: string;
  resultCount: number;
  searchedAt: string;
};

export type SearchQuery = {
  q?: string;
  kind?: SearchKind;
  genre?: string;
  tag?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  language?: string;
  audio?: string;
  quality?: string;
  sort?: SearchSort;
  page?: number;
  limit?: number;
  commit?: boolean;
};

export type SearchResponse = {
  q: string;
  kind: SearchKind;
  sort: SearchSort;
  movies: SearchGroupPage<HomeCard>;
  series: SearchGroupPage<HomeCard>;
  episodes: SearchGroupPage<SearchEpisodeHit>;
  people: SearchPersonHit[];
  total: number;
  recommendations: HomeCard[];
};

export type SearchSuggestResponse = {
  q: string;
  titles: SearchSuggestItem[];
  people: SearchSuggestItem[];
  genres: SearchSuggestItem[];
};

export type SearchTrendingResponse = {
  items: Array<{ query: string; count: number }>;
};

export type SearchHistoryResponse = {
  items: SearchHistoryItem[];
};

export type SearchSimilarResponse = {
  id: string;
  kind: 'movie' | 'series';
  items: HomeCard[];
};
